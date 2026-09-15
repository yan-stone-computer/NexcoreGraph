/* 启核图策 · 图检索算子与 GraphRAG 证据装配（补充方案第 4 章）
   全部为确定性算法，**不调用模型**：
     matchEntity / neighbors / multiHop / subgraph / aggregate / buildEvidence
   证据形态：路径（nodes+edges）+ 事实（来自节点属性）+ 来源（概念层 src/url）。 */

const { normName } = require('./graphBuild');

const ITEM = 'ItemInstance';
const FOOD = 'FoodConcept';
const RECIPE = 'RecipeConcept';
const PLAN = 'Plan';
const RULE = 'RuleConcept';

/** 建立内存索引（按版本缓存，图不变则复用） */
function buildIndex(graph) {
  const byId = new Map();
  const byType = new Map();
  const byLabel = new Map();
  const out = new Map();
  const inn = new Map();
  const communities = new Map();

  (graph.nodes || []).forEach((n) => {
    byId.set(n.id, n);
    if (!byType.has(n.type)) byType.set(n.type, []);
    byType.get(n.type).push(n.id);
    const key = normName(n.label);
    if (key !== '') {
      if (!byLabel.has(key)) byLabel.set(key, []);
      byLabel.get(key).push(n.id);
    }
    out.set(n.id, []);
    inn.set(n.id, []);
  });
  (graph.edges || []).forEach((e) => {
    if (!out.has(e.from)) out.set(e.from, []);
    if (!inn.has(e.to)) inn.set(e.to, []);
    out.get(e.from).push({ to: e.to, type: e.type, props: e.props || {} });
    inn.get(e.to).push({ from: e.from, type: e.type, props: e.props || {} });
  });
  (graph.communities || []).forEach((c) => communities.set(c.id, c));

  return { graph, byId, byType, byLabel, out, inn, communities };
}

function nodesOfType(idx, type) {
  return idx.byType.get(type) || [];
}

function label(idx, id) {
  const n = idx.byId.get(id);
  return n ? n.label : id;
}

/** 实体识别：标签精确/包含匹配，实例优先于概念 */
function matchEntity(idx, q) {
  const text = String(q || '').trim();
  if (text === '') return [];
  const hits = [];
  const push = (ids, weight) => {
    ids.forEach((id) => {
      if (hits.indexOf(id) < 0) hits.push(id);
    });
  };
  const exact = idx.byLabel.get(normName(text));
  if (exact) push(exact, 0);

  // 长名优先，避免"蛋"误命中"蛋糕"；同时按归一名称匹配（"鲜牛奶"→"牛奶"）
  const candidates = [];
  idx.byId.forEach((n) => {
    const nm = n.label || '';
    const nn = normName(nm);
    if (nm.length >= 2 && text.indexOf(nm) > -1) {
      candidates.push({ id: n.id, len: nm.length, type: n.type });
    } else if (nn.length >= 2 && text.indexOf(nn) > -1) {
      candidates.push({ id: n.id, len: nn.length, type: n.type });
    }
  });
  candidates.sort((a, b) => b.len - a.len);
  candidates.forEach((c) => {
    if (hits.indexOf(c.id) < 0) hits.push(c.id);
  });
  // 实例优先
  hits.sort((a, b) => {
    const ta = idx.byId.get(a);
    const tb = idx.byId.get(b);
    const wa = ta && ta.type === ITEM ? 0 : ta && ta.type === FOOD ? 1 : 2;
    const wb = tb && tb.type === ITEM ? 0 : tb && tb.type === FOOD ? 1 : 2;
    return wa - wb;
  });
  return hits;
}

/** 1~n 跳邻域（限定边类型可选） */
function neighbors(idx, id, hops, edgeTypes) {
  const allow = edgeTypes && edgeTypes.length ? edgeTypes : null;
  const visited = new Set([id]);
  const usedEdges = [];
  let frontier = [id];
  for (let h = 0; h < Math.max(1, hops); h++) {
    const next = [];
    frontier.forEach((cur) => {
      const list = (idx.out.get(cur) || []).concat(idx.inn.get(cur) || []);
      list.forEach((e) => {
        if (allow && allow.indexOf(e.type) < 0) return;
        const other = e.to === cur ? e.from : e.to;
        usedEdges.push({ from: e.from, to: e.to, type: e.type, props: e.props });
        if (!visited.has(other)) {
          visited.add(other);
          next.push(other);
        }
      });
    });
    frontier = next;
    if (frontier.length === 0) break;
  }
  return { nodes: Array.from(visited), edges: usedEdges };
}

