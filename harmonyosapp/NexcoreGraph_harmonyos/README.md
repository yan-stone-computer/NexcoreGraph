# 启核图策 NexcoreGraph · 鸿蒙端（entry HAP）

> 家庭资源智能管家 · 拍照建库 · AI 规划 · 临期预警 · 家庭协作
> 参赛赛事：**2026第九届传智杯全国大学生数智创新与 AI 应用大赛**
> 参赛赛道：**HarmonyOSCodelabs挑战赛**
> 参赛团队：**天枢序列**（团队编号 38376，广西师范大学，B组）
> 整改依据：`docs/competition/启核图策-鸿蒙端专项整改与验收文档.md`

## 一、工程基线

| 项 | 取值 |
|---|---|
| 语言 / UI | ArkTS + ArkUI（声明式，无 WebView 承载主界面） |
| 应用模型 | Stage 模型（UIAbility + FormExtensionAbility） |
| 形态 | 元服务（`bundleType: atomicService`，`installationFree: true`） |
| SDK | compileSdk / targetSdk `6.1.0(23)`，compatibleSdk `6.0.0(20)` |
| IDE | DevEco Studio 5.x / 6.x（已验证 6.1.0.850 + HarmonyOS SDK API 23） |
| 设备 | phone / tablet / **2in1** |
| 后端 | `backend/`（Node.js + Express + MySQL，含 AI 网关） |
| 包名 | `com.example.myapplication`（待决策 Q2：是否改 `com.nexcore.graph`） |

## 二、构建

### 方式 A：DevEco Studio（推荐给首次上手）

1. DevEco Studio 5.x/6.x → `Open` 本目录（`harmonyosapp/NexcoreGraph_harmonyos`）；
2. 等待 Sync 完成 → 选择模拟器（Phone/Tablet/2in1）→ 点 `Run`。

### 方式 B：命令行（可复现，用于 CI 与验收留证）

```bash
# Windows
tools\build.bat                       # 默认 assembleHap（debug）
tools\build.bat -Task clean
tools\build.bat -Release              # release 构建

# PowerShell / macOS / Linux
pwsh -File tools/build.ps1 -Task assembleHap
bash tools/build.sh
```

> 说明（对应整改文档缺陷 D11）：DevEco Studio 6.x 的工程模板**不再自带** `hvigorw` /
> `hvigorw.bat`（模板内该文件为 0 字节占位），命令行构建由 IDE 自带的
> `tools/hvigor/bin/hvigorw` 驱动。`tools/build.*` 负责自动定位 DevEco 安装目录并注入
> `DEVECO_SDK_HOME` / `NODE_HOME`，因此换机器只需安装 DevEco Studio 即可复现；
> 直接把 IDE 的 wrapper 拷进工程根目录会因缺少项目级 hvigor 缓存而失败（已验证）。

手动等价命令：

```powershell
$env:DEVECO_SDK_HOME = 'D:\CodeEditor\DevEcoStudio\DevEco Studio\sdk'
& 'D:\CodeEditor\DevEcoStudio\DevEco Studio\tools\hvigor\bin\hvigorw.bat' `
    assembleHap --mode module -p product=default -p buildMode=debug --no-daemon
