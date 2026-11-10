/* 启核图策 · 自然语言指令层（Web 端）

   与鸿蒙端 common/Commands.ets 同一套规则：确定性解析（正则命中，不调模型），
   命中即本地执行；只有"读"型指令直接作答，"写"型指令先出确认卡再落库（红线 2）。
   命中不了的句子才交给 ai.js 的意图路由 / 模型链路，所以这里必须"具体在前、宽泛在后"。
   指令手册（CMD_HELP）是 AI 面板里展示的那份，改实现时同步改这里。 */
(function () {
  "use strict";

  var CMD_GROUPS = ["看一眼库存", "建库与改名", "物品增减与移动", "采购与方案", "多端与设置"];

  var CMD_HELP = [
    ["看一眼库存", "库存里都有什么", "列出每个库和件数，本地算，不调模型"],
    ["看一眼库存", "牛奶还剩多少", "原样回库存里的数量"],
    ["看一眼库存", "牛奶放在哪", "回库位（库 · 位置）"],
    ["看一眼库存", "牛奶还能放几天", "有保质期的回天数，衣物工具这类回“没有保质期”"],
    ["看一眼库存", "搜一下螺丝刀", "跨库搜名称与库位"],
    ["看一眼库存", "打开资源库", "也能说：打开首页 / 工作台 / 我的 / 数据分析 / 知识图谱 / 采购清单"],

    ["建库与改名", "帮我建一个工具箱库", "库名随你定，冰箱、衣柜、厨具柜一样建"],
    ["建库与改名", "把药盒改名叫急救箱", "改名后会问一次确认"],
    ["建库与改名", "删掉零食柜", "删库前先确认，删完还有撤销"],

    ["物品增减与移动", "往工具箱加一把螺丝刀", "数量单位都能带：两瓶、三袋、五盒"],
    ["物品增减与移动", "鸡蛋还剩 5 个", "直接改数量（消耗、补货都这么说）"],
    ["物品增减与移动", "把炒锅移到厨具柜", "跨库搬家，数量位置一起带走"],
    ["物品增减与移动", "删掉炒锅", "删物品前先确认，删完还有撤销"],

    ["采购与方案", "把牛奶加进采购清单", "缺什么一句话写进清单"],
    ["采购与方案", "生成方案", "按库存和临期重新排方案"],
    ["采购与方案", "执行清蒸鲈鱼", "按方案里的用料扣库存，可撤销"],
    ["采购与方案", "鸡蛋的提醒处理掉", "把这条临期提醒核销掉"],

    ["多端与设置", "创建协作池", "拿到 6 位邀请码，家人用码加入"],
    ["多端与设置", "加入协作池 ABC123", "换成实际邀请码"],
    ["多端与设置", "换成深色主题", "也能说：换回浅色主题 / 换成经典橙色板"],
    ["多端与设置", "备份到本机后端", "把本机数据推到自建后端"],
    ["多端与设置", "从本机后端拉取", "用后端快照覆盖本机"]
  ];

  function norm(q) {
    return String(q || "").replace(/[\s，。！？、,.!?]/g, "").trim();
  }

  /* 页面词 → Web 端落点（视图 id 或浮层类型） */
  function pageTarget(word) {
    if (word === "首页") return "dashboard";
    if (word === "资源库") return "libraries";
    if (word === "工作台") return "workbench";
    if (word === "我的" || word === "设置") return "settings";
    if (word === "数据分析" || word === "看板") return "dashboard";
    if (word === "知识图谱" || word === "资源图谱" || word === "图谱") return "graph";
    if (word === "采购清单" || word === "购物清单") return "shopping";
    if (word === "提醒" || word === "预警") return "alerts";
    if (word === "方案") return "plans";
    if (word === "搜索") return "search";
    if (word === "流转") return "flow";
    return "";
  }

  /** AI 打开对应界面（复用页面已有的视图按钮与浮层按钮，不新增入口） */
  function gotoView(target) {
    var el = document.querySelector('[data-view="' + target + '"]');
    if (el) { el.click(); return true; }
    var ov = document.querySelector('[data-action="overlay:open"][data-type="' + target + '"]');
    if (ov) { ov.click(); return true; }
    return false;
  }

  /* ---------- 命中：确定性解析，按"具体在前、宽泛在后"排 ---------- */
  function matchCommand(q) {
    var s = norm(q);
    if (s === "") return null;
    var m = null;

    if (/^(指令|指令手册|帮助|手册|怎么用|能做什么|能说什么|能干什么|help)$/.test(s)) return mk("help", "", "", 0, q);
    if (/^(库存|家里|柜子|库).{0,2}(都)?有(什么|啥|哪些)/.test(s) || /^(看看|查看)?(我的)?(全部)?库存$/.test(s)) return mk("list", "", "", 0, q);
    m = /^(?:打开|进入|切到|去|看看)(首页|资源库|工作台|我的|设置|数据分析|看板|知识图谱|资源图谱|图谱|采购清单|购物清单|提醒|预警|方案|搜索|流转)$/.exec(s);
    if (m && pageTarget(m[1]) !== "") return mk("open", pageTarget(m[1]), m[1], 0, q);
    m = /^(?:搜|搜索|搜一下|找|找一下|找找|查|查一下)(.+)$/.exec(s);
    if (m) return mk("search", m[1], "", 0, q);
    m = /^(?:帮我|请|给我)?(?:新建|创建|建|加)(?:一个|个)?(.{1,10}?)(?:库|柜)$/.exec(s);
    if (m) return mk("newlib", m[1], "", 0, q);
    m = /^(?:把|帮我把)?(.{1,10}?)(?:库|柜)?(?:改名|重命名|改叫|改称|改为|改成)(.{1,10})$/.exec(s);
    if (m) return mk("renamelib", m[1], m[2], 0, q);
    m = /^(?:把|帮我把)?(.{1,10}?)(?:库|柜)(?:删掉|删除|移除了?|去掉|不要了)$/.exec(s);
    if (m) return mk("dellib", m[1], "", 0, q);
    m = /^(?:删掉|删除|移除|去掉)(.{1,10}?)(?:库|柜)$/.exec(s);
    if (m) return mk("dellib", m[1], "", 0, q);
    m = /^(?:把|给|往|向|在)(.{1,10}?)(?:库|柜)?(?:里|中)?(?:加|添加|新增|放|记)(?:上|一下)?(.{1,16})$/.exec(s);
    /* 「加进采购清单」比「往某库加东西」更具体，必须排在前面，否则会被 additem 抢走 */
    m = /^(?:把|给)?(.{1,12}?)(?:加|写|放)(?:进|到|入)(?:采购|购物|购买)?清单$/.exec(s);
    if (m) return mk("shopadd", m[1], "", 0, q);
    m = /^(?:把|给|往|向|在)(.{1,10}?)(?:库|柜)?(?:里|中)?(?:加|添加|新增|放|记)(?:上|一下)?(.{1,16})$/.exec(s);
    if (m) return mk("additem", m[1], m[2], 0, q);
    m = /^新增(.{1,16})到(.{1,10}?)(?:库|柜)?$/.exec(s);
    if (m) return mk("additem", m[2], m[1], 0, q);
    m = /^(?:把|帮我把)?(.{1,12}?)(?:移|挪|搬|换|放)(?:到|去)(.{1,10}?)(?:库|柜)?$/.exec(s);
    if (m) return mk("moveitem", m[1], m[2], 0, q);
    m = /^(.{1,12}?)(?:还能放几天|保质期多久|还有几天到期|什么时候过期)$/.exec(s);
    if (m) return mk("expiry", m[1], "", 0, q);
    m = /^(.{1,12}?)(?:放在哪|放哪|搁哪|在哪儿|位置在哪)$/.exec(s);
    if (m) return mk("where", m[1], "", 0, q);
    m = /^(.{1,12}?)(?:还剩|只剩|还有|剩|现有|改成|设为)(\d+)(.{0,3})$/.exec(s);
    if (m) return mk("qty", m[1], m[3], parseInt(m[2], 10), q);
    if (/^(重新)?生成(新)?方案$/.test(s)) return mk("plangen", "", "", 0, q);
    m = /^执行(?:方案)?(.{1,14})$/.exec(s);
    if (m) return mk("planrun", m[1], "", 0, q);
    m = /^(.{1,12}?)(?:的)?(?:提醒|预警|临期提醒)(?:我)?(?:处理|解决|核销|清)(?:掉|了)?$/.exec(s);
    if (m) return mk("alertdone", m[1], "", 0, q);
    if (/^(?:创建|新建|开|建)(?:一个)?(?:协作池|协作|拼菜池|拼菜|牌桌)$/.test(s)) return mk("coopcreate", "", "", 0, q);
    m = /^加入(?:协作池|拼菜池)?([A-Za-z0-9]{4,8})$/.exec(s);
    if (m) return mk("coopjoin", m[1].toUpperCase(), "", 0, q);
    m = /^用([A-Za-z0-9]{4,8})加入(?:协作池|拼菜池)?$/.exec(s);
    if (m) return mk("coopjoin", m[1].toUpperCase(), "", 0, q);
    m = /^(?:切换|换|改|调)(?:成|为|到|回|至)?(深色|暗色|夜间|深色模式|浅色|亮色|白天|浅色模式|日间)(?:主题|模式|色)?$/.exec(s);
    if (m) {
      var dark = ["深色", "暗色", "夜间", "深色模式"].indexOf(m[1]) > -1;
      return mk("theme", dark ? "dark" : "light", m[1], 0, q);
    }
    m = /^(?:切换|换|改|调)(?:主题|色板)?(?:成|为|到|回|至)?(经典橙|启核绿青蓝|启核|绿青蓝|青蓝)(?:色板|主题)?$/.exec(s);
    if (m) return mk("palette", m[1] === "经典橙" ? "classic" : "nexcore", m[1], 0, q);
    if (/^(?:备份|上传)(?:到本机后端|到后端|数据|一下)?$/.test(s) || /^保存到后端$/.test(s)) return mk("backupup", "", "", 0, q);
    if (/^(?:从本机后端)?(?:拉取|恢复|下载)(?:备份|数据|快照|一下)?$/.test(s)) return mk("backupdown", "", "", 0, q);
    m = /^(?:把|帮我把)?(.{1,12}?)(?:删掉|删除|移除了?|去掉|不要了)$/.exec(s);
    if (m) return mk("delitem", m[1], "", 0, q);
    m = /^(?:删掉|删除|移除|去掉)(.{1,12})$/.exec(s);
    if (m) return mk("delitem", m[1], "", 0, q);
    return null;
  }

  function mk(id, a, b, n, raw) {
    return { id: id, a: a, b: b, n: n, raw: raw };
  }

  /* ---------- 本地查询辅助 ---------- */
  function libs() { return (window.DB && window.DB.libraries) || []; }
  function allItems() {
    var out = [];
    libs().forEach(function (l) {
      (l.items || []).forEach(function (it) { out.push({ it: it, lib: l }); });
    });
    return out;
  }
  function findItem(name) {
    var n = String(name || "").trim();
    if (!n) return null;
    var exact = null, loose = null;
    allItems().forEach(function (row) {
      if (exact) return;
      if (row.it.name === n) exact = row;
      else if (!loose && (row.it.name.indexOf(n) > -1 || n.indexOf(row.it.name) > -1)) loose = row;
    });
    return exact || loose;
  }
  function findLib(name) {
    var n = String(name || "").trim();
    if (!n) return null;
    var exact = null, loose = null;
    libs().forEach(function (l) {
      if (exact) return;
      if (l.id === n || l.name === n || l.name === n + "库" || l.name === n + "柜") exact = l;
      else if (!loose && (l.name.indexOf(n) > -1 || n.indexOf(l.name) > -1)) loose = l;
    });
    return exact || loose;
  }
  function unitOf(text) {
    var m = /(个|只|把|瓶|袋|盒|包|箱|件|根|条|张|块|斤|公斤|克|升|毫升|罐|份|台|副|双)/.exec(String(text || ""));
    return m ? m[1] : "个";
  }

  function helpText() {
    var lines = ["我认识的指令（命中就本地执行，0 次模型调用）："];
    CMD_GROUPS.forEach(function (g) {
      lines.push("【" + g + "】");
      CMD_HELP.filter(function (r) { return r[0] === g; }).forEach(function (r) {
        lines.push("· " + r[1] + "　—　" + r[2]);
      });
    });
    return lines.join("\n");
  }

  function ok(text, note) {
    return Promise.resolve({ text: text, model: false, src: note || "本地指令 · 0 次模型调用" });
  }
  function need(kind, arg, label, text) {
    return Promise.resolve({
      text: text,
      model: false,
      src: "本地指令 · 0 次模型调用",
      card: { type: "cmd", opKind: kind, opArg: arg, opLabel: label }
    });
  }

  /* ---------- 执行 ---------- */
  function run(m) {
    var API = window.API;
    switch (m.id) {
      case "help":
        return ok(helpText(), "本地指令手册 · 0 次模型调用");

      case "list": {
        if (libs().length === 0) return ok("还没有库。说一句「帮我建一个冰箱库」就能开始，或者直接拍照入库。");
        var lines = [], total = 0, soon = 0;
        libs().forEach(function (l) {
          total += (l.items || []).length;
          (l.items || []).forEach(function (it) { if (it.expDays > 0 && it.expDays <= 7) soon += 1; });
          var names = (l.items || []).slice(0, 6).map(function (it) { return it.name + " " + it.qty + (it.unit || "个"); });
          var more = (l.items || []).length > 6 ? " 等 " + l.items.length + " 件" : "";
          lines.push(names.length === 0 ? l.name + "：空" : l.name + "（" + l.items.length + " 件）：" + names.join("、") + more);
        });
        return ok("共 " + libs().length + " 个库、" + total + " 件物品，其中临期 " + soon + " 件。\n" + lines.join("\n"));
      }

      case "qty": {
        var row = findItem(m.a);
        if (!row) return ok("库存里没有「" + m.a + "」，先在「资源库」里加一件？");
        if (m.n > 0) {
          return need("qty", JSON.stringify({ name: row.it.name, to: m.n, unit: m.b || row.it.unit || "个" }),
            row.it.name + " → " + m.n + (m.b || row.it.unit || "个"),
            "确认后我把「" + row.it.name + "」改成 " + m.n + (m.b || row.it.unit || "个") + "（当前 " + row.it.qty + (row.it.unit || "个") + "，不直接写库）。");
        }
        return ok("「" + row.it.name + "」现在还有 " + row.it.qty + (row.it.unit || "个") + "（" + row.lib.name + "）。");
      }

      case "where": {
        var w = findItem(m.a);
        if (!w) return ok("没找到「" + m.a + "」。");
        return ok("「" + w.it.name + "」在「" + w.lib.name + "」的 " + (w.it.pos || "未填位置") + "。");
      }

      case "expiry": {
        var e = findItem(m.a);
        if (!e) return ok("没找到「" + m.a + "」。");
        if (!e.it.expDays || e.it.expDays <= 0) return ok("「" + e.it.name + "」这类没有保质期记录。");
        return ok("「" + e.it.name + "」还有 " + e.it.expDays + " 天到期。");
      }

      case "search":
        if (!API || !API.search) return ok("搜索暂不可用。");
        return API.search(m.a).then(function (r) {
          var hit = (r && (r.items || r.results)) || [];
          if (!hit.length) return { text: "没搜到「" + m.a + "」。", model: false, src: "本地搜索 · 0 次模型调用" };
          var t = hit.slice(0, 8).map(function (x) {
            return "· " + (x.item ? x.item.name : x.name) + "　" + (x.libName || x.lib || "");
          }).join("\n");
          return { text: "搜到 " + hit.length + " 条：\n" + t, model: false, src: "本地搜索 · 0 次模型调用" };
        });

      case "open": {
        var viewGo = gotoView(m.a);
        return ok(viewGo ? "已打开「" + m.b + "」。" : "这一端还没有「" + m.b + "」页面。");
      }

      case "newlib":
        return need("newlib", m.a, "新建库「" + m.a + "」", "确认后新建资源库「" + m.a + "」。");

      case "renamelib":
        return need("renamelib", JSON.stringify({ from: m.a, to: m.b }), "「" + m.a + "」→「" + m.b + "」",
          "确认后把「" + m.a + "」改名为「" + m.b + "」（改名前的物品与位置都保留）。");

      case "dellib":
        return need("dellib", m.a, "删除库「" + m.a + "」", "确认后删除「" + m.a + "」（可撤销恢复）。");

      case "additem":
        return need("additem", JSON.stringify({ lib: m.a, name: m.b, unit: unitOf(m.b) }),
          m.a + " 加 " + m.b, "确认后往「" + m.a + "」加一件「" + m.b + "」。");

      case "moveitem":
        return need("moveitem", JSON.stringify({ name: m.a, to: m.b }), m.a + " → " + m.b,
          "确认后把「" + m.a + "」搬到「" + m.b + "」。");

      case "delitem":
        return need("delitem", m.a, "删除「" + m.a + "」", "确认后删除「" + m.a + "」（可撤销恢复）。");

      case "shopadd":
        return need("shopadd", JSON.stringify({ name: m.a, qty: "适量" }), m.a + " 加入采购清单",
          "确认后把「" + m.a + "」加进采购清单。");

      case "plangen":
        if (!API || !API.generatePlans) return ok("方案生成暂不可用。");
        return API.generatePlans().then(function () {
          if (window.NXG_RENDER) window.NXG_RENDER();
          return { text: "已按「临期优先 > 清库存 > 营养均衡」重排方案，去「方案」里看。", model: false, src: "本地指令 · 0 次模型调用" };
        });

      case "planrun": {
        var p = (window.DB.plans || []).filter(function (x) { return (x.title || "").indexOf(m.a) > -1; })[0];
        if (!p) return ok("方案列表里没有「" + m.a + "」，先说「生成方案」？");
        return need("planrun", p.id, "执行「" + p.title + "」", "确认后按「" + p.title + "」的用料扣库存（可撤销）。");
      }

      case "alertdone": {
        var al = ((window.DB.alerts) || []).filter(function (a) {
          return (a.name || "").indexOf(m.a) > -1 && !a.done;
        })[0];
        if (!al) return ok("没有「" + m.a + "」相关的待处理提醒。");
        return need("alertdone", al.id, "核销「" + al.name + "」提醒", "确认后把「" + al.name + "」这条提醒核销掉。");
      }

      case "coopcreate":
        return need("coopcreate", "", "创建协作池", "确认后创建协作池并生成 6 位邀请码。");

      case "coopjoin":
        return need("coopjoin", m.a, "加入 " + m.a, "确认后用邀请码 " + m.a + " 加入协作池。");

      case "theme":
        if (window.API && window.API.setTheme) {
          return API.setTheme(m.a).then(function () {
            if (window.NXG_APPLY_THEME) window.NXG_APPLY_THEME();
            return { text: "已切换为" + m.b + "主题。", model: false, src: "本地指令 · 0 次模型调用" };
          });
        }
        return ok("主题切换暂不可用。");

      case "palette":
        if (window.NXG_SET_PALETTE) {
          window.NXG_SET_PALETTE(m.a);
          return ok("已切换为「" + m.b + "」色板。");
        }
        return ok("色板切换暂不可用。");

      case "backupup":
        if (!API || !API.syncUpload) return ok("同步暂不可用。");
        return API.syncUpload().then(function (r) {
          return { text: "已备份到本机后端（v" + ((r && r.version) || (window.DB.syncVersion || 1)) + "）。", model: false, src: "本地指令 · 0 次模型调用" };
        }, function (e) {
          return { text: "备份失败：" + ((e && e.message) || "请检查后端是否在跑"), model: false, src: "本地指令" };
        });

      case "backupdown":
        if (!API || !API.syncDownload) return ok("同步暂不可用。");
        return API.syncDownload().then(function () {
          if (window.NXG_RENDER) window.NXG_RENDER();
          return { text: "已用后端快照覆盖本机数据。", model: false, src: "本地指令 · 0 次模型调用" };
        }, function (e) {
          return { text: "拉取失败：" + ((e && e.message) || "后端没有可用快照"), model: false, src: "本地指令" };
        });
    }
    return null;
  }

  /** 确认卡点了「确认生效」之后真正落库（写操作只在这里执行，红线 2） */
  function apply(opKind, opArg) {
    var API = window.API;
    var arg = {};
    try { arg = opArg ? JSON.parse(opArg) : {}; } catch (e) { arg = { value: opArg }; }
    var done = function (msg) {
      if (window.NXG_RENDER) window.NXG_RENDER();
      return Promise.resolve(msg);
    };
    switch (opKind) {
      case "newlib":
        return API.createLibrary(arg.value || opArg).then(function () { return done("已新建库「" + (arg.value || opArg) + "」。"); });
      case "renamelib": {
        var l1 = findLib(arg.from);
        if (!l1) return Promise.resolve("没找到这个库，可能已被改动。");
        return API.renameLibrary(l1.id, arg.to).then(function () { return done("已改名。"); });
      }
      case "dellib": {
        var l2 = findLib(opArg);
        if (!l2) return Promise.resolve("没找到这个库。");
        return API.deleteLibrary(l2.id).then(function () { return done("已删除库（可用「撤销最近操作」恢复）。"); });
      }
      case "additem": {
        var lib = findLib(arg.lib);
        if (!lib) return Promise.resolve("没找到「" + arg.lib + "」这个库。");
        return API.addItem({ libId: lib.id, name: arg.name, qty: 1, unit: arg.unit || "个" })
          .then(function () { return done("已加入「" + arg.name + "」。"); });
      }
      case "moveitem": {
        var row = findItem(arg.name);
        var to = findLib(arg.to);
        if (!row) return Promise.resolve("没找到「" + arg.name + "」。");
        if (!to) return Promise.resolve("没找到「" + arg.to + "」这个库。");
        return API.moveLibraryTo(row.lib.id, row.it.id, to.id)
          .then(function () { return done("已移到「" + to.name + "」。"); });
      }
      case "delitem": {
        var d = findItem(opArg);
        if (!d) return Promise.resolve("没找到「" + opArg + "」。");
        return API.deleteItem(d.lib.id, d.it.id).then(function () { return done("已删除（可撤销恢复）。"); });
      }
      case "qty": {
        var q = findItem(arg.name);
        if (!q) return Promise.resolve("没找到「" + arg.name + "」。");
        return API.updateItemQty(q.lib.id, q.it.id, arg.to).then(function () { return done("数量已改为 " + arg.to + "。"); });
      }
      case "shopadd":
        if (!API.shoppingAdd) return Promise.resolve("这一端还没有购物清单接口，请在「采购清单」里手加。");
        return API.shoppingAdd(arg.name, arg.qty || "适量").then(function () { return done("已加入采购清单。"); });
      case "planrun":
        return API.executePlan(opArg).then(function () { return done("已按方案扣减库存（可撤销）。"); });
      case "alertdone":
        return API.resolveAlert(opArg).then(function () { return done("提醒已核销。"); });
      case "coopcreate":
        if (!API.createCoop) return Promise.resolve("协作池接口暂不可用。");
        return API.createCoop().then(function () { return done("协作池已创建，邀请码在「协作工作台」。"); });
      case "coopjoin":
        if (!API.joinCoop) return Promise.resolve("协作池接口暂不可用。");
        return API.joinCoop(opArg).then(function () { return done("已加入协作池。"); });
    }
    return Promise.resolve("这条指令没法执行（未知操作）。");
  }

  window.COMMANDS = {
    GROUPS: CMD_GROUPS,
    HELP: CMD_HELP,
    match: matchCommand,
    run: run,
    apply: apply,
    helpText: helpText
  };
})();
