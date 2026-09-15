/* 启核图策 · 端侧图检索与 GraphRAG 证据装配（补充方案第 4 章，0 次模型调用）
   算子：matchEntity / neighbors / expiringItems / multiHop / global(社区统计)
   证据：路径（节点链 + 边类型）+ 事实（节点属性）+ 来源（概念层 src/url）。
   说明：端侧图谱规模小（≤500 节点），采用线性扫描 + 邻接缓存，避免维护复杂索引。 */

import { GraphDoc, GraphNode, GraphEdge, GraphCommunity, RagPath, RagEvidence, strOf, numOf } from './GraphModel';
import { graphDoc, isGraphDirty } from './GraphStore';
import { rebuildGraph, freshnessSeed } from './GraphBuild';
import { normName } from './KnowledgeIndex';
import { RECIPES, RecipeTpl } from './Knowledge';
import { Consume } from './Db';

const ITEM: string = 'ItemInstance';
const FOOD: string = 'FoodConcept';

/** 图不存在 / 被标记脏 / 新鲜度指纹变化 → 重建（保证问答与看图永不使用陈旧图） */
function ensureGraph(): GraphDoc {
  let d = graphDoc();
  if (d === null || isGraphDirty() || d.freshness !== freshnessSeed()) {
    rebuildGraph();
    d = graphDoc();
  }
  const doc = d as GraphDoc;
  return doc;
}

export function currentGraphVersion(): string {
  const d = ensureGraph();
  return d.version;
}

export function currentGraphSize(): string {
  const d = ensureGraph();
  return `${d.nodes.length} 节点 · ${d.edges.length} 边 · ${d.communities.length} 社区`;
}

export function nodeById(d: GraphDoc, id: string): GraphNode | null {
  for (let i = 0; i < d.nodes.length; i++) {
    if (d.nodes[i].id === id) {
      return d.nodes[i];
    }
  }
  return null;
}

export function labelOf(d: GraphDoc, id: string): string {
  const n = nodeById(d, id);
  return n === null ? id : n.label;
}

export function outEdges(d: GraphDoc, id: string, type: string): GraphEdge[] {
  const out: GraphEdge[] = [];
  d.edges.forEach((e: GraphEdge) => {
    if (e.from === id && (type === '' || e.type === type)) {
      out.push(e);
    }
  });
  return out;
}

export function inEdges(d: GraphDoc, id: string, type: string): GraphEdge[] {
  const out: GraphEdge[] = [];
  d.edges.forEach((e: GraphEdge) => {
    if (e.to === id && (type === '' || e.type === type)) {
      out.push(e);
    }
  });
  return out;
}

/** 实体识别：标签精确/归一/包含匹配，实例优先于概念 */
export function matchEntity(d: GraphDoc, q: string): string[] {
  const text = String(q === undefined ? '' : q).trim();
  if (text === '') {
    return [];
  }
  const hits: string[] = [];
  const cands: GraphNode[] = [];
  d.nodes.forEach((n: GraphNode) => {
    const nm = n.label;
    const nn = normName(nm);
    const hitExact = text.indexOf(nm) > -1 || normName(text) === nn;
    const hitNorm = nn.length >= 2 && text.indexOf(nn) > -1;
    if ((nm.length >= 2 && hitExact) || hitNorm) {
      cands.push(n);
    }
  });
  cands.sort((a: GraphNode, b: GraphNode): number => b.label.length - a.label.length);
  const rank = (n: GraphNode): number => n.type === ITEM ? 0 : (n.type === FOOD ? 1 : 2);
  cands.sort((a: GraphNode, b: GraphNode): number => rank(a) - rank(b));
  cands.forEach((n: GraphNode) => {
    if (hits.indexOf(n.id) < 0) {
      hits.push(n.id);
    }
  });
  return hits;
}

/** 临期物品（按剩余天数升序） */
export function expiringItemIds(d: GraphDoc, limit: number): string[] {
  const ids: string[] = [];
  d.nodes.forEach((n: GraphNode) => {
    if (n.type !== ITEM) {
      return;
    }
    const days = numOf(n.props, 'expDays', 0);
    if (days > 0 && days <= 7) {
      ids.push(n.id);
    }
  });
  ids.sort((a: string, b: string): number => {
    const na = nodeById(d, a);
    const nb = nodeById(d, b);
    return (na === null ? 0 : numOf(na.props, 'expDays', 0)) - (nb === null ? 0 : numOf(nb.props, 'expDays', 0));
  });
  return ids.slice(0, limit);
}

