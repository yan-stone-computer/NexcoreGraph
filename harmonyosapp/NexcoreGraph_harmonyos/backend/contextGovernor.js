/* Compact context governor adapted from
 * yan-stone-computer/nexcore-context-governor (MIT).
 *
 * The upstream implementation separates prefix, injection, session and input
 * budgets. This compact server adapter keeps the same deterministic contract:
 * estimate a request first, trim old evidence/history, preserve the safety
 * prefix and reject impossible requests instead of silently truncating them.
 */

function estimateTokens(value) {
  const text = typeof value === 'string' ? value : JSON.stringify(value || '')
  let cjk = 0
  for (const char of text) {
    if (/[\u3400-\u9fff]/u.test(char)) cjk += 1
  }
  const other = Math.max(0, text.length - cjk)
  return Math.max(1, Math.ceil(cjk + other / 4))
}

function totalTokens(messages) {
  return messages.reduce((sum, message) => sum + 6 + estimateTokens(message.content), 0)
}

function governMessages(messages, options = {}) {
  const input = Array.isArray(messages) ? messages.map((message) => ({ ...message })) : []
  const window = Math.max(4096, Number(options.contextWindow) || Number(process.env.AI_CONTEXT_WINDOW) || 32768)
  const maxOutput = Math.max(1, Number(options.maxOutputTokens) || 600)
  const ceiling = Math.max(1024, Math.floor(window * 0.7) - maxOutput)
  const beforeTokens = totalTokens(input)
  if (!input.length) {
    return { ok: true, messages: [], report: { beforeTokens: 0, afterTokens: 0, ceiling, compacted: false } }
  }

  const system = input[0] && input[0].role === 'system' ? input[0] : null
  const body = system ? input.slice(1) : input.slice()
  const fixedPrefix = system ? String(system.content || '').split('\n证据开始')[0].trim() : ''
  const fixedTokens = fixedPrefix ? estimateTokens(fixedPrefix) : 0
  if (fixedTokens >= ceiling) {
    return {
      ok: false,
      code: 'CONTEXT_OVERFLOW',
      messages: input,
      report: { beforeTokens, afterTokens: beforeTokens, ceiling, compacted: false, reason: '固定安全约束已超过预算' }
    }
  }

  const current = body.length ? body[body.length - 1] : null
  const history = body.slice(0, Math.max(0, body.length - 1))
  const evidenceMarker = system ? String(system.content || '').indexOf('\n证据开始') : -1
  const evidenceText = evidenceMarker >= 0 ? String(system.content).slice(evidenceMarker + '\n证据开始'.length) : ''
  const compactedHistory = history.slice(-4).map((message) => ({
    ...message,
    content: typeof message.content === 'string' ? message.content.slice(0, 1200) : message.content
  }))
  const currentTokens = current ? estimateTokens(current.content) : 0
  const evidenceLimit = Math.max(200, Math.min(6000, ceiling - fixedTokens - currentTokens - 80))
  const compactedEvidence = evidenceText.length > evidenceLimit
    ? evidenceText.slice(0, evidenceLimit) + '\n[证据已按上下文预算截断]'
    : evidenceText
  const systemText = fixedPrefix
    ? fixedPrefix + (compactedEvidence ? '\n证据开始' + compactedEvidence : '')
    : system ? String(system.content || '').slice(0, 6000) : ''
  const output = []
  if (systemText) output.push({ role: 'system', content: systemText })
  output.push(...compactedHistory)
  if (current) {
    output.push({
      ...current,
      content: typeof current.content === 'string' ? current.content.slice(0, 4000) : current.content
    })
  }

  let afterTokens = totalTokens(output)
  while (afterTokens > ceiling && output.length > (systemText ? 1 : 0) + 1) {
    const removeAt = systemText ? 1 : 0
    output.splice(removeAt, 1)
    afterTokens = totalTokens(output)
  }
  if (afterTokens > ceiling) {
    return {
      ok: false,
      code: 'CONTEXT_OVERFLOW',
      messages: output,
      report: { beforeTokens, afterTokens, ceiling, compacted: true, reason: '当前输入与固定约束仍超过模型预算' }
    }
  }

  return {
    ok: true,
    messages: output,
    report: {
      beforeTokens,
      afterTokens,
      ceiling,
      compacted: beforeTokens !== afterTokens,
      droppedMessages: Math.max(0, input.length - output.length)
    }
  }
}

module.exports = { estimateTokens, governMessages }
