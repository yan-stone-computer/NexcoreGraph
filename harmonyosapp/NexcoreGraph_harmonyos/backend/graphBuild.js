/* 启核图策 · 知识图谱构建（补充方案第 3 章 构图流水线）
   全部为确定性抽取，**0 次模型调用**：
     ① 抽取：payload(libraries/plans/shopping/alerts/logs/activity) → 实例节点 + 边
     ② 归并：实例 → 概念（kbKey 优先，其次名称归一/别名/包含匹配）
     ③ 社区：一级=库、二级=类别、三级=场景（确定性算法）
     ④ 打分：临期/热度/金额（仅用于排序）
     ⑤ 版本：graphVersion = sha1(payload + kbVersion)
   概念层数据来自工程 knowledge/*.json（与端侧 rawfile 同源）。 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KB_DIR = path.join(__dirname, '..', 'knowledge');

/* 名称归一：去括号补充说明、去常见前缀（鲜/生/土），用于实例↔概念匹配 */
function normName(name) {
  let s = String(name || '').trim();
  s = s.replace(/[（(].*$/, '').trim();
  if (s.length >= 3 && /^[鲜生土]/.test(s)) {
    s = s.substring(1);
  }
  return s;
}

/* 口语/别名 → 知识库概念名（归一后比较） */
const NAME_ALIASES = {
  '西红柿': '番茄',
  '青菜': '叶菜',
  '小白菜': '叶菜',
  '上海青': '叶菜',
  '菠菜': '叶菜',
  '油麦菜': '叶菜',
  '五花肉': '生猪肉',
  '猪肉': '生猪肉',
  '米饭': '大米',
  '挂面': '面条（挂面）',
  '面包片': '面包'
};

let KB = null;

/** 载入概念层知识库（启动时一次；失败返回空集，构图降级为仅实例层） */
function loadKnowledge() {
  if (KB !== null) {
    return KB;
  }
  const out = { version: '0', foods: [], foodByKey: {}, foodByNorm: {}, foodByAlias: {}, recipes: [], rules: [] };
  try {
    const foodsFile = JSON.parse(fs.readFileSync(path.join(KB_DIR, 'foods.json'), 'utf8'));
    const recipesFile = JSON.parse(fs.readFileSync(path.join(KB_DIR, 'recipes.json'), 'utf8'));
    const rulesFile = JSON.parse(fs.readFileSync(path.join(KB_DIR, 'storage-rules.json'), 'utf8'));
    out.version = String(foodsFile.version || '1.0');
    (foodsFile.items || []).forEach((f) => {
      const item = {
        key: f.key, name: f.name, category: f.category || '其他', unit: f.unit || '个',
        fridgeDays: f.shelf ? f.shelf.fridge : null,
        pantryDays: f.shelf ? f.shelf.pantry : null,
        openedDays: f.openedDays === undefined ? null : f.openedDays,
        lowAt: f.lowAt === undefined ? 0 : f.lowAt,
        tip: f.tip || '', src: f.src || '', url: f.url || ''
      };
      out.foods.push(item);
      out.foodByKey[item.key] = item;
      const n = normName(item.name);
      if (n !== '') {
        out.foodByNorm[n] = item.key;
      }
    });
    Object.keys(NAME_ALIASES).forEach((alias) => {
      const target = NAME_ALIASES[alias];
      for (let i = 0; i < out.foods.length; i++) {
        const n = normName(out.foods[i].name);
        if (n === target || out.foods[i].name.indexOf(target) === 0) {
          out.foodByAlias[alias] = out.foods[i].key;
          break;
        }
      }
    });
    (recipesFile.recipes || []).forEach((r) => {
      out.recipes.push({
        name: r.name, time: r.time || '', kcal: r.kcal || 0, tags: r.tags || [],
        used: r.used || [], optional: r.optional || [], note: r.note || ''
      });
    });
    (rulesFile.rules || []).forEach((r) => {
      out.rules.push({ id: r.id, text: r.text || '', src: r.src || '', url: r.url || '' });
    });
  } catch (e) {
    console.warn('[graph-build] 知识库载入失败，降级为仅实例层:', e.message);
  }
  KB = out;
  return out;
}

/** 实例 → 概念：kbKey 优先，其次归一名称 / 别名 / 包含匹配 */
function resolveConcept(item, kb) {
  if (item && item.kbKey && kb.foodByKey[item.kbKey]) {
    return { key: item.kbKey, confidence: 'exact' };
  }
  const n = normName(item ? item.name : '');
  if (n !== '' && kb.foodByNorm[n]) {
    return { key: kb.foodByNorm[n], confidence: 'exact' };
  }
  if (n !== '' && kb.foodByAlias[n]) {
    return { key: kb.foodByAlias[n], confidence: 'alias' };
  }
  for (let i = 0; i < kb.foods.length; i++) {
    const fn = normName(kb.foods[i].name);
    if (fn.length >= 2 && n.length >= 2 && (n.indexOf(fn) > -1 || fn.indexOf(n) > -1)) {
      return { key: kb.foods[i].key, confidence: 'alias' };
    }
  }
  return { key: '', confidence: 'unlinked' };
}

/** 库 → 场景（三级社区） */
function sceneOf(lib) {
  const s = `${lib.name || ''}${lib.id || ''}`;
  // 先判强特征，避免"宠物食品"被"食品"关键字误判为食材场景（与端侧同口径）
  if (/宠物|猫|狗/.test(s)) return '宠物';
  if (/母婴|婴儿|宝宝|儿童|童装/.test(s)) return '母婴';
  if (/厨具|餐具|锅具|厨房用具/.test(s)) return '厨具餐具';
  if (/冰箱|厨房|食品|储物|零食|食材/.test(s)) return '食材';
  if (/药|保健/.test(s)) return '药品';
  if (/家电|工具|电器|五金|电料/.test(s)) return '家电工具';
  if (/衣柜|衣|鞋|包|帽/.test(s)) return '衣物';
  if (/化妆|护肤|个护|洗护|美妆/.test(s)) return '个护化妆';
  if (/健身|运动|球/.test(s)) return '健身';
  if (/书|文具|绘本/.test(s)) return '书籍文具';
  if (/玩具|积木|模型|手办/.test(s)) return '玩具模型';
  if (/数码|电子|充电|线材/.test(s)) return '数码电子';
  if (/清洁|日用|洗洁|纸/.test(s)) return '清洁日用';
  if (/床|家居|布艺|家具|收纳/.test(s)) return '家居布艺';
  return '其他';
}

function days5(n) {
  return Number.isFinite(n) ? n : null;
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

/**
 * 构建图谱
 * @param {string} familyId
 * @param {object} payload 同步 payload（libraries/alerts/plans/shopping/daily/logs）
 * @returns {{version:string,nodes:Array,edges:Array,communities:Array,stats:object}}
 */
function buildGraph(familyId, payload) {
  const kb = loadKnowledge();
  const p = payload || {};
  const libraries = Array.isArray(p.libraries) ? p.libraries : [];
  const plans = Array.isArray(p.plans) ? p.plans : [];
  const alerts = Array.isArray(p.alerts) ? p.alerts : [];
  const shopping = Array.isArray(p.shopping) ? p.shopping : [];
  const logs = Array.isArray(p.logs) ? p.logs : [];
  const activity = Array.isArray(p.activity) ? p.activity : [];

  const nodes = [];
  const edges = [];
  const seen = new Set();
  const edgeSeen = new Set();

  const addNode = (id, type, label, props, community) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ id, type, label, props: props || {}, community: community || [] });
  };
  const addEdge = (from, to, type, props) => {
    const k = `${from}->${to}:${type}`;
    if (edgeSeen.has(k)) return;
    edgeSeen.add(k);
    edges.push({ id: `e${edges.length + 1}`, from, to, type, props: props || {} });
  };

  /* 家庭与成员 */
  addNode(`family:${familyId}`, 'Family', familyId, { familyId }, []);
  activity.forEach((a) => {
    addNode(`member:${a.name}`, 'Member', a.name, { name: a.name, actions: a.v || 0 }, []);
    addEdge(`member:${a.name}`, `family:${familyId}`, 'belongsTo', {});
  });

  /* 库 / 物品 / 概念 */
  const catStats = {};
  const sceneStats = {};
  let itemCount = 0;
  let expiringCount = 0;
  let totalValue = 0;
  let unlinkedCount = 0;

  libraries.forEach((lib) => {
    const scene = sceneOf(lib);
    const libCommunity = `lib:${lib.id}`;
    addNode(libCommunity, 'Library', lib.name || lib.id, {
      id: lib.id, name: lib.name, icon: lib.icon, tone: lib.tone, count: lib.count || 0
    }, [libCommunity, `scene:${scene}`]);
    addEdge(libCommunity, `family:${familyId}`, 'belongsTo', {});
    addNode(`scene:${scene}`, 'CategoryConcept', scene, { level: 3 }, [`scene:${scene}`]);
    addEdge(libCommunity, `scene:${scene}`, 'inCategory', {});

    let libItems = 0;
    let libExpiring = 0;
    let libValue = 0;
    (lib.items || []).forEach((it) => {
      const itemId = `item:${it.id}`;
      const expDays = Number(it.expDays || 0);
      const qty = Number(it.qty || 0);
      const price = Number(it.price || 0);
      itemCount += 1;
      libItems += 1;
      if (expDays > 0 && expDays <= 7) {
        expiringCount += 1;
        libExpiring += 1;
      }
      totalValue += price;
      libValue += price;
      addNode(itemId, 'ItemInstance', it.name || it.id, {
        id: it.id, no: it.no || '', name: it.name, qty: qty, unit: it.unit || '个',
        price: price, priceSrc: it.priceSrc || '', expDays: expDays, pos: it.pos || '',
        isPrivate: !!it.isPrivate, kbKey: it.kbKey || '', image: false
      }, [libCommunity, `scene:${scene}`]);
      addEdge(libCommunity, itemId, 'contains', {});

      const hit = resolveConcept(it, kb);
      if (hit.key !== '') {
        const food = kb.foodByKey[hit.key];
        addNode(`food:${hit.key}`, 'FoodConcept', food.name, {
          key: food.key, name: food.name, category: food.category, unit: food.unit,
          fridgeDays: days5(food.fridgeDays), pantryDays: days5(food.pantryDays),
          openedDays: days5(food.openedDays), lowAt: food.lowAt,
          tip: food.tip, src: food.src, url: food.url
        }, [`cat:${food.category}`]);
        addNode(`cat:${food.category}`, 'CategoryConcept', food.category, { level: 2 }, [`cat:${food.category}`]);
        addEdge(`food:${hit.key}`, `cat:${food.category}`, 'inCategory', {});
        addEdge(itemId, `food:${hit.key}`, 'instantiates', { confidence: hit.confidence });
        addEdge(itemId, `cat:${food.category}`, 'inCategory', { confidence: hit.confidence });

        const cs = catStats[food.category] || { items: 0, expiring: 0, value: 0 };
        cs.items += 1;
        if (expDays > 0 && expDays <= 7) cs.expiring += 1;
        cs.value += price;
        catStats[food.category] = cs;
      } else {
        // 未归类：挂到"未归类"概念，保证每个实例都有归属（便于 UI 提示补录）
        unlinkedCount += 1;
        addNode('cat:未归类', 'CategoryConcept', '未归类', { level: 2 }, ['cat:未归类']);
        addEdge(itemId, 'cat:未归类', 'inCategory', { confidence: 'unlinked' });
        const cs = catStats['未归类'] || { items: 0, expiring: 0, value: 0 };
        cs.items += 1;
        if (expDays > 0 && expDays <= 7) cs.expiring += 1;
        cs.value += price;
        catStats['未归类'] = cs;
      }
    });

    const ss = sceneStats[scene] || { items: 0, expiring: 0, value: 0 };
    ss.items += libItems;
    ss.expiring += libExpiring;
    ss.value += libValue;
    sceneStats[scene] = ss;

    // 一级社区统计（health 为"非临期占比"）
    const libNode = nodes.find((n) => n.id === libCommunity);
    if (libNode) {
      libNode.props = Object.assign({}, libNode.props, {
        items: libItems, expiring: libExpiring, value: round1(libValue),
        health: libItems === 0 ? 100 : Math.round((libItems - libExpiring) * 100 / libItems)
      });
    }
  });

  /* 概念层：菜谱 + 食材→菜谱边 + 存放规则 */
  kb.recipes.forEach((r) => {
    addNode(`recipe:${r.name}`, 'RecipeConcept', r.name, {
      name: r.name, time: r.time, kcal: r.kcal, tags: r.tags, note: r.note
    }, []);
    r.used.forEach((u) => {
      const key = resolveConcept({ name: u.name, kbKey: '' }, kb).key;
      if (key !== '') {
        addEdge(`food:${key}`, `recipe:${r.name}`, 'usedBy', { qty: u.qty || '', primary: true });
      }
    });
    r.optional.forEach((u) => {
      const key = resolveConcept({ name: u.name, kbKey: '' }, kb).key;
      if (key !== '') {
        addEdge(`food:${key}`, `recipe:${r.name}`, 'usedBy', { qty: u.qty || '', primary: false });
      }
    });
  });

  // 存放规则 → 概念（按关键词命中，每条规则最多连 5 个概念）
  kb.rules.forEach((rule) => {
    addNode(`rule:${rule.id}`, 'RuleConcept', rule.id, { id: rule.id, text: rule.text, src: rule.src, url: rule.url }, []);
    let linked = 0;
    for (let i = 0; i < kb.foods.length && linked < 5; i++) {
      const f = kb.foods[i];
      const short = normName(f.name).substring(0, 2);
      if (short.length >= 2 && rule.text.indexOf(short) > -1) {
        addEdge(`rule:${rule.id}`, `food:${f.key}`, 'protects', {});
        linked += 1;
      }
    }
  });

  /* 方案：节点 + cooksTo + consumes + needs */
  plans.forEach((pl) => {
    const planId = `plan:${pl.id}`;
    addNode(planId, 'Plan', pl.title || `方案 ${pl.id}`, {
      id: pl.id, title: pl.title, priority: pl.priority, reason: pl.reason,
      time: pl.time, source: pl.source, status: pl.status, kcal: pl.kcal || 0,
      aiGenerated: String(pl.source || '').indexOf('AI') > -1
    }, []);
    addEdge(planId, `family:${familyId}`, 'belongsTo', {});
    const recipe = kb.recipes.find((r) => r.name === pl.title);
    if (recipe) {
      addEdge(planId, `recipe:${recipe.name}`, 'cooksTo', {});
    }
    (pl.used || []).forEach((u) => {
      const inst = findItemByName(libraries, u.name);
      if (inst) {
        addEdge(planId, `item:${inst.id}`, 'consumes', { qty: u.qty || '', wasExpiring: inst.expDays > 0 && inst.expDays <= 7 });
      }
      const key = resolveConcept({ name: u.name, kbKey: '' }, kb).key;
      if (key !== '') {
        addEdge(planId, `food:${key}`, 'consumes', { qty: u.qty || '', conceptual: true });
      }
    });
    (pl.missing || []).forEach((m) => {
      const key = resolveConcept({ name: m.name, kbKey: '' }, kb).key;
      if (key !== '') {
        addEdge(planId, `food:${key}`, 'needs', { qty: m.qty || '' });
      } else {
        addNode(`food-missing:${m.name}`, 'FoodConcept', m.name, { name: m.name, missing: true }, []);
        addEdge(planId, `food-missing:${m.name}`, 'needs', { qty: m.qty || '' });
      }
    });
  });

  /* 采购清单 */
  shopping.forEach((s) => {
    const sid = `shop:${s.name}`;
    addNode(sid, 'ShoppingItem', s.name, { name: s.name, qty: s.qty, src: s.src, checked: !!s.checked }, []);
    const key = resolveConcept({ name: s.name, kbKey: '' }, kb).key;
    if (key !== '') {
      addEdge(`food:${key}`, sid, 'needs', { qty: s.qty || '' });
    }
  });

  /* 预警 */
  alerts.forEach((a) => {
    const aid = `alert:${a.id}`;
    addNode(aid, 'Alert', a.text || `预警 ${a.id}`, {
      id: a.id, type: a.type, tone: a.tone, text: a.text, meta: a.meta
    }, []);
    const hitItem = findItemByName(libraries, a.text);
    if (hitItem) {
      addEdge(`item:${hitItem.id}`, aid, 'triggers', { rule: a.type });
    }
  });

  /* 日志事件（保留最近 40 条，避免图膨胀） */
  logs.slice(0, 40).forEach((l, i) => {
    const lid = `log:${i}`;
    addNode(lid, 'LogEvent', `${l.action} · ${String(l.detail || '').substring(0, 20)}`, {
      action: l.action, detail: l.detail, at: l.at, day: l.day
    }, []);
    addEdge(lid, `family:${familyId}`, 'belongsTo', {});
    const hitItem = findItemByName(libraries, l.detail);
    if (hitItem) {
      addEdge(lid, `item:${hitItem.id}`, 'consumedBy', {});
    }
  });

  /* 社区聚合（含二级/三级统计） */
  const communities = [];
  nodes.forEach((n) => {
    if (n.type === 'Library') {
      communities.push({
        id: n.id, level: 1, label: n.label,
        stats: {
          items: n.props.items || 0, expiring: n.props.expiring || 0,
          value: n.props.value || 0, health: n.props.health || 100
        }
      });
    }
  });
  Object.keys(catStats).forEach((c) => {
    communities.push({
      id: `cat:${c}`, level: 2, label: c,
      stats: { items: catStats[c].items, expiring: catStats[c].expiring, value: round1(catStats[c].value) }
    });
  });
  Object.keys(sceneStats).forEach((s) => {
    communities.push({
      id: `scene:${s}`, level: 3, label: s,
      stats: { items: sceneStats[s].items, expiring: sceneStats[s].expiring, value: round1(sceneStats[s].value) }
    });
  });

  const version = 'gv-' + crypto.createHash('sha1')
    .update(JSON.stringify(p) + '|' + kb.version).digest('hex').substring(0, 12);

  return {
    version,
    nodes,
    edges,
    communities,
    stats: {
      nodes: nodes.length, edges: edges.length, communities: communities.length,
      items: itemCount, expiring: expiringCount, value: round1(totalValue),
      unlinked: unlinkedCount,
      kbVersion: kb.version
    }
  };
}

/** 按名称在库存中找物品（用于把预警/日志/方案挂到实例节点） */
function findItemByName(libraries, text) {
  const t = String(text || '');
  if (t === '') return null;
  for (let i = 0; i < libraries.length; i++) {
    const items = libraries[i].items || [];
    for (let j = 0; j < items.length; j++) {
      if (t.indexOf(items[j].name) > -1) {
        return Object.assign({ libId: libraries[i].id }, items[j]);
      }
    }
  }
  return null;
}

module.exports = { buildGraph, loadKnowledge, normName, resolveConcept, sceneOf };
