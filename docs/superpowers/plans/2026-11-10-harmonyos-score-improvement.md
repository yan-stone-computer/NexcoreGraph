# 启核图策鸿蒙端提分与高阶能力实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` when implementation starts. Execute tasks in order, keep every task independently testable, and do not claim an unverified capability in submission materials.

**Goal:** 在 2026-11-18 前把鸿蒙端从“界面美观、能调用 AI”的 66 分作品，升级为“原生智能 + 可解释 AI + 可验证工程闭环”的完整参赛作品。

**Architecture:** 保留现有 ArkTS/ArkUI、元服务、服务卡片、应用接续、AI 网关和 GraphRAG 基座；新增“家庭资源数字孪生”“Agentic 决策链”“证据账本与数字声明校验”“原生扫码多模态入库”“主动智能触达”五个高阶系统。所有 AI 数字继续由代码计算，所有写操作继续经过预览、权限校验、幂等执行和撤销。

**Tech Stack:** HarmonyOS NEXT API 23、ArkTS、ArkUI、Stage 模型、元服务、Form Kit、Notification Kit、Scan Kit、Preferences、Node.js 后端、现有 GraphRAG/知识库、Hypium、Node 内置测试。

**Specs:**

- `docs/启核图策-鸿蒙端专项整改与验收文档.md`
- `docs/启核图策-赛道要求对照与漏洞审计报告.md`
- `docs/启核图策-AI主导与GraphRAG补充方案.md`
- `harmonyosapp/NexcoreGraph_harmonyos/docs/启核图策-项目完整文档.md`

## Global Constraints

- 作品提交截止：`2026-11-18`；代码与材料冻结：`2026-11-16 18:00`。
- 主工程：`harmonyosapp/NexcoreGraph_harmonyos`；以鸿蒙端为主，Web/小程序/安卓/Qt 不占本轮关键路径。
- 保留现有品牌视觉和“一多适配”成果，不做无收益的大改版。
- 端侧不得出现模型厂商密钥；所有模型调用继续走 `/api/ai/*`。
- 数量、日期、价格、权限结论必须由代码或结构化数据产生，模型只能引用证据。
- 所有写操作必须“预览 → 用户确认 → 执行 → 校验 → 可撤销”。
- 未知或未验证的功能不得进入作品说明；平台 POC 失败的能力只能列为后续规划。
- 每项功能必须同时留下代码、测试、截图或日志中的至少两类证据。
- 元服务包保持安装包小于 10MB；不得引入端侧大模型、图数据库或重依赖。
- 提交 ZIP 命名为 `第九届传智杯-AI鸿蒙赛道-启核图策.zip`，建议不超过 300MB。
- 不把本次 66 分截屏写成“往届成果”；若无更早参赛成果，“历史说明”一栏填写“无”。

---

## 1. 当前基线与评分诊断

### 1.1 评分页可见事实

截图显示：

- 分数：`66`
- 团队：`天枢序列`
- 高校：`广西师范大学`
- 评审认可：界面较美观、已实现一多适配、已接入 AI 并能分析统筹家庭资源。
- 明确短板：继续优化应用细节、接入鸿蒙特色能力、增加更多 AI 能力。

### 1.2 当前工程可复用资产

| 能力 | 代码证据 | 处理策略 |
|---|---|---|
| 原生 ArkTS/ArkUI | `entry/src/main/ets/pages/*.ets` | 保留并深化 |
| 元服务 | `AppScope/app.json5` 的 `bundleType: atomicService` | 所有新增 API 必须核对元服务支持 |
| 一多适配 | `common/Breakpoints.ets`、`pages/Index.ets` | 保留，补证据与无障碍 |
| 四张服务卡片 | `pages/card/*.ets`、`profile/form_config.json` | 升级主动触达与深链安全 |
| 应用接续 | `EntryAbility.ets`、`common/Continuation.ets` | 修复入口鉴权并增加可见证据 |
| GraphRAG | `common/Graph*.ets`、`common/AiGateway.ets` | 升级为证据账本与数字校验 |
| AI 网关 | `backend/server.js`、`common/AiGateway.ets` | 强化正文清洗与审计 |
| 知识库 RAG | `common/KnowledgeIndex.ets`、`resources/rawfile/knowledge` | 保留，作为证据来源 |
| 拍照识别 | `pages/Overlays.ets`、`/api/ai/vision` | 增加原生扫码的精确输入 |
| 价值指标 | `common/Api.ets`、`pages/AnalyticsBoard.ets` | 升级为数字孪生风险指标 |

### 1.3 必须先修的扣分细节

| 问题 | 证据 | 影响 |
|---|---|---|
| AI 气泡曾出现原始“思考过程”和 `</think>` | `docs/codelab/images/05-ai-workbench.jpeg`；`AiPanel.ets` 直接渲染 `m.text` | 评委直接看到内部提示与未清洗输出 |
| 服务卡片入口直接设置 `store.loggedIn = true` | `EntryAbility.ets` 的 `handleCardWant()` | 绕过登录态，安全与产品细节双扣分 |
| 包名仍为 `com.example.myapplication` | `AppScope/app.json5` | 一眼看出是模板工程 |
| 无签名配置 | `build-profile.json5` 的 `signingConfigs: []` | 不能证明可发布 |
| 自动化测试仍是模板用例 | `entry/src/test/LocalUnit.test.ets` | 无法证明逻辑与安全闭环 |
| 元服务声明包含 `wearable`，但缺少系统化穿戴证据 | `module.json5`、`Breakpoints.ets` | 若未实测，应补证据或移除声明 |

### 1.4 平台能力核验结论

本机 SDK：

- `@kit.ScanKit.d.ts`：`scanBarcode.startScanForResult()` 存在，接口标记 `@atomicservice`，可进入主线。
- `@kit.NotificationKit.d.ts`：`requestEnableNotification()`、`publish()` 存在，接口标记 `@atomicservice`，可进入主线。
- `@kit.IntentsKit`：元服务接口存在，但应用必须完成系统意图注册；列为 P1 可行性闸门。
- `distributedDataObject`：本机声明存在，但未发现元服务标记；不以 DDO 作为本轮核心承诺。
- Live View、部分 Core Vision 能力存在声明，但本轮不承诺未完成元服务兼容验证的接入。

---

## 2. 高阶能力组合

### 2.1 主线 A：家庭资源数字孪生

**定位：** 把当前库存从“静态列表”升级为可预测、可推演、可比较的家庭资源时间模型。

**能力**

- 7/14/30 天库存轨迹；
- 预测最早耗尽、最早过期、最可能浪费的物品；
- “来客 +2”“减少做饭 2 次”“出差 3 天”等 What-if 情景；
- 基线方案与优化方案的差异比较；
- 所有结果由确定性模拟器计算，AI 只解释结果与生成建议。

**为什么能加分**

- 产品创新：从“记录工具”升级为“家庭资源决策系统”。
- AI 应用创新：把预测结果作为 GraphRAG 的结构化证据。
- 技术创新：离散时间模拟 + 图谱 + Agent 编排。
- 演示效果强：拖动情景参数，库存风险曲线立即变化。

### 2.2 主线 B：Agentic 决策链

**定位：** 一次需求驱动多步工具，但所有动作仍由代码和用户共同控制。

**固定流水线**

