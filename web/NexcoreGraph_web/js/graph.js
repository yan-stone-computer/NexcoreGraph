/* 启核图策 · 个人资源知识图谱（Web 端，方案第 3/5 章契约落地）
   - 构图全流程 0 次模型调用：实例层（库/物品/方案/采购/预警/日志）+ 概念层（食材/菜谱/规则/类别）
   - 跨层边 instantiates 连通实例与概念，支撑 GraphRAG local/global/multi-hop 三种检索
   - 图 JSON 契约（schema 1）：{version, builtAt, kbVersion, nodes[], edges[], communities[], summaries[], index}
   - 存 localStorage nexcore_graph_v1（≤200KB 预算）；检索预算：≤3 跳、路径 ≤5、证据行 ≤12 */
(function () {
  "use strict";

  var LS_KEY = "nexcore_graph_v1";
  var SCHEMA = 1;
  var MAX_NODES = 700;   /* 实例 ≤500 + 概念 ≤200（契约硬约束） */
  var MAX_EDGES = 3000;
  var doc = null;        /* 内存缓存（含邻接表） */

  /* ---------- 类别与场景（确定性映射，0 次模型） ---------- */
  var FOOD_CAT = {
    egg: "蛋奶", milk: "蛋奶", yogurt: "蛋奶",
    tofu: "蔬菜", tomato: "蔬菜", greens: "蔬菜", bokchoy: "蔬菜", cucumber: "蔬菜", mushroom: "蔬菜", leftover: "熟食",
    banana: "水果", apple: "水果",
    pork: "肉禽", chicken: "肉禽", fish: "肉禽", shrimp: "肉禽",
    rice: "主食调味", noodle: "主食调味", oat: "主食调味", bread: "主食调味", soyOil: "主食调味", soySauce: "主食调味"
  };
  var LIB_SCENE = {
    fridge: "食材", medicine: "药品", wardrobe: "衣物", tools: "家电工具",
    fitness: "运动器材", books: "图书", pet: "宠物", appliances: "家电工具"
  };
  function sceneOfLib(lib) { return LIB_SCENE[lib.id] || "其他"; }
  function catOfLib(lib) { return { medicine: "药品", wardrobe: "衣物", tools: "工具", fitness: "运动", books: "图书", pet: "宠物", appliances: "家电" }[lib.id] || "杂物"; }

  /* 口语别名 → kbKey（与 ai.js 归一口径一致） */
  var NAME_TO_KB = {};   /* 构建时由 KB.foods + 别名表填充 */
  var ALIASES = { "西红柿": "tomato", "青菜": "greens", "牛奶": "milk", "土豆": "potato", "酱油": "soySauce", "小白菜": "bokchoy", "剩菜": "leftover", "生抽": "soySauce" };

  function buildNameIndex() {
    NAME_TO_KB = {};
    var foods = window.KB.foods;
    Object.keys(foods).forEach(function (k) {
      var base = foods[k].name.replace(/（.*?）/, "").split("（")[0];
      NAME_TO_KB[base] = k;
      if (base.length > 2) NAME_TO_KB[base.slice(0, 2)] = NAME_TO_KB[base.slice(0, 2)] || k;
    });
    Object.keys(ALIASES).forEach(function (a) { NAME_TO_KB[a] = ALIASES[a]; });
  }

  /* 实例名 → 概念（精确名 → 别名 → 未命中挂「未归类」） */
  function resolveFood(item) {
    if (item.kbKey && window.KB.foods[item.kbKey]) return { key: item.kbKey, confidence: "exact" };
    var k = NAME_TO_KB[item.name];
    if (k) return { key: k, confidence: "alias" };
    return null;
  }

  /* ---------- 版本（graphVersion = hash(数据 + kbVersion)） ---------- */
  function hashOf(db) {
    var parts = [];
    db.libraries.forEach(function (l) {
      parts.push(l.id + ":" + (l.items || []).map(function (it) { return it.name + "," + it.qty + "," + (it.expDays == null ? "" : it.expDays) + "," + (it.private ? 1 : 0); }).join("|"));
    });
    parts.push("plans:" + db.plans.map(function (p) { return p.title + "," + p.status; }).join("|"));
    parts.push("shop:" + (db.shopping || []).map(function (s) { return s.name; }).join("|"));
    parts.push("alerts:" + (db.alerts || []).length);
    parts.push("logs:" + (db.logs || []).length + ":" + ((db.logs || [])[0] || {}).ts);
    parts.push("kb:" + window.KB.version);
    var s = parts.join(";;"), h = 5381;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; }
    return "gv-" + h.toString(36);
  }

  /* ---------- 全量构图（幂等，0 次模型） ---------- */
  function build() {
    var t0 = Date.now();
    var db = window.DB;
    buildNameIndex();
    var nodes = [], edges = [], byId = {};
    function addNode(n) { if (nodes.length < MAX_NODES && !byId[n.id]) { byId[n.id] = n; nodes.push(n); } }
    function addEdge(from, to, type, props) {
      if (edges.length >= MAX_EDGES || !byId[from] || !byId[to]) return;
      edges.push({ id: "e" + edges.length, from: from, to: to, type: type, props: props || {} });
    }

    /* ① 组织层 */
    var fid = "family:" + (db.familyId || "home");
    addNode({ id: fid, type: "Family", label: db.family ? db.family.name : "我的家", props: { memberCount: db.family ? db.family.memberCount : 1 }, community: [] });
    db.libraries.forEach(function (l) {
      addNode({ id: "lib:" + l.id, type: "Library", label: l.name, props: { icon: l.icon, tone: l.tone, count: (l.items || []).length }, community: ["lib:" + l.id, "scene:" + sceneOfLib(l)] });
    });

    /* ② 概念层：食材 / 菜谱 / 规则 / 类别 */
    var foods = window.KB.foods;
    Object.keys(foods).forEach(function (k) {
      var f = foods[k];
      addNode({ id: "food:" + k, type: "FoodConcept", label: f.name.replace(/（.*?）/, "").split("（")[0], props: { key: k, category: FOOD_CAT[k] || "其他", fridgeDays: f.days, openedDays: f.open || -1, lowAt: f.lowAt, tip: f.tip, src: f.src, url: f.url || "" }, community: ["cat:" + (FOOD_CAT[k] || "其他"), "scene:食材"] });
    });
    var recipes = window.KB.recipes || [];
    recipes.forEach(function (r) {
      addNode({ id: "recipe:" + r.title, type: "RecipeConcept", label: r.title, props: { time: r.time, kcal: r.kcal, tags: (r.tags || []).join("/") }, community: ["scene:食材"] });
      (r.ing || []).forEach(function (g) {
        if (g[2] && foods[g[2]]) addEdge("food:" + g[2], "recipe:" + r.title, "usedBy", { qty: g[1], primary: g === r.ing[0] });
      });
    });
    (window.KB.rules || []).forEach(function (r) {
      addNode({ id: "rule:" + r.id, type: "RuleConcept", label: "规则·" + r.tag, props: { text: r.text, src: "食品安全通用规则" }, community: ["scene:食材"] });
      /* protects：规则关键词命中食材/类别 */
      var text = r.text;
      Object.keys(foods).forEach(function (k) {
        var base = foods[k].name.replace(/（.*?）/, "").split("（")[0];
        if (base.length >= 2 && text.indexOf(base) > -1) addEdge("rule:" + r.id, "food:" + k, "protects", { keyword: base });
      });
      if (/药|眼药水/.test(text)) addEdge("rule:" + r.id, "cat:药品", "protects", { keyword: "药" });
    });
    /* 类别概念节点 */
    var cats = {};
    nodes.forEach(function (n) { if (n.type === "FoodConcept") cats[n.props.category] = 1; });
    db.libraries.forEach(function (l) { cats[catOfLib(l)] = 1; });
    cats["未归类"] = 1;
    Object.keys(cats).forEach(function (c) {
      addNode({ id: "cat:" + c, type: "CategoryConcept", label: c, props: {}, community: ["scene:食材"] });
    });

    /* ③ 实例层：物品 */
    var libById = {};
    db.libraries.forEach(function (l) { libById[l.id] = l; });
    db.libraries.forEach(function (l) {
      (l.items || []).forEach(function (it) {
        var food = resolveFood(it);
        var cat = food ? (FOOD_CAT[food.key] || "其他") : catOfLib(l);
        var nid = "item:" + it.id;
        addNode({
          id: nid, type: "ItemInstance", label: it.name,
          props: {
            libId: l.id, no: it.no || "", qty: it.qty, unit: it.unit, expDays: it.expDays,
            pos: it.pos || "", price: it.price || 0, priceSrc: it.priceSrc || "", isPrivate: !!it.private,
            med: !!it.med, lowAt: it.lowAt || 0, updatedAt: it.updatedAt || null
          },
          community: ["lib:" + l.id, "cat:" + cat, "scene:" + sceneOfLib(l)]
        });
        addEdge("lib:" + l.id, nid, "contains", {});
        if (it.pos) addEdge(nid, "lib:" + l.id, "locatedAt", { pos: it.pos });
        addEdge(nid, fid, "belongsTo", {});
        if (food) {
          addEdge(nid, "food:" + food.key, "instantiates", { confidence: food.confidence });
          addEdge("food:" + food.key, "cat:" + cat, "inCategory", {});
        } else {
          addEdge(nid, "cat:" + cat, "inCategory", {});
        }
      });
    });

    /* ④ 方案 / 采购 / 预警 / 日志 */
    db.plans.forEach(function (p) {
      var nid = "plan:" + p.id;
      addNode({ id: nid, type: "Plan", label: p.title, props: { id: p.id, time: p.time || "", status: p.status || "pending", kcal: p.kcal || 0, source: p.source || "" }, community: ["scene:食材"] });
      var rec = recipes.filter(function (r) { return r.title === p.title; })[0];
      if (rec) {
        addEdge(nid, "recipe:" + rec.title, "cooksTo", { aiGenerated: /AI/.test(p.source || "") });
        /* consumes / needs：按菜谱用料回查库存（确定性） */
        (rec.ing || []).forEach(function (g) {
          if (!g[2]) return;
          var hit = null;
          db.libraries.forEach(function (l) {
            (l.items || []).forEach(function (it) {
              if (hit) return;
              var rf = resolveFood(it);   /* 非食材（书/工具/药品）解析为 null，不能直接取 .key */
              if (it.kbKey === g[2] || (rf && rf.key === g[2])) hit = { l: l, it: it };
            });
          });
          if (hit) addEdge(nid, "item:" + hit.it.id, "consumes", { qty: g[1], wasExpiring: hit.it.expDays != null && hit.it.expDays <= 7 && hit.it.expDays < 9000 });
          else addEdge(nid, "food:" + g[2], "needs", { qty: g[1] });
        });
      }
    });
    (db.shopping || []).forEach(function (s, i) {
      var nid = "shop:" + (s.id || i);
      addNode({ id: nid, type: "ShoppingItem", label: s.name, props: { qty: s.qty, source: s.source || "手动" }, community: ["scene:食材"] });
      var k = NAME_TO_KB[s.name];
      if (k) addEdge(nid, "food:" + k, "needs", { qty: s.qty });
    });
    (db.alerts || []).forEach(function (a) {
      var m = /^(.*)-(exp0|med|c|s|w|low)$/.exec(a.id);
      var nid = "alert:" + a.id;
      addNode({ id: nid, type: "Alert", label: a.text.slice(0, 12) + "…", props: { kind: a.type, tone: a.tone, text: a.text, at: a.meta || "" }, community: [] });
      if (m && byId["item:" + m[1]]) addEdge("item:" + m[1], nid, "triggers", { rule: a.type });
    });
    (db.logs || []).slice(0, 20).forEach(function (l, i) {
      var nid = "log:" + i;
      addNode({ id: nid, type: "LogEvent", label: (l.action || "").slice(0, 8), props: { action: l.action, detail: l.detail, at: l.at, day: l.day || "" }, community: [] });
      var name = l.name || "";
      var k = NAME_TO_KB[name];
      if (k && byId["food:" + k]) addEdge(nid, "food:" + k, "consumedBy", { delta: l.n || 0 });
    });

    /* ⑤ 社区（确定性三级：库 / 类别 / 场景）+ 统计（全部代码计算） */
    var communities = computeCommunities(nodes);

    /* ⑥ 摘要：版本一致且 24h 内的沿用，否则标 stale（不参与回答） */
    var version = hashOf(db);
    var oldSummaries = (doc && doc.summaries) || [];
    var now = Date.now();
    var summaries = oldSummaries.map(function (s) {
      return { community: s.community, text: s.text, generatedAt: s.generatedAt, basedOnVersion: s.basedOnVersion, model: s.model, stale: s.basedOnVersion !== version || now - s.generatedAt > 86400000 };
    });

    /* ⑦ 索引 */
    var index = { byLabel: {}, byType: {} };
    nodes.forEach(function (n) {
      (index.byLabel[n.label] = index.byLabel[n.label] || []).push(n.id);
      (index.byType[n.type] = index.byType[n.type] || []).push(n.id);
    });

    doc = {
      schema: SCHEMA, version: version, builtAt: now, kbVersion: String(window.KB.version),
      nodes: nodes, edges: edges, communities: communities, summaries: summaries, index: index
    };
    try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch (e) { /* 超容量时仅内存使用 */ }
    return { nodes: nodes.length, edges: edges.length, communities: communities.length, ms: Date.now() - t0, version: version };
  }

  /* 社区统计：节点数 / 临期数 / 金额 / 近 7 天消耗 / 健康度（0 次模型） */
  function computeCommunities(nodes) {
    var out = [];
    var groups = {};
    nodes.forEach(function (n) {
      (n.community || []).forEach(function (cid) { (groups[cid] = groups[cid] || []).push(n); });
    });
    Object.keys(groups).forEach(function (cid) {
      var members = groups[cid];
      var level = cid.indexOf("lib:") === 0 ? 1 : cid.indexOf("cat:") === 0 ? 2 : 3;
      var items = 0, expiring = 0, value = 0, consume7d = 0;
      var heat = {};
      members.forEach(function (n) {
        if (n.type !== "ItemInstance") return;
        items++;
        var p = n.props;
        if (p.expDays != null && p.expDays <= 7 && p.expDays < 9000) expiring++;
        value += p.price || 0;
        if (p.updatedAt) heat[n.label] = (heat[n.label] || 0) + 1;
      });
      /* 近 7 天消耗：从操作日志统计（仅 L1 库社区维度可归集，这里按全局日志近似） */
      var logs = (window.DB.logs || []);
      var libName = level === 1 ? members.filter(function (m) { return m.type === "Library"; }).map(function (m) { return m.label; })[0] : null;
      if (libName) {
        logs.forEach(function (l) {
          if (l.kind === "consume" && Date.now() - (l.ts || 0) < 7 * 86400000 && (l.detail || "").indexOf(libName) > -1) consume7d += l.n || 0;
        });
      }
      var health = items ? Math.max(40, 100 - Math.round((expiring / items) * 100)) : 100;
      out.push({ id: cid, level: level, label: cid.split(":")[1], stats: { items: items, expiring: expiring, value: Math.round(value * 10) / 10, consume7d: consume7d, health: health } });
    });
    out.sort(function (a, b) { return a.level - b.level || a.id.localeCompare(b.id); });
    return out;
  }

  /* ---------- 邻接表（查询期构建，O(e)） ---------- */
  var adj = null, adjVersion = "";
  function adjacency() {
    if (adj && adjVersion === doc.version) return adj;
    adj = {};
    doc.edges.forEach(function (e) {
      (adj[e.from] = adj[e.from] || []).push({ to: e.to, type: e.type, props: e.props, e: e });
      (adj[e.to] = adj[e.to] || []).push({ to: e.from, type: e.type, props: e.props, e: e, rev: true });
    });
    adjVersion = doc.version;
    return adj;
  }
  function node(id) { return doc.index ? doc.nodes.filter(function (n) { return n.id === id; })[0] || null : null; }
  function byId(id) {
    if (!doc._map) { doc._map = {}; doc.nodes.forEach(function (n) { doc._map[n.id] = n; }); }
    return doc._map[id] || null;
  }

  /* ---------- 检索算子（全部 0 次模型，方案 4.1） ---------- */

  /* matchEntity(q)：名称/别名 → 节点（长名优先防「蛋」误命中「蛋糕」） */
  function matchEntity(q) {
    if (!doc) return { items: [], foods: [] };
    buildNameIndex();
    var hits = { items: [], foods: [] };
    var items = doc.index.byType.ItemInstance || [];
    var sorted = items.slice().sort(function (a, b) { return byId(b).label.length - byId(a).label.length; });
    for (var i = 0; i < sorted.length; i++) {
      var n = byId(sorted[i]);
      if (!n.props.isPrivate && q.indexOf(n.label) > -1) { hits.items.push(n); break; }
    }
    var foods = doc.index.byType.FoodConcept || [];
    for (var j = 0; j < foods.length; j++) {
      var f = byId(foods[j]);
      if (q.indexOf(f.label) > -1 || (ALIASES[q] && ALIASES[q] === f.props.key)) { hits.foods.push(f); break; }
    }
    return hits;
  }

  /* neighbors(id, hops=1)：BFS 邻域 */
  function neighbors(id, hops) {
    hops = hops || 1;
    var a = adjacency();
    var seen = {}; seen[id] = 0;
    var frontier = [id];
    for (var h = 1; h <= hops; h++) {
      var next = [];
      frontier.forEach(function (cur) {
        (a[cur] || []).forEach(function (l) {
          if (seen[l.to] === undefined) { seen[l.to] = h; next.push(l.to); }
        });
      });
      frontier = next;
    }
    return Object.keys(seen).map(byId).filter(Boolean);
  }

  /* multiHop(seed, edgeTypes, maxHops=3)：受限边类型路径（≤5 条） */
  function multiHop(seeds, edgeTypes, maxHops) {
    maxHops = maxHops || 3;
    var a = adjacency();
    var allow = edgeTypes ? function (t) { return edgeTypes.indexOf(t) > -1; } : function () { return true; };
    var paths = [];
    function dfs(cur, nodeChain, edgeChain, depth) {
      if (paths.length >= 5 || depth > maxHops) return;
      (a[cur.id] || []).forEach(function (l) {
        if (!allow(l.type)) return;
        var nxt = byId(l.to);
        if (!nxt || nodeChain.indexOf(l.to) > -1) return;
        var chain = nodeChain.concat([l.to]);
        var echain = edgeChain.concat([l.type]);
        paths.push({ nodes: chain, edges: echain, from: cur.id });
        if (depth < maxHops) dfs(nxt, chain, echain, depth + 1);
      });
    }
    (seeds || []).slice(0, 3).forEach(function (s) { dfs(s, [s.id], [], 1); });
    return paths.slice(0, 5);
  }

  /* subgraph(filter)：{libId, cat, scene, expiringOnly, includePrivate} */
  function subgraph(filter) {
    filter = filter || {};
    var ns = doc.nodes.filter(function (n) {
      if (n.type === "ItemInstance") {
        if (n.props.isPrivate && !filter.includePrivate) return false;
        if (filter.libId && n.props.libId !== filter.libId) return false;
        if (filter.expiringOnly && !(n.props.expDays != null && n.props.expDays <= 7 && n.props.expDays < 9000)) return false;
        if (filter.cat && n.community.indexOf("cat:" + filter.cat) < 0) return false;
        return true;
      }
      if (n.type === "Library") return !filter.libId || n.id === "lib:" + filter.libId;
      if (n.type === "FoodConcept" || n.type === "RecipeConcept") {
        if (filter.libId) return false; /* 过滤具体库时不展示概念层全量，仅展示关联到的 */
        return true;
      }
      return false;
    });
    if (filter.libId) {
      /* 概念层：仅保留与该库物品有 instantiates 关联的 */
      var keep = {};
      doc.edges.forEach(function (e) {
        if (e.type === "instantiates" && byId(e.from) && byId(e.from).props.libId === filter.libId) keep[e.to] = 1;
        if (e.type === "usedBy" && keep[e.from]) keep[e.to] = 1;
      });
      ns = ns.concat(Object.keys(keep).map(byId).filter(Boolean));
    }
    var ids = {};
    ns.forEach(function (n) { ids[n.id] = 1; });
    var es = doc.edges.filter(function (e) { return ids[e.from] && ids[e.to]; });
    return { nodes: ns, edges: es };
  }

  /* aggregate(communityId)：社区实时统计（摘要 stale 时的回退事实源） */
  function aggregate(cid) {
    var c = doc.communities.filter(function (x) { return x.id === cid; })[0];
    if (!c) return null;
    /* 实时重算（防止 stat 过期） */
    var members = doc.nodes.filter(function (n) { return (n.community || []).indexOf(cid) > -1; });
    var items = 0, expiring = 0, value = 0;
    members.forEach(function (n) {
      if (n.type !== "ItemInstance" || (n.props.isPrivate)) return;
      items++; if (n.props.expDays != null && n.props.expDays <= 7 && n.props.expDays < 9000) expiring++;
      value += n.props.price || 0;
    });
    return { id: c.id, level: c.level, label: c.label, stats: { items: items, expiring: expiring, value: Math.round(value * 10) / 10, consume7d: c.stats.consume7d, health: c.stats.health } };
  }

  /* temporal(days)：时间窗事件 */
  function temporal(days) {
    var since = Date.now() - (days || 7) * 86400000;
    return (window.DB.logs || []).filter(function (l) { return (l.ts || 0) >= since; });
  }

  /* communityOf(id)：节点社区链 */
  function communityOf(id) {
    var n = byId(id);
    if (!n) return [];
    return (n.community || []).map(function (cid) {
      var c = doc.communities.filter(function (x) { return x.id === cid; })[0];
      return c ? { id: c.id, label: c.label, level: c.level, stats: c.stats } : { id: cid, label: cid.split(":")[1], level: 0, stats: {} };
    });
  }

  /* ---------- 读写入口 ---------- */
  function ensure() {
    if (doc && doc.version === hashOf(window.DB)) return doc;
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var d = JSON.parse(raw);
        if (d && d.version === hashOf(window.DB)) { doc = d; return doc; }
      }
    } catch (e) {}
    build();
    return doc;
  }

  function version() { return ensure().version; }
  function snapshot() { return ensure(); }

  /* 增量事件（阶段 1 直接幂等重建——500 物品 ≤300ms，成本可忽略） */
  function apply() { return build(); }

  /* 社区摘要写回（由 graph-rag 离线预计算后调用） */
  function putSummary(communityId, text, model) {
    ensure();
    var s = doc.summaries.filter(function (x) { return x.community === communityId; })[0];
    if (s) { s.text = text; s.generatedAt = Date.now(); s.basedOnVersion = doc.version; s.model = model; s.stale = false; }
    else doc.summaries.push({ community: communityId, text: text, generatedAt: Date.now(), basedOnVersion: doc.version, model: model, stale: false });
    try { localStorage.setItem(LS_KEY, JSON.stringify(doc)); } catch (e) {}
  }

  window.GRAPH = {
    build: build, apply: apply, ensure: ensure, version: version, snapshot: snapshot,
    matchEntity: matchEntity, neighbors: neighbors, multiHop: multiHop, subgraph: subgraph,
    aggregate: aggregate, temporal: temporal, communityOf: communityOf,
    byId: byId, putSummary: putSummary, SCENES: LIB_SCENE
  };
})();