/** 子图过滤：按库 / 类别 / 场景 / 是否临期 / 是否含私有 */
function subgraph(idx, filter) {
  const f = filter || {};
  const keep = [];
  nodesOfType(idx, ITEM).forEach((id) => {
    const n = idx.byId.get(id);
    if (f.includePrivate === false && n.props.isPrivate) return;
    if (f.expiringOnly && !(n.props.expDays > 0 && n.props.expDays <= 7)) return;
    if (f.libraryId) {
      const inLib = (idx.inn.get(id) || []).some((e) => e.from === `lib:${f.libraryId}` && e.type === 'contains');
      if (!inLib) return;
    }
    if (f.category) {
      const hit = (idx.out.get(id) || []).some((e) => e.type === 'instantiates' && (idx.byId.get(e.to) || {}).props
        && idx.byId.get(e.to).props.category === f.category);
      if (!hit) return;
    }
    keep.push(id);
  });
  return keep;
}

/** 社区聚合（一级/二级/三级通用） */
function aggregate(idx, communityId) {
  const c = idx.communities.get(communityId);
  if (c) {
    return { id: c.id, level: c.level, label: c.label, stats: c.stats || {} };
  }
  return null;
}

/** 库存索引：概念 → 持有它的实例 */
function stockIndex(idx) {
  const map = new Map();
  nodesOfType(idx, ITEM).forEach((itemId) => {
    const edges = idx.out.get(itemId) || [];
    edges.forEach((e) => {
      if (e.type !== 'instantiates') return;
      if (!map.has(e.to)) map.set(e.to, []);
      map.get(e.to).push(itemId);
    });
  });
  return map;
}

function libOf(idx, itemId) {
  const e = (idx.inn.get(itemId) || []).find((x) => x.type === 'contains');
  return e ? label(idx, e.from) : '';
}

function itemLine(idx, itemId) {
  const n = idx.byId.get(itemId);
  if (!n) return '';
  const p = n.props;
  const lib = libOf(idx, itemId);
  const cover = p.isPrivate ? '（私有）' : '';
  return `${lib}·${p.pos || '未设置位置'}｜${p.name} ${p.qty}${p.unit}｜约${p.expDays}天后到期｜¥${p.price}${cover}`;
}

function conceptSrc(idx, foodId) {
  const n = idx.byId.get(foodId);
  if (!n) return '';
  const p = n.props || {};
  return { src: p.src || '', url: p.url || '', name: p.name || n.label, tip: p.tip || '', days: p.fridgeDays };
}

/** 临期物品（按剩余天数升序） */
function expiringItems(idx, limit) {
  const out = [];
  nodesOfType(idx, ITEM).forEach((id) => {
    const p = idx.byId.get(id).props;
    if (p.expDays > 0 && p.expDays <= 7) out.push(id);
  });
  out.sort((a, b) => idx.byId.get(a).props.expDays - idx.byId.get(b).props.expDays);
  return out.slice(0, limit || 5);
}

/** 菜谱可行性：命中的概念食材 / 缺失食材 */
function recipeFeasibility(idx, recipeId, stock) {
  const ingredients = (idx.inn.get(recipeId) || []).filter((e) => e.type === 'usedBy');
  const have = [];
  const miss = [];
  ingredients.forEach((e) => {
    if (stock.has(e.from)) have.push({ foodId: e.from, items: stock.get(e.from) });
    else miss.push(e.from);
  });
  return { ingredients, have, miss };
}

/**
 * GraphRAG 证据装配
 * @param {object} idx buildIndex 的产物
 * @param {'local'|'global'|'multi-hop'} mode
 * @param {string} question
 * @param {{summaries?:Array, limit?:number}} opts
 */