```text
意图识别 → 图谱检索 → 数字孪生推演 → 计划生成
        → 权限/预算/数量策略校验 → 动作预览
        → 用户确认 → 幂等执行 → 后置条件校验
        → 成功留痕 / 失败补偿回滚
```

**首批工具**

- `adjust_inventory`：调整库存；
- `add_shopping`：加入采购；
- `create_meal_plan`：创建餐食方案；
- `resolve_alert`：处理预警。

**关键卖点**

- 展示“AI 不是只会聊天，而是能编排业务动作”；
- 展示“模型不能越权写库”；
- 展示“动作可撤销、失败可补偿、结果可核验”。

### 2.3 主线 C：可解释证据账本

**定位：** 每个重要回答都能回答“依据是什么、数字是否被篡改、模型是否引用了真实路径”。

**能力**

- 保存 `traceId`、图谱版本、证据路径、知识来源、模型、耗时和动作结果；
- UI 提供“为什么这样回答”展开层；
- 对模型正文中的数字做数字声明校验；
- 无依据数字触发警告或降级成本地事实回答；
- 原始思考过程永不进入用户气泡。

### 2.4 主线 D：原生扫码多模态入库

**定位：** 用鸿蒙原生 Scan Kit 提供精确条码输入，再由视觉模型补充名称、数量和位置。

**融合优先级**

```text
用户确认值 > 原生扫码值 > 本地知识库 > 视觉模型识别
```

**演示效果**

- 扫商品条码得到识别码；
- 拍照识别名称、数量、位置；
- 两个来源合并为一张“字段来源卡”；
- 每个字段显示“扫码 / 视觉 / 知识库 / 用户确认”。

### 2.5 主线 E：主动智能触达

**定位：** 从“打开应用才看见”升级为“鸿蒙系统内主动提醒、卡片直达、任务接续”。

**能力**

- 本地通知提醒临期物品；
- 通知点击直达具体预警；
- 服务卡片显示今日最值得处理的资源；
- 登录态与卡片深链安全联动；
- 应用接续后显示“从上台设备继续”的证据条。

### 2.6 主线 F：GuardrailBench AI 评测台

**定位：** 用可复现评测证明 AI 不是现场演示效果，而是有工程门槛。

**评测维度**

- 数值一致率；
- 证据覆盖率；
- 未授权写操作率；
- 思考过程泄漏率；
- 动作幂等率；
- 失败回滚率；
- P50/P95 耗时；
- 离线可用率。

**提交材料呈现**

- 30 条固定场景；
- 自动运行命令；
- 评测 JSON；
- 一张评测结果图；
- 明确区分“规则/离线测试”与“真实模型联调结果”。

### 2.7 P1 前沿闸门

以下能力只有通过题目规定的 90 分钟时间盒 POC 后才进入主线：

| 能力 | 价值 | 准入条件 | 失败处理 |
|---|---|---|---|
| Intents Kit / 小艺建议 | 系统级 AI 入口 | 元服务编译通过、意图注册成功、系统可发现 | 只写后续规划 |
| Live View / 锁屏实时态 | 临期任务常驻 | 元服务运行验证、通知权限和模板可用 | 用普通通知替代 |
| 分布式数据对象 DDO | 真机实时共享 | 两台 NEXT 设备、元服务运行可用、1 秒内同步 | 保留现有中转同步，不宣称 DDO |

---

## 3. 评分导向的创新表达

| 维度 | 作品主张 | 可视化证据 |
|---|---|---|
| AI 应用创新 | 从问答助手升级为“带安全内核的资源决策 Agent” | Agent Trace、动作预览、数字校验 |
| 场景创新 | 家庭资源统筹 + 临期处置 + 来客/出差情景推演 | 数字孪生沙盘前后对比 |
| 产品创新 | 家庭资源健康度与“今日守护”闭环 | AI 首屏、服务卡片、通知 |
| 技术创新 | GraphRAG + 确定性数字孪生 + Saga 式动作补偿 | 架构图、评测报告、源码 |
| 商业模式创新 | 家庭免费 + 多家庭/社区服务订阅 | 落地规划页 |
| 用户体验创新 | AI 结论、证据、动作三层分离 | 证据抽屉、来源标签、撤销 |

---

## 4. 目标架构

```text
┌──────────────── HarmonyOS 元服务 ────────────────┐
│ ArkUI 一多界面                                     │
│  AI 工作台 │ 数字孪生沙盘 │ 证据抽屉 │ 动作队列     │
├───────────────────────────────────────────────────┤
│ Agent Orchestrator                                 │
│  意图路由 → GraphRAG → Twin 推演 → 工具计划        │
│  → Policy Kernel → 预览确认 → Saga 执行 → 校验     │
├───────────────────────────────────────────────────┤
│ 本地确定性内核                                     │
│  Resource Twin │ Graph Query │ Groundedness Guard  │
│  Evidence Ledger │ Action Journal │ Reminder Planner│
├───────────────────────────────────────────────────┤
│ HarmonyOS 原生能力                                 │
│  Scan Kit │ Notification Kit │ Form Kit │ 接续     │
│  Preferences │ Camera Picker │ 一多断点             │
├───────────────────────────────────────────────────┤
│ 云端增强                                           │
│  LLM 网关 │ 视觉识别 │ TTS │ 同步 API │ 用量审计    │
└───────────────────────────────────────────────────┘
```

**设计原则：** 本地内核负责事实、预测、权限、幂等与审计；云端模型负责语言组织、视觉理解和可选摘要。

---

## 5. 文件结构

### 5.1 新增文件

| 文件 | 职责 |
|---|---|
| `backend/replySanitizer.js` | 服务端模型正文清洗 |
| `backend/test/replySanitizer.test.js` | 清洗规则测试 |
| `entry/src/main/ets/common/ReplyText.ets` | 端侧展示兜底清洗 |
| `entry/src/main/ets/common/ResourceTwin.ets` | 库存时间推演与情景模拟 |
| `entry/src/main/ets/common/AgentTypes.ets` | 动作、计划、校验、Trace 类型 |
| `entry/src/main/ets/common/PolicyEngine.ets` | 权限、数量和预算校验 |
| `entry/src/main/ets/common/AgentOrchestrator.ets` | 多步动作编排与补偿 |
| `entry/src/main/ets/common/GroundednessGuard.ets` | 数字声明与证据一致性校验 |
| `entry/src/main/ets/common/EvidenceLedger.ets` | 证据账本持久化 |
| `entry/src/main/ets/common/BarcodeIntake.ets` | 原生扫码与字段合并 |
| `entry/src/main/ets/common/ReminderPlanner.ets` | 提醒候选与去重 |
| `entry/src/main/ets/common/ExpiryReminder.ets` | Notification Kit 适配 |
| `entry/src/main/ets/pages/TwinPanel.ets` | 数字孪生沙盘 |
| `entry/src/main/ets/pages/EvidenceDrawer.ets` | 证据与动作轨迹 UI |
| `entry/src/main/ets/pages/Onboarding.ets` | 首次使用引导 |
| `evals/cases.json` | 30 条固定评测场景 |
| `evals/run.js` | 自动评测入口 |

### 5.2 修改文件

