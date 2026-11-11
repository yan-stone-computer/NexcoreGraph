/* Multi-provider adapter.
 *
 * Adapted from the project's existing Web adapter and the public API shapes
 * documented by each provider. No provider SDK is required at runtime.
 */

const PRESETS = [
  {
    id: 'openai',
    label: 'OpenAI',
    protocol: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    model: '',
    visionModel: '',
    contextWindow: 128000
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    protocol: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    visionModel: '',
    contextWindow: 64000
  },
  {
    id: 'qwen',
    label: '通义千问',
    protocol: 'openai',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    visionModel: 'qwen-vl-plus',
    contextWindow: 128000
  },
  {
    id: 'moonshot',
    label: 'Moonshot Kimi',
    protocol: 'openai',
    baseUrl: 'https://api.moonshot.cn/v1',
    model: 'moonshot-v1-8k',
    visionModel: '',
    contextWindow: 8192
  },
  {
    id: 'zhipu',
    label: '智谱 GLM',
    protocol: 'openai',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    model: 'glm-4-flash',
    visionModel: 'glm-4v-flash',
    contextWindow: 128000
  },
  {
    id: 'siliconflow',
    label: 'SiliconFlow',
    protocol: 'openai',
    baseUrl: 'https://api.siliconflow.cn/v1',
    model: '',
    visionModel: '',
    contextWindow: 32768
  },
  {
    id: 'ollama',
    label: 'Ollama 本地',
    protocol: 'openai',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: '',
    visionModel: '',
    contextWindow: 32768
  },
  {
    id: 'anthropic',
    label: 'Anthropic Claude',
    protocol: 'anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    model: '',
    visionModel: '',
    contextWindow: 200000
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    protocol: 'gemini',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: '',
    visionModel: '',
    contextWindow: 1000000
  },
  {
    id: 'agnes',
    label: 'Agnes（兼容旧配置）',
    protocol: 'openai',
    baseUrl: 'https://api.agnes-ai.cn/v1',
    model: 'agnes-2.0-flash',
    visionModel: 'agnes-2.5-flash',
    contextWindow: 32768
  },
  {
    id: 'custom-openai',
    label: '自定义 OpenAI 兼容',
    protocol: 'openai',
    baseUrl: '',
    model: '',
    visionModel: '',
    contextWindow: 32768
  },
  {
    id: 'custom-anthropic',
    label: '自定义 Anthropic 兼容',
    protocol: 'anthropic',
    baseUrl: '',
    model: '',
    visionModel: '',
    contextWindow: 200000
  },
  {
    id: 'custom-gemini',
    label: '自定义 Gemini 兼容',
    protocol: 'gemini',
    baseUrl: '',
    model: '',
    visionModel: '',
    contextWindow: 1000000
  }
]

const PROTOCOLS = new Set(['openai', 'anthropic', 'gemini'])

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function get(id) {
  return clone(PRESETS.find((item) => item.id === id) || PRESETS.find((item) => item.id === 'custom-openai'))
}

function trimBase(value) {
  return String(value || '').trim().replace(/\/+$/, '')
}

function clamp(value, fallback, min, max) {
  const n = Number(value)
  return Math.max(min, Math.min(max, Math.round(Number.isFinite(n) ? n : fallback)))
}

