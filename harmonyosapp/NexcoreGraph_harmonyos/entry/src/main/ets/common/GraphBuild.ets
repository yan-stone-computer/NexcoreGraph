/* 启核图策 · 端侧构图（补充方案第 3.5 节构图流水线，0 次模型调用）
   数据源：store（库/物品/方案/采购/预警/日志/成员）+ KnowledgeIndex（概念层食材）+ Knowledge.RECIPES（菜谱）。
   产出：GraphDoc（节点/边/社区）→ GraphStore 持久化，供 GraphQuery 检索。
   口径与后端 graphBuild.js 对齐，保证 CT-2 跨端同构。 */

import { store, LogRow } from './Store';
import { Library, Item, Plan, Consume, AlertItem, ShoppingItem, Activity } from './Db';
import { GraphDoc, GraphNode, GraphEdge, GraphCommunity, GraphBuildStat, hash12, numOf } from './GraphModel';
import { allFoods, foodByKey, normName, FoodRow } from './KnowledgeIndex';
import { RECIPES, RecipeTpl } from './Knowledge';
import { setGraphDoc, markGraphDirty } from './GraphStore';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN: number = 0x0000;
const TAG: string = 'NexcoreGraph';
/** 构图算法版本：算法改动时 +1，使旧缓存图失效并自动重建 */
const GRAPH_BUILD_REV: string = '2';

/** 口语/别名 → 概念名（归一后比较），与后端 NAME_ALIASES 同口径 */
const NAME_ALIASES: Record<string, string> = {
  '西红柿': '番茄', '青菜': '叶菜', '小白菜': '叶菜', '上海青': '叶菜', '菠菜': '叶菜', '油麦菜': '叶菜',
  '五花肉': '生猪肉', '猪肉': '生猪肉', '米饭': '大米', '面包片': '面包'
};

class Builder {
  doc: GraphDoc = new GraphDoc();
  unlinked: number = 0;
  catStats: Record<string, number[]> = {};
  sceneStats: Record<string, number[]> = {};
  private seen: Set<string> = new Set<string>();
  private edgeSeen: Set<string> = new Set<string>();

  node(id: string, type: string, label: string, props: Record<string, Object>, community: string[]): void {
    if (this.seen.has(id)) {
      return;
    }
    this.seen.add(id);
    const n = new GraphNode();
    n.id = id;
    n.type = type;
    n.label = label;
    n.props = props;
    n.community = community;
    this.doc.nodes.push(n);
  }

  /** 同 id 节点重复写入时覆盖 props（用于给 Library 补统计字段） */
  patch(id: string, props: Record<string, Object>): void {
    for (let i = 0; i < this.doc.nodes.length; i++) {
      if (this.doc.nodes[i].id === id) {
        const merged: Record<string, Object> = {};
        Object.keys(this.doc.nodes[i].props).forEach((k: string) => {
          merged[k] = this.doc.nodes[i].props[k];
        });
        Object.keys(props).forEach((k: string) => {
          merged[k] = props[k];
        });
        this.doc.nodes[i].props = merged;
        return;
      }
    }
  }

  edge(from: string, to: string, type: string, props: Record<string, Object>): void {
    const key = `${from}->${to}:${type}`;
    if (this.edgeSeen.has(key)) {
      return;
    }
    this.edgeSeen.add(key);
    const e = new GraphEdge();
    e.id = 'e' + (this.doc.edges.length + 1);
    e.from = from;
    e.to = to;
    e.type = type;
    e.props = props;
    this.doc.edges.push(e);
  }

  community(id: string, level: number, label: string, stats: Record<string, Object>): void {
    const c = new GraphCommunity();
    c.id = id;
    c.level = level;
    c.label = label;
    c.stats = stats;
    this.doc.communities.push(c);
  }

  addCat(name: string, expiring: boolean, value: number): void {
    const cur: number[] = this.catStats[name] === undefined ? [0, 0, 0] : this.catStats[name];
    cur[0] += 1;
    if (expiring) {
      cur[1] += 1;
    }
    cur[2] += value;
    this.catStats[name] = cur;
  }

  addScene(name: string, items: number, expiring: number, value: number): void {
    const cur: number[] = this.sceneStats[name] === undefined ? [0, 0, 0] : this.sceneStats[name];
    cur[0] += items;
    cur[1] += expiring;
    cur[2] += value;
    this.sceneStats[name] = cur;
  }
}

