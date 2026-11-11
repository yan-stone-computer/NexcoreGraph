/* 启核图策 · GraphRAG 证据装配（Web 端，方案第 4 章落地）
   - 模式判定（0 次模型）：快答 fast / local / global / multi-hop / tool
   - ragEvidence()：证据行 ≤12、路径 ≤5、≤3 跳；数值 100% 来自图谱属性（红线 1）
   - ask()：Agnes 单次调用（措辞润色，不产出新数字）；失败自动降级本地回答
   - ensureSummaries()：社区摘要离线预计算（每社区 1 次、24h、限流 10 分钟 ≤3 次；stale 不参与回答） */
(function () {
  "use strict";

  var MAX_LINES = 12, MAX_PATHS = 5;
  var SUMMARY_TTL = 86400000;         /* 24h */
  var SUMMARY_RATE_KEY = "nexcore_summary_rate_v1";
  var SUMMARY_RATE_WINDOW = 600000;   /* 10 分钟 */
  var SUMMARY_RATE_MAX = 3;

  /* ---------- 模式判定（代码规则，方案 4.2） ---------- */
  function detectMode(text) {
    var t = text || "";
    var G = window.GRAPH;
    var ent = G.matchEntity(t);
    var hasEntity = ent.items.length > 0 || ent.foods.length > 0;
    var factWord = /放哪|在哪里|在哪|哪儿|还剩|剩多少|有多少|几个|几盒|几瓶|保质期|能放|多久|过期|变质/.test(t);
    var globalWord = /这周|本周|上周|最常|最该|整体|家里|全家|总结|简报|摘要|复盘|浪费|囤/.test(t);
    var multiCond = /临期|快过期|缺什么|一起买|减脂|增肌|控糖|几个人|\d\s*人/.test(t) && /做|吃|安排|晚餐|早餐|午餐|方案/.test(t);
    var writeWord = /只剩|还有|喝完|吃完|用完|没了|买了|加了|放入|补货|减少|吃掉|用了|想买|要买|加入采购/.test(t);

    if (writeWord) return "tool";
    if (multiCond) return "multi-hop";
    if (/做什么|吃什么|怎么安排|安排|晚餐|早餐|午餐/.test(t) && !factWord) return "multi-hop"; /* cook 类 → 临期→菜谱→缺料证据 */
    if (!hasEntity && globalWord) return "global";
    if (hasEntity && !factWord && /能做|怎么吃|做什么|搭配|替代|做法|营养|热量/.test(t)) return "local";
    if (hasEntity && factWord) return "fast";
    if (globalWord) return "global";
    if (hasEntity) return "local";
    return "global"; /* 无实体兜底走 global（社区事实），0 实体时退化为统计 */
  }

  function itemFactLine(n) {
    var p = n.props;
    var libName = p.libId ? (window.DB.libraries.filter(function (l) { return l.id === p.libId; })[0] || {}).name : "";
    return (libName ? libName + "·" : "") + (p.pos ? p.pos + "｜" : "") + n.label + " " + p.qty + p.unit +
      (p.expDays != null && p.expDays < 9000 ? "｜" + p.expDays + " 天到期" : "");
  }

  function pathOf(nodeChain, edgeChain) {
    var facts = [], src = "";
    nodeChain.forEach(function (id) {
      var n = window.GRAPH.byId(id);
      if (!n) return;
      if (n.type === "ItemInstance") facts.push(itemFactLine(n));
      if (n.type === "FoodConcept") { facts.push(n.label + "（知识库 · " + n.props.src + "）"); src = src || n.props.src; }
      if (n.type === "RecipeConcept") facts.push(n.label + " " + n.props.time + " · 约 " + n.props.kcal + " kcal/份");
    });
    return { nodes: nodeChain, edges: edgeChain, facts: facts, src: src || "本地图谱" };
  }

  /* ---------- 三种检索模式的证据装配 ---------- */

  /* local：实体邻域 + usedBy + needs（≤12 行 / ≤5 路径） */
  function localEvidence(question, ent) {
    var G = window.GRAPH;
    var seed = ent.items[0] || ent.foods[0];
    if (!seed) return globalEvidence(question);
    var lines = [], paths = [];
    /* 实例事实 */
    ent.items.forEach(function (it) { if (lines.length < MAX_LINES) lines.push(itemFactLine(it)); });
    if (ent.items.length === 0 && ent.foods.length) {
      var f = ent.foods[0];
      lines.push(f.label + "（知识库 · " + f.props.src + "）冷藏约 " + f.props.fridgeDays + " 天" + (f.props.openedDays > 0 ? "，开封后 " + f.props.openedDays + " 天" : ""));
    }
    /* 邻域：库 → 概念 → 菜谱（受限 2 跳） */
    var seedIds = ent.items.length ? ent.items : ent.foods;
    var rawPaths = G.multiHop(seedIds, ["contains", "locatedAt", "instantiates", "inCategory", "usedBy"], 2);
    rawPaths.slice(0, MAX_PATHS).forEach(function (p) {
      var full = pathOf([seedIds[0].id].concat(p.nodes), p.edges);
      if (full.facts.length) paths.push(full);
      full.facts.slice(0, 2).forEach(function (f) { if (lines.length < MAX_LINES && lines.indexOf(f) < 0) lines.push(f); });
    });
    return { mode: "local", seedLabel: seed.label, lines: lines.slice(0, MAX_LINES), paths: paths, stale: false };
  }

  /* global：社区统计（代码）+ 新鲜摘要（离线生成）；stale 摘要绝不参与回答（红线） */
  function globalEvidence(question) {
    var G = window.GRAPH;
    var doc = G.ensure();
    var t = question || "";
    var cands = doc.communities.filter(function (c) { return c.level === 1; });
    /* 关键词命中社区标签优先，否则按临期数取 Top3 */
    var hit = cands.filter(function (c) { return t && t.indexOf(c.label) > -1; });
    var top = (hit.length ? hit : cands.slice().sort(function (a, b) { return b.stats.expiring - a.stats.expiring || b.stats.items - a.stats.items; })).slice(0, 3);
    var lines = [], paths = [], usedSummary = 0, staleN = 0;
    top.forEach(function (c) {
      var agg = G.aggregate(c.id);
      lines.push("社区「" + agg.label + "」：" + agg.stats.items + " 件 · 临期 " + agg.stats.expiring + " 件 · 价值 ¥" + agg.stats.value + " · 健康度 " + agg.stats.health + "%");
      var s = doc.summaries.filter(function (x) { return x.community === c.id; })[0];
      if (s && !s.stale) { lines.push("社区洞察：" + s.text + "（摘要基于 " + Math.max(1, Math.round((Date.now() - s.generatedAt) / 60000)) + " 分钟前图谱）"); usedSummary++; }
      else if (s && s.stale) staleN++;
      paths.push({ nodes: [c.id], edges: [], facts: [c.label + " 社区统计由代码计算"], src: "图谱 aggregate()" });
    });
    /* 全局事实：最常消耗 / 浪费（temporal 算子） */
    var week = G.temporal(7);
    var byName = {};
    week.forEach(function (l) { if (l.kind === "consume" && l.name) byName[l.name] = (byName[l.name] || 0) + (l.n || 0); });
    var names = Object.keys(byName).sort(function (a, b) { return byName[b] - byName[a]; });
    if (names.length && lines.length < MAX_LINES) lines.push("近 7 天最常消耗：" + names[0] + " ×" + byName[names[0]]);
    return { mode: "global", lines: lines.slice(0, MAX_LINES), paths: paths.slice(0, MAX_PATHS), stale: false, usedSummary: usedSummary, staleCount: staleN };
  }

  /* multi-hop：临期物品 → 概念 → 菜谱 → 缺料 → 采购候选（方案 4.5） */
  function multiHopEvidence(question) {
    var G = window.GRAPH;
    var doc = G.ensure();
    var lines = [], paths = [];
    /* ① 子图：临期物品（≤7 天） */
    var sg = G.subgraph({ expiringOnly: true });
    var expItems = sg.nodes.filter(function (n) { return n.type === "ItemInstance"; });
    var lowFat = /减脂|低卡|清淡/.test(question || "");
    expItems.slice(0, 4).forEach(function (it) { if (lines.length < MAX_LINES) lines.push(itemFactLine(it)); });
    /* ② 2 跳：ItemInstance →(instantiates)→ FoodConcept →(usedBy)→ RecipeConcept */
    var seenRecipe = {};
    expItems.forEach(function (it) {
      var p = G.multiHop([it], ["instantiates", "usedBy"], 2);
      p.forEach(function (path) {
        var recId = path.nodes[path.nodes.length - 1];
        var rec = G.byId(recId);
        if (!rec || rec.type !== "RecipeConcept" || seenRecipe[recId]) return;
        if (lowFat && !/低脂|清淡|早餐/.test(rec.props.tags || "")) return;
        seenRecipe[recId] = 1;
        if (lines.length < MAX_LINES) lines.push(rec.label + "（" + rec.props.time + " · " + rec.props.kcal + " kcal/份 · " + (rec.props.tags || "") + "）");
        if (paths.length < MAX_PATHS) paths.push(pathOf([it.id].concat(path.nodes), path.edges));
      });
    });
    /* ③ 缺料：菜谱用料不在库存 → needs → 采购候选 */
    var stockKeys = {};
    window.DB.libraries.forEach(function (l) { (l.items || []).forEach(function (it) { if (it.kbKey) stockKeys[it.kbKey] = it.qty; else { var r = resolveName(it.name); if (r) stockKeys[r] = it.qty; } }); });
    Object.keys(seenRecipe).slice(0, 5).forEach(function (rid) {
      var rec = (window.KB.recipes || []).filter(function (r) { return "recipe:" + r.title === rid; })[0];
      if (!rec) return;
      (rec.ing || []).forEach(function (g) {
        if (g[2] && !stockKeys[g[2]] && lines.length < MAX_LINES) {
          var fname = (window.KB.foods[g[2]] || {}).name || g[0];
          lines.push("缺 " + fname + "（" + g[1] + "）→ 建议加入采购清单");
        }
      });
    });
    /* ④ 确定性救援求解：把 Pareto 排序作为可复核证据，模型不得改写 */
    if (window.RESCUE) {
      var stockItems = [];
      window.DB.libraries.forEach(function (lib) {
        (lib.items || []).forEach(function (it) { stockItems.push(Object.assign({ libId: lib.id, libName: lib.name }, it)); });
      });
      var ranked = window.RESCUE.rank(window.KB.recipes || [], stockItems, {
        soon: (window.DB.settings && window.DB.settings.alertSoon) || 7,
        dislikes: ((window.DB.profile && window.DB.profile.dislikes) || "").split(/[、,，;；\s]+/).filter(Boolean),
        maxMinutes: 60,
        goal: (window.DB.profile && window.DB.profile.goal) || ""
      });
      if (ranked.length) {
        var combined = window.RESCUE.portfolio(ranked, { maxMeals: 2, maxTotalMinutes: 60 });
        lines.push("救援排序：" + ranked.slice(0, 3).map(function (c) {
          return c.title + "（" + c.score + "）";
        }).join(" > ") + " · Pareto 前沿 " + ranked.filter(function (c) { return c.pareto; }).length + " 个");
        if (combined.meals.length) {
          lines.push("组合菜单：" + combined.meals.map(function (m) { return m.title; }).join(" + ") +
            "，覆盖 " + combined.rescuedKeys.length + " 种临期食材、合并缺料 " + combined.missing.length + " 种");
        }
      }
    }
    return { mode: "multi-hop", lines: lines.slice(0, MAX_LINES), paths: paths.slice(0, MAX_PATHS), stale: false };
  }

  function resolveName(name) {
    /* 与 graph.js 的别名表同口径的轻量查询 */
    var m = { "西红柿": "tomato", "青菜": "greens", "牛奶": "milk", "土豆": "potato", "酱油": "soySauce" };
    return m[name] || null;
  }

  /* ---------- 统一入口 ---------- */
  function ragEvidence(question) {
    var G = window.GRAPH;
    G.ensure();
    var mode = detectMode(question);
    var ev;
    if (mode === "local") { ev = localEvidence(question, G.matchEntity(question)); }
    else if (mode === "multi-hop") { ev = multiHopEvidence(question); }
    else { ev = globalEvidence(question); }
    ev.version = G.version();
    return ev;
  }

  /* ---------- Agnes 编排（单次调用 + 降级） ---------- */
  function systemPrompt(ev) {
    return [
      "你是「启核图策」家庭资源管家助手。请严格基于下面的图谱证据回答用户问题。",
      "硬性规则：1) 只能引用证据中出现过的数字与事实，禁止编造、估算或新增任何数字；",
      "2) 回答 ≤120 字，先给结论，再给 1 条可执行建议；",
      "3) 证据不足以回答时直说「图谱里暂无这部分信息」，并建议用户拍照入库；",
      "4) 涉及写操作（改数量/加采购）时提醒用户到对话里确认，不要声称已执行。"
    ].join("\n") + "\n\n图谱证据（mode=" + ev.mode + "，graphVersion=" + ev.version + "）：\n" +
      ev.lines.map(function (l, i) { return (i + 1) + ". " + l; }).join("\n");
  }

  /**
   * ask(question)：GraphRAG 全链路（检索 0 次模型 → Agnes 1 次润色）
   * 成功：{text, mode, evidence, model, ms, degraded:false}
   * 失败：degraded:true + 本地兜底文案（调用方可继续用原 modelReply 逻辑）
   */
  function ask(question, fallbackText) {
    var ev = ragEvidence(question);
    /* 双通道共用同一份「代码算好的证据」：自建网关按 intent+evidence 拼系统提示，
       厂商直连通道用 system。红线 1 不变——数字全部来自本地图谱查询。 */
    return window.AGNES.chat({
      intent: "graph-ask",
      question: question,
      evidence: "",
      system: systemPrompt(ev),
      graphEvidence: {
        mode: ev.mode,
        version: ev.version || "",
        lines: ev.lines,
        paths: ev.paths || []
      },
      temperature: 0.3, maxTokens: 400
    }).then(function (r) {
      return {
        ok: true, text: r.text, mode: ev.mode, evidence: ev,
        model: r.model, ms: r.ms, tokens: r.tokens, degraded: false,
        via: r.via,
        src: "模型 · " + r.model + "（" + (r.via === "direct" ? "多平台直连" : "自建网关") +
          "）+ GraphRAG（" + ev.mode + "）"
      };
    }).catch(function (err) {
      return {
        ok: false, text: fallbackText || "", mode: ev.mode, evidence: ev,
        model: "本地降级", ms: 0, degraded: true, error: err && err.message,
        src: "本地图谱事实（模型不可用，已降级）· " + ev.mode
      };
    });
  }

  /* ---------- 社区摘要离线预计算（方案 4.6，红线 3） ---------- */
  function rateOK() {
    var ts = [];
    try { ts = JSON.parse(localStorage.getItem(SUMMARY_RATE_KEY)) || []; } catch (e) {}
    var now = Date.now();
    ts = ts.filter(function (t) { return now - t < SUMMARY_RATE_WINDOW; });
    return { ok: ts.length < SUMMARY_RATE_MAX, ts: ts };
  }

  function ensureSummaries(force) {
    var G = window.GRAPH;
    var doc = G.ensure();
    var now = Date.now();
    var rate = rateOK();
    var jobs = [];
    doc.communities.forEach(function (c) {
      if (c.level !== 1) return;
      var s = doc.summaries.filter(function (x) { return x.community === c.id; })[0];
      var need = force || !s || s.stale || (s.basedOnVersion !== doc.version) || (now - s.generatedAt > SUMMARY_TTL);
      if (!need) return;
      if (!rate.ok) return; /* 限流：10 分钟 ≤3 次（全局串行） */
      var agg = G.aggregate(c.id);
      var prompt = "用不超过 80 字总结这个家庭资源社区的情况。只能使用以下数字，不得新增任何数字：" +
        agg.label + "社区共 " + agg.stats.items + " 件物品，其中临期 " + agg.stats.expiring + " 件，总价值 ¥" + agg.stats.value +
        "，健康度 " + agg.stats.health + "%。请给出库存主题判断和 1 条建议。";
      rate.ts.push(now);
      rate.ok = rate.ts.length < SUMMARY_RATE_MAX;
      jobs.push(
        window.AGNES.chat({
          intent: "community-summary",
          question: "",
          evidence: prompt,
          system: "你是「启核图策」家庭资源分析师。根据下面给出的社区统计写 1 句洞察（≤80 字），" +
            "数字必须原样引用，不得新增或修改数字，不要输出标题、列表符号或建议清单。\n" + prompt,
          temperature: 0.2, maxTokens: 120
        })
          .then(function (r) { G.putSummary(c.id, r.text, r.model); return { community: c.id, ok: true }; })
          .catch(function () { return { community: c.id, ok: false }; })
      );
    });
    if (rate.ts.length) {
      try { localStorage.setItem(SUMMARY_RATE_KEY, JSON.stringify(rate.ts)); } catch (e) {}
    }
    return Promise.all(jobs); /* 可为空数组；fire-and-forget 场景调用方不 await */
  }

  window.GRAPHRAG = {
    detectMode: detectMode,
    ragEvidence: ragEvidence,
    ask: ask,
    ensureSummaries: ensureSummaries,
    systemPrompt: systemPrompt
  };
})();