/** 物品 → 概念（1 跳） */
function foodOfItem(d: GraphDoc, itemId: string): string {
  const es = outEdges(d, itemId, 'instantiates');
  return es.length > 0 ? es[0].to : '';
}

function libOf(d: GraphDoc, itemId: string): string {
  const es = inEdges(d, itemId, 'contains');
  return es.length > 0 ? labelOf(d, es[0].from) : '';
}

function itemLine(d: GraphDoc, itemId: string): string {
  const n = nodeById(d, itemId);
  if (n === null) {
    return '';
  }
  const lib = libOf(d, itemId);
  const pos = strOf(n.props, 'pos', '未设置位置');
  const qty = numOf(n.props, 'qty', 0);
  const unit = strOf(n.props, 'unit', '个');
  const days = numOf(n.props, 'expDays', 0);
  const price = numOf(n.props, 'price', 0);
  const priv = strOf(n.props, 'isPrivate', 'false') === 'true' ? '（私有）' : '';
  return `${lib}·${pos}｜${n.label} ${qty}${unit}｜约${days}天后到期｜¥${price}${priv}`;
}

function conceptPathNotes(d: GraphDoc, foodId: string): string[] {
  const n = nodeById(d, foodId);
  if (n === null) {
    return [];
  }
  const facts: string[] = [];
  const days = numOf(n.props, 'fridgeDays', -1);
  if (days > 0) {
    facts.push(`知识库参考冷藏天数：${days} 天`);
  }
  const opened = numOf(n.props, 'openedDays', -1);
  if (opened > 0) {
    facts.push(`开封后建议 ${opened} 天内用完`);
  }
  const tip = strOf(n.props, 'tip', '');
  if (tip !== '') {
    facts.push(`存放建议：${tip}`);
  }
  return facts;
}

function sourceOf(d: GraphDoc, foodId: string): string {
  const n = nodeById(d, foodId);
  if (n === null) {
    return '';
  }
  const src = strOf(n.props, 'src', '');
  return src === '' ? '' : `知识库 · ${src}`;
}

/** 菜谱可用性：命中的概念食材 / 缺失食材 */
class Feasibility {
  recipeId: string = '';
  haveFoods: string[] = [];
  haveItems: string[] = [];
  missFoods: string[] = [];
}

function feasibility(d: GraphDoc, recipeId: string): Feasibility {
  const f = new Feasibility();
  f.recipeId = recipeId;
  const ingredients = inEdges(d, recipeId, 'usedBy');
  ingredients.forEach((e: GraphEdge) => {
    const holders: string[] = [];
    d.edges.forEach((x: GraphEdge) => {
      if (x.type === 'instantiates' && x.to === e.from) {
        holders.push(x.from);
      }
    });
    if (holders.length > 0) {
      f.haveFoods.push(e.from);
      holders.forEach((h: string) => {
        if (f.haveItems.indexOf(h) < 0) {
          f.haveItems.push(h);
        }
      });
    } else {
      f.missFoods.push(e.from);
    }
  });
  return f;
}

