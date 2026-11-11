const test = require('node:test')
const assert = require('node:assert/strict')
const { governMessages } = require('../contextGovernor')

test('keeps safety prefix, trims evidence and history within budget', () => {
  const messages = [
    { role: 'system', content: '安全约束：不得编造库存数字。证据开始\n' + '库存证据 '.repeat(500) },
    { role: 'assistant', content: '旧对话'.repeat(400) },
    { role: 'user', content: '今晚吃什么？' }
  ]
  const result = governMessages(messages, {
    contextWindow: 4096,
    maxOutputTokens: 512
  })

  assert.equal(result.ok, true)
  assert.equal(result.messages.at(-1).content, '今晚吃什么？')
  assert.equal(result.messages[0].content.includes('不得编造库存数字'), true)
  assert.equal(result.report.compacted, true)
  assert.equal(result.report.beforeTokens >= result.report.afterTokens, true)
})

test('rejects when fixed safety constraints alone exceed the budget', () => {
  const result = governMessages([
    { role: 'system', content: '安全红线 '.repeat(5000) },
    { role: 'user', content: '继续' }
  ], {
    contextWindow: 1024,
    maxOutputTokens: 512
  })

  assert.equal(result.ok, false)
  assert.equal(result.code, 'CONTEXT_OVERFLOW')
})

test('preserves non-text multimodal payloads during governance', () => {
  const imagePart = { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,aW1hZ2U=' } }
  const result = governMessages([
    { role: 'system', content: '安全约束：只输出 JSON。\n证据开始' + '规则'.repeat(3000) },
    { role: 'user', content: [{ type: 'text', text: '识别冰箱' }, imagePart] }
  ], {
    contextWindow: 8192,
    maxOutputTokens: 900
  })

  assert.equal(result.ok, true)
  assert.deepEqual(result.messages.at(-1).content[1], imagePart)
})
