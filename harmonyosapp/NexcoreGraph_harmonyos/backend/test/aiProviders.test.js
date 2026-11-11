const test = require('node:test')
const assert = require('node:assert/strict')
const providers = require('../aiProviders')

test('provider registry covers mainstream and custom protocols', () => {
  const ids = providers.PRESETS.map((item) => item.id)
  for (const id of [
    'openai', 'deepseek', 'qwen', 'moonshot', 'zhipu',
    'siliconflow', 'ollama', 'anthropic', 'gemini', 'custom-openai'
  ]) {
    assert.equal(ids.includes(id), true, `missing provider: ${id}`)
  }
  assert.equal(providers.get('anthropic').protocol, 'anthropic')
  assert.equal(providers.get('gemini').protocol, 'gemini')
  assert.equal(providers.get('deepseek').protocol, 'openai')
})

test('normalizes custom endpoint, model and bounded settings', () => {
  const config = providers.normalizeProviderConfig({
    providerId: 'custom-openai',
    baseUrl: 'https://models.example.com/v1///',
    apiKey: 'secret-key',
    model: 'vendor-chat-v3',
    visionModel: 'vendor-vision-v1',
    fallbackModel: 'vendor-chat-v2',
    timeoutMs: 999999,
    contextWindow: 9999999,
    maxTokens: 99999
  })

  assert.equal(config.baseUrl, 'https://models.example.com/v1')
  assert.equal(config.model, 'vendor-chat-v3')
  assert.equal(config.visionModel, 'vendor-vision-v1')
  assert.equal(config.fallbackModel, 'vendor-chat-v2')
  assert.equal(config.timeoutMs, 120000)
  assert.equal(config.contextWindow, 1000000)
  assert.equal(config.maxTokens, 8192)
})

test('builds OpenAI compatible requests and parses responses', () => {
  const config = providers.normalizeProviderConfig({
    providerId: 'deepseek',
    apiKey: 'test-key',
    model: 'deepseek-chat'
  })
  const request = providers.buildChatRequest(config, [
    { role: 'user', content: '你好' }
  ], { system: '只回答事实', maxTokens: 128 })

  assert.equal(request.url, 'https://api.deepseek.com/v1/chat/completions')
  assert.equal(request.headers.Authorization, 'Bearer test-key')
  assert.equal(request.body.messages[0].role, 'system')
  assert.deepEqual(
    providers.parseChatResponse(config, {
      model: 'deepseek-chat',
      choices: [{ message: { content: '你好。' } }],
      usage: { total_tokens: 12 }
    }),
    { text: '你好。', model: 'deepseek-chat', tokens: 12 }
  )
})

test('builds Anthropic and Gemini requests', () => {
  const anthropic = providers.normalizeProviderConfig({
    providerId: 'anthropic',
    apiKey: 'test-key',
    model: 'claude-test'
  })
  const ar = providers.buildChatRequest(anthropic, [
    { role: 'user', content: '你好' }
  ], { system: '事实优先' })
  assert.equal(ar.url, 'https://api.anthropic.com/v1/messages')
  assert.equal(ar.headers['x-api-key'], 'test-key')
  assert.equal(ar.headers['anthropic-version'], '2023-06-01')
  assert.equal(ar.body.system, '事实优先')

  const gemini = providers.normalizeProviderConfig({
    providerId: 'gemini',
    apiKey: 'test-key',
    model: 'gemini-test'
  })
  const gr = providers.buildChatRequest(gemini, [
    { role: 'user', content: '你好' }
  ], { system: '事实优先' })
  assert.equal(gr.url.includes('/models/gemini-test:generateContent?key=test-key'), true)
  assert.equal(gr.body.systemInstruction.parts[0].text, '事实优先')
})

test('builds vision requests containing image evidence', () => {
  for (const id of ['openai', 'anthropic', 'gemini']) {
    const config = providers.normalizeProviderConfig({
      providerId: id,
      apiKey: 'test-key',
      model: 'vision-model',
      visionModel: 'vision-model'
    })
    const request = providers.buildVisionRequest(config, 'aW1hZ2U=', '冰箱')
    assert.equal(JSON.stringify(request.body).includes('aW1hZ2U='), true)
  }
})

test('reads generic headers and recursively redacts secrets', () => {
  const config = providers.providerFromRequest({
    get(name) {
      return {
        'x-ai-provider': 'moonshot',
        'x-ai-base-url': 'https://api.moonshot.cn/v1',
        'x-ai-model': 'kimi-custom',
        'x-ai-key': 'top-secret'
      }[String(name).toLowerCase()]
    }
  })
  assert.equal(config.providerId, 'moonshot')
  assert.equal(config.model, 'kimi-custom')
  assert.equal(config.apiKey, 'top-secret')
  const redacted = providers.redactSecrets({
    apiKey: 'top-secret',
    nested: { authorization: 'Bearer abc', safe: 'ok' },
    list: [{ token: 't' }]
  })
  assert.equal(JSON.stringify(redacted).includes('top-secret'), false)
  assert.equal(redacted.nested.safe, 'ok')
})