function normalizeProviderConfig(input = {}) {
  const providerId = String(input.providerId || input.provider || 'agnes')
  const preset = get(providerId)
  const protocol = PROTOCOLS.has(String(input.protocol || preset.protocol))
    ? String(input.protocol || preset.protocol)
    : preset.protocol
  const model = String(input.model != null ? input.model : preset.model || '').trim()
  const baseUrl = trimBase(input.baseUrl != null ? input.baseUrl : input.vendorBase != null ? input.vendorBase : preset.baseUrl)
  if (baseUrl && !/^https?:\/\//i.test(baseUrl)) {
    throw new Error('Base URL 必须以 http:// 或 https:// 开头')
  }
  return {
    ...preset,
    ...input,
    providerId,
    protocol,
    baseUrl,
    apiKey: String(input.apiKey || input.key || '').trim(),
    model,
    visionModel: String(input.visionModel != null ? input.visionModel : preset.visionModel || model).trim(),
    fallbackModel: String(input.fallbackModel || '').trim(),
    timeoutMs: clamp(input.timeoutMs, 30000, 3000, 120000),
    contextWindow: clamp(input.contextWindow, preset.contextWindow || 32768, 4096, 1000000),
    maxTokens: clamp(input.maxTokens, 600, 1, 8192),
    temperature: Math.max(0, Math.min(2, Number(input.temperature != null ? input.temperature : 0.4) || 0)),
    anthropicVersion: String(input.anthropicVersion || '2023-06-01')
  }
}

function providerFromRequest(req) {
  const header = (name) => String((req && typeof req.get === 'function' && req.get(name)) || '').trim()
  const providerId = header('x-ai-provider') || process.env.AI_PROVIDER || 'agnes'
  const preset = get(providerId)
  return normalizeProviderConfig({
    providerId,
    protocol: header('x-ai-protocol') || process.env.AI_PROTOCOL || preset.protocol,
    baseUrl: header('x-ai-base-url') ||
      process.env.AI_BASE_URL ||
      (providerId === 'agnes' ? process.env.AGNES_BASE_URL : '') ||
      preset.baseUrl,
    apiKey: header('x-ai-key') || header('x-agnes-key') ||
      process.env.AI_API_KEY ||
      (providerId === 'agnes' ? process.env.AGNES_API_KEY : ''),
    model: header('x-ai-model') ||
      process.env.AI_MODEL ||
      (providerId === 'agnes' ? process.env.AGNES_MODEL : '') ||
      preset.model,
    visionModel: header('x-ai-vision-model') ||
      process.env.AI_VISION_MODEL ||
      (providerId === 'agnes' ? process.env.AGNES_VISION_MODELS : '') ||
      preset.visionModel,
    fallbackModel: header('x-ai-fallback-model') ||
      process.env.AI_FALLBACK_MODEL ||
      (providerId === 'agnes' ? process.env.AGNES_MODEL_ALT : ''),
    timeoutMs: header('x-ai-timeout-ms') || process.env.AI_TIMEOUT_MS,
    contextWindow: header('x-ai-context-window') || process.env.AI_CONTEXT_WINDOW,
    maxTokens: header('x-ai-max-tokens') || process.env.AI_MAX_TOKENS
  })
}

function defaultProviderConfig() {
  return providerFromRequest({ get: () => '' })
}

