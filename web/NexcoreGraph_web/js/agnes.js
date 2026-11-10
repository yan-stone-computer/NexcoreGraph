/* 启核图策 · AI 调用层（Web 端）

   双通道（红线不变：数值由代码计算、写操作先预览、单请求 ≤2 次模型调用；本层只发 1 次）：
     ① 自建网关：POST {后端 base}/api/ai/chat | /api/ai/vision（Key 在后端环境变量 AGNES_API_KEY）
     ② 厂商直连：POST {vendorBase}/chat/completions（Key 存在本机 localStorage，设置页可改）

   顺序：设置页 prefer=gateway（默认）时先试自建网关，连不上再回落厂商直连；
        prefer=direct 时直接用厂商直连。两条路都失败才由调用方降级本地快答。
   这样：评委机器没起后端也能演示；起了后端就走服务端代理。

   密钥来源（三者优先级从高到低，仓库里不留真 Key）：
     ① 设置页填写 → localStorage（nexcore_ai_cfg_v1）
     ② 本机 .env（复制 .env.example 而来；已在 .gitignore 内，不会提交）
     ③ 都没有 → 只有自建网关通道可用 */
(function () {
  "use strict";

  var LS_KEY = "nexcore_ai_cfg_v1";
  var DEFAULTS = {
    baseUrl: "",                                        /* 自建后端地址；留空=自动探测 */
    apiKey: "",                                         /* 厂商直连用；来自 .env 或设置页 */
    model: "agnes-2.5-flash",
    vendorBase: "https://api.agnes-ai.cn/v1",
    prefer: "gateway",                                  /* gateway | direct */
    enabled: true,
    chatTimeout: 30000,
    visionTimeout: 45000
  };
  var BUILTIN = ["http://127.0.0.1:3000", "http://localhost:3000"];

  var resolvedBase = "";
  var serverMode = "";
  var aiState = "";
  var healthMs = 0;
  var lastError = null;
  var lastVia = "";

  function cfg() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem(LS_KEY)) || {}; } catch (e) {}
    var out = {};
    Object.keys(DEFAULTS).forEach(function (k) {
      out[k] = c[k] !== undefined ? c[k] : DEFAULTS[k];
    });
    return out;
  }

  /* 旧配置迁移：早先的 nexcore_agnes_cfg_v1 里 baseUrl 指厂商地址，搬到 vendorBase */
  function migrate() {
    try {
      if (localStorage.getItem(LS_KEY)) return;
      var old = JSON.parse(localStorage.getItem("nexcore_agnes_cfg_v1") || "null");
      if (!old) return;
      var m = {};
      /* 旧的 demo Key 不再沿用：改用 .env / 设置页 */
      if (old.model) m.model = old.model;
      if (old.baseUrl) m.vendorBase = old.baseUrl;
      if (old.enabled !== undefined) m.enabled = old.enabled;
      localStorage.setItem(LS_KEY, JSON.stringify(m));
    } catch (e) { /* 存储不可用就跳过 */ }
  }
  migrate();

  /* 本机 .env → localStorage 种子（只在没配过时读一次；文件不存在就静默跳过） */
  function applyDotEnv(txt) {
    var patch = {};
    String(txt || "").split(/\r?\n/).forEach(function (line) {
      var m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) return;
      var name = m[1];
      var val = m[2].replace(/^["']|["']$/g, "").trim();
      if (!val) return;
      if (name === "AGNES_API_KEY") patch.apiKey = val;
      if (name === "AGNES_MODEL") patch.model = val;
      if (name === "AGNES_VENDOR_BASE") patch.vendorBase = val;
      if (name === "NEXCORE_API_BASE") patch.baseUrl = val;
      if (name === "AGNES_CHAT_TIMEOUT_MS") patch.chatTimeout = Number(val) || DEFAULTS.chatTimeout;
      if (name === "AGNES_VISION_TIMEOUT_MS") patch.visionTimeout = Number(val) || DEFAULTS.visionTimeout;
    });
    if (!Object.keys(patch).length) return;
    var cur = {};
    try { cur = JSON.parse(localStorage.getItem(LS_KEY) || "{}") || {}; } catch (e) { cur = {}; }
    localStorage.setItem(LS_KEY, JSON.stringify(Object.assign({}, patch, cur)));
  }

  var envReady = Promise.resolve().then(function () {
    try {
      var cur = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
      if (cur && cur.apiKey) return null;             /* 本机已配过就不再读文件 */
    } catch (e) { /* 继续尝试读 .env */ }
    if (typeof location === "undefined" || location.protocol === "file:") return null;
    return fetch(".env", { cache: "no-store" }).then(function (res) {
      return res.ok ? res.text() : "";
    }).then(function (txt) { applyDotEnv(txt); return null; })
      .catch(function () { return null; });
  });

  function saveCfg(patch) {
    var c = cfg();
    Object.keys(patch || {}).forEach(function (k) { c[k] = patch[k]; });
    localStorage.setItem(LS_KEY, JSON.stringify(c));
    resolvedBase = "";
    serverMode = "";
    aiState = "";
    return c;
  }

  function trimUrl(u) {
    return String(u || "").trim().replace(/\/+$/, "");
  }

  function sameOrigin() {
    try {
      if (location.protocol === "http:" || location.protocol === "https:") {
        return trimUrl(location.origin);
      }
    } catch (e) { /* file:// 双击打开时没有可用同源 */ }
    return "";
  }

  function candidates() {
    var out = [];
    var manual = trimUrl(cfg().baseUrl);
    if (manual) out.push(manual);
    var so = sameOrigin();
    if (so && out.indexOf(so) < 0) out.push(so);
    BUILTIN.forEach(function (u) { if (out.indexOf(u) < 0) out.push(u); });
    return out;
  }

  function boom(kind, message) {
    lastError = { kind: kind, message: message, at: Date.now() };
    var e = new Error(message);
    e.aiKind = kind;
    return e;
  }

  function fetchTimed(url, opts, ms) {
    var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, ms) : null;
    var o = { method: opts.method, headers: opts.headers || {} };
    if (opts.body !== undefined) o.body = opts.body;
    if (ctrl) o.signal = ctrl.signal;
    return fetch(url, o).then(function (res) {
      if (timer) clearTimeout(timer);
      return res;
    }, function (err) {
      if (timer) clearTimeout(timer);
      if (err && err.name === "AbortError") {
        throw boom("timeout", "响应超时（" + Math.round(ms / 1000) + "s）");
      }
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        throw boom("offline", "当前离线");
      }
      throw boom("network", "连不上服务：" + ((err && err.message) || "网络错误"));
    });
  }

  function probe(base) {
    var t0 = Date.now();
    return fetchTimed(base + "/api/health", { method: "GET" }, 4000).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    }).then(function (info) {
      healthMs = Date.now() - t0;
      return info || {};
    });
  }

  /** 自建后端地址解析：手动 → 同源 → 内置候选；健康探测通过后缓存 */
  function resolveBase() {
    if (resolvedBase !== "") return Promise.resolve(resolvedBase);
    var list = candidates();
    var tryAt = function (i) {
      if (i >= list.length) {
        return Promise.reject(boom("no-server", "未发现自建后端服务"));
      }
      return probe(list[i]).then(function (info) {
        resolvedBase = list[i];
        serverMode = String(info.mode || "");
        aiState = String(info.ai || "");
        return resolvedBase;
      }).catch(function () { return tryAt(i + 1); });
    };
    return tryAt(0);
  }

  function gatewayJson(path, payload, timeoutMs) {
    return resolveBase().then(function (base) {
      return fetchTimed(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload || {})
      }, timeoutMs).then(function (res) {
        return res.text().then(function (txt) {
          var data = null;
          try { data = JSON.parse(txt); } catch (e) { data = null; }
          if (res.ok && data) return data;
          var msg = (data && data.error) || ("网关请求失败（" + res.status + "）");
          if (res.status === 503) throw boom("no-key", msg);
          if (res.status === 429) throw boom("quota", msg);
          if (res.status >= 500) throw boom("server", msg);
          throw boom("bad-request", msg);
        });
      });
    });
  }

  /* ---------- 厂商直连（自建网关不可用时的回落通道，Key 在本机配置里） ---------- */
  function vendorChat(messages, opts) {
    opts = opts || {};
    var c = cfg();
    if (!c.apiKey) {
      return Promise.reject(boom("no-key", "未配置 API Key"));
    }
    var body = {
      model: c.model,
      messages: (opts.system ? [{ role: "system", content: opts.system }] : []).concat(messages),
      temperature: opts.temperature != null ? opts.temperature : 0.4,
      max_tokens: opts.maxTokens || 600
    };
    var t0 = Date.now();
    return fetchTimed(trimUrl(c.vendorBase) + "/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: "Bearer " + c.apiKey
      },
      body: JSON.stringify(body)
    }, c.chatTimeout).then(function (res) {
      if (!res.ok) {
        return res.text().catch(function () { return ""; }).then(function (txt) {
          var msg = "模型服务 " + res.status + (txt ? " · " + txt.slice(0, 120) : "");
          if (res.status === 401 || res.status === 403) throw boom("unauthorized", "API Key 无效或无权限");
          if (res.status === 402 || res.status === 429) throw boom("quota", "额度不足或被限流");
          throw boom("server", msg);
        });
      }
      return res.json();
    }).then(function (data) {
      var text = data && data.choices && data.choices[0] && data.choices[0].message
        ? data.choices[0].message.content : "";
      if (!text) throw boom("server", "模型返回为空");
      lastError = null;
      lastVia = "direct";
      return {
        text: String(text).trim(),
        model: (data && data.model) || c.model,
        ms: Date.now() - t0,
        tokens: (data && data.usage && data.usage.total_tokens) || 0,
        via: "direct"
      };
    });
  }

  /**
   * 对话（双通道）
   * @param {{intent?:string, question:string, evidence?:string, system?:string,
   *          history?:Array, graphEvidence?:Object, maxTokens?:number}} opts
   * system 只给厂商直连通道用；evidence/graphEvidence 交给自建网关拼提示词。
   */
  function chatInner(opts) {
    opts = opts || {};
    var c = cfg();
    if (c.enabled === false) {
      return Promise.reject(boom("disabled", "AI 已在设置中停用"));
    }
    var direct = function () {
      return vendorChat(
        [{ role: "user", content: opts.question || "" }],
        { system: opts.system, maxTokens: opts.maxTokens, temperature: opts.temperature }
      );
    };
    if (c.prefer === "direct") {
      return direct();
    }
    return gatewayJson("/api/ai/chat", {
      familyId: opts.familyId || "",
      user: opts.user || "",
      intent: opts.intent || "other",
      evidence: opts.evidence || "",
      question: opts.question || "",
      history: opts.history || [],
      graphEvidence: opts.graphEvidence || null,
      maxTokens: opts.maxTokens || 600
    }, c.chatTimeout).then(function (data) {
      lastError = null;
      lastVia = "gateway";
      return {
        text: String(data.text || "").trim(),
        model: String(data.model || "gateway"),
        ms: data.ms || 0,
        tokens: data.tokens || 0,
        traceId: data.traceId || "",
        evidenceUsed: data.evidenceUsed || [],
        warnings: data.warnings || [],
        via: "gateway"
      };
    }).catch(function (err) {
      if (!c.apiKey || (c.apiKey && err && err.aiKind === "bad-request")) {
        throw err;   /* 没有备用 Key 时保持原错误，便于界面提示 */
      }
      return direct();
    });
  }

  function chat(opts) {
    return envReady.then(function () { return chatInner(opts); });
  }

  /* ---------- 视觉识别（拍照入库）：网关优先，没有网关就直连厂商 ---------- */
  var VISION_RULES = "你是家庭物品识别引擎。识别图中的家庭物品（食材/衣物/药品/工具/书籍/宠物食品/家电等），" +
    "只输出 JSON 数组，没有家庭物品时输出 []。每项字段：name 名称、category 类别、" +
    "qty 数量（数字）、unit 单位、pos 建议存放位置、expDays 保质期天数（不适用填 0）、price 参考价（元，未知填 0）。" +
    "只输出 JSON，不要解释。";

  function parseVisionItems(text) {
    var t = String(text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
    var s = t.indexOf("[");
    var e = t.lastIndexOf("]");
    if (s >= 0 && e > s) {
      try {
        var arr = JSON.parse(t.substring(s, e + 1));
        return Array.isArray(arr) ? arr : [];
      } catch (err) { /* 落到下面的单对象兜底 */ }
    }
    return [];
  }

  function normalizeItems(raw) {
    var out = [];
    (raw || []).forEach(function (it) {
      if (!it || !it.name) return;
      var qty = Number(it.qty);
      var days = Number(it.expDays);
      out.push({
        name: String(it.name),
        category: String(it.category || "其他"),
        qty: isNaN(qty) || qty <= 0 ? 1 : qty,
        unit: String(it.unit || "个"),
        pos: String(it.pos || ""),
        expDays: isNaN(days) || days < 0 ? 0 : days,
        price: Number(it.price) || 0
      });
    });
    return out;
  }

  function visionInner(opts) {
    opts = opts || {};
    if (!opts.imageBase64) {
      return Promise.reject(boom("bad-request", "缺少图片数据"));
    }
    var c = cfg();
    var direct = function () {
      if (!c.apiKey) return Promise.reject(boom("no-key", "未配置 API Key"));
      var t0 = Date.now();
      return fetchTimed(trimUrl(c.vendorBase) + "/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          Authorization: "Bearer " + c.apiKey
        },
        body: JSON.stringify({
          model: c.model,
          temperature: 0.1,
          max_tokens: 900,
          messages: [
            { role: "system", content: "你是家庭物品识别引擎，只输出 JSON 数组，没有家庭物品时输出 []。" },
            {
              role: "user",
              content: [
                { type: "text", text: VISION_RULES + (opts.hints ? "\n已知线索：" + String(opts.hints).slice(0, 200) : "") },
                { type: "image_url", image_url: { url: "data:image/jpeg;base64," + opts.imageBase64 } }
              ]
            }
          ]
        })
      }, c.visionTimeout).then(function (res) {
        if (!res.ok) throw boom("server", "视觉识别失败（" + res.status + "）");
        return res.json();
      }).then(function (data) {
        var txt = data && data.choices && data.choices[0] && data.choices[0].message
          ? data.choices[0].message.content : "";
        lastError = null;
        lastVia = "direct";
        return {
          items: normalizeItems(parseVisionItems(txt)),
          model: (data && data.model) || c.model,
          ms: Date.now() - t0,
          trail: [],
          noHouseholdItems: parseVisionItems(txt).length === 0,
          via: "direct"
        };
      });
    };
    if (c.prefer === "direct") return direct();
    return gatewayJson("/api/ai/vision", {
      familyId: opts.familyId || "",
      user: opts.user || "",
      imageBase64: opts.imageBase64,
      hints: opts.hints || ""
    }, c.visionTimeout).then(function (data) {
      lastError = null;
      lastVia = "gateway";
      return {
        items: normalizeItems(data.items),
        model: String(data.model || "gateway"),
        ms: data.ms || 0,
        trail: data.trail || [],
        noHouseholdItems: data.noHouseholdItems === true,
        via: "gateway"
      };
    }).catch(function (err) {
      if (!c.apiKey || (err && err.aiKind === "bad-request")) throw err;
      return direct();
    });
  }

  function vision(opts) {
    return envReady.then(function () { return visionInner(opts); });
  }

  /** 设置页“测试连接”：两条通道分别报状态 */
  function testInner() {
    var c = cfg();
    var out = { gateway: null, direct: null };
    resolvedBase = "";
    serverMode = "";
    aiState = "";
    return resolveBase().then(function (base) {
      out.gateway = { ok: true, base: base, mode: serverMode, ai: aiState, ms: healthMs };
      return out;
    }, function (err) {
      out.gateway = { ok: false, error: (err && err.message) || "未发现自建后端" };
      return out;
    }).then(function () {
      if (!c.apiKey) {
        out.direct = { ok: false, error: "未配置 API Key" };
        return out;
      }
      var t0 = Date.now();
      return vendorChat([{ role: "user", content: "回复「ok」两个字母即可。" }],
        { maxTokens: 16, temperature: 0 }).then(function (r) {
          out.direct = { ok: true, model: r.model, ms: Date.now() - t0 };
          return out;
        }, function (err) {
          out.direct = { ok: false, error: (err && err.message) || "直连失败" };
          return out;
        });
    });
  }

  function test() {
    return envReady.then(function () { return testInner(); });
  }

  function status() {
    return { base: resolvedBase, mode: serverMode, ai: aiState, ms: healthMs, via: lastVia };
  }

  window.AGNES = {
    chat: chat,
    vision: vision,
    test: test,
    cfg: cfg,
    saveCfg: saveCfg,
    status: status,
    lastError: function () { return lastError; },
    lastVia: function () { return lastVia; }
  };
  window.GATEWAY = window.AGNES;   /* 语义别名：自建网关通道 */

  /* ---------- 账号（与鸿蒙端 Api.requestLoginCode / loginByCode 同契约） ----------
     POST {后端}/api/auth/code  {account}          → {ok, hint}
     POST {后端}/api/auth/login {account, code}    → {ok, token, nickname, role, families}
     端侧没有固定验证码；后端不可用时由调用方回落到本机演示登录（123456）。 */
  function authPost(path, payload, timeoutMs) {
    return resolveBase().then(function (base) {
      return fetchTimed(base + path, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify(payload || {})
      }, timeoutMs || 12000).then(function (res) {
        return res.text().then(function (txt) {
          var data = null;
          try { data = JSON.parse(txt); } catch (e) { data = null; }
          if (res.ok && data && data.ok !== false) return data;
          throw new Error((data && data.error) || ("请求失败（" + res.status + "）"));
        });
      });
    });
  }

  window.AUTH = {
    /** 后端是否可用 → 返回 base（不可用返回 null），登录页据此标注连接目标 */
    ready: function () {
      return resolveBase().then(function (b) { return b; }, function () { return null; });
    },
    /** 读后端接口（登录后拉家庭信息 / 成员 / 快照用） */
    get: function (path) {
      return resolveBase().then(function (base) {
        return fetchTimed(base + path, { method: "GET" }, 8000).then(function (res) {
          if (!res.ok) throw new Error("HTTP " + res.status);
          return res.json();
        });
      });
    },
    /** 带登录 token 的后端读接口（管理员端用） */
    getAuth: function (path, token) {
      return resolveBase().then(function (base) {
        return fetchTimed(base + path, {
          method: "GET",
          headers: { "X-Auth-Token": token || "" }
        }, 8000).then(function (res) {
          return res.text().then(function (txt) {
            var d = null;
            try { d = JSON.parse(txt); } catch (e) { d = null; }
            if (res.ok && d) return d;
            throw new Error((d && d.error) || ("HTTP " + res.status));
          });
        });
      });
    },
    requestCode: function (account) {
      return authPost("/api/auth/code", { account: account }).then(function (r) {
        return { ok: true, hint: r.hint || ("验证码已发送到 " + account) };
      }, function (e) {
        return { ok: false, error: (e && e.message) || "验证码下发失败" };
      });
    },
    login: function (account, code) {
      return authPost("/api/auth/login", { account: account, code: code }).then(function (r) {
        return { ok: true, via: "gateway", token: r.token, nickname: r.nickname, role: r.role, families: r.families };
      }, function (e) {
        return { ok: false, via: "local", error: e.message };
      });
    }
  };
})();
