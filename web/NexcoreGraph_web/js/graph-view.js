/* 启核图策 · 内联 SVG 分层图谱（Web 阶段 1，方案 8.4 / WX3-WX4）
   - 零第三方依赖；总览=社区聚合视图（≤60 节点），点库下钻=实例↔概念分层图
   - 私有物品默认隐藏（F2.5）；临期红色高亮；点节点 → 路径 + 来源 + 问 AI
   - 渲染预算：≤60 节点 <300ms（纯字符串拼 SVG） */
(function () {
  "use strict";

  var TONE = {
    teal: "#2DD4BF", indigo: "#818CF8", red: "#F87171", slate: "#94A3B8",
    lime: "#A3E635", brown: "#D6A77A", orange: "#FB923C", violet: "#C4B5FD"
  };
  var state = { libId: null, expiringOnly: false, showPrivate: false, selected: null };

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function toneColor(id) {
    var lib = window.DB.libraries.filter(function (l) { return "lib:" + l.id === id; })[0];
    return TONE[(lib && lib.tone) || "slate"];
  }
  function isExpiring(n) { return n.props.expDays != null && n.props.expDays < 9000 && n.props.expDays <= 7; }

  /* ---------- 总览：社区聚合（库社区 + 场景分组） ---------- */
  function overviewSVG() {
    var G = window.GRAPH;
    var doc = G.ensure();
    var libs = doc.nodes.filter(function (n) { return n.type === "Library"; });
    var W = 920, H = 420;
    var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" class="graph-svg" role="img" aria-label="资源图谱总览">'];
    /* 家庭中心节点 */
    var fam = doc.nodes.filter(function (n) { return n.type === "Family"; })[0];
    var cx = W / 2, cy = H / 2;
    if (fam) {
      svg.push('<circle cx="' + cx + '" cy="' + cy + '" r="34" fill="none" stroke="var(--primary)" stroke-width="2" class="gnode" data-wb-action="g:node" data-id="' + fam.id + '"/>');
      svg.push('<text x="' + cx + '" y="' + (cy - 2) + '" text-anchor="middle" class="glabel glabel-strong">' + esc(fam.label) + "</text>");
      svg.push('<text x="' + cx + '" y="' + (cy + 14) + '" text-anchor="middle" class="glabel glabel-sub">' + fam.props.memberCount + ' 人</text>');
    }
    /* 库社区节点：环形分布，半径按物品数，临期标红 */
    libs.forEach(function (l, i) {
      var agg = G.aggregate(l.id) || { stats: {} };
      var ang = (Math.PI * 2 * i) / libs.length - Math.PI / 2;
      var dist = 150 + Math.min(60, (agg.stats.items || 0) * 4);
      var x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist;
      var r = 18 + Math.min(20, (agg.stats.items || 0) * 1.2);
      var col = toneColor(l.id);
      svg.push('<line x1="' + cx + '" y1="' + cy + '" x2="' + x + '" y2="' + y + '" class="gedge"/>');
      svg.push('<circle cx="' + x + '" cy="' + y + '" r="' + r + '" fill="' + col + '" fill-opacity=".14" stroke="' + col + '" stroke-width="' + ((agg.stats.expiring || 0) > 0 ? 2.4 : 1.4) + '" ' + ((agg.stats.expiring || 0) > 0 ? 'stroke-dasharray="4 3"' : "") + ' class="gnode" data-wb-action="g:node" data-id="' + l.id + '"/>');
      svg.push('<text x="' + x + '" y="' + (y - r - 8) + '" text-anchor="middle" class="glabel glabel-strong">' + esc(l.label) + "</text>");
      svg.push('<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" class="glabel">' + (agg.stats.items || 0) + ' 件</text>');
      if (agg.stats.expiring) svg.push('<text x="' + x + '" y="' + (y + 17) + '" text-anchor="middle" class="glabel glabel-warn">临期 ' + agg.stats.expiring + "</text>");
    });
    svg.push('<text x="16" y="24" class="glabel glabel-sub">家庭资源图谱 · 社区聚合视图（点节点看详情，点库社区下钻分层图）</text>');
    svg.push("</svg>");
    return svg.join("");
  }

  /* ---------- 下钻：库 → 物品 → 概念（分层图） ---------- */
  function libDetailSVG(libId) {
    var G = window.GRAPH;
    var sg = G.subgraph({ libId: libId, includePrivate: state.showPrivate, expiringOnly: state.expiringOnly });
    var lib = window.DB.libraries.filter(function (l) { return l.id === libId; })[0] || { name: libId };
    var items = sg.nodes.filter(function (n) { return n.type === "ItemInstance"; }).slice(0, 24);
    var foods = sg.nodes.filter(function (n) { return n.type === "FoodConcept"; });
    var recipes = sg.nodes.filter(function (n) { return n.type === "RecipeConcept"; }).slice(0, 10);
    var col = toneColor("lib:" + libId);
    var W = 960, rowH = 44, H = Math.max(320, 80 + items.length * rowH);
    var svg = ['<svg viewBox="0 0 ' + W + " " + H + '" class="graph-svg" role="img" aria-label="' + esc(lib.name) + ' 分层图谱">'];
    /* 三列：库(120) → 物品实例(360) → 食材概念(650) → 菜谱(850) */
    svg.push('<text x="120" y="26" class="glabel glabel-strong" text-anchor="middle">库</text>');
    svg.push('<text x="360" y="26" class="glabel glabel-strong" text-anchor="middle">物品实例</text>');
    svg.push('<text x="650" y="26" class="glabel glabel-strong" text-anchor="middle">食材概念（知识库）</text>');
    svg.push('<text x="850" y="26" class="glabel glabel-strong" text-anchor="middle">菜谱</text>');
    svg.push('<line x1="120" y1="36" x2="120" y2="' + (H - 20) + '" class="gaxis"/>');
    svg.push('<line x1="650" y1="36" x2="650" y2="' + (H - 20) + '" class="gaxis"/>');
    svg.push('<line x1="850" y1="36" x2="850" y2="' + (H - 20) + '" class="gaxis"/>');

    var pos = {};
    svg.push('<circle cx="120" cy="' + (H / 2) + '" r="30" fill="' + col + '" fill-opacity=".14" stroke="' + col + '" stroke-width="2" class="gnode" data-wb-action="g:node" data-id="lib:' + libId + '"/>');
    svg.push('<text x="120" y="' + (H / 2 + 4) + '" text-anchor="middle" class="glabel glabel-strong">' + esc(lib.name) + "</text>");

    items.forEach(function (n, i) {
      var y = 56 + i * rowH;
      pos[n.id] = { x: 360, y: y };
      var warn = isExpiring(n);
      svg.push('<line x1="150" y1="' + (H / 2) + '" x2="330" y2="' + y + '" class="gedge"/>');
      svg.push('<circle cx="360" cy="' + y + '" r="11" fill="' + (warn ? "#F87171" : col) + '" fill-opacity="' + (warn ? 0.9 : 0.16) + '" stroke="' + (warn ? "#F87171" : col) + '" stroke-width="1.4" class="gnode" data-wb-action="g:node" data-id="' + n.id + '"/>');
      svg.push('<text x="378" y="' + (y + 4) + '" class="glabel">' + esc(n.label) + " · " + n.props.qty + n.props.unit + (warn ? " · " + n.props.expDays + "天" : "") + "</text>");
    });
    /* instantiates：物品 → 食材概念 */
    foods.forEach(function (f, i) {
      var y = 56 + i * Math.max(30, rowH * 0.7);
      pos[f.id] = { x: 650, y: y };
      svg.push('<circle cx="650" cy="' + y + '" r="9" fill="var(--primary)" fill-opacity=".18" stroke="var(--primary)" stroke-width="1.2" class="gnode" data-wb-action="g:node" data-id="' + f.id + '"/>');
      svg.push('<text x="666" y="' + (y + 4) + '" class="glabel glabel-sub">' + esc(f.label) + "</text>");
    });
    docEdges(libId).forEach(function (e) {
      var a = pos[e.from], b = pos[e.to];
      if (!a || !b) return;
      if (e.type === "usedBy") return; /* 概念→菜谱统一画在右侧 */
      svg.push('<path d="M' + (a.x + 12) + " " + a.y + " C " + (a.x + 90) + " " + a.y + ", " + (b.x - 90) + " " + b.y + ", " + (b.x - 10) + " " + b.y + '" class="gedge gedge-flow"/>');
    });
    recipes.forEach(function (r, i) {
      var y = 56 + i * 34;
      pos[r.id] = { x: 850, y: y };
      svg.push('<circle cx="850" cy="' + y + '" r="8" fill="#A3E635" fill-opacity=".2" stroke="#A3E635" stroke-width="1.2" class="gnode" data-wb-action="g:node" data-id="' + r.id + '"/>');
      svg.push('<text x="864" y="' + (y + 4) + '" class="glabel glabel-sub">' + esc(r.label) + "</text>");
      /* usedBy 边（概念列 → 菜谱列） */
      var uses = docEdges(libId).filter(function (e) { return e.type === "usedBy" && e.to === r.id && pos[e.from]; });
      uses.slice(0, 3).forEach(function (e) {
        svg.push('<path d="M' + (pos[e.from].x + 10) + " " + pos[e.from].y + " L " + 842 + " " + y + '" class="gedge"/>');
      });
    });
    svg.push('<text x="16" y="24" class="glabel glabel-sub">' + esc(lib.name) + " · 分层图（库 → 物品 → 概念 → 菜谱）· " + items.length + " 件 / " + foods.length + " 概念" + (state.expiringOnly ? " · 仅临期" : "") + "</text>");
    svg.push("</svg>");
    return svg.join("");
  }

  function docEdges(libId) {
    var G = window.GRAPH;
    var doc = G.ensure();
    var ids = {};
    G.subgraph({ libId: libId, includePrivate: state.showPrivate, expiringOnly: state.expiringOnly }).nodes.forEach(function (n) { ids[n.id] = 1; });
    return doc.edges.filter(function (e) { return ids[e.from] && ids[e.to]; });
  }

  /* ---------- 节点详情：路径 + 来源 + 问 AI（WX4） ---------- */
  function nodeDetail(id) {
    var G = window.GRAPH;
    var n = G.byId(id);
    if (!n) return '<div class="empty" style="padding:24px"><div class="empty-sub">点左侧节点查看路径与来源</div></div>';
    var G_ = G;
    var rows = [];
    /* 事实行 */
    if (n.type === "ItemInstance") {
      var p = n.props;
      var libName = (window.DB.libraries.filter(function (l) { return l.id === p.libId; })[0] || {}).name;
      rows.push("库存：" + libName + " · " + (p.pos || "未设置位置") + " · " + p.qty + " " + p.unit + (p.expDays != null && p.expDays < 9000 ? " · " + p.expDays + " 天到期" : ""));
      if (p.price) rows.push("价格 ¥" + p.price + "（" + p.priceSrc + "）");
    }
    if (n.type === "FoodConcept") rows.push("知识库：" + n.props.src + (n.props.tip ? " · " + n.props.tip : ""));
    if (n.type === "RecipeConcept") rows.push("菜谱：" + n.props.time + " · 约 " + n.props.kcal + " kcal/份（AI 估算）");
    if (n.type === "Library" || n.type === "Family") {
      var agg = G.aggregate(id);
      if (agg) rows.push("社区统计：" + agg.stats.items + " 件 · 临期 " + agg.stats.expiring + " · 价值 ¥" + agg.stats.value + "（代码计算）");
    }
    /* 路径（1 跳邻域 → 表格化路径 + 来源） */
    var paths = G.multiHop([n], null, 2).slice(0, 5);
    var pathHTML = paths.length
      ? paths.map(function (p) {
          var chain = [n.label].concat(p.nodes.map(function (nid) { return (G_.byId(nid) || {}).label || nid; })).join(" —");
          var edges = p.edges.join(" → ");
          var srcNode = p.nodes.map(G_.byId).filter(Boolean).filter(function (x) { return x.props && x.props.src; })[0];
          return '<div class="graph-path"><div class="graph-path-chain">' + esc(chain) + '</div><div class="graph-path-meta">边：' + esc(edges) + (srcNode ? " · 来源：" + esc(srcNode.props.src) : " · 来源：本地图谱") + "</div></div>";
        }).join("")
      : '<div class="empty-sub" style="padding:6px 0">该节点暂无 2 跳内路径</div>';
    var q = n.type === "ItemInstance" ? n.label + " 放哪了" : n.type === "Library" ? n.label + "里有什么快过期了" : n.label + " 能做什么";
    return (
      '<div class="graph-detail-card">' +
      '<div class="graph-detail-head"><span class="badge badge-muted">' + n.type + "</span><b>" + esc(n.label) + "</b></div>" +
      '<div class="graph-detail-facts">' + rows.map(function (r) { return "<div>" + esc(r) + "</div>"; }).join("") + "</div>" +
      '<div class="card-title" style="font-size:13px;margin:14px 0 8px">图谱路径 + 来源（≤3 跳）</div>' +
      pathHTML +
      '<button class="btn btn-primary btn-sm" style="margin-top:14px" data-action="ai:ask" data-q="' + esc(q) + '">问 AI：' + esc(q) + "</button>" +
      "</div>"
    );
  }

  /* ---------- 页面 ---------- */
  function view() {
    var G = window.GRAPH;
    var stat = G.ensure();
    var svg = state.libId ? libDetailSVG(state.libId) : overviewSVG();
    var libs = window.DB.libraries;
    return (
      '<div class="view">' +
      '<div class="view-head"><div><h1 class="view-title">资源图谱</h1>' +
      '<p class="view-sub">个人资源知识图谱 · ' + stat.nodes.length + " 节点 / " + stat.edges.length + ' 边 · graphVersion ' + stat.version + '（构图 0 次模型调用，&lt;300ms）</p></div>' +
      '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">' +
      '<select class="graph-filter" data-wb-action="g:lib">' +
      '<option value="">总览（社区聚合）</option>' +
      libs.map(function (l) { return '<option value="' + l.id + '"' + (state.libId === l.id ? " selected" : "") + ">下钻：" + esc(l.name) + "</option>"; }).join("") +
      "</select>" +
      '<button class="btn btn-ghost btn-sm' + (state.expiringOnly ? " btn-warn-on" : "") + '" data-wb-action="g:expiring">只看临期</button>' +
      '<button class="btn btn-ghost btn-sm" data-wb-action="g:private">' + (state.showPrivate ? "隐藏私有物品" : "显示私有物品") + "</button>" +
      '<button class="btn btn-soft btn-sm" data-wb-action="g:rebuild">重建图谱</button>' +
      "</div></div>" +
      '<div class="card graph-card"><div class="graph-svg-wrap">' + svg + "</div></div>" +
      '<div class="graph-detail" id="graph-detail">' + (state.selected ? nodeDetail(state.selected) : '<div class="card empty" style="padding:24px"><div class="empty-title">点击图中节点</div><div class="empty-sub">展开「路径 + 来源」，可一键问 AI（WX4）</div></div>') + "</div>" +
      '<div class="card" style="margin-top:16px"><div class="card-sub">图谱为派生数据（P1\'），默认仅本地存储、不上云；私有物品默认隐藏（F2.5）；社区统计由代码计算（AI 红线 1）。</div></div>' +
      "</div>"
    );
  }

  /* 交互绑定（由 workbench.bind 调用，挂在图谱页根元素上） */
  function bind(rootEl, rerender) {
    rootEl.__graphBound = true;
    rootEl.addEventListener("click", function (e) {
      var el = e.target.closest("[data-wb-action]");
      if (!el) return;
      var act = el.getAttribute("data-wb-action");
      if (act === "g:node") {
        state.selected = el.getAttribute("data-id");
        var d = document.getElementById("graph-detail");
        if (d) d.innerHTML = nodeDetail(state.selected);
        var libId = /^lib:/.test(state.selected) ? state.selected.slice(4) : null;
        if (libId && !state.libId) { state.libId = libId; rerender(); }
      } else if (act === "g:lib") {
        state.libId = el.value || null;
        state.selected = state.libId ? "lib:" + state.libId : null;
        rerender();
      } else if (act === "g:expiring") {
        state.expiringOnly = !state.expiringOnly;
        rerender();
      } else if (act === "g:private") {
        state.showPrivate = !state.showPrivate;
        rerender();
      } else if (act === "g:rebuild") {
        window.GRAPH.build();
        rerender();
      }
    });
    rootEl.addEventListener("change", function (e) {
      var el = e.target.closest('[data-wb-action="g:lib"]');
      if (el) { state.libId = el.value || null; state.selected = null; rerender(); }
    });
  }

  window.GRAPHVIEW = { view: view, bind: bind, state: state };
})();