/** 库 → 场景（三级社区），与后端 sceneOf 同口径 */
function sceneOf(lib: Library): string {
  const s = `${lib.name}${lib.id}`;
  // 先判"宠物/衣物"等强特征，避免"宠物食品"被"食品"关键字误判为食材场景
  if (hasAny(s, ['宠物', '猫', '狗'])) return '宠物';
  if (hasAny(s, ['母婴', '婴儿', '宝宝', '儿童', '童装'])) return '母婴';
  if (hasAny(s, ['厨具', '餐具', '锅具', '厨房用具'])) return '厨具餐具';
  if (hasAny(s, ['冰箱', '厨房', '食品', '储物', '零食', '食材'])) return '食材';
  if (hasAny(s, ['药', '保健'])) return '药品';
  if (hasAny(s, ['家电', '工具', '电器', '五金', '电料'])) return '家电工具';
  if (hasAny(s, ['衣柜', '衣', '鞋', '包', '帽'])) return '衣物';
  if (hasAny(s, ['化妆', '护肤', '个护', '洗护', '美妆'])) return '个护化妆';
  if (hasAny(s, ['健身', '运动', '球'])) return '健身';
  if (hasAny(s, ['书', '文具', '绘本'])) return '书籍文具';
  if (hasAny(s, ['玩具', '积木', '模型', '手办'])) return '玩具模型';
  if (hasAny(s, ['数码', '电子', '充电', '线材'])) return '数码电子';
  if (hasAny(s, ['清洁', '日用', '洗洁', '纸'])) return '清洁日用';
  if (hasAny(s, ['床', '家居', '布艺', '家具', '收纳'])) return '家居布艺';
  return '其他';
}

function hasAny(text: string, keys: string[]): boolean {
  for (let i = 0; i < keys.length; i++) {
    if (text.indexOf(keys[i]) > -1) {
      return true;
    }
  }
  return false;
}

/** 实例 → 概念：kbKey 优先，其次归一名称 / 别名 / 包含匹配 */
function resolveByName(name: string, kbKey: string): FoodRow | null {
  if (kbKey !== '') {
    const byKey = foodByKey(kbKey);
    if (byKey !== null) {
      return byKey;
    }
  }
  const n = normName(name);
  if (n === '') {
    return null;
  }
  const foods = allFoods();
  for (let i = 0; i < foods.length; i++) {
    if (normName(foods[i].name) === n) {
      return foods[i];
    }
  }
  const alias = NAME_ALIASES[n];
  if (alias !== undefined) {
    for (let i = 0; i < foods.length; i++) {
      const fn = normName(foods[i].name);
      if (fn === alias || fn.indexOf(alias) === 0) {
        return foods[i];
      }
    }
  }
  for (let i = 0; i < foods.length; i++) {
    const fn = normName(foods[i].name);
    if (fn.length >= 2 && (n.indexOf(fn) > -1 || fn.indexOf(n) > -1)) {
      return foods[i];
    }
  }
  return null;
}

function byName(items: Item[], text: string): Item | null {
  for (let i = 0; i < items.length; i++) {
    if (items[i].name !== '' && text.indexOf(items[i].name) > -1) {
      return items[i];
    }
  }
  return null;
}

function allItems(): Item[] {
  const out: Item[] = [];
  store.libraries.forEach((l: Library) => {
    l.items.forEach((it: Item) => out.push(it));
  });
  return out;
}

/** 新鲜度指纹（O(物品数)，用于判断是否需要重建，避免逐处埋点漏标） */
export function freshnessSeed(): string {
  let items = 0;
  let qtySum = 0;
  let expSum = 0;
  store.libraries.forEach((l: Library) => {
    l.items.forEach((it: Item) => {
      items += 1;
      qtySum += it.qty;
      expSum += it.expDays;
    });
  });
  return `${store.libraries.length}/${items}/${qtySum}/${expSum}/${store.plans.length}/` +
    `${store.shopping.length}/${store.alerts.length}/${store.logs.length}/${store.chat.length}/r${GRAPH_BUILD_REV}`;
}

