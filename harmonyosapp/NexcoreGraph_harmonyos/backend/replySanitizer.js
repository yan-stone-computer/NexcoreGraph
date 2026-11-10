'use strict';

const BODY_MARKER = /(?:回复内容|最终回复|最终答案|answer)\s*[:：]\s*([\s\S]*)$/i;
const REASONING_HEAD = /^[\s\[【]*(?:思考过程|思考|推理过程|thinking|reasoning)/i;

/**
 * Return only the user-facing part of a model response.
 * An empty result is intentional: callers must not fall back to the raw text.
 */
function sanitizeModelReply(input) {
  let text = String(input == null ? '' : input).replace(/\r\n/g, '\n').trim();
  if (text === '') {
    return '';
  }

  const closingTag = text.lastIndexOf('</think>');
  if (closingTag >= 0) {
    text = text.substring(closingTag + '</think>'.length).trim();
  }

  text = text
    .replace(/<think(?:ing)?[\s\S]*?<\/think(?:ing)?>/gi, '')
    .replace(/<thought[\s\S]*?<\/thought>/gi, '')
    .replace(/<(?:thought|think|thinking)[^>]*>[^\n]*(?:\n|$)/gi, '')
    .replace(/<｜end▁of▁thinking｜>/gi, '')
    .replace(/<\/think>/gi, '')
    .trim();

  if (REASONING_HEAD.test(text)) {
    const body = text.match(BODY_MARKER);
    if (body && body[1].trim() !== '') {
      text = body[1].replace(/[\]】]\s*$/, '').trim();
    } else {
      return '';
    }
  }

  text = text
    .replace(/^(?:思考过程|思考|推理过程|回复策略|thinking|reasoning)\s*[:：][^\n]*\n?/gim, '')
    .replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

module.exports = { sanitizeModelReply };
