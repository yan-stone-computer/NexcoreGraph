'use strict';

/**
 * Provider-independent OpenAI-compatible model configuration.
 * Runtime configuration never exposes the API key to the HarmonyOS client.
 */

const PROVIDERS = {
  agnes: {
    label: 'Agnes AI',
    baseUrl: 'https://api.agnes-ai.cn/v1',
    model: 'agnes-2.0-flash',
    modelAlt: 'agnes-3.0-flash',
    visionModels: 'agnes-2.5-flash,agnes-3.0-flash,agnes-2.0-flash',
  },
  deepseek: {
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    modelAlt: '',
    visionModels: '',
  },
  qwen: {
    label: '通义千问 DashScope',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    modelAlt: 'qwen-turbo',
    visionModels: 'qwen-vl-plus',
  },
  zhipu: {
    label: '智谱 GLM',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    modelAlt: 'glm-4-air',
    visionModels: 'glm-4v-flash',
  },
  moonshot: {
    label: 'Moonshot Kimi',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    modelAlt: '',
    visionModels: '',
  },
  openai: {
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-5-mini',
    modelAlt: '',
    visionModels: 'gpt-5-mini',
  },
  ollama: {
    label: '本地 Ollama',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen3:8b',
    modelAlt: '',
    visionModels: 'qwen2.5vl:7b',
  },
  custom: {
    label: '自定义 OpenAI-compatible',
    baseUrl: '',
    model: '',
    modelAlt: '',
    visionModels: '',
  },
};

function asText(value, fallback = '') {
  if (value === undefined || value === null) {
    return fallback;
  }
  const text = String(value).trim();
  return text === '' ? fallback : text;
}

function normalizeBaseUrl(value) {
  const url = asText(value);
  if (!/^https?:\/\/[^/\s]+/i.test(url)) {
    throw new Error('Base URL 必须是以 http:// 或 https:// 开头的地址');
  }
  return url.replace(/\/+$/, '');
}

function normalizeModels(value) {
  if (Array.isArray(value)) {
    return value.map((item) => asText(item)).filter(Boolean);
  }
  return asText(value).split(',').map((item) => item.trim()).filter(Boolean);
}

function createProviderConfig(input = {}) {
  const provider = asText(input.provider, 'agnes').toLowerCase();
  const preset = PROVIDERS[provider] || PROVIDERS.custom;
  const baseUrl = normalizeBaseUrl(asText(input.baseUrl, preset.baseUrl));
  const model = asText(input.model, preset.model);
  if (model === '') {
    throw new Error('模型名称不能为空');
  }
  return {
    provider: PROVIDERS[provider] ? provider : 'custom',
    baseUrl,
    apiKey: asText(input.apiKey),
    model,
    modelAlt: asText(input.modelAlt, preset.modelAlt),
    visionModels: normalizeModels(input.visionModels === undefined
      ? preset.visionModels : input.visionModels),
    timeoutMs: Math.max(1000, Number(input.timeoutMs || 30000)),
    rpm: Math.max(1, Number(input.rpm || 20)),
    visionBudgetMs: Math.max(1000, Number(input.visionBudgetMs || 25000)),
    visionMaxTokens: Math.max(64, Number(input.visionMaxTokens || 900)),
  };
}

function mergeProviderConfig(current, input = {}) {
  const provider = asText(input.provider, current.provider || 'agnes').toLowerCase();
  const preset = PROVIDERS[provider] || PROVIDERS.custom;
  const providerChanged = provider !== current.provider;
  const draft = {
    provider,
    baseUrl: asText(input.baseUrl, providerChanged ? preset.baseUrl : (current.baseUrl || preset.baseUrl)),
    apiKey: input.clearApiKey === true ? '' : asText(input.apiKey, current.apiKey || ''),
    model: asText(input.model, providerChanged ? preset.model : (current.model || preset.model)),
    modelAlt: asText(input.modelAlt,
      providerChanged ? preset.modelAlt : (current.modelAlt || preset.modelAlt)),
    visionModels: input.visionModels === undefined
      ? (providerChanged ? preset.visionModels : current.visionModels)
      : input.visionModels,
    timeoutMs: input.timeoutMs === undefined ? current.timeoutMs : input.timeoutMs,
    rpm: input.rpm === undefined ? current.rpm : input.rpm,
    visionBudgetMs: input.visionBudgetMs === undefined ? current.visionBudgetMs : input.visionBudgetMs,
    visionMaxTokens: input.visionMaxTokens === undefined ? current.visionMaxTokens : input.visionMaxTokens,
  };
  return createProviderConfig(draft);
}

function publicProviderConfig(config) {
  const key = asText(config.apiKey);
  return {
    provider: config.provider,
    providerLabel: (PROVIDERS[config.provider] || PROVIDERS.custom).label,
    baseUrl: config.baseUrl,
    model: config.model,
    modelAlt: config.modelAlt,
    visionModels: config.visionModels,
    timeoutMs: config.timeoutMs,
    rpm: config.rpm,
    visionBudgetMs: config.visionBudgetMs,
    visionMaxTokens: config.visionMaxTokens,
    hasApiKey: key !== '',
    maskedKey: key === '' ? '' : key.slice(0, 4) + '****' + key.slice(-4),
    providers: Object.keys(PROVIDERS).map((id) => ({ id, label: PROVIDERS[id].label })),
  };
}

module.exports = {
  PROVIDERS,
  createProviderConfig,
  mergeProviderConfig,
  publicProviderConfig,
  normalizeBaseUrl,
};