function buildChatRequest(config, messages, opts = {}) {
  const c = normalizeProviderConfig(config)
  const system = String(opts.system || '')
  const maxTokens = Math.max(1, Number(opts.maxTokens) || c.maxTokens)
  const temperature = opts.temperature != null ? Number(opts.temperature) : c.temperature
  if (c.protocol === 'anthropic') {
    return {
      url: c.baseUrl + (/\/v1$/i.test(c.baseUrl) ? '/messages' : '/v1/messages'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.apiKey,
        'anthropic-version': c.anthropicVersion
      },
      body: {
        model: c.model,
        max_tokens: maxTokens,
        temperature,
        system: system || undefined,
        messages
      }
    }
  }
  if (c.protocol === 'gemini') {
    return {
      url: `${c.baseUrl}/models/${encodeURIComponent(c.model)}:generateContent?key=${encodeURIComponent(c.apiKey)}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: messages.map((message) => ({
          role: message.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(message.content || '') }]
        })),
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: { temperature, maxOutputTokens: maxTokens }
      }
    }
  }
  return {
    url: c.baseUrl + '/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + c.apiKey
    },
    body: {
      model: c.model,
      messages: (system ? [{ role: 'system', content: system }] : []).concat(messages),
      temperature,
      max_tokens: maxTokens
    }
  }
}

function parseChatResponse(config, data) {
  const c = normalizeProviderConfig(config)
  let text = ''
  let tokens = 0
  if (c.protocol === 'anthropic') {
    text = (data.content || []).filter((part) => part && part.type === 'text').map((part) => part.text || '').join('')
    tokens = Number((data.usage && data.usage.input_tokens) || 0) + Number((data.usage && data.usage.output_tokens) || 0)
  } else if (c.protocol === 'gemini') {
    const candidate = (data.candidates || [])[0]
    text = candidate && candidate.content && Array.isArray(candidate.content.parts)
      ? candidate.content.parts.map((part) => (part && part.text) || '').join('')
      : ''
    tokens = Number((data.usageMetadata && data.usageMetadata.totalTokenCount) || 0)
  } else {
    const choice = (data.choices || [])[0]
    const content = choice && choice.message ? choice.message.content : ''
    text = Array.isArray(content)
      ? content.map((part) => (part && (part.text || part.content)) || '').join('')
      : String(content || '')
    tokens = Number((data.usage && data.usage.total_tokens) || 0)
  }
  return { text: String(text || '').trim(), model: String(data.model || c.model), tokens }
}

function buildVisionRequest(config, imageBase64, hints, rules = '识别图片中的家庭物品，只输出 JSON 数组。') {
  const c = normalizeProviderConfig(config)
  const image = String(imageBase64 || '').replace(/^data:[^;]+;base64,/, '')
  const prompt = rules + (hints ? '\n已知线索：' + String(hints).slice(0, 200) : '')
  const model = c.visionModel || c.model
  if (c.protocol === 'anthropic') {
    return {
      url: c.baseUrl + (/\/v1$/i.test(c.baseUrl) ? '/messages' : '/v1/messages'),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': c.apiKey,
        'anthropic-version': c.anthropicVersion
      },
      body: {
        model,
        max_tokens: 900,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: image } },
            { type: 'text', text: prompt }
          ]
        }]
      }
    }
  }
  if (c.protocol === 'gemini') {
    return {
      url: `${c.baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(c.apiKey)}`,
      headers: { 'Content-Type': 'application/json' },
      body: {
        contents: [{
          role: 'user',
          parts: [{ inlineData: { mimeType: 'image/jpeg', data: image } }, { text: prompt }]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 900 }
      }
    }
  }
  return {
    url: c.baseUrl + '/chat/completions',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + c.apiKey
    },
    body: {
      model,
      temperature: 0.1,
      max_tokens: 900,
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + image } }
        ]
      }]
    }
  }
}

function redactSecrets(value, secretKeys = ['apikey', 'api_key', 'authorization', 'password', 'secret', 'token']) {
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, secretKeys))
  if (!value || typeof value !== 'object') return value
  const output = {}
  for (const [key, item] of Object.entries(value)) {
    output[key] = secretKeys.some((secret) => key.toLowerCase().includes(secret))
      ? '[redacted]'
      : redactSecrets(item, secretKeys)
  }
  return output
}

function maskKey(value) {
  const key = String(value || '')
  return key.length >= 8 ? '••••' + key.slice(-4) : key ? '••••' : ''
}

function sanitizedConfig(config) {
  const c = normalizeProviderConfig(config)
  return { ...redactSecrets(c), hasKey: Boolean(c.apiKey), keyMasked: maskKey(c.apiKey) }
}

module.exports = {
  PRESETS: clone(PRESETS),
  PROTOCOLS: [...PROTOCOLS],
  get,
  normalizeProviderConfig,
  providerFromRequest,
  defaultProviderConfig,
  buildChatRequest,
  parseChatResponse,
  buildVisionRequest,
  redactSecrets,
  maskKey,
  sanitizedConfig
}
