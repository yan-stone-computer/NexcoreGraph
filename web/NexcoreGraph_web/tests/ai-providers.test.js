const test = require("node:test");
const assert = require("node:assert/strict");
const providers = require("../js/ai-providers.js");

test("提供主流平台预设与自定义接入入口", () => {
  const ids = providers.presets.map((item) => item.id);
  for (const id of ["openai", "deepseek", "qwen", "moonshot", "anthropic", "gemini", "zhipu", "custom-openai"]) {
    assert.equal(ids.includes(id), true, `missing preset: ${id}`);
  }
  assert.equal(providers.get("anthropic").protocol, "anthropic");
  assert.equal(providers.get("gemini").protocol, "gemini");
  assert.equal(providers.get("deepseek").protocol, "openai");
});

test("自定义 Base URL、模型和超时会保留并规范化", () => {
  const config = providers.normalizeConfig({
    provider: "custom-openai",
    protocol: "openai",
    vendorBase: "https://models.example.com/v1///",
    model: "vendor-model-v2",
    visionModel: "vendor-vision-v1",
    apiKey: "test-key",
    chatTimeout: 999999,
    visionTimeout: 1
  });
  assert.equal(config.vendorBase, "https://models.example.com/v1");
  assert.equal(config.model, "vendor-model-v2");
  assert.equal(config.visionModel, "vendor-vision-v1");
  assert.equal(config.chatTimeout, 120000);
  assert.equal(config.visionTimeout, 3000);
});

test("OpenAI 兼容请求使用 Bearer Key 与 chat completions", () => {
  const config = providers.normalizeConfig(providers.get("deepseek"));
  config.apiKey = "test-key";
  const request = providers.buildChatRequest(config, [{ role: "user", content: "你好" }], {
    system: "只回答事实",
    maxTokens: 128
  });
  assert.equal(request.url, "https://api.deepseek.com/v1/chat/completions");
  assert.equal(request.headers.Authorization, "Bearer test-key");
  assert.equal(request.body.model, config.model);
  assert.deepEqual(request.body.messages[0], { role: "system", content: "只回答事实" });
});

test("Anthropic Messages 请求与文本解析", () => {
  const config = providers.normalizeConfig(providers.get("anthropic"));
  config.apiKey = "test-key";
  const request = providers.buildChatRequest(config, [{ role: "user", content: "你好" }], {
    system: "只回答事实",
    maxTokens: 128
  });
  assert.equal(request.url, "https://api.anthropic.com/v1/messages");
  assert.equal(request.headers["x-api-key"], "test-key");
  assert.equal(request.headers["anthropic-version"], "2023-06-01");
  assert.equal(request.body.system, "只回答事实");
  assert.equal(
    providers.parseChatResponse(config, {
      model: "claude-test",
      content: [{ type: "text", text: "可以。" }],
      usage: { input_tokens: 8, output_tokens: 2 }
    }).text,
    "可以。"
  );
});

test("Gemini generateContent 请求与文本解析", () => {
  const config = providers.normalizeConfig(providers.get("gemini"));
  config.apiKey = "test-key";
  const request = providers.buildChatRequest(config, [{ role: "user", content: "你好" }], {
    system: "只回答事实",
    maxTokens: 128
  });
  assert.equal(request.url.includes("/models/"), true);
  assert.equal(request.url.includes(":generateContent?key=test-key"), true);
  assert.equal(request.body.systemInstruction.parts[0].text, "只回答事实");
  assert.equal(
    providers.parseChatResponse(config, {
      candidates: [{ content: { parts: [{ text: "可以。" }] } }],
      usageMetadata: { totalTokenCount: 10 }
    }).text,
    "可以。"
  );
});

test("三家协议的视觉请求都携带图片数据", () => {
  const base = {
    apiKey: "test-key",
    model: "vision-model",
    visionModel: "vision-model"
  };
  for (const id of ["openai", "anthropic", "gemini"]) {
    const config = providers.normalizeConfig(Object.assign({}, providers.get(id), base));
    const request = providers.buildVisionRequest(config, "aW1hZ2U=", "冰箱");
    const encoded = JSON.stringify(request.body);
    assert.equal(encoded.includes("aW1hZ2U="), true, `${id} dropped image data`);
  }
});

test("已保存 Key 只展示掩码", () => {
  assert.equal(providers.maskKey("test-key-1234567890"), "••••7890");
  assert.equal(providers.maskKey("short"), "••••");
  assert.equal(providers.maskKey(""), "");
});
