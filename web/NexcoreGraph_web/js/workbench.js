/* 启核图策 · AI 工作台（Web 默认首屏，方案 8.3 W-A1 / WX1-WX2）
   - 摘要条（社区摘要 + 代码统计，stale 标注）+ 待确认队列 + 图谱入口 + 常驻对话 + 数据段
   - AI 主体化：主动事项来自图谱事件（临期/低库存/每日清单），数值全部代码产出（红线 1）
   - 对话与 ai-ball 共用 DB.chat 与 window.AI.reply；本页内嵌挂载，独立管理 typing 态 */
(function () {
  "use strict";

  var typing = false;
  var summaryJobStarted = false;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }

  function greetWord() {
    var h = new Date().getHours();
    return h < 6 ? "夜深了" : h < 12 ? "早上好" : h < 18 ? "下午好" : "晚上好";
  }

  /* ---------- 摘要条（WX2：社区摘要 + 代码统计，标注生成时间） ---------- */
  function summaryBar() {
    var G = window.GRAPH;
    var doc = G.ensure();
    var st = window.API.getStats();
    var top = doc.communities.filter(function (c) { return c.level === 1; }).sort(function (a, b) { return b.stats.expiring - a.stats.expiring; })[0];
    var s = top ? doc.summaries.filter(function (x) { return x.community === top.id; })[0] : null;
    var fresh = s && !s.stale;
    var mins = s ? Math.max(1, Math.round((Date.now() - s.generatedAt) / 60000)) : 0;
    return (
      '<div class="card wb-summary">' +
      '<div class="wb-summary-main">' +
      '<div class="wb-summary-kicker">✦ AI 摘要 · ' + (top ? "「" + esc(top.label) + "」社区" : "全库") + "</div>" +
      (fresh
        ? '<p class="wb-summary-text">' + esc(s.text) + '<span class="wb-summary-age">（摘要基于 ' + mins + " 分钟前图谱 · " + esc(s.model || "agnes") + "）</span></p>"
        : '<p class="wb-summary-text">社区摘要离线预计算中（每社区 1 次调用、24h 更新、stale 不参与回答）。当前展示代码实时统计：' +
          "全库 " + st.totalItems + " 件 · 临期 " + st.expiringN + " 件 · 低库存 " + st.lowN + " 件 · 本月 ¥" + st.spent + " / 预算 ¥" + st.budget + '。</p><span class="wb-summary-age">（统计由代码计算 · AI 红线 1）</span>') +
      "</div>" +
      '<div class="wb-summary-side">' +
      '<button class="btn btn-soft btn-sm" data-wb-action="wb:summary-refresh">更新摘要</button>' +
      "</div></div>"
    );
  }

  /* ---------- 待确认队列（W-A4 简版：图谱事件 → 主动事项） ---------- */
  function queueHTML() {
    var DB = window.DB;
    var items = [];
    (DB.daily || []).slice(0, 3).forEach(function (t) {
      items.push({ key: "daily-" + t.id, text: t.text, done: t.done, kind: "今日优先", action: 'data-action="daily:check" data-id="' + t.id + '"' });
    });
    DB.alerts.filter(function (a) { return a.tone === "red"; }).slice(0, 3).forEach(function (a) {
      items.push({ key: a.id, text: a.text, kind: "紧急", action: 'data-action="alert:done" data-busy="alert" data-id="' + a.id + '"' });
    });
    var rows = items.slice(0, 5).map(function (it) {
      return (
        '<div class="wb-queue-item' + (it.done ? " done" : "") + '">' +
        '<span class="wb-queue-kind">' + it.kind + "</span>" +
        '<span class="wb-queue-text">' + esc(it.text) + "</span>" +
        (it.done ? '<span class="badge badge-success">已完成</span>' : '<button class="btn btn-ghost btn-sm" ' + it.action + ">" + (it.kind === "紧急" ? "已处理" : "完成") + "</button>") +
        "</div>"
      );
    }).join("");
    return (
      '<div class="card wb-queue-card">' +
      '<div class="card-head"><div><div class="card-title">待确认队列</div><div class="card-sub">AI 主动发起 · 来自图谱事件（临期跨越 / 阈值触发 / 每日清单）</div></div>' +
      '<span class="badge badge-amber">' + items.filter(function (i) { return !i.done; }).length + " 项待处理</span></div>" +
      (rows || '<div class="empty-sub" style="padding:12px 0">队列已清空，库存很健康</div>') +
      "</div>"
    );
  }

  /* ---------- 常驻对话（本页内嵌） ---------- */
  function chatListHTML() {
    var DB = window.DB;
    var msgs = (DB.chat || []).slice(-30).map(function (m) {
      var plans = "";
      if (m.plans && m.plans.length) plans = '<div class="plan-chip-row"><button class="btn btn-soft btn-sm" data-action="overlay:open" data-type="plans">📋 查看 ' + m.plans.length + " 个方案</button></div>";
      if (m.candidates && m.candidates.length) plans += '<div class="plan-chip-row"><button class="btn btn-soft btn-sm" data-action="nav:go" data-view="rescue">打开临期救援驾驶舱</button></div>';
      if (m.domain) plans += '<div class="plan-chip-row"><button class="btn btn-soft btn-sm" data-action="nav:go" data-view="domains">打开家庭智策</button></div>';
      var card = "";
      if (m.card && !m.card.done && !m.card.cancelled) {
        card = '<div class="chat-card"><div class="chat-card-row">' + esc(m.card.name) + "：" + (m.card.from != null ? m.card.from + " → " + m.card.to + " " + esc(m.card.unit || "") : esc(m.card.qty || "")) + '</div><div class="chat-card-actions"><span class="chat-card-title">写操作需确认后生效（F5.5）</span></div></div>';
      } else if (m.card && m.card.done) card = '<div><span class="badge badge-success">已生效</span></div>';
      return (
        '<div class="msg ' + (m.who === "me" ? "user" : "ai") + '">' +
        '<div class="msg-avatar ' + m.who + '">' + (m.who === "me" ? esc(DB.user.initial) : "✦") + "</div>" +
        '<div class="msg-body">' + esc(m.text) + card + plans + '<div class="msg-time">' + esc(m.time) + (m.who === "ai" ? ' · <span class="ai-tag">AI 生成</span>' + (m.src ? " · " + esc(m.src) : "") : "") + "</div></div></div>"
      );
    }).join("");
    return msgs + (typing ? '<div class="msg ai"><div class="msg-avatar ai">✦</div><div class="msg-body typing"><span class="typing-label">正在查图谱组织语言</span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>' : "");
  }

  function rescueEntryHTML(result) {
    var stats = result && result.stats || { expiringKinds: 0, paretoN: 0 };
    var top = result && result.candidates ? result.candidates.slice(0, 2) : [];
    return (
      '<div class="card wb-rescue-entry" id="wb-rescue-entry">' +
      '<div class="wb-rescue-copy"><div class="wb-summary-kicker">今晚先救哪几样</div>' +
      '<h2>把临期提醒变成一顿饭</h2>' +
      '<p>' + stats.expiringKinds + ' 种临期食材进入求解，当前有 ' + stats.paretoN + ' 个非支配候选。' +
      (top.length ? ' 优先考虑：' + top.map(function (c) { return esc(c.title); }).join('、') + '。' : ' 还没有可安全推荐的临期菜谱。') + '</p></div>' +
      '<div class="wb-rescue-actions"><button class="btn btn-primary" data-action="nav:go" data-view="rescue">打开救援驾驶舱</button>' +
      (top.length ? '<span class="wb-rescue-note">Pareto + 组合求解 · 0 次模型调用</span>' : '<button class="btn btn-ghost" data-action="overlay:open" data-type="intake">拍照入库</button>') +
      '</div></div>'
    );
  }

  function loadRescueEntry() {
    var el = document.getElementById("wb-rescue-entry");
    if (!el || !window.API.rescueCandidates) return;
    window.API.rescueCandidates({ maxMeals: 2, maxTotalMinutes: 60 }).then(function (result) {
      var host = document.getElementById("wb-rescue-entry");
      if (host) host.outerHTML = rescueEntryHTML(result);
    }).catch(function () {
      var host = document.getElementById("wb-rescue-entry");
      if (host) host.outerHTML = rescueEntryHTML(null);
    });
  }

  function view() {
    var DB = window.DB;
    var st = window.API.getStats();
    var stat = window.GRAPH.ensure();
    var QUICK = ["今晚吃什么", "这周最该先处理什么", "快过期的鸡蛋能做什么", "用临期食材做减脂晚餐，缺什么一起去买"];
    return (
      '<div class="view wb-view" id="wb-root">' +
      '<div class="view-head"><div><h1 class="view-title">' + greetWord() + "，" + esc(DB.user.name) + '</h1>' +
      '<p class="view-sub">AI 工作台 · 摘要与队列由图谱事件驱动 · 数值 100% 代码产出</p></div>' +
      '<span class="demo-note">✦ GraphRAG · ' + stat.version + "</span></div>" +
      summaryBar() +
      '<div class="card wb-rescue-entry" id="wb-rescue-entry"><div class="wb-rescue-copy"><div class="wb-summary-kicker">今晚先救哪几样</div>' +
      '<h2>把临期提醒变成一顿饭</h2><p>正在匹配库存并计算 Pareto 前沿…</p></div></div>' +
      '<div class="wb-grid">' +
      '<div class="wb-col-main">' +
      queueHTML() +
      '<div class="card wb-chat-card">' +
      '<div class="card-head"><div><div class="card-title">常驻对话</div><div class="card-sub">快答 0 次模型 · 常规 1 次 · 多跳 ≤2 次（红线 3）</div></div>' +
      '<div style="display:flex;gap:8px"><button class="btn btn-ghost btn-sm" data-action="ai:toggle">悬浮模式</button><button class="btn btn-ghost btn-sm" data-action="chat:clear">清空</button></div></div>' +
      '<div class="wb-chat-list" id="wb-chat-list">' + chatListHTML() + "</div>" +
      '<div class="wb-quick">' + QUICK.map(function (q) { return '<button class="wb-quick-btn" data-wb-action="wb:ask" data-q="' + esc(q) + '">' + esc(q) + "</button>"; }).join("") + "</div>" +
      '<form class="chat-input" id="wb-chat-form"><input id="wb-chat-text" placeholder="问点什么，或说「这周最该先处理什么」" aria-label="输入消息"/>' +
      '<button class="btn btn-primary" type="submit">发送</button></form>' +
      "</div>" +
      "</div>" +
      '<div class="wb-col-side">' +
      '<div class="card wb-entry-card" data-action="nav:go" data-view="graph" role="button" tabindex="0">' +
      '<div class="stat-icon" style="background:var(--tone-teal-bg);color:var(--tone-teal)">◉</div>' +
      '<div><div class="card-title">资源图谱</div><div class="card-sub num">' + stat.nodes.length + " 节点 · " + stat.edges.length + ' 边 · 点击进入</div></div></div>' +
      '<div class="card"><div class="card-title" style="margin-bottom:10px">数据段 · 实时统计</div>' +
      '<div class="wb-stats">' +
      '<div class="wb-stat"><div class="num wb-stat-v">' + st.totalItems + '</div><div class="wb-stat-l">资源总数</div></div>' +
      '<div class="wb-stat"><div class="num wb-stat-v' + (st.expiringN ? " warn" : "") + '">' + st.expiringN + '</div><div class="wb-stat-l">临期</div></div>' +
      '<div class="wb-stat"><div class="num wb-stat-v">' + st.lowN + '</div><div class="wb-stat-l">低库存</div></div>' +
      '<div class="wb-stat"><div class="num wb-stat-v">¥' + st.spent + '</div><div class="wb-stat-l">本月花费</div></div>' +
      '<div class="wb-stat"><div class="num wb-stat-v">' + st.health + '%</div><div class="wb-stat-l">健康度</div></div>' +
      '<div class="wb-stat"><div class="num wb-stat-v">' + st.mealsLeft + '</div><div class="wb-stat-l">还能做几顿</div></div>' +
      "</div></div>" +
      '<div class="card"><div class="card-title" style="margin-bottom:8px">图谱社区</div>' +
      window.GRAPH.ensure().communities.filter(function (c) { return c.level === 1; }).slice(0, 8).map(function (c) {
        return '<div class="setting-row" style="padding:8px 0"><div><div class="setting-title">' + esc(c.label) + '</div><div class="setting-desc num">' + c.stats.items + " 件 · 临期 " + c.stats.expiring + "</div></div>" +
          '<span class="sev" aria-label="健康度">' + (c.stats.health > 80 ? "🟢" : c.stats.health > 60 ? "🟡" : "🔴") + "</span></div>";
      }).join("") +
      "</div>" +
      "</div></div>" +
      '<div class="card" style="margin-top:16px"><div class="card-sub">工作台为首屏（W-A1）；⌘K 全局搜索；图谱为派生数据默认仅本地；写操作一律先预览确认（红线 2）。</div></div>' +
      "</div>"
    );
  }

  /* ---------- 挂载与交互 ---------- */
  function refreshChat() {
    var el = document.getElementById("wb-chat-list");
    if (el) el.innerHTML = chatListHTML();
    var root = document.getElementById("wb-root");
    if (root) {
      var list = root.querySelector(".wb-chat-list");
      if (list) list.scrollTop = list.scrollHeight;
    }
  }

  function send(text, rerender) {
    var API = window.API;
    typing = true;
    refreshChat();
    window.AI.reply(text).then(function (reply) {
      var msg = { who: "ai", text: reply.text, time: "刚刚", src: reply.src || (reply.model ? "模型生成" : "本地快答 · 0 次模型调用") };
      if (reply.card) msg.card = reply.card;
      if (reply.candidates) msg.candidates = reply.candidates;
      if (reply.domain) msg.domain = reply.domain;
      var after = function () {
        typing = false;
        refreshChat();
        if (rerender) rerender(); /* 队列/统计可能变化 */
      };
      if (reply.action === "generatePlans") {
        return API.generatePlans().then(function (plans) {
          msg.plans = plans.map(function (p) { return p.id; });
          API.chatPush(msg);
          after();
        });
      }
      if (reply.action === "creative") {
        return API.creativeRecipe().then(function (plan) {
          msg.plans = [plan.id];
          API.chatPush(msg);
          after();
        });
      }
      API.chatPush(msg);
      after();
    }).catch(function () {
      typing = false;
      refreshChat();
    });
  }

  function bind(viewEl, rerender) {
    if (viewEl.__wbBound) return;
    viewEl.__wbBound = true;
    /* 摘要离线预计算：每次会话首开触发一次（fire-and-forget，限流在内部） */
    if (!summaryJobStarted) {
      summaryJobStarted = true;
      setTimeout(function () {
        window.GRAPHRAG.ensureSummaries().then(function (res) {
          var okN = (res || []).filter(function (r) { return r && r.ok; }).length;
          if (okN > 0) {
            var bar = document.querySelector(".wb-summary-text");
            if (bar && rerender) rerender();
          }
        });
      }, 600);
    }
    viewEl.addEventListener("click", function (e) {
      var el = e.target.closest("[data-wb-action]");
      if (!el) return;
      var act = el.getAttribute("data-wb-action");
      if (act === "wb:ask") {
        send(el.getAttribute("data-q"), rerender);
      } else if (act === "wb:summary-refresh") {
        window.GRAPHRAG.ensureSummaries(true).then(function (res) {
          var okN = (res || []).filter(function (r) { return r && r.ok; }).length;
          var total = (res || []).length;
          var el2 = document.querySelector(".wb-summary-text");
          if (el2) el2.innerHTML = "社区摘要刷新完成：" + okN + "/" + total + " 个社区成功（限流：10 分钟 ≤3 次，未完成的稍后自动重试）。";
          setTimeout(function () { if (rerender) rerender(); }, 800);
        });
      }
    });
    var form = viewEl.querySelector("#wb-chat-form");
    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var t = document.getElementById("wb-chat-text");
        var v = t ? t.value.trim() : "";
        if (!v || typing) return;
        t.value = "";
        window.API.chatPush({ who: "me", text: v, time: "刚刚" });
        send(v, rerender);
      });
    }
    var list = viewEl.querySelector(".wb-chat-list");
    if (list) list.scrollTop = list.scrollHeight;
    loadRescueEntry();
  }

  window.WORKBENCH = { view: view, bind: bind, refreshChat: refreshChat };
})();
