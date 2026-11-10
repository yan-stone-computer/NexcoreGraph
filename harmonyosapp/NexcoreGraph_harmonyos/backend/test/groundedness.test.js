const test = require('node:test');
const assert = require('node:assert/strict');
const { findUngroundedNumbers } = require('../groundedness');

test('accepts numbers present in evidence', () => {
  const issues = findUngroundedNumbers('冰箱还有 2 盒牛奶。', ['牛奶 2 盒']);
  assert.deepEqual(issues, []);
});

test('reports a number absent from evidence', () => {
  const issues = findUngroundedNumbers('冰箱还有 9 盒牛奶。', ['牛奶 2 盒']);
  assert.equal(issues.length, 1);
  assert.equal(issues[0].token, '9');
});

test('supports decimal quantities', () => {
  const issues = findUngroundedNumbers('预算约 12.5 元。', ['预算 12.5 元']);
  assert.deepEqual(issues, []);
});

test('deduplicates repeated ungrounded numbers', () => {
  const issues = findUngroundedNumbers('有 9 盒，后文又说 9 盒。', ['牛奶 2 盒']);
  assert.equal(issues.length, 1);
});
