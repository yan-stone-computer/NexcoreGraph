# AI 模型多平台接入与自有工程复用

> 项目：启核图策 NexcoreGraph Web 端
> 日期：2026-11-11
> 原则：模型可替换，事实与权限不可替换

## 一、为什么不做单一模型绑定

家庭资源决策会同时遇到文本规划、多模态识别、低延迟快答和隐私部署等不同需求。把模型厂商写死，会让项目在上游限流、模型下线、区域网络或成本变化时失去可运行性。

当前 Web 端把模型接入拆成三层：

1. 页面选择平台、Base URL、文本模型、视觉模型与超时。
2. `ai-providers.js` 把请求归一化为 OpenAI Compatible、Anthropic Messages、Gemini GenerateContent 三种协议。
3. `agnes.js` 保留“自建网关优先、平台直连回落”的双通道策略，失败后进入本地确定性降级。

直连通道还支持备用模型、上下文窗口和最大输出配置。主模型遇到 429、5xx、超时或网络错误时只重试一次备用模型，避免无限调用和成本失控。

模型只能组织语言和候选结构。库存数量、临期判断、Pareto 排序、训练计划、保修与借用风险仍由代码计算。

## 二、内置平台模板

| 平台 | 协议 | 默认 Base URL | 可编辑内容 |
|---|---|---|---|
| OpenAI | OpenAI Compatible | `https://api.openai.com/v1` | Key、Base URL、文本/视觉模型 |
| DeepSeek | OpenAI Compatible | `https://api.deepseek.com/v1` | Key、Base URL、模型 |
| 通义千问 | OpenAI Compatible | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Key、文本/视觉模型 |
| Moonshot Kimi | OpenAI Compatible | `https://api.moonshot.cn/v1` | Key、模型 |
| Anthropic Claude | Messages API | `https://api.anthropic.com` | Key、模型 |
| Google Gemini | GenerateContent | `https://generativelanguage.googleapis.com/v1beta` | Key、模型 |
| 智谱 GLM | OpenAI Compatible | `https://open.bigmodel.cn/api/paas/v4` | Key、文本/视觉模型 |
| SiliconFlow | OpenAI Compatible | `https://api.siliconflow.cn/v1` | Key、平台模型 ID |
| Ollama | OpenAI Compatible | `http://127.0.0.1:11434/v1` | 本机模型、可选择不填 Key |
| Agnes（旧配置兼容） | OpenAI Compatible | `https://api.agnes-ai.cn/v1` | 旧模型与旧 Base URL 迁移 |
| 自定义 OpenAI 兼容 | OpenAI Compatible | 用户填写 | vLLM、Ollama、One API、企业网关 |
| 自定义 Anthropic 兼容 | Messages API | 用户填写 | 自定义代理 |
| 自定义 Gemini 兼容 | GenerateContent | 用户填写 | 自定义代理 |

平台预设只负责减少填写成本，不限制用户修改。模型名称上线后会变化，因此页面始终保留自由输入。

## 三、密钥与同步边界

- 浏览器直连 Key 只写入本机 `localStorage`。
- 设置页不回显完整 Key，只显示末四位掩码，并提供“清除本机 Key”。
- Key 不进入家庭库存快照、协作流转、聊天记录或管理员聚合数据。
- 公开部署推荐由自建网关持有 Key，浏览器只请求同源 `/api/ai/chat` 与 `/api/ai/vision`。
- 部分平台可能限制浏览器跨域直连；系统会显示明确网络错误，正式部署应切换到同源网关。
- `.env` 不属于静态 Web 目录；安全服务器对 `.env` 和 `.env.example` 返回 `404`。

## 四、模型适配的可测试契约

`tests/ai-providers.test.js` 验证：

- 主流平台预设与自定义入口存在。
- 自定义 Base URL、模型和超时会被规范化。
- OpenAI 兼容请求使用 Bearer Key。
- Anthropic 请求使用 `x-api-key` 和 `anthropic-version`。
- Gemini 使用模型路径和 Key 查询参数。
- 三种协议的视觉请求都携带图片数据。
- 已保存 Key 只展示掩码。
- 主模型 429 后只切换一次备用模型，调用次数保持为 2。

这些测试不访问真实模型，不需要 Key，可在评审机器离线运行。

## 五、本项目对自有 GitHub 工程资产的复用

以下仓库均属于 `yan-stone-computer`，本项目复用其设计原则、接口分层或测试方法，不把外部运行时作为比赛程序的强依赖。

| 自有仓库 | 可复用内容 | 在 NexcoreGraph 中的落点 |
|---|---|---|
| [NexcoreToolGuard](https://github.com/yan-stone-computer/NexcoreToolGuard) | 风险分级、内容绑定确认、调用预算与熔断 | Agent 写操作预览、用户确认、撤销与调用上限 |
| [nexcore-context-governor](https://github.com/yan-stone-computer/nexcore-context-governor) | 上下文分块、证据预算与可逆压缩 | GraphRAG 证据装配、限长与来源保留 |
| [NexcoreMemory](https://github.com/yan-stone-computer/NexcoreMemory) | 检索候选、图谱扩展、混合打分与召回回执 | 个人资源图谱、来源路径与历史摘要 |
| [NexcoreVision](https://github.com/yan-stone-computer/NexcoreVision) | OCR、局部视觉证据与独立 VLM 语义分离 | 多模态识别候选、人工补缺与“不伪造结果”边界 |
| [alchemy-ui-skill](https://github.com/yan-stone-computer/alchemy-ui-skill) | 版式系统、状态覆盖、响应式与预检 | Web 设置页、家庭智策和移动端布局复核 |
| [NexcoreGraph-Official](https://github.com/yan-stone-computer/NexcoreGraph-Official) | 品牌资产、发布材料与作品统一口径 | 启核图策品牌、提交材料和在线发布准备 |

除 `NexcoreGraph-Official` 外，上述仓库在 GitHub 元数据中标注为 MIT。复用时仍应保留来源、许可证与本项目自有实现边界。

## 六、评委可验证路径

1. 登录后打开“设置 → 服务器连接 · AI 通道”。
2. 切换 DeepSeek，观察 Base URL 与模型自动填入。
3. 切换 Anthropic，观察协议标签变为 `Anthropic Messages`。
4. 切换 Gemini，观察协议标签变为 `Gemini GenerateContent`。
5. 选择“自定义 OpenAI 兼容”，填写 vLLM、Ollama 或企业网关地址。
6. 填入 Key，保存后确认只显示末四位掩码。
7. 点击“测试连接”，分别查看网关与当前平台状态。
8. 关闭网络或使用错误 Key，观察明确错误与本地降级，不伪造模型结果。
