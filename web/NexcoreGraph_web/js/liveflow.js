/* 启核图策 · 活同步 + 跨设备流转 + 语音播报（Web 端）

   活同步（对齐鸿蒙端 common/LiveSync.ets）：
     · 每 2s 查一次自建后端 /api/sync/status/{familyId}
     · 云端版本更新 → 自动下载并覆盖本地（只在没有本地改动时应用）
     · 本地内容指纹变化 → 1.5s 防抖后自动上传（带 baseVersion，409 交给界面处理）
   跨设备流转（对齐鸿蒙端 FlowBridge + backend/flow-bridge.js）：
     · 发送：把当前库存/方案/采购等快照 POST 到流转中转（默认 :3100）
     · 接收：GET /api/flow/latest?since=rev，应用到本机
   语音播报：浏览器自带 speechSynthesis（离线可用，不占模型调用）。 */
(function () {
  "use strict";

  var POLL_MS = 2000;
  var DEBOUNCE_MS = 1500;
  var CFG_KEY = "nexcore_live_cfg_v1";
  var DEV_KEY = "nexcore_device_id";

  var timer = null;
  var debounce = null;
  var applying = false;
  var lastFp = "";
  var lastRemote = 0;
  var flowRev = 0;
  var running = false;
  var familyId = "";
  var lastState = "待连接";

  function cfg() {
    try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
  }
  function saveCfg(p) {
    var c = cfg();
    Object.keys(p || {}).forEach(function (k) { c[k] = p[k]; });
    localStorage.setItem(CFG_KEY, JSON.stringify(c));
    return c;
  }
  function deviceId() {
    var d = "";
    try { d = localStorage.getItem(DEV_KEY) || ""; } catch (e) { d = ""; }
    if (!d) {
      d = "web-" + Math.random().toString(36).slice(2, 8);
      try { localStorage.setItem(DEV_KEY, d); } catch (e) { /* ignore */ }
    }
    return d;
  }
  function base() {
    return window.AUTH ? window.AUTH.ready() : Promise.resolve(null);
  }
  function flowBase(mainBase) {
    var c = cfg();
    if (c.flowBase) return String(c.flowBase).replace(/\/+$/, "");
    return String(mainBase || "").replace(/:3000$/, ":3100") || "";
  }
  function req(url, method, body, timeout) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 8000) : null;
    var o = { method: method, headers: { "Content-Type": "application/json" } };
    if (body !== undefined) o.body = JSON.stringify(body);
    if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).then(function (res) {
      if (t) clearTimeout(t);
      return res.text().then(function (txt) {
        var d = null;
        try { d = JSON.parse(txt); } catch (e) { d = null; }
        if (!res.ok) {
          var err = new Error((d && d.error) || ("HTTP " + res.status));
          err.status = res.status;
          err.data = d;
          throw err;
        }
        return d || {};
      });
    }, function (e) {
      if (t) clearTimeout(t);
      throw e;
    });
  }

  function setState(s) {
    lastState = s;
    var el = document.getElementById("live-state");
    if (el) el.textContent = s;
  }
  function state() { return lastState; }

  /* ---------- 同步 ---------- */
  function status() {
    return base().then(function (b) {
      if (!b) throw new Error("未连接自建后端");
      return req(b + "/api/sync/status/" + encodeURIComponent(familyId), "GET");
    });
  }
  function download() {
    return base().then(function (b) {
      if (!b) throw new Error("未连接自建后端");
      return req(b + "/api/sync/download/" + encodeURIComponent(familyId), "GET");
    }).then(function (r) {
      applying = true;
      window.API.applyPayload(r.payload);
      window.API.setLocalVersion(r.version);
      lastRemote = r.version;
      lastFp = JSON.stringify(window.API.snapshotPayload());
      if (window.NXG_RENDER) window.NXG_RENDER();
      return r;
    }).finally(function () {
      setTimeout(function () { applying = false; }, 400);
    });
  }
  function upload(force) {
    return base().then(function (b) {
      if (!b) throw new Error("未连接自建后端");
      var payload = window.API.snapshotPayload();
      var ver = Date.now();
      return req(b + "/api/sync/upload", "POST", {
        familyId: familyId, payload: payload,
        baseVersion: window.API.localVersion(), force: !!force, version: ver
      }, 12000).then(function (r) {
        window.API.setLocalVersion(r.version || ver);
        lastRemote = r.version || ver;
        lastFp = JSON.stringify(payload);
        setState("已同步 v" + (r.version || ver));
        return r;
      });
    });
  }

  function tick() {
    if (!running) return;
    status().then(function (r) {
      lastRemote = r.version || 0;
      var local = window.API.localVersion();
      if (lastRemote > local && !applying) {
        setState("云端有更新 v" + lastRemote + "，拉取中…");
        return download().then(function () { setState("已同步 v" + lastRemote); });
      }
      var fp = JSON.stringify(window.API.snapshotPayload());
      if (lastFp === "") lastFp = fp;
      else if (fp !== lastFp && !applying) {
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(function () {
          upload(false).catch(function (e) {
            if (e && e.status === 409) setState("同步冲突：请在设置里选择覆盖或拉取");
            else setState("同步失败：" + ((e && e.message) || "请检查后端"));
          });
        }, DEBOUNCE_MS);
      }
      if (lastState === "待连接") setState("已连接 · 自动同步中");
    }).catch(function (e) {
      setState("未连接自建后端（" + ((e && e.message) || "离线") + "）");
    });
  }

  function start(fid) {
    if (running || !fid) return;
    familyId = String(fid);
    running = true;
    lastFp = JSON.stringify(window.API.snapshotPayload());
    tick();
    timer = setInterval(tick, POLL_MS);
  }
  function stop() {
    running = false;
    if (timer) { clearInterval(timer); timer = null; }
    if (debounce) { clearTimeout(debounce); debounce = null; }
    setState("已暂停");
  }

  /* ---------- 跨设备流转 ---------- */
  function publishFlow() {
    return base().then(function (b) {
      var fb = flowBase(b);
      if (!fb) throw new Error("未连接自建后端");
      var data = window.API.snapshotPayload();
      var summary = "库 " + (data.libraries || []).length + " 个 · 物品 " +
        (data.libraries || []).reduce(function (n, l) { return n + (l.items || []).length; }, 0) + " 件";
      return req(fb + "/api/flow/publish", "POST", {
        from: deviceId(), json: summary, data: JSON.stringify(data)
      }, 10000);
    }).then(function (r) {
      flowRev = r.rev || flowRev;
      return r;
    });
  }
  function pullFlow() {
    return base().then(function (b) {
      var fb = flowBase(b);
      if (!fb) throw new Error("未连接自建后端");
      return req(fb + "/api/flow/latest?since=" + flowRev, "GET", undefined, 8000);
    }).then(function (r) {
      if (!r.found) return { found: false };
      var data = null;
      try { data = JSON.parse(r.data || "{}"); } catch (e) { data = null; }
      if (!data || !data.libraries) return { found: false };
      applying = true;
      window.API.applyPayload(data);
      flowRev = r.rev || flowRev;
      lastFp = JSON.stringify(window.API.snapshotPayload());
      if (window.NXG_RENDER) window.NXG_RENDER();
      setTimeout(function () { applying = false; }, 400);
      return { found: true, from: r.from, at: r.at, rev: r.rev };
    });
  }

  /* ---------- 语音播报 ---------- */
  function say(text) {
    var t = String(text || "").trim();
    if (!t) return false;
    try {
      if (typeof speechSynthesis === "undefined") return false;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(t.slice(0, 500));
      u.lang = "zh-CN";
      u.rate = 1.02;
      speechSynthesis.speak(u);
      return true;
    } catch (e) { return false; }
  }

  window.LIVEFLOW = {
    start: start, stop: stop, status: status, upload: upload, download: download,
    state: state, publishFlow: publishFlow, pullFlow: pullFlow, cfg: cfg, saveCfg: saveCfg,
    deviceId: deviceId, say: say,
    ttsSupported: function () { return typeof speechSynthesis !== "undefined"; }
  };

  /* ---------- 协作池（后端 /api/coop/*，与鸿蒙端同一契约） ---------- */
  function coopCall(path, payload) {
    return base().then(function (b) {
      if (!b) throw new Error("未连接自建后端");
      return req(b + path, "POST", payload, 10000);
    });
  }
  window.COOP = {
    create: function (name) {
      return coopCall("/api/coop/create", {
        account: (window.DB.user && window.DB.user.phone) || "",
        name: name || "家庭协作牌桌"
      });
    },
    join: function (code) {
      return coopCall("/api/coop/join", {
        account: (window.DB.user && window.DB.user.phone) || "",
        code: String(code || "").toUpperCase()
      });
    }
  };
})();
