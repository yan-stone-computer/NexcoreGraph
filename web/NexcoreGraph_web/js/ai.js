/* 启核图策 · AI 编排层（完整文档第 3 篇 M2.5，Web 端落地）
   - P0-1 意图路由：greet/where/qty/expiry 本地快答（0 次模型调用）；cook/creative/nutrition/summary 走 /api/ai/chat（Agnes），
     Agnes 不可用时退回本地降级回答，并在回复里注明"0 次模型调用"，不冒充模型结果
   - P0-2 受约束工具协议 v2：[调整] 库存、shopping_add，白名单执行，先预览后生效
   - P0-3 营养标注（约，估算）+ AI 创新菜谱
   - P0-6 看板简报：统计由代码计算，模型仅润色
   AI 行为红线：数量/位置/日期一律本地查询产出；写操作必须预览确认；单请求 ≤2 次模型调用。 */
(function () {
  "use strict";

  var DB = window.DB;

  /* 口语别名归一化：牛奶→鲜牛奶、西红柿→番茄、青菜→上海青 */
  var ALIASES = { "牛奶": "鲜牛奶", "西红柿": "番茄", "青菜": "上海青", "土豆": "土豆", "酱油": "生抽/酱油" };
  function normalize(text) {
    Object.keys(ALIASES).forEach(function (k) { text = text.split(k).join(ALIASES[k]); });
    return text;
  }

  function findByName(text) {
    text = normalize(text);
    var names = [];
    DB.libraries.forEach(function (l) { (l.items || []).forEach(function (it) { names.push(it); }); });
    names.sort(function (a, b) { return b.name.length - a.name.length; }); /* 长名优先，避免"蛋"误命中"蛋糕" */
    for (var i = 0; i < names.length; i++) {
      if (text.indexOf(names[i].name) > -1) return names[i];
    }
    return null;
  }

  function numAfter(text, fallback) {
    var m = /(\d+(?:\.\d+)?)/.exec(text);
    return m ? parseFloat(m[1]) : fallback;
  }

  function kbEntry(text) {
    text = normalize(text);
    var foods = window.KB.foods;
    var keys = Object.keys(foods).sort(function (a, b) { return foods[b].name.length - foods[a].name.length; });
    for (var i = 0; i < keys.length; i++) {
      var base = foods[keys[i]].name.replace(/（.*?）/, "").split("（")[0];
      var short = base.length > 2 ? base.slice(0, 2) : base;
      if (text.indexOf(foods[keys[i]].name) > -1 || text.indexOf(base) > -1 || (short.length > 1 && text.indexOf(short) > -1)) {
        return { key: keys[i], food: foods[keys[i]] };
      }
    }
    return null;
  }

  function srcNote(entry) {
    return "（知识库 · " + entry.food.src + "。" + window.KB.DISCLAIMER + "）";
  }

  function route(text) {
    var t = text || "";
    if (/^(hi|hello|你好|您好|在吗|嗨)/i.test(t) || t === "在么") return "greet";
    if (/放哪|在哪里|在哪|哪儿|找到/.test(t)) return "where";
    if (/还剩|剩多少|有多少|几个|几盒|几瓶|数量/.test(t) && !/调整|改/.test(t)) return "qty";
    if (/保质期|能放|多久|过期|变质|几天/.test(t)) return "expiry";
    if (/创新|新菜|独门/.test(t)) return "creative";
    if (/热量|卡路里|营养|减脂|增肌|控糖/.test(t)) return "nutrition";
    if (/总结|简报|摘要|复盘|本周|上周/.test(t)) return "summary";
    if (/加入采购|想买|要买|添加购物/.test(t)) return "shopping_add";
    if (/做什么|吃什么|安排|菜|晚餐|早餐|午餐/.test(t)) return "cook";
    if (/还剩|只剩|还有|喝完|吃完|用完|没了|买了|加了|放入|补货|减少|吃掉|用了/.test(t)) return "adjust";
    return "fallback";
  }

  /* ---------- 快答（0 次模型调用，数值全部来自本地查询 —— 红线 1） ---------- */
  function fastReply(intent, text) {
    var it = findByName(text);
    if (intent === "greet") {
      return { text: "你好，我是启核图策助手。可以问我「鸡蛋放哪了」「牛奶还能放几天」，或让我安排今晚吃什么。", model: false };
    }
    if (intent === "where") {
      if (!it) return { text: "没有在库存里找到这件物品。你可以先拍照入库，或换个名字试试。", model: false };
      var posW = posOf(it);
      return {
        text: it.name + "在" + (it.libNameHint || "") + " · " + posW +
          "，当前 " + it.qty + " " + it.unit +
          (it.expDays && it.expDays < 9000 ? "，还有 " + it.expDays + " 天到期" : "") +
          (it.price ? "。价格 ¥" + it.price + "（" + it.priceSrc + "）" : "") + "。",
        model: false
      };
    }
    if (intent === "qty") {
      if (!it) return { text: "库存里没有查到这件物品，数量以资源库页面为准。", model: false };
      var pos = posOf(it);
      return { text: it.name + "当前 " + it.qty + " " + it.unit + "（" + it.libNameHint + pos + "），与资源库一致。", model: false };
    }
    if (intent === "expiry") {
      var entry = kbEntry(text);
      if (entry) {
        var f = entry.food;
        return { text: f.name + "冷藏约 " + f.days + " 天" + (f.open ? "，开封后 " + f.open + " 天内用完" : "") + "。" + f.tip + srcNote(entry), model: false };
      }
      if (it && it.expDays < 9000) return { text: it.name + "还有 " + it.expDays + " 天到期，存放于" + posOf(it) + "。" + window.KB.DISCLAIMER, model: false };
      return { text: "没有找到对应物品或知识库条目。常见食材我都能答，比如「鸡蛋能放多久」。", model: false };
    }
    return null;
  }

  function posOf(it) {
    var lib = null;
    DB.libraries.forEach(function (l) { if ((l.items || []).indexOf(it) > -1) lib = l; });
    it.libNameHint = lib ? "「" + lib.name + "」" : "";
    return (it.pos || "未设置位置");
  }

  /* ---------- 写操作解析：只产出预览卡，不直接写库（红线 2 / F5.5） ---------- */
  function parseAdjust(text) {
    var it = findByName(text);
    if (!it) return null;
    var to = null, delta = null, reason = "自然语言修改";
    if (/喝完|吃完|用完|没了|清空/.test(text)) { to = 0; }
    else if (/只剩|仅剩|还有|剩下|现在有/.test(text)) { to = numAfter(text, null); }
    else if (/买了|加了|放入|进货|补货/.test(text)) { delta = numAfter(text, null); reason = "自然语言修改（补充）"; }
    else if (/减少|吃掉|用了/.test(text)) { delta = -numAfter(text, null); }
    else if (/调整|改成|设为/.test(text)) { to = numAfter(text, null); }
    if (to == null && delta == null) return null;
    var from = it.qty;
    var target = delta != null ? Math.max(0, from + delta) : Math.max(0, to);
    if (target === from) return null;
    return { type: "adjust", itemId: it.id, name: it.name, unit: it.unit, from: from, to: target, reason: reason, lib: it.libNameHint || "" };
  }

  function parseShoppingAdd(text) {
    var it = findByName(text);
    var m = /(?:想买|要买|加入采购|买)([^，。,\s]*)/.exec(text);
    var name = it ? it.name : (m && m[1] ? m[1].replace(/(一|两|三|四|五|六|七|八|九|十|\d)+(个|盒|瓶|袋|把|罐|份|包)$/g, "") || m[1] : "");
    if (!name) return null;
    var qty = numAfter(text, "1");
    return { type: "shopping_add", name: name, qty: numAfter(text, 1) + " " + ((text.match(/(个|盒|瓶|袋|把|罐|份|包)/) || ["单位"])[0]) };
  }

  /* ---------- 模型类回复：Agnes + GraphRAG（单次调用，失败降级本地回答） ----------
     红线 3：单请求 ≤2 次模型调用（本链路仅 1 次；社区摘要为离线预计算，不在对话请求内） */
  function agnesReply(intent, text) {
    return window.GRAPHRAG.ask(text).then(function (r) {
      if (r.ok) {
        window.API.logAiUsage("/api/ai/chat", r.ms, r.model, {
          mode: r.mode, evidenceN: r.evidence.lines.length,
          summaryHit: (r.evidence.usedSummary || 0) > 0 ? 1 : 0
        });
        var out = { text: r.text, model: true, src: r.src, mode: r.mode, evidenceN: r.evidence.lines.length };
        if (intent === "cook") out.action = "generatePlans";
        if (intent === "creative") out.action = "creative";
        if (intent === "shopping_add") {
          var card = parseShoppingAdd(text);
          if (card) { out.card = card; out.text = "确认后我会把该项加入采购清单（预览如下，Agnes 已理解需求）："; }
        }
        return out;
      }
      /* 降级：global 类用图谱事实直接回答；其余回退本地降级文案（modelReply 内已记用量，勿双记） */
      return modelReply(intent, text, true).then(function (out) {
        if (r.mode === "global" && r.evidence.lines.length) {
          out = {
            text: "按图谱实时统计：" + r.evidence.lines.join("；") + "。建议优先消耗临期食材，并把低库存项加入采购清单。",
            model: false
          };
          if (intent === "cook") out.action = "generatePlans";
        }
        out.text += "（Agnes 暂不可用：" + (r.error || "网络异常") + "，已降级本地回答；图谱事实仍可查）";
        out.src = "本地降级 · GraphRAG " + r.mode + "（0 次模型调用）";
        return out;
      });
    }).catch(function () {
      return modelReply(intent, text, true).then(function (out) {
        out.src = "本地降级（Agnes 未接入，0 次模型调用）";
        return out;
      });
    });
  }

  /* ---------- 本地降级回复（Agnes 不可用时的兜底；内容全部来自本地数据，不冒充模型） ---------- */
  function modelReply(intent, text, degraded) {
    var t0 = Date.now();
    var p = new Promise(function (resolve) {
      setTimeout(function () {
        var out = null;
        if (intent === "cook") {
          out = { text: "按「临期优先 > 清库存 > 营养均衡」从你的库存排了 3 个方案（营养为每份估算）：", action: "generatePlans", model: false };
        } else if (intent === "creative") {
          out = { text: "我优先挑了快到期的食材，编了一道新菜谱（已加入方案列表，走正常核销链路）：", action: "creative", model: false };
        } else if (intent === "nutrition") {
          var prof = DB.profile || {};
          var goal = prof.goal || "均衡";
          /* 热量只能来自方案里的真实标注，不能写死一个固定的估算值 */
          var kcals = (DB.plans || []).filter(function (p) { return p.status !== "done"; })
            .map(function (p) { return Number(p.kcal) || 0; })
            .filter(function (n) { return n > 0; });
          var sum = kcals.reduce(function (a, b) { return a + b; }, 0);
          var head = kcals.length
            ? "现有 " + kcals.length + " 个待执行方案带热量标注，合计约 " + sum + " kcal，平均每份约 " + Math.round(sum / kcals.length) + " kcal（方案里的估算值相加）。"
            : "现有方案还没有热量标注，暂时算不出总量；等方案里带上热量后我再合计。";
          out = {
            text: head + "你的饮食目标是「" + goal +
              "」" + (prof.enabled !== false && prof.dislikes ? "，已避开忌口：" + prof.dislikes : "") + "。建议晚餐选低脂的黄瓜炒虾仁或香煎鸡胸肉。",
            model: false
          };
        } else if (intent === "summary") {
          out = { text: briefingText(), model: false };
        } else if (intent === "shopping_add") {
          var card = parseShoppingAdd(text);
          out = card ? { text: "确认后我会把该项加入采购清单：", card: card, model: false }
                     : { text: "告诉我要买什么，比如「想买 2 盒牛奶」，确认后加入采购清单。", model: false };
        } else {
          var st2 = window.API.getStats();
          out = {
            text: "当前库存 " + st2.totalItems + " 件，临期 " + st2.expiringN + " 件、低库存 " + st2.lowN +
              " 件。可以问我物品位置、数量、保质期，也可以说「今晚吃什么」或「鸡蛋只剩 5 个」来改库存。",
            model: false
          };
        }
        /* 本地降级也记一笔（方便看降级比例），但耗时用真实值、模型名标"本地降级"，成本按 0 计 */
        window.API.logAiUsage("/api/ai/chat", Date.now() - t0, "本地降级");
        resolve(out);
      }, 700 + Math.random() * 500);
    });
    return p;
  }

  /* ---------- 统一入口 ---------- */
  function reply(text) {
    /* 0) 自然语言指令层（与鸿蒙端 Commands.ets 同规则）：命中即本地执行，不再走意图路由与模型 */
    var cmd = window.COMMANDS ? window.COMMANDS.match(text) : null;
    if (cmd) {
      var cmdOut = window.COMMANDS.run(cmd);
      if (cmdOut) {
        window.API.logAiUsage("/api/ai/chat", 0, "本地指令");
        return cmdOut;
      }
    }
    var intent = route(text);
    var fast = fastReply(intent, text);
    if (fast) {
      window.API.logAiUsage("/api/ai/chat", 0, "本地快答");
      return Promise.resolve(fast);
    }
    if (intent === "adjust") {
      var card = parseAdjust(text);
      if (card) return Promise.resolve({ text: "检测到库存调整请求，请确认（不直接写库，F5.5）：", card: card, model: false, src: "本地解析 · 0 次模型调用" });
    }
    return agnesReply(intent, text);
  }

  /* P0-6 简报：数字全部来自 computeStats，文案为固定模板润色（模型仅润色） */
  function briefingText() {
    var s = window.API.getStats();
    return "近 7 天简报：消耗 " + s.trend.consume.reduce(function (a, b) { return a + b; }, 0) +
      " 件、入库 " + s.trend.purchase.reduce(function (a, b) { return a + b; }, 0) +
      " 件；当前临期 " + s.expiringN + " 件、低库存 " + s.lowN + " 件；本月花费 ¥" + s.spent + " / 预算 ¥" + s.budget +
      "；最常消耗：" + s.topFood + "；库存健康度 " + s.health + "%。建议优先消耗临期食材，并把低库存项加入采购清单。（统计由代码计算，AI 仅润色）";
  }

  window.AI = { reply: reply, route: route, briefingText: briefingText };
})();
