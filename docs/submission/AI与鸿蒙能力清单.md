# 启核图策 · AI 与鸿蒙能力清单

| 能力 | API / 模块 | 调用位置 | 用户可见效果 | 验证与降级 |
|---|---|---|---|---|
| 原生声明式 UI | ArkTS / ArkUI | `pages/*.ets` | 全应用无 WebView 主界面 | HAP 构建通过 |
| 元服务 | `atomicService`、`installationFree` | `AppScope/app.json5` | 免安装体验 | HAP 构建通过 |
| 一多适配 | 设备类型 + 断点 | `common/Breakpoints.ets` | 手机单列、平板侧栏、2in1 宽屏 | 已有 3 档布局 |
| 服务卡片 | Form Kit | `EntryFormAbility.ets`、`pages/card/*.ets` | 桌面库存与临期摘要 | 4 张卡片；快照持久化 |
| 应用接续 | `UIAbility.onContinue` | `EntryAbility.ets`、`Continuation.ets` | 换设备继续当前任务 | 真机双设备待补 |
| 原生扫码 | Scan Kit `startScanForResult` | `pages/Overlays.ets` | 条码精确输入 | 元服务构建通过；无能力设备回退拍照 |
| 拍照与相册 | Camera Picker / Media Library | `pages/Overlays.ets` | 拍照建库、连拍合并 | 失败时明确提示 |
| 本地持久化 | Preferences | `common/LocalStore.ets` | 重启保留数据与偏好 | 失败降级内存 |
| GraphRAG | 本地图谱 + 多跳检索 | `common/Graph*.ets` | 回答带路径和来源 | 构图 0 次模型调用 |
| LLM | 后端 AI 网关 | `backend/server.js`、`AiGateway.ets` | 自然语言规划与解释 | 主备模型、限流、超时 |
| 多平台模型适配 | OpenAI-compatible 配置层 | `backend/aiProviderConfig.js`、`AiModelConfig.ets` | 可切换 Agnes、DeepSeek、通义、智谱、Kimi、OpenAI、Ollama 或自定义地址 | 8 个预设；主/备/视觉模型可配 |
| 模型密钥保护 | 服务端配置 + 脱敏 | `/api/ai/config`、`SettingsView` | App 内填写 Key，端侧只见尾号 | Key 不下发；修改需管理员令牌 |
| 视觉识别 | `/api/ai/vision` | `Overlays.ets` | 识别物品、数量、价格、位置 | 空结果不塞假数据 |
| RAG | rawfile 知识库 + 2-gram 索引 | `KnowledgeIndex.ets` | 保质期规则与来源引用 | 随包知识库 |
| Agent 工具 | 白名单动作与策略内核 | `PolicyEngine.ets` | 生成动作、用户确认后执行 | 只读/负数量/未知动作拦截 |
| 数字孪生 | 确定性时间模拟 | `ResourceTwin.ets` | 7 天风险与 What-if | 单元测试 |
| 多域资源模型 | 确定性分类 + 域规则 | `ResourceDomain.ets`、`ResourceTwin.ets` | 食品、药品、健身、工具独立推演 | 域分类与孪生测试 |
| 身体数据训练 | 确定性规则引擎 | `WorkoutPlanner.ets`、`BodyProfilePanel.ets` | BMI、每周计划、动作、组数、现有器材匹配 | 45 条 Hypium 中的训练测试 |
| 数字声明校验 | 规则引擎 | `backend/groundedness.js` | 标记未引用数字 | Node 测试 |
| 正文清洗 | 服务端 + 端侧 | `replySanitizer.js`、`ReplyText.ets` | 不显示内部推理 | 红绿回归测试 |
| 首启引导 | 本地偏好 + AI 工作台 | `AiWorkbench.ets` | 三步完成首次建库 | 可跳过并记忆 |
| 安全评测 | GuardrailBench | `evals/run.js` | 30 条固定红线场景 | 当前 30/30 |

## 明确不虚构的能力

- `NotificationKit.requestEnableNotification()` / `publish()`：当前 `atomicService` 完整 HAP 被编译器拒绝，未纳入成品能力；
- 端侧大模型：元服务包体和平台能力不适合，本轮未宣称；
- 分布式数据对象：需要双设备与协议验证，本轮不宣称超越现有接续与中转同步；
- Live View、小艺建议：未完成注册与真机发现验证，只作为后续规划。