```

构建产物：`entry/build/default/outputs/default/entry-default-unsigned.hap`（配置签名后为 `-signed.hap`）。

## 三、后端与 AI 网关（M-7 安全红线）

端侧**不持有任何模型厂商密钥**：所有模型调用都经自建后端 `/api/ai/*`。

```bash
cd backend
npm install
set AGNES_API_KEY=sk-你的服务端密钥       # 只在这里配置，端侧无任何 sk- 明文
node server.js                            # 默认 0.0.0.0:3000
```

可用环境变量：

| 变量 | 默认 | 说明 |
|---|---|---|
| `AGNES_API_KEY` | 空 | 未配置时 `/api/ai/*` 返回 503，端侧自动回退本地快答 |
| `AGNES_BASE_URL` | `https://api.agnes-ai.cn/v1` | OpenAI 兼容上游地址 |
| `AGNES_MODEL` / `AGNES_MODEL_ALT` | `agnes-2.0-flash` / `agnes-1.5-flash` | 主模型 + 失败降级备用模型 |
| `AI_TIMEOUT_MS` | 15000 | 网关侧超时（验收口径 P95 ≤8s，超时 15s） |
| `AI_RPM` | 20 | 按家庭每分钟调用上限，超出返回 429 |
| `TTS_ENDPOINT` / `TTS_API_KEY` | 空 | 配置后 `/api/ai/tts` 返回音频地址；未配置返回 501，端侧静默降级 |
| `DB_HOST/PORT/USER/PASSWORD/NAME` | 127.0.0.1:3307 / root / 123456 / tianshu | MySQL 连接 |

| 端点 | 说明 |
|---|---|
| `POST /api/ai/chat` | 入参 `{familyId, user, intent, evidence, question, history?, maxTokens?}` → `{ok, text, model, ms, tokens}` |
| `POST /api/ai/vision` | 入参 `{imageBase64, hints?}` → `{ok, items[], model, ms}` |
| `POST /api/ai/tts` | 入参 `{text, voice?}` → `{ok, url}`（未配置 501） |
| `POST /api/ai/usage` | 端侧用量批次上报（含"本地快答"0 次模型记录） |
| `GET /api/ai/usage?familyId=&range=` | 聚合：路由分布 / 模型分布 / 平均耗时 / 快答占比 |

同步接口沿用 v1 契约：`POST /api/sync/upload`（409 = 冲突，端侧二选一）、`GET /api/sync/status/:id`、
`GET /api/sync/download/:id`、`GET /api/logs/:id`。快照 payload **不含** chat / profile / usage（隐私口径）。

## 四、代码结构

```
entry/src/main/ets/
├─ common/
│  ├─ Backend.ets        后端地址解析（模拟器 NAT → 局域网 → 本机）与 JSON 请求，同步/AI 共用
│  ├─ AiGateway.ets      端侧 AI 客户端：意图路由 + 证据装配 + 工具行解析（Key 不在端上）
│  ├─ KnowledgeIndex.ets 知识库 RAG：rawfile 载入 + 2-gram 倒排检索 + 来源（src/url）
│  ├─ Router.ets         意图路由、证据装配、0 次模型快答（数值红线）
│  ├─ Api.ets            业务动作 + 落地价值指标（临期消耗率/拦截重复采购/盘点耗时中位数）
│  ├─ Store.ets          全局状态（@ObservedV2/@Trace）+ 价值账本
│  ├─ LocalStore.ets     本地落盘：对话 ≤200 条、偏好、AI 用量、价值账本、卡片快照
│  ├─ SyncApi.ets        云端同步（全量快照 + 409 冲突二选一）
│  ├─ Tts.ets            播报（元服务形态不支持 CoreSpeechKit，走网关合成 + AVPlayer）
│  ├─ Asr.ets            语音输入（同因降级，恢复条件见文件头注释）
│  └─ Tokens.ets/Icons.ets/Db.ets/Knowledge.ets
├─ pages/                Index（Tabs 壳）、DashboardView、LibrariesView、WorkbenchView、
│                        Overlays（全部浮层 + 设置页）、AiPanel、LoginView、card/*（4 张卡片）
├─ components/Widgets.ets
└─ resources/rawfile/knowledge/   知识库（foods/recipes/storage-rules/sources）
```

## 五、提交前自检

```bash
python tools/check_release.py
```

覆盖：密钥明文（D6/M-7）、知识库随包（M-8）、卡片多端与定时刷新（M-5）、
设备类型/权限声明（D1）、合规交付物（M-13）、AI 生成内容标识、AI 网关契约。

## 六、主题与品牌资产

- **默认主题 = 启核色板 + 浅色**（冷白底 `#F5F9FB`，**启核绿 `#2F8F3A` 主操作**、过渡青 `#2FD4B2` 强调、信号蓝 `#0CA8D6` 数据），取自官方徽标的绿→青→蓝渐变；深色可手动切换（深色态用 `#46B14C` 主色 + 深海军蓝 `#13172B` 底）；
- 可在「设置 → 外观」切换为早期品牌橙（经典色板）或浅色，并提供"恢复品牌默认主题"；
- 令牌唯一来源 `entry/src/main/ets/common/Tokens.ets`（两套色板 × 明暗两态），页面禁止写死颜色；映射表见 `docs/启核图策-NexcoreGraph-品牌规范.md` 第 6 节；
- **AI 头像**使用官方徽标（`entry/.../media/ai_avatar.png`）。

## 七、合规与隐私

- 采集范围、权限用途、本地优先策略、AI 生成内容标识见 `docs/privacy.md`；
- 权限仅 `ohos.permission.INTERNET`（system_grant）与 `ohos.permission.MICROPHONE`（user_grant，带 reason/usedScene）；
- 聊天记录、偏好档案、AI 用量、价值指标**仅存本机**，不进入同步 payload。

## 八、当前状态（对齐整改文档第 2/4 章）

| 项 | 状态 |
|---|---|
| M-7 后端 AI 网关（Key 收敛、限流、降级、留痕） | ✅ 已实现并端到端联调 |
| M-8 知识库 RAG 与来源引用 | ✅ rawfile 索引 + 2-gram 检索 + 气泡来源链接 |
| M-9 TTS 播报 | ✅ 网关合成 + AVPlayer（元服务形态禁用 CoreSpeechKit，已实测） |
| M-10 AI 用量看板 | ✅ 端内分布 + `/api/ai/usage` 聚合（快答占比） |
| M-11 落地价值看板（三指标） | ✅ 看板卡片 + 本地账本 |
| M-13 工程化与合规 | ✅ README/LICENSE/privacy/构建脚本/检查脚本 |
| M-5 服务卡片多端（2in1 + 本地快照） | ✅ 已实现（X6 待真机添加卡片验证） |
| M-1~M-4 分布式（同步、流转、接续、跨设备入口） | ✅ 代码已实现；双机实测证据待补 |
| M-6 Codelabs 教程（`docs/codelab/`） | ✅ 已补齐 00–08 九步教程 |
| M-12 Push Kit 订阅推送 | ⏳ 待决策 Q3（需 AGC 凭据）；`push_subscription` 表已就绪 |
| **G1 端侧图谱内核**（补充方案） | ✅ 已实现（编译通过）：`common/Graph{Model,Store,Build,Query}.ets`；设置页可见规模/版本/重建耗时 |
| **G2 GraphRAG 编排**（补充方案） | ✅ 已实现（编译通过）：`AiGateway` 附 `graphEvidence`，意图→模式映射（食谱类 multi-hop / 简报 global） |
| **后端图谱服务**（补充方案第 6 章） | ✅ 已实现并联调：五表 + 4 端点 + 摘要预计算；BG-1~BG-8 验证通过 |
| Web / 小程序 / 安卓 / Qt 图谱 | ⏳ 未实现（见补充方案第 8~11 章） |

验收用例与演示脚本见整改文档第 7 章。
