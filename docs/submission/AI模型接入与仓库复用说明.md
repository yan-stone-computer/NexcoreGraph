# AI 模型接入与仓库内工程复用说明

> 更新日期：2026-11-11
> 适用范围：微信小程序、Web、鸿蒙端及其共用的本地 AI 网关

## 1. 结论

启核图策不再把模型供应商、Base URL 或模型版本写死。产品使用统一的 Provider Contract 管理模型平台，支持 OpenAI-compatible、Anthropic Messages 和 Google Gemini GenerateContent 三类协议。

平台预设只提供默认值。Base URL、文本模型、视觉模型、备用模型、上下文窗口和超时均可在运行时覆盖，因此可以接入新发布的模型、企业代理网关、本地 Ollama 或兼容接口。

## 2. Provider 配置

| 字段 | 含义 | 是否可覆盖 |
|---|---|---|
| `provider` | 平台标识 | 是 |
| `protocol` | `openai` / `anthropic` / `gemini` | 是 |
| `baseUrl` | 平台或企业网关地址 | 是 |
| `apiKey` | 访问密钥 | 是，敏感字段 |
| `model` | 文本模型 ID | 是 |
| `visionModel` | 视觉模型 ID | 是 |
| `fallbackModel` | 失败时备用模型 | 是 |
| `contextWindow` | 模型上下文窗口 | 是 |
| `timeoutMs` | 单次请求超时 | 是 |
| `temperature` | 生成温度 | 是 |
| `maxTokens` | 最大输出 token | 是 |

### 内置平台

| 平台 | 协议 | 默认地址 |
|---|---|---|
| OpenAI | OpenAI-compatible | `https://api.openai.com/v1` |
| DeepSeek | OpenAI-compatible | `https://api.deepseek.com/v1` |
| 通义千问 | OpenAI-compatible | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| Moonshot Kimi | OpenAI-compatible | `https://api.moonshot.cn/v1` |
| 智谱 GLM | OpenAI-compatible | `https://open.bigmodel.cn/api/paas/v4` |
| SiliconFlow | OpenAI-compatible | `https://api.siliconflow.cn/v1` |
| Ollama | OpenAI-compatible | `http://127.0.0.1:11434/v1` |
| Anthropic Claude | Messages API | `https://api.anthropic.com/v1` |
| Google Gemini | GenerateContent | `https://generativelanguage.googleapis.com/v1beta` |
| Agnes | OpenAI-compatible | 保留旧配置兼容 |

“接口已适配”表示请求与响应形状已经实现并有单元测试；“已用真实 Key 验证”需要在具体部署环境单独确认，两者不会混写。

## 3. 调用流程

```text
页面选择 Provider / 模型
          ↓
本地配置规范化与旧 Agnes 配置迁移
          ↓
优先调用自建网关；失败后按设置回落厂商直连
          ↓
四区块上下文预算与确定性压缩
          ↓
OpenAI-compatible / Anthropic / Gemini 适配
          ↓
正文清洗、数字证据校验、用量与耗时留痕
          ↓
工具动作内容摘要 + 用户确认 + 幂等执行
```

## 4. 密钥边界

- 服务端正式部署优先读取 `AI_API_KEY` 等环境变量。
- 小程序和 Web 的“本机配置”仅用于演示或自有设备。
- Key 不进入家庭同步快照、CSV、操作日志、模型用量记录和错误正文。
- 请求使用 `x-ai-key` 通用头，兼容端口从 `x-agnes-key` 迁移。
- 日志只显示“已配置/未配置”，不再输出 Key 前缀或后缀。
- 不同 Provider 之间不会复用同一把 Key。

## 5. 仓库内复用

以下项目均由本项目作者维护，许可证为 MIT。

| 项目 | 复用内容 | 落地位置 |
|---|---|---|
| [NexcoreToolGuard](https://github.com/yan-stone-computer/NexcoreToolGuard) | 参数绑定审批、调用预算、熔断、递归脱敏 | `vendor/nexcore-tool-guard/`、`wxminiapp/.../domain/toolGuard.ts` |
| [nexcore-context-governor](https://github.com/yan-stone-computer/nexcore-context-governor) | 四区块预算、确定性压缩、安全约束回注 | `vendor/nexcore-context-governor/`、`backend/contextGovernor.js` |
| [NexcoreVision](https://github.com/yan-stone-computer/NexcoreVision) | OCR / CNN / VLM 分层视觉证据设计 | 拍照识别证据格式与后续可选服务 |
| [NexcoreFileRead](https://github.com/yan-stone-computer/NexcoreFileRead) | 本地 PDF / Office / OCR 文档读取 | 家电手册、药品说明书知识化入口 |
| [NexcoreAgent](https://github.com/yan-stone-computer/NexcoreAgent) | 端口化 Agent、Trace 与可替换上下文 | 架构参考，不替换现有业务引擎 |

原始模块保留 LICENSE、README 和上游提交号，详见 `vendor/README.md`。

## 6. 官方接口依据

- [OpenAI Node SDK](https://github.com/openai/openai-node)
- [DeepSeek API Docs](https://api-docs.deepseek.com/)
- [Moonshot Chat API](https://platform.moonshot.cn/docs/api/chat)
- [DashScope OpenAI Compatible](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)
- [Anthropic TypeScript SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Google Gen AI JavaScript SDK](https://github.com/googleapis/js-genai)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)

## 7. 测试

```powershell
cd wxminiapp/NexcoreGraph_wxminiapp
npm run verify:weapp

cd ../../harmonyosapp/NexcoreGraph_harmonyos/backend
npm test

cd ../../web/NexcoreGraph_web
node --test tests/*.test.js
```
