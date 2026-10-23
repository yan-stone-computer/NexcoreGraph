/* 启核图策 · Web 正式版交互脚本（用户端）
   视觉 100% 复刻 web-demo 基准；数据接入本地模拟后端（mockapi.js，接口对齐 2.0 契约）。
   在 mock 原型基础上落地：真实相机/拖拽入库（F1）、知识库驱动方案（F3）、意图路由 AI（P0-1/P0-2）、
   预警引擎（F3.9-F3.14）、同步冲突二选一（F9.10）、邀请码（F9.3）、Profile/预算/档位、AI 简报（P0-6）、打印。 */
(function () {
  "use strict";

  /* ---------- 图标（统一 24px 圆头线条体系） ---------- */
  var PATHS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    library: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="3.5"/>',
    chat: '<path d="M21 12a8 8 0 0 1-8 8H5l-2 2V12a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8Z"/>',
    "list-check": '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.2 1.2L6.5 4.8M3 12l1.2 1.2L6.5 10.8M3 18l1.2 1.2 2.3-2.4"/>',
    bell: '<path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    cart: '<circle cx="9" cy="20" r="1.3"/><circle cx="17" cy="20" r="1.3"/><path d="M3 4h2l2.5 12h10L21 8H6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M16 5.5a3.5 3.5 0 0 1 0 7"/><path d="M17.5 14.5a6.5 6.5 0 0 1 4 5.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    alert: '<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17.5v.5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "arrow-right": '<path d="M5 12h14M13 5l7 7-7 7"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
    sparkles: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z"/>',
    fridge: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 11h14M9 6v2M9 15v3"/>',
    shirt: '<path d="M5 7 9 5c.6 1.2 1.7 2 3 2s2.4-.8 3-2l4 2-1 4-2-1v9H8v-9l-2 1-1-4Z"/>',
    pill: '<path d="m10.5 13.5 6-6a3.5 3.5 0 0 1 5 5l-6 6a3.5 3.5 0 0 1-5-5Z"/><path d="m6.5 6.5 4 4M13.5 13.5l4 4"/>',
    wrench: '<path d="M14.5 6.5a4 4 0 0 0-5.2 5.1L4 17v3h3l5.4-5.3a4 4 0 0 0 5.1-5.2l-3 3-2.3-2.3 3-3Z"/>',
    dumbbell: '<path d="M7 8v8M17 8v8M4 10v4M20 10v4"/><path d="M7 12h10"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v18H6.5A2.5 2.5 0 0 0 4 22V4.5Z"/><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>',
    paw: '<circle cx="5" cy="10" r="1.6"/><circle cx="19" cy="10" r="1.6"/><circle cx="9.5" cy="6" r="1.7"/><circle cx="14.5" cy="6" r="1.7"/><path d="M12 11c3.5 0 6.5 2.6 6.5 5.5 0 1.5-1 2.5-2.5 2.5-1.6 0-2.8-1.5-4-1.5s-2.4 1.5-4 1.5c-1.5 0-2.5-1-2.5-2.5C5.5 13.6 8.5 11 12 11Z"/>',
    plug: '<path d="M12 3v4M8 3v4M6 7h12v3a6 6 0 0 1-12 0V7Z"/><path d="M12 16v5"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.2 7.6 8 9 4.8-1.4 8-4.5 8-9V6l-8-3Z"/>',
    package: '<path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
    home: '<path d="M4 11 12 4l8 7"/><path d="M6 10v10h12V10"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/>',
    "chevron-down": '<path d="m6 9 6 6 6-6"/>',
    upload: '<path d="M12 16V4M6 10l6-6 6 6"/><path d="M4 20h16"/>',
    scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"/>',
    "circle-check": '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 5-5"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-4"/>',
    leaf: '<path d="M5 20C5 10 12 4 21 4c0 9-6 16-16 16Z"/><path d="M5 20c3-6 7-10 12-12"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 8v4l3 2"/>',
    wallet: '<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18M16 15h.5"/>',
    trend: '<path d="M3 17l5-6 4 3 6-8"/><path d="M15 6h5v5"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8L3 12Z"/><circle cx="8" cy="8" r="1.5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4"/>',
    moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/>',
    "arrow-left": '<path d="M19 12H5M11 19l-7-7 7-7"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    "folder-plus": '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"/><path d="M12 11v5M9.5 13.5h5"/>',
    "arrow-up": '<path d="M12 19V5M6 11l6-6 6 6"/>',
    "arrow-down": '<path d="M12 5v14M6 13l6 6 6-6"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6Z"/><path d="M14 2v6h6"/>',
    door: '<path d="M4 3h11a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4V3Z"/><circle cx="13.5" cy="12" r="1.2"/>',
    flame: '<path d="M12 3c.8 1.8 3.5 3.2 3.5 6.3a3.5 3.5 0 0 1-7 0C8.5 6.2 11.2 4.8 12 3Z"/><path d="M10.5 9.5c1.2 1.6 3 2.2 3 4a2 2 0 0 1-4 0c0-1.4.7-2.4 1-4Z"/>',
    thermometer: '<path d="M12 3a2.2 2.2 0 0 1 2.2 2.2v7.8a4.5 4.5 0 1 1-4.4 0V5.2A2.2 2.2 0 0 1 12 3Z"/><path d="M12 9v6"/>',
    shuffle: '<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    graph: '<circle cx="5" cy="6" r="2.2"/><circle cx="19" cy="6" r="2.2"/><circle cx="12" cy="18" r="2.2"/><path d="M6.8 7.6l4 8.2M17.2 7.6l-4 8.2M7.2 6h9.6"/>'
  };

  function icon(name, size) {
    size = size || 20;
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (PATHS[name] || PATHS.dashboard) + "</svg>";
  }

  /* ---------- 状态 ---------- */
  var DB = window.DB;
  var S = { view: "aiwork", intakeLoading: false, search: "", busy: "", chatTyping: false, itemFilter: "all", familyOpen: false, overlay: null, libMenu: null, itemEdit: null, cabinetOpen: true, flipPlans: false, dragId: null, suppressClick: false, aiOpen: false, aiEnter: false, ball: { x: 24, y: 24 }, ballDragged: false, trendRange: "7", passMenu: null, flipCard: null, dragCard: null, dealFlag: false, shots: [], shotsFull: [], camOn: false, stream: null, intakeLib: null, mergedCount: 0, syncConflict: null, aiStatus: null };
  S.loginCd = 0;   /* 登录页验证码倒计时（秒） */
  /* 色板（启核绿青蓝 / 经典橙）：与深浅色解耦，存本机；默认启核 */
  var PALETTE_KEY = "nexcore_palette";
  function palette() {
    try {
      return localStorage.getItem(PALETTE_KEY) === "classic" ? "classic" : "nexcore";
    } catch (e) { return "nexcore"; }
  }
  /** 把 深浅色 + 色板 落到 <html> 上（token 层据此切换，页面里不再写死颜色） */
  function applyTheme() {
    var el = document.documentElement;
    el.setAttribute("data-theme", DB.theme === "dark" ? "dark" : "light");
    el.setAttribute("data-palette", palette());
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute("content", DB.theme === "dark" ? "#13172B" : "#F5F9FB");
    }
  }
  /* 指令层（js/commands.js）需要的最小钩子：写操作落地后刷新、切主题 / 色板。
     让指令不重复实现业务逻辑，只驱动已有视图与 API。 */
  window.NXG_RENDER = function () { render(); };
  window.NXG_APPLY_THEME = applyTheme;
  window.NXG_SET_PALETTE = function (p) {
    try { localStorage.setItem(PALETTE_KEY, p === "classic" ? "classic" : "nexcore"); } catch (e) { /* ignore */ }
    applyTheme();
    render();
  };
  try {
    var bp = JSON.parse(localStorage.getItem("nexcore_ball") || "null");
    if (bp && typeof bp.x === "number") S.ball = bp;
  } catch (e) {}
  var lastViewKey = "", lastOvKey = "";
  /* 必须有真实账号与家庭才算登录态；旧缓存里只有演示数据的，回到登录页重新登录 */
  var loggedIn = localStorage.getItem("nexcore_logged_in") === "1" &&
    !!(DB.user && DB.user.phone && DB.familyId);
  var INTAKE_SEED = [];

  /* ---------- 相机（F1：MediaDevices.getUserMedia，HTTPS/localhost 环境可用） ---------- */
  function startCam() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast("当前环境不支持摄像头（需 HTTPS 或 localhost），请改用图片上传");
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } }).then(function (stream) {
      S.stream = stream;
      S.camOn = true;
      render();
    }).catch(function () {
      S.camOn = false;
      toast("无法访问摄像头，已切换为图片上传模式");
      render();
    });
  }
  function stopCam() {
    if (S.stream) {
      try { S.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
      S.stream = null;
    }
    S.camOn = false;
  }
  function attachCam() {
    if (S.camOn && S.stream) {
      var v = document.getElementById("cam-video");
      if (v && !v.srcObject) {
        v.srcObject = S.stream;
        if (v.play) v.play().catch(function () {});
      }
    }
  }
  /**
   * 把一张图按最大边长缩到 maxW，返回 dataURL。
   * 缩略图（300px）只用于界面与本地存储；送模型的图（1024px/q0.8）单独留一份，
   * 300px 喂给视觉模型会把小字和数量细节糊掉，识别自然不准。
   */
  function fitCanvas(src, maxW, quality) {
    var sw = src.videoWidth || src.naturalWidth || src.width || 1;
    var sh = src.videoHeight || src.naturalHeight || src.height || 1;
    var w = Math.min(maxW, sw);
    var h = Math.max(1, Math.round(sh / sw * w));
    var c = document.createElement("canvas");
    c.width = w; c.height = h;
    c.getContext("2d").drawImage(src, 0, 0, w, h);
    return c.toDataURL("image/jpeg", quality);
  }
  function grabFrame() {
    var v = document.getElementById("cam-video");
    if (!v || !v.videoWidth) return null;
    return { thumb: fitCanvas(v, 300, 0.6), full: fitCanvas(v, 1024, 0.8) };
  }
  function addShots(thumbs, fulls) {
    thumbs.forEach(function (u, i) {
      if (S.shots.length >= 6) return; /* D3：单次连拍 ≤6 张 */
      S.shots.push(u);
      S.shotsFull.push(fulls[i] || u);
    });
    if (thumbs.length && S.shots.length >= 6) toast("单次盘点最多 6 张（D3），超出部分已忽略");
    render();
  }
  function fileToShots(files) {
    var thumbs = [];
    var fulls = [];
    var list = Array.prototype.slice.call(files).slice(0, 6);
    var done = 0;
    if (!list.length) return;
    list.forEach(function (f, i) {
      var img = new Image();
      img.onload = function () {
        thumbs[i] = fitCanvas(img, 300, 0.6);
        fulls[i] = fitCanvas(img, 1024, 0.8);
        if (++done === list.length) addShots(thumbs.filter(Boolean), fulls.filter(Boolean));
      };
      img.onerror = function () { if (++done === list.length) addShots(thumbs.filter(Boolean), fulls.filter(Boolean)); };
      img.src = URL.createObjectURL(f);
    });
  }

  /* 拍照入库浮层的局部事件绑定（文件选择 / 拖拽 / 目标库） */
  function bindIntake() {
    var fi = document.getElementById("intake-files");
    if (fi) {
      fi.addEventListener("change", function (e) {
        if (e.target.files && e.target.files.length) fileToShots(e.target.files);
        e.target.value = "";
      });
    }
    var drop = document.getElementById("intake-drop");
    if (drop) {
      ["dragenter", "dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("drag-over"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("drag-over"); });
      });
      drop.addEventListener("drop", function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) fileToShots(e.dataTransfer.files);
      });
      if (!S.camOn) {
        drop.addEventListener("click", function () { startCam(); }, { once: true });
      }
    }
    var libSel = document.getElementById("intake-lib");
    if (libSel) {
      S.intakeLib = S.intakeLib || (DB.libraries.filter(function (l) { return !l.coopAddOnly; })[0] || {}).id;
      libSel.value = S.intakeLib;
      libSel.addEventListener("change", function () { S.intakeLib = libSel.value; });
    }
  }

  /* ---------- 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toast(msg, action) {
    var wrap = document.getElementById("toasts");
    var el = document.createElement("div");
    el.className = "toast";
    el.setAttribute("role", "status");
    var html = icon("circle-check", 18) + "<span>" + esc(msg) + "</span>";
    if (action) {
      html += '<button type="button" data-action="' + action.action + '">' + esc(action.label) + "</button>";
    }
    el.innerHTML = html;
    wrap.appendChild(el);
    setTimeout(function () {
      el.remove();
    }, 3400);
  }

  function nowTime() {
    return new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
  }

  function genTrend(n, base) {
    var arr = [], v = base;
    for (var i = 0; i < n; i++) {
      v = Math.max(1, v + (Math.sin(i * 1.7) + Math.cos(i * 2.3)) * 1.6);
      arr.push(Math.round(v));
    }
    return arr;
  }

  function genLabels(n) {
    var a = [];
    for (var i = 1; i <= n; i++) a.push(i + "日");
    return a;
  }

  function countUp(el) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var raw = el.textContent;
    var m = raw.match(/(\d+(?:\.\d+)?)(.*)/);
    if (!m) return;
    var target = parseFloat(m[1]);
    var suffix = m[2];
    if (!isFinite(target) || target === 0) return;
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / 1600);
      var e = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function countUpAll() {
    document.querySelectorAll(".bento .stat-value, .donut-top").forEach(countUp);
  }

  function rollNumber(el, from, to, unit) {
    var start = null;
    function step(ts) {
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / 300);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = Math.round(from + (to - from) * eased) + " " + unit;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function confetti() {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var wrap = document.createElement("div");
    wrap.className = "confetti-wrap";
    var colors = ["var(--primary)", "var(--accent)", "var(--tone-amber)", "var(--tone-teal)", "#F2EBDE"];
    for (var i = 0; i < 70; i++) {
      var p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.setProperty("--x", Math.random() * 100 + "%");
      p.style.setProperty("--dx", Math.round(Math.random() * 240 - 120) + "px");
      p.style.setProperty("--rot", Math.round(Math.random() * 720 - 360) + "deg");
      p.style.setProperty("--dur", (1.4 + Math.random() * 1.2).toFixed(2) + "s");
      p.style.setProperty("--delay", (Math.random() * 0.4).toFixed(2) + "s");
      p.style.setProperty("--c", colors[i % colors.length]);
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 3300);
  }

  function flashSuccess(sel, label) {
    var el = document.querySelector(sel);
    if (!el) return;
    var old = el.innerHTML;
    el.innerHTML = icon("check", 16) + " " + label;
    el.classList.add("btn-success");
    setTimeout(function () {
      el.innerHTML = old;
      el.classList.remove("btn-success");
    }, 1400);
  }

  function flyIntake() {
    var items = DB.intake.results.filter(function (x) { return x.name; }).slice(0, 6);
    if (!items.length) return;
    var wrap = document.createElement("div");
    wrap.className = "intake-fly";
    var pills = items
      .map(function (it, i) {
        var tx = Math.round(Math.random() * 220 - 110);
        var ty = Math.round(Math.random() * 200 - 100);
        var rot = Math.round(Math.random() * 40 - 20);
        return (
          '<span class="fly-item" style="--i:' + i + ";--tx:" + tx + "px;--ty:" + ty + "px;--rot:" + rot + 'deg">' +
          (it.img ? '<img src="' + it.img + '" alt="' + esc(it.name) + '" width="46" height="46"/>' : it.emoji) +
          "</span>"
        );
      })
      .join("");
    wrap.innerHTML =
      '<div class="fly-fridge"><img src="assets/img/fridge.jpg" alt="冰箱" width="300" height="300"/><div class="fly-title">正在入库…</div></div>' +
      pills;
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 2000);
  }

  function showCoopSummary(history) {
    var rows = (history || []).slice(-8)
      .map(function (h) {
        return '<div class="cs-row">' + esc(h.from) + " → " + esc(h.to) + " · 「" + esc(h.lib) + "」</div>";
      })
      .join("");
    var wrap = document.createElement("div");
    wrap.className = "coop-summary";
    wrap.innerHTML =
      '<div class="cs-card"><div class="cs-title">本局结算</div>' +
      (rows || '<div class="cs-row">本局没有传牌</div>') +
      '<div class="cs-stamp">数据已清理</div></div>';
    document.body.appendChild(wrap);
    setTimeout(function () { wrap.remove(); }, 3400);
  }

  function aiFollowUp(toSeat) {
    setTimeout(function () {
      if (!DB.workbench) return;
      var target = DB.workbench.seats.filter(function (s) { return s.id === toSeat; })[0];
      if (target && target.libs.length) {
        API.sendLibrary(toSeat, "me", target.libs[0].id).then(function (r2) {
          toast(target.name + " 回敬了一张「" + r2.libName + "」，已按编号合并");
          render();
        });
      }
    }, 1400);
  }

  function showSpeech(name, text) {
    if (!text || !DB.workbench || !DB.workbench.seats) return;
    var seat = DB.workbench.seats.filter(function (s) { return s.name === name; })[0];
    var el = document.querySelector(".seat-" + (seat ? seat.id : "me"));
    if (!el) return;
    var b = document.createElement("div");
    b.className = "speech-bubble";
    b.textContent = text;
    el.appendChild(b);
    setTimeout(function () { b.classList.add("out"); }, 2600);
    setTimeout(function () { b.remove(); }, 3200);
  }

  function positionNavPill() {
    var pill = document.querySelector(".nav-pill");
    var active = document.querySelector(".nav-item.active");
    if (!pill || !active) return;
    var nr = { left: active.offsetLeft, top: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight };
    if (S.pillRect && (S.pillRect.left !== nr.left || S.pillRect.top !== nr.top)) {
      pill.style.transition = "none";
      pill.style.transform = "translate(" + (S.pillRect.left - nr.left) + "px," + (S.pillRect.top - nr.top) + "px)";
      pill.style.width = S.pillRect.width + "px";
      pill.style.height = S.pillRect.height + "px";
      void pill.offsetWidth;
      pill.style.transition = "";
    }
    pill.style.width = nr.width + "px";
    pill.style.height = nr.height + "px";
    pill.style.transform = "translate(" + nr.left + "px," + nr.top + "px)";
    S.pillRect = nr;
  }

  function bindScrollReveal() {
    var els = document.querySelectorAll(".rv:not(.rv-in)");
    if (!els.length) return;
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach(function (el) { el.classList.add("rv-in"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add("rv-in");
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12 });
    els.forEach(function (el) { io.observe(el); });
  }

  function runBusy(key, fn, onDone) {
    S.busy = key;
    render();
    fn()
      .then(function (res) {
        S.busy = "";
        render();
        if (onDone) onDone(res);
      })
      .catch(function (e) {
        S.busy = "";
        render();
        toast("操作失败：" + (e && e.message ? e.message : "请重试"));
      });
  }

  /* 登录成功后：写入真实账号/家庭，清掉本机旧内容，再从该家庭的后端快照恢复。
     没有快照 = 新家庭，保持空库，由用户拍照入库或新建资源库开始。 */
  function hydrateFromBackend(a, account) {
    var fam = (a.families && a.families[0]) || null;
    var name = a.nickname || String(account).split("@")[0];
    var user = {
      name: name,
      phone: account,
      role: (fam && fam.role) || a.role || "管理员",
      initial: name.slice(0, 1)
    };
    var family = fam
      ? { id: fam.id, name: fam.name, memberCount: fam.member_count || 1 }
      : { name: name + "的家", memberCount: 1 };
    API.clearContent();
    if (!fam) {
      API.applyLogin({ user: user, family: family, familyId: "" });
      return Promise.resolve();
    }
    var jobs = [
      window.AUTH.get("/api/families?phone=" + encodeURIComponent(account)).catch(function () { return null; }),
      window.AUTH.get("/api/families/" + encodeURIComponent(fam.id) + "/members").catch(function () { return null; }),
      window.AUTH.get("/api/sync/download/" + encodeURIComponent(fam.id)).catch(function () { return null; })
    ];
    return Promise.all(jobs).then(function (rs) {
      var mine = rs[0] || null;
      var mem = rs[1] || null;
      var snap = rs[2] || null;
      var invite = null;
      var row = mine && mine.families
        ? mine.families.filter(function (f) { return f.id === fam.id; })[0]
        : null;
      if (row && row.invite_code) {
        invite = { code: row.invite_code, familyId: fam.id, expiresInDays: 7, used: 0, max: 3, revoked: false };
      }
      var members = {};
      if (mem && mem.members) {
        members[fam.id] = mem.members.map(function (m) {
          return { phone: m.phone, name: m.nickname || m.phone, role: m.role || "成员" };
        });
      }
      API.applyLogin({
        user: user, family: family, familyId: fam.id,
        families: a.families, members: members, invite: invite
      });
      if (snap && snap.payload) API.applyPayload(snap.payload);
      return null;
    });
  }

  function bindLoginForm() {
    var form = document.getElementById("login-form");
    if (!form) return;
    /* 标明连接目标：登录走的是你自己电脑上的局域网服务器，不是云端（与鸿蒙端登录页同口径） */
    var srv = document.getElementById("login-server");
    /* 输入值存进 S：倒计时/提示会触发 render 重建登录视图，不存就会把用户填的内容清空 */
    var _ph = document.getElementById("login-phone");
    var _cd = document.getElementById("login-code");
    if (_ph) _ph.addEventListener("input", function (e) { S.loginPhone = e.target.value; });
    if (_cd) _cd.addEventListener("input", function (e) { S.loginCode = e.target.value; });
    if (srv && window.AUTH) {
      window.AUTH.ready().then(function (base) {
        srv.textContent = base
          ? "已连接 " + base + "（局域网自建服务器）"
          : "未找到本机后端：请先在电脑上启动 backend（tools\\start-lan.ps1），可在「设置 → 服务器连接」改地址";
      });
    }
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var phone = document.getElementById("login-phone").value.trim();
      var code = document.getElementById("login-code").value.trim();
      var err = document.getElementById("login-err");
      /* 只支持邮箱登录/注册（不接收手机号） */
      var okPhone = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(phone);
      if (!okPhone) {
        err.hidden = false;
        err.textContent = "请输入邮箱地址（本项目只支持邮箱登录）";
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        err.hidden = false;
        err.textContent = "请输入 6 位验证码";
        return;
      }
      err.hidden = true;
      runBusy("login", function () {
        /* 只走真实后端：验证码由后端下发/校验，不再有固定演示码与本地登录兜底 */
        return window.AUTH.login(phone, code).then(function (a) {
          if (!a || !a.ok) {
            throw new Error((a && a.error) || "登录失败：请检查验证码，或后端是否已启动");
          }
          return hydrateFromBackend(a, phone);
        }).then(function () {
          loggedIn = true;
          localStorage.setItem("nexcore_logged_in", "1");
          S.view = "aiwork";
          lastViewKey = "";
          return null;
        });
      }, function () {
        render();
        if (window.LIVEFLOW && DB.familyId) {
          window.LIVEFLOW.start(DB.familyId);
          /* 新家庭没有快照：先把空快照落一份，之后由活同步接管 */
          setTimeout(function () { window.LIVEFLOW.upload(true).catch(function () {}); }, 800);
        }
        toast("欢迎回来，" + DB.user.name + "（" + DB.user.role + "）");
      });
    });
  }

  /* ---------- 图表 ---------- */
  function lineChart(a, b, colorA, colorB, labels) {
    var w = 560, h = 176, pad = 12;
    labels = labels || ["一", "二", "三", "四", "五", "六", "日"];
    var stepX = (w - pad * 2) / (a.length - 1);
    function series(points, color) {
      var max = Math.max.apply(null, points);
      var min = Math.min.apply(null, points);
      var span = max - min || 1;
      var pts = points.map(function (v, i) {
        return [pad + i * stepX, h - pad - ((v - min) / span) * (h - pad * 2)];
      });
      var line = pts.map(function (p, i) {
        return (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1);
      }).join(" ");
      var area = "M" + pts[0][0].toFixed(1) + " " + (h - pad) + " " + line + " L" + pts[pts.length - 1][0].toFixed(1) + " " + (h - pad) + " Z";
      return { line: line, area: area, color: color, pts: pts };
    }
    var s1 = series(a, colorA);
    var s2 = series(b, colorB);
    var grid = [0.25, 0.5, 0.75].map(function (f) {
      var y = h - pad - f * (h - pad * 2);
      return '<line x1="' + pad + '" y1="' + y + '" x2="' + (w - pad) + '" y2="' + y + '" stroke="var(--border)" stroke-width="1"/>';
    }).join("");
    var xlabels = labels
      .map(function (lb, i) {
        return '<text class="chart-x" x="' + (pad + i * stepX).toFixed(1) + '" y="' + (h - 2) + '" text-anchor="middle">' + lb + "</text>";
      })
      .join("");
    var pts = s1.pts
      .map(function (p, i) {
        return '<circle class="pt" style="--i:' + i + '" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.5" fill="' + colorA + '"/>';
      })
      .join("");
    return (
      '<svg class="chart-wrap line-chart" viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="近 7 天消耗与入库趋势" ' +
      'data-a="' + a.join(",") + '" data-b="' + b.join(",") + '" data-labels="' + labels.join(",") + '">' +
      grid +
      '<path class="fade-area" style="--ao:0.1" d="' + s2.area + '" fill="' + s2.color + '" opacity="0.1"/>' +
      '<path class="draw-line line-sub" pathLength="1" d="' + s2.line + '" fill="none" stroke="' + s2.color + '" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path class="fade-area" style="--ao:0.14;animation-delay:.18s" d="' + s1.area + '" fill="' + s1.color + '" opacity="0.14"/>' +
      '<path class="draw-line line-main" pathLength="1" d="' + s1.line + '" fill="none" stroke="' + s1.color + '" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>' +
      pts +
      xlabels +
      "</svg>"
    );
  }

  function donutChart(segs, centerTop, centerBottom) {
    var r = 70, c = 90, total = 0, off = 0;
    segs.forEach(function (s) { total += s.value; });
    var circ = 2 * Math.PI * r;
    var parts = "";
    segs.forEach(function (s, i) {
      var frac = total ? s.value / total : 0;
      var dash = Math.max(0, frac * circ - 1.6);
      parts +=
        '<circle class="donut-draw" style="--dash:' + dash + ";--circ:" + circ + '" cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + s.color + '" stroke-width="24" ' +
        'stroke-dasharray="' + dash + " " + (circ - dash) + '" stroke-dashoffset="' + -off + '" transform="rotate(-90 ' + c + " " + c + ')"/>' +
        '<circle class="donut-seg" data-i="' + i + '" cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="transparent" stroke-width="30" ' +
        'stroke-dasharray="' + dash + " " + (circ - dash) + '" stroke-dashoffset="' + -off + '" transform="rotate(-90 ' + c + " " + c + ')"/>';
      off += frac * circ;
    });
    return (
      '<svg class="donut" viewBox="0 0 180 180" role="img" aria-label="库存构成占比" ' +
      'data-labels="' + segs.map(function (s) { return s.label; }).join(",") + '" data-values="' + segs.map(function (s) { return s.value; }).join(",") + '">' +
      parts +
      '<text class="donut-top" x="90" y="86" text-anchor="middle">' + centerTop + "</text>" +
      '<text class="donut-sub" x="90" y="106" text-anchor="middle">' + centerBottom + "</text></svg>"
    );
  }

  function ringChart(pct, label, value, color) {
    var r = 52, c = 64, circ = 2 * Math.PI * r;
    var dash = (pct / 100) * circ;
    return (
      '<svg class="ring" viewBox="0 0 128 128" role="img" aria-label="' + label + " " + pct + '%">' +
      '<circle cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="var(--surface-overlay)" stroke-width="12"/>' +
      '<circle class="ring-draw" style="--dash:' + dash + ";--circ:" + circ + '" cx="' + c + '" cy="' + c + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="12" stroke-linecap="round" ' +
      'stroke-dasharray="' + dash + " " + circ + '" transform="rotate(-90 ' + c + " " + c + ')"/>' +
      '<text class="ring-top" x="64" y="62" text-anchor="middle">' + value + "</text>" +
      '<text class="ring-sub" x="64" y="80" text-anchor="middle">' + label + "</text></svg>"
    );
  }

  function hbars(list) {
    var max = 1;
    list.forEach(function (x) { if (x.v > max) max = x.v; });
    return list
      .map(function (x) {
        return (
          '<div class="hbar-row"><span class="hbar-label">' + esc(x.name) + "</span>" +
          '<div class="hbar-track"><div class="hbar-fill" style="width:' + Math.round((x.v / max) * 100) + '%"></div></div>' +
          '<span class="hbar-val num">' + x.v + " 次</span></div>"
        );
      })
      .join("");
  }

  function tip(card) {
    var t = card.querySelector(".chart-tip");
    if (!t) {
      t = document.createElement("div");
      t.className = "chart-tip";
      t.setAttribute("role", "tooltip");
      card.appendChild(t);
    }
    return t;
  }

  function bindChartTips() {
    var line = document.querySelector(".line-chart");
    if (line) {
      var a = line.getAttribute("data-a").split(",").map(Number);
      var b = line.getAttribute("data-b").split(",").map(Number);
      var labels = line.getAttribute("data-labels").split(",");
      var card = line.closest(".card");
      var rect, scale, pad = 12, stepX;
      line.addEventListener("mousemove", function (e) {
        rect = line.getBoundingClientRect();
        scale = rect.width / 560;
        stepX = (560 - pad * 2) / (a.length - 1);
        var x = (e.clientX - rect.left) / scale;
        var i = Math.max(0, Math.min(a.length - 1, Math.round((x - pad) / stepX)));
        var t = tip(card);
        t.textContent = labels[i] + " · 消耗 " + a[i] + " 件 · 采购 " + b[i] + " 件";
        var left = e.clientX - rect.left + 14;
        var top = e.clientY - rect.top - 12;
        if (left + t.offsetWidth > rect.width - 8) left = e.clientX - rect.left - t.offsetWidth - 14;
        t.style.left = left + "px";
        t.style.top = Math.max(4, top - t.offsetHeight - 8) + "px";
        t.style.opacity = "1";
      });
      line.addEventListener("mouseleave", function () {
        var t = card.querySelector(".chart-tip");
        if (t) t.style.opacity = "0";
      });
    }
    var donut = document.querySelector(".donut");
    if (donut) {
      var labels2 = donut.getAttribute("data-labels").split(",");
      var values = donut.getAttribute("data-values").split(",").map(Number);
      var total = values.reduce(function (s, v) { return s + v; }, 0);
      var card2 = donut.closest(".card");
      donut.querySelectorAll(".donut-seg").forEach(function (seg, i) {
        seg.addEventListener("mousemove", function (e) {
          var t = tip(card2);
          t.textContent = labels2[i] + " · " + values[i] + " 件 · " + Math.round((values[i] / total) * 100) + "%";
          var r = card2.getBoundingClientRect();
          var left = e.clientX - r.left + 14;
          if (left + t.offsetWidth > r.width - 8) left = e.clientX - r.left - t.offsetWidth - 14;
          t.style.left = left + "px";
          t.style.top = (e.clientY - r.top - t.offsetHeight - 10) + "px";
          t.style.opacity = "1";
        });
        seg.addEventListener("mouseleave", function () {
          var t = card2.querySelector(".chart-tip");
          if (t) t.style.opacity = "0";
        });
      });
    }
  }

  /* ---------- 公共组件 ---------- */
  function libraryTone(lib) {
    return {
      teal: ["var(--tone-teal)", "var(--tone-teal-bg)"],
      indigo: ["var(--tone-indigo)", "var(--tone-indigo-bg)"],
      red: ["var(--tone-red)", "var(--tone-red-bg)"],
      slate: ["var(--tone-slate)", "var(--tone-slate-bg)"],
      lime: ["var(--tone-lime)", "var(--tone-lime-bg)"],
      brown: ["var(--tone-brown)", "var(--tone-brown-bg)"],
      orange: ["var(--tone-orange)", "var(--tone-orange-bg)"],
      violet: ["var(--tone-violet)", "var(--tone-violet-bg)"],
      amber: ["var(--tone-amber)", "var(--tone-amber-bg)"]
    }[lib.tone] || ["var(--primary)", "var(--primary-container)"];
  }

  function planCard(p, compact) {
    var cls = compact ? "plan-card plan-card--flat" : "plan-card";
    var tone = p.priority === "高" ? "red" : "amber";
    var fire = p.priority === "高" ? "大火" : "中火";
    if (!p.selected) p.selected = p.used.map(function (u) { return u.name; });
    var consume = p.used
      .map(function (u) {
        var checked = p.status === "done" || p.selected.indexOf(u.name) > -1;
        return (
          '<div class="consume-item' + (checked ? " checked" : "") + '" data-action="plan:part" data-plan="' + p.id + '" data-name="' + esc(u.name) + '" role="checkbox" aria-checked="' + checked + '" tabindex="0" title="点击选择是否消耗该食材">' +
          '<span class="consume-check">' + icon("check", 12) + "</span>" +
          '<span class="consume-name">' + esc(u.name) + " × " + esc(u.qty) + "</span></div>"
        );
      })
      .join("");
    var missing = p.missing.length
      ? '<div class="plan-meta"><span>缺料：' + p.missing.map(function (m) { return esc(m.name) + " " + esc(m.qty); }).join("、") + '</span></div>'
      : '<div class="plan-meta"><span class="badge badge-success">食材齐全</span></div>';
    var nutri = p.kcal
      ? '<div class="plan-meta"><span>' + icon("leaf", 14) + " 营养速览（约，估算）：" + p.kcal + " kcal/份 · 蛋白 " + (p.prot || 0) + "g</span></div>"
      : "";
    var foot =
      p.status === "done"
        ? '<div class="plan-foot"><span class="badge badge-success">' + icon("check", 12) + ' 已执行</span><button class="btn btn-ghost btn-sm" data-action="plan:undo" data-busy="plan:undo" data-id="' + p.id + '">' + icon("undo", 15) + ' 撤销</button></div>'
        : '<div class="plan-foot"><button class="btn btn-primary btn-sm" data-action="plan:run" data-busy="plan:run" data-id="' + p.id + '">' + icon("check", 15) + ' 勾选执行</button></div>';
    return (
      '<div class="' + cls + '">' +
      '<div class="plan-head"><span class="badge badge-' + tone + '">' + icon("flame", 12) + " " + fire + "</span><span class='plan-title'>" + esc(p.title) + "</span><span class='badge badge-teal'>AI 生成</span>" + (p.creative ? '<span class="badge badge-teal">' + icon("sparkles", 12) + " AI 创新</span>" : "") + "</div>" +
      '<div class="plan-meta"><span>' + icon("clock", 14) + " " + esc(p.time) + "</span><span>" + icon("sparkles", 14) + " " + esc(p.source) + "</span><span>" + esc(p.reason) + "</span></div>" +
      '<div class="consume-list">' + consume + "</div>" +
      nutri +
      missing +
      foot +
      "</div>"
    );
  }

  /* ---------- 视图 ---------- */
  function greetWord() {
    var h = new Date().getHours();
    return h < 6 ? "夜深了" : h < 12 ? "早上好" : h < 18 ? "下午好" : "晚上好";
  }

  function viewDashboard() {
    var stats = window.API.getStats();
    if (!DB.libraries.length) {
      return (
        '<div class="view"><div class="view-head"><div><h1 class="view-title">' + greetWord() + "，" + esc(DB.user.name) + "</h1>" +
        '<p class="view-sub">先从建一个资源库开始，拍张照片让 AI 帮你建。</p></div></div>' +
        '<div class="card empty"><div class="empty-icon">' + icon("folder-plus", 24) + "</div>" +
        '<div class="empty-title">还没有资源库</div><div class="empty-sub">建一个库，或用拍照快速入库</div>' +
        '<div style="display:flex;gap:12px;justify-content:center;margin-top:16px">' +
        '<button class="btn btn-primary" data-action="overlay:open" data-type="newlib">' + icon("folder-plus", 16) + " 新建库</button></div></div></div>"
      );
    }
    var expiring = DB.alerts.filter(function (a) { return a.type === "expiring" || a.type === "medicine"; });
    var todoTones = ["var(--tone-teal)", "var(--tone-amber)", "var(--tone-red)"];
    var todoTilts = [-1.4, 1.1, -0.7];
    var todos = DB.daily
      .map(function (t, ti) {
        return (
          '<div class="todo-item' + (t.done ? " done" : "") + '" style="--tilt:' + todoTilts[ti % 3] + "deg;--magnet:" + todoTones[ti % 3] + '" data-action="daily:check" data-id="' + t.id + '" role="checkbox" aria-checked="' + t.done + '" tabindex="0">' +
          '<span class="todo-check">' + icon("check", 13) + "</span>" +
          '<span class="todo-text">' + esc(t.text) + "</span></div>"
        );
      })
      .join("");
    var stats4 = [
      { icon: "package", label: "资源总数", value: String(stats.totalItems), delta: DB.libraries.length + " 个库 · 实时统计", up: true, tone: "teal" },
      { icon: "clock", label: "临期预警", value: String(stats.expiringN), delta: stats.expiringN ? "今日需处理" : "暂无临期", up: false, warn: stats.expiringN > 0, tone: "amber" },
      { icon: "list-check", label: "方案执行率", value: stats.planPct + "%", delta: stats.planDone + " / " + stats.planTotal + " 个方案", up: true, tone: "teal" },
      { icon: "wallet", label: "本月花费", value: "¥" + stats.spent, delta: "预算 ¥" + stats.budget, up: false, warn: stats.spent > stats.budget, tone: "teal" }
    ];
    var trend = stats.trend;
    var recent = DB.logs.slice(0, 6);
    var briefing = (DB.settings && DB.settings.briefing) || "";
    return (
      '<div class="view">' +
      '<div class="view-head"><div><h1 class="view-title">' + greetWord() + "，" + esc(DB.user.name) + "</h1>" +
      '<p class="view-sub">' + (new Date().getMonth() + 1) + " 月 " + new Date().getDate() + " 日 · 多云 26°C（示例天气） · 家庭空间：" + esc(DB.family.name) + "</p></div>" +
      '<span class="demo-note">' + icon("sparkles", 14) + " 自建后端 · 数据实时计算</span></div>" +
      '<div class="bento">' +
      stats4
        .map(function (s) {
          var tone = libraryTone({ tone: s.tone });
          return (
            '<div class="card kpi-tile cell cell-3"><div class="stat-icon" style="background:' + tone[1] + ";color:" + tone[0] + '">' + icon(s.icon, 20) + "</div>" +
            '<div><div class="stat-value num">' + s.value + '</div><div class="stat-label">' + s.label +
            '</div><div class="stat-delta ' + (s.warn ? "warn" : "up") + '">' + s.delta + "</div></div></div>"
          );
        })
        .join("") +
      '<div class="cell cell-8"><div class="hero-main"><div class="hero-kicker">' + icon("sun", 16) + ' 今日摘要 <span class="hero-clock num" id="hero-clock">' + nowTime() + "</span></div>" +
      '<h2 class="hero-title">' + (DB.daily.length ? DB.daily.length + " 件事值得优先处理" : "今天一切正常") + "</h2>" +
      '<p class="hero-sub">临期食材先消耗，药品库存记得确认。以下是 AI 按优先级排好的清单。</p>' +
      '<div class="todo-list">' + (todos || '<div class="empty-sub" style="padding:8px 0">暂无待办，库存很健康</div>') + "</div>" +
      '<button class="btn btn-primary" style="margin-top:24px" data-action="ai:toggle">' + icon("sparkles", 16) + " 问 AI 今晚吃什么</button></div></div>" +
      '<div class="cell cell-4"><div class="card chart-card"><div class="card-head"><div><div class="card-title">库存构成</div><div class="card-sub">按库件数占比 · 实时</div></div></div>' +
      '<div class="donut-wrap">' +
      donutChart(
        DB.libraries.map(function (l) {
          return { label: l.name, value: l.count || 0, color: libraryTone(l)[0] };
        }),
        String(stats.totalItems),
        "件 · " + DB.libraries.length + " 个库"
      ) +
      '<div class="donut-legend">' +
      DB.libraries
        .map(function (l) {
          var tone = libraryTone(l);
          var pct = stats.totalItems ? Math.round(((l.count || 0) / stats.totalItems) * 100) : 0;
          return (
            '<div class="legend-row"><span class="legend-dot" style="background:' + tone[0] + '"></span>' +
            '<span class="legend-name">' + esc(l.name) + "</span>" +
            '<span class="legend-val num">' + (l.count || 0) + " · " + pct + "%</span></div>"
          );
        })
        .join("") +
      "</div></div></div></div>" +
      '<div class="cell cell-7 rv"><div class="card chart-card"><div class="card-head"><div><div class="card-title">食材趋势</div><div class="card-sub">消耗与入库 · 与操作日志对账（F7.2）</div></div></div>' +
      lineChart(trend.consume, trend.purchase, "var(--primary)", "var(--accent)", trend.labels) +
      '<div class="chart-legend"><span class="legend-item"><span class="legend-swatch" style="background:var(--primary)"></span>消耗</span>' +
      '<span class="legend-item"><span class="legend-swatch" style="background:var(--accent)"></span>入库</span></div></div></div>' +
      '<div class="cell cell-5 rv"><div class="card"><div class="card-head"><div><div class="card-title">本周小结</div><div class="card-sub">统计由代码计算</div></div><span class="badge badge-teal">' + icon("sparkles", 12) + " 实时</span></div>" +
      '<div class="summary-wrap">' +
      ringChart(
        stats.planPct,
        "方案执行率",
        stats.planDone + "/" + stats.planTotal,
        "var(--primary)"
      ) +
      '<div class="summary-list">' +
      '<div class="mini-stat"><span class="mini-icon" style="background:var(--tone-orange-bg);color:var(--tone-orange)">' + icon("sparkles", 16) + "</span><div><div class='mini-label'>库存估算 · 还能做</div><div class='mini-value num'>" + stats.mealsLeft + " 顿饭 · 约 " + stats.daysLeft + " 天</div></div></div>" +
      '<div class="mini-stat"><span class="mini-icon" style="background:var(--tone-teal-bg);color:var(--tone-teal)">' + icon("wallet", 16) + "</span><div><div class='mini-label'>本月采购</div><div class='mini-value num'>¥" + stats.spent + " · 预算 ¥" + stats.budget + "</div></div></div>" +
      '<div class="mini-stat"><span class="mini-icon" style="background:var(--tone-lime-bg);color:var(--tone-lime)">' + icon("package", 16) + "</span><div><div class='mini-label'>低库存（D4 lowAt）</div><div class='mini-value num'>" + stats.lowN + " 项</div></div></div>" +
      '<div class="mini-stat"><span class="mini-icon" style="background:var(--tone-amber-bg);color:var(--tone-amber)">' + icon("thermometer", 16) + "</span><div><div class='mini-label'>库存健康度</div><div class='mini-value num'>" + stats.health + "% · " + (stats.health > 80 ? "良好" : "需整理") + "</div></div></div>" +
      "</div></div></div></div>" +
      '<div class="cell cell-4 rv"><div class="card"><div class="card-head"><div><div class="card-title">最近动态</div><div class="card-sub">操作日志 · 全程留痕（F6.4）</div></div></div>' +
      (recent.length
        ? '<div class="logs-list">' +
          recent
            .map(function (l) {
              return '<div class="log-row"><span class="log-action">' + esc(l.action) + "</span><span>" + esc(l.detail) + "</span></div>";
            })
            .join("") +
          "</div>"
        : '<div class="empty" style="padding:16px"><div class="empty-sub">暂无操作记录</div></div>') +
      "</div></div>" +
      '<div class="cell cell-8 rv"><div class="section-head"><h2 class="section-title">临期提醒</h2><button class="link-btn" data-action="overlay:open" data-type="alerts">查看全部 ' + icon("arrow-right", 14) + "</button></div>" +
      '<div class="alert-list">' +
      expiring
        .slice(0, 4)
        .map(function (a) {
          var tone = libraryTone({ tone: a.tone });
          return (
            '<div class="alert-item"><div class="alert-icon" style="background:' + tone[1] + ";color:" + tone[0] + '">' + icon(a.icon, 20) + "</div>" +
            '<div><div class="alert-text">' + esc(a.text) + '</div><div class="alert-meta">' + esc(a.meta) + "</div></div>" +
            '<button class="btn btn-ghost btn-sm" data-action="overlay:open" data-type="plans">看方案</button></div>'
          );
        })
        .join("") +
      (expiring.length ? "" : '<div class="card empty" style="padding:20px"><div class="empty-sub">暂无临期预警</div></div>') +
      "</div></div>" +
      '<div class="cell cell-12 rv"><div class="card"><div class="card-head"><div><div class="card-title">智能洞察</div><div class="card-sub">看板 AI 简报（P0-6 · 统计代码计算，AI 仅润色）</div></div><button class="btn btn-soft btn-sm" data-action="briefing:gen" data-busy="briefing">' + icon("sparkles", 12) + (briefing ? " 重新生成" : " 生成简报") + "</button></div>" +
      (briefing
        ? '<p style="font-size:14px;color:var(--text-secondary)"><span class="badge badge-teal" style="margin-right:6px">AI 生成</span>' + esc(briefing) + "</p>"
        : '<p style="font-size:14px;color:var(--text-muted)">点击「生成简报」，AI 会基于近 7 天消耗 / 入库 / 临期 / 低库存统计生成一份周报摘要。</p>') +
      '<button class="btn btn-soft btn-sm" style="margin-top:16px" data-action="overlay:open" data-type="shopping">查看采购清单 ' + icon("arrow-right", 14) + "</button></div></div>" +
      "</div></div>"
    );
  }

  function viewLibraries() {
    var cubbies = DB.libraries
      .map(function (lib, i) {
        var tone = libraryTone(lib);
        var menuOpen = S.libMenu === lib.id;
        return (
          '<div class="cubby" style="--i:' + i + '" data-action="lib:open" data-id="' + lib.id + '" data-drag="lib" draggable="true" role="button" tabindex="0">' +
          '<span class="cubby-icon" style="background:' + tone[1] + ";color:" + tone[0] + '">' + icon(lib.icon, 22) + "</span>" +
          '<span class="cubby-name">' + esc(lib.name) + "</span>" +
          '<span class="cubby-count num">' + lib.count + " 件</span>" +
          '<button class="icon-btn lib-menu-btn" data-action="lib:menu" data-id="' + lib.id + '" aria-label="更多操作" aria-expanded="' + menuOpen + '">' + icon("more", 16) + "</button>" +
          (menuOpen
            ? '<div class="lib-menu" role="menu">' +
              '<button class="family-item" data-action="lib:edit" data-id="' + lib.id + '" role="menuitem">' + icon("edit", 15) + "<span>重命名</span></button>" +
              '<button class="family-item" data-action="lib:move" data-id="' + lib.id + '" data-dir="-1" role="menuitem">' + icon("arrow-up", 15) + "<span>上移</span></button>" +
              '<button class="family-item" data-action="lib:move" data-id="' + lib.id + '" data-dir="1" role="menuitem">' + icon("arrow-down", 15) + "<span>下移</span></button>" +
              '<button class="family-item" data-action="lib:del" data-id="' + lib.id + '" role="menuitem">' + icon("trash", 15) + "<span>删除</span></button>" +
              "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");
    cubbies +=
      '<button class="cubby cubby-new" style="--i:' + DB.libraries.length + '" data-action="overlay:open" data-type="newlib">' +
      '<span class="cubby-icon">' + icon("folder-plus", 22) + "</span>" +
      '<span class="cubby-name">新建库</span><span class="cubby-count">+</span></button>';
    return (
      '<div class="view">' +
      '<div class="view-head"><div><h1 class="view-title">资源库</h1><p class="view-sub">' + DB.libraries.length + " 个库，拍照自动归类，也可自建。</p></div>" +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost cabinet-toggle-btn" data-action="cabinet:toggle">' + icon("door", 16) + (S.cabinetOpen ? " 关上柜门" : " 打开柜门") + "</button>" +
      '<button class="btn btn-ghost" data-action="overlay:open" data-type="intake">' + icon("camera", 16) + " 拍照入库</button>" +
      '<button class="btn btn-ghost" data-action="lib:import">' + icon("upload", 16) + " 导入 CSV</button>" +
      '<button class="btn btn-ghost" data-action="lib:export">' + icon("download", 16) + " 导出 CSV</button>" +
      "</div></div>" +
      '<input type="file" id="import-file" accept=".csv,text/csv" hidden/>' +
      '<div class="cabinet' + (S.cabinetOpen ? "" : " closed") + '">' +
      '<div class="cabinet-door door-l"><button class="cabinet-knob" data-action="cabinet:toggle" aria-label="开关柜门"></button></div>' +
      '<div class="cabinet-door door-r"><button class="cabinet-knob" data-action="cabinet:toggle" aria-label="开关柜门"></button></div>' +
      '<div class="cabinet-interior">' +
      '<div class="cabinet-top"><span>' + icon("library", 14) + " 启核图策 · 资源柜</span><span class='num'>" + DB.libraries.length + " 个库</span></div>" +
      '<div class="cubby-grid">' + cubbies + "</div>" +
      "</div></div>" +
      "</div>"
    );
  }

  function viewLibraryDetail(id) {
    var lib = DB.libraries.filter(function (l) { return l.id === id; })[0];
    if (!lib) return viewLibraries();
    var tone = libraryTone(lib);
    var items = lib.items || [];
    var counts = {
      all: items.length,
      expiring: items.filter(function (i) { return i.expiring; }).length,
      cold: items.filter(function (i) { return (i.pos || "").indexOf("冷藏") > -1; }).length,
      frozen: items.filter(function (i) { return (i.pos || "").indexOf("冷冻") > -1; }).length
    };
    var chips = [
      { f: "all", label: "全部 " + counts.all },
      { f: "expiring", label: "临期 " + counts.expiring },
      { f: "cold", label: "冷藏 " + counts.cold },
      { f: "frozen", label: "冷冻 " + counts.frozen }
    ];
    var filtered = items.filter(function (it) {
      if (S.itemFilter === "expiring") return it.expiring;
      if (S.itemFilter === "cold") return (it.pos || "").indexOf("冷藏") > -1;
      if (S.itemFilter === "frozen") return (it.pos || "").indexOf("冷冻") > -1;
      return true;
    });
    var rows = filtered
      .map(function (it) {
        var soon = (DB.settings && DB.settings.alertSoon) || 7;
        var crit = (DB.settings && DB.settings.alertCritical) || 3;
        var expBadge = it.expDays >= 9000
          ? '<span class="badge badge-muted">长保质期</span>'
          : it.expDays <= crit
            ? '<span class="badge badge-red pulse">' + it.expDays + " 天到期</span>"
            : it.expDays <= soon
              ? '<span class="badge badge-amber">' + it.expDays + " 天</span>"
              : '<span class="badge badge-muted">' + it.expDays + " 天</span>";
        return (
          '<div class="item-row">' +
          '<div class="item-photo">' + (it.img ? '<img src="' + it.img + '" alt="' + esc(it.name) + '" width="40" height="40" loading="lazy"/>' : "<span>" + it.emoji + "</span>") + "</div>" +
          '<div><div class="item-name">' + esc(it.name) + (it.private ? " <span class='private-mark'>" + icon("shield", 11) + " 仅自己</span>" : "") + "</div>" +
          '<div class="item-meta">' + esc(it.pos) + " · " + expBadge + (it.no ? ' <span class="item-no num">' + esc(it.no) + "</span>" : "") + "</div>" +
          (it.kbKey && window.KNOWLEDGE && window.KNOWLEDGE[it.kbKey]
            ? '<div class="exp-bar"><span class="exp-fill' + (it.expDays / window.KNOWLEDGE[it.kbKey].days < 0.3 ? " exp-danger" : "") + '" style="width:' + Math.max(4, Math.min(100, Math.round((it.expDays / window.KNOWLEDGE[it.kbKey].days) * 100))) + '%"></span></div>'
            : "") +
          "</div>" +
          '<div class="stepper"><button class="stepper-btn" data-action="item:minus" data-busy="item:minus" data-id="' + it.id + '" aria-label="减少数量">' + icon("minus", 14) + "</button>" +
          '<span class="stepper-val num" data-id="' + it.id + '">' + it.qty + " " + it.unit + "</span>" +
          '<button class="stepper-btn" data-action="item:plus" data-busy="item:plus" data-id="' + it.id + '" aria-label="增加数量">' + icon("plus", 14) + "</button></div>" +
          '<div class="item-price num">¥' + (Number(it.price) || 0).toFixed(2) + '<span class="price-src">' + esc(it.priceSrc) + "</span></div>" +
          '<button class="icon-btn" style="width:28px;height:28px" data-action="item:edit" data-lib="' + lib.id + '" data-id="' + it.id + '" aria-label="编辑 ' + esc(it.name) + '">' + icon("more", 16) + "</button>" +
          "</div>"
        );
      })
      .join("");
    return (
      '<div class="view">' +
      '<div class="drawer-handle" aria-hidden="true"></div>' +
      '<div class="view-head"><div><div class="view-kicker" style="display:flex;align-items:center;gap:8px;margin-bottom:8px">' +
      '<button class="btn btn-ghost btn-sm" data-action="lib:back">' + icon("arrow-left", 14) + " 返回</button></div>" +
      "<h1 class='view-title'>" + esc(lib.name) + "</h1><p class='view-sub'>" + esc(lib.desc) + " · 共 " + lib.count + " 件</p></div>" +
      '<div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn btn-primary" data-action="overlay:open" data-type="intake">' + icon("camera", 16) + " 拍照入库</button>" +
      '<button class="btn btn-ghost" data-action="item:add" data-lib="' + lib.id + '">' + icon("plus", 16) + " 手动添加</button></div></div>" +
      '<div class="card"><div class="card-head"><div><div class="card-title">库存清单</div><div class="card-sub">点击 +/- 调整数量；点食材名可单独勾选消耗</div></div>' +
      '<div class="chip-row">' +
      chips
        .map(function (c) {
          return '<button class="chip' + (S.itemFilter === c.f ? " active" : "") + '" data-action="filter:items" data-filter="' + c.f + '">' + c.label + "</button>";
        })
        .join("") +
      "</div></div>" +
      '<div class="item-list">' + (rows.length ? rows : '<div class="empty" style="padding:24px"><div class="empty-sub">这个筛选下没有物品</div></div>') + "</div></div>" +
      "</div>"
    );
  }

  function viewIntake() {
    var steps = ["拍摄 / 上传", "AI 识别与补缺", "确认入库"];
    var stepIdx = DB.intake.step === 1 ? 1 : 0;
    var stepHtml = steps
      .map(function (s, i) {
        var state = i < stepIdx ? "done" : i === stepIdx ? "active" : "";
        return (
          '<div class="step ' + state + '"><span class="step-num">' + (i < stepIdx ? icon("check", 12) : i + 1) + "</span>" + s + "</div>" +
          (i < 2 ? '<div class="step-line' + (i < stepIdx ? " done" : "") + '"></div>' : "")
        );
      })
      .join("");
    var body;
    if (stepIdx === 0) {
      var shotStrip = S.shots
        .map(function (u, i) {
          return (
            '<div class="shot-thumb"><img src="' + u + '" alt="待识别图片 ' + (i + 1) + '" width="64" height="64"/>' +
            '<button class="icon-btn shot-del" data-action="intake:remove" data-idx="' + i + '" aria-label="移除图片">' + icon("x", 12) + "</button></div>"
          );
        })
        .join("");
      body =
        '<div class="viewfinder" id="intake-drop" role="button" tabindex="0" aria-label="拍摄或拖入图片">' +
        '<div class="viewfinder-frame">' + (S.camOn ? '<video id="cam-video" autoplay playsinline muted></video>' : '<div class="cam-fallback">' + icon("camera", 30) + "<div>摄像头未开启 · 可上传图片</div></div>") +
        '<span class="vf-corner vf-tl"></span><span class="vf-corner vf-tr"></span><span class="vf-corner vf-bl"></span><span class="vf-corner vf-br"></span>' +
        '<span class="vf-scan" aria-hidden="true"></span>' +
        '<div class="vf-hint">' + icon("scan", 14) + " 对准物品 · 拖拽图片到此处也可以</div></div>" +
        '<div class="dropzone-title">' + (S.shots.length ? "已拍摄 " + S.shots.length + " / 6 张（D3）" : "拍一张或上传图片") + "</div>" +
        '<div class="dropzone-sub">AI 自动识别名称、数量、保质期与价格；同名物品自动合并数量（连拍 ≤6 张）</div>' +
        (S.shots.length ? '<div class="shot-strip">' + shotStrip + "</div>" : "") +
        '<div class="dropzone-actions">' +
        '<button class="btn btn-primary" data-action="intake:shoot">' + icon("camera", 16) + " 拍一张</button>" +
        '<button class="btn btn-ghost" data-action="intake:cam">' + icon("scan", 16) + (S.camOn ? " 关闭摄像头" : " 打开摄像头") + "</button>" +
        '<button class="btn btn-ghost" data-action="intake:file">' + icon("upload", 16) + " 选择图片</button>" +
        '<button class="btn btn-primary" data-action="intake:recognize" data-busy="intake:recognize"' + (S.shots.length ? "" : " disabled") + ">" + icon("sparkles", 16) + " 开始识别</button></div>" +
        '<input type="file" id="intake-files" accept="image/*" multiple hidden/>';
    } else {
      if (S.intakeLoading) {
        body = '<div class="skeleton"><div class="skeleton-line mid"></div><div class="skeleton-line short"></div><div class="skeleton-line"></div><div class="skeleton-line short"></div></div>';
      } else {
        var named = DB.intake.results.filter(function (x) { return x.name; }).length;
        var unknown = DB.intake.results.length - named;
        var libSel =
          '<select id="intake-lib" aria-label="选择入库目标库">' +
          DB.libraries
            .filter(function (l) { return !l.coopAddOnly; })
            .map(function (l) {
              return '<option value="' + l.id + '"' + (S.intakeLib === l.id ? " selected" : "") + ">" + esc(l.name) + "</option>";
            })
            .join("") +
          "</select>";
        var cards = DB.intake.results
          .map(function (r, ri) {
            var srcTone = r.priceSrc === "拍照识别" ? "teal" : r.priceSrc === "联网参考" ? "amber" : "muted";
            var att = r.attention ? " need-attention" : "";
            return (
              '<div class="recog-card" style="--i:' + ri + '">' +
              '<div class="recog-head"><span class="recog-thumb">' + (r.img ? '<img src="' + r.img + '" alt="' + esc(r.name || "识别物品") + '" width="72" height="72" loading="lazy"/>' : r.emoji) + "</span>" +
              '<div><div class="recog-name">' + (r.name || "待归类（F1.4）") + "</div>" +
              '<div class="recog-meta" style="font-size:12px;color:var(--text-muted);display:flex;gap:8px;align-items:center">' +
              '<span class="field-confirmed">' + icon("check", 12) + (r.name ? " 已识别" : " 缺失，请补全") + '</span><span class="badge badge-teal">AI 生成</span>' +
              '<span class="badge badge-' + srcTone + '">价格 · ' + esc(r.priceSrc || "待补") + "</span></div></div></div>" +
              '<div class="recog-fields">' +
              '<div class="field"><label for="f-name-' + r.id + '">名称</label><input id="f-name-' + r.id + '" class="' + att + '" value="' + esc(r.name) + '" data-field="name" data-id="' + r.id + '"/></div>' +
              '<div class="field"><label for="f-cat-' + r.id + '">类别</label><input id="f-cat-' + r.id + '" value="' + esc(r.category) + '" data-field="category" data-id="' + r.id + '"/></div>' +
              '<div class="field"><label for="f-qty-' + r.id + '">数量</label><input id="f-qty-' + r.id + '" class="num" value="' + esc(r.qty) + '" data-field="qty" data-id="' + r.id + '"/></div>' +
              '<div class="field"><label for="f-pos-' + r.id + '">存放位置</label><input id="f-pos-' + r.id + '" value="' + esc(r.pos) + '" data-field="pos" data-id="' + r.id + '"/></div>' +
              '<div class="field"><label for="f-exp-' + r.id + '">保质期（天）</label><input id="f-exp-' + r.id + '" class="num" value="' + esc(r.expDays || "") + '" data-field="expDays" data-id="' + r.id + '"/>' + (r.kbKey && window.KNOWLEDGE[r.kbKey] ? '<div class="kb-src">' + esc(window.KNOWLEDGE[r.kbKey].src) + " · " + esc(window.KNOWLEDGE[r.kbKey].tip) + "</div>" : "") + "</div>" +
              '<div class="field"><label for="f-price-' + r.id + '">价格（¥）</label><input id="f-price-' + r.id + '" class="num" value="' + esc(r.price) + '" data-field="price" data-id="' + r.id + '"/></div>' +
              "</div></div>"
            );
          })
          .join("");
        body =
          cards +
          '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:12px">入库到</div>' + libSel +
          '<div class="card-sub" style="margin-top:8px">共 ' + DB.intake.results.length + " 项 · 已识别 " + named + " 项" + (unknown ? " · 待补缺 " + unknown + " 项（缺名称将跳过）" : "") + (S.mergedCount ? " · 连拍同名合并 " + S.mergedCount + " 项（D3）" : "") +
          " · " + (DB.intake.meta
            ? "AI 识别：" + esc(DB.intake.meta.model) + " · " + (DB.intake.meta.ms / 1000).toFixed(1) + "s · " + esc(DB.intake.meta.via || "gateway") + " · 共 " + DB.intake.meta.images + " 张"
            : "AI 识别完成") +
          "</div></div>" +
          '<div class="card" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:16px">' +
          '<button class="btn btn-ghost" data-action="intake:cancel">' + icon("undo", 15) + " 返回重拍</button>" +
          '<button class="btn btn-primary" data-action="intake:confirm" data-busy="intake:confirm">' + icon("check", 16) + " 确认入库</button></div>";
      }
    }
    return (
      '<div class="view">' +
      '<div class="view-head"><div><h1 class="view-title">拍照入库</h1><p class="view-sub">拍/传 → AI 识别 → 只补缺 → 入库（F1.1-F1.6）</p></div></div>' +
      '<div class="steps">' + stepHtml + "</div>" +
      body +
      "</div>"
    );
  }

  function chatCardHTML(m, idx) {
    var c = m.card;
    if (!c) return "";
    var body = "";
    if (c.type === "adjust") {
      body =
        '<div class="chat-card-title">' + icon("edit", 13) + " 库存调整预览（F5.5 / P0-2）</div>" +
        '<div class="chat-card-row">' + esc(c.name) + "：" + c.from + " → <b class='num'>" + c.to + "</b> " + esc(c.unit) + (c.lib ? " · " + esc(c.lib) : "") + "</div>";
    } else if (c.type === "shopping_add") {
      body =
        '<div class="chat-card-title">' + icon("cart", 13) + " 加入采购清单预览（P0-2 shopping_add）</div>" +
        '<div class="chat-card-row">' + esc(c.name) + " · " + esc(c.qty) + "</div>";
    } else if (c.type === "cmd") {
      /* 自然语言指令层的写操作预览（红线 2：先预览后生效） */
      body =
        '<div class="chat-card-title">' + icon("sparkles", 13) + " 指令预览 · " + esc(c.opLabel || "") + "</div>" +
        '<div class="chat-card-row">' + esc(c.result || "确认后执行，可撤销") + "</div>";
    } else return "";
    var actions = c.done
      ? '<span class="badge badge-success">' + icon("check", 12) + " 已生效</span>"
      : c.cancelled
        ? '<span class="badge badge-muted">已取消</span>'
        : '<button class="btn btn-primary btn-sm" data-action="chat:card-confirm" data-idx="' + idx + '">确认生效</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="chat:card-cancel" data-idx="' + idx + '">取消</button>';
    return '<div class="chat-card">' + body + '<div class="chat-card-actions">' + actions + "</div></div>";
  }

  function viewChat() {
    var msgs = DB.chat
      .map(function (m, mi) {
        var plans = m.plans
          ? m.plans
              .map(function (pid) {
                var p = DB.plans.filter(function (x) { return x.id === pid; })[0];
                return p ? planCard(p, true) : "";
              })
              .join("")
          : "";
        return (
          '<div class="msg ' + (m.who === "me" ? "user" : "ai") + '">' +
          '<div class="msg-avatar ' + m.who + '">' + (m.who === "me" ? esc(DB.user.initial) : icon("sparkles", 15)) + "</div>" +
          '<div class="msg-body">' + (m.img ? '<img class="chat-img" src="' + m.img + '" alt="图片" width="220" height="160"/>' : "") + esc(m.text) + chatCardHTML(m, mi) + '<div class="plan-stack' + (S.flipPlans && m === DB.chat[DB.chat.length - 1] ? " flip" : "") + '">' + plans + "</div>" +
          (m.who === "ai" ? '<button class="btn btn-ghost btn-sm" data-action="tts:say" data-text="' + esc(m.text) + '">' + icon("bell", 13) + " 播报</button>" : "") +
          '<div class="msg-time">' + esc(m.time) + "</div></div></div>"
        );
      })
      .join("");
    var typing = S.chatTyping
      ? '<div class="msg ai"><div class="msg-avatar ai">' + icon("sparkles", 15) + '</div><div class="msg-body typing"><span class="fridge-mini">' + icon("fridge", 15) + '</span><span class="typing-label">正在查库存组织语言</span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div></div>'
      : "";
    return (
      '<div class="chat-panel-body">' +
      '<div class="chat-panel-head"><div class="chat-panel-title"><img class="mascot' + (S.chatTyping ? " thinking" : "") + '" src="assets/img/logo.png" alt="" width="20" height="20"/> AI 助手</div>' +
      '<div style="display:flex;align-items:center;gap:8px"><button class="btn btn-ghost btn-sm" data-action="overlay:open" data-type="plans">全部方案</button>' +
      '<button class="btn btn-primary btn-sm" data-action="plans:generate">' + icon("sparkles", 14) + " 生成方案</button>" +
      '<button class="icon-btn" data-action="chat:clear" aria-label="清空对话" title="清空对话（仅本地）">' + icon("trash", 16) + "</button>" +
      '<button class="icon-btn" data-action="ai:close" aria-label="收起 AI 助手">' + icon("x", 18) + "</button></div></div>" +
      '<div class="chat-wrap" id="chat-list">' + msgs + typing + "</div>" +
      '<form class="chat-input" id="chat-form"><input id="chat-text" placeholder="问点什么，或说「鸡蛋只剩 5 个」" aria-label="输入消息"/>' +
      '<button class="icon-btn" type="button" data-action="chat:attach" aria-label="上传图片" title="上传图片">' + icon("camera", 18) + "</button>" +
      '<input type="file" id="chat-attach" accept="image/*" hidden/>' +
      '<button class="icon-btn voice-btn" type="button" data-action="voice:input" title="语音输入（F5.3）" aria-label="语音输入">' + icon("mic", 20) + '<span class="voice-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span></button>' +
      '<button class="btn btn-primary" type="submit">发送</button></form>' +
      "</div>"
    );
  }

  function viewPlans() {
    var list = DB.plans.length
      ? DB.plans
          .map(function (p) {
            return '<div class="card">' + planCard(p) + "</div>";
          })
          .join("")
      : '<div class="card empty"><div class="empty-icon">' + icon("sparkles", 24) + '</div><div class="empty-title">还没有方案</div><div class="empty-sub">让 AI 按库存给你排 2-3 个方案（临期优先）</div></div>';
    return (
      '<div class="view">' +
      '<div class="view-head"><div><h1 class="view-title">方案</h1><p class="view-sub">勾选执行自动扣减库存，可撤销；优先级固定：临期优先 &gt; 清库存 &gt; 营养均衡（F3.8）</p></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost" data-action="creative:gen" data-busy="creative">' + icon("sparkles", 16) + " AI 创新菜谱</button>" +
      '<button class="btn btn-ghost" data-action="plans:print">' + icon("file", 16) + " 打印菜谱</button>" +
      '<button class="btn btn-primary" data-action="plans:generate">' + icon("sparkles", 16) + " 生成新方案</button></div></div>" +
      list +
      "</div>"
    );
  }

  function viewAlerts() {
    var danger = DB.alerts.some(function (a) { return a.tone === "red"; });
    var warn = DB.alerts.some(function (a) { return a.tone === "amber"; });
    var state = danger ? "danger" : warn ? "warn" : "";
    var statusText = danger ? "有紧急情况" : warn ? "有临期 / 待处理" : "库存健康";
    var statusDesc = danger ? "红色预警请立即处理" : warn ? "优先消耗临期食材，黄色灯在闪" : "一切正常，继续保持";
    var list = DB.alerts
      .map(function (a) {
        var tone = libraryTone({ tone: a.tone });
          return (
            '<div class="alert-item"><div class="alert-icon" style="background:' + tone[1] + ";color:" + tone[0] + '">' + icon(a.icon, 20) + "</div>" +
            '<div><div class="alert-text">' + esc(a.text) + '</div><div class="alert-meta">' + esc(a.meta) + "</div></div>" +
            (function () {
              var sev = a.tone === "red" ? 3 : a.tone === "amber" ? 2 : 1;
              return (
                '<span class="sev" aria-label="紧急度 ' + sev + '/3">' +
                [1, 2, 3]
                  .map(function (i) {
                    return '<span class="sev-dot' + (i <= sev ? " on" : "") + '" style="' + (i <= sev ? "background:" + tone[0] : "") + '"></span>';
                  })
                  .join("") +
                "</span>"
              );
            })() +
            '<button class="btn btn-ghost btn-sm" data-action="alert:done" data-busy="alert" data-id="' + a.id + '">已处理</button></div>'
          );
      })
      .join("");
    return (
      '<div class="view">' +
      '<div class="view-head"><div><h1 class="view-title">预警中心</h1><p class="view-sub">临期 / 过期 · 低库存（D4 lowAt） · 药品有效期 · 家电保修期，全库实时扫描</p></div>' +
      '<div style="display:flex;gap:12px;align-items:center"><button class="btn btn-ghost btn-sm" data-action="overlay:open" data-type="settings">预警档位设置</button>' +
      '<span class="demo-note">' + DB.alerts.length + " 条待处理</span></div></div>" +
      '<div class="alarm-lamp ' + state + '"><span class="alarm-light"></span><div><div class="alarm-status">' + statusText + '</div><div class="alarm-desc">' + statusDesc + "</div></div></div>" +
      '<div class="alert-list">' + (list || '<div class="card empty"><div class="empty-icon">' + icon("circle-check", 24) + "</div><div class='empty-title'>今天没有预警</div><div class='empty-sub'>库存很健康，继续保持</div></div>") + "</div>" +
      "</div>"
    );
  }

  function viewShopping() {
    var items = DB.shopping;
    var rows = items
      .map(function (s, i) {
        return (
          '<div class="shop-item"><span class="shop-check" data-action="shop:check" data-idx="' + i + '" role="checkbox" aria-checked="false" tabindex="0">' + icon("check", 12) + "</span>" +
          '<div><div class="shop-name">' + esc(s.name) + "</div><div class='shop-src'>" + esc(s.src) + "</div></div>" +
          '<span class="badge badge-muted">' + esc(s.qty) + "</span></div>"
        );
      })
      .join("");
    return (
      '<div class="view" style="max-width:860px">' +
      '<div class="view-head"><div><h1 class="view-title">采购清单</h1><p class="view-sub">方案缺料 + 低库存自动合并去重（F3.6）</p></div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost" data-action="shop:refresh" data-busy="shop">' + icon("shuffle", 16) + " 重新汇总</button>" +
      '<button class="btn btn-ghost" data-action="shop:copy" data-busy="shop">' + icon("copy", 16) + " 复制文本</button>" +
      '<button class="btn btn-ghost" data-action="shop:print">' + icon("file", 16) + " 打印</button>" +
      '<button class="btn btn-primary" data-action="shop:share">' + icon("share", 16) + " 分享给家人</button></div></div>" +
      '<div class="card"><div class="card-head"><div><div class="card-title">待采购 ' + items.length + " 项</div><div class='card-sub'>实时汇总 · 勾选标记已买</div></div></div>" +
      '<div class="shop-list">' + (rows || '<div class="empty" style="padding:24px"><div class="empty-sub">清单是空的，去生成方案或检查低库存</div></div>') + "</div></div>" +
      "</div>"
    );
  }

  function chatRowsHTML() {
    var wb = DB.workbench;
    var tones = {};
    (wb.seats || []).forEach(function (s) { tones[s.name] = libraryTone({ tone: s.color }); });
    return (wb.chat || [])
      .map(function (m) {
        if (m.sys) return '<div class="gc-sys">' + esc(m.text) + "</div>";
        var tone = tones[m.from] || ["var(--text-muted)", "var(--surface-overlay)"];
        return (
          '<div class="gc-msg"><span class="gc-avatar" style="background:' + tone[1] + ";color:" + tone[0] + '">' + esc((m.from || "?").charAt(0)) + "</span>" +
          '<div><div class="gc-name">' + esc(m.from) + ' <span class="gc-time num">' + esc(m.time || "") + "</span></div>" +
          '<div class="gc-text">' + esc(m.text) + "</div></div></div>"
        );
      })
      .join("");
  }

  function viewWorkbench() {
    var wb = DB.workbench;
    if (!wb) {
      /* 空态：真实协作池由后端创建/加入（/api/coop/*），不再预置演示牌桌 */
      return (
        '<div class="view">' +
        '<div class="view-head"><div><h1 class="view-title">协作工作台</h1>' +
        '<p class="view-sub">创建一个协作池，家人用 6 位邀请码入桌；结束后按归属扣减</p></div></div>' +
        '<div class="card" style="max-width:560px">' +
        '<div class="field"><label for="coop-name">协作池名称</label>' +
        '<input id="coop-name" placeholder="例如：周末聚餐" /></div>' +
        '<button class="btn btn-primary" data-action="coop:create" data-busy="coop">创建协作池</button>' +
        '<div style="height:20px"></div>' +
        '<div class="field"><label for="coop-code">已有邀请码</label>' +
        '<input id="coop-code" maxlength="8" placeholder="例如：ABC123" /></div>' +
        '<button class="btn btn-ghost" data-action="coop:join" data-busy="coop">加入协作池</button>' +
        '<p class="login-note" style="margin-top:12px">协作池、邀请码与成员记录在自建后端；库存明细与聊天不上云。</p>' +
        "</div></div>"
      );
    }
    var deckIds = (DB.workbench.myDeck || []).filter(function (id) {
      return DB.libraries.some(function (l) { return l.id === id; });
    });
    wb.seats.forEach(function (s) {
      if (s.id === "me") {
        s.libs = deckIds
          .map(function (id) {
            var l = DB.libraries.filter(function (x) { return x.id === id; })[0];
            return l ? { id: l.id, name: l.name, icon: l.icon, count: l.count, tag: l.coopFrom ? "来自 " + l.coopFrom : undefined } : null;
          })
          .filter(Boolean);
      }
    });
    var seats = wb.seats
      .map(function (seat) {
        var tone = libraryTone({ tone: seat.color });
        var isMe = seat.id === "me";
        var role = isMe ? "地主" : "农民";
        var cards = seat.libs
          .map(function (lib, ci) {
            var menuOpen = S.passMenu && S.passMenu.seat === seat.id && S.passMenu.lib === lib.id;
            if (isMe) {
              var targets = wb.seats
                .filter(function (t) { return t.id !== seat.id; })
                .map(function (t) {
                  return '<button class="family-item" data-action="coop:send" data-to="' + t.id + '" data-lib="' + lib.id + '" role="menuitem">' + icon("arrow-right", 15) + " 发给 " + esc(t.name) + "</button>";
                })
                .join("");
              targets =
                '<button class="family-item" data-action="coop:send" data-to="all" data-lib="' + lib.id + '" role="menuitem">' + icon("users", 15) + " 发给所有人</button>" +
                targets;
              return (
                '<div class="lib-card fan-card" style="--i:' + ci + '" data-action="coop:pass" data-seat="me" data-lib="' + lib.id + '" data-drag="coop" draggable="true" role="button" tabindex="0">' +
                '<span class="lib-card-icon" style="background:' + tone[1] + ";color:" + tone[0] + '">' + icon(lib.icon || "package", 15) + "</span>" +
                '<span class="lib-card-name">' + esc(lib.name) + "</span>" +
                '<span class="lib-card-count num">' + lib.count + "</span>" +
                (lib.tag ? '<span class="lib-card-tag">来自 ' + esc(lib.tag) + "</span>" : "") +
                (menuOpen ? '<div class="pass-menu" role="menu">' + targets + "</div>" : "") +
                "</div>"
              );
            }
            var flipped = S.flipCard && S.flipCard.seat === seat.id && S.flipCard.lib === lib.id;
            return (
              '<div class="card-pile' + (flipped ? " flipped" : "") + '" style="--i:' + ci + '" data-action="coop:pass" data-seat="' + seat.id + '" data-lib="' + lib.id + '" title="' + esc(lib.name) + " " + lib.count + ' 件" role="button" tabindex="0">' +
              '<div class="pile-inner">' +
              '<div class="pile-back"><span class="pile-count num">' + lib.count + "</span></div>" +
              '<div class="pile-front"><span class="pf-name">' + esc(lib.name) + '</span><span class="pf-count num">' + lib.count + ' 件</span>' +
              '<button class="btn btn-primary btn-sm" data-action="coop:send" data-seat="' + seat.id + '" data-to="me" data-lib="' + lib.id + '">回传给我</button></div>' +
              "</div></div>"
            );
          })
          .join("");
        return (
          '<div class="seat seat-' + seat.id + '" data-seat="' + seat.id + '">' +
          '<div class="seat-label"><span class="owner-dot" style="background:' + tone[0] + '"></span>' + esc(seat.name) + '<span class="seat-role">' + role + '</span><span class="num">' + seat.libs.length + " 张</span></div>" +
          '<div class="hand">' + (cards || '<span class="hand-empty">暂无手牌</span>') + "</div>" +
          (isMe
            ? '<div class="seat-actions"><button class="btn btn-ghost btn-sm speak-btn" data-action="overlay:open" data-type="groupchat">' + icon("chat", 14) + " 发言</button>" +
              '<button class="btn btn-ghost btn-sm" data-action="overlay:open" data-type="deckpick">' + icon("shuffle", 14) + " 换牌</button></div>"
            : "") +
          "</div>"
        );
      })
      .join("");
    return (
      '<div class="view">' +
      '<div class="view-head"><div><h1 class="view-title">' + esc(wb.name) + "</h1><p class='view-sub'>3 人同桌 · 斗地主式合作牌桌 · 结束后清理聚合数据</p></div>" +
      '<span class="badge badge-teal">' + icon("clock", 12) + " " + esc(wb.expires) + "</span></div>" +
      '<div class="table-scene">' +
      '<div class="card-table' + (S.dealFlag ? " dealing" : "") + '">' +
      '<div class="table-felt"></div>' +
      '<div class="table-center"><div class="pool-title">合作池</div>' +
      '<div class="pool-sub">传出去的库在这里生效 · 对方本地自动复制 · 结束即清理</div>' +
      '<button class="btn btn-primary btn-sm" style="margin-top:12px" data-action="wb:run" data-busy="wb:run">' + icon("check", 14) + " 执行合作方案</button>" +
      '<button class="btn btn-ghost btn-sm" style="margin-top:8px" data-action="coop:end" data-busy="coop:end">' + icon("x", 14) + " 结束合作</button></div>" +
      seats +
      "</div></div>" +
      '<div class="wb-layout">' +
      "<div>" +
      '<div class="section-head"><h2 class="section-title">邀请成员</h2></div>' +
      '<div class="invite-card"><div style="font-size:13px;color:var(--text-secondary)">限时邀请码（F9.3）</div>' +
      '<div class="invite-stamp">' + esc(DB.invite.revoked ? "已撤销" : DB.invite.code) + "</div>" +
      '<div class="invite-expire">' + (DB.invite.revoked ? "邀请码已撤销 · 新成员无法加入" : "有效期 " + DB.invite.expiresInDays + " 天 · 已用 " + (DB.invite.used || 0) + " / " + (DB.invite.max || 3) + " 人") + "</div>" +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
      '<button class="btn btn-primary btn-sm" data-action="wb:copy" data-busy="wb">' + icon("copy", 15) + " 复制</button>" +
      '<button class="btn btn-ghost btn-sm" data-action="invite:generate" data-busy="wb">' + icon("shuffle", 15) + " 重新生成</button>" +
      (DB.invite.revoked ? "" : '<button class="btn btn-ghost btn-sm" data-action="invite:revoke" data-busy="wb">' + icon("x", 15) + " 撤销</button>") +
      "</div></div>" +
      "</div>" +
      "<div>" +
      '<div class="section-head"><h2 class="section-title">牌桌规则</h2></div>' +
      '<div class="card"><div style="margin-top:4px;display:flex;flex-direction:column;gap:10px;font-size:13px;color:var(--text-secondary)">' +
      "<span>上限 3 人同桌，地主坐庄发牌</span><span>手牌 = 各自资源库，点手牌发给其他座位</span><span>对方牌背可见数量，点牌背可回传给我（本地复制）</span><span>接收方本地自动复制同样库，操作云端同步</span><span>合作结束，聚合数据与复制库自动清理</span></div></div>" +
      "</div></div>" +
      "</div>"
    );
  }

  function viewSearch() {
    var q = S.search.trim().toLowerCase();
    var allItems = DB.libraries.reduce(function (acc, l) {
      return acc.concat((l.items || []).map(function (it) { it.libName = l.name; it.libId = l.id; return it; }));
    }, []);
    var itemHits = q ? allItems.filter(function (it) { return it.name.toLowerCase().indexOf(q) > -1 || (it.pos || "").toLowerCase().indexOf(q) > -1; }) : allItems.slice(0, 4);
    var libHits = q ? DB.libraries.filter(function (l) { return l.name.toLowerCase().indexOf(q) > -1; }) : [];
    var ans = "";
    if (q && /放哪|哪里|哪儿|在哪/.test(q) && itemHits.length) {
      var t0 = itemHits[0];
      ans =
        '<div class="search-answer">' +
        '<div class="msg-avatar ai">' + icon("sparkles", 15) + "</div>" +
        "<div><div style='font-weight:700;font-size:15px'>" + esc(t0.name) + "在「" + esc(t0.libName) + "」· " + esc(t0.pos) + "</div>" +
        "<p style='font-size:13px;color:var(--text-secondary);margin-top:4px'>当前 " + t0.qty + " " + esc(t0.unit) +
        (t0.expDays && t0.expDays < 9000 ? "，还有 " + t0.expDays + " 天到期" : "") +
        (t0.price ? "。价格 ¥" + t0.price + "（" + esc(t0.priceSrc) + "）" : "") +
        "。数值来自本地库存查询（AI 红线 1）。</p>" +
        '<button class="btn btn-ghost btn-sm" style="margin-top:12px" data-action="lib:open" data-id="' + t0.libId + '">去' + esc(t0.libName) + "看看 " + icon("arrow-right", 14) + "</button></div></div>";
    } else if (q && itemHits.length) {
      ans =
        '<div class="search-answer">' +
        '<div class="msg-avatar ai">' + icon("sparkles", 15) + "</div>" +
        "<div><div style='font-weight:700;font-size:15px'>找到 " + itemHits.length + " 条相关物品</div>" +
        "<p style='font-size:13px;color:var(--text-secondary);margin-top:4px'>结果按名称与位置匹配，可继续问「XX 放哪了」获取定位与临期信息。</p></div></div>";
    } else if (q) {
      ans =
        '<div class="search-answer">' +
        '<div class="msg-avatar ai">' + icon("sparkles", 15) + "</div>" +
        "<div><div style='font-weight:700;font-size:15px'>没有找到「" + esc(q) + "」</div>" +
        "<p style='font-size:13px;color:var(--text-secondary);margin-top:4px'>试试拍照入库，或换个关键词。</p></div></div>";
    }
    var itemRows = itemHits
      .map(function (it) {
        return (
          '<div class="search-result" data-action="lib:open" data-id="' + it.libId + '">' +
          '<div class="item-photo">' + (it.img ? '<img src="' + it.img + '" alt="' + esc(it.name) + '" width="40" height="40" loading="lazy"/>' : "<span>" + it.emoji + "</span>") + "</div>" +
          '<div style="flex:1"><div class="item-name">' + esc(it.name) + '</div><div class="item-meta">' + esc(it.libName) + " · " + esc(it.pos) + "</div></div>" +
          '<span class="badge badge-muted">' + it.qty + " " + it.unit + "</span></div>"
        );
      })
      .join("");
    var libRows = libHits
      .map(function (l) {
        var tone = libraryTone(l);
        return (
          '<div class="search-result" data-action="nav:go" data-view="libraries">' +
          '<div class="library-icon" style="width:34px;height:34px;background:' + tone[1] + ";color:" + tone[0] + '">' + icon(l.icon, 17) + "</div>" +
          '<div class="item-name">' + esc(l.name) + "</div>" +
          '<span class="badge badge-muted">' + l.count + " 件</span></div>"
        );
      })
      .join("");
    return (
      '<div class="view" style="max-width:860px">' +
      '<div class="view-head"><div><h1 class="view-title">全局搜索</h1><p class="view-sub">跨库搜索物品、位置与方案（F2.4）</p></div></div>' +
      '<input class="search-page-input" id="search-input" placeholder="搜物品、位置，或问“鸡蛋放哪了”" value="' + esc(S.search) + '" aria-label="搜索"/>' +
      (ans ? '<div style="height:16px"></div>' + ans : "") +
      '<div class="search-group"><div class="section-head"><h2 class="section-title">物品</h2></div>' +
      '<div class="card" style="padding:12px">' + (itemRows || '<div class="empty" style="padding:24px">没有匹配的物品</div>') + "</div></div>" +
      (libRows
        ? '<div class="search-group"><div class="section-head"><h2 class="section-title">资源库</h2></div><div class="card" style="padding:12px">' + libRows + "</div></div>"
        : "") +
      "</div>"
    );
  }

  function viewSettings() {
    var theme = DB.theme === "dark";
    var curPalette = palette();
    var members = DB.members[DB.familyId] || [];
    var inv = DB.invite;
    var prof = DB.profile || {};
    var isAdmin = DB.user.role === "管理员";
    var readOnly = DB.user.role === "只读";
    var st = window.API.getStats();
    var acfg = window.AGNES ? window.AGNES.cfg() : {};
    var memberRows = members
      .map(function (m) {
        var removable = isAdmin && m.phone !== DB.user.phone && m.role !== "管理员";
        return (
          '<div class="setting-row"><div><div class="setting-title">' + esc(m.name) + ' <span class="badge badge-muted">' + esc(m.role) + "</span></div>" +
          '<div class="setting-desc num">' + esc(m.phone) + "</div></div>" +
          (removable ? '<button class="btn btn-ghost btn-sm" data-action="member:remove" data-phone="' + esc(m.phone) + '" data-busy="member">' + icon("trash", 14) + " 移除</button>" : '<span class="badge badge-muted">—</span>') +
          "</div>"
        );
      })
      .join("");
    return (
      '<div class="view" style="max-width:760px">' +
      '<div class="view-head"><div><h1 class="view-title">设置</h1><p class="view-sub">账号 · 家庭 · AI 偏好 · 同步 · 提醒</p></div></div>' +
      '<div class="card" style="display:flex;align-items:center;gap:16px;padding:24px">' +
      '<div class="avatar" style="width:48px;height:48px;font-size:18px">' + esc(DB.user.initial) + "</div>" +
      "<div><div class='card-title'>" + esc(DB.user.name) + ' <span class="badge ' + (isAdmin ? "badge-amber" : "badge-muted") + '">' + esc(DB.user.role) + "</span></div><div class='card-sub num'>" + esc(DB.user.phone || "") + " · " + esc(DB.family.name) + " · " + DB.family.memberCount + " 位成员</div></div>" +
      (isAdmin ? '<a class="btn btn-ghost btn-sm" style="margin-left:auto" href="admin.html">' + icon("shield", 15) + " 管理员端</a>" : "") +
      '<button class="btn btn-ghost btn-sm" style="margin-left:' + (isAdmin ? "12px" : "auto") + '" data-action="settings:logout">退出登录</button></div>' +

      /* F9.2/F9.3 家庭与成员 */
      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">家庭与成员（F9.1-F9.3）</div>' +
      memberRows +
      '<div class="setting-row" style="border-top:1px dashed var(--border)"><div><div class="setting-title">限时邀请码</div><div class="setting-desc">' + (inv.revoked ? "已撤销" : "<span class='num'>" + esc(inv.code) + "</span> · 有效期 " + inv.expiresInDays + " 天 · 已用 " + (inv.used || 0) + "/" + (inv.max || 3)) + "</div></div>" +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn btn-ghost btn-sm" data-action="wb:copy">' + icon("copy", 14) + " 复制</button>" +
      '<button class="btn btn-ghost btn-sm" data-action="invite:generate" data-busy="wb">生成新码</button>' +
      (inv.revoked ? "" : '<button class="btn btn-ghost btn-sm" data-action="invite:revoke" data-busy="wb">撤销</button>') +
      "</div></div></div>" +

      /* P0-4 偏好档案（仅本地） */
      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">AI 偏好档案（P0-4 · 仅本地，不上云）</div>' +
      '<div class="grid-2"><div class="field"><label for="prof-people">家庭人数</label><input id="prof-people" class="num" value="' + (prof.people || 3) + '"/></div>' +
      '<div class="field"><label for="prof-goal">饮食目标</label><input id="prof-goal" value="' + esc(prof.goal || "") + '" placeholder="减脂 / 增肌 / 控糖"/></div></div>' +
      '<div class="field"><label for="prof-dislikes">忌口（AI 规划时避开）</label><input id="prof-dislikes" value="' + esc(prof.dislikes || "") + '" placeholder="如：香菜、苦瓜"/></div>' +
      '<div class="setting-row"><div><div class="setting-title">注入 AI 规划</div><div class="setting-desc">仅 cook / creative / nutrition / summary 类回答使用</div></div><button class="switch' + (prof.enabled === false ? "" : " on") + '" id="prof-enabled" data-action="switch:toggle" role="switch" aria-checked="' + (prof.enabled !== false) + '"></button></div>' +
      '<button class="btn btn-primary btn-sm" style="margin-top:12px" data-action="settings:save-profile" data-busy="prof">保存偏好</button></div>' +

      /* F3.9 档位 + D6 预算 */
      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">预警档位与预算（F3.9 / D4 / D6）</div>' +
      '<div class="grid-2"><div class="field"><label for="alert-soon">临期提醒（提前天数）</label><input id="alert-soon" class="num" value="' + ((DB.settings && DB.settings.alertSoon) || 7) + '"/></div>' +
      '<div class="field"><label for="alert-crit">紧急档（提前天数）</label><input id="alert-crit" class="num" value="' + ((DB.settings && DB.settings.alertCritical) || 3) + '"/></div></div>' +
      '<div class="grid-2"><div class="field"><label for="budget-input">月度预算（¥）</label><input id="budget-input" class="num" value="' + (DB.budget || 600) + '"/></div>' +
      '<div class="field"><label>本月已花</label><div class="num" style="padding:10px 0">¥' + st.spent + "</div></div></div>" +
      '<button class="btn btn-primary btn-sm" style="margin-top:12px" data-action="settings:save-alerts" data-busy="alerts">保存</button></div>' +

      /* F9.10 同步 */
      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">多端同步（F9.10 · 全量快照 + 版本号）</div>' +
      '<div class="setting-row"><div><div class="setting-title">本地版本</div><div class="setting-desc">本地优先，离线可完整使用；云端较新时上传会返回 409 冲突，二选一处理</div></div><span class="badge badge-teal num">v' + (DB.syncVersion || 1) + "</span></div>" +
      (S.syncConflict
        ? '<div class="chat-card" style="margin:12px 0"><div class="chat-card-title">' + icon("alert", 13) + " 版本冲突（409）</div><div class='chat-card-row'>云端已更新到 v" + S.syncConflict.version + "（" + esc(S.syncConflict.updatedAt || "") + "），请选择：</div><div class='chat-card-actions'>" +
          '<button class="btn btn-primary btn-sm" data-action="sync:overwrite" data-busy="sync">覆盖上传（以我为准）</button>' +
          '<button class="btn btn-ghost btn-sm" data-action="sync:download" data-busy="sync">拉取云端（以云为准）</button></div></div>'
        : "") +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-primary btn-sm" data-action="sync:upload" data-busy="sync">' + icon("upload", 14) + " 上传同步</button>" +
      '<button class="btn btn-ghost btn-sm" data-action="sync:simulate" data-busy="sync">' + icon("shuffle", 14) + " 模拟他端修改</button></div></div>" +

      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">隐私与提醒</div>' +
      '<div class="setting-row"><div><div class="setting-title">新物品默认仅自己可见</div><div class="setting-desc">共享库与协作中不展示私有物品（F2.5）</div></div><button class="switch on" data-action="setting:toggle" data-key="private" aria-label="切换私有物品默认" role="switch" aria-checked="true"></button></div>' +
      '<div class="setting-row"><div><div class="setting-title">聊天记录仅存本地</div><div class="setting-desc">已确认策略 · 不上云、跨端不同步（F5.4/D5，≤200 条滚动）</div></div><button class="switch on" data-action="setting:toggle" data-key="chat" aria-label="切换聊天记录本地" role="switch" aria-checked="true"></button></div>' +
      '<div class="setting-row"><div><div class="setting-title">临期预警推送</div><div class="setting-desc">按上方档位提醒（F8.1）</div></div><button class="switch on" data-action="setting:toggle" data-key="expiry" aria-label="切换临期预警" role="switch" aria-checked="true"></button></div>' +
      '<div class="setting-row"><div><div class="setting-title">每日智能摘要</div><div class="setting-desc">优先事项与临期清单（F8.2）</div></div><button class="switch on" data-action="setting:toggle" data-key="digest" aria-label="切换每日摘要" role="switch" aria-checked="true"></button></div>' +
      '<div class="setting-row"><div><div class="setting-title">低库存补货提醒</div><div class="setting-desc">低于 lowAt 阈值自动提醒（F8.3/D4）</div></div><button class="switch on" data-action="setting:toggle" data-key="low" aria-label="切换低库存提醒" role="switch" aria-checked="true"></button></div>' +
      "</div>" +

      /* AI 通道与服务器连接（对齐鸿蒙端「我的 → 服务器连接」） */
      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">服务器连接 · AI 通道</div>' +
      '<div class="card-sub" style="margin-bottom:10px">快答与构图 0 次模型调用；仅模型类问题与社区摘要走大模型（单请求 ≤2 次，红线 3）。调用失败自动降级本地回答。</div>' +
      '<div class="setting-row"><div><div class="setting-title">当前连接</div><div class="setting-desc">' +
      (S.aiStatus
        ? (S.aiStatus.ok
            ? '已连接 <span class="num">' + esc(S.aiStatus.base) + "</span> · " +
              (S.aiStatus.mode === "lan-self-hosted" ? "局域网自建服务器（数据不出局域网）" : "自建服务器") +
              (S.aiStatus.ai === "ready" ? " · 网关就绪" : S.aiStatus.ai === "no-key" ? " · 网关未配 Key（后端设 AGNES_API_KEY）" : "")
            : "未连接自建服务器 · " + esc(S.aiStatus.error || "AI 走厂商直连"))
        : "未检测；点击「测试连接」探测本机后端") + "</div></div>" +
      '<span class="badge ' + (S.aiStatus && S.aiStatus.ok ? "badge-teal" : "badge-muted") + '">' +
      (S.aiStatus && S.aiStatus.ok ? "自建网关" : (acfg.prefer === "direct" ? "厂商直连" : "未探测")) + "</span></div>" +
      '<div class="field"><label for="gw-base">后端地址（留空自动探测本机 3000 端口）</label><input id="gw-base" value="' + esc(acfg.baseUrl || "") + '" placeholder="http://192.168.x.x:3000"/></div>' +
      '<div class="field"><label for="agnes-prefer">通道策略</label><select id="agnes-prefer">' +
      '<option value="gateway"' + (acfg.prefer !== "direct" ? " selected" : "") + ">自建网关优先，连不上回落到厂商直连</option>" +
      '<option value="direct"' + (acfg.prefer === "direct" ? " selected" : "") + ">只用厂商直连（本机 Key）</option>" +
      "</select></div>" +
      '<div class="card-sub" style="margin:12px 0 8px">厂商直连通道（自建网关不可用时使用，Key 仅存本机 localStorage）</div>' +
      '<div class="field"><label for="agnes-key">API Key</label><input id="agnes-key" value="' + esc(acfg.apiKey || "") + '" placeholder="sk-…"/></div>' +
      '<div class="grid-2"><div class="field"><label for="agnes-model">模型</label><input id="agnes-model" value="' + esc(acfg.model || "agnes-2.5-flash") + '"/></div>' +
      '<div class="field"><label for="agnes-base">厂商 Base URL</label><input id="agnes-base" value="' + esc(acfg.vendorBase || "") + '"/></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:12px">' +
      '<button class="btn btn-primary btn-sm" data-action="agnes:save" data-busy="agnes">保存配置</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="agnes:test" data-busy="agnes">测试连接</button>' +
      '<span class="badge badge-muted" style="align-self:center">platform.agnes-ai.cn</span></div></div>' +

      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">外观</div>' +
      '<div class="setting-row"><div><div class="setting-title">深色模式</div><div class="setting-desc">默认浅色（冷白底 + 启核绿），与鸿蒙端一致</div></div><button class="switch' + (theme ? " on" : "") + '" data-action="theme:toggle" data-busy="theme" aria-label="切换深色模式" role="switch" aria-checked="' + theme + '"></button></div>' +
      '<div class="setting-row"><div><div class="setting-title">主题色板</div><div class="setting-desc">三端同一套设计令牌：启核绿青蓝（默认）/ 经典橙</div></div>' +
      '<div style="display:flex;gap:8px">' +
      '<button class="btn ' + (curPalette === "nexcore" ? "btn-primary" : "btn-ghost") + ' btn-sm" data-action="palette:set" data-palette-value="nexcore">启核绿青蓝</button>' +
      '<button class="btn ' + (curPalette === "classic" ? "btn-primary" : "btn-ghost") + ' btn-sm" data-action="palette:set" data-palette-value="classic">经典橙</button>' +
      "</div></div>" +
      "</div>" +

      /* 活同步 + 跨设备流转（对齐鸿蒙端 LiveSync / FlowBridge） */
      '<div class="card" style="margin-top:24px"><div class="card-title" style="margin-bottom:8px">多端活同步 · 跨设备流转</div>' +
      '<div class="card-sub" style="margin-bottom:10px">改完自动发、对端 2 秒内自动收；流转把当前库存 / 方案 / 采购快照推到中转，另一台设备一键接收。</div>' +
      '<div class="setting-row"><div><div class="setting-title">活同步状态</div><div class="setting-desc" id="live-state">' +
      esc(window.LIVEFLOW ? window.LIVEFLOW.state() : "未启用") + '</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="sync:live-now" data-busy="live">立即同步</button></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">' +
      '<button class="btn btn-primary btn-sm" data-action="flow:publish" data-busy="flow">发送流转</button>' +
      '<button class="btn btn-ghost btn-sm" data-action="flow:pull" data-busy="flow">接收流转</button>' +
      '<span class="badge badge-muted num">设备 ' + esc(window.LIVEFLOW ? window.LIVEFLOW.deviceId() : "-") + '</span></div></div>' +

      '<div class="card" style="margin-top:24px"><div class="card-head"><div><div class="card-title">操作日志</div><div class="card-sub">所有写操作留痕（F6.4）· 可撤销最近一次数量变更（F6.3）</div></div>' +
      '<button class="btn btn-ghost btn-sm" data-action="settings:undo" data-busy="undo">' + icon("undo", 14) + " 撤销最近操作</button></div>" +
      (DB.logs.length
        ? '<div class="logs-list">' +
          DB.logs
            .slice(0, 20)
            .map(function (l) {
              return '<div class="log-row"><span class="log-action">' + esc(l.action) + "</span><span>" + esc(l.detail) + '</span><span class="num log-time">' + esc(l.at) + "</span></div>";
            })
            .join("") +
          "</div>"
        : '<div class="empty" style="padding:16px"><div class="empty-sub">还没有操作记录，去拍一张照试试</div></div>') +
      "</div>" +

      '<div class="card" style="margin-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap">' +
      '<div><div class="card-title">数据管理</div><div class="card-sub">CSV 兼容 Excel（F2.6）· 对话仅本地可清空（P0-5）</div></div>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
      '<button class="btn btn-ghost" data-action="lib:export" data-busy="shop">' + icon("download", 15) + " 导出 CSV</button>" +
      '<button class="btn btn-ghost" data-action="lib:import">' + icon("upload", 15) + " 导入 CSV</button>" +
      '<button class="btn btn-ghost" data-action="chat:clear">' + icon("trash", 15) + " 清空对话</button>" +
      '<button class="btn btn-ghost" data-action="settings:reset" data-busy="reset">清空本机缓存（云端保留）</button></div></div>' +
      '<input type="file" id="import-file" accept=".csv,text/csv" hidden/>' +
      (readOnly ? '<div class="card" style="margin-top:16px"><div class="card-sub">当前为只读账号：可查看与对话，库存写操作会被拒绝（F9.2 权限角色）。</div></div>' : "") +
      "</div>"
    );
  }

  function viewLogin() {
    return (
      '<div class="login">' +
      '<div class="login-glow" aria-hidden="true"></div>' +
      '<div class="login-card">' +
      '<img class="login-logo" src="assets/img/logo.png" alt="启核图策" width="96" height="96"/>' +
      '<h1 class="login-title">启核图策</h1>' +
      '<p class="login-sub">NexcoreGraph · 家庭资源智能管家</p>' +
      '<p class="login-sub">家里的东西，AI 帮你想 · 拍照建库 / 智能规划 / 家庭协作</p>' +
      '<form class="login-form" id="login-form" novalidate>' +
      '<div class="field"><label for="login-phone">邮箱</label><input id="login-phone" type="email" value="' + esc(S.loginPhone || "") + '" placeholder="输入邮箱地址" aria-label="邮箱" autocomplete="email"/><div class="login-err" id="login-err" hidden></div></div>' +
      '<div class="field"><label for="login-code">验证码</label><div class="code-row"><input id="login-code" value="' + esc(S.loginCode || "") + '" inputmode="numeric" maxlength="6" placeholder="6 位验证码" aria-label="验证码"/><button class="btn btn-ghost btn-sm" type="button" data-action="login:code" id="login-code-btn">' + (S.loginCd > 0 ? S.loginCd + "s 后重发" : "获取验证码") + '</button></div></div>' +
      '<button class="btn btn-primary login-submit" type="submit">登录</button>' +
      "</form>" +
      '<p class="login-note" id="login-server">正在探测本机后端…</p>' +
      '<p class="login-note">账号、家庭与库存都来自你自己电脑上的自建后端 · 聊天记录仅存本机</p>' +
      "</div>" +
      '<div id="toasts" class="toast-wrap" aria-live="polite"></div>' +
      "</div>"
    );
  }

  var LIB_ICONS = ["package", "fridge", "shirt", "pill", "wrench", "dumbbell", "book", "paw", "plug", "folder-plus"];
  var LIB_TONES = ["teal", "indigo", "red", "slate", "lime", "brown", "orange", "violet"];

  function formNewLib() {
    return (
      '<form class="overlay-form" id="lib-form">' +
      '<div class="field"><label for="lib-name">库名称</label><input id="lib-name" placeholder="如：零食柜、鞋柜" required/></div>' +
      '<div class="field"><label for="lib-icon">图标</label><select id="lib-icon">' +
      LIB_ICONS.map(function (ic) { return '<option value="' + ic + '">' + ic + "</option>"; }).join("") +
      "</select></div>" +
      '<div class="field"><label for="lib-tone">主色调</label><select id="lib-tone">' +
      LIB_TONES.map(function (t) { return '<option value="' + t + '">' + t + "</option>"; }).join("") +
      "</select></div>" +
      '<button class="btn btn-primary" type="submit" data-busy="lib:create">创建库</button>' +
      "</form>"
    );
  }

  function formEditLib(lib) {
    return (
      '<form class="overlay-form" id="lib-rename-form">' +
      '<div class="field"><label for="lib-rename">库名称</label><input id="lib-rename" value="' + esc(lib.name) + '" required/></div>' +
      '<button class="btn btn-primary" type="submit" data-busy="lib:rename">保存</button>' +
      "</form>"
    );
  }

  function formItemAdd(lib) {
    return (
      '<form class="overlay-form" id="item-form">' +
      '<div class="field"><label for="it-name">名称</label><input id="it-name" placeholder="如：青椒" required/></div>' +
      '<div class="grid-2"><div class="field"><label for="it-qty">数量</label><input id="it-qty" class="num" value="1"/></div>' +
      '<div class="field"><label for="it-unit">单位</label><input id="it-unit" value="个"/></div></div>' +
      '<div class="grid-2"><div class="field"><label for="it-price">价格（¥）</label><input id="it-price" class="num" value="0"/></div>' +
      '<div class="field"><label for="it-exp">保质期（天）</label><input id="it-exp" class="num" value="7"/></div></div>' +
      '<div class="field"><label for="it-pos">存放位置</label><input id="it-pos" placeholder="如：冷藏区底层"/></div>' +
      '<div class="setting-row"><div><div class="setting-title">仅自己可见</div><div class="setting-desc">共享库与协作中不展示（F2.5）</div></div><button class="switch" type="button" data-action="switch:toggle" aria-label="切换私有" role="switch" aria-checked="false"></button></div>' +
      '<button class="btn btn-primary" type="submit" data-busy="item:save">添加到「' + esc(lib.name) + "」</button>" +
      "</form>"
    );
  }

  function formItemEdit(lib, it) {
    return (
      '<form class="overlay-form" id="item-edit-form">' +
      '<div class="field"><label for="it-name">名称</label><input id="it-name" value="' + esc(it.name) + '" required/></div>' +
      '<div class="field"><label for="it-no">编号</label><input id="it-no" value="' + esc(it.no || "") + '" disabled/></div>' +
      '<div class="grid-2"><div class="field"><label for="it-qty">数量</label><input id="it-qty" class="num" value="' + it.qty + '"/></div>' +
      '<div class="field"><label for="it-unit">单位</label><input id="it-unit" value="' + esc(it.unit) + '"/></div></div>' +
      '<div class="grid-2"><div class="field"><label for="it-price">价格（¥）</label><input id="it-price" class="num" value="' + it.price + '"/></div>' +
      '<div class="field"><label for="it-exp">保质期（天）</label><input id="it-exp" class="num" value="' + it.expDays + '"/></div></div>' +
      '<div class="field"><label for="it-pos">存放位置</label><input id="it-pos" value="' + esc(it.pos) + '"/></div>' +
      '<div class="setting-row"><div><div class="setting-title">仅自己可见</div><div class="setting-desc">共享库与协作中不展示（F2.5）</div></div><button class="switch' + (it.private ? " on" : "") + '" type="button" data-action="switch:toggle" aria-label="切换私有" role="switch" aria-checked="' + !!it.private + '"></button></div>' +
      '<div style="display:flex;gap:12px;margin-top:8px"><button class="btn btn-primary" type="submit" data-busy="item:save">保存</button>' +
      '<button class="btn btn-ghost" type="button" data-action="item:del" data-busy="item:del">删除物品</button></div>' +
      "</form>"
    );
  }

  /* ---------- 渲染 ---------- */
  var VIEWS = {
    login: viewLogin,
    aiwork: function () { return window.WORKBENCH ? window.WORKBENCH.view() : viewDashboard(); },
    graph: function () { return window.GRAPHVIEW ? window.GRAPHVIEW.view() : viewDashboard(); },
    dashboard: viewDashboard,
    libraries: viewLibraries,
    workbench: viewWorkbench
  };

  var NAV = [
    { id: "aiwork", label: "AI 工作台", icon: "sparkles" },
    { id: "dashboard", label: "首页看板", icon: "dashboard" },
    { id: "libraries", label: "资源库", icon: "library" },
    { id: "graph", label: "资源图谱", icon: "graph" },
    { id: "workbench", label: "协作工作台", icon: "users" }
  ];

  function shell() {
    var nav = NAV.map(function (n) {
      var active = S.view === n.id ? " active" : "";
      return (
        '<button class="nav-item' + active + '" data-action="nav:go" data-view="' + n.id + '" aria-current="' + (S.view === n.id ? "page" : "false") + '">' +
        icon(n.icon, 19) + "<span>" + n.label + "</span>" +
        (n.badge ? '<span class="nav-badge num">' + n.badge + "</span>" : "") +
        "</button>"
      );
    }).join("");
    return (
      '<div class="app">' +
      '<aside class="sidebar">' +
      '<div class="brand"><div class="brand-mark"><img src="assets/img/logo.png" alt="启核图策 logo" width="40" height="40"/></div>' +
      "<div><div class='brand-name'>启核图策</div><div class='brand-sub'>NexcoreGraph · 家庭资源智能管家</div></div></div>" +
      '<nav class="nav" aria-label="主导航"><span class="nav-pill" aria-hidden="true"></span><div class="nav-label">工作台</div>' + nav + "</nav>" +
      '<div class="sidebar-foot">' +
      '<div class="user-chip" data-action="overlay:open" data-type="settings" role="button" tabindex="0"><div class="avatar">' + esc(DB.user.initial) + "</div><div><div class='user-name'>" + esc(DB.user.name) + "</div><div class='user-role'>" + esc(DB.user.role) + "</div></div>" +
      '<button class="icon-btn" style="margin-left:auto;width:32px;height:32px" data-action="settings:logout" aria-label="退出登录">' + icon("logout", 17) + "</button></div>" +
      (DB.user.role === "管理员" ? '<a class="link-btn" href="admin.html" style="display:flex;align-items:center;gap:6px;margin-top:8px;font-size:12px">' + icon("shield", 14) + " 进入管理员端（F10）</a>" : "") +
      "</div></aside>" +
      '<div class="main">' +
      '<header class="topbar">' +
      '<button class="search-trigger" data-action="overlay:open" data-type="search">' + icon("search", 17) + "<span>搜物品、位置，或问“鸡蛋放哪了”</span><span class='kbd'>⌘ K</span></button>" +
      '<div class="topbar-right">' +
      '<button class="family-switch" data-action="family:toggle" aria-haspopup="menu" aria-expanded="' + S.familyOpen + '">' + icon("users", 16) + esc(DB.family.name) + icon("chevron-down", 14) + "</button>" +
      (S.familyOpen
        ? '<div class="family-menu" role="menu">' +
          DB.families
            .map(function (f) {
              return '<button class="family-item" data-action="family:select" data-id="' + f.id + '" role="menuitem">' + icon("users", 15) + "<span>" + esc(f.name) + '</span><span class="num family-count">' + f.memberCount + " 人</span></button>";
            })
            .join("") +
          '<button class="family-item" data-action="family:create" role="menuitem">' + icon("plus", 15) + "<span>创建新家庭</span></button>" +
          "</div>"
        : "") +
      '<button class="icon-btn" data-action="overlay:open" data-type="alerts" aria-label="预警中心">' + icon("bell", 19) + '<span class="dot"></span></button>' +
      '<button class="icon-btn" data-action="overlay:open" data-type="shopping" aria-label="采购清单">' + icon("cart", 19) + "</button>" +
      '<button class="icon-btn" data-action="theme:toggle" data-busy="theme" aria-label="切换深浅色">' + icon(DB.theme === "dark" ? "sun" : "moon", 19) + "</button>" +
      '<button class="icon-btn" data-action="overlay:open" data-type="settings" aria-label="设置">' + icon("settings", 19) + "</button>" +
      "</div></header>" +
      '<main class="content" id="view"></main>' +
      '<div id="toasts" class="toast-wrap" aria-live="polite"></div>' +
      "</div></div>"
    );
  }

  function overlayHTML(type) {
    var builders = {
      search: viewSearch,
      alerts: viewAlerts,
      shopping: viewShopping,
      plans: viewPlans,
      settings: viewSettings,
      intake: viewIntake,
      newlib: function () { return panelShell("新建资源库", formNewLib()); },
      editlib: function () { return panelShell("重命名资源库", formEditLib(S.editLib)); },
      itemadd: function () { return panelShell("手动添加物品", formItemAdd(S.itemLib)); },
      itemedit: function () { return panelShell("编辑物品", formItemEdit(S.itemLib, S.itemIt)); },
      deckpick: function () {
        var draft = S.deckDraft || [];
        var rows = DB.libraries
          .map(function (l) {
            var on = draft.indexOf(l.id) > -1;
            return (
              '<div class="setting-row"><div><div class="setting-title">' + esc(l.name) + '</div><div class="setting-desc">' + l.count + " 件" + (l.coopFrom ? " · 来自 " + esc(l.coopFrom) : "") + "</div></div>" +
              '<button class="switch' + (on ? " on" : "") + '" data-action="deck:toggle" data-id="' + l.id + '" aria-label="切换" role="switch" aria-checked="' + on + '"></button></div>'
            );
          })
          .join("");
        return panelShell(
          "选择手牌 · 上限 4 张",
          '<div style="font-size:12px;color:var(--text-muted);margin-bottom:12px">已选 ' + draft.length + " / 4 · 有什么库就有什么卡牌</div>" +
            rows +
            '<button class="btn btn-primary" style="width:100%;margin-top:16px" data-action="deck:save">保存手牌</button>'
        );
      },
      groupchat: function () {
        return panelShell(
          "群聊 · 3 人",
          '<div class="gc-list" id="gc-list">' + (chatRowsHTML() || '<div class="gc-sys">牌桌已就位，开始协作吧</div>') + "</div>" +
            '<div class="gc-input"><input id="group-chat-input" placeholder="说点什么…" aria-label="群聊输入"/><button class="btn btn-primary btn-sm" data-action="chat:send">发送</button></div>'
        );
      }
    };
    function panelShell(title, body) {
      return '<div class="overlay-card"><div class="card-title" style="margin-bottom:16px">' + title + "</div>" + body + "</div>";
    }
    var labels = {
      search: "全局搜索",
      alerts: "预警中心",
      shopping: "采购清单",
      plans: "方案",
      settings: "设置",
      intake: "拍照入库",
      newlib: "新建资源库",
      editlib: "重命名资源库",
      itemadd: "手动添加物品",
      itemedit: "编辑物品",
      deckpick: "换牌",
      groupchat: "群聊"
    };
    var side = ["alerts", "shopping", "plans"].indexOf(type) > -1;
    return (
      '<div class="overlay" data-overlay="' + type + '">' +
      '<div class="overlay-backdrop" data-action="overlay:close"></div>' +
      '<div class="overlay-panel' + (side ? " overlay-side" : " overlay-center") + '" role="dialog" aria-modal="true" aria-label="' + labels[type] + '">' +
      '<button class="icon-btn overlay-close" data-action="overlay:close" aria-label="关闭">' + icon("x", 18) + "</button>" +
      '<div class="overlay-body">' + builders[type]() + "</div>" +
      "</div></div>"
    );
  }

  function render() {
    if (!loggedIn) {
      document.body.innerHTML = viewLogin();
      bindLoginForm();
      return;
    }
    var prevPill = document.querySelector(".nav-pill");
    S.pillRect = prevPill
      ? { left: prevPill.offsetLeft, top: prevPill.offsetTop, width: prevPill.offsetWidth, height: prevPill.offsetHeight }
      : null;
    if (S.view === "login") S.view = "aiwork";
    var prevScroll = window.scrollY || 0;
    var sameView = S.view + "|" + (S.libId || "") === lastViewKey;
    document.body.innerHTML =
      shell() +
      (S.aiOpen
        ? ""
        : '<button class="ai-ball magnetic" data-action="ai:toggle" style="right:' + S.ball.x + "px;bottom:" + S.ball.y + 'px" aria-label="AI 助手" title="AI 助手">' +
          icon("sparkles", 20) +
          "</button>") +
      (S.aiOpen ? '<aside class="ai-panel' + (S.aiEnter ? " enter" : " no-anim") + '" role="dialog" aria-label="AI 助手">' + viewChat() + "</aside>" : "");
    var viewEl = document.getElementById("view");
    var fn = VIEWS[S.view] || viewDashboard;
    viewEl.innerHTML = S.view === "libraries" && S.libId ? viewLibraryDetail(S.libId) : fn();
    /* AI 工作台 / 图谱页：挂载交互（W-A1 / WX3-WX4） */
    if ((S.view === "aiwork" || S.view === "graph") && window.WORKBENCH) {
      try { window.WORKBENCH.bind(viewEl, render); } catch (e) {}
      if (S.view === "graph" && window.GRAPHVIEW) { try { window.GRAPHVIEW.bind(viewEl, render); } catch (e) {} }
    }
    var viewKey = S.view + "|" + (S.libId || "");
    var ovKey = S.overlay || "";
    var enteringView = viewKey !== lastViewKey;
    var enteringOv = ovKey !== lastOvKey;
    lastViewKey = viewKey;
    lastOvKey = ovKey;
    var vc = viewEl.firstElementChild;
    if (vc) {
      vc.classList.add(enteringView ? "enter" : "no-enter");
      if (enteringView && S.view === "libraries" && S.libId) vc.classList.add("drawer");
    }
    if (S.overlay) {
      var ov = document.createElement("div");
      ov.innerHTML = overlayHTML(S.overlay);
      var onode = ov.firstChild;
      var opanel = onode.querySelector(".overlay-panel");
      if (opanel) opanel.classList.add(enteringOv ? "enter" : "no-anim");
      document.body.appendChild(onode);
    }
    window.scrollTo(0, sameView ? prevScroll : 0);
    if (S.overlay === "search") {
      var so = document.getElementById("search-input");
      if (so) {
        var st;
        so.focus();
        so.addEventListener("input", function () {
          clearTimeout(st);
          st = setTimeout(function () {
            S.search = so.value;
            render();
          }, 260);
        });
      }
    }
    if (S.overlay === "intake") bindIntake();
    attachCam();
    if (S.aiOpen) {
      var form = document.getElementById("chat-form");
      if (form) {
        form.addEventListener("submit", function (e) {
          e.preventDefault();
          var t = document.getElementById("chat-text");
          var v = t.value.trim();
          if (!v) return;
          t.value = "";
          API.chatPush({ who: "me", text: v, time: "刚刚" });
          S.chatTyping = true;
          render();
          var cl = document.getElementById("chat-list");
          if (cl) cl.scrollIntoView({ block: "end" });
          var finish = function (msg) {
            S.chatTyping = false;
            API.chatPush(msg);
            S.flipPlans = true;
            render();
            S.flipPlans = false;
            var list = document.getElementById("chat-list");
            if (list) list.scrollIntoView({ block: "end" });
          };
          window.AI.reply(v).then(function (reply) {
            var msg = { who: "ai", text: reply.text, time: "刚刚" };
            if (reply.card) msg.card = reply.card;
            if (reply.action === "generatePlans") {
              return API.generatePlans().then(function (plans) {
                msg.plans = plans.map(function (p) { return p.id; });
                finish(msg);
              });
            }
            if (reply.action === "creative") {
              return API.creativeRecipe().then(function (plan) {
                msg.plans = [plan.id];
                finish(msg);
              });
            }
            finish(msg);
          }).catch(function () {
            S.chatTyping = false;
            render();
          });
        });
        if (window.__WB_ASK) {
          var ci = document.getElementById("chat-text");
          if (ci) { ci.value = window.__WB_ASK; ci.focus(); }
          window.__WB_ASK = "";
        }
      }
    }

    if (S.busy) {
      document.querySelectorAll("[data-busy]").forEach(function (b) {
        if (b.getAttribute("data-busy") === S.busy) {
          b.disabled = true;
          b.classList.add("busy");
        }
      });
    }
    if (S.view === "dashboard") bindChartTips();
    positionNavPill();
    bindScrollReveal();
    if (enteringView && S.view === "dashboard") countUpAll();
    if (S.dealFlag) {
      setTimeout(function () { S.dealFlag = false; }, 1400);
      setTimeout(function () {
      var msgs = ((DB.workbench && DB.workbench.chat) || []).filter(function (m) { return !m.sys; });
        if (msgs.length) showSpeech(msgs[msgs.length - 1].from, msgs[msgs.length - 1].text);
      }, 1100);
    }
  }

  /* ---------- 动作 ---------- */
  function handleAction(action, el) {
    switch (action) {
      case "nav:go":
        S.view = el.getAttribute("data-view");
        if (S.view === "workbench") S.dealFlag = true;
        if (S.view === "dashboard") lastViewKey = "";
        if (S.view === "libraries") {
          S.libId = null;
          S.cabinetOpen = true;
          lastViewKey = "";
        }
        S.overlay = null;
        location.hash = S.view;
        render();
        break;
      case "overlay:open":
        if (el.getAttribute("data-type") === "deckpick") {
      S.deckDraft = ((DB.workbench && DB.workbench.myDeck) || []).slice();
        }
        if (el.getAttribute("data-type") === "intake") {
          DB.intake.step = 0;
          S.shots = [];
          S.shotsFull = [];
          S.mergedCount = 0;
          S.intakeLib = S.intakeLib || (DB.libraries.filter(function (l) { return !l.coopAddOnly; })[0] || {}).id;
        }
        if (el.getAttribute("data-type") === "shopping") {
          API.shoppingList().then(function () { render(); });
        }
        S.overlay = el.getAttribute("data-type");
        render();
        break;
      case "overlay:close":
        if (S.overlay === "intake") stopCam();
        S.overlay = null;
        render();
        break;
      case "ai:toggle":
        S.aiOpen = !S.aiOpen;
        S.aiEnter = S.aiOpen;
        render();
        S.aiEnter = false;
        break;
      case "ai:close":
        S.aiOpen = false;
        render();
        break;
      case "cabinet:toggle": {
        var cab = document.querySelector(".cabinet");
        S.cabinetOpen = !S.cabinetOpen;
        if (cab) cab.classList.toggle("closed", !S.cabinetOpen);
        document.querySelectorAll(".cabinet-toggle-btn").forEach(function (b) {
          b.innerHTML = icon("door", 16) + (S.cabinetOpen ? " 关上柜门" : " 打开柜门");
        });
        break;
      }
      case "lib:back":
        S.libId = null;
        render();
        break;
      case "lib:open":
        if (S.suppressClick) {
          S.suppressClick = false;
          break;
        }
        S.view = "libraries";
        S.libId = el.getAttribute("data-id");
        render();
        break;
      case "daily:check": {
        var id = Number(el.getAttribute("data-id"));
        runBusy("daily", function () {
          return API.toggleDaily(id);
        });
        break;
      }
      case "item:plus":
      case "item:minus": {
        var itId = el.getAttribute("data-id");
        var step = action === "item:plus" ? 1 : -1;
        var curEl = el.closest(".stepper") ? el.closest(".stepper").querySelector(".stepper-val") : null;
        var curText = curEl ? curEl.textContent : "";
        var prev = parseFloat(curText) || 0;
        var unit = curText.split(" ")[1] || "";
        runBusy(action, function () {
          return API.updateItemQty(itId, step);
        }, function () {
          toast((step > 0 ? "已增加" : "已减少") + "数量，变更已留痕");
          var newEl = document.querySelector('.stepper-val[data-id="' + itId + '"]');
          if (newEl) rollNumber(newEl, prev, Math.max(0, prev + step), unit);
        });
        break;
      }
      case "intake:shoot": {
        var pair = grabFrame();
        if (!pair) {
          if (!S.camOn) startCam();
          else toast("画面未就绪，稍候再试");
          break;
        }
        S.shots.push(pair.thumb);
        S.shotsFull.push(pair.full);
        if (S.shots.length >= 6) toast("已达单次上限 6 张（D3）");
        render();
        break;
      }
      case "intake:cam":
        if (S.camOn) {
          stopCam();
          render();
        } else {
          startCam();
        }
        break;
      case "intake:file": {
        var inf = document.getElementById("intake-files");
        if (inf) inf.click();
        break;
      }
      case "intake:remove": {
        var idx = Number(el.getAttribute("data-idx")) || 0;
        S.shots.splice(idx, 1);
        S.shotsFull.splice(idx, 1);
        render();
        break;
      }
      case "intake:cancel":
        DB.intake.step = 0;
        DB.intake.results = [];
        S.shots = [];
        S.shotsFull = [];
        S.mergedCount = 0;
        stopCam();
        render();
        break;
      case "intake:recognize": {
        if (!S.shots.length) {
          toast("先拍摄或选择至少 1 张图片");
          break;
        }
        S.intakeLoading = true;
        DB.intake.step = 1;
        render();
        var raw = S.shots.slice();
        var rawFull = S.shotsFull.slice();
        API.recognize(raw, rawFull)
          .then(function (results) {
            var before = results.length;
            var merged = API.mergeIntake(results);
            S.mergedCount = before - merged.length;
            DB.intake.results = merged;
            S.intakeLoading = false;
            S.shots = [];
            S.shotsFull = [];
            stopCam();
            render();
          })
          .catch(function (e) {
            S.intakeLoading = false;
            DB.intake.step = 0;
            render();
            toast("识别失败：" + (e && e.message ? e.message : "可重试或转手动录入"));
          });
        break;
      }
      case "intake:confirm":
        runBusy("intake:confirm", function () {
          return API.addItems(DB.intake.results, S.intakeLib).then(function () {
            DB.intake.step = 0;
            S.intakeLoading = false;
          });
        }, function () {
          var n = DB.intake.results.filter(function (x) { return x.name; }).length;
          var libName = (API.getState().libraries.filter(function (l) { return l.id === S.intakeLib; })[0] || {}).name || "目标库";
          flyIntake();
          confetti();
          DB.intake.results = [];
          S.shots = [];
          S.shotsFull = [];
          S.overlay = null;
          stopCam();
          toast("已入库 " + n + " 项到「" + libName + "」，价格与保质期来源已标注");
        });
        break;
      case "plan:run": {
        var pid = Number(el.getAttribute("data-id"));
        var pl = DB.plans.filter(function (x) { return x.id === pid; })[0];
        var sel = pl ? pl.selected : null;
        runBusy("plan:run", function () {
          return API.executePlan(pid, sel);
        }, function () {
          confetti();
          toast("方案已执行，库存已按勾选的食材扣减");
        });
        break;
      }
      case "plan:part": {
        var pp = Number(el.getAttribute("data-plan"));
        var nm = el.getAttribute("data-name");
        var pl2 = DB.plans.filter(function (x) { return x.id === pp; })[0];
        if (!pl2 || pl2.status === "done") break;
        var i = pl2.selected.indexOf(nm);
        if (i > -1) pl2.selected.splice(i, 1);
        else pl2.selected.push(nm);
        render();
        break;
      }
      case "filter:items":
        S.itemFilter = el.getAttribute("data-filter") || "all";
        render();
        break;
      case "trend:range":
        S.trendRange = el.getAttribute("data-range") || "7";
        render();
        {
          var lc = document.querySelector(".line-chart");
          if (lc) {
            lc.classList.remove("redraw");
            void lc.offsetWidth;
            lc.classList.add("redraw");
          }
        }
        break;
      case "chat:attach": {
        var ca = document.getElementById("chat-attach");
        if (ca) ca.click();
        break;
      }
      case "chat:send": {
        var gcInp = document.getElementById("group-chat-input");
        var gcVal = gcInp ? gcInp.value.trim() : "";
        if (!gcVal) break;
        gcInp.value = "";
        API.sendChat(DB.user.name, gcVal).then(function () {
          render();
          var gcl = document.getElementById("gc-list");
          if (gcl) gcl.scrollTop = gcl.scrollHeight;
          showSpeech(DB.user.name, gcVal);
        });
        break;
      }
      case "deck:toggle": {
        var did = el.getAttribute("data-id");
        var di = S.deckDraft.indexOf(did);
        if (di > -1) {
          S.deckDraft.splice(di, 1);
        } else {
          if (S.deckDraft.length >= 4) {
            toast("最多带 4 张手牌");
            break;
          }
          S.deckDraft.push(did);
        }
        render();
        break;
      }
      case "deck:save":
        runBusy("deck:save", function () {
          return API.setDeck(S.deckDraft).then(function () { S.overlay = null; });
        }, function () {
          toast("手牌已更新");
        });
        break;
      case "voice:input": {
        var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) {
          toast("当前浏览器不支持语音输入");
          break;
        }
        var rec = new SR();
        rec.lang = "zh-CN";
        var vb = el.closest(".voice-btn") || document.querySelector(".voice-btn");
        if (vb) vb.classList.add("listening");
        var stopVoice = function () {
          if (vb) vb.classList.remove("listening");
        };
        rec.onresult = function (ev) {
          stopVoice();
          var txt = ev.results[0][0].transcript;
          var inp = document.getElementById("chat-text");
          if (inp) inp.value = txt;
        };
        rec.onerror = function () {
          stopVoice();
          toast("语音识别失败，请重试");
        };
        rec.onend = stopVoice;
        rec.start();
        toast("正在聆听，请说话…");
        break;
      }
      case "family:toggle":
        S.familyOpen = !S.familyOpen;
        render();
        break;
      case "family:select": {
        var fid = el.getAttribute("data-id");
        var f = DB.families.filter(function (x) { return x.id === fid; })[0];
        if (f) {
          DB.familyId = f.id;
          DB.family = { name: f.name, memberCount: (DB.members[f.id] || []).length || f.memberCount };
          S.familyOpen = false;
          lastViewKey = "";
          render();
          toast("已切换到" + f.name);
        }
        break;
      }
      case "lib:menu":
        S.libMenu = S.libMenu === el.getAttribute("data-id") ? null : el.getAttribute("data-id");
        render();
        break;
      case "lib:edit": {
        S.editLib = DB.libraries.filter(function (l) { return l.id === el.getAttribute("data-id"); })[0];
        S.libMenu = null;
        S.overlay = "editlib";
        render();
        break;
      }
      case "lib:del": {
        var lid = el.getAttribute("data-id");
        runBusy("lib:del", function () {
          return API.deleteLibrary(lid).then(function (snap) { S.libMenu = null; return snap; });
        }, function (snap) {
          S.lastDeletedLib = snap;
          toast("已删除库「" + snap.lib.name + "」", { label: "撤销", action: "lib:restore" });
        });
        break;
      }
      case "lib:restore":
        runBusy("lib:restore", function () {
          return API.restoreLibrary(S.lastDeletedLib);
        }, function () {
          toast("已恢复库");
        });
        break;
      case "lib:move": {
        var mid = el.getAttribute("data-id");
        var dir = Number(el.getAttribute("data-dir"));
        runBusy("lib:move", function () {
          return API.moveLibrary(mid, dir);
        }, function () {
          toast("已调整排序");
        });
        break;
      }
      case "lib:create": {
        var lname = document.getElementById("lib-name").value.trim();
        if (!lname) { toast("请输入库名称"); break; }
        var licon = document.getElementById("lib-icon").value;
        var ltone = document.getElementById("lib-tone").value;
        runBusy("lib:create", function () {
          return API.createLibrary(lname, licon, ltone).then(function () { S.overlay = null; });
        }, function () {
          flashSuccess('[data-action="overlay:open"][data-type="newlib"]', "已创建");
          toast("已创建库「" + lname + "」");
        });
        break;
      }
      case "lib:rename": {
        var rname = document.getElementById("lib-rename").value.trim();
        if (!rname) break;
        runBusy("lib:rename", function () {
          return API.renameLibrary(S.editLib.id, rname).then(function () { S.overlay = null; });
        }, function () {
          toast("已重命名");
        });
        break;
      }
      case "lib:export":
        runBusy("lib:export", function () {
          return API.exportCSV().then(function (csv) {
            var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
            var a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "启核图策-库存导出.csv";
            document.body.appendChild(a);
            a.click();
            a.remove();
          });
        }, function () {
          toast("已导出库存 CSV");
        });
        break;
      case "lib:import": {
        var fi = document.getElementById("import-file");
        if (fi) fi.click();
        break;
      }
      case "item:add": {
        S.itemLib = DB.libraries.filter(function (l) { return l.id === el.getAttribute("data-lib"); })[0];
        S.overlay = "itemadd";
        render();
        break;
      }
      case "item:edit": {
        var elib = el.getAttribute("data-lib");
        var eit = el.getAttribute("data-id");
        S.itemLib = DB.libraries.filter(function (l) { return l.id === elib; })[0];
        S.itemIt = S.itemLib ? S.itemLib.items.filter(function (x) { return x.id === eit; })[0] : null;
        S.overlay = "itemedit";
        render();
        break;
      }
      case "item:save": {
        var iname = document.getElementById("it-name").value.trim();
        if (!iname) { toast("请输入物品名称"); break; }
        var formId = S.overlay === "itemadd" ? "item-form" : "item-edit-form";
        var sw = document.querySelector("#" + formId + " .switch");
        var data = {
          name: iname,
          qty: document.getElementById("it-qty").value,
          unit: document.getElementById("it-unit").value,
          price: document.getElementById("it-price").value,
          expDays: document.getElementById("it-exp").value,
          pos: document.getElementById("it-pos").value,
          private: sw ? sw.classList.contains("on") : false
        };
        if (S.overlay === "itemadd") {
          runBusy("item:save", function () {
            return API.addItem(S.itemLib.id, data).then(function () { S.overlay = null; });
          }, function () {
            toast("已添加「" + iname + "」");
          });
        } else {
          if (S.itemLib && S.itemLib.coopAddOnly) {
            toast("合作复制库只能添加，不能修改");
            break;
          }
          runBusy("item:save", function () {
            return API.updateItem(S.itemLib.id, S.itemIt.id, data).then(function () { S.overlay = null; });
          }, function () {
            toast("已保存修改");
          });
        }
        break;
      }
      case "item:del": {
        if (S.itemLib && S.itemLib.coopAddOnly) {
          toast("合作复制库只能添加，不能删除");
          break;
        }
        var dlib = S.itemLib.id, dit = S.itemIt.id;
        runBusy("item:del", function () {
          return API.deleteItem(dlib, dit).then(function (snap) { S.overlay = null; return snap; });
        }, function (snap) {
          S.lastDeletedItem = snap;
          toast("已删除「" + snap.item.name + "」", { label: "撤销", action: "item:restore" });
        });
        break;
      }
      case "item:restore":
        runBusy("item:restore", function () {
          return API.restoreItem(S.lastDeletedItem);
        }, function () {
          toast("已恢复物品");
        });
        break;
      case "switch:toggle": {
        var sw2 = el.closest(".switch");
        var on2 = !sw2.classList.contains("on");
        sw2.classList.toggle("on", on2);
        sw2.setAttribute("aria-checked", String(on2));
        break;
      }
      case "plans:generate":
        runBusy("plans", function () {
          return API.generatePlans().then(function (plans) {
            if (S.aiOpen) {
              API.chatPush({ who: "ai", text: "按当前库存重新生成了 " + plans.length + " 个方案，优先消耗临期食材：", time: "刚刚", plans: plans.map(function (p) { return p.id; }) });
            }
            return plans;
          });
        }, function (plans) {
          flashSuccess('[data-action="plans:generate"]', "已生成");
          toast("已生成 " + plans.length + " 个新方案");
        });
        break;
      case "plan:undo": {
        var uid = Number(el.getAttribute("data-id"));
        runBusy("plan:undo", function () {
          return API.rollbackPlan(uid);
        }, function () {
          toast("已撤销，库存恢复");
        });
        break;
      }
      case "alert:done": {
        var aid = Number(el.getAttribute("data-id"));
        runBusy("alert", function () {
          return API.resolveAlert(aid);
        }, function () {
          toast("已处理，预警已归档");
        });
        break;
      }
      case "shop:check": {
        var row = el.closest(".shop-item");
        row.classList.toggle("checked");
        var checked = row.classList.contains("checked");
        el.setAttribute("aria-checked", String(checked));
        break;
      }
      case "shop:copy":
        runBusy("shop", function () {
          return API.shoppingList().then(function (list) {
            var text = "启核图策采购清单\n" + list.map(function (x, i) { return (i + 1) + ". " + x.name + " " + x.qty + "（" + x.src + "）"; }).join("\n");
            if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text);
            return text;
          });
        }, function (text) {
          var preview = text.split("\n").slice(1, 3).join("；");
          toast("采购清单已复制：" + preview + " …");
        });
        break;
      case "shop:share":
        toast("已生成分享卡片，发送给家人");
        break;
      case "wb:copy": {
        var invText = DB.invite.code + "（启核图策家庭邀请码，" + DB.invite.expiresInDays + " 天内有效）";
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(invText);
        toast("邀请码 " + DB.invite.code + " 已复制");
        break;
      }
      case "wb:revoke":
      case "invite:revoke":
        runBusy("wb", function () {
          return API.inviteRevoke();
        }, function () {
          render();
          toast("邀请码已撤销，新成员无法再通过它加入");
        });
        break;
      case "invite:generate":
        runBusy("wb", function () {
          return API.inviteGenerate(7, 3);
        }, function (inv) {
          render();
          toast("已生成新邀请码 " + inv.code + "（7 天有效 · 限 3 人）");
        });
        break;
      case "member:remove":
        runBusy("member", function () {
          return API.memberRemove(el.getAttribute("data-phone"));
        }, function () {
          render();
          toast("已移除成员");
        });
        break;
      case "wb:run":
        runBusy("wb", function () {
          return API.runWorkbench();
        }, function () {
          confetti();
          toast("开饭啦！已按各家扣减：A 家鸡蛋 4 个、B 家番茄 2 个");
        });
        break;
      case "coop:pass":
        if (el.getAttribute("data-seat") === "me") {
          S.passMenu =
            S.passMenu && S.passMenu.seat === "me" && S.passMenu.lib === el.getAttribute("data-lib")
              ? null
              : { seat: "me", lib: el.getAttribute("data-lib") };
        } else {
          S.flipCard =
            S.flipCard && S.flipCard.seat === el.getAttribute("data-seat") && S.flipCard.lib === el.getAttribute("data-lib")
              ? null
              : { seat: el.getAttribute("data-seat"), lib: el.getAttribute("data-lib") };
        }
        render();
        break;
      case "coop:send": {
        var toSeat = el.getAttribute("data-to");
        var fromSeat = S.passMenu ? S.passMenu.seat : el.getAttribute("data-seat") || "me";
        var libId = S.passMenu ? S.passMenu.lib : el.getAttribute("data-lib");
        runBusy("coop:send", function () {
          var p = toSeat === "all"
            ? Promise.all([API.sendLibrary(fromSeat, "A", libId), API.sendLibrary(fromSeat, "B", libId)])
            : API.sendLibrary(fromSeat, toSeat, libId);
          return p.then(function (res) {
            S.passMenu = null;
            S.flipCard = null;
            return res;
          });
        }, function (res) {
          var first = Array.isArray(res) ? res[0] : res;
          if (toSeat !== "me" && toSeat !== "all") {
            aiFollowUp(toSeat);
          } else if (toSeat === "all") {
            aiFollowUp("A");
          }
          confetti();
          if (Array.isArray(res)) {
            toast("已发给 A 家、B 家");
          } else if (first.merged !== undefined && first.merged > 0) {
            toast("已合并「" + first.libName + "」：按编号新增 " + first.merged + " 项");
          } else {
            toast("已将「" + first.libName + "」传给 " + first.toName + (first.coopCreated ? "，已复制到我的库（只可添加）" : ""));
          }
        });
        break;
      }
      case "coop:create": {
        var coopName = (document.getElementById("coop-name") || {}).value || "家庭协作牌桌";
        runBusy("coop", function () {
          return window.COOP.create(coopName).then(function (r) {
            DB.workbench = {
              name: r.name,
              code: r.code,
              expires: new Date(r.expiresAt).toLocaleString("zh-CN"),
              myDeck: [],
              seats: [{ id: "me", name: DB.user.name, color: "teal", libs: [] }],
              chat: []
            };
            API.saveState();
          });
        }, function () {
          render();
          toast("协作池已创建，邀请码 " + DB.workbench.code);
        });
        break;
      }
      case "coop:join": {
        var coopCode = ((document.getElementById("coop-code") || {}).value || "").trim().toUpperCase();
        runBusy("coop", function () {
          if (!coopCode) return Promise.reject(new Error("请先填邀请码"));
          return window.COOP.join(coopCode).then(function (r) {
            var seats = [{ id: "me", name: DB.user.name, color: "teal", libs: [] }];
            (r.members || []).forEach(function (m, i) {
              var nick = m.nickname || m.account || ("成员" + (i + 1));
              if (nick === DB.user.name) return;
              seats.push({ id: "m" + i, name: nick, color: "violet", libs: [] });
            });
            DB.workbench = {
              name: r.name,
              code: r.code,
              expires: new Date(r.expiresAt).toLocaleString("zh-CN"),
              myDeck: [],
              seats: seats,
              chat: []
            };
            API.saveState();
          });
        }, function () { render(); toast("已加入协作池"); });
        break;
      }
      case "coop:end":
        runBusy("coop:end", function () {
          return API.endCoop();
        }, function (summary) {
          showCoopSummary(summary);
          toast("合作已结束，聚合数据与复制库已清理");
        });
        break;
      case "chat:clear":
        runBusy("chat", function () {
          return API.chatClear();
        }, function () {
          render();
          toast("对话已清空（仅本地存储，P0-5）");
        });
        break;
      case "chat:card-confirm": {
        var cm = DB.chat[Number(el.getAttribute("data-idx"))];
        if (!cm || !cm.card || cm.card.done) break;
        var cc = cm.card;
        if (cc.type === "cmd") {
          /* 自然语言指令层的写操作确认（红线 2：先预览后生效） */
          runBusy("chat:card", function () {
            return window.COMMANDS.apply(cc.opKind, cc.opArg).then(function (msg) {
              cc.done = true;
              cc.result = msg || "已执行";
              API.chatPush({ who: "ai", text: cc.result, src: "本地指令 · 0 次模型调用" });
              return cc;
            });
          });
          break;
        }
        if (cc.type === "adjust") {
          runBusy("chat:card", function () {
            return API.updateItemQty(cc.itemId, cc.to - cc.from).then(function () {
              cc.done = true;
              API.touchChat(); /* 落盘卡片状态，刷新不丢（缺陷 I1） */
              return cc;
            });
          }, function (done) {
            render();
            confetti();
            toast("已确认：「" + done.name + "」" + done.from + " → " + done.to + " " + done.unit + "，日志已留痕");
          });
        } else if (cc.type === "shopping_add") {
          runBusy("chat:card", function () {
            return API.shoppingList().then(function () {
              DB.shopping.unshift({ name: cc.name, qty: cc.qty, src: "AI 对话添加（shopping_add）" });
              cc.done = true;
              API.touchChat(); /* 落盘卡片状态，刷新不丢（缺陷 I1） */
              return cc;
            });
          }, function (done) {
            render();
            toast("已加入采购清单：" + done.name);
          });
        }
        break;
      }
      case "chat:card-cancel": {
        var cm2 = DB.chat[Number(el.getAttribute("data-idx"))];
        if (cm2 && cm2.card) {
          cm2.card.cancelled = true;
          API.touchChat();
          render();
        }
        break;
      }
      case "briefing:gen":
        runBusy("briefing", function () {
          return API.setSetting("briefing", window.AI.briefingText());
        }, function () {
          render();
          toast("简报已生成（数字来自统计，AI 仅润色）");
        });
        break;
      case "settings:save-profile": {
        /* 先读值再 runBusy：runBusy 会先重渲染重建输入框 */
        var profVals = {
          people: parseInt((document.getElementById("prof-people") || {}).value, 10) || 3,
          dislikes: (document.getElementById("prof-dislikes") || {}).value || "",
          goal: (document.getElementById("prof-goal") || {}).value || "",
          enabled: (document.getElementById("prof-enabled") || document.querySelector("#prof-enabled")).classList.contains("on")
        };
        runBusy("prof", function () {
          return API.setProfile(profVals);
        }, function () {
          toast("偏好已保存（仅本地，不同步）");
        });
        break;
      }
      case "settings:save-alerts": {
        var alertVals = {
          soon: parseInt((document.getElementById("alert-soon") || {}).value, 10) || 7,
          crit: parseInt((document.getElementById("alert-crit") || {}).value, 10) || 3,
          budget: parseFloat((document.getElementById("budget-input") || {}).value) || 600
        };
        runBusy("alerts", function () {
          return API.setSetting("alertSoon", alertVals.soon).then(function () {
            return API.setSetting("alertCritical", alertVals.crit);
          }).then(function () {
            return API.setBudget(alertVals.budget);
          });
        }, function () {
          toast("预警档位与预算已保存，预警已按新档位重算");
        });
        break;
      }
      case "settings:undo":
        runBusy("undo", function () {
          return API.undoLast();
        }, function (last) {
          render();
          toast("已撤销：" + last.detail);
        });
        break;
      case "sync:upload":
      case "sync:overwrite": {
        var force = action === "sync:overwrite";
        S.busy = "sync";
        render();
        API.syncUpload(force).then(function (r) {
          S.busy = "";
          S.syncConflict = null;
          render();
          toast(force ? "已强制覆盖云端 → v" + r.version : "已上传全量快照 → 云端 v" + r.version);
        }).catch(function (e) {
          S.busy = "";
          if (e && e.status === 409) {
            S.syncConflict = { version: e.version, updatedAt: e.updatedAt };
            render();
            toast("检测到版本冲突（409），请二选一处理（G2）");
          } else {
            render();
            toast("同步失败：" + (e && e.message ? e.message : "请重试"));
          }
        });
        break;
      }
      case "sync:download":
        runBusy("sync", function () {
          return API.syncDownload();
        }, function (r) {
          S.syncConflict = null;
          S.libId = null;
          lastViewKey = "";
          render();
          toast("已拉取云端快照 v" + r.version + "，本地已更新");
        });
        break;
      case "sync:simulate":
        runBusy("sync", function () {
          return API.syncSimulateRemote();
        }, function (v) {
          render();
          toast("已模拟另一台设备上传 → 云端 v" + v + "，现在点「上传同步」试试 409");
        });
        break;
      case "shop:refresh":
        runBusy("shop", function () {
          return API.shoppingList();
        }, function (list) {
          render();
          toast("已重新汇总：" + list.length + " 项（缺料 + 低库存）");
        });
        break;
      case "shop:print":
      case "plans:print":
        document.body.classList.add("printing");
        window.print();
        setTimeout(function () { document.body.classList.remove("printing"); }, 400);
        break;
      case "creative:gen":
        runBusy("creative", function () {
          return API.creativeRecipe();
        }, function (plan) {
          render();
          if (S.aiOpen) {
            API.chatPush({ who: "ai", text: "用临期食材编了一道新菜谱，已加入方案列表：", time: "刚刚", plans: [plan.id] });
          }
          confetti();
          toast("创新菜谱「" + plan.title + "」已生成（P0-3）");
        });
        break;
      case "family:create": {
        var fname = window.prompt("新家庭名称：");
        if (!fname) break;
        runBusy("family", function () {
          return API.familyCreate(fname);
        }, function (f) {
          render();
          toast("已创建并切换到「" + f.name + "」");
        });
        break;
      }
      case "theme:toggle":
        {
          var next = DB.theme === "dark" ? "light" : "dark";
          runBusy("theme", function () {
            return API.setTheme(next).then(function () {
              applyTheme();
            });
          });
        }
        break;
      case "sync:live-now":
        runBusy("live", function () {
          return window.LIVEFLOW ? window.LIVEFLOW.upload(false) : Promise.reject(new Error("活同步未启用"));
        }, function () { toast("已同步到自建后端"); });
        break;
      case "flow:publish":
        runBusy("flow", function () {
          return window.LIVEFLOW ? window.LIVEFLOW.publishFlow() : Promise.reject(new Error("流转未启用"));
        }, function (r) { toast("已发送流转（rev " + ((r && r.rev) || "-") + "）"); });
        break;
      case "flow:pull":
        runBusy("flow", function () {
          return window.LIVEFLOW ? window.LIVEFLOW.pullFlow() : Promise.reject(new Error("流转未启用"));
        }, function (r) {
          toast(r && r.found ? ("已接收 " + (r.from || "另一台设备") + " 的流转") : "暂无新流转");
        });
        break;
      case "tts:say":
        if (window.LIVEFLOW && window.LIVEFLOW.say(el.getAttribute("data-text") || "")) toast("正在播报");
        else toast("当前浏览器不支持语音播报");
        break;
      case "palette:set": {
        var want = el.getAttribute("data-palette-value") === "classic" ? "classic" : "nexcore";
        try { localStorage.setItem(PALETTE_KEY, want); } catch (e) { /* 存储不可用则只影响本次 */ }
        applyTheme();
        render();
        toast(want === "classic" ? "已切换经典橙色板" : "已切回启核绿青蓝");
        break;
      }
      case "setting:toggle": {
        var sw = el.closest(".switch");
        var on = !sw.classList.contains("on");
        sw.classList.toggle("on", on);
        sw.setAttribute("aria-checked", String(on));
        var key = el.getAttribute("data-key");
        runBusy("setting", function () {
          return API.setSetting(key, on);
        }, function () {
          toast(on ? "已开启" : "已关闭");
        });
        break;
      }
      case "settings:logout":
        loggedIn = false;
        localStorage.removeItem("nexcore_logged_in");
        S.view = "login";
        S.overlay = null;
        S.aiOpen = false;
        stopCam();
        render();
        break;
      case "login:code":
        {
          var lp = ((document.getElementById("login-phone") || {}).value || "").trim();
          var lok = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(lp);
          if (!lok) {
            toast("先填邮箱地址（只支持邮箱登录）");
            break;
          }
          if (S.loginCd > 0) break;
          runBusy("login:code", function () {
            if (!window.AUTH) return Promise.reject(new Error("登录服务未就绪"));
            return window.AUTH.requestCode(lp);
          }, function (r) {
            if (!r || !r.ok) {
              toast((r && r.error) || "验证码下发失败");
              return;
            }
            toast(r.hint || "验证码已下发");
            S.loginCd = 60;
            var btn = document.getElementById("login-code-btn");
            if (btn) btn.textContent = S.loginCd + "s 后重发";
            var iv = setInterval(function () {
              S.loginCd -= 1;
              var b2 = document.getElementById("login-code-btn");
              if (b2) b2.textContent = S.loginCd > 0 ? S.loginCd + "s 后重发" : "获取验证码";
              if (S.loginCd <= 0 || !b2) clearInterval(iv);
            }, 1000);
          });
        }
        break;
      case "settings:reset":
        runBusy("reset", function () {
          return API.reset().then(function () {
            S.view = "aiwork";
          });
        }, function () {
          toast("本机缓存已清空，稍后会从后端同步恢复");
        });
        break;
      case "ai:ask":
        S.aiOpen = true;
        S.aiEnter = true;
        S.overlay = null;
        window.__WB_ASK = el.getAttribute("data-q") || "";
        render();
        break;
      case "agnes:save":
        runBusy("agnes", function () {
          return Promise.resolve().then(function () {
            var key = (document.getElementById("agnes-key") || {}).value || "";
            var model = (document.getElementById("agnes-model") || {}).value || "agnes-2.5-flash";
            var vendor = (document.getElementById("agnes-base") || {}).value || "";
            var gw = (document.getElementById("gw-base") || {}).value || "";
            var prefer = (document.getElementById("agnes-prefer") || {}).value || "gateway";
            window.AGNES.saveCfg({
              apiKey: key.trim(),
              model: model.trim(),
              vendorBase: vendor.trim().replace(/\/+$/, "") || "https://api.agnes-ai.cn/v1",
              baseUrl: gw.trim().replace(/\/+$/, ""),
              prefer: prefer
            });
            S.aiStatus = null;
          });
        }, function () {
          toast("AI 通道配置已保存（仅存本机 localStorage）");
        });
        break;
      case "agnes:test":
        runBusy("agnes", function () {
          return window.AGNES.test().then(function (r) {
            var g = r.gateway || {};
            S.aiStatus = g.ok
              ? { ok: true, base: g.base, mode: g.mode, ai: g.ai }
              : { ok: false, error: g.error || "未发现本机后端",
                  direct: r.direct && r.direct.ok ? "厂商直连可用" : "" };
            return r;
          });
        }, function (r) {
          var g = r.gateway || {};
          var d = r.direct || {};
          toast(g.ok
            ? "自建网关连接正常 · " + g.base + (g.ai === "ready" ? " · 网关就绪" : " · 网关未配 Key")
            : "未发现自建后端" + (d.ok
                ? " · 厂商直连可用（" + d.model + " · " + d.ms + "ms）"
                : " · 厂商直连也不可用：" + (d.error || "无 Key")));
        });
        break;
    }
  }

  document.addEventListener("click", function (e) {
    var aiBall = e.target.closest('[data-action="ai:toggle"]');
    if (aiBall) {
      if (S.ballDragged) {
        S.ballDragged = false;
      } else {
        handleAction("ai:toggle", aiBall);
      }
      return;
    }
    if (S.familyOpen && !e.target.closest(".family-menu") && !e.target.closest('[data-action="family:toggle"]')) {
      S.familyOpen = false;
      render();
      return;
    }
    if (S.libMenu && !e.target.closest(".lib-menu") && !e.target.closest('[data-action="lib:menu"]')) {
      S.libMenu = null;
      render();
      return;
    }
    if (S.passMenu && !e.target.closest(".pass-menu") && !e.target.closest('[data-action="coop:pass"]')) {
      S.passMenu = null;
      render();
      return;
    }
    var el = e.target.closest("[data-action]");
    if (el) {
      e.preventDefault();
      handleAction(el.getAttribute("data-action"), el);
    }
  });

  document.addEventListener("input", function (e) {
    var f = e.target.closest("[data-field]");
    if (!f) return;
    var r = DB.intake.results.filter(function (x) { return x.id === f.getAttribute("data-id"); })[0];
    if (!r) return;
    r[f.getAttribute("data-field")] = f.value;
    if (f.getAttribute("data-field") === "name" && f.value.trim()) {
      f.classList.remove("need-attention");
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "import-file" && e.target.files && e.target.files[0]) {
      var file = e.target.files[0];
      var reader = new FileReader();
      reader.onload = function () {
        API.importCSV(String(reader.result)).then(function (n) {
          toast("已导入 " + n + " 件物品");
          render();
        });
      };
      reader.readAsText(file, "utf-8");
      e.target.value = "";
    }
  });

  document.addEventListener("change", function (e) {
    if (e.target && e.target.id === "chat-attach" && e.target.files && e.target.files[0]) {
      var file = e.target.files[0];
      var img = new Image();
      img.onload = function () {
        /* 气泡里放 300px 缩略图，送模型的是 1024px 原图，两者分开 */
        var thumb = fitCanvas(img, 300, 0.6);
        var full = fitCanvas(img, 1024, 0.8);
        API.chatPush({ who: "me", text: "（图片）", img: thumb, time: "刚刚" });
        S.chatTyping = true;
        render();
        API.recognize([thumb], [full]).then(function (results) {
          var names = results.filter(function (r) { return r.name; }).map(function (r) { return r.name + " " + r.qty + r.unit; });
          S.chatTyping = false;
          API.chatPush({
            who: "ai", time: "刚刚",
            text: names.length
              ? "识别到：" + names.join("、") + "。要正式入库请打开「拍照入库」页确认补缺后入库（F1.3）。"
              : "没有识别出可确认的物品，建议到「拍照入库」页拍摄更清晰的照片。"
          });
          render();
          var list = document.getElementById("chat-list");
          if (list) list.scrollIntoView({ block: "end" });
        }).catch(function (err) {
          S.chatTyping = false;
          API.chatPush({ who: "ai", time: "刚刚", text: "图片识别失败：" + ((err && err.message) || "请确认后端已启动后重试") });
          render();
        });
      };
      img.src = URL.createObjectURL(file);
      e.target.value = "";
    }
  });

  document.addEventListener("dragstart", function (e) {
    var c = e.target.closest('[data-drag="lib"]');
    if (c) {
      S.dragId = c.getAttribute("data-id");
      c.classList.add("dragging");
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    }
  });

  document.addEventListener("dragover", function (e) {
    var c = e.target.closest('[data-drag="lib"]');
    if (c) {
      e.preventDefault();
      document.querySelectorAll(".drag-over").forEach(function (x) { x.classList.remove("drag-over"); });
      c.classList.add("drag-over");
    }
  });

  document.addEventListener("dragleave", function (e) {
    var c = e.target.closest('[data-drag="lib"]');
    if (c) c.classList.remove("drag-over");
  });

  document.addEventListener("drop", function (e) {
    var c = e.target.closest('[data-drag="lib"]');
    if (c && S.dragId) {
      e.preventDefault();
      var target = c.getAttribute("data-id");
      var toIndex = 0;
      for (var i = 0; i < DB.libraries.length; i++) {
        if (DB.libraries[i].id === target) toIndex = i;
      }
      if (target !== S.dragId) {
        runBusy("lib:move", function () {
          return API.moveLibraryTo(S.dragId, toIndex);
        }, function () {
          toast("已重新排列库位");
        });
      }
      S.dragId = null;
    }
  });

  document.addEventListener("dragend", function () {
    if (S.dragId) {
      S.suppressClick = true;
      setTimeout(function () { S.suppressClick = false; }, 80);
    }
    S.dragId = null;
    document.querySelectorAll(".dragging,.drag-over").forEach(function (x) {
      x.classList.remove("dragging", "drag-over");
    });
  });

  document.addEventListener("dragstart", function (e) {
    var c = e.target.closest('.fan-card[data-drag="coop"]');
    if (c) {
      S.dragCard = { seat: c.getAttribute("data-seat"), lib: c.getAttribute("data-lib") };
      if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    }
  });

  document.addEventListener("dragover", function (e) {
    var s = e.target.closest(".seat-A, .seat-B");
    if (s && S.dragCard) {
      e.preventDefault();
      document.querySelectorAll(".seat-over").forEach(function (x) { x.classList.remove("seat-over"); });
      s.classList.add("seat-over");
    }
  });

  document.addEventListener("dragleave", function (e) {
    var s = e.target.closest(".seat-A, .seat-B");
    if (s) s.classList.remove("seat-over");
  });

  document.addEventListener("drop", function (e) {
    var s = e.target.closest(".seat-A, .seat-B");
    if (s && S.dragCard) {
      e.preventDefault();
      s.classList.remove("seat-over");
      var to = s.getAttribute("data-seat");
      var dc = S.dragCard;
      S.dragCard = null;
      runBusy("coop:send", function () {
        return API.sendLibrary(dc.seat, to, dc.lib).then(function (res) { return res; });
      }, function (res) {
        if (to !== "me") {
          aiFollowUp(to);
        }
        confetti();
        toast(res.merged !== undefined && res.merged > 0 ? "已合并「" + res.libName + "」：按编号新增 " + res.merged + " 项" : "已将「" + res.libName + "」发给 " + res.toName);
      });
    }
  });

  document.addEventListener("dragend", function () {
    if (S.dragCard) {
      S.suppressClick = true;
      setTimeout(function () { S.suppressClick = false; }, 80);
    }
    S.dragCard = null;
    document.querySelectorAll(".seat-over").forEach(function (x) { x.classList.remove("seat-over"); });
  });

  var aiDrag = null;
  document.addEventListener("pointerdown", function (e) {
    if (!e.target.closest(".ai-ball")) return;
    aiDrag = { x: e.clientX, y: e.clientY, rx: S.ball.x, ry: S.ball.y, moved: false };
  });

  document.addEventListener("pointermove", function (e) {
    if (!aiDrag) return;
    var dx = e.clientX - aiDrag.x;
    var dy = e.clientY - aiDrag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) {
      aiDrag.moved = true;
      S.ball.x = Math.max(8, Math.min(window.innerWidth - 64, aiDrag.rx - dx));
      S.ball.y = Math.max(8, Math.min(window.innerHeight - 64, aiDrag.ry - dy));
      var b = document.querySelector(".ai-ball");
      if (b) {
        b.style.right = S.ball.x + "px";
        b.style.bottom = S.ball.y + "px";
      }
    }
  });

  document.addEventListener("pointerup", function () {
    if (aiDrag) {
      if (aiDrag.moved) S.ballDragged = true;
      try { localStorage.setItem("nexcore_ball", JSON.stringify(S.ball)); } catch (e) {}
    }
    aiDrag = null;
  });

  document.addEventListener("mousemove", function (e) {
    var cub = e.target.closest(".cubby");
    if (cub) {
      var cr = cub.getBoundingClientRect();
      cub.style.setProperty("--mx", (((e.clientX - cr.left) / cr.width) * 100).toFixed(1) + "%");
      cub.style.setProperty("--my", (((e.clientY - cr.top) / cr.height) * 100).toFixed(1) + "%");
    }
    var ball = document.querySelector(".ai-ball.magnetic");
    if (!ball || S.aiOpen || aiDrag) return;
    var br = ball.getBoundingClientRect();
    var dx = e.clientX - (br.left + br.width / 2);
    var dy = e.clientY - (br.top + br.height / 2);
    var d = Math.sqrt(dx * dx + dy * dy);
    if (d < 180 && d > 0) {
      var f = Math.min(10, ((180 - d) / 180) * 10);
      ball.style.transform = "translate(" + ((dx / d) * f).toFixed(1) + "px," + ((dy / d) * f).toFixed(1) + "px)";
    } else {
      ball.style.transform = "";
    }
  });

  document.addEventListener("keydown", function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      S.overlay = "search";
      render();
      return;
    }
    if (e.key === "Escape") {
      if (S.overlay) {
        if (S.overlay === "intake") stopCam();
        S.overlay = null;
        render();
      } else if (S.aiOpen) {
        S.aiOpen = false;
        render();
      }
      return;
    }
    var todo = e.target.closest(".todo-item");
    if (todo && (e.key === " " || e.key === "Enter")) {
      e.preventDefault();
      handleAction("daily:check", todo);
    }
  });

  /* 启动 */
  window.addEventListener("error", function (ev) {
    var el = document.getElementById("fatal");
    if (!el) {
      el = document.createElement("div");
      el.id = "fatal";
      el.style.cssText =
        "position:fixed;left:16px;bottom:16px;right:16px;z-index:999;background:#7f1d1d;color:#FDF6F3;padding:12px 16px;border-radius:10px;font:13px/1.5 sans-serif;white-space:pre-wrap;box-shadow:0 8px 24px rgba(0,0,0,.4)";
      document.body.appendChild(el);
    }
    el.textContent = "页面出错了：" + (ev.message || "未知错误") + "\n请把这段文字发给开发助手。";
  });
  applyTheme();
  /* 活同步：登录态下自动开始（连不上后端就静默降级为本地模式） */
  if (loggedIn && window.LIVEFLOW) {
    setTimeout(function () { window.LIVEFLOW.start(DB.family.id); }, 800);
  }
  setInterval(function () {
    var el = document.getElementById("hero-clock");
    if (el) el.textContent = nowTime();
  }, 30000);
  var routeHash = location.hash.replace(/^#\/?/, "");
  if (routeHash.indexOf("&ai=1") > -1) {
    S.aiOpen = true;
    routeHash = routeHash.split("&")[0];
  }
  if (routeHash.indexOf("&ov=") > -1) {
    S.overlay = routeHash.split("&ov=")[1];
    routeHash = routeHash.split("&")[0];
  }
  if (routeHash === "workbench") S.dealFlag = true;
  if (VIEWS[routeHash]) S.view = routeHash;
  window.addEventListener("hashchange", function () {
    var h = location.hash.replace(/^#\/?/, "");
    if (VIEWS[h]) {
      S.view = h;
      if (h === "workbench") S.dealFlag = true;
      if (h === "dashboard") lastViewKey = "";
      if (h === "libraries") {
        S.libId = null;
        S.cabinetOpen = true;
        lastViewKey = "";
      }
      render();
    }
  });
  render();
})();