/** 全量重建（幂等）；返回统计信息 */
export function rebuildGraph(): GraphBuildStat {
  const t0 = Date.now();
  const b = new Builder();
  const familyId = store.family.id;
  const items = allItems();

  b.node(`family:${familyId}`, 'Family', store.family.name, { 'familyId': familyId }, []);
  store.stats.activity.forEach((a: Activity) => {
    b.node(`member:${a.name}`, 'Member', a.name, { 'name': a.name, 'actions': a.v }, []);
    b.edge(`member:${a.name}`, `family:${familyId}`, 'belongsTo', {});
  });

  let itemCount = 0;
  let expiringCount = 0;
  let totalValue = 0;

  store.libraries.forEach((lib: Library) => {
    const scene = sceneOf(lib);
    const libId = `lib:${lib.id}`;
    b.node(libId, 'Library', lib.name, {
      'id': lib.id, 'name': lib.name, 'icon': lib.icon, 'tone': lib.tone
    }, [libId, `scene:${scene}`]);
    b.edge(libId, `family:${familyId}`, 'belongsTo', {});
    b.node(`scene:${scene}`, 'CategoryConcept', scene, { 'level': 3 }, [`scene:${scene}`]);
    b.edge(libId, `scene:${scene}`, 'inCategory', {});

    let libItems = 0;
    let libExpiring = 0;
    let libValue = 0;

    lib.items.forEach((it: Item) => {
      const itemId = `item:${it.id}`;
      const isExp = it.expDays > 0 && it.expDays <= 7;
      itemCount += 1;
      libItems += 1;
      if (isExp) {
        expiringCount += 1;
        libExpiring += 1;
      }
      totalValue += it.price;
      libValue += it.price;

      b.node(itemId, 'ItemInstance', it.name, {
        'id': it.id, 'no': it.no, 'name': it.name, 'qty': it.qty, 'unit': it.unit,
        'price': it.price, 'priceSrc': it.priceSrc, 'expDays': it.expDays, 'pos': it.pos,
        'isPrivate': it.isPrivate, 'kbKey': it.kbKey
      }, [libId, `scene:${scene}`]);
      b.edge(libId, itemId, 'contains', {});

      const food = resolveByName(it.name, it.kbKey);
      if (food !== null) {
        b.node(`food:${food.key}`, 'FoodConcept', food.name, {
          'key': food.key, 'name': food.name, 'category': food.category, 'unit': food.unit,
          'fridgeDays': food.fridgeDays, 'pantryDays': food.pantryDays, 'openedDays': food.openedDays,
          'lowAt': food.lowAt, 'tip': food.tip, 'src': food.src, 'url': food.url
        }, [`cat:${food.category}`]);
        b.node(`cat:${food.category}`, 'CategoryConcept', food.category, { 'level': 2 }, [`cat:${food.category}`]);
        b.edge(`food:${food.key}`, `cat:${food.category}`, 'inCategory', {});
        b.edge(itemId, `food:${food.key}`, 'instantiates', { 'confidence': 'exact' });
        b.edge(itemId, `cat:${food.category}`, 'inCategory', {});
        b.addCat(food.category, isExp, it.price);
      } else {
        b.unlinked += 1;
        b.node('cat:未归类', 'CategoryConcept', '未归类', { 'level': 2 }, ['cat:未归类']);
        b.edge(itemId, 'cat:未归类', 'inCategory', { 'confidence': 'unlinked' });
        b.addCat('未归类', isExp, it.price);
      }
    });

    b.addScene(scene, libItems, libExpiring, libValue);
    b.patch(libId, {
      'items': libItems, 'expiring': libExpiring, 'value': Math.round(libValue * 10) / 10,
      'health': libItems === 0 ? 100 : Math.round((libItems - libExpiring) * 100 / libItems)
    });
  });

  /* 概念层：菜谱 + 食材→菜谱边 */
  RECIPES.forEach((r: RecipeTpl) => {
    b.node(`recipe:${r.name}`, 'RecipeConcept', r.name, {
      'name': r.name, 'time': r.time, 'kcal': r.kcal
    }, []);
    r.used.forEach((u: Consume) => {
      const f = resolveByName(u.name, '');
      if (f !== null) {
        b.edge(`food:${f.key}`, `recipe:${r.name}`, 'usedBy', { 'qty': u.qty, 'primary': true });
      }
    });
    r.optional.forEach((u: Consume) => {
      const f = resolveByName(u.name, '');
      if (f !== null) {
        b.edge(`food:${f.key}`, `recipe:${r.name}`, 'usedBy', { 'qty': u.qty, 'primary': false });
      }
    });
  });

  /* 方案：cooksTo / consumes / needs */
  store.plans.forEach((p: Plan) => {
    const planId = `plan:${p.id}`;
    b.node(planId, 'Plan', p.title, {
      'id': p.id, 'title': p.title, 'priority': p.priority, 'reason': p.reason, 'time': p.time,
      'source': p.source, 'status': p.status, 'kcal': p.kcal,
      'aiGenerated': p.source.indexOf('AI') > -1
    }, []);
    b.edge(planId, `family:${familyId}`, 'belongsTo', {});
    RECIPES.forEach((r: RecipeTpl) => {
      if (r.name === p.title) {
        b.edge(planId, `recipe:${r.name}`, 'cooksTo', {});
      }
    });
    p.used.forEach((u: Consume) => {
      const inst = byName(items, u.name);
      if (inst !== null) {
        b.edge(planId, `item:${inst.id}`, 'consumes', {
          'qty': u.qty, 'wasExpiring': inst.expDays > 0 && inst.expDays <= 7
        });
      }
      const f = resolveByName(u.name, '');
      if (f !== null) {
        b.edge(planId, `food:${f.key}`, 'consumes', { 'qty': u.qty, 'conceptual': true });
      }
    });
    p.missing.forEach((m: Consume) => {
      const f = resolveByName(m.name, '');
      if (f !== null) {
        b.edge(planId, `food:${f.key}`, 'needs', { 'qty': m.qty });
      } else {
        b.node(`food-missing:${m.name}`, 'FoodConcept', m.name, { 'name': m.name, 'missing': true }, []);
        b.edge(planId, `food-missing:${m.name}`, 'needs', { 'qty': m.qty });
      }
    });
  });

  /* 采购清单 */
  store.shopping.forEach((s: ShoppingItem) => {
    const sid = `shop:${s.name}`;
    b.node(sid, 'ShoppingItem', s.name, {
      'name': s.name, 'qty': s.qty, 'src': s.src, 'checked': s.checked
    }, []);
    const f = resolveByName(s.name, '');
    if (f !== null) {
      b.edge(`food:${f.key}`, sid, 'needs', { 'qty': s.qty });
    }
  });

  /* 预警 */
  store.alerts.forEach((a: AlertItem) => {
    const aid = `alert:${a.id}`;
    b.node(aid, 'Alert', a.text, {
      'id': a.id, 'type': a.type, 'tone': a.tone, 'text': a.text, 'meta': a.meta
    }, []);
    const hit = byName(items, a.text);
    if (hit !== null) {
      b.edge(`item:${hit.id}`, aid, 'triggers', { 'rule': a.type });
    }
  });

  /* 日志事件（最近 20 条，避免图膨胀） */
  const logs = store.logs.slice(0, 20);
  logs.forEach((l: LogRow, i: number) => {
    const lid = `log:${i}`;
    const shortDetail = l.detail.length > 20 ? l.detail.substring(0, 20) : l.detail;
    b.node(lid, 'LogEvent', `${l.action} · ${shortDetail}`, {
      'action': l.action, 'detail': l.detail, 'at': l.at, 'day': l.day
    }, []);
    b.edge(lid, `family:${familyId}`, 'belongsTo', {});
    const hit = byName(items, l.detail);
    if (hit !== null) {
      b.edge(lid, `item:${hit.id}`, 'consumedBy', {});
    }
  });

  /* 社区：一级=库、二级=类别、三级=场景 */
  b.doc.nodes.forEach((n: GraphNode) => {
    if (n.type === 'Library') {
      b.community(n.id, 1, n.label, {
        'items': numOf(n.props, 'items', 0), 'expiring': numOf(n.props, 'expiring', 0),
        'value': numOf(n.props, 'value', 0), 'health': numOf(n.props, 'health', 100)
      });
    }
  });
  Object.keys(b.catStats).forEach((c: string) => {
    const s = b.catStats[c];
    b.community(`cat:${c}`, 2, c, {
      'items': s[0], 'expiring': s[1], 'value': Math.round(s[2] * 10) / 10
    });
  });
  Object.keys(b.sceneStats).forEach((s: string) => {
    const v = b.sceneStats[s];
    b.community(`scene:${s}`, 3, s, {
      'items': v[0], 'expiring': v[1], 'value': Math.round(v[2] * 10) / 10
    });
  });

  const versionSeed = `${itemCount}|${expiringCount}|${Math.round(totalValue * 10)}|${store.plans.length}|` +
    `${store.logs.length}|${store.shopping.length}|${store.alerts.length}|${allFoods().length}`;
  b.doc.version = 'gv-' + hash12(versionSeed);
  b.doc.builtAt = Date.now();
  b.doc.kbVersion = '1.0';
  b.doc.freshness = freshnessSeed();
  setGraphDoc(b.doc);

  const stat = new GraphBuildStat();
  stat.nodes = b.doc.nodes.length;
  stat.edges = b.doc.edges.length;
  stat.communities = b.doc.communities.length;
  stat.unlinked = b.unlinked;
  stat.ms = Date.now() - t0;
  // 运行时可观测：图谱规模/耗时（便于真机验收取证，不影响 UI）
  hilog.info(DOMAIN, TAG,
    'graph built: version=%{public}s nodes=%{public}d edges=%{public}d communities=%{public}d unlinked=%{public}d ms=%{public}d',
    b.doc.version, stat.nodes, stat.edges, stat.communities, stat.unlinked, stat.ms);
  return stat;
}

/** 写操作后调用：标记图谱为脏，下次问答/看图时按需重建（避免每次写都全量构图） */
export function applyGraphEvent(_action: string, _detail: string): void {
  markGraphDirty();
}

/** 按需保鲜：脏则重建（供 GraphQuery / 图谱页调用） */
export function ensureGraphFresh(): GraphBuildStat | null {
  const stat = rebuildGraph();
  return stat;
}
