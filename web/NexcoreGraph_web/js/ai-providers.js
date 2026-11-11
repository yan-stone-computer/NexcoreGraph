/* 启核图策 · 多平台模型适配器
   纯函数模块：平台预设、请求构造与响应归一化。
   支持 OpenAI 兼容、Anthropic Messages、Google Gemini GenerateContent 三种协议。
   不在代码中保存任何真实 Key。 */
(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.AI_PROVIDERS = api;
})(typeof window !== "undefined" ? window : null, function () {
  "use strict";

  var PRESETS = [
    {
      id: "openai",
      label: "OpenAI",
      protocol: "openai",
      vendorBase: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      visionModel: "gpt-4.1-mini",
      note: "Chat Completions · Bearer Key"
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      protocol: "openai",
      vendorBase: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      visionModel: "",
      note: "OpenAI 兼容 · Bearer Key"
    },
    {
      id: "qwen",
      label: "通义千问",
      protocol: "openai",
      vendorBase: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      model: "qwen-plus",
      visionModel: "qwen-vl-plus",
      note: "DashScope OpenAI 兼容模式"
    },
    {
      id: "moonshot",
      label: "Moonshot Kimi",
      protocol: "openai",
      vendorBase: "https://api.moonshot.cn/v1",
      model: "moonshot-v1-8k",
      visionModel: "",
      note: "OpenAI 兼容 · Bearer Key"
    },
    {
      id: "anthropic",
      label: "Anthropic Claude",
      protocol: "anthropic",
      vendorBase: "https://api.anthropic.com",
      model: "claude-sonnet-4-5",
      visionModel: "claude-sonnet-4-5",
      note: "Messages API · x-api-key"
    },
    {
      id: "gemini",
      label: "Google Gemini",
      protocol: "gemini",
      vendorBase: "https://generativelanguage.googleapis.com/v1beta",
      model: "gemini-2.5-flash",
      visionModel: "gemini-2.5-flash",
      note: "GenerateContent · Key 查询参数"
    },
    {
      id: "zhipu",
      label: "智谱 GLM",
      protocol: "openai",
      vendorBase: "https://open.bigmodel.cn/api/paas/v4",
      model: "glm-4.5-flash",
      visionModel: "glm-4.5v",
      note: "OpenAI 兼容 · Bearer Key"
    },
    {
      id: "siliconflow",
      label: "SiliconFlow",
      protocol: "openai",
      vendorBase: "https://api.siliconflow.cn/v1",
      model: "",
      visionModel: "",
      note: "OpenAI 兼容 · 填写平台模型 ID"
    },
    {
      id: "ollama",
      label: "Ollama 本地",
      protocol: "openai",
      vendorBase: "http://127.0.0.1:11434/v1",
      model: "",
      visionModel: "",
      apiKeyRequired: false,
      note: "本机模型 · 可留空 Key"
    },
    {
      id: "agnes",
      label: "Agnes（旧配置兼容）",
      protocol: "openai",
      vendorBase: "https://api.agnes-ai.cn/v1",
      model: "agnes-2.0-flash",
      visionModel: "agnes-2.5-flash",
      note: "OpenAI 兼容 · 保留旧配置迁移"
    },
    {
      id: "custom-openai",
      label: "自定义 OpenAI 兼容",
      protocol: "openai",
      vendorBase: "",
      model: "",
      visionModel: "",
      note: "适用于 vLLM、Ollama、One API 和企业网关"
    },
    {
      id: "custom-anthropic",
      label: "自定义 Anthropic 兼容",
      protocol: "anthropic",
      vendorBase: "",
      model: "",
      visionModel: "",
      note: "自定义 Messages API 代理"
    },
    {
      id: "custom-gemini",
      label: "自定义 Gemini 兼容",
      protocol: "gemini",
      vendorBase: "",
      model: "",
      visionModel: "",
      note: "自定义 GenerateContent 代理"
    }
  ];

  var PROTOCOLS = ["openai", "anthropic", "gemini"];
  var CONTEXT_WINDOWS = {
    openai: 128000,
    deepseek: 64000,
    qwen: 128000,
    moonshot: 8192,
    anthropic: 200000,
    gemini: 1000000,
    zhipu: 128000,
    siliconflow: 32768,
    ollama: 32768,
    agnes: 32768
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function trimBase(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function get(id) {
    var found = PRESETS.filter(function (item) { return item.id === id; })[0];
    var preset = clone(found || PRESETS.filter(function (item) { return item.id === "custom-openai"; })[0]);
    if (preset.apiKeyRequired === undefined) preset.apiKeyRequired = true;
    if (preset.contextWindow === undefined) preset.contextWindow = CONTEXT_WINDOWS[preset.id] || 32768;
    if (preset.maxTokens === undefined) preset.maxTokens = 600;
    return preset;
  }

  function clamp(value, fallback, min, max) {
    var n = Number(value);
    if (!Number.isFinite(n)) n = fallback;
    return Math.max(min, Math.min(max, Math.round(n)));
  }

  function normalizeConfig(input) {
    input = input || {};
    var providerId = String(input.provider || input.providerId || "custom-openai");
    var preset = get(providerId);
    var protocol = String(input.protocol || preset.protocol || "openai").toLowerCase();
    if (PROTOCOLS.indexOf(protocol) < 0) protocol = preset.protocol || "openai";
    var model = String(input.model != null ? input.model : preset.model || "").trim();
    return Object.assign({}, input, {
      provider: providerId,
      protocol: protocol,
      vendorBase: trimBase(input.vendorBase != null ? input.vendorBase : preset.vendorBase),
      model: model,
      visionModel: String(input.visionModel != null ? input.visionModel : preset.visionModel || model).trim(),
      fallbackModel: String(input.fallbackModel || "").trim(),
      contextWindow: clamp(input.contextWindow, preset.contextWindow || 32768, 4096, 1000000),
      maxTokens: clamp(input.maxTokens, preset.maxTokens || 600, 1, 8192),
      apiKeyRequired: preset.apiKeyRequired !== false,
      chatTimeout: clamp(input.chatTimeout, 30000, 3000, 120000),
      visionTimeout: clamp(input.visionTimeout, 45000, 3000, 120000),
      temperature: clamp(input.temperature != null ? Number(input.temperature) : 0.4, 0.4, 0, 2)
    });
  }

  function openaiUrl(base) {
    return trimBase(base) + "/chat/completions";
  }

  function anthropicUrl(base) {
    var clean = trimBase(base);
    return clean + (/\/v1$/i.test(clean) ? "/messages" : "/v1/messages");
  }

  function geminiUrl(config, stream) {
    var base = trimBase(config.vendorBase);
    var model = encodeURIComponent(String(config.model || ""));
    return base + "/models/" + model + ":" + (stream ? "streamGenerateContent" : "generateContent") +
      "?key=" + encodeURIComponent(String(config.apiKey || ""));
  }

  function textMessages(messages) {
    return (messages || []).map(function (message) {
      return {
        role: String(message.role || "user"),
        content: message.content == null ? "" : message.content
      };
    });
  }

  function buildChatRequest(config, messages, opts) {
    opts = opts || {};
    config = normalizeConfig(config);
    var system = String(opts.system || "");
    var maxTokens = Math.max(1, Number(opts.maxTokens) || 600);
    var temperature = opts.temperature != null ? Number(opts.temperature) : config.temperature;
    if (config.protocol === "anthropic") {
      return {
        url: anthropicUrl(config.vendorBase),
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-api-key": config.apiKey || "",
          "anthropic-version": config.anthropicVersion || "2023-06-01"
        },
        body: {
          model: config.model,
          max_tokens: maxTokens,
          temperature: temperature,
          system: system || undefined,
          messages: textMessages(messages)
        }
      };
    }
    if (config.protocol === "gemini") {
      var contents = textMessages(messages).map(function (message) {
        return {
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: String(message.content) }]
        };
      });
      return {
        url: geminiUrl(config, false),
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: {
          contents: contents,
          systemInstruction: system ? { parts: [{ text: system }] } : undefined,
          generationConfig: { temperature: temperature, maxOutputTokens: maxTokens }
        }
      };
    }
    return {
      url: openaiUrl(config.vendorBase),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: "Bearer " + (config.apiKey || "")
      },
      body: {
        model: config.model,
        messages: (system ? [{ role: "system", content: system }] : []).concat(textMessages(messages)),
        temperature: temperature,
        max_tokens: maxTokens
      }
    };
  }

  function parseChatResponse(config, data) {
    config = normalizeConfig(config);
    data = data || {};
    var text = "";
    var tokens = 0;
    if (config.protocol === "anthropic") {
      text = (data.content || []).filter(function (part) {
        return part && part.type === "text";
      }).map(function (part) { return part.text || ""; }).join("");
      tokens = Number(data.usage && ((data.usage.input_tokens || 0) + (data.usage.output_tokens || 0))) || 0;
    } else if (config.protocol === "gemini") {
      var candidate = data.candidates && data.candidates[0];
      text = candidate && candidate.content && candidate.content.parts
        ? candidate.content.parts.map(function (part) { return part && part.text || ""; }).join("")
        : "";
      tokens = Number(data.usageMetadata && data.usageMetadata.totalTokenCount) || 0;
    } else {
      var choice = data.choices && data.choices[0];
      var content = choice && choice.message ? choice.message.content : "";
      text = Array.isArray(content)
        ? content.map(function (part) { return part && (part.text || part.content) || ""; }).join("")
        : String(content || "");
      tokens = Number(data.usage && data.usage.total_tokens) || 0;
    }
    return {
      text: String(text || "").trim(),
      model: String(data.model || config.model || ""),
      tokens: tokens
    };
  }

  function buildVisionRequest(config, imageBase64, hints, rules) {
    config = normalizeConfig(config);
    var image = String(imageBase64 || "").replace(/^data:[^;]+;base64,/, "");
    var prompt = String(rules || "识别图片中的家庭物品，只输出 JSON 数组。") +
      (hints ? "\n已知线索：" + String(hints).slice(0, 200) : "");
    if (config.protocol === "anthropic") {
      return {
        url: anthropicUrl(config.vendorBase),
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-api-key": config.apiKey || "",
          "anthropic-version": config.anthropicVersion || "2023-06-01"
        },
        body: {
          model: config.visionModel || config.model,
          max_tokens: 900,
          temperature: 0.1,
          messages: [{
            role: "user",
            content: [
              { type: "image", source: { type: "base64", media_type: "image/jpeg", data: image } },
              { type: "text", text: prompt }
            ]
          }]
        }
      };
    }
    if (config.protocol === "gemini") {
      return {
        url: geminiUrl(Object.assign({}, config, { model: config.visionModel || config.model }), false),
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: {
          contents: [{
            role: "user",
            parts: [
              { inlineData: { mimeType: "image/jpeg", data: image } },
              { text: prompt }
            ]
          }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 900 }
        }
      };
    }
    return {
      url: openaiUrl(config.vendorBase),
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        Authorization: "Bearer " + (config.apiKey || "")
      },
      body: {
        model: config.visionModel || config.model,
        temperature: 0.1,
        max_tokens: 900,
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: "data:image/jpeg;base64," + image } }
          ]
        }]
      }
    };
  }

  function maskKey(value) {
    var key = String(value || "");
    if (!key) return "";
    return key.length >= 8 ? "••••" + key.slice(-4) : "••••";
  }

  return {
    presets: clone(PRESETS),
    protocols: PROTOCOLS.slice(),
    get: get,
    normalizeConfig: normalizeConfig,
    buildChatRequest: buildChatRequest,
    parseChatResponse: parseChatResponse,
    buildVisionRequest: buildVisionRequest,
    maskKey: maskKey
  };
});
