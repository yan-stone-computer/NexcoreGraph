/* 启核图策 · Web 正式版 API 层（本地模拟后端，接口签名与真实后端契约对齐）
   完整文档 2.0：唯一 REST 后端；本层全部返回 Promise，替换为 fetch 即可接入阿里云 ECS。
   覆盖：登录鉴权（F9.1/角色 F9.2）、物品与库（F2）、预警引擎（F3.9-F3.14）、
   方案与核销（F3.1/F6.1/F6.3）、导入导出（F2.6）、拍照识别模拟（F1，正式版换 /api/ai/vision）、
   同步（F9.10/D1 全量快照+版本号 409 冲突二选一）、邀请码（F9.3）、AI 用量（F10.5）、预算（D6）。 */
(function () {
  "use strict";
  var LS_KEY = "nexcore_web_db_v3";   /* v3 起不再带演示数据，旧键里的种子数据一并弃用 */
  var LS_CLOUD = "nexcore_cloud_v1";
  var LATENCY = 200;

  /* ---------- 基础 ---------- */
  function seed() { return JSON.parse(JSON.stringify(window.DB)); }

  function merge(dst, src) {
    Object.keys(src).forEach(function (k) {
      if (dst[k] === undefined) { dst[k] = src[k]; return; }
      if (typeof src[k] === "object" && src[k] !== null && !Array.isArray(src[k]) &&
          typeof dst[k] === "object" && dst[k] !== null && !Array.isArray(dst[k])) merge(dst[k], src[k]);
    });
    return dst;
  }

  function load() {
    try {
      var s = localStorage.getItem(LS_KEY);
      if (s) return merge(JSON.parse(s), seed());
    } catch (e) {}
    return seed();
  }

  var db = load();
  window.DB = db;

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(db));
    } catch (e) { /* ponytail: localStorage ≈5MB 上限，图片缩略图已压缩；容量不足时升级 IndexedDB */ }
    computeAlerts();
    computeDaily();
  }

  function sleep() { return new Promise(function (r) { setTimeout(r, LATENCY + Math.random() * 180); }); }
  function nid(p) { return p + Date.now() + Math.floor(Math.random() * 1000); }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function nowTime() { return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }); }

  function findItem(idOrName) {
    for (var i = 0; i < db.libraries.length; i++) {
      var lib = db.libraries[i];
      for (var j = 0; (lib.items || []).length > j; j++) {
        if (lib.items[j].id === idOrName || lib.items[j].name === idOrName) return { lib: lib, item: lib.items[j] };
      }
    }
    return null;
  }
  function findLib(id) { return db.libraries.filter(function (l) { return l.id === id; })[0] || null; }

  /* P0-4 忌口列表：仅当「注入 AI 规划」开启时参与规划过滤（配合 H3） */
  function profileDislikes() {
    var p = db.profile || {};
    if (p.enabled === false || !p.dislikes) return [];
    return String(p.dislikes).split(/[、,，;；\s]+/).filter(Boolean);
  }

  function pushLog(action, detail, extra) {
    db.logs.unshift(Object.assign({ action: action, detail: detail, at: new Date().toLocaleString("zh-CN", { hour12: false }), ts: Date.now() }, extra || {}));
    if (db.logs.length > 120) db.logs.length = 120;
  }

  /* 写权限：只读账号禁止写库存（F9.2 权限角色） */
  function guard() {
    if (db.user && db.user.role === "只读") throw new Error("只读账号无写权限（F9.2）");
  }

  /* AI 用量（F10.5）：route/model/耗时/费用，管理员端聚合展示 */
  function aiLog(route, model, ms, extra) {
    var cfg = db.config || {};
    var unit = route.indexOf("vision") > -1 ? (cfg.visionPrice || 0.01) : (cfg.unitPrice || 0.002);
    var local = typeof model === "string" && model.indexOf("本地") > -1;
    db.aiUsage.unshift(Object.assign({ route: route, model: model || cfg.model || "Agnes-2.5-flash", ms: Math.round(ms), cost: local ? 0 : unit, at: new Date().toLocaleString("zh-CN", { hour12: false }), day: todayStr() }, extra || {}));
    if (db.aiUsage.length > 300) db.aiUsage.length = 300;
  }

  function nextNo() {
    db.meta = db.meta || { noSeq: 0 };
    var max = db.meta.noSeq || 0;
    db.libraries.forEach(function (l) { (l.items || []).forEach(function (it) { var m = /NO-(\d+)/.exec(it.no || ""); if (m) max = Math.max(max, parseInt(m[1], 10)); }); });
    db.meta.noSeq = max;
    return "NO-" + String(++db.meta.noSeq).padStart(4, "0");
  }

  function recount(lib) {
    lib.count = (lib.items || []).length;
    lib.desc = lib.items.length + " 件";
  }

  /* ---------- 预警引擎（F3.9-F3.14：全库扫描，档位可在设置配置） ---------- */
  function computeAlerts() {
    var soon = (db.settings && db.settings.alertSoon) || 7;
    var crit = (db.settings && db.settings.alertCritical) || 3;
    var out = [];
    db.libraries.forEach(function (lib) {
      (lib.items || []).forEach(function (it) {
        var where = lib.name + " · " + (it.pos || "未设置");
        /* expDays = 0/空 表示"不适用"（衣物、工具、厨具这类没有保质期），不参与临期与过期判断 */
        if (it.expDays != null && it.expDays > 0 && it.expDays < 9000) {
          if (it.med && it.expDays <= crit) {
            out.push({ id: it.id + "-med", type: "medicine", icon: "pill", tone: "red", text: it.name + " " + it.expDays + " 天后到期，请确认库存（F3.12）", meta: "刚刚 · " + where });
          } else if (it.expDays <= crit) {
            out.push({ id: it.id + "-c", type: "expiring", icon: "clock", tone: "red", text: it.name + " " + it.expDays + " 天后到期，建议优先消耗", meta: "刚刚 · " + where });
          } else if (it.expDays <= soon) {
            out.push({ id: it.id + "-s", type: "expiring", icon: "clock", tone: "amber", text: it.name + " " + it.expDays + " 天后到期，可纳入近几日方案", meta: "刚刚 · " + where });
          }
        }
        if (it.warrantyDays != null && it.warrantyDays <= 30) {
          out.push({ id: it.id + "-w", type: "warranty", icon: "shield", tone: "muted", text: it.name + " " + it.warrantyDays + " 天后过保修期（F3.13）", meta: "本周 · " + where });
        }
        if ((it.lowAt || 0) > 0 && it.qty <= it.lowAt) {
          out.push({ id: it.id + "-low", type: "low", icon: "package", tone: "teal", text: it.name + " 低于阈值（阈值 " + it.lowAt + " " + it.unit + "，当前 " + it.qty + " " + it.unit + "）", meta: "刚刚 · 规则自动化（D4 lowAt）" });
        }
        it.expiring = it.expDays != null && it.expDays > 0 && it.expDays <= soon && it.expDays < 9000;
      });
    });
    var order = { red: 0, amber: 1, teal: 2, muted: 3 };
    out.sort(function (a, b) { return order[a.tone] - order[b.tone]; });
    db.alerts = out;
  }

  /* 每日摘要：取预警前 3 条（F8.2），保留用户勾选状态 */
  function computeDaily() {
    var prev = {};
    (db.daily || []).forEach(function (t) { prev[t.text] = t.done; });
    db.daily = db.alerts.slice(0, 3).map(function (a, i) {
      var text = a.text.replace(/（F[\d.]+）|\（.*?自动化.*?\）/g, "");
      return { id: i + 1, text: text, done: !!prev[text] };
    });
  }

  /* ---------- 看板统计（F7：数字一律代码计算，模型只润色 —— AI 红线 1） ---------- */
  function computeStats() {
    var totalItems = 0, expiringN = 0, lowN = 0;
    db.libraries.forEach(function (l) { (l.items || []).forEach(function (it) { totalItems++; if (it.expiring) expiringN++; if ((it.lowAt || 0) > 0 && it.qty <= it.lowAt) lowN++; }); });
    var month = new Date().getMonth() + 1, dom = new Date().getDate();
    var spent = 0;
    db.libraries.forEach(function (l) { (l.items || []).forEach(function (it) { if (it.addedAt && it.addedAt <= dom) spent += it.price || 0; }); });
    var planDone = db.plans.filter(function (p) { return p.status === "done"; }).length;
    var planTotal = db.plans.length || 1;
    /* 7 天趋势：近 6 天取历史种子，今日按真实操作日志累计（消耗 = 核销/手动减量） */
    var trend = { consume: [], purchase: [], labels: [] };
    var dayMs = 86400000;
    var todayKey = todayStr();
    var liveC = 0, liveP = 0;
    db.logs.forEach(function (l) {
      if (l.day !== todayKey) return;
      if (l.kind === "consume") liveC += l.n || 0;
      if (l.kind === "intake") liveP += l.n || 0;
    });
    var h7 = db.history7 || [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date(Date.now() - i * dayMs);
      trend.labels.push((d.getMonth() + 1) + "/" + d.getDate());
      var seedRow = h7.filter(function (r) { return r.d === i; })[0] || { consume: 0, purchase: 0 };
      trend.consume.push(i === 0 ? liveC : seedRow.consume);
      trend.purchase.push(i === 0 ? liveP : seedRow.purchase);
    }
    /* 最常消耗（近 7 天） */
    var byName = {};
    db.logs.forEach(function (l) {
      if (l.kind === "consume" && l.name && Date.now() - l.ts < 7 * dayMs) byName[l.name] = (byName[l.name] || 0) + (l.n || 0);
    });
    var top = Object.keys(byName).sort(function (a, b) { return byName[b] - byName[a]; })[0] || "—";
    var fridgeItems = (findLib("fridge") || { items: [] }).items || [];
    var edible = fridgeItems.filter(function (i2) { return i2.expDays < 9000 && i2.expDays > 0; });
    var meals = Math.max(1, Math.round(edible.length * 1.2));
    return {
      totalItems: totalItems, expiringN: expiringN, lowN: lowN,
      spent: Math.round(spent), budget: db.budget || 600,
      planPct: Math.round((planDone / planTotal) * 100), planDone: planDone, planTotal: db.plans.length,
      trend: trend, topFood: top, mealsLeft: meals, daysLeft: Math.max(1, Math.round(meals / 2.5)),
      wasteN: db.logs.filter(function (l) { return l.action === "expired"; }).length,
      health: Math.max(40, 100 - Math.round((expiringN / Math.max(1, totalItems)) * 100) - lowN * 2)
    };
  }

  /* ---------- 物品变更统一入口（写日志 + 消耗台账 + 触发预警） ---------- */
  function applyQtyChange(hit, delta, reason) {
    var before = hit.item.qty;
    hit.item.qty = Math.max(0, hit.item.qty + delta);
    pushLog(delta < 0 ? "consume" : "qty", (delta < 0 ? "消耗「" : "补充「") + hit.item.name + "」" + (delta > 0 ? "+" : "") + delta + " " + hit.item.unit + "（" + reason + "）",
      { kind: delta < 0 ? "consume" : "intake", name: hit.item.name, n: Math.abs(delta), day: todayStr(), undo: { id: hit.item.id, qty: before } });
    return { before: before, after: hit.item.qty };
  }

  /* ---------- 启动：编号补齐 / 桌牌 / 知识库发布内容回放 ---------- */
  (function boot() {
    db.libraries.forEach(recount);
    if (db.knowledge) {
      /* 管理员端发布的知识库内容（F10.4）覆盖内置默认 */
      try {
        Object.keys(db.knowledge.foods || {}).forEach(function (k) { if (window.KB.foods[k]) Object.assign(window.KB.foods[k], db.knowledge.foods[k]); });
        if (Array.isArray(db.knowledge.recipes)) window.KB.recipes = db.knowledge.recipes;
        if (Array.isArray(db.knowledge.rules)) window.KB.rules = db.knowledge.rules;
      } catch (e) {}
    }
    if (!db.syncVersion) db.syncVersion = 1;
    save();
  })();

  var pristine = JSON.parse(JSON.stringify(db));

  /* ---------- 对外 API ---------- */
  /**
   * 模型返回的一条 → 端侧入库卡片。
   * expDays = 0 表示"不适用"（衣物、工具、厨具这类没有保质期），不能当成"已过期"。
   */
  function intakeItem(it, thumb) {
    var name = String((it && it.name) || "").trim();
    var days = Number(it && it.expDays);
    var expDays = isNaN(days) || days < 0 ? 0 : Math.round(days);
    var price = Number(it && it.price);
    var qty = Number(it && it.qty);
    return {
      id: nid("r"),
      emoji: "📦",
      img: thumb || "",
      name: name,
      category: String((it && it.category) || ""),
      qty: String(isNaN(qty) || qty <= 0 ? 1 : qty),
      unit: String((it && it.unit) || "个"),
      pos: String((it && it.pos) || ""),
      exp: expDays > 0 ? expDays + " 天" : "不适用",
      expSrc: expDays > 0 ? "拍照识别" : "不适用",
      expDays: expDays,
      kbKey: "",
      price: price > 0 ? (Math.round(price * 10) / 10).toFixed(1) : "",
      priceSrc: price > 0 ? "拍照识别" : "待补",
      attention: name === ""
    };
  }

  window.API = {
    getState: function () { return db; },
    getStats: function () { return computeStats(); },
    reset: function () {
      Object.keys(db).forEach(function (k) { delete db[k]; });
      Object.assign(db, JSON.parse(JSON.stringify(pristine)));
      db.libraries.forEach(recount);
      save();
      return db;
    },

    /* 本机模拟登录已移除：账号与验证码一律走后端 /api/auth/*（见 js/agnes.js 的 window.AUTH） */
    login: function () {
      return Promise.reject(new Error("本机模拟登录已移除，请使用后端验证码登录"));
    },

    /* ===== 拍照识别（F1）：真实调用 /api/ai/vision（网关优先，厂商直连兜底）
       这里以前是"本地模拟"：按图片长度从固定池里挑几样（鸡蛋/牛奶/番茄…）冒充识别结果。
       现在每张图都真的走模型；模型不可用时直接报错，不再拿假数据糊弄用户。 ===== */
    recognize: function (imgs, fulls) {
      var thumbs = Array.isArray(imgs) ? imgs : [];
      var shots = Array.isArray(fulls) && fulls.length === thumbs.length ? fulls : thumbs;
      if (!shots.length) return Promise.reject(new Error("先拍摄或选择至少 1 张图片"));
      if (!window.AGNES || typeof window.AGNES.vision !== "function") {
        return Promise.reject(new Error("视觉模块未加载，请刷新页面"));
      }
      var t0 = Date.now();
      var out = [];
      var trail = [];
      var chain = Promise.resolve();
      shots.forEach(function (url, i) {
        chain = chain.then(function () {
          var b64 = String(url || "").replace(/^data:[^;]+;base64,/, "");
          if (!b64) throw new Error("第 " + (i + 1) + " 张图片读取失败，请重新选择");
          return window.AGNES.vision({
            imageBase64: b64,
            familyId: (db.family && db.family.id) || db.familyId || "",
            user: (db.user && (db.user.name || db.user.account)) || ""
          }).then(function (res) {
            var items = (res && res.items) || [];
            trail.push({ model: (res && res.model) || "gateway", ms: (res && res.ms) || 0, n: items.length });
            items.forEach(function (it) { out.push(intakeItem(it, thumbs[i])); });
          });
        });
      });
      return chain.then(function () {
        var ms = Date.now() - t0;
        var model = trail.length && trail[0].model ? trail[0].model : "gateway";
        var via = window.AGNES.lastVia ? window.AGNES.lastVia() : "";
        db.intake.meta = {
          model: model, ms: ms, images: shots.length, items: out.length, via: via,
          trail: trail, at: new Date().toISOString()
        };
        aiLog("/api/ai/vision", model, ms);
        pushLog("intake", "AI 识别 " + shots.length + " 张图片 → " + out.length + " 项（" + model + " · " + ms + "ms）");
        save();
        return out;
      });
    },

    /* F1.2/D3 连拍合并：同名数量累加 */
    mergeIntake: function (results) {
      var seen = {};
      var out = [];
      results.forEach(function (r) {
        var key = (r.name || "").trim();
        if (!key) { out.push(r); return; }
        if (seen[key]) {
          seen[key].qty = String((parseFloat(seen[key].qty) || 0) + (parseFloat(r.qty) || 0));
          if (!seen[key].img && r.img) seen[key].img = r.img;
        } else {
          seen[key] = r;
          out.push(r);
        }
      });
      return out;
    },

    addItems: function (results, libId) {
      return sleep().then(function () {
        guard();
        var lib = findLib(libId) || db.libraries[0];
        var added = 0;
        results.forEach(function (r) {
          if (!r.name) return;
          lib.items.push({
            id: nid("it"), no: nextNo(), name: r.name, emoji: r.emoji || "📦", img: r.img || "", kbKey: r.kbKey || "",
            qty: parseFloat(r.qty) || 1, unit: r.unit || "个", price: parseFloat(r.price) || 0, priceSrc: r.priceSrc || "手动",
            /* 0 = 不适用；不要用 `|| 7` 把衣物/工具硬变成 7 天后到期 */
            expDays: (function () { var d = parseInt(r.expDays, 10); return isNaN(d) || d < 0 ? 0 : d; })(),
            pos: r.pos || "未设置", lowAt: (window.KB.foods[r.kbKey] || {}).lowAt || 0,
            addedAt: new Date().getDate(), private: !!r.private
          });
          added++;
        });
        recount(lib);
        pushLog("intake", "拍照入库 " + added + " 项到「" + lib.name + "」", { kind: "intake", n: added, day: todayStr() });
        save();
        return db;
      });
    },

    updateItemQty: function (id, delta) {
      return sleep().then(function () {
        guard();
        var hit = findItem(id);
        if (!hit) throw new Error("物品不存在");
        var r = applyQtyChange(hit, delta, "手动调整");
        save();
        return r;
      });
    },
    undoLast: function () {
      return sleep().then(function () {
        guard();
        var logs = db.logs.filter(function (l) { return l.undo; });
        if (!logs.length) throw new Error("没有可撤销的操作（保留最近 10 次）");
        var last = logs[0];
        var hit = findItem(last.undo.id);
        if (!hit) throw new Error("物品已不存在，无法撤销");
        var before = hit.item.qty;
        hit.item.qty = last.undo.qty;
        pushLog("undo", "撤销：「" + hit.item.name + "」数量 " + before + " → " + last.undo.qty);
        save();
        return last;
      });
    },

    /* ===== 库管理（F2.1） ===== */
    createLibrary: function (name, icon, tone) {
      return sleep().then(function () {
        guard();
        var lib = { id: nid("lib"), name: name || "新库", icon: icon || "package", tone: tone || "teal", count: 0, desc: "空库", items: [] };
        db.libraries.push(lib);
        pushLog("library", "新建库「" + lib.name + "」");
        save();
        return lib;
      });
    },
    renameLibrary: function (id, name) {
      return sleep().then(function () {
        guard();
        var lib = findLib(id);
        if (!lib) throw new Error("库不存在");
        lib.name = name;
        pushLog("library", "重命名库为「" + name + "」");
        save();
        return db;
      });
    },
    deleteLibrary: function (id) {
      return sleep().then(function () {
        guard();
        var idx = -1;
        for (var i = 0; i < db.libraries.length; i++) if (db.libraries[i].id === id) idx = i;
        if (idx < 0) throw new Error("库不存在");
        var snap = { lib: db.libraries[idx], index: idx };
        db.libraries.splice(idx, 1);
        pushLog("library", "删除库「" + snap.lib.name + "」");
        save();
        return snap;
      });
    },
    restoreLibrary: function (snap) {
      return sleep().then(function () {
        db.libraries.splice(Math.min(snap.index, db.libraries.length), 0, snap.lib);
        save();
        return db;
      });
    },
    moveLibrary: function (id, dir) {
      return sleep().then(function () {
        guard();
        var idx = -1;
        for (var i = 0; i < db.libraries.length; i++) if (db.libraries[i].id === id) idx = i;
        var to = idx + dir;
        if (idx < 0 || to < 0 || to >= db.libraries.length) throw new Error("无法移动");
        var t = db.libraries[idx];
        db.libraries[idx] = db.libraries[to];
        db.libraries[to] = t;
        pushLog("library", "调整库排序");
        save();
        return db;
      });
    },
    moveLibraryTo: function (id, toIndex) {
      return sleep().then(function () {
        guard();
        var idx = -1;
        for (var i = 0; i < db.libraries.length; i++) if (db.libraries[i].id === id) idx = i;
        if (idx < 0) throw new Error("库不存在");
        toIndex = Math.max(0, Math.min(toIndex, db.libraries.length - 1));
        var lib = db.libraries.splice(idx, 1)[0];
        db.libraries.splice(toIndex, 0, lib);
        pushLog("library", "调整库排序");
        save();
        return db;
      });
    },

    /* ===== 物品（F2.2） ===== */
    addItem: function (libId, data) {
      return sleep().then(function () {
        guard();
        var lib = findLib(libId);
        if (!lib) throw new Error("库不存在");
        var expDays = parseInt(data.expDays, 10) || 7;
        var kbKey = (Object.keys(window.KB.foods).filter(function (k) { return window.KB.foods[k].name === data.name; })[0]) || "";
        var item = {
          id: nid("it"), no: nextNo(), name: data.name, emoji: data.emoji || "📦", img: data.img || "", kbKey: kbKey,
          qty: parseFloat(data.qty) || 1, unit: data.unit || "个", price: parseFloat(data.price) || 0, priceSrc: data.priceSrc || "手动",
          expDays: expDays, pos: data.pos || "未设置", lowAt: (window.KB.foods[kbKey] || {}).lowAt || 0,
          addedAt: new Date().getDate(), private: !!data.private
        };
        lib.items.push(item);
        recount(lib);
        pushLog("item", "添加物品「" + item.name + "」到「" + lib.name + "」", { kind: "intake", n: 1, day: todayStr() });
        save();
        return db;
      });
    },
    updateItem: function (libId, itemId, patch) {
      return sleep().then(function () {
        guard();
        var lib = findLib(libId);
        if (!lib) throw new Error("库不存在");
        if (lib.coopAddOnly) throw new Error("合作复制库只能添加，不能修改");
        var it = lib.items.filter(function (x) { return x.id === itemId; })[0];
        if (!it) throw new Error("物品不存在");
        Object.keys(patch).forEach(function (k) {
          if (k === "qty") it.qty = Math.max(0, parseFloat(patch[k]) || 0);
          else if (k === "price") it.price = parseFloat(patch[k]) || 0;
          else if (k === "expDays") it.expDays = parseInt(patch[k], 10) || 7;
          else it[k] = patch[k];
        });
        pushLog("item", "编辑物品「" + it.name + "」");
        save();
        return db;
      });
    },
    deleteItem: function (libId, itemId) {
      return sleep().then(function () {
        guard();
        var lib = findLib(libId);
        if (!lib) throw new Error("库不存在");
        if (lib.coopAddOnly) throw new Error("合作复制库只能添加，不能删除");
        var idx = -1;
        for (var i = 0; i < lib.items.length; i++) if (lib.items[i].id === itemId) idx = i;
        if (idx < 0) throw new Error("物品不存在");
        var snap = { lib: lib, item: lib.items[idx], index: idx };
        lib.items.splice(idx, 1);
        recount(lib);
        pushLog("item", "删除物品「" + snap.item.name + "」");
        save();
        return snap;
      });
    },
    restoreItem: function (snap) {
      return sleep().then(function () {
        snap.lib.items.splice(Math.min(snap.index, snap.lib.items.length), 0, snap.item);
        recount(snap.lib);
        save();
        return db;
      });
    },

    /* ===== 导入导出（F2.6，CSV 兼容 Excel） ===== */
    exportCSV: function () {
      return sleep().then(function () {
        var rows = [["库", "名称", "数量", "单位", "价格", "价格来源", "位置", "剩余保质期(天)", "低库存阈值", "仅自己可见"]];
        db.libraries.forEach(function (lib) {
          (lib.items || []).forEach(function (it) {
            rows.push([lib.name, it.name, it.qty, it.unit, it.price, it.priceSrc, it.pos, it.expDays, it.lowAt || 0, it.private ? "是" : "否"]);
          });
        });
        return rows.map(function (r) { return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(","); }).join("\r\n");
      });
    },
    importCSV: function (text) {
      return sleep().then(function () {
        guard();
        var lines = text.split(/\r?\n/).filter(function (l) { return l.trim(); });
        var added = 0;
        for (var i = 1; i < lines.length; i++) {
          var cols = lines[i].match(/("([^"]|"")*"|[^,]*)(,|$)/g);
          if (!cols) continue;
          cols = cols.map(function (c) { return c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim(); }).filter(function (c, j, arr) { return j < arr.length - 1 || c !== ""; });
          if (cols.length < 2 || !cols[1]) continue;
          var lib = db.libraries.filter(function (l) { return l.name === cols[0]; })[0] || db.libraries[0];
          var kbKey = (Object.keys(window.KB.foods).filter(function (k) { return window.KB.foods[k].name === cols[1]; })[0]) || "";
          lib.items.push({
            id: nid("it"), no: nextNo(), name: cols[1], emoji: "📦", img: "", kbKey: kbKey,
            qty: parseFloat(cols[2]) || 1, unit: cols[3] || "个", price: parseFloat(cols[4]) || 0, priceSrc: "导入",
            expDays: parseInt(cols[7], 10) || 7, pos: cols[6] || "未设置", lowAt: parseInt(cols[8], 10) || 0,
            addedAt: new Date().getDate(), private: cols[9] === "是"
          });
          added++;
        }
        db.libraries.forEach(recount);
        pushLog("import", "导入 " + added + " 件物品（CSV）", { kind: "intake", n: added, day: todayStr() });
        save();
        return added;
      });
    },

    /* ===== 方案（F3.1/F3.8 知识库驱动 + 固定优先级：临期优先 > 清库存 > 营养均衡） ===== */
    generatePlans: function () {
      var t0 = Date.now();
      return sleep().then(function () {
        var stock = {}; /* kbKey/名称 → item */
        db.libraries.forEach(function (l) { (l.items || []).forEach(function (it) { if (it.kbKey) stock[it.kbKey] = it; stock[it.name] = it; }); });
        var soon = (db.settings && db.settings.alertSoon) || 7;
        var dis = profileDislikes();
        var scored = window.KB.recipes
          .filter(function (rc) {
            return !dis.length || !rc.ing.some(function (g) { return dis.indexOf(g[0]) > -1 || dis.indexOf(g[2]) > -1; });
          })
          .map(function (rc) {
          var used = [], missing = [];
          rc.ing.forEach(function (g) {
            var it = stock[g[2]] || stock[g[0]];
            if (it) used.push({ name: g[0], qty: g[1], kbKey: g[2], item: it });
            else missing.push({ name: g[0], qty: g[1] });
          });
          var expN = used.filter(function (u) { return u.item.expiring; }).length;
          var full = missing.length === 0;
          var reason = expN > 0 ? "临期优先" : full ? "清库存" : "营养均衡";
          var score = expN * 100 + used.length * 10 - missing.length * 5 + (full ? 20 : 0);
          return { rc: rc, used: used, missing: missing, expN: expN, full: full, reason: reason, score: score };
        });
        scored.sort(function (a, b) { return b.score - a.score; });
        db.meta = db.meta || {};
        var plans = scored.slice(0, 3).map(function (s, i) {
          return {
            id: db.meta.planSeq = (db.meta.planSeq || 0) + 1,
            title: s.rc.title, priority: s.expN > 0 ? "高" : "中", reason: s.reason, time: s.rc.time,
            source: "知识库 · recipes", kcal: s.rc.kcal, prot: s.rc.prot,
            used: s.used.map(function (u) { return { name: u.name, qty: u.qty }; }),
            missing: s.missing, status: "pending",
            selected: s.used.map(function (u) { return u.name; })
          };
        });
        if (!plans.length) plans.push({ id: ++db.meta.planSeq, title: "库存快速整理", priority: "中", reason: "清点建议", time: "5 分钟", source: "知识库", kcal: 0, prot: 0, used: [], missing: [], status: "pending", selected: [] });
        db.plans = db.plans.concat(plans);
        if (db.plans.length > 12) db.plans = db.plans.slice(-12);
        aiLog("/api/ai/chat", db.config.model, Date.now() - t0 + 600);
        pushLog("plan", "生成 " + plans.length + " 个方案（临期优先 > 清库存 > 营养均衡）");
        save();
        return plans;
      });
    },

    /* P0-3 AI 创新菜谱：优先消耗临期食材 */
    creativeRecipe: function () {
      var t0 = Date.now();
      return sleep().then(function () {
        db.meta = db.meta || {};
        var dis = profileDislikes();
        var pool = [];
        db.libraries.forEach(function (l) { (l.items || []).forEach(function (it) {
          if (it.expiring && it.expDays < 9000 && !(dis.length && (dis.indexOf(it.name) > -1 || dis.indexOf(it.kbKey) > -1))) pool.push(it);
        }); });
        pool.sort(function (a, b) { return a.expDays - b.expDays; });
        var picks = pool.slice(0, 2);
        var styles = ["一锅烩", "煎烤拼盘", "能量碗", "快手煲"];
        var style = styles[pool.length % styles.length];
        var name = picks.length ? picks.map(function (p) { return p.name; }).join("") + style : "临期清空碗";
        var used = picks.map(function (p) { return { name: p.name, qty: p.qty + " " + p.unit }; });
        if (!used.length) used.push({ name: "任意库存食材", qty: "适量" });
        var kcal = 150 + used.length * 120, prot = 8 + used.length * 6;
        var plan = {
          id: (db.meta.planSeq = (db.meta.planSeq || 0) + 1), title: name, priority: "高", reason: "临期优先 · AI 创新菜谱",
          time: (10 + used.length * 5) + " 分钟", source: "AI 创新菜谱（P0-3）", kcal: kcal, prot: prot,
          used: used, missing: [], status: "pending", selected: used.map(function (u) { return u.name; }), creative: true
        };
        db.plans.push(plan);
        aiLog("/api/ai/chat", db.config.model, Date.now() - t0 + 500);
        pushLog("plan", "生成创新菜谱「" + name + "」（优先消耗临期）");
        save();
        return plan;
      });
    },

    executePlan: function (id, selected) {
      return sleep().then(function () {
        guard();
        var p = db.plans.filter(function (x) { return x.id === id; })[0];
        if (!p || p.status === "done") throw new Error("方案不可执行");
        var snap = [];
        p.used.forEach(function (u) {
          if (selected && selected.indexOf(u.name) === -1) return;
          var hit = findItem(u.name);
          if (!hit) return;
          var amount = parseFloat(u.qty) || 1;
          var before = hit.item.qty;
          applyQtyChange(hit, -amount, "方案执行「" + p.title + "」");
          snap.push({ id: hit.item.id, name: hit.item.name, before: before, after: hit.item.qty });
        });
        p.status = "done";
        p.snapshot = snap;
        pushLog("plan", "执行方案「" + p.title + "」，扣减 " + snap.length + " 项");
        save();
        return db;
      });
    },
    rollbackPlan: function (id) {
      return sleep().then(function () {
        guard();
        var p = db.plans.filter(function (x) { return x.id === id; })[0];
        if (!p || !p.snapshot) throw new Error("无可撤销记录");
        p.snapshot.forEach(function (s) {
          var hit = findItem(s.id);
          if (hit) hit.item.qty = s.before;
        });
        p.status = "pending";
        delete p.snapshot;
        pushLog("plan", "撤销方案「" + p.title + "」，库存已回滚");
        save();
        return db;
      });
    },

    /* ===== 预警（F3.9-F3.14） ===== */
    resolveAlert: function (id) {
      return sleep().then(function () {
        var a = db.alerts.filter(function (x) { return x.id === id; })[0];
        db.alerts = db.alerts.filter(function (x) { return x.id !== id; });
        if (a) pushLog("alert", "处理预警：" + a.text);
        save();
        return db;
      });
    },

    /* ===== 采购清单（F3.6：方案缺料 + lowAt 低库存合并去重） ===== */
    shoppingList: function () {
      return sleep().then(function () {
        var list = [], seen = {};
        db.plans.forEach(function (p) {
          if (p.status === "done") return;
          (p.missing || []).forEach(function (m) {
            var key = m.name;
            if (seen[key]) return;
            seen[key] = 1;
            list.push({ name: m.name, qty: m.qty, src: "「" + p.title + "」缺料" });
          });
        });
        db.libraries.forEach(function (lib) {
          (lib.items || []).forEach(function (it) {
            if ((it.lowAt || 0) > 0 && it.qty <= it.lowAt && !seen[it.name]) {
              seen[it.name] = 1;
              list.push({ name: it.name, qty: "补到 " + Math.max(it.lowAt * 2, it.lowAt + 2) + " " + it.unit, src: "低库存提醒（D4）" });
            }
          });
        });
        db.shopping = list;
        save();
        return db.shopping;
      });
    },

    /* ===== 同步（F9.10/D1：全量快照 + 版本号冲突检测，契约 /api/sync/*） ===== */
    _cloud: function () {
      try { return JSON.parse(localStorage.getItem(LS_CLOUD)) || { version: 1, updatedAt: null, payload: null }; }
      catch (e) { return { version: 1, updatedAt: null, payload: null }; }
    },
    _cloudSave: function (c) { localStorage.setItem(LS_CLOUD, JSON.stringify(c)); },
    /* 活同步 / 跨设备流转：给自建后端用（真实网络），不经过 localStorage 云端 */
    snapshotPayload: function () {
      return {
        libraries: JSON.parse(JSON.stringify(db.libraries || [])),
        plans: JSON.parse(JSON.stringify(db.plans || [])),
        shopping: JSON.parse(JSON.stringify(db.shopping || [])),
        alerts: JSON.parse(JSON.stringify(db.alerts || [])),
        daily: JSON.parse(JSON.stringify(db.daily || [])),
        logs: JSON.parse(JSON.stringify((db.logs || []).slice(0, 50)))
      };
    },
    applyPayload: function (p) {
      if (!p) return db;
      if (p.libraries) db.libraries = p.libraries;
      if (p.plans) db.plans = p.plans;
      if (p.shopping) db.shopping = p.shopping;
      if (p.daily) db.daily = p.daily;
      if (p.logs) db.logs = p.logs;
      save();
      return db;
    },
    localVersion: function () { return db.syncVersion || 1; },
    setLocalVersion: function (v) { db.syncVersion = Number(v) || 1; save(); return db.syncVersion; },
    /* 登录成功后写入真实账号/家庭；clearContent 清掉上一账号的本地演示数据 */
    applyLogin: function (u) {
      if (u && u.user) db.user = u.user;
      if (u && u.family) db.family = u.family;
      db.familyId = (u && u.familyId) || (u && u.family && u.family.id) || "";
      if (u && u.families) db.families = u.families;
      if (u && u.members) db.members = u.members;
      if (u && u.invite !== undefined) db.invite = u.invite;
      save();
      return db;
    },
    clearContent: function () {
      db.libraries = [];
      db.plans = [];
      db.alerts = [];
      db.shopping = [];
      db.chat = [];
      db.logs = [];
      db.daily = [];
      db.history7 = [];
      db.workbench = null;
      db.intake = { step: 0, results: [] };
      save();
      return db;
    },
    saveState: function () { save(); return db; },
    syncStatus: function () {
      return sleep().then(function () {
        var c = API._cloud();
        return { local: db.syncVersion || 1, version: c.version, updatedAt: c.updatedAt };
      });
    },
    syncUpload: function (force) {
      return sleep().then(function () {
        guard();
        var c = API._cloud();
        var local = db.syncVersion || 1;
        if (c.version > local && !force) {
          var err = new Error("云端版本较新");
          err.status = 409;
          err.version = c.version;
          err.updatedAt = c.updatedAt;
          throw err;
        }
        c.version = Math.max(c.version, local) + 1;
        c.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
        c.payload = JSON.stringify({ libraries: db.libraries, plans: db.plans, shopping: db.shopping });
        db.syncVersion = c.version;
        API._cloudSave(c);
        pushLog("sync", "上传全量快照 → v" + c.version + (force ? "（强制覆盖）" : ""));
        save();
        return { version: c.version };
      });
    },
    syncDownload: function () {
      return sleep().then(function () {
        var c = API._cloud();
        if (!c.payload || c.version <= (db.syncVersion || 1)) throw new Error("云端无更新");
        var payload = JSON.parse(c.payload);
        if (payload.libraries) db.libraries = payload.libraries;
        if (payload.plans) db.plans = payload.plans;
        if (payload.shopping) db.shopping = payload.shopping;
        db.syncVersion = c.version;
        pushLog("sync", "拉取云端快照 v" + c.version + "，本地已覆盖");
        save();
        return { version: c.version };
      });
    },
    /* 演示：模拟另一台设备改了云端（制造 409 场景，验收 G2） */
    syncSimulateRemote: function () {
      return sleep().then(function () {
        var c = API._cloud();
        var payload = { libraries: JSON.parse(JSON.stringify(db.libraries)), plans: db.plans, shopping: db.shopping };
        payload.libraries[0].items.push({ id: nid("it"), no: nextNo(), name: "云上酸奶", emoji: "🥤", kbKey: "yogurt", qty: 2, unit: "杯", price: 9.9, priceSrc: "手动", expDays: 14, pos: "冷藏区上层", lowAt: 1, addedAt: new Date().getDate(), private: false });
        recount(payload.libraries[0]);
        c.version = (db.syncVersion || 1) + 1;
        c.updatedAt = new Date().toLocaleString("zh-CN", { hour12: false });
        c.payload = JSON.stringify(payload);
        API._cloudSave(c);
        pushLog("sync", "模拟另一设备上传 → 云端 v" + c.version);
        save();
        return c.version;
      });
    },

    /* ===== 协作（F9） ===== */
    setDeck: function (ids) {
      return sleep().then(function () {
        db.workbench.myDeck = (ids || []).filter(function (id) { return db.libraries.some(function (l) { return l.id === id; }); }).slice(0, 4);
        pushLog("coop", "更换手牌为 " + db.workbench.myDeck.length + " 张");
        save();
        return db;
      });
    },
    runWorkbench: function () {
      return sleep().then(function () {
        guard();
        var a = findItem("鸡蛋"), b = findItem("番茄"), snap = [];
        if (a) { var r1 = applyQtyChange(a, -4, "工作台「番茄蛋包饭」A 家归属"); snap.push({ name: a.item.name, before: r1.before, after: r1.after }); }
        if (b) { var r2 = applyQtyChange(b, -2, "工作台「番茄蛋包饭」B 家归属"); snap.push({ name: b.item.name, before: r2.before, after: r2.after }); }
        pushLog("workbench", "执行「番茄蛋包饭」，按归属扣减（F9.7）");
        save();
        return { snap: snap };
      });
    },
    sendLibrary: function (fromSeat, toSeat, libId) {
      return sleep().then(function () {
        guard();
        var seats = db.workbench.seats, from = null, card = null;
        seats.forEach(function (s) {
          if (s.id !== fromSeat) return;
          from = s;
          (s.libs || []).forEach(function (c) { if (c.id === libId) card = c; });
        });
        if (!from || !card) throw new Error("手牌不存在");
        var to = seats.filter(function (s) { return s.id === toSeat; })[0];
        if (!to) throw new Error("目标座位不存在");
        var srcItems = fromSeat === "me"
          ? ((findLib(libId) || { items: [] }).items || []).map(function (it) { return JSON.parse(JSON.stringify(it)); })
          : (card.items || []).map(function (it) { return JSON.parse(JSON.stringify(it)); });
        var copy = JSON.parse(JSON.stringify(card));
        copy.id = nid("lc"); copy.tag = from.name; copy.coop = true; copy.of = fromSeat === "me" ? libId : card.of || null;
        copy.items = srcItems; copy.count = srcItems.length;
        var merged = 0, coopCreated = false;
        if (toSeat === "me") {
          if (copy.of) {
            var origLib = findLib(copy.of);
            if (origLib) {
              var known = {};
              (origLib.items || []).forEach(function (it) { known[it.no] = true; });
              (copy.items || []).forEach(function (it) {
                if (it.no && !known[it.no]) { origLib.items.push(it); known[it.no] = true; merged++; }
              });
              recount(origLib);
            }
            from.libs = from.libs.filter(function (c) { return c.id !== card.id; });
            pushLog("coop", from.name + " 返回「" + copy.name + "」，合并新增 " + merged + " 项");
          } else {
            db.libraries.push({ id: copy.id, name: copy.name, icon: copy.icon || "package", tone: "teal", count: copy.items.length, desc: "来自 " + from.name + " · 合作复制", items: copy.items, coop: true, coopFrom: from.name, coopAddOnly: true });
            coopCreated = true;
            pushLog("coop", from.name + " 传给 我：「" + copy.name + "」，本地已复制");
          }
        } else {
          to.libs.push(copy);
          pushLog("coop", from.name + " 传给 " + to.name + "：「" + copy.name + "」");
        }
        db.workbench.history = db.workbench.history || [];
        db.workbench.history.push({ from: from.name, to: to.name, lib: copy.name, time: nowTime() });
        if (db.workbench.history.length > 40) db.workbench.history = db.workbench.history.slice(-40);
        db.workbench.chat.push({ sys: true, text: from.name + " 把「" + copy.name + "」发给了 " + to.name + (merged > 0 ? "，合并新增 " + merged + " 项" : "") });
        save();
        return { coopCreated: coopCreated, merged: merged, libName: copy.name, toName: to.name };
      });
    },
    sendChat: function (fromName, text) {
      return sleep().then(function () {
        db.workbench.chat.push({ from: fromName, text: text, time: nowTime(), sys: false });
        if (db.workbench.chat.length > 80) db.workbench.chat = db.workbench.chat.slice(-80);
        save();
        return db;
      });
    },
    endCoop: function () {
      return sleep().then(function () {
        var summary = (db.workbench.history || []).slice();
        db.libraries = db.libraries.filter(function (l) { return !l.coop; });
        db.workbench.seats = JSON.parse(JSON.stringify(pristine.workbench.seats));
        db.workbench.seats[0].libs = [];
        db.workbench.history = [];
        db.workbench.chat = [];
        pushLog("coop", "合作结束，聚合数据与复制库已清理（F9.9 生命周期）");
        save();
        return summary;
      });
    },

    /* ===== 邀请码（F9.3：生成 / 限时 / 撤销） ===== */
    inviteGenerate: function (days, max) {
      return sleep().then(function () {
        guard();
        var code = "TZ-" + String(1000 + Math.floor(Math.random() * 9000));
        db.invite = { code: code, familyId: db.familyId, expiresInDays: days || 7, used: 0, max: max || 3, revoked: false, createdAt: Date.now() };
        db.workbench.code = code;
        pushLog("invite", "生成邀请码 " + code + "（有效期 " + (days || 7) + " 天，限 " + (max || 3) + " 人）");
        save();
        return db.invite;
      });
    },
    inviteRevoke: function () {
      return sleep().then(function () {
        guard();
        db.invite.revoked = true;
        pushLog("invite", "撤销邀请码 " + db.invite.code);
        save();
        return db.invite;
      });
    },
    /* ===== 成员管理（F9.2） ===== */
    familyCreate: function (name) {
      return sleep().then(function () {
        guard();
        var id = nid("fam");
        db.families.push({ id: id, name: name, memberCount: 1 });
        db.members[id] = [{ phone: db.user.phone, name: db.user.name, role: "管理员" }];
        db.familyId = id;
        db.family = { name: name, memberCount: 1 };
        db.invite = { code: "TZ-" + String(1000 + Math.floor(Math.random() * 9000)), familyId: id, expiresInDays: 7, used: 0, max: 3, revoked: false, createdAt: Date.now() };
        pushLog("family", "创建家庭「" + name + "」并切换（POST /api/families）");
        save();
        return db.family;
      });
    },
    memberRemove: function (phone) {
      return sleep().then(function () {
        guard();
        if (phone === db.user.phone) throw new Error("不能移除自己");
        var list = db.members[db.familyId] || [];
        var m = list.filter(function (x) { return x.phone === phone; })[0];
        if (!m) throw new Error("成员不存在");
        if (m.role === "管理员") throw new Error("不能移除家庭管理员");
        db.members[db.familyId] = list.filter(function (x) { return x.phone !== phone; });
        db.family.memberCount = db.members[db.familyId].length;
        pushLog("member", "移除成员 " + m.name + "（" + phone + "）");
        save();
        return db.members[db.familyId];
      });
    },

    /* ===== 对话（P0-5：仅本地 ≤200 条） ===== */
    chatPush: function (msg) {
      db.chat.push(msg);
      if (db.chat.length > 200) db.chat = db.chat.slice(-200); /* ponytail: 滚动截断即可，无分页需求 */
      save();
    },
    touchChat: function () { save(); },
    chatClear: function () {
      return sleep().then(function () {
        db.chat = [];
        save();
        return db;
      });
    },

    /* ===== 搜索（F2.4） ===== */
    search: function (q) {
      q = (q || "").trim().toLowerCase();
      var items = [];
      db.libraries.forEach(function (lib) {
        (lib.items || []).forEach(function (it) {
          if (q && (it.name.toLowerCase().indexOf(q) > -1 || (it.pos || "").toLowerCase().indexOf(q) > -1)) {
            items.push({ name: it.name, emoji: it.emoji, img: it.img, lib: lib.name, libId: lib.id, pos: it.pos, qty: it.qty, unit: it.unit, expDays: it.expDays, price: it.price, priceSrc: it.priceSrc, kbKey: it.kbKey, id: it.id });
          }
        });
      });
      var libs = q ? db.libraries.filter(function (l) { return l.name.toLowerCase().indexOf(q) > -1; }) : [];
      return Promise.resolve({ items: items, libs: libs });
    },

    /* ===== 设置 ===== */
    setTheme: function (theme) {
      return sleep().then(function () { db.theme = theme; save(); return db; });
    },
    setSetting: function (key, val) {
      return sleep().then(function () { db.settings[key] = val; save(); return db; });
    },
    setBudget: function (n) {
      return sleep().then(function () {
        guard();
        db.budget = Math.max(0, parseFloat(n) || 0);
        pushLog("setting", "月度预算调整为 ¥" + db.budget + "（D6）");
        save();
        return db.budget;
      });
    },
    setProfile: function (p) {
      return sleep().then(function () {
        db.profile = Object.assign(db.profile || {}, p); /* 仅本地（P0-4），sync payload 不含 */
        save();
        return db.profile;
      });
    },
    toggleDaily: function (id) {
      return sleep().then(function () {
        var t = db.daily.filter(function (x) { return x.id === id; })[0];
        if (t) t.done = !t.done;
        save();
        return db;
      });
    },

    /* ===== 管理员端（F10） ===== */
    adminLogin: function (phone, code) {
      return sleep().then(function () {
        if (code !== "123456") throw new Error("验证码错误（演示码 123456）");
        var u = db.users.filter(function (x) { return x.phone === phone; })[0];
        if (!u) throw new Error("账号不存在");
        if (u.disabled) throw new Error("该账号已被禁用");
        if (u.role !== "管理员") throw new Error("无管理员权限（F10 需管理员角色）");
        db.user = { name: u.name, phone: u.phone, role: u.role, initial: u.name.charAt(0) };
        pushLog("auth", u.name + " 登录管理员端");
        save();
        return db.user;
      });
    },
    userSetDisabled: function (phone, disabled) {
      return sleep().then(function () {
        var u = db.users.filter(function (x) { return x.phone === phone; })[0];
        if (!u) throw new Error("用户不存在");
        u.disabled = !!disabled;
        pushLog("admin", (disabled ? "禁用" : "启用") + "用户 " + u.name + "（F10.1）");
        save();
        return u;
      });
    },
    setConfig: function (patch) {
      return sleep().then(function () {
        Object.assign(db.config, patch);
        pushLog("admin", "更新系统配置：" + Object.keys(patch).join("、"));
        save();
        return db.config;
      });
    },
    knowledgePublish: function () {
      return sleep().then(function () {
        db.knowledge = {
          foods: JSON.parse(JSON.stringify(window.KB.foods)),
          recipes: JSON.parse(JSON.stringify(window.KB.recipes)),
          rules: JSON.parse(JSON.stringify(window.KB.rules))
        };
        db.config.knowledgeVersion = (db.config.knowledgeVersion || 1) + 1;
        pushLog("admin", "发布知识库 v" + db.config.knowledgeVersion + "（F10.4）");
        save();
        return db.config.knowledgeVersion;
      });
    },
    aiUsageList: function () { return Promise.resolve(db.aiUsage); },
    logAiUsage: function (route, ms, model, extra) { aiLog(route, model || (db.config && db.config.model) || "agnes-2.5-flash", ms, extra); },

    /* ===== 知识库管理（F10.4）：草稿保存与版本发布，发布后启动时回放 ===== */
    knowledgeSaveDraft: function () {
      return sleep().then(function () {
        db.knowledge = {
          foods: JSON.parse(JSON.stringify(window.KB.foods)),
          recipes: JSON.parse(JSON.stringify(window.KB.recipes)),
          rules: JSON.parse(JSON.stringify(window.KB.rules))
        };
        save();
        return db.knowledge;
      });
    }
  };
})();