/** 组装 GraphRAG 证据（替代/兼容 Router.evidenceFor 的路径证据） */
export function ragEvidence(mode: string, question: string): RagEvidence {
  const d = ensureGraph();
  const ev = new RagEvidence();
  ev.mode = mode;
  ev.version = d.version;
  ev.stale = false;                 // 端侧不缓存摘要，故不存在 stale（摘要由后端预计算）
  const seenLines: string[] = [];
  const pushLine = (s: string): void => {
    if (s !== '' && seenLines.indexOf(s) < 0) {
      seenLines.push(s);
    }
  };

  if (mode === 'multi-hop') {
    const seeds = expiringItemIds(d, 5);
    const recipes: string[] = [];
    seeds.forEach((itemId: string) => {
      const foodId = foodOfItem(d, itemId);
      if (foodId === '') {
        return;
      }
      outEdges(d, foodId, 'usedBy').forEach((e: GraphEdge) => {
        if (recipes.indexOf(e.to) < 0) {
          recipes.push(e.to);
        }
      });
      pushLine(itemLine(d, itemId));
    });
    // 可行性排序：缺料少者优先，命中临期食材多者优先
    const feas: Feasibility[] = [];
    recipes.forEach((rid: string) => feas.push(feasibility(d, rid)));
    feas.sort((a: Feasibility, b: Feasibility): number => {
      if (a.missFoods.length !== b.missFoods.length) {
        return a.missFoods.length - b.missFoods.length;
      }
      return b.haveFoods.length - a.haveFoods.length;
    });
    feas.slice(0, 3).forEach((f: Feasibility) => {
      const rn = nodeById(d, f.recipeId);
      if (rn === null) {
        return;
      }
      const kcal = numOf(rn.props, 'kcal', 0);
      const time = strOf(rn.props, 'time', '');
      const missNames: string[] = f.missFoods.map((x: string): string => labelOf(d, x));
      pushLine(`${rn.label}（${time}${kcal > 0 ? ` · 约 ${kcal} 千卡/份` : ''}）` +
        (missNames.length === 0 ? ' · 库存齐全' : ` · 缺 ${missNames.join('、')}`));
      const facts: string[] = [];
      f.haveItems.slice(0, 3).forEach((itemId: string) => {
        const n = nodeById(d, itemId);
        if (n !== null) {
          facts.push(`${n.label} ${numOf(n.props, 'qty', 0)}${strOf(n.props, 'unit', '个')}（${numOf(n.props, 'expDays', 0)} 天到期）`);
        }
      });
      if (missNames.length > 0) {
        facts.push(`缺料：${missNames.join('、')}`);
      }
      const p = new RagPath();
      p.nodes = f.haveItems.slice(0, 2).concat([f.recipeId]);
      p.edges = ['instantiates', 'usedBy'];
      p.facts = facts;
      p.src = f.haveFoods.length > 0 ? sourceOf(d, f.haveFoods[0]) : '';
      p.score = f.haveItems.length - f.missFoods.length * 0.5;
      ev.paths.push(p);
    });
  } else if (mode === 'global') {
    const comms: GraphCommunity[] = [];
    d.communities.forEach((c: GraphCommunity) => {
      if (c.level === 1) {
        comms.push(c);
      }
    });
    comms.sort((a: GraphCommunity, b: GraphCommunity): number =>
      numOf(b.stats, 'items', 0) - numOf(a.stats, 'items', 0));
    comms.slice(0, 3).forEach((c: GraphCommunity) => {
      const items = numOf(c.stats, 'items', 0);
      const expiring = numOf(c.stats, 'expiring', 0);
      const value = numOf(c.stats, 'value', 0);
      pushLine(`${c.label}：${items} 件${expiring > 0 ? `，临期 ${expiring} 项` : ''}${value > 0 ? `，价值约 ¥${value}` : ''}`);
      const p = new RagPath();
      p.nodes = [c.id];
      p.edges = [];
      p.facts = [`${c.label} 共 ${items} 件，临期 ${expiring} 项`];
      p.src = '社区统计（代码计算）';
      p.score = 1;
      ev.paths.push(p);
    });
  } else {
    const seeds = matchEntity(d, question).slice(0, 3);
    if (seeds.length === 0) {
      expiringItemIds(d, 5).forEach((itemId: string) => pushLine(itemLine(d, itemId)));
    }
    seeds.forEach((seedId: string) => {
      const seed = nodeById(d, seedId);
      if (seed === null) {
        return;
      }
      if (seed.type === ITEM) {
        pushLine(itemLine(d, seedId));
        const foodId = foodOfItem(d, seedId);
        if (foodId !== '') {
          const recipes = outEdges(d, foodId, 'usedBy').slice(0, 2);
          const names: string[] = recipes.map((e: GraphEdge): string => labelOf(d, e.to));
          if (names.length > 0) {
            pushLine(`可用「${seed.label}」做：${names.join('、')}`);
          }
          const p = new RagPath();
          p.nodes = [seedId, foodId];
          recipes.forEach((e: GraphEdge) => p.nodes.push(e.to));
          p.edges = ['instantiates', 'usedBy'];
          p.facts = [`${seed.label} ${numOf(seed.props, 'qty', 0)}${strOf(seed.props, 'unit', '个')}，${numOf(seed.props, 'expDays', 0)} 天到期`]
            .concat(conceptPathNotes(d, foodId));
          p.src = sourceOf(d, foodId);
          p.score = numOf(seed.props, 'expDays', 99) <= 3 ? 2 : 1;
          ev.paths.push(p);
        }
      } else if (seed.type === FOOD) {
        const holders: string[] = [];
        d.edges.forEach((e: GraphEdge) => {
          if (e.type === 'instantiates' && e.to === seedId) {
            holders.push(e.from);
          }
        });
        const facts: string[] = conceptPathNotes(d, seedId);
        holders.forEach((h: string) => {
          pushLine(itemLine(d, h));
          const n = nodeById(d, h);
          if (n !== null) {
            facts.push(`${n.label} 现有 ${numOf(n.props, 'qty', 0)}${strOf(n.props, 'unit', '个')}，${numOf(n.props, 'expDays', 0)} 天到期`);
          }
        });
        const p = new RagPath();
        p.nodes = [seedId].concat(holders);
        p.edges = ['contains'];
        p.facts = facts;
        p.src = sourceOf(d, seedId);
        p.score = 1.5;
        ev.paths.push(p);
      } else if (seed.type === 'Library' || seed.type === 'CategoryConcept') {
        // 库 / 类别节点：给出社区统计（代码计算）+ 该社区最临期的物品，供图谱点选解释
        const stats: string[] = [];
        d.communities.forEach((c: GraphCommunity) => {
          if (c.id === seedId) {
            const items = numOf(c.stats, 'items', 0);
            const expiring = numOf(c.stats, 'expiring', 0);
            const value = numOf(c.stats, 'value', 0);
            stats.push(`${c.label}：共 ${items} 件${expiring > 0 ? `，临期 ${expiring} 项` : ''}${value > 0 ? `，价值约 ¥${value}` : ''}`);
          }
        });
        const inLib: GraphNode[] = [];
        d.edges.forEach((e: GraphEdge) => {
          if (e.type === 'contains' && e.from === seedId) {
            const it = nodeById(d, e.to);
            if (it !== null && numOf(it.props, 'expDays', 0) > 0 && numOf(it.props, 'expDays', 0) <= 7) {
              inLib.push(it);
            }
          }
        });
        inLib.forEach((it: GraphNode, i: number) => {
          if (i < 2) {
            stats.push(`临期：${it.label} ${numOf(it.props, 'qty', 0)}${strOf(it.props, 'unit', '个')}（${numOf(it.props, 'expDays', 0)} 天）`);
          }
        });
        stats.forEach((s: string) => pushLine(s));
        const p = new RagPath();
        p.nodes = [seedId];
        p.edges = [];
        p.facts = stats;
        p.src = '社区统计（代码计算）';
        p.score = 1;
        ev.paths.push(p);
      } else {
        pushLine(seed.label);
        const p = new RagPath();
        p.nodes = [seedId];
        p.edges = [];
        p.facts = [seed.label];
        p.score = 0.5;
        ev.paths.push(p);
      }
    });
  }

  ev.lines = seenLines.slice(0, 12);
  ev.paths = ev.paths.slice(0, 5);
  return ev;
}

/** 意图 → GraphRAG 检索模式（代码规则，与后端模式判定一致） */
export function modeForIntent(intent: string): string {
  if (intent === 'cook' || intent === 'creative' || intent === 'nutrition') {
    return 'multi-hop';
  }
  if (intent === 'summary') {
    return 'global';
  }
  return 'local';
}

/** 菜谱清单（供图谱页/调试） */
export function recipeNames(): string[] {
  const out: string[] = [];
  RECIPES.forEach((r: RecipeTpl) => out.push(r.name));
  return out;
}

/** 方案卡「消耗清单」里是否含临期物品（供价值指标与图谱一致性） */
export function planConsumesExpiring(d: GraphDoc, planId: number): boolean {
  const es = outEdges(d, `plan:${planId}`, 'consumes');
  for (let i = 0; i < es.length; i++) {
    if (strOf(es[i].props, 'wasExpiring', 'false') === 'true') {
      return true;
    }
  }
  return false;
}

export { Consume };