| 文件 | 修改 |
|---|---|
| `backend/server.js` | 接入正文清洗、数字警告、Trace 元数据 |
| `common/AiGateway.ets` | 返回证据元数据、接入校验 |
| `common/Store.ets` | 增加 Twin、Agent、Evidence 状态 |
| `common/LocalStore.ets` | 持久化证据账本、动作日志、引导标记 |
| `pages/AiWorkbench.ets` | 增加数字孪生入口、健康度、动作队列 |
| `pages/AiPanel.ets` | 清洗正文、证据展开、数字警告 |
| `pages/Overlays.ets` | 扫码入库、提醒设置、动作预览 |
| `entryability/EntryAbility.ets` | 卡片深链登录门与接续恢复 |
| `module.json5` | 仅在 POC 通过后追加权限/扩展配置 |
| `AppScope/app.json5` | 正式包名、版本、供应商 |
| `build-profile.json5` | 签名配置，不提交私钥 |
| `README.md` | 当前能力、构建、测试与演示口径 |
| `docs/codelab/*.md` | 与当前代码同步 |
| `docs/competition/*.md` | 7 项提交材料闭环 |

---

## 6. 实施任务

### Task 1: 基线冻结与构建闸门

**Files:**

- Read: `harmonyosapp/NexcoreGraph_harmonyos/README.md`
- Read: `build-profile.json5`
- Verify: `entry/build/default/outputs/default/*.hap`
- Record: `docs/qa/baseline-2026-11-10.md`

**Interfaces:**

- Produces: 基线构建结论、现有缺陷清单、后续任务起点的 Git 提交。

- [ ] **Step 1: 记录工作树和当前提交**

Run:

```powershell
git status --short
git log -1 --oneline
```

Expected: 明确哪些未提交修改属于现有作品，后续不得覆盖。

- [ ] **Step 2: 运行静态提交检查**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
python tools/check_release.py
```

Expected: 当前 11 项检查全部通过；失败项写入基线文档。

- [ ] **Step 3: 构建当前鸿蒙工程**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task assembleHap
```

Expected: `BUILD SUCCESSFUL`，并记录 HAP 路径、大小与是否签名。

- [ ] **Step 4: 记录基线截图**

至少保存：

- 手机启动页；
- 平板 AI 工作台；
- AI 对话含原始思考内容的复现图；
- 服务卡片；
- 应用接续面板。

- [ ] **Step 5: 提交基线记录**

```powershell
git add docs/qa/baseline-2026-11-10.md
git commit -m "docs(harmonyos): record competition baseline"
```

### Task 2: 模型正文清洗，彻底移除思考泄漏

**Files:**

- Create: `backend/replySanitizer.js`
- Create: `backend/test/replySanitizer.test.js`
- Modify: `backend/server.js`
- Modify: `backend/package.json`
- Create: `entry/src/main/ets/common/ReplyText.ets`
- Modify: `entry/src/main/ets/pages/AiPanel.ets`
- Modify: `entry/src/main/ets/common/AiGateway.ets`

**Interfaces:**

- Produces: `sanitizeModelReply(raw: string): string`
- Produces: `visibleReply(raw: string): string`
- Contract: 返回空字符串表示没有可展示正文，调用方不得回显原始文本。

- [ ] **Step 1: 写失败测试**

在 `backend/test/replySanitizer.test.js` 加入：

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeModelReply } = require('../replySanitizer');

test('extracts reply body from reasoning wrapper', () => {
  const raw = '[思考过程：用户问牛奶。回复策略：查库存。][回复内容：冰箱里还有 2 盒牛奶。]';
  assert.equal(sanitizeModelReply(raw), '冰箱里还有 2 盒牛奶。');
});

test('removes xml-style thinking blocks', () => {
  const raw = '<thought>内部推理不展示</thought>\n今晚优先消耗鸡蛋。';
  assert.equal(sanitizeModelReply(raw), '今晚优先消耗鸡蛋。');
});

