/* 启核图策 · Web 管理员端（完整文档 F10）
   模块：登录与权限（F10.1 鉴权）、用户管理、家庭管理（邀请码生成/限时/撤销 F10.2）、
   数据审计（操作日志 + 云端快照 F10.3）、AI 用量（次数/费用/限流 F10.5）、
   系统配置（模型参数/联网开关/推送模板 F10.5-F10.6）、知识库管理（维护与发布 F10.4）。
   数据与用户端共享同一本地模拟后端（mockapi.js / localStorage）。 */
(function () {
  "use strict";

  var DB = window.DB;
  var S = { view: "users", loggedIn: sessionStorage.getItem("nexcore_admin_in") === "1", kbTab: "foods", auditFilter: "", busy: "" };

  /* ---------- 图标（与用户端同一 24px 圆头线条体系） ---------- */
  var PATHS = {
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 7"/><path d="M17.5 14.5a6.5 6.5 0 0 1 4 5.5"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6l-8-3Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    "circle-check": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
    upload: '<path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/>',
    graph: '<circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="7.5" r="2.4"/><circle cx="12" cy="18" r="2.4"/><path d="M8.2 7.1l7.4-.9M7 8.2l3.7 7.6M17 9.7l-3.6 6.4"/>'
  };
  function icon(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || PATHS.shield) + "</svg>";
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function toast(msg) {
    var wrap = document.getElementById("toasts");
    var el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    el.innerHTML = icon("circle-check", 18) + "<span>" + esc(msg) + "</span>";
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 3400);
  }
  function runBusy(key, fn, onDone) {
    S.busy = key;
    render();
    Promise.resolve().then(fn).then(function (res) {
      S.busy = "";
      render();
      if (onDone) onDone(res);
    }).catch(function (e) {
      S.busy = "";
      render();
      toast("操作失败：" + (e && e.message ? e.message : "请重试"));
    });
  }
  function markBusy() {
    if (!S.busy) return;
    document.querySelectorAll("[data-busy]").forEach(function (b) {
      if (b.getAttribute("data-busy") === S.busy) { b.disabled = true; b.classList.add("busy"); }
    });
  }

  /* ---------- 登录视图 ---------- */
  function viewLogin() {
    return (
      '<div class="login">' +
      '<div class="login-glow" aria-hidden="true"></div>' +
      '<div class="login-card">' +
      '<img class="login-logo" src="assets/img/logo.png" alt="启核图策" width="96" height="96"/>' +
      '<h1 class="login-title">管理员端</h1>' +
      '<p class="login-sub">NexcoreGraph · 管理看板（需管理员角色）</p>' +
      '<form class="login-form" id="admin-login-form" novalidate>' +
      '<div class="field"><label for="admin-phone">手机号</label><input id="admin-phone" inputmode="numeric" maxlength="11" placeholder="管理员手机号" aria-label="手机号"/><div class="login-err" id="admin-err" hidden></div></div>' +
      '<div class="field"><label for="admin-code">验证码</label><div class="code-row"><input id="admin-code" inputmode="numeric" maxlength="6" placeholder="6 位验证码" aria-label="验证码"/><button class="btn btn-ghost btn-sm" type="button" data-action="admin:code">获取验证码</button></div></div>' +
      '<button class="btn btn-primary login-submit" type="submit">登录管理员端</button></form>' +
      '<p class="login-note">请用家庭管理员账号登录；验证码由自建后端下发到手机或邮箱，非管理员角色将被拒绝（F10 鉴权）</p>' +
      "</div></div>"
    );
  }

  /* ---------- 用户管理（F10.1） ---------- */
  function viewUsers() {
    var rows = DB.users
      .map(function (u) {
        return (
          "<tr><td class='num'>" + esc(u.phone) + "</td><td>" + esc(u.name) + "</td><td><span class='badge badge-" + (u.role === "管理员" ? "amber" : "muted") + "'>" + esc(u.role) + "</span></td>" +
          "<td>" + esc((DB.families.filter(function (f) { return f.id === u.familyId; })[0] || {}).name || u.familyId) + "</td>" +
          "<td class='num'>" + esc(u.createdAt || "—") + "</td>" +
          "<td>" + (u.disabled ? "<span class='badge badge-red'>已禁用</span>" : "<span class='badge badge-success'>正常</span>") + "</td>" +
          "<td><button class='btn btn-ghost btn-sm' data-action='user:toggle' data-phone='" + esc(u.phone) + "' data-busy='user'>" + (u.disabled ? "启用" : "禁用") + "</button></td></tr>"
        );
      })
      .join("");
    return (
      '<div class="view"><div class="view-head"><div><h1 class="view-title">用户管理</h1><p class="view-sub">账号 · 角色 · 禁用（F10.1）· 共 ' + DB.users.length + " 个账号</p></div></div>" +
      '<div class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>手机号</th><th>昵称</th><th>角色</th><th>家庭</th><th>注册</th><th>状态</th><th>操作</th></tr></thead><tbody>' + rows + "</tbody></table></div></div></div>"
    );
  }

  /* ---------- 家庭管理（F10.2） ---------- */
  function viewFamilies() {
    var cards = DB.families
      .map(function (f) {
        var members = DB.members[f.id] || [];
        var inv = DB.invite && DB.invite.familyId === f.id ? DB.invite : null;
        var memberRows = members
          .map(function (m) {
            return "<tr><td class='num'>" + esc(m.phone) + "</td><td>" + esc(m.name) + "</td><td><span class='badge badge-" + (m.role === "管理员" ? "amber" : "muted") + "'>" + esc(m.role) + "</span></td></tr>";
          })
          .join("");
        return (
          '<div class="card" style="margin-bottom:20px"><div class="card-head"><div><div class="card-title">' + esc(f.name) + ' <span class="badge badge-muted num">容量 ' + members.length + " / 8</span></div>" +
          '<div class="card-sub">空间 · 成员 · 邀请码管理（F10.2）</div></div></div>' +
          '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>手机号</th><th>昵称</th><th>角色</th></tr></thead><tbody>' + memberRows + "</tbody></table></div>" +
          '<div class="setting-row" style="margin-top:8px"><div><div class="setting-title">邀请码</div>' +
          '<div class="setting-desc">' + (inv ? "<span class='num'>" + esc(inv.revoked ? "已撤销：" + inv.code : inv.code) + "</span> · 有效期 " + inv.expiresInDays + " 天 · 已用 " + (inv.used || 0) + "/" + (inv.max || 3) : "暂无有效邀请码") + "</div></div>" +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-ghost btn-sm" data-action="invite:gen" data-fid="' + f.id + '" data-busy="inv">' + icon("shuffle", 14) + " 生成（7 天 / 限 3 人）</button>" +
          (inv && !inv.revoked ? '<button class="btn btn-ghost btn-sm" data-action="invite:revoke" data-busy="inv">' + icon("x", 14) + " 撤销</button>" : "") +
          "</div></div></div>"
        );
      })
      .join("");
    return (
      '<div class="view"><div class="view-head"><div><h1 class="view-title">家庭管理</h1><p class="view-sub">空间、成员、容量与限时邀请码（F10.2 / F9.3）</p></div></div>' + cards + "</div>"
    );
  }

  /* ---------- 数据审计（F10.3） ---------- */
  function viewAudit() {
    var q = S.auditFilter.trim().toLowerCase();
    var logs = DB.logs.filter(function (l) {
      return !q || (l.action + " " + l.detail).toLowerCase().indexOf(q) > -1;
    });
    var rows = logs
      .slice(0, 60)
      .map(function (l) {
        return "<tr><td><span class='badge badge-muted'>" + esc(l.action) + "</span></td><td>" + esc(l.detail) + "</td><td class='num'>" + esc(l.at) + "</td></tr>";
      })
      .join("");
    var cloud = JSON.parse(localStorage.getItem("nexcore_cloud_v1") || "null") || {};
    return (
      '<div class="view"><div class="view-head"><div><h1 class="view-title">数据审计</h1><p class="view-sub">操作日志与云端快照（F10.3）· 共 ' + DB.logs.length + " 条</p></div></div>" +
      '<div class="card" style="margin-bottom:20px"><div class="card-title" style="margin-bottom:8px">云端数据</div>' +
      '<div class="kv"><span class="badge badge-teal num">版本 v' + (cloud.version || 1) + "</span>" +
      "<span class='badge badge-muted'>更新于 " + esc(cloud.updatedAt || "从未") + "</span>" +
      "<span class='badge badge-muted num'>快照 " + ((cloud.payload || "").length / 1024).toFixed(1) + " KB</span></div></div>" +
      '<div class="card"><div class="card-head"><div><div class="card-title">操作日志</div><div class="card-sub">含用户端与管理员端全部写操作</div></div>' +
      '<input id="audit-filter" placeholder="筛选日志…" value="' + esc(S.auditFilter) + '" aria-label="筛选日志"/></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>类型</th><th>内容</th><th>时间</th></tr></thead><tbody>' + (rows || "<tr><td colspan='3' class='empty-sub'>无匹配日志</td></tr>") + "</tbody></table></div></div></div>"
    );
  }

  /* ---------- AI 用量（F10.5） ---------- */
  function viewUsage() {
    var list = DB.aiUsage || [];
    var today = new Date().toISOString().slice(0, 10);
    var todayN = list.filter(function (u) { return u.day === today; }).length;
    var totalCost = list.reduce(function (s, u) { return s + (u.cost || 0); }, 0);
    var avgMs = list.length ? Math.round(list.reduce(function (s, u) { return s + (u.ms || 0); }, 0) / list.length) : 0;
    var byRoute = {};
    list.forEach(function (u) {
      var k = u.route + " · " + u.model;
      byRoute[k] = byRoute[k] || { n: 0, cost: 0, ms: 0 };
      byRoute[k].n++;
      byRoute[k].cost += u.cost || 0;
      byRoute[k].ms += u.ms || 0;
    });
    var routeRows = Object.keys(byRoute)
      .map(function (k) {
        var r = byRoute[k];
        return "<tr><td class='num'>" + esc(k) + "</td><td class='num'>" + r.n + "</td><td class='num'>¥" + r.cost.toFixed(3) + "</td><td class='num'>" + Math.round(r.ms / r.n) + " ms</td></tr>";
      })
      .join("");
    var limit = DB.config.rateLimitPerDay || 200;
    var pct = Math.min(100, Math.round((todayN / limit) * 100));
    var listRows = list
      .slice(0, 25)
      .map(function (u) {
        return "<tr><td class='num'>" + esc(u.route) + "</td><td>" + esc(u.model) + "</td><td class='num'>" + (u.model === "本地快答" ? "直答" : u.ms + " ms") + "</td><td class='num'>¥" + (u.cost || 0).toFixed(3) + "</td><td class='num'>" + esc(u.at) + "</td></tr>";
      })
      .join("");
    return (
      '<div class="view"><div class="view-head"><div><h1 class="view-title">AI 用量</h1><p class="view-sub">调用次数 · 费用 · 限流（F10.5）</p></div></div>' +
      '<div class="admin-kpis">' +
      '<div class="card admin-kpi"><div class="stat-value num">' + todayN + '</div><div class="stat-label">今日调用</div><div class="usage-bar"><span style="width:' + pct + '%"></span></div><div class="stat-delta num">限流 ' + limit + " 次/天</div></div>" +
      '<div class="card admin-kpi"><div class="stat-value num">' + list.length + '</div><div class="stat-label">累计调用</div><div class="stat-delta">全部路由</div></div>' +
      '<div class="card admin-kpi"><div class="stat-value num">¥' + totalCost.toFixed(2) + '</div><div class="stat-label">累计费用（估算）</div><div class="stat-delta">按单价配置估算</div></div>' +
      '<div class="card admin-kpi"><div class="stat-value num">' + avgMs + ' ms</div><div class="stat-label">平均耗时</div><div class="stat-delta">含模拟延迟</div></div>' +
      "</div>" +
      '<div class="card" style="margin-bottom:20px"><div class="card-title" style="margin-bottom:8px">按路由统计</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>路由 · 模型</th><th>次数</th><th>费用</th><th>平均耗时</th></tr></thead><tbody>' + (routeRows || "<tr><td colspan='4' class='empty-sub'>暂无调用记录，去用户端和 AI 聊两句</td></tr>") + "</tbody></table></div></div>" +
      '<div class="card"><div class="card-title" style="margin-bottom:8px">最近调用</div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>路由</th><th>模型</th><th>耗时</th><th>费用</th><th>时间</th></tr></thead><tbody>' + (listRows || "<tr><td colspan='5' class='empty-sub'>暂无记录</td></tr>") + "</tbody></table></div></div></div>"
    );
  }

  /* ---------- 图谱看板（WX6：仅匿名聚合指标，无任何物品明细） ---------- */
  function viewGraphStats() {
    var G = window.GRAPH;
    if (!G) {
      return '<div class="view"><div class="view-head"><div><h1 class="view-title">图谱看板</h1><p class="view-sub">图谱运营指标（WX6）</p></div></div>' +
        '<div class="card"><div class="empty-sub">图谱模块未加载：请检查 admin.html 是否引入 js/graph.js。</div></div></div>';
    }
    var doc = G.ensure();
    var families = DB.families.length || 1;
    var nodes = doc.nodes.length, edges = doc.edges.length;
    var byLevel = { 1: 0, 2: 0, 3: 0 };
    doc.communities.forEach(function (c) { byLevel[c.level] = (byLevel[c.level] || 0) + 1; });
    var l1N = byLevel[1] || 0;
    var fresh = doc.summaries.filter(function (s) { return !s.stale; }).length;
    /* AI 指标（从用量记录匿名聚合：仅计数与比率） */
    var usage = DB.aiUsage || [];
    var modelCalls = usage.filter(function (u) { return u.model !== "本地快答" && u.model !== "本地降级"; });
    var aiLead = usage.length ? Math.round((modelCalls.length / usage.length) * 100) : 0;
    var withEvidence = modelCalls.filter(function (u) { return (u.evidenceN || 0) > 0; });
    var pathRate = modelCalls.length ? Math.round((withEvidence.length / modelCalls.length) * 100) : 0;
    var globalCalls = modelCalls.filter(function (u) { return u.mode === "global"; });
    var summaryHits = globalCalls.filter(function (u) { return u.summaryHit; }).length;
    var summaryHitRate = globalCalls.length ? Math.round((summaryHits / globalCalls.length) * 100) : 0;
    var kpi = function (v, label, sub) {
      return '<div class="card admin-kpi"><div class="stat-value num">' + v + '</div><div class="stat-label">' + label + '</div><div class="stat-delta">' + sub + "</div></div>";
    };
    var typeRows = Object.keys(doc.index.byType)
      .map(function (t) { return "<tr><td>" + esc(t) + "</td><td class='num'>" + doc.index.byType[t].length + "</td></tr>"; })
      .join("");
    var commRows = [["1", "库社区（L1）"], ["2", "类别社区（L2）"], ["3", "场景社区（L3）"]]
      .map(function (r) { return "<tr><td>" + r[1] + "</td><td class='num'>" + (byLevel[Number(r[0])] || 0) + "</td></tr>"; })
      .join("");
    return (
      '<div class="view"><div class="view-head"><div><h1 class="view-title">图谱看板</h1><p class="view-sub">图谱运营指标 · 匿名聚合（WX6）· 不含任何物品明细</p></div></div>' +
      '<div class="admin-kpis">' +
      kpi(families, "接入家庭", "匿名计数") +
      kpi(Math.round(nodes / families), "平均节点 / 家庭", "共 " + nodes + " 节点") +
      kpi(Math.round(edges / families), "平均边 / 家庭", "共 " + edges + " 边") +
      kpi(doc.communities.length, "社区总数", "库/类别/场景三级") +
      kpi(fresh + " / " + l1N, "新鲜摘要 / L1 社区", "24h 内且版本一致") +
      kpi(summaryHitRate + "%", "摘要命中率", "global 回答引用占比") +
      kpi(pathRate + "%", "路径引用率", "回答携带图谱证据占比") +
      kpi(aiLead + "%", "AI 主导率", "模型参与回答占比") +
      "</div>" +
      '<div class="grid-2">' +
      '<div class="card"><div class="card-title" style="margin-bottom:8px">节点类型分布（聚合）</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>类型</th><th>数量</th></tr></thead><tbody>' + (typeRows || "<tr><td colspan='2' class='empty-sub'>暂无数据</td></tr>") + "</tbody></table></div></div>" +
      '<div class="card"><div class="card-title" style="margin-bottom:8px">社区分级（聚合）</div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>层级</th><th>社区数</th></tr></thead><tbody>' + commRows + "</tbody></table></div></div>" +
      "</div>" +
      '<div class="card" style="margin-top:20px"><div class="card-sub">隐私边界：本页仅暴露聚合指标（家庭数 / 均值 / 比率），不包含任何物品、成员或聊天明细；明细查看需二次确认并写审计日志（F10.3 / 数据分级 P1\'）。当前图谱版本 <span class="num">' + esc(doc.version) + "</span> · 构建于 " + new Date(doc.builtAt).toLocaleString("zh-CN", { hour12: false }) + "。</div></div></div>"
    );
  }

  /* ---------- 系统配置（F10.5 / F10.6） ---------- */
  function viewConfig() {
    var c = DB.config;
    return (
      '<div class="view" style="max-width:760px"><div class="view-head"><div><h1 class="view-title">系统配置</h1><p class="view-sub">模型参数 · 联网搜索 · 识别阈值 · 推送模板（F10.5 / F10.6）</p></div></div>' +
      '<div class="card"><div class="card-title" style="margin-bottom:12px">AI 模型</div>' +
      '<div class="grid-2"><div class="field"><label for="cfg-model">对话/规划模型</label><input id="cfg-model" value="' + esc(c.model) + '"/></div>' +
      '<div class="field"><label for="cfg-vision">视觉识别模型</label><input id="cfg-vision" value="' + esc(c.visionModel) + '"/></div></div>' +
      '<div class="grid-2"><div class="field"><label for="cfg-unit">对话单价（¥/千次）</label><input id="cfg-unit" class="num" value="' + c.unitPrice + '"/></div>' +
      '<div class="field"><label for="cfg-vunit">视觉单价（¥/千次）</label><input id="cfg-vunit" class="num" value="' + c.visionPrice + '"/></div></div>' +
      '<div class="grid-2"><div class="field"><label for="cfg-threshold">识别置信阈值</label><input id="cfg-threshold" class="num" value="' + c.identifyThreshold + '"/></div>' +
      '<div class="field"><label for="cfg-ratelimit">限流（次/天）</label><input id="cfg-ratelimit" class="num" value="' + c.rateLimitPerDay + '"/></div></div>' +
      '<div class="setting-row"><div><div class="setting-title">联网搜索开关</div><div class="setting-desc">天气等低风险自动，内容类需用户确认（F4.4）</div></div><button class="switch' + (c.webSearch ? " on" : "") + '" id="cfg-websearch" data-action="switch:toggle" role="switch" aria-checked="' + !!c.webSearch + '"></button></div>' +
      '<div class="field"><label for="cfg-cache">搜索缓存（分钟，D2）</label><input id="cfg-cache" class="num" value="' + c.searchCacheMin + '"/></div>' +
      "</div>" +
      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:12px">推送模板（F8.5）</div>' +
      '<div class="field"><label for="cfg-push">模板内容（{{content}} 为占位符）</label><input id="cfg-push" value="' + esc(c.pushTemplate) + '"/></div>' +
      '<button class="btn btn-primary" style="margin-top:12px" data-action="config:save" data-busy="cfg">保存配置</button></div></div>'
    );
  }

  /* ---------- 知识库管理（F10.4） ---------- */
  function viewKnowledge() {
    var kb = window.KB;
    var tabs = [["foods", "食材保质期"], ["recipes", "菜谱"], ["rules", "通用规则"]];
    var body = "";
    if (S.kbTab === "foods") {
      var rows = Object.keys(kb.foods)
        .map(function (k) {
          var f = kb.foods[k];
          return (
            "<tr><td class='num'>" + esc(k) + "</td>" +
            "<td><input class='kb-input' data-k='" + k + "' data-f='name' value='" + esc(f.name) + "'/></td>" +
            "<td><input class='kb-input num' style='width:70px' data-k='" + k + "' data-f='days' value='" + f.days + "'/></td>" +
            "<td><input class='kb-input num' style='width:70px' data-k='" + k + "' data-f='open' value='" + (f.open || 0) + "'/></td>" +
            "<td><input class='kb-input num' style='width:70px' data-k='" + k + "' data-f='lowAt' value='" + (f.lowAt || 0) + "'/></td>" +
            "<td><input class='kb-input' data-k='" + k + "' data-f='tip' value='" + esc(f.tip) + "'/></td></tr>"
          );
        })
        .join("");
      body = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Key</th><th>名称</th><th>冷藏(天)</th><th>开封后(天)</th><th>lowAt</th><th>存放建议</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    } else if (S.kbTab === "recipes") {
      var rows2 = kb.recipes
        .map(function (r, i) {
          return (
            "<tr><td><input class='kb-input' data-ri='" + i + "' data-f='title' value='" + esc(r.title) + "'/></td>" +
            "<td><input class='kb-input' style='width:90px' data-ri='" + i + "' data-f='time' value='" + esc(r.time) + "'/></td>" +
            "<td><input class='kb-input num' style='width:80px' data-ri='" + i + "' data-f='kcal' value='" + r.kcal + "'/></td>" +
            "<td><input class='kb-input num' style='width:80px' data-ri='" + i + "' data-f='prot' value='" + r.prot + "'/></td>" +
            "<td class='num' style='color:var(--text-muted)'>" + r.ing.map(function (g) { return esc(g[0]); }).join("、") + "</td></tr>"
          );
        })
        .join("");
      body = '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>菜名</th><th>耗时</th><th>热量(kcal/份)</th><th>蛋白(g)</th><th>用料</th></tr></thead><tbody>' + rows2 + "</tbody></table></div>";
    } else {
      body = '<div class="field"><label for="kb-rules">通用规则（每行一条）</label><textarea id="kb-rules" rows="10">' + esc(kb.rules.map(function (r) { return r.text; }).join("\n")) + "</textarea></div>";
    }
    return (
      '<div class="view"><div class="view-head"><div><h1 class="view-title">知识库管理</h1><p class="view-sub">菜谱 / 保质期 / 规则内容维护与发布（F10.4）· 当前版本 <span class="num">v' + (DB.config.knowledgeVersion || 1) + "</span></p></div>" +
      '<div style="display:flex;gap:12px">' +
      '<button class="btn btn-ghost" data-action="kb:save" data-busy="kb">' + icon("check", 16) + " 保存草稿</button>" +
      '<button class="btn btn-primary" data-action="kb:publish" data-busy="kbp">' + icon("upload", 16) + " 发布新版本</button></div></div>" +
      '<div class="chip-row" style="margin-bottom:16px">' +
      tabs.map(function (t) { return '<button class="chip' + (S.kbTab === t[0] ? " active" : "") + '" data-action="kb:tab" data-tab="' + t[0] + '">' + t[1] + "</button>"; }).join("") +
      "</div>" +
      '<div class="card">' + body + "</div>" +
      '<div class="card" style="margin-top:20px"><div class="card-sub">来源：' + esc(kb.sources) + "。发布后用户端 /api/knowledge 版本号 +1，AI 回答引用条目并可给来源（F4.3）。</div></div></div>"
    );
  }

  /* ---------- 壳 ---------- */
  var NAV = [
    { id: "users", label: "用户管理", icon: "users" },
    { id: "families", label: "家庭管理", icon: "home" },
    { id: "audit", label: "数据审计", icon: "history" },
    { id: "usage", label: "AI 用量", icon: "sparkles" },
    { id: "graphstats", label: "图谱看板", icon: "graph" },
    { id: "config", label: "系统配置", icon: "settings" },
    { id: "knowledge", label: "知识库管理", icon: "book" }
  ];

  function shell() {
    var nav = NAV.map(function (n) {
      return (
        '<button class="nav-item' + (S.view === n.id ? " active" : "") + '" data-action="nav:go" data-view="' + n.id + '">' +
        icon(n.icon, 19) + "<span>" + n.label + "</span></button>"
      );
    }).join("");
    return (
      '<div class="app">' +
      '<aside class="sidebar">' +
      '<div class="brand"><div class="brand-mark"><img src="assets/img/logo.png" alt="logo" width="40" height="40"/></div><div><div class="brand-name">启核图策</div><div class="brand-sub">管理员端 · 管理看板</div></div></div>' +
      '<nav class="nav" aria-label="管理导航"><div class="nav-label">管理</div>' + nav + "</nav>" +
      '<div class="sidebar-foot"><div class="user-chip"><div class="avatar">' + esc((DB.user || {}).initial || "管") + "</div><div><div class='user-name'>" + esc((DB.user || {}).name || "管理员") + "</div><div class='user-role'>管理员</div></div>" +
      '<button class="icon-btn" style="margin-left:auto;width:32px;height:32px" data-action="admin:logout" aria-label="退出">' + icon("logout", 17) + "</button></div>" +
      '<a class="link-btn" href="index.html" style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px">' + icon("sun", 14) + " 返回用户端</a></div></aside>" +
      '<div class="main"><main class="content" id="view"></main></div></div>'
    );
  }

  /* 管理员端真实数据：登录后从后端拉用户 / 家庭 / 审计 / 用量 */
  function loadOverview() {
    return window.AUTH.getAuth("/api/admin/overview", S.token).then(function (o) {
      DB.users = (o.users || []).map(function (u) {
        return {
          phone: u.phone,
          name: u.nickname || u.phone,
          role: u.role || "成员",
          familyId: "",
          disabled: false,
          createdAt: String(u.created_at || "").slice(0, 10)
        };
      });
      DB.families = (o.families || []).map(function (f) {
        return {
          id: f.id,
          name: f.name,
          memberCount: f.member_count || 0,
          inviteCode: f.invite_code || ""
        };
      });
      DB.logs = (o.logs || []).map(function (l) {
        return {
          at: String(l.created_at || ""),
          action: l.action,
          detail: l.detail,
          familyId: l.family_id
        };
      });
      DB.aiUsage = (o.usage || []).map(function (u) {
        return {
          route: u.route,
          model: u.model,
          ms: Math.round(u.avgMs || 0),
          calls: u.calls,
          tokens: u.tokens || 0,
          at: "",
          day: ""
        };
      });
      return o;
    });
  }

  function render() {
    if (!S.loggedIn) {
      document.body.innerHTML = viewLogin();
      var form = document.getElementById("admin-login-form");
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var phone = document.getElementById("admin-phone").value.trim();
        var code = document.getElementById("admin-code").value.trim();
        var err = document.getElementById("admin-err");
        var okPhone = /^1\d{10}$/.test(phone) || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(phone);
        if (!okPhone || !/^\d{6}$/.test(code)) {
          err.hidden = false;
          err.textContent = "请输入手机号/邮箱与 6 位验证码";
          return;
        }
        err.hidden = true;
        runBusy("login", function () {
          return window.AUTH.login(phone, code).then(function (a) {
            if (!a || !a.ok) throw new Error((a && a.error) || "登录失败");
            if (a.role !== "管理员") throw new Error("当前账号不是管理员，无法进入管理端");
            S.token = a.token || "";
            DB.user = {
              name: a.nickname || phone,
              phone: phone,
              role: "管理员",
              initial: (a.nickname || phone || "管").slice(0, 1)
            };
            sessionStorage.setItem("nexcore_admin_token", S.token);
            S.loggedIn = true;
            sessionStorage.setItem("nexcore_admin_in", "1");
            return loadOverview();
          });
        }, function () {
          toast("已登录管理员端");
        });
      });
      return;
    }
    var fns = { users: viewUsers, families: viewFamilies, audit: viewAudit, usage: viewUsage, graphstats: viewGraphStats, config: viewConfig, knowledge: viewKnowledge };
    document.body.innerHTML = shell();
    document.getElementById("view").innerHTML = (fns[S.view] || viewUsers)();
    var af = document.getElementById("audit-filter");
    if (af) {
      var st;
      af.addEventListener("input", function () {
        clearTimeout(st);
        st = setTimeout(function () {
          S.auditFilter = af.value;
          var card = document.querySelector(".card .tbl-wrap");
          render();
        }, 260); /* 全局搜索同款 260ms 防抖 */
      });
    }
    markBusy();
  }

  /* ---------- 动作 ---------- */
  function collectKnowledgeEdits() {
    /* 从当前 DOM 读取编辑值（切换标签页前先保存） */
    document.querySelectorAll(".kb-input").forEach(function (inp) {
      var k = inp.getAttribute("data-k");
      var ri = inp.getAttribute("data-ri");
      var f = inp.getAttribute("data-f");
      if (k) {
        var v = inp.value;
        if (f === "days" || f === "open" || f === "lowAt") window.KB.foods[k][f] = parseInt(v, 10) || 0;
        else window.KB.foods[k][f] = v;
      } else if (ri !== null) {
        var r = window.KB.recipes[Number(ri)];
        if (!r) return;
        if (f === "kcal" || f === "prot") r[f] = parseInt(inp.value, 10) || 0;
        else r[f] = inp.value;
      }
    });
    var rulesTa = document.getElementById("kb-rules");
    if (rulesTa) {
      window.KB.rules = rulesTa.value.split("\n").filter(function (x) { return x.trim(); }).map(function (t, i) { return { id: "r" + (i + 1), text: t.trim(), tag: "自定义" }; });
    }
  }

  function handleAction(action, el) {
    switch (action) {
      case "nav:go":
        if (S.view === "knowledge") collectKnowledgeEdits();
        S.view = el.getAttribute("data-view");
        render();
        break;
      case "admin:code":
        {
          var ap = ((document.getElementById("admin-phone") || {}).value || "").trim();
          if (!ap) { toast("先填手机号或邮箱"); break; }
          runBusy("login:code", function () {
            return window.AUTH ? window.AUTH.requestCode(ap)
              : Promise.reject(new Error("登录服务未就绪"));
          }, function (r) {
            toast(r && r.ok ? (r.hint || "验证码已下发") : ((r && r.error) || "验证码下发失败"));
          });
        }
        break;
      case "admin:logout":
        S.loggedIn = false;
        sessionStorage.removeItem("nexcore_admin_in");
        sessionStorage.removeItem("nexcore_admin_token");
        render();
        break;
      case "user:toggle": {
        var phone = el.getAttribute("data-phone");
        var u = DB.users.filter(function (x) { return x.phone === phone; })[0];
        if (!u) break;
        runBusy("user", function () {
          return API.userSetDisabled(phone, !u.disabled);
        }, function () {
          toast((u.disabled ? "已启用" : "已禁用") + "用户 " + u.name + "（F10.1）");
        });
        break;
      }
      case "invite:gen":
        runBusy("inv", function () {
          return API.inviteGenerate(7, 3).then(function (inv) {
            inv.familyId = el.getAttribute("data-fid");
            API.touchChat();
            return inv;
          });
        }, function (inv) {
          toast("已为该家庭生成邀请码 " + inv.code + "（7 天有效）");
        });
        break;
      case "invite:revoke":
        runBusy("inv", function () {
          return API.inviteRevoke();
        }, function () {
          toast("邀请码已撤销");
        });
        break;
      case "config:save": {
        /* 先读值再 runBusy：runBusy 会先重渲染重建输入框 */
        var g = function (id) { var e2 = document.getElementById(id); return e2 ? e2.value : ""; };
        var cfgVals = {
          model: g("cfg-model"),
          visionModel: g("cfg-vision"),
          unitPrice: parseFloat(g("cfg-unit")) || 0.002,
          visionPrice: parseFloat(g("cfg-vunit")) || 0.01,
          identifyThreshold: parseFloat(g("cfg-threshold")) || 0.85,
          rateLimitPerDay: parseInt(g("cfg-ratelimit"), 10) || 200,
          searchCacheMin: parseInt(g("cfg-cache"), 10) || 10,
          pushTemplate: g("cfg-push"),
          webSearch: document.getElementById("cfg-websearch").classList.contains("on")
        };
        runBusy("cfg", function () {
          return API.setConfig(cfgVals);
        }, function () {
          toast("系统配置已保存（F10.5）");
        });
        break;
      }
      case "kb:tab":
        collectKnowledgeEdits();
        S.kbTab = el.getAttribute("data-tab");
        render();
        break;
      case "kb:save":
        collectKnowledgeEdits();
        runBusy("kb", function () {
          return API.knowledgeSaveDraft();
        }, function () {
          toast("知识库草稿已保存（未发布）");
        });
        break;
      case "kb:publish":
        collectKnowledgeEdits();
        runBusy("kbp", function () {
          return API.knowledgePublish();
        }, function (v) {
          toast("知识库已发布 v" + v + "，用户端 AI 已引用新内容");
        });
        break;
    }
  }

  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (el) {
      e.preventDefault();
      handleAction(el.getAttribute("data-action"), el);
    }
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && S.loggedIn) { /* 无浮层，忽略 */ }
  });

  document.documentElement.setAttribute("data-theme", DB.theme || "light");
  /* 恢复管理员会话：有 token 就拉一次真实数据，失败回登录页 */
  S.token = sessionStorage.getItem("nexcore_admin_token") || "";
  if (S.loggedIn && S.token) {
    loadOverview().then(function () { render(); }, function () {
      S.loggedIn = false;
      sessionStorage.removeItem("nexcore_admin_in");
      sessionStorage.removeItem("nexcore_admin_token");
      render();
    });
  } else {
    render();
  }
})();
