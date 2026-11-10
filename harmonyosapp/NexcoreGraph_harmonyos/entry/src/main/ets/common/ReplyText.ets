/* 模型正文展示兜底：服务端是第一道清洗，端侧仍清洗旧会话与异常响应。 */

const BODY_MARKER: RegExp = /(?:回复内容|最终回复|最终答案|answer)\s*[:：]\s*([\s\S]*)$/i;
const REASONING_HEAD: RegExp = /^[\s\[【]*(?:思考过程|思考|推理过程|thinking|reasoning)/i;

export function visibleReply(raw: string): string {
  let text: string = raw.trim();
  if (text === '') {
    return '';
  }

  const closingTag: number = text.lastIndexOf('</think>');
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
    const body: RegExpMatchArray | null = text.match(BODY_MARKER);
    if (body !== null && body.length > 1 && body[1].trim() !== '') {
      text = body[1].replace(/[\]】]\s*$/, '').trim();
    } else {
      return '';
    }
  }

  return text
    .replace(/^(?:思考过程|思考|推理过程|回复策略|thinking|reasoning)\s*[:：][^\n]*\n?/gim, '')
    .replace(/^```[a-zA-Z0-9_-]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