test('returns empty when no user-facing body exists', () => {
  assert.equal(sanitizeModelReply('[思考过程：只有推理，没有正文]'), '');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos/backend
node --test test/replySanitizer.test.js
```

Expected: FAIL，提示模块或函数不存在。

- [ ] **Step 3: 实现最小清洗器**

`replySanitizer.js` 必须：

- 删除 ` thinking...<｜end▁of▁thinking｜>`；
- 删除 `[思考过程...]`、`【推理过程...】`；
- 识别 `回复内容：`、`最终答案：` 后只保留正文；
- 删除 Markdown 代码围栏；
- 若清洗后为空，返回 `''`；
- 不得偷偷回退到原始全文。

- [ ] **Step 4: 接入服务端**

在 `backend/server.js` 中：

```js
const { sanitizeModelReply } = require('./replySanitizer');

out.text = sanitizeModelReply(out.text);
if (out.text === '') {
  return res.status(502).json({
    ok: false,
    error: '模型未返回有效正文',
    warnings: ['empty_user_facing_reply']
  });
}
```

删除旧的内部 `stripReasoning()`，避免两套规则漂移。

- [ ] **Step 5: 接入端侧兜底**

`ReplyText.ets` 提供：

```typescript
export function visibleReply(raw: string): string {
  let s: string = raw.trim();
  s = s.replace(/<think[\\s\\S]*?<\\/think>/gi, '');
  s = s.replace(/\\[思考过程[\\s\\S]*?\\[/g, '[');
  if (s.indexOf('回复内容：') >= 0) {
    s = s.substring(s.lastIndexOf('回复内容：') + 5).trim();
  }
  return s;
}
```

在 `AiPanel.MsgGroup()` 中将 `Text(m.text)` 改为 `Text(visibleReply(m.text))`。

- [ ] **Step 6: 运行全部验证**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos/backend
npm test
cd ..
.\tools\build.ps1 -Task assembleHap
```

Expected: Node 测试通过，鸿蒙构建成功，截图中不再出现 `思考过程`、`<thought>` 或 `<｜end▁of▁thinking｜>`。

- [ ] **Step 7: 提交**

```powershell
git add backend/replySanitizer.js backend/test/replySanitizer.test.js backend/server.js backend/package.json entry/src/main/ets/common/ReplyText.ets entry/src/main/ets/pages/AiPanel.ets entry/src/main/ets/common/AiGateway.ets
git commit -m "fix(ai): prevent internal reasoning from reaching users"
```

### Task 3: 卡片深链鉴权与首启引导

**Files:**

- Modify: `entry/src/main/ets/entryability/EntryAbility.ets`
- Modify: `entry/src/main/ets/pages/Index.ets`
- Modify: `entry/src/main/ets/pages/LoginView.ets`
- Modify: `entry/src/main/ets/common/Store.ets`
- Create: `entry/src/main/ets/common/NavigationIntent.ets`
- Create: `entry/src/main/ets/pages/Onboarding.ets`
- Modify: `entry/src/test/List.test.ets`
- Create: `entry/src/test/NavigationIntent.test.ets`

**Interfaces:**

- Produces: `parseEntryTarget(value: Object | undefined): string`
- Produces: `applyEntryTarget(target: string): boolean`
- Contract: 只有 `loggedIn === true` 时才允许执行业务深链。

- [ ] **Step 1: 写失败测试**

```typescript
import { parseEntryTarget } from '../main/ets/common/NavigationIntent';

it('accepts known targets only', 0, () => {
  expect(parseEntryTarget('alerts')).assertEqual('alerts');
  expect(parseEntryTarget('unknown')).assertEqual('');
  expect(parseEntryTarget(undefined)).assertEqual('');
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
```

Expected: FAIL，模块不存在。

- [ ] **Step 3: 删除登录绕过**

`EntryAbility.handleCardWant()` 不再执行 `store.loggedIn = true`。

改为：

```typescript
const target: string = parseEntryTarget(params['target']);
if (target !== '') {
  store.pendingEntryTarget = target;
}
```

- [ ] **Step 4: 登录后恢复目标**

在 `Index.aboutToAppear()`、`LoginView` 登录成功回调中调用 `applyEntryTarget()`。

若未登录：

- 展示登录页；
- 在顶部提示“登录后继续打开临期提醒”；
- 登录成功后消费 `pendingEntryTarget`。

- [ ] **Step 5: 加入一次性首启引导**

`Onboarding.ets` 提供三步：

1. 扫码或拍照建库；
2. 确认识别结果；
3. 让 AI 用临期优先原则生成今日处置。

Preferences 键：`nexcore_onboarding_v1_done`。

- [ ] **Step 6: 运行测试**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
```

Expected: 新测试通过；未登录点击任一卡片入口先出现登录页。

- [ ] **Step 7: 提交**

```powershell
git add entry/src/main/ets/entryability/EntryAbility.ets entry/src/main/ets/pages/Index.ets entry/src/main/ets/pages/LoginView.ets entry/src/main/ets/common/Store.ets entry/src/main/ets/common/NavigationIntent.ets entry/src/main/ets/pages/Onboarding.ets entry/src/test/List.test.ets entry/src/test/NavigationIntent.test.ets
git commit -m "fix(harmonyos): gate card deep links and add onboarding"
```

### Task 4: 数字孪生推演内核

**Files:**

- Create: `entry/src/main/ets/common/ResourceTwin.ets`
- Modify: `entry/src/main/ets/common/Store.ets`
- Create: `entry/src/test/ResourceTwin.test.ets`
- Modify: `entry/src/test/List.test.ets`

**Interfaces:**

```typescript
export class TwinItemInput {
  id: string = '';
  name: string = '';
  qty: number = 0;
  expDays: number = 0;
  dailyUse: number = 0;
}

export class TwinScenario {
  horizonDays: number = 7;
  extraPeople: number = 0;
  mealsPerDay: number = 3;
  savedMeals: number = 0;
}

export class TwinRisk {
  itemId: string = '';
  type: string = '';
  day: number = 0;
  message: string = '';
}

export class TwinResult {
  score: number = 0;
  risks: TwinRisk[] = [];
  shortageCount: number = 0;
  wasteRiskCount: number = 0;
  actionHints: string[] = [];
}

export function simulateTwin(items: TwinItemInput[], scenario: TwinScenario): TwinResult;
```

**Determinism:** 不使用当前时间以外的随机数；测试注入固定日期与固定消耗量。

- [ ] **Step 1: 写失败测试**

```typescript
it('finds the first out-of-stock day', 0, () => {
  const item = new TwinItemInput();
  item.id = 'milk';
  item.name = '牛奶';
  item.qty = 2;
  item.expDays = 5;
  item.dailyUse = 1;
  const s = new TwinScenario();
  s.horizonDays = 7;
  const r = simulateTwin([item], s);
  expect(r.risks.some((x: TwinRisk): boolean => x.itemId === 'milk' && x.type === 'shortage')).assertTrue();
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
```

Expected: FAIL，`simulateTwin` 不存在。

- [ ] **Step 3: 实现离散时间模拟**

每个模拟日执行：

```text
qty = max(0, qty - dailyUse × familyFactor × mealFactor)
if qty == 0: 记录 shortage
if expDays - day <= 0 and qty > 0: 记录 waste
```

`familyFactor = (basePeople + extraPeople) / basePeople`。

`mealFactor = max(0, (mealsPerDay - savedMeals) / mealsPerDay)`。

- [ ] **Step 4: 计算可解释资源健康度**

固定权重：

- 新鲜度 40；
- 库存充足度 25；
- 数据完整度 20；
- 处置及时度 15。

最终分数必须 `clamp(0, 100)`，并在 UI 展示每个分项得分。

- [ ] **Step 5: 生成行动提示**

只生成代码模板句：

- “第 2 天牛奶预计耗尽，建议今天用掉 1 盒或补货 3 盒”；
- “3 天内 2 项临期，优先安排 2 餐”；
- “数据完整度不足，缺少位置信息 4 项”。

- [ ] **Step 6: 运行测试**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
```

Expected: 至少覆盖“耗尽、浪费、来客增加、数据不完整、分数边界”五类断言。

- [ ] **Step 7: 提交**

```powershell
git add entry/src/main/ets/common/ResourceTwin.ets entry/src/main/ets/common/Store.ets entry/src/test/ResourceTwin.test.ets entry/src/test/List.test.ets
git commit -m "feat(harmonyos): add deterministic resource twin engine"
```

### Task 5: Agentic 动作编排与安全内核

**Files:**

- Create: `entry/src/main/ets/common/AgentTypes.ets`
- Create: `entry/src/main/ets/common/PolicyEngine.ets`
- Create: `entry/src/main/ets/common/AgentOrchestrator.ets`
- Create: `entry/src/test/PolicyEngine.test.ets`
- Create: `entry/src/test/AgentOrchestrator.test.ets`
- Modify: `entry/src/main/ets/common/AiGateway.ets`
- Modify: `entry/src/main/ets/common/Api.ets`
- Modify: `entry/src/main/ets/pages/AiPanel.ets`
- Modify: `entry/src/test/List.test.ets`

**Interfaces:**

```typescript
export class AgentAction {
  id: string = '';
  kind: string = '';
  target: string = '';
  qty: number = 0;
  payload: string = '';
  risk: string = 'low';
  status: string = 'proposed';
}

export class PolicyDecision {
  allowed: boolean = false;
  reason: string = '';
  requiresConfirmation: boolean = true;
}

export function checkPolicy(action: AgentAction, role: string): PolicyDecision;
```

**Rule:** 模型只能提出 `AgentAction`，不得直接修改库存。

- [ ] **Step 1: 写权限失败测试**

```typescript
it('blocks write actions for readonly users', 0, () => {
  const a = new AgentAction();
  a.kind = 'adjust_inventory';
  const d = checkPolicy(a, '只读');
  expect(d.allowed).assertFalse();
  expect(d.reason.indexOf('只读') >= 0).assertTrue();
});
```

- [ ] **Step 2: 写幂等测试**

```typescript
it('executes the same action id once', 0, async () => {
  const result = await executePlanOnce('trace-a', [action('a1')]);
  const duplicate = await executePlanOnce('trace-a', [action('a1')]);
  expect(result.executed).assertEqual(1);
  expect(duplicate.skipped).assertEqual(1);
});
```

- [ ] **Step 3: 实现 Policy Engine**

必须拦截：

- 只读角色写操作；
- 负数或超出上限的数量；
- 未提供证据的物品名；
- 未确认的高风险动作；
- 重复 action id；
- 模型越权新增工具名。

- [ ] **Step 4: 实现动作流水线**

写入顺序固定为：

```text
query → plan → policy → confirm → execute → verify
```

每步保存 `status`、`startedAt`、`endedAt`、`message`。

- [ ] **Step 5: 实现失败补偿**

若同批动作第 N 步失败，逆序撤销已执行动作；撤销失败必须保留“需要人工处理”记录，不得静默吞错。

- [ ] **Step 6: 接入 AI 工具行**

将现有：

- `[调整]`
- `[购物]`
- `[菜]`

统一转换为 `AgentAction`；保留旧解析器一版兼容。

- [ ] **Step 7: 运行测试和构建**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
.\tools\build.ps1 -Task assembleHap
```

Expected: 未确认写操作数 = 0；重复执行数 = 0；鸿蒙构建成功。

- [ ] **Step 8: 提交**

```powershell
git add entry/src/main/ets/common/AgentTypes.ets entry/src/main/ets/common/PolicyEngine.ets entry/src/main/ets/common/AgentOrchestrator.ets entry/src/main/ets/common/AiGateway.ets entry/src/main/ets/common/Api.ets entry/src/main/ets/pages/AiPanel.ets entry/src/test/PolicyEngine.test.ets entry/src/test/AgentOrchestrator.test.ets entry/src/test/List.test.ets
git commit -m "feat(ai): add policy-gated agent actions with compensation"
```

### Task 6: 证据账本与数字声明校验

**Files:**

- Create: `entry/src/main/ets/common/GroundednessGuard.ets`
- Create: `entry/src/main/ets/common/EvidenceLedger.ets`
- Create: `entry/src/main/ets/pages/EvidenceDrawer.ets`
- Create: `entry/src/test/GroundednessGuard.test.ets`
- Modify: `entry/src/main/ets/common/AiGateway.ets`
- Modify: `entry/src/main/ets/common/LocalStore.ets`
- Modify: `entry/src/main/ets/pages/AiPanel.ets`
- Modify: `entry/src/test/List.test.ets`
- Modify: `backend/server.js`

**Interfaces:**

```typescript
export class NumericClaimIssue {
  token: string = '';
  context: string = '';
}

export function findUngroundedNumbers(reply: string, evidence: string[]): NumericClaimIssue[];
```

**Contract:** 数字声明校验结果是警告，不伪装成概率置信度。

- [ ] **Step 1: 写失败测试**

```typescript
it('finds a number absent from evidence', 0, () => {
  const issues = findUngroundedNumbers('冰箱还有 9 盒牛奶。', ['牛奶 2 盒']);
  expect(issues.length).assertEqual(1);
  expect(issues[0].token).assertEqual('9');
});

it('accepts a number present in evidence', 0, () => {
  const issues = findUngroundedNumbers('冰箱还有 2 盒牛奶。', ['牛奶 2 盒']);
  expect(issues.length).assertEqual(0);
});
```

- [ ] **Step 2: 运行测试并确认失败**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
```

Expected: FAIL。

- [ ] **Step 3: 实现数字提取与比对**

提取包含数量含义的数字和单位；忽略：

- 日期格式中的年；
- 版本号；
- 明确标记为估算的区间；
- 用户原问题里的数字。

- [ ] **Step 4: 持久化证据账本**

每条记录至少包含：

```text
traceId, at, questionHash, graphVersion, evidenceIds,
sources, model, latencyMs, ungroundedNumbers, actionIds
```

聊天正文与证据账本分离；隐私开关关闭时，不落盘问题正文。

- [ ] **Step 5: 增加证据抽屉**

气泡下方展示：

- “为什么这样回答”；
- 图谱路径计数；
- 知识来源；
- “数字已核对”或“发现未引用数字”；
- Agent Trace；
- 模型与耗时。

- [ ] **Step 6: 运行测试和构建**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
.\tools\build.ps1 -Task assembleHap
```

Expected: 数字校验测试通过；截图中可展开证据，但不会展示原始推理。

- [ ] **Step 7: 提交**

```powershell
git add entry/src/main/ets/common/GroundednessGuard.ets entry/src/main/ets/common/EvidenceLedger.ets entry/src/main/ets/pages/EvidenceDrawer.ets entry/src/test/GroundednessGuard.test.ets entry/src/main/ets/common/AiGateway.ets entry/src/main/ets/common/LocalStore.ets entry/src/main/ets/pages/AiPanel.ets entry/src/test/List.test.ets backend/server.js
git commit -m "feat(ai): add evidence ledger and numeric grounding checks"
```

### Task 7: 数字孪生沙盘界面

**Files:**

- Create: `entry/src/main/ets/pages/TwinPanel.ets`
- Modify: `entry/src/main/ets/pages/AiWorkbench.ets`
- Modify: `entry/src/main/ets/pages/Overlays.ets`
- Modify: `entry/src/main/ets/common/Store.ets`
- Modify: `entry/src/main/ets/common/Icons.ets`

**UI:**

- 顶部：资源健康度 0–100；
- 分项：新鲜度、充足度、完整度、处置及时度；
- 情景按钮：正常 / 来客 +2 / 三天少做 2 餐 / 预算收紧；
- 中部：Canvas 库存轨迹；
- 右侧或下方：风险列表；
- 底部：“生成处置方案”进入 Agent 预览。

- [ ] **Step 1: 建立空态、加载态、错误态**

无库存、数据不足、模拟失败都必须有中文解释和下一步动作。

- [ ] **Step 2: 接入 `simulateTwin()`**

UI 只读取 `TwinResult`，不得在页面重复实现公式。

- [ ] **Step 3: 增加情景切换动画**

动画只用于表达状态变化，不伪造计算耗时。

- [ ] **Step 4: 增加一多布局**

- 手机：单列；
- 平板/2in1：左沙盘、右风险与动作；
- 穿戴或窄屏：只保留健康度、Top 1 风险和“查看详情”。

- [ ] **Step 5: 真机验证**

保存手机、平板、2in1 三张截图；每张截图显示同一组真实数据。

- [ ] **Step 6: 构建**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task assembleHap
```

Expected: 构建成功；模拟结果与测试用例一致。

- [ ] **Step 7: 提交**

```powershell
git add entry/src/main/ets/pages/TwinPanel.ets entry/src/main/ets/pages/AiWorkbench.ets entry/src/main/ets/pages/Overlays.ets entry/src/main/ets/common/Store.ets entry/src/main/ets/common/Icons.ets
git commit -m "feat(harmonyos): add resource twin what-if sandbox"
```

### Task 8: 原生扫码多模态入库

**Files:**

- Create: `entry/src/main/ets/common/BarcodeIntake.ets`
- Modify: `entry/src/main/ets/pages/Overlays.ets`
- Modify: `entry/src/main/ets/common/Db.ets`
- Modify: `entry/src/main/ets/common/Api.ets`
- Modify: `entry/src/main/ets/common/AiGateway.ets`
- Modify: `entry/src/main/resources/rawfile/knowledge/*.json`

**Interfaces:**

```typescript
export class ScanEvidence {
  code: string = '';
  format: string = '';
  at: number = 0;
}

export function mergeIntakeSources(
  vision: IntakeResult[],
  scan: ScanEvidence,
  confirmedName: string
): IntakeResult[];
```

**Native dependency:** `@kit.ScanKit` 的 `scanBarcode.startScanForResult()`。

- [ ] **Step 1: 在设置页增加“扫码入口”**

调用：

```typescript
import { scanBarcode, scanCore } from '@kit.ScanKit';

const result: scanBarcode.ScanResult = await scanBarcode.startScanForResult(
  ctx,
  { scanTypes: [scanCore.ScanType.ALL] }
);
```

接口不可用或用户取消时必须返回可读错误，不崩溃。

- [ ] **Step 2: 增加字段来源**

每个 `IntakeResult` 记录：

- `sourceName = '扫码' | '视觉' | '知识库' | '用户'`；
- 条码原文；
- 用户是否已确认。

- [ ] **Step 3: 合并规则**

- 条码只提供精确识别码，不根据条码猜商品名；
- 视觉提供名称、数量、位置；
- 知识库提供保质期规则；
- 用户编辑优先；
- 冲突字段在 UI 中明确标黄，要求确认。

- [ ] **Step 4: 测试**

至少覆盖：

- 条码有效、视觉结果为空；
- 条码有效、视觉名称冲突；
- 用户修改后以用户为准；
- 用户取消扫码；
- 未知条码不崩溃。

- [ ] **Step 5: 构建**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task assembleHap
```

Expected: 元服务编译通过；真机可调起扫码。

- [ ] **Step 6: 提交**

```powershell
git add entry/src/main/ets/common/BarcodeIntake.ets entry/src/main/ets/pages/Overlays.ets entry/src/main/ets/common/Db.ets entry/src/main/ets/common/Api.ets entry/src/main/ets/common/AiGateway.ets entry/src/main/resources/rawfile/knowledge
git commit -m "feat(harmonyos): add native barcode-assisted multimodal intake"
```

### Task 9: 主动提醒与服务卡片深链

**Files:**

- Create: `entry/src/main/ets/common/ReminderPlanner.ets`
- Create: `entry/src/main/ets/common/ExpiryReminder.ets`
- Create: `entry/src/test/ReminderPlanner.test.ets`
- Modify: `entry/src/test/List.test.ets`
- Modify: `entry/src/main/ets/pages/Overlays.ets`
- Modify: `entry/src/main/ets/entryability/EntryAbility.ets`
- Modify: `entry/src/main/ets/pages/card/ExpiryCard.ets`

**Native dependency:** `@kit.NotificationKit` 的 `requestEnableNotification()`、`publish()`、`cancel()`。

**Permissions:** 通知必须由用户显式开启，默认不主动打扰。

- [ ] **Step 1: 写提醒计划测试**

```typescript
it('creates one reminder per item per day', 0, () => {
  const a = planReminders([item('milk', 2)], 20261110);
  const b = planReminders([item('milk', 2)], 20261110);
  expect(a.length).assertEqual(1);
  expect(b.length).assertEqual(1);
  expect(a[0].dedupeKey).assertEqual(b[0].dedupeKey);
});
```

- [ ] **Step 2: 实现提醒候选器**

只提醒：

- 3 天内临期；
- 已开启提醒；
- 当天未提醒过；
- 非私有物品，或私有物品仅在本地提醒。

- [ ] **Step 3: 接入 Notification Kit**

用户开启时调用一次 `requestEnableNotification(ctx)`；被拒绝后显示设置说明，不反复弹窗。

- [ ] **Step 4: 通知点击直达**

通知参数包含：

```text
target=alerts
alertId=<id>
source=notification
```

应用未登录时先登录，登录后继续打开对应预警。

- [ ] **Step 5: 服务卡片显示“今日守护”**

卡片新增：

- 健康度；
- Top 1 临期；
- Top 1 将耗尽；
- 点击进入数字孪生或预警。

- [ ] **Step 6: 真机验证**

保存通知授权、通知出现、点击直达、卡片刷新四张证据图。

- [ ] **Step 7: 构建**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
.\tools\build.ps1 -Task assembleHap
```

Expected: 测试和构建通过；未授权时不发通知。

- [ ] **Step 8: 提交**

```powershell
git add entry/src/main/ets/common/ReminderPlanner.ets entry/src/main/ets/common/ExpiryReminder.ets entry/src/test/ReminderPlanner.test.ets entry/src/test/List.test.ets entry/src/main/ets/pages/Overlays.ets entry/src/main/ets/entryability/EntryAbility.ets entry/src/main/ets/pages/card/ExpiryCard.ets
git commit -m "feat(harmonyos): add opt-in expiry reminders and card deep links"
```

### Task 10: GuardrailBench 评测台

**Files:**

- Create: `evals/cases.json`
- Create: `evals/run.js`
- Create: `evals/README.md`
- Modify: `backend/package.json`
- Create: `backend/test/grounding.test.js`

**Interfaces:**

- Produces: `node evals/run.js --out evals/result.json`
- Exit code `0` 表示全部硬门槛通过。

- [ ] **Step 1: 建立 30 条固定场景**

分布：

- 8 条库存/语法查询；
- 6 条 GraphRAG 多跳；
- 6 条动作安全；
- 5 条数字声明校验；
- 5 条失败/降级。

每条包含 `input`、`fixtures`、`expected`、`hardFail`.

- [ ] **Step 2: 编写 runner**

硬门槛：

```text
未授权写操作 = 0
思考过程泄漏 = 0
重复动作执行 = 0
无证据数字 = 0（对 hardFail 场景）
```

- [ ] **Step 3: 运行评测**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
node evals/run.js --out evals/result.json
```

Expected: 所有硬门槛通过；生成可提交 JSON。

- [ ] **Step 4: 输出可视化摘要**

生成：

- 总用例数；
- 各维度通过率；
- P50/P95；
- 失败列表。

- [ ] **Step 5: 接入提交检查**

在 `tools/check_release.py` 增加：

- 评测结果文件存在；
- 硬门槛字段全部为 0；
- 结果文件时间晚于当前代码；
- 报告不包含密钥。

- [ ] **Step 6: 提交**

```powershell
git add evals backend/package.json backend/test/grounding.test.js tools/check_release.py
git commit -m "test(ai): add guardrail benchmark for competition evidence"
```

### Task 11: 原生能力 P1 时间盒验证

**Timebox:** 90 分钟，最多两人并行，不进入关键路径。

**Files:**

- Read: `D:\CodeEditor\DevEcoStudio\DevEco Studio\sdk\default\hms\ets\api\@hms.ai.insightIntent.d.ts`
- Read: `D:\CodeEditor\DevEcoStudio\DevEco Studio\sdk\default\hms\ets\api\@hms.core.liveview.liveViewManager.d.ts`
- Read: `D:\CodeEditor\DevEcoStudio\DevEco Studio\sdk\default\openharmony\ets\api\@ohos.data.distributedDataObject.d.ts`
- Modify only if POC passes: `module.json5`
- Record: `docs/qa/native-poc-results.md`

- [ ] **Step 1: Intents Kit POC**

目标：声明一个“查看今日资源提醒”的意图，编译并确认系统发现入口。

通过标准：真机系统入口可拉起应用目标页。

失败：不合并代码，只在落地规划中写“已预留 Agent 接口”。

- [ ] **Step 2: Live View POC**

先确认元服务、权限、模板和设备是否同时可用。

通过标准：临期任务在锁屏/实况区域出现并更新。

失败：保留普通通知。

- [ ] **Step 3: DDO POC**

确认元服务运行支持、同账号组网和两台设备。由于本机声明未标记元服务，只有真实双向同步通过才允许进入作品说明。

通过标准：设备 A 修改，设备 B 1 秒内更新；离页释放监听。

失败：保留 `FlowBridge`，不把中转同步写成 DDO。

- [ ] **Step 4: 记录证据并决策**

写入 `docs/qa/native-poc-results.md`，明确：

- 验证设备；
- SDK 版本；
- 成功/失败；
- 是否进入提交材料；
- 截图或日志路径。

### Task 12: 应用细节与无障碍收口

**Files:**

- Modify: `entry/src/main/ets/pages/LoginView.ets`
- Modify: `entry/src/main/ets/pages/AiWorkbench.ets`
- Modify: `entry/src/main/ets/pages/AiPanel.ets`
- Modify: `entry/src/main/ets/pages/Overlays.ets`
- Modify: `entry/src/main/ets/pages/LibrariesView.ets`
- Modify: `entry/src/main/ets/components/Widgets.ets`
- Modify: `AppScope/app.json5`
- Modify: `entry/src/main/module.json5`

- [ ] **Step 1: 修正空态、错误态、加载态**

所有异步页面必须有中文状态：

- 初始；
- 加载；
- 空数据；
- 成功后无结果；
- 网络失败；
- 权限失败；
- 模型返回格式错误。

- [ ] **Step 2: 权限拒绝恢复**

相机、麦克风、通知被拒绝后：

- 记录状态；
- 显示“去设置”说明；
- 提供“先手动录入”的替代路径；
- 不循环弹授权框。

- [ ] **Step 3: 无障碍**

为非文本图标按钮补充 `accessibilityText`；确保主要流程无纯色状态唯一表达。

- [ ] **Step 4: 字号与布局**

检查 130% 和 200% 字号：

- 不横向溢出；
- 关键按钮不裁切；
- AI 气泡可换行；
- 数字卡允许纵向增长。

- [ ] **Step 5: 品牌与发布元数据**

将：

- `bundleName` 从 `com.example.myapplication` 改为正式包名；
- `vendor` 改为团队/作品主体；
- `versionName` 升至 `1.1.0`；
- 增加应用描述与更新日志。

- [ ] **Step 6: 设备声明核对**

若 2026-11-15 前仍无 `wearable` 运行截图，则从 `module.json5` 移除 `wearable`，并在文档中不宣称手表适配。

- [ ] **Step 7: 验证**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
python tools/check_release.py
.\tools\build.ps1 -Task assembleHap
```

Expected: 静态检查与构建通过；多设备截图无裁切和横向溢出。

### Task 13: 作品材料与演示视频

**Files:**

- Modify: `docs/competition/启核图策-鸿蒙端专项整改与验收文档.md`
- Modify: `README.md`
- Modify: `docs/codelab/README.md`
- Modify: `docs/codelab/00-environment.md` 至 `08-build-submit.md`
- Create: `docs/submission/技术架构说明.md`
- Create: `docs/submission/AI与鸿蒙能力清单.md`
- Create: `docs/submission/测试与评测报告.md`
- Create: `docs/submission/落地规划.md`
- Create: `docs/submission/提交检查表.md`

**七项材料映射**

| 要求 | 交付内容 | 验收证据 |
|---|---|---|
| 项目说明 | 目标用户、三大场景、核心闭环 | 3–5 分钟演示视频 |
| 鸿蒙与 AI 能力 | 模块、API、调用路径、降级 | 代码路径 + 真机截图 |
| 创新点 | 六维创新矩阵 | 示例前后对比 |
| 技术实现 | 架构图、ArkTS/ArkUI、难点方案 | 架构 SVG + 源码 |
| 成果展示 | 手机/平板/2in1、卡片、通知、接续 | 截图 + 日志 |
| 历史说明 | 无往届成果则填“无” | 不得把 66 分截屏当往届成果 |
| 落地规划 | 上架、增长、商业闭环、迭代 | 可执行时间表 |

- [ ] **Step 1: 写能力清单**

表格列为：

```text
能力 | API/模块 | 调用位置 | 用户可见效果 | 失败降级 | 验证方式
```

至少覆盖：

- ArkUI 一多；
- 元服务；
- Form Kit；
- 应用接续；
- Scan Kit；
- Notification Kit；
- GraphRAG；
- LLM；
- 视觉识别；
- Agent 动作；
- 数字孪生；
- 证据账本。

- [ ] **Step 2: 更新 Codelabs**

每一步包含：

- 目标；
- 前置；
- 改动文件；
- 核心代码；
- 验证方式；
- 常见问题。

删除与当前代码不一致的类名、端点或构建命令。

- [ ] **Step 3: 录制 4 分钟演示**

建议脚本：

1. 0:00–0:25：家庭资源浪费与遗忘痛点；
2. 0:25–1:00：扫码 + 拍照 + 多模态字段合并；
3. 1:00–1:40：AI 用 GraphRAG 回答，展开证据抽屉；
4. 1:40–2:20：数字孪生切换“来客 +2”，风险曲线变化；
5. 2:20–2:55：Agent 预览多步动作、确认、执行、撤销；
6. 2:55–3:25：通知、服务卡片、手机到平板接续；
7. 3:25–3:45：GuardrailBench 结果页；
8. 3:45–4:00：落地价值与商业闭环。

- [ ] **Step 4: 截图证据包**

至少包括：

- AI 正文无思考泄漏；
- 证据抽屉；
- 数字声明校验；
- 数字孪生双情景对比；
- Agent Trace；
- 扫码字段来源；
- 通知；
- 服务卡片；
- 应用接续；
- 评测结果。

- [ ] **Step 5: 写落地规划**

包括：

- AppGallery 上架或体验版；
- 家庭免费版；
- 家庭 Pro 订阅；
- 社区/物业/养老机构的 B2B2C 试点；
- 服务卡片日活、周报分享、家庭邀请的运营闭环；
- 上线后 30/90/180 天迭代。

### Task 14: 签名、发布与提交包

**Files:**

- Modify: `build-profile.json5`
- Create: `docs/submission/签名与发布说明.md`
- Create: `docs/submission/体验账号.md`
- Create: `docs/submission/环境配置说明.md`
- Verify: 最终 HAP
- Verify: 最终 ZIP

- [ ] **Step 1: 配置正式包名**

包名变更必须在 AGC 与签名前一次性完成。

- [ ] **Step 2: 配置签名**

私钥、证书、密码不得进入仓库和 ZIP；只提交签名说明和证书指纹。

- [ ] **Step 3: 构建 Release**

Run:

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Release
python tools/check_release.py
node evals/run.js --out evals/result.json
```

Expected:

- `BUILD SUCCESSFUL`；
- 存在 signed HAP；
- `check_release.py` 全部 PASS；
- Benchmark 硬门槛为 0 违规。

- [ ] **Step 4: 检查包体**

必须排除：

- `.git`
- `node_modules`
- `oh_modules`
- `build` 中间产物
- `tts-cache`
- `.env`
- 私钥与证书密码
- 原始 QA 浏览器 profile

- [ ] **Step 5: 生成 ZIP**

目标文件名：

```text
第九届传智杯-AI鸿蒙赛道-启核图策.zip
```

检查：

```powershell
Get-Item '第九届传智杯-AI鸿蒙赛道-启核图策.zip' |
  Select-Object Name, Length
```

Expected: 小于 `300MB`。

- [ ] **Step 6: 体验账号与配置**

必须包含：

- 体验账号或获取验证码方式；
- 后端启动方式；
- 必需环境变量名称，不含真实密钥；
- 模拟器/真机网络配置；
- 无后端时的降级说明；
- 隐私与 AI 生成内容说明。

- [ ] **Step 7: AppGallery 体验发布**

尝试提交体验版；无论成功与否，保留：

- 提审截图；
- 版本号；
- 构建时间；
- 审核状态；
- 失败原因及修正记录。

---

## 7. 8 天排期

| 日期 | 主线 | 当日必须产出 |
|---|---|---|
| 11-10 | 基线、清洗、鉴权 | 基线报告、无思考泄漏、卡片登录门 |
| 11-11 | 数字孪生内核与 UI | 公式测试、手机/平板截图 |
| 11-12 | Agent 决策链 | 权限测试、动作 Trace、撤销 |
| 11-13 | 证据账本、扫码 | 数字校验、扫码真机证据 |
| 11-14 | 通知、卡片、P1 POC | 触达证据、原生能力取舍记录 |
| 11-15 | GuardrailBench、文档、录屏 | 评测 JSON、材料初稿、视频粗剪 |
| 11-16 | Release、签名、冻结 | signed HAP、测试报告、最终源码 |
| 11-17 | ZIP、体验发布、模拟提交 | 300MB 内提交包、上架凭证 |
| 11-18 | 截止日缓冲 | 仅修复阻断问题，不新增功能 |

### 每日固定闸门

每天结束前必须运行：

```powershell
cd harmonyosapp/NexcoreGraph_harmonyos
.\tools\build.ps1 -Task test
.\tools\build.ps1 -Task assembleHap
python tools/check_release.py
node evals/run.js --out evals/result.json
```

任一闸门失败，次日先修复，不扩新功能。

---

## 8. 验收矩阵

### 8.1 核心功能

| ID | 场景 | 通过标准 |
|---|---|---|
| H1 | 扫码后拍照入库 | 条码、名称、数量、位置均有来源标记 |
| H2 | 用户修改识别结果 | 用户值优先，冲突字段可追溯 |
| H3 | AI 普通问答 | 气泡无思考过程、无 XML 标签 |
| H4 | GraphRAG 回答 | 可展开图谱路径与来源 |
| H5 | 无证据数字 | 标出未引用数字，不静默通过 |
| H6 | 数字孪生“正常” | 健康度、风险、轨迹可复现 |
| H7 | 数字孪生“来客 +2” | 风险变化与公式一致 |
| H8 | Agent 未确认 | 库存不变 |
| H9 | Agent 确认执行 | 动作按序执行并留痕 |
| H10 | Agent 中途失败 | 已执行动作补偿回滚 |
| H11 | 重复点击确认 | 同一 action id 只执行一次 |
| H12 | 卡片未登录点击 | 先登录，后到目标页 |
| H13 | 通知已授权 | 到点出现，点击直达预警 |
| H14 | 通知被拒绝 | 不反复弹窗，提供替代入口 |
| H15 | 手机布局 | 无横向溢出，关键按钮可达 |
| H16 | 平板布局 | AI 面板与主内容不互相挤压 |
| H17 | 2in1 布局 | 导航、卡片、沙盘布局正确 |
| H18 | 应用接续 | 页面、库、未确认动作恢复 |
| H19 | 断网 | GraphRAG 快答与孪生仍可用 |
| H20 | 模型输出格式错误 | 显示可读错误与重试，不展示原文 |

### 8.2 安全与隐私

| ID | 通过标准 |
|---|---|
| S1 | 端侧和 ZIP 中无 `sk-` 密钥 |
| S2 | 卡片、通知、外链均不能绕过登录态 |
| S3 | 只读账号不能执行 Agent 写动作 |
| S4 | 私有物品不进入普通通知和共享摘要 |
| S5 | 证据账本不保存原始模型推理 |
| S6 | 用户可关闭对话同步、偏好注入和主动提醒 |

### 8.3 工程与性能

| ID | 目标 |
|---|---|
| P1 | 冷启动 ≤ 2.5 秒 |
| P2 | 500 物品数字孪生推演 ≤ 100ms |
| P3 | 图谱重建 ≤ 300ms |
| P4 | 首页滚动无明显掉帧 |
| P5 | 元服务安装包 < 10MB |
| P6 | GuardrailBench 硬门槛违规数 = 0 |

---

## 9. 风险与降级

| 风险 | 概率 | 影响 | 降级方案 |
|---|---|---|---|
| 高阶功能范围过大 | 高 | 主线延期 | 先完成清洗、孪生、Agent、证据，再考虑 P1 |
| Scan Kit 真机不可用 | 中 | 多模态演示不完整 | 保留拍照+相册，扫码入口隐藏 |
| 通知授权被拒 | 中 | 主动触达无法演示 | 服务卡片与应用内待办兜底 |
| 模型上游限流 | 高 | AI 演示失败 | 预热、重试、备用模型、离线事实回答 |
| 两台 NEXT 设备不足 | 高 | 分布式证据缺失 | 不宣称 DDO，使用接续和中转录屏 |
| 签名证书/AGC 配置阻塞 | 中 | 无 signed HAP | 11-15 提前验证，材料记录 unsigned 原因 |
| 演示数据被误解为真实 | 中 | 可信度扣分 | 所有演示数据标明“演示环境”，数值来自实际计算 |
| 功能堆叠导致界面杂乱 | 高 | 美观优势丢失 | 所有高级能力收口到“AI 工作台 + 证据抽屉 + 沙盘”，不新增大量一级入口 |

---

## 10. 交付门槛

只有同时满足以下条件，才允许制作最终 ZIP：

- [ ] 所有 P0 任务完成；
- [ ] 手机、平板、2in1 至少各有一张最新截图；
- [ ] 无思考过程泄漏；
- [ ] 卡片和通知深链均经过登录门；
- [ ] 数字孪生测试通过；
- [ ] Agent 安全、幂等、补偿测试通过；
- [ ] GuardrailBench 硬门槛违规数为 0；
- [ ] Release 构建成功；
- [ ] 签名包或完整阻塞说明留存；
- [ ] 七项文档齐全；
- [ ] 演示视频无内部推理、密钥和测试假数据；
- [ ] ZIP 命名正确且小于 300MB；
- [ ] 体验账号、后端配置和降级说明可用。

---

## 11. 自检记录

- Spec coverage：评审三项短板、官方赛道五个关键词、用户七项材料要求均已映射到任务或验收项。
- Placeholder scan：未使用“稍后补充”“类似 Task N”“适当处理”等不可执行描述。
- Type consistency：`TwinItemInput`、`TwinScenario`、`TwinResult`、`AgentAction`、`PolicyDecision`、`NumericClaimIssue` 在后续任务中保持同名。
- Scope check：Web、小程序、安卓、Qt 不进入本轮关键路径；只处理鸿蒙主线与提交材料。
- Platform check：主线只采用已在本机 SDK 中确认存在的扫描、通知、卡片、接续能力；未验证能力进入 P1 闸门。
