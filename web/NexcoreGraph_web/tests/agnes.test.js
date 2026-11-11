const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const providers = require("../js/ai-providers.js");

const ROOT = path.resolve(__dirname, "..");

function loadClient(fetchImpl, config) {
  const source = fs.readFileSync(path.join(ROOT, "js", "agnes.js"), "utf8");
  const store = new Map([
    ["nexcore_ai_cfg_v1", JSON.stringify(config)]
  ]);
  const window = {};
  const sandbox = {
    window,
    localStorage: {
      getItem: (key) => store.has(key) ? store.get(key) : null,
      setItem: (key, value) => store.set(key, String(value)),
      removeItem: (key) => store.delete(key)
    },
    location: { protocol: "http:", origin: "http://127.0.0.1:8080" },
    navigator: { onLine: true },
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    console
  };
  window.AI_PROVIDERS = providers;
  vm.runInNewContext(source, sandbox, { filename: "agnes.js" });
  return window.AGNES;
}

function response(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
    json: async () => payload
  };
}

test("主模型 429 时自动切换一次备用模型", async () => {
  const calls = [];
  const client = loadClient(async (url, options) => {
    const body = JSON.parse(options.body);
    calls.push({ url, model: body.model });
    if (calls.length === 1) return response(429, { error: "rate limited" });
    return response(200, {
      model: body.model,
      choices: [{ message: { content: "备用模型成功" } }],
      usage: { total_tokens: 12 }
    });
  }, {
    provider: "deepseek",
    protocol: "openai",
    vendorBase: "https://api.deepseek.com/v1",
    apiKey: "test-key",
    model: "primary-model",
    fallbackModel: "backup-model",
    prefer: "direct",
    enabled: true,
    chatTimeout: 30000,
    visionTimeout: 45000
  });

  const result = await client.chat({ question: "测试备用模型" });
  assert.equal(result.text, "备用模型成功");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].model, "primary-model");
  assert.equal(calls[1].model, "backup-model");
});
