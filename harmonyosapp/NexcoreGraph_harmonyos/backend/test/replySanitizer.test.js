const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeModelReply } = require('../replySanitizer');

test('extracts the reply body from a bracketed reasoning wrapper', () => {
  const raw = '[思考过程：用户询问牛奶。回复策略：查库存。][回复内容：冰箱里还有 2 盒牛奶。]';
  assert.equal(sanitizeModelReply(raw), '冰箱里还有 2 盒牛奶。');
});

test('removes xml-style thinking blocks', () => {
  const raw = '<thought>内部推理不展示</thought>\n今晚优先消耗鸡蛋。';
  assert.equal(sanitizeModelReply(raw), '今晚优先消耗鸡蛋。');
});

test('removes vendor thinking markers and closing tags', () => {
  const raw = '内部推导\n</think>\n冰箱里有 3 个鸡蛋。';
  assert.equal(sanitizeModelReply(raw), '冰箱里有 3 个鸡蛋。');
});

test('removes an outer markdown code fence', () => {
  const raw = '```json\n{"summary":"库存充足"}\n```';
  assert.equal(sanitizeModelReply(raw), '{"summary":"库存充足"}');
});

test('returns an empty string when only reasoning is present', () => {
  assert.equal(sanitizeModelReply('[思考过程：只有推理，没有正文]'), '');
});

test('keeps ordinary text that merely contains the word thinking', () => {
  const raw = '我先思考一下，再给你两天的处置顺序。';
  assert.equal(sanitizeModelReply(raw), raw);
});

test('preserves visible text after an unclosed thought tag', () => {
  const raw = '<thought>未闭合\n今晚吃番茄。';
  assert.equal(sanitizeModelReply(raw), '今晚吃番茄。');
});
