# 鸿蒙端提分实施记录

> 日期：2026-11-10
> 分支：`codex/web-competition-submission`
> 工程：`harmonyosapp/NexcoreGraph_harmonyos`

## 已完成

### 1. AI 输出安全

- 新增 `backend/replySanitizer.js`，清除思考块、XML 标签、代码围栏与无正文响应。
- 新增端侧 `common/ReplyText.ets`，兼容旧聊天记录和异常网关响应。
- 修复未闭合 `<thought>` 会误删后续正文的问题。
- AI 气泡、摘要和网关解析均使用清洗后的正文。

### 2. 深链鉴权与首启引导

- 新增 `common/NavigationIntent.ets`。
- 服务卡片及通知目标改为登录前排队、登录后消费。
- 删除 `handleCardWant()` 中直接设置 `loggedIn = true` 的鉴权绕过。
- AI 首屏新增一次性三段引导：扫码/拍照建库 → 确认结果 → 查看未来 7 天。

### 3. 家庭资源数字孪生

- 新增 `common/ResourceTwin.ets`：确定性日级库存推演、耗尽预测、浪费风险与健康度。
- 新增 `pages/TwinPanel.ets`。
- AI 首屏显示健康度与 Top 风险，可进入独立沙盘。
- 支持正常、来客 +2、少做 2 餐三种情景。
- 预测结果可直接转为 AI 处置问题。

### 4. 原生扫码与多模态入库

- 接入 HarmonyOS `Scan Kit`：`scanBarcode.startScanForResult()`。
- 新增 `common/BarcodeIntake.ets`。
- 只有视觉识别恰好得到一件物品时才自动关联条码，多个物品时不猜归属。
- 识别卡展示条码来源；入库数据保留识别码。

### 5. Agent 安全内核

- 新增 `common/AgentTypes.ets`、`common/PolicyEngine.ets`。
- 白名单工具：调整库存、加入采购、创建餐食方案、处理预警。
- 只读角色、未知工具、空目标、负数量均被拒绝。
- 写操作必须确认，并按键执行幂等。
- AI 对话与工作台的库存调整、采购按钮已接入策略守卫和忙碌态。

### 6. 数字声明校验

- 新增 `backend/groundedness.js`。
- AI 回答中的数字必须出现在端侧装配证据或 GraphRAG 结构中。
- 网关返回 `ungroundedNumbers` 与 `ungrounded_numbers` 警告。
- AI 气泡证据行显示“数字已核对”或未引用数字数量。

### 7. GuardrailBench

- 新增 `evals/cases.json`、`evals/run.js`、`evals/README.md`。
- 30 条离线确定性用例：15 条正文清洗、15 条数字证据校验。
- 当前结果：`30/30` 通过，硬门槛违规 `0`。

## 平台约束与降级

`Notification Kit` 的 `requestEnableNotification()` 与 `publish()` 在当前元服务 HAP 构建中被编译器以 `11706010 can't support atomicservice application` 拒绝。

处理：

- 不保留无法编译的系统通知调用；
- 使用现有 Form Kit 服务卡片承载桌面临期提醒；
- 在界面和 README 中明确“系统通知留待应用包形态”；
- `tools/check_release.py` 增加“元服务不调用未支持系统通知接口”检查。

`Scan Kit` 虽然当前元服务可编译，但编译警告表明该能力并非所有设备都具备；运行失败时已回退到拍照和相册。

## 当前验证证据

### 鸿蒙 Hypium

测试文件覆盖：

- 模型正文清洗；
- 深链目标解析；
- 数字孪生预测；
- 扫码证据合并；
- 提醒候选与去重；
- Agent 策略与幂等。

当前测试用例数：`28`。

### Node 后端

当前测试用例数：`11`。

### 静态提交检查

`python tools/check_release.py`：

```text
合计 15 项，失败 0 项
```

新增检查：

- 高阶能力模块齐备；
- GuardrailBench 30 条硬门槛；
- Agent 写操作接入策略与幂等；
- 元服务不调用未支持系统通知接口。

### HAP 构建

命令：

```powershell
.\tools\build.ps1 -Task assembleHap
```

结果：`BUILD SUCCESSFUL`。

产物：

```text
entry/build/default/outputs/default/entry-default-unsigned.hap
```

大小：`4,571,377` 字节，约 `4.36 MiB`。

## 尚未完成

- Release 签名证书与 signed HAP；
- 正式包名切换及 AGC 配套；
- 真机扫码、服务卡片、应用接续截图；
- 演示视频与最终 ZIP；
- AppGallery 体验版发布凭证。