function buildEvidence(idx, mode, question, opts) {
  const options = opts || {};
  const limit = options.limit || 12;
  const lines = [];
  const paths = [];
  let stale = false;
  /** 证据行去重（同一物品可能被实体名与概念名各命中一次） */
  const uniqueLines = (arr) => Array.from(new Set(arr.filter((l) => l !== '')));

  if (mode === 'global') {
    const summaries = options.summaries || [];
    const q = String(question || '');
    // 选相关社区：摘要文本命中关键词优先，否则取节点数最多的前 3 个一级社区
    const scored = [];
    idx.communities.forEach((c) => {
      let score = 0;
      const s = summaries.find((x) => x.community === c.id);
      if (s && q !== '' && s.text.split('').some((ch) => q.indexOf(ch) > -1)) score += 1;
      if (c.level === 1) score += 1;
      score += (c.stats && c.stats.items ? Math.min(c.stats.items, 10) : 0) / 100;
      scored.push({ c, s, score });
    });
    scored.sort((a, b) => b.score - a.score);
    scored.slice(0, 3).forEach(({ c, s }) => {
      const st = c.stats || {};
      lines.push(`${c.label}：${st.items || 0} 件${st.expiring ? `，临期 ${st.expiring} 项` : ''}${st.value ? `，价值约 ¥${st.value}` : ''}`);
      if (s && s.basedOn === idx.graph.version) {
        lines.push(`${c.label}社区洞察：${s.text}`);
        paths.push({
          nodes: [c.id], edges: [], facts: [`${c.label} 共 ${st.items || 0} 件，临期 ${st.expiring || 0} 项`],
          src: '社区摘要（离线预计算）', score: 1
        });
      } else if (s) {
        stale = true;
      }
    });
    return { lines: uniqueLines(lines).slice(0, limit), paths, stale };
  }

  if (mode === 'multi-hop') {
    const stock = stockIndex(idx);
    const seeds = expiringItems(idx, 5);
    const recipes = new Map();   // recipeId → {hitItems:[], miss:[]}
    seeds.forEach((itemId) => {
      const foodEdges = (idx.out.get(itemId) || []).filter((e) => e.type === 'instantiates');
      foodEdges.forEach((fe) => {
        const rs = (idx.out.get(fe.to) || []).filter((e) => e.type === 'usedBy');
        rs.forEach((re) => {
          const rec = recipes.get(re.to) || { hitItems: [], hitFoods: [], miss: [], viaFood: fe.to };
          if (rec.hitItems.indexOf(itemId) < 0) rec.hitItems.push(itemId);
          if (rec.hitFoods.indexOf(fe.to) < 0) rec.hitFoods.push(fe.to);
          recipes.set(re.to, rec);
        });
      });
    });
    // 计算每个候选菜谱的缺料
    recipes.forEach((rec, recipeId) => {
      const feas = recipeFeasibility(idx, recipeId, stock);
      rec.miss = feas.miss.filter((f) => rec.hitFoods.indexOf(f) < 0);
    });
    const ranked = Array.from(recipes.entries())
      .sort((a, b) => (a[1].miss.length - b[1].miss.length) || (b[1].hitItems.length - a[1].hitItems.length))
      .slice(0, 3);

    seeds.forEach((itemId) => {
      const line = itemLine(idx, itemId);
      if (line !== '' && lines.length < limit) lines.push(line);
    });
    ranked.forEach(([recipeId, rec]) => {
      const recNode = idx.byId.get(recipeId);
      if (!recNode) return;
      const missNames = rec.miss.map((f) => label(idx, f));
      const facts = [];
      rec.hitItems.forEach((itemId) => {
        const p = idx.byId.get(itemId).props;
        facts.push(`${p.name} ${p.qty}${p.unit}（${p.expDays} 天到期）`);
      });
      facts.push(`${recNode.label} 需 ${(idx.inn.get(recipeId) || []).filter((e) => e.type === 'usedBy').length} 种食材`);
      if (missNames.length) facts.push(`缺料：${missNames.join('、')}`);
      const srcInfo = conceptSrc(idx, rec.hitFoods[0]);
      lines.push(`${recNode.label}（${recNode.props.time || ''}${recNode.props.kcal ? ` · 约 ${recNode.props.kcal} 千卡/份` : ''}）` +
        `${missNames.length === 0 ? ' · 库存齐全' : ` · 缺 ${missNames.join('、')}`}`);
      paths.push({
        nodes: rec.hitItems.concat([rec.viaFood, recipeId]).concat(rec.miss),
        edges: ['instantiates', 'usedBy', 'needs'],
        facts,
        src: srcInfo.src ? `知识库 · ${srcInfo.src}` : '知识库（菜谱）',
        score: rec.hitItems.length - rec.miss.length * 0.5
      });
    });
    return { lines: uniqueLines(lines).slice(0, limit), paths, stale };
  }

  // local search：实体邻域
  const seeds = matchEntity(idx, question).slice(0, 3);
  if (seeds.length === 0) {
    // 无实体命中：退化为临期清单（仍为图谱事实，0 次模型）
    expiringItems(idx, 5).forEach((itemId) => {
      const line = itemLine(idx, itemId);
      if (line !== '' && lines.length < limit) lines.push(line);
    });
    return { lines: uniqueLines(lines).slice(0, limit), paths, stale };
  }
  seeds.forEach((seedId) => {
    const seed = idx.byId.get(seedId);
    if (!seed) return;
    if (seed.type === ITEM) {
      const line = itemLine(idx, seedId);
      if (line !== '' && lines.length < limit) lines.push(line);
      const foodEdges = (idx.out.get(seedId) || []).filter((e) => e.type === 'instantiates');
      foodEdges.forEach((fe) => {
        const info = conceptSrc(idx, fe.to);
        const facts = [`${seed.props.name} ${seed.props.qty}${seed.props.unit}，${seed.props.expDays} 天到期`];
        if (info.tip) facts.push(`存放建议：${info.tip}`);
        if (info.days) facts.push(`知识库参考冷藏天数：${info.days} 天`);
        // 相关菜谱（1 跳）
        const rs = (idx.out.get(fe.to) || []).filter((e) => e.type === 'usedBy').slice(0, 2);
        const recipeLabels = rs.map((r) => label(idx, r.to));
        if (recipeLabels.length && lines.length < limit) {
          lines.push(`可用「${seed.props.name}」做：${recipeLabels.join('、')}`);
        }
        paths.push({
          nodes: [seedId, fe.to].concat(rs.map((r) => r.to)),
          edges: ['instantiates', 'usedBy'],
          facts: facts.concat(recipeLabels.length ? [`相关菜谱：${recipeLabels.join('、')}`] : []),
          src: info.src ? `知识库 · ${info.src}` : '',
          score: seed.props.expDays <= 3 ? 2 : 1
        });
      });
    } else if (seed.type === FOOD) {
      const stock = stockIndex(idx);
      const items = stock.get(seedId) || [];
      const info = conceptSrc(idx, seedId);
      const facts = [`知识库参考冷藏天数：${info.days || '—'} 天`];
      items.forEach((itemId) => {
        const p = idx.byId.get(itemId).props;
        facts.push(`${p.name} 现有 ${p.qty}${p.unit}，${p.expDays} 天到期（${libOf(idx, itemId)}·${p.pos}）`);
        if (lines.length < limit) lines.push(itemLine(idx, itemId));
      });
      if (info.tip) facts.push(`存放建议：${info.tip}`);
      const rs = (idx.out.get(seedId) || []).filter((e) => e.type === 'usedBy').slice(0, 3);
      paths.push({
        nodes: [seedId].concat(items).concat(rs.map((r) => r.to)),
        edges: ['contains', 'usedBy'],
        facts,
        src: info.src ? `知识库 · ${info.src}` : '',
        score: 1.5
      });
    } else if (seed.type === PLAN) {
      const facts = [`方案「${seed.label}」状态 ${seed.props.status}`];
      (idx.out.get(seedId) || []).forEach((e) => {
        if (e.type === 'consumes') facts.push(`消耗 ${label(idx, e.to)} ${e.props.qty || ''}${e.props.wasExpiring ? '（当时临期）' : ''}`);
        if (e.type === 'needs') facts.push(`缺料 ${label(idx, e.to)} ${e.props.qty || ''}`);
      });
      lines.push(facts.join('；'));
      paths.push({ nodes: [seedId], edges: [], facts, src: '', score: 1 });
    } else {
      paths.push({ nodes: [seedId], edges: [], facts: [seed.label], src: '', score: 0.5 });
      if (lines.length < limit) lines.push(seed.label);
    }
  });
  return { lines: uniqueLines(lines).slice(0, limit), paths, stale };
}

module.exports = { buildIndex, matchEntity, neighbors, subgraph, aggregate, buildEvidence, stockIndex, expiringItems };
