const test = require('node:test');
const assert = require('node:assert/strict');

const {
  PROVIDERS,
  createProviderConfig,
  mergeProviderConfig,
  publicProviderConfig,
} = require('../aiProviderConfig');

test('exposes mainstream OpenAI-compatible provider presets', () => {
  for (const key of ['agnes', 'deepseek', 'qwen', 'zhipu', 'moonshot', 'openai', 'ollama', 'custom']) {
    assert.ok(PROVIDERS[key], `missing provider preset: ${key}`);
    assert.equal(typeof PROVIDERS[key].baseUrl, 'string');
  }
});

test('uses provider defaults when only a provider is supplied', () => {
  const cfg = createProviderConfig({ provider: 'deepseek', apiKey: 'sk-test' });
  assert.equal(cfg.provider, 'deepseek');
  assert.equal(cfg.baseUrl, PROVIDERS.deepseek.baseUrl);
  assert.equal(cfg.model, PROVIDERS.deepseek.model);
});

test('rejects non-http model endpoints', () => {
  assert.throws(() => createProviderConfig({
    provider: 'custom',
    baseUrl: 'file:///tmp/model',
    model: 'x',
  }), /Base URL/);
});

test('keeps the existing API key when changing only model configuration', () => {
  const current = createProviderConfig({
    provider: 'qwen',
    apiKey: 'sk-existing',
    model: 'qwen-plus',
  });
  const next = mergeProviderConfig(current, {
    provider: 'openai',
    model: 'gpt-5-mini',
  });
  assert.equal(next.apiKey, 'sk-existing');
  assert.equal(next.provider, 'openai');
  assert.equal(next.model, 'gpt-5-mini');
});

test('public configuration never returns the API key', () => {
  const cfg = createProviderConfig({
    provider: 'zhipu',
    apiKey: 'sk-secret-1234',
    model: 'glm-4-flash',
  });
  const pub = publicProviderConfig(cfg);
  assert.equal(pub.hasApiKey, true);
  assert.equal(pub.apiKey, undefined);
  assert.equal(JSON.stringify(pub).includes('sk-secret-1234'), false);
  assert.match(pub.maskedKey, /1234$/);
});
