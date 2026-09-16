# 启核图策 NexcoreGraph · Web 端专项整改与验收文档

> 版本：v1.0｜日期：2026-09-13｜对应赛道：**AI WEB 网页开发挑战赛**（传智杯 matchTrack id=10037）
> 负责人：杨欢（辅助：查豪霆）｜设计基准：`web-demo/`｜需求基准：《启核图策 · 项目完整文档》
> 本文档承担：① 赛道要求达标差距分析；② Web 端（用户端 + 管理员端）开发执行方案；③ 验收标准（需要达到的效果）。

---

## 0. 文档使用说明

| 角色 | 读哪几章 |
|---|---|
| 端负责人（杨欢） | 全篇，重点是第 3、4 章 |
| 辅助（查豪霆） | 4.5 管理员端、4.6 RAG、4.9 工程化、第 7 章验收 |
| 评委 / 指导老师 | 第 1、2.2、7 章 |

术语：**网关**=后端 `/api/ai/*` AI 代理（Key 只存服务端）；**证据**=代码查询得到的事实行；**快答**=命中本地规则的零模型调用回答；**Trace**=Agent 执行轨迹可视化。

---

## 1. 赛道要求解读

### 1.1 官方原文（2026-09-13 取自大赛官网 track/detail）

> 赛道名称：**AI WEB网页开发挑战赛**
> 赛道介绍：**本赛道围绕 "智启未来：AI 驱动的 Web 应用创新挑战"，考核选手基于主流前端框架融合大模型、AI Agent、RAG、多模态 AI 打造实用优质 AI 原生 Web 应用的综合能力。**

通用口径：团队 3 人；报名截止 **2026-11-18**（官网 live 数据）；省赛 **2026 年 11 月**、国赛 **2026 年 12 月**（具体以官网通知为准）。

### 1.2 要求拆解为可验收条目

| 编号 | 要求 | 判定口径 |
|---|---|---|
| W1 | **主流前端框架** | 使用 Vue 3 + TypeScript 工程化构建（非静态 HTML + 原生 JS 拼装）：组件化、路由、状态管理、构建产物齐全 |
| W2 | **融合大模型** | 有真实 LLM 调用（优先流式输出）；Key 由服务端保管；失败可降级 |
| W3 | **AI Agent** | 模型产出结构化指令 → 前端预览 → 用户确认 → 执行 → 可撤销；并有执行轨迹可视化 |
| W4 | **RAG** | 检索增强：问题 → 检索（库存结构化 + 知识库文本）→ 证据装配 → 带来源引用的回答，可追溯 |
| W5 | **多模态 AI** | 至少 1 条真实多模态链路：拍照/上传 → 视觉识别 → 结构化入库；加分：语音输入 / TTS 播报 |
| W6 | **AI 原生** | AI 嵌入主流程（拍照入库、方案生成、库存修改、看板洞察），不是外挂聊天框 |
| W7 | **实用优质** | 真实场景闭环、性能预算、可访问性、错误处理、移动端适配 |

### 1.3 交付材料

1. 线上可访问地址（HTTPS，含演示账号），或可一键启动的仓库（含 README）。
2. 源码仓库（构建步骤 + `.env.example`）。
3. 作品说明文档（痛点 / 方案 / 架构 / AI 设计 / 创新点 / 落地价值）。
4. 演示视频 3–5 分钟（必须拍到 Agent 写操作确认与 RAG 来源）。
5. 验收报告（本文第 7 章逐条打勾 + 截图）。

---

## 2. 现状核查

### 2.1 现状（诚实口径）

Web 端真工程为 **`NexcoreGraph_web/`**（来源：`D:/Application/QQ/QQDownload/webapp.zip`，本次解包到 `D:\ProjectFiles\GithubPackage\NexcoreGraph\web\NexcoreGraph_web`），是**用户端 + 管理员端全功能交付**，不是原型：

| 组成 | 文件 | 说明 |
|---|---|---|
| 用户端入口 | `index.html` | 登录 / 看板 / 资源库 / 拍照入库 / AI 对话 / 方案 / 预警 / 采购 / 协作工作台 / 全局搜索 / 设置 |
| 管理员端入口 | `admin.html` | F10 六模块：用户 / 家庭（邀请码）/ 数据审计 / AI 用量 / 系统配置 / 知识库管理 |
| AI 编排层 | `js/ai.js`（11KB） | 意图路由（greet/where/qty/expiry 本地快答）、受约束工具协议（`[调整]`、`shopping_add`，先预览后确认）、营养速览、AI 创新菜谱、看板简报 |
| 知识库 | `js/knowledge.js`（10KB） | 食材 25 项（保质期/开封后/存放建议）、菜谱 16 道、存放规则 10 条（带来源） |
| 模拟后端 | `js/mockapi.js`（47KB） | 接口签名对齐 REST 契约（`/api/auth/login`、`/api/sync/*`、`/api/ai/*`、`/api/families*`），localStorage 持久化 |
| 管理员逻辑 | `js/admin.js`（28KB） | 六模块视图与操作（禁用用户、邀请码、审计、用量、配置、知识库发布） |
| 视觉 | `css/{tokens,app,extra}.css` + `design-tokens.json` | 复用 `web-demo` 基准，增量样式独立在 `extra.css` |
| 交付配套 | `README.md`、`start.bat`、`start.sh`、`qa/shots/*.png`（12 张） | 启动脚本与质检截图 |

**本次实测结论（改名换 Logo 之后）**：

- 冒烟检测（headless Edge + CDP，登录态）：标题 `启核图策 NexcoreGraph · Web 端`、看板正文 859 字、19 个按钮、0 破图、**控制台异常 0 条**。
- 已有能力中，**真正达标**的是：AI 编排逻辑（路由/工具/预览确认/撤销/简报）、管理员端、业务闭环、知识库来源标注、Web Speech 语音输入、CSV 导入导出。
- **真正未达标**的是赛道四件套里的"框架 + 真模型 + 检索增强 + 真实多模态"：全项目**没有任何 `fetch`/XHR 调用**，所有 AI 输出都是 `ai.js`/`mockapi.js` 内的本地模板模拟（代码注释已标注"正式版为 /api/ai/chat、/api/ai/vision"）。

**结论：Web 端功能完成度高，但赛道"AI 原生 + 主流框架"这两条硬指标未达标，必须按第 4 章完成"接真模型 + 框架化"两步改造。**

### 2.2 差距清单（要求 → 现状 → 整改）

| 要求 | 现状 | 差距 | 整改动作 |
|---|---|---|---|
| W1 前端框架 | 免构建原生 HTML/CSS/JS（分文件、模块边界清晰：状态层 `mockapi` ↔ 视图 `app.js` ↔ AI `ai.js`） | 🔴 硬缺口（赛道明确要求"主流前端框架"） | M-1 框架化：Vue 3 + TS + Vite + Pinia + Router；现有模块 1:1 映射（stores ← mockapi/data、views ← app.js、api ← mockapi 的 fetch 版） |
| W2 大模型 | **全项目 0 处网络请求**；`ai.js:modelReply` 为模板 + 延时模拟 | 🔴 硬缺口 | M-2 接入网关 `POST /api/ai/chat`（流式），保留本地快答兜底 |
| W3 Agent | 工具协议、白名单、预览确认、撤销**已实现**（真实代码逻辑） | 🟠 部分达标 | M-3 工具改由真实模型触发 + 新增 **Agent Trace 执行轨迹**可视化 |
| W4 RAG | `knowledge.js` 为本地常量，按名称直匹配（`kbEntry`），回答已带来源小字 | 🟠 部分达标 | M-4 知识库入库 + 混合检索（结构化 + 2-gram 倒排）+ 标准化"来源块"渲染 |
| W5 多模态 | `getUserMedia` 真实拍照 + 拖拽/多选，但**识别为模拟**；有 Web Speech 语音输入；无 TTS | 🔴 硬缺口（识别不真实） | M-5 识别改调 `/api/ai/vision`（含 confidence 低置信标注）；M-6 增加 TTS 播报 |
| W6 AI 原生 | AI 已嵌入拍照入库 / 方案 / 改库存 / 看板四条流程 | 🟢 达标 | 保持；补"AI 生成"标识 |
| W7 实用优质 | 启动脚本、README 齐；无 PWA / 无单测 / 无 E2E / **无质检脚本**（仅有 12 张历史截图） | 🟠 重要 | M-7 补 QA 脚本（CDP）+ Vitest/Playwright + 性能预算 + PWA |
| 管理员端 | 已实现六模块 | 🟢 达标 | 补 AD 验收用例截图 |
| 品牌 | 已更名 + 换 Logo（本次完成） | 🟢 达标 | 见第 3 章 |

### 2.3 文档缺陷（本次核查发现）

| # | 缺陷 | 修订口径 |
|---|---|---|
| D1 | 原《网站开发文档》写"Vue 3 + TypeScript（已确认）"，实际交付 `NexcoreGraph_web/` 是**免构建原生实现**（README 记录原因："本机无 Node 环境"），文档与交付物口径不符 | 文档显式登记该技术债与迁移路径；交付物按 M-1 迁移到 Vue 3 后回填口径；迁移前不得再声称"已用 Vue 3" |
| D2 | 未定义前端可用的 AI 接口契约（后端 v1 只有同步/家庭接口） | 本文 4.4 定义 `/api/ai/*` 契约，并与鸿蒙端共用同一契约 |
| D3 | 未写明"Key 不得出现在前端"的红线 | 写入 M-2 与 4.8；构建后静态断言产物中无 `sk-` |
| D4 | 未定义 RAG 检索方式与引用格式 | 本文 4.6 定义检索链路与引用块格式 |
| D5 | 未定义 Agent 工具白名单、参数校验与失败降级 | 本文 4.3 定义工具表 + 五条规则 |
| D6 | 验收章节缺 Web 专项用例（浏览器兼容、导入导出、响应式断言） | 本文第 7 章新增 W-A ~ W-H、AD-1 ~ AD-4 |
| D7 | `web-demo` 的质检脚本 `qa/check.js` 硬编码绝对路径与端口，换机器必失败 | ✅ 已修（相对脚本定位 + `CDP_PORT` 可覆盖 + 截图目录自动创建） |
| D8 | 未登记"AI 生成内容标识"合规要求 | 本文 4.8：识别结果 / AI 方案 / AI 简报处显示"AI 生成"角标 |
| D9 | 历史文档存在"见 9""见第 10 章"等失效交叉引用 | 合并版文档已收敛；后续统一用章节号，修订时校验引用 |
| D10 | 未定义 Web 端与鸿蒙端的接口/协议共享方式 | 本文 4.4 + 第 6 章约定：AI 网关契约以本文为准，任一端改动需同步三份整改文档 |
| D11 | `NexcoreGraph_web/` **没有质检脚本**（只有 `qa/shots/` 12 张历史截图），无法自动化回归 | 把 `web-demo/qa/check.js` 或 `tools/smoke_web.py` 纳入 `webapp/qa/`，作为发版前必跑项 |
| D12 | 全项目无任何网络请求，但界面上有"AI 用量 / 模型"等文案，容易被评委误认为已接真实模型 | 接真模型后区分"真实调用 / 本地快答"两类并标注数据来源；README 与 UI 同步说明 |
| D13 | 存储键前缀由 `tianshu_web_db_v2` 改为 `nexcore_web_db_v2`，旧数据不再读取（本次更名带来的副作用） | 演示前执行"设置 → 重置演示数据"；若要保留旧数据，加一次性旧键迁移读取 |
| D14 | 主题令牌分叉：`webapp` 用品牌橙（`tokens.css`），`tianshu-weapp` 用香槟金（`theme.scss`，`#C9A86A`），`design-tokens.json` 另一套 Dark Champagne | 统一到单一令牌源（`design-tokens.json`）生成三端样式；执行前先定 Q1（品牌主色方案） |

---

## 3. 品牌统一整改（启核图策 / NexcoreGraph）

### 3.1 命名规范

| 项 | 取值 |
|---|---|
| 中文名 / 英文名 | **启核图策 / NexcoreGraph** |
| 展示规则 | 登录页与侧边栏：中文主名 + 英文副名（`NexcoreGraph · 家庭资源智能管家`）；文档标题：`启核图策 NexcoreGraph · …` |
| 本地存储键前缀 | `nexcore_`（原 `tianshu_`） |
| 站点标题 / 描述 | `启核图策 NexcoreGraph · Web 端`（已更新） |

### 3.2 Logo 与品牌色（已提取）

提取脚本 `tools/extract_logo.py`，产物目录 `assets/brand/`。徽标构成：圆形渐变徽标（绿→青→蓝）+ 顶部双叶嫩芽 + 圆内白色字母 N + 底部白色弧线。

| 颜色 | 色值 | 用途 |
|---|---|---|
| 启核绿 | `#46B14C` | 生长语义 / 成功 |
| 嫩芽黄绿 | `#B1EB59` | 高光 |
| 过渡青 | `#2FD4B2` | 强调 |
| 科技青 | `#19BDC9` | 状态 / 悬浮 |
| 信号蓝 | `#0CA8D6` | 主操作（方案 B 下的主色） |
| 深蓝 | `#029ED0` | 渐变下缘 |
| 底色 | `#13172B` | 深色主题底 |
| 徽标白 | `#FDFFFE` | 圆内图形 |

### 3.3 本次已在 `web-demo/` 完成的替换

| 位置 | 文件 | 状态 |
|---|---|---|
| 页面标题 / 描述 | `index.html` | ✅ 启核图策 NexcoreGraph |
| 站点图标 | `index.html`（favicon.ico / logo.png / apple-touch-icon / theme-color） | ✅ |
| 图标资产 | `assets/img/{favicon.ico,logo.png,apple-touch-icon-180.png,web-app-manifest-192.png,web-app-manifest-512.png}` | ✅ |
| 品牌位文案 | `js/app.js`（登录标题与副名、侧边栏、资源柜标题、导出文件名、采购清单文本） | ✅ |
| 资产清单 | `assets/manifest.json`（新增 brand 段：名称/色板/图标） | ✅ |
| 主题注释 | `css/tokens.css` | ✅ |

### 3.4 品牌资产（v3：E3 定稿图标）

**定稿图标（E3）**：大号四角取景框（识别）+ 框内折面地图（地图）+ 带节点的路线与终点小旗（规划）+ 路径取舍（策），左上角嵌入**官方圆形徽标**（绿→青→蓝渐变 + 顶部嫩芽 + 白色 N 与弧线）——徽标是元素之一，不占 C 位。

| 资产 | 文件 | 用途 |
|---|---|---|
| 应用图标（圆角） | `assets/img/logo.png`（512px） | 侧栏、登录页 |
| 站点图标 | `assets/img/favicon.ico`（16/32/48/64/128/256）、`apple-touch-icon-180.png` | 浏览器标签、iOS 主屏 |
| PWA 图标 | `assets/img/web-app-manifest-192/512.png` | 可安装应用 |
| 应用图标母版 | `docs/brand/icon-1024.png` | 商店图、物料 |
| 组合标（浅底/深底） | `assets/img/brand-lockup.png`、`docs/brand/brand-lockup-dark.png` | 作品说明文档、路演 PPT、分享图 |
| 去底透明版 | `docs/brand/mark-transparent-1024.png` | 深色界面内嵌、海报 |
| 单色版 | `docs/brand/mark-mono-{white,ink}.png` | 小尺寸与印刷 |
| 品牌规范 | `docs/启核图策-NexcoreGraph-品牌规范.md` | 配色、留白、最小尺寸、禁忌 |

设计约束：中文名微软雅黑 Bold、英文名全大写 + 0.08em 字距；图标内徽标占画布 62%（安全区留白）；右侧内容与徽标视觉居中；最小可辨识尺寸 24px（渐变）/16px（单色）。

### 3.5 品牌色与现有主题（决策项 Q1）

现有主题主色是品牌橙 `#FF8833`（`tokens.css`），新 Logo 为绿-青-蓝系：

- **方案 A（默认，低风险）**：保留橙色主色，Logo 独立呈现；青绿用于"AI / 生长 / 成功"语义。
- **方案 B（推荐，视觉统一）**：主色迁移为信号蓝 `#0CA8D6`、强调色 `#2FD4B2`、成功色 `#46B14C`；橙色降级为"临期 / 预算"语义色。执行约束：只改 `design-tokens.json` 后重新生成各端令牌，并重跑对比度校验（正文 ≥4.5:1，大字/图标 ≥3:1）。

---

## 4. Web 端开发方案

### 4.0 技术栈与工程结构

> 迁移起点：现有真工程 `NexcoreGraph_web/`（免构建原生实现，功能完整）→ 目标 Vue 3 工程。迁移时保持"状态层 ↔ 视图层 ↔ AI 层"三段边界不变，按 4.1 的映射表逐块平移，视觉以 `web-demo/shots` 与 `webapp/qa/shots` 双基准回归。

**技术栈**：Vue 3.4 + TypeScript 5 + Vite 5 + Pinia + Vue Router + ECharts 5 + Axios；AI 流式用 fetch ReadableStream / SSE；测试 Vitest + Playwright；规范 ESLint + Prettier；pnpm workspace。

```
nexcoregraph-web/
├── apps/
│   ├── user/                  # 用户端（AI 原生主应用）
│   └── admin/                 # 管理员端（独立入口，复用 UI 包）
├── packages/
│   ├── ui/                    # 组件库（按 web-demo 组件清单实现）
│   ├── tokens/                # 由 design-tokens.json 生成的 CSS 变量
│   └── api/                   # 类型化 API 客户端（含 /api/ai/*）
├── e2e/                       # Playwright 用例
└── README.md
```

**映射关系**：`web-demo/js/app.js` 的 13 个页面 → `apps/user/src/views/*`；`web-demo/css/app.css` 的组件类（btn/card/kpi-tile/donut/ring/bento/seat/hand/ai-ball/ai-panel/viewfinder…）→ `packages/ui/src/components/*`；所有颜色与间距只来自 `packages/tokens`，禁止硬编码。

### 4.1 M-1 框架化重构（W1）

| 步骤 | 做法 | 验收 |
|---|---|---|
| 1 | 初始化 Vite + Vue3 + TS，接入 Pinia 与 Router，路由与原型页面一一对应 | 所有页面可直达，刷新不 404 |
| 2 | `data.js` 种子数据迁入 `stores/*`（库/物品/方案/预警/采购/协作/设置/用户） | 页面数据全部来自 store，无 `window.DB` 残留 |
| 3 | `app.css` 按组件拆分到 `packages/ui`，**保留原型类名**便于对照 | 视觉回归截图与原型一致 |
| 4 | 用 Vue 组件替换所有 `innerHTML` 拼接视图 | 业务内容不再用 `innerHTML` 渲染（收敛 XSS 面） |
| 5 | 保留 `web-demo/` 作为视觉基准与回归对照 | 每次发版跑一次对照截图 |

**关键点**：原型采用"整页重渲染 + `data-action` 事件委托"，Vue 版改为组件事件；AI 球磁吸、入场 stagger、取景框扫描等动效用 CSS transition + `requestAnimationFrame` 复刻，并支持 `prefers-reduced-motion`。

### 4.2 M-2 大模型接入与流式对话（W2）

| 项 | 实现 |
|---|---|
| 网关 | `POST /api/ai/chat`（服务端持有 Key；`stream: true` 返回 SSE） |
| 前端 | `composables/useAiChat.ts`：fetch + ReadableStream 逐字渲染；AbortController 支持"停止生成"；失败重试 |
| 会话 | 消息存 IndexedDB（仅本地，不上云），≤200 条滚动保留 |
| 降级 | 网关不可用 → 本地快答（数量/位置/保质期/问候）；再失败提示"AI 暂不可用，可手动录入" |
| 观测 | 每次请求记录 `{intent, route, model, ms}`，前端"AI 用量"页展示（与管理员端同源） |

### 4.3 M-3 Agent 工具链路与 Trace（W3）

| 工具 | 触发示例 | 参数 | 前端行为 | 风险级 |
|---|---|---|---|---|
| `adjust` | "鸡蛋只剩 5 个" | `{name, qty}` | 预览卡（原值 → 新值）→ 确认写库 → 可撤销 | A2 可逆 |
| `shopping_add` | "牛奶没了，加采购清单" | `{name, qty?, src}` | 预览 → 确认 → 写入采购清单（按名去重） | A2 可逆 |
| `plan_create` | "用临期食材做 3 个方案" | `{dishes:[{title,time,ingredients[]}]}` | 生成方案卡；消耗项回查库存，缺料进清单 | A2 可逆 |
| `plan_execute` | "执行番茄炒蛋" | `{planId, items[]}` | 勾选核销 + 低库存预警 + 日志 | A2 可逆 |

**五条规则（红线）**：

1. 前端只执行白名单工具；模型输出不合规 → 当普通文本渲染，不报错、不误写。
2. `adjust` 的名称必须命中库存；否则提示"库存里没找到「XX」，要手动添加吗？"
3. 数量必须为正数且 ≤ 999。
4. 写操作一律"预览 → 确认 → 生效 → 可撤销 → 写日志"。
5. 单次请求最多 2 次模型调用（含工具结果回填）。

**Agent Trace（可视化）**：对话气泡下可展开执行轨迹——`意图识别 → 证据检索(3 条) → 模型生成 → 工具调用 adjust → 预览确认 → 已写入`，每步显示耗时。这一项把 Agent 能力变成评委可见的证据。

### 4.4 接口契约（前端可用）

```http
POST /api/ai/chat     { intent?, question, evidence?, profile?, stream? }  -> text | text/event-stream
POST /api/ai/vision   multipart(file) 或 { imageBase64 }  -> { items:[{name,category,qty,unit,pos,expDays,expSrc,price,priceSrc,confidence}] }
POST /api/ai/tts      { text }  -> audio/mpeg | { url }
POST /api/ai/plan     { familyId, mode: "cook"|"creative"|"nutrition", preferences? }  -> { plans:[{title,time,tags,ingredients[],missing[]}] }
GET  /api/knowledge   ?q=&type=food|recipe|rule  -> { hits:[{title,text,src,url,score}] }
GET  /api/ai/usage    ?familyId=&range=7d  -> { calls, byIntent{}, p50, p95, savedByFastPath }
```

同步与家庭接口沿用后端 v1：`/api/auth/login`、`/api/families*`、`/api/sync/*`、`/api/logs/:familyId`。**此契约同时是鸿蒙端与小程序端的实现依据，改动需三方同步。**

### 4.5 M-9 管理员端（查豪霆主责）

| 模块 | 路由 | 要点 |
|---|---|---|
| 登录与权限 | `/admin/login` | 独立入口；角色由后端判定，前端只做路由守卫 |
| 用户管理 | `/admin/users` | 列表 / 搜索 / 禁用 / 角色调整 |
| 家庭管理 | `/admin/families` | 空间、成员、容量、邀请码生成 / 限时 / 撤销 |
| 数据审计 | `/admin/audit` | 操作日志（时间 / 操作人 / 动作 / 详情）分页与导出 |
| AI 用量 | `/admin/ai-usage` | 调用次数、意图分布、P95 耗时、快答节省量、限流与限额配置 |
| 知识库 | `/admin/knowledge` | foods / recipes / rules 三类增删改与发布（写后端 `knowledge` 表） |
| 系统配置 | `/admin/settings` | 模型参数、联网开关、推送模板、内置库模板 |

### 4.6 M-4 RAG 检索增强（W4）

**数据源**：`knowledge/foods.json`（46 项食材：常温/冷藏/冷冻天数、开封后、存放建议、低库存阈值）、`knowledge/recipes.json`（16 道菜：用料/耗时/每份热量/标签）、`knowledge/storage-rules.json`（10 条食品安全规则），来源链接见 `sources.md`。

**检索链路**：

```
问题 → ① 意图识别
     → ② 结构化检索（库存：名称 / 别名 / 类别过滤）
     → ③ 文本检索（知识库：标题 + 正文 2-gram 倒排，取 Top3，score ≥ 阈值）
     → ④ 证据装配（带 src / url；物品 ≤30 条）
     → ⑤ 大模型生成（只依据证据）
     → ⑥ 前端渲染「来源」块
```

**引用展示格式**：

```
鲜牛奶开封后建议 3 天内喝完，按今天算还有 2 天。
来源：库存实查（冰箱·冷藏区）｜知识库 foods.json · 香港食物安全中心
```

**降级**：检索无命中 → 明确回答"未找到可靠来源"，不编造数字；命中率 <60% 的规则需回头补知识库或同义词。

### 4.7 M-5 / M-6 多模态（W5）

| 能力 | 实现 | 要点 |
|---|---|---|
| 拍照入库 | `getUserMedia` 取景（HTTPS 必须）+ 连拍（≤6 张）+ 拖拽上传 | 前端压缩（长边 ≤1600、≤1MB）→ `/api/ai/vision` → 识别结果进入"补缺确认"表 |
| 相册导入 | 拖拽 / 多选文件 | 同批次合并去重、数量累加 |
| 语音输入 | Web Speech API（`webkitSpeechRecognition`） | 不支持则隐藏入口 |
| 语音播报 | `/api/ai/tts` 或 `speechSynthesis` | 播放 / 暂停；设置页开关 |
| 识别可信度 | 每项带 `confidence` | 低置信项黄标"请确认" |

### 4.8 工程化 / 性能 / 安全 / 合规

| 项 | 要求 |
|---|---|
| 性能预算 | 首屏 JS ≤300KB(gzip)、LCP ≤2.5s、TTI ≤3.5s、长任务 ≤200ms；路由级懒加载 |
| 无障碍 | 语义化标签、键盘可达（Tab / Esc）、`aria-*`、对比度达标、`prefers-reduced-motion` 降级 |
| 错误处理 | 全局错误边界 + 接口重试（指数退避）+ 骨架屏 + 空状态 |
| 安全 | **Key 只在服务端**（构建后断言产物无 `sk-`）；输入长度与类型校验；不用 `innerHTML` 渲染业务内容；配置 CSP；`pnpm audit` |
| 合规 | AI 生成内容标识（识别结果 / AI 方案 / AI 简报处显示"AI 生成"角标）；隐私说明（照片仅用于识别且可删除、聊天仅存本地）；不抓取需授权的内容源 |
| PWA（可选加分） | Service Worker 缓存壳 + 离线提示 + 通知权限（对应"每日摘要"） |

### 4.9 测试与质检

| 层 | 工具 | 覆盖 |
|---|---|---|
| 组件单测 | Vitest + @vue/test-utils | UI 组件 props/事件、工具协议解析、来源块渲染 |
| 逻辑单测 | Vitest | adjust / shopping_add 校验、临期计算、金额统计 |
| E2E | Playwright | 登录 → 拍照入库 → AI 对话（Agent 确认）→ 核销 → 导出；移动端视口 390×844 |
| 视觉回归 | Playwright 截图对照 `web-demo/shots` | 桌面 1440 与移动 390 两档 |
| 质检脚本 | `web-demo/qa/check.js`（CDP） | 渲染、溢出、交互、API 逻辑回归（本次已可移植化） |

---

## 5. 里程碑与排期

> 说明：功能层（含管理员端）**已完成**，因此排期只覆盖"接真模型 + 框架化 + 检索增强 + 多模态 + 质量"五项改造。

| 阶段 | 时间 | 内容 | 交付 |
|---|---|---|---|
| S0 品牌与举证 | 09/13（✅ 已完成） | 更名 + Logo；实测冒烟（登录态看板 0 异常）；把 `webapp` 与 `web-demo` 关系写入 README | 品牌规范 + 现状证据包 |
| S1 接真模型（先做，收益最大） | 09/14–09/24 | M-2 网关 `/api/ai/chat`（流式）+ 前端改 `fetch`；保留本地快答兜底；区分"真实调用/快答" | AI 对话真实可核查 |
| S2 多模态真实化 | 09/25–10/05 | M-5 识别改 `/api/ai/vision`（含 confidence）；M-6 TTS；拍照入库全链路真实 | 多模态链路可演示 |
| S3 框架化 | 10/06–10/20 | M-1 Vue3 + TS + Vite + Pinia；模块 1:1 迁移；视觉回归对照 `web-demo/shots` | 功能等价的 Vue 应用 |
| S4 检索增强 + Agent Trace | 10/21–10/31 | M-4 知识库入库 + 混合检索 + 来源块；M-3 Trace 可视化 | 四件套齐全 |
| S5 质量与部署 | 11/01–11/10 | QA 脚本（D11）/ 单测 / E2E / 性能预算 / PWA / HTTPS 部署 | 线上地址 + 验收报告草稿 |
| S6 冻结提交 | 11/06–11/15 | 全量验收 + 演示视频 + 材料 | **11/16 提交、11/18 截止**（原写 11/23 有误） |

---

## 6. 分工

| 角色 | 人 | 负责 |
|---|---|---|
| 负责人 | **杨欢** | M-1 框架化、M-2 网关与流式、M-3 Agent 链路与 Trace、M-4 RAG 前端、部署与整体验收 |
| 辅助 | **查豪霆** | M-9 管理员端、ECharts 看板、M-5 拍照链路前端、E2E 与视觉回归、性能与无障碍整改 |
| 后端协作 | 后端同学 | `/api/ai/*`、`/api/knowledge`、`knowledge` 表、限流与用量留痕 |
| 跨端协作 | 三端负责人 | AI 网关契约、知识库格式、设计令牌以本文 4.4 与 `design-tokens.json` 为准 |

---

## 7. 验收标准（需要达到的效果）

### 7.1 赛道要求逐条自检（对 1.2）

| 要求 | 现状（基于 `NexcoreGraph_web/` 实测） | 还剩什么 | 自检 |
|---|---|---|---|
| W1 主流前端框架 | ❌ 免构建原生实现 | 迁移 Vue 3 + TS + Vite（M-1） | ☐ |
| W2 大模型 | ❌ 0 处网络请求，回复为模板模拟 | 接 `/api/ai/chat` 流式（M-2） | ☐ |
| W3 Agent | 🟡 工具协议 / 预览确认 / 撤销已实现 | 改由真实模型触发 + Trace（M-3） | ☐ |
| W4 RAG | 🟡 知识库本地常量 + 名称直匹配 + 来源小字 | 入库 + 混合检索 + 来源块（M-4） | ☐ |
| W5 多模态 | 🟡 真实拍照 + 真实语音输入；识别为模拟 | 接 `/api/ai/vision` + TTS（M-5/M-6） | ☐ |
| W6 AI 原生 | ✅ AI 已嵌入四条主流程 | 仅补"AI 生成"标识 | ☐ |
| W7 实用优质 | 🟡 启动脚本 / README 齐、无异常；缺 QA 脚本与性能预算 | QA + 单测/E2E + PWA（M-7） | ☐ |

### 7.2 Web 专项用例

| 编号 | 步骤 | 期望 |
|---|---|---|
| W-A 登录与家庭 | 手机号 + 验证码登录；切换家庭空间 | 登录成功进看板；切换后数据随之切换；刷新保持登录 |
| W-B 拍照入库 | 允许摄像头 → 连拍 3 张 → 查看识别 → 补缺 → 一键入库 | 字段可编辑；同批次合并去重；库存与日志更新；低置信项黄标 |
| W-C AI 快答 | 问"鸡蛋放哪了""牛奶还剩多少" | ≤1s 回答含库位与数量；**0 次模型调用**（AI 用量页可验证） |
| W-D AI + RAG | 问"牛奶还能放几天" | 回答含天数 + 知识库建议 + 来源块；数字与库存页一致 |
| W-E Agent 写操作 | 说"鸡蛋只剩 5 个" → 预览 → 确认 | 预览显示前后值；确认后库存与日志更新；可撤销；Trace 显示工具调用 |
| W-F 方案与核销 | 生成 3 个方案 → 勾选执行 → 查看预警与采购清单 | 对应库存扣减；缺料进采购清单（去重）；可撤销 |
| W-G 导入导出 | 导出 CSV → 清空 → 导入同一 CSV | 物品数/字段与导出前一致（含价格与来源列） |
| W-H 响应式与无障碍 | 390×844 与 1440×900 两种视口；仅键盘操作 | 无横向溢出；侧栏/底部导航切换正常；Tab 可达全部主操作；Esc 关浮层 |

### 7.3 管理员端用例

| 编号 | 步骤 | 期望 |
|---|---|---|
| AD-1 | 管理员登录 → 禁用某用户 | 该用户无法登录；操作进审计日志 |
| AD-2 | 生成限时邀请码 → 用它加入家庭 → 撤销邀请码 | 加入成功；撤销后再用提示失效 |
| AD-3 | 查看 AI 用量 | 显示调用次数、意图分布、P95、快答节省量，与后端日志一致 |
| AD-4 | 知识库新增一条保质期规则 → 端上提问 | 新规则生效并被引用为来源 |

### 7.4 性能与安全验收

| 项 | 阈值 | 方法 |
|---|---|---|
| 首屏 LCP | ≤2.5s（4G 模拟） | Lighthouse |
| 首屏 JS | ≤300KB gzip | 构建报告 |
| 交互 | 列表滚动 60fps；操作反馈 ≤100ms | Performance 面板 |
| 产物无密钥 | 0 处 `sk-` | 构建后 `rg "sk-" dist/` |
| 关键接口 | P95 ≤800ms（不含模型推理） | 后端监控 |
| 无障碍 | 主流程键盘可达 + 无严重 axe 问题 | axe DevTools |

### 7.5 演示脚本（5 分钟）

1. （30s）痛点与产品：家庭资源记不住 → 打开看板（临期 2 项、今日方案）。
2. （60s）多模态：网页摄像头拍冰箱 → AI 识别 4 项 → 补缺入库。
3. （60s）Agent：说"鸡蛋只剩 5 个"→ 展开 Trace → 预览确认 → 撤销；再说"牛奶没了加采购清单"。
4. （60s）RAG：问"牛奶还能放几天"→ 展示来源块；打开知识库管理页演示可维护。
5. （40s）看板与导出：ECharts 趋势与环形图、CSV 导入导出。
6. （30s）管理员端：AI 用量（快答占比）+ 邀请码管理。

---

## 8. 提交材料清单

| 材料 | 形式 | 责任 |
|---|---|---|
| 线上地址（HTTPS）+ 演示账号 | URL | 杨欢 |
| 源码仓库（README、.env.example、构建步骤） | Git 仓库 | 杨欢 |
| 作品说明文档 | PDF / DOCX | 查豪霆 |
| 演示视频 3–5 分钟 | MP4 1080p | 查豪霆 |
| 验收报告（第 7 章打勾 + 截图） | 本文导出 | 杨欢 |
| 隐私与 AI 内容标识说明 | 独立页 + 文档 | 杨欢 |

---

## 9. 风险登记

| 风险 | 等级 | 对策 |
|---|---|---|
| 原型迁移工时被低估（13 页 + 组件库） | 🔴 高 | 按"先主链路后长尾"：S1 只做看板 / 资源库 / 拍照入库 / AI 对话 / AI 面板 5 个主页面，其余放 S4 |
| 网关未就绪阻塞前端 | 🟠 中 | 前端先按 4.4 契约用 MSW 打桩，接口就绪后切 baseURL，组件不改 |
| 浏览器语音识别兼容性差 | 🟠 中 | 特性检测 + 隐藏入口；主流程不依赖语音 |
| RAG 检索质量差导致答非所问 | 🟠 中 | 事实类问题（数量/位置/保质期）走确定性回答；检索命中率 <60% 时明确提示未找到来源 |
| 模型费用与限流 | 🟠 中 | 服务端限额 + 前端快答优先（目标快答命中率 ≥60%） |
| 摄像头需 HTTPS，评审环境受限 | 🟡 低 | 提供拖拽上传等价路径；演示前本地起 HTTPS 或直接用已部署站点 |

### 待决策项

- **Q1**：是否把主色迁移到 Logo 色系（方案 B）？
- **Q2**：管理员端是否使用独立域名（现口径：同仓库双入口，独立路由，可独立部署）？
- **Q3**：线上演示环境由谁提供（后端已在阿里云 ECS；需域名 + HTTPS 证书）？

---

## 附录 A 本次已执行的变更（2026-09-13）

| 类型 | 变更 | 文件 |
|---|---|---|
| 品牌 | 页面标题与描述、登录页、侧边栏、资源柜标题、导出文件名、采购清单文本 → 启核图策 / NexcoreGraph | `web-demo/index.html`、`web-demo/js/app.js` |
| 品牌 | 资产清单新增 brand 段（名称 / 色板 / 图标文件） | `web-demo/assets/manifest.json` |
| Logo | favicon.ico、logo.png(256)、apple-touch-icon-180、web-app-manifest-192/512 | `web-demo/assets/img/` |
| 存储 | localStorage 键前缀 `tianshu_` → `nexcore_` | `web-demo/js/{app,mockapi}.js` |
| 质检 | 脚本可移植化：相对脚本定位、`CDP_PORT` 可覆盖、截图目录自动创建（缺陷 D7） | `web-demo/qa/check.js` |
| 工具 | 品牌提取脚本、更名脚本、质检跑测脚本 | `tools/extract_logo.py`、`tools/rename_brand.py`、`tools/run_web_qa.py` |
| 备份 | 改动前 web-demo 备份 | `_backup/20260913-rename/web-demo-before-rename.zip` |

### 第二轮（2026-09-13，针对真工程 `NexcoreGraph_web/`）

| 类型 | 变更 | 位置 |
|---|---|---|
| 解包 | `webapp.zip` → `D:\ProjectFiles\GithubPackage\NexcoreGraph\web\NexcoreGraph_web`（源包保留在 QQDownload，可随时回滚） | — |
| 品牌 | 全项目更名：标题/描述、页面文案、导出文件名、采购清单文本、README、资源柜标题（共 40 处） | `index.html`、`admin.html`、`js/*.js`、`README.md`、`assets/manifest.json` |
| 品牌 | 副名 NexcoreGraph 写入标题与描述 | `index.html`、`admin.html` |
| Logo | 新 Logo 256px 替换；新增 favicon.ico / apple-touch-icon-180 / web-app-manifest-192/512 | `assets/img/` |
| 存储 | 键前缀 `tianshu_web_db_*` → `nexcore_web_db_*`；`tianshu_logged_in`/`tianshu_ball` → `nexcore_*`（副作用见 D13） | `js/mockapi.js`、`js/app.js` |
| 实测 | 冒烟检测（headless Edge + CDP，登录态）：标题正确、看板 859 字、19 按钮、0 破图、**异常 0 条** | `tools/smoke_web.py` |
| 工具 | 新增通用冒烟检测脚本与 headless 实例清理脚本 | `tools/smoke_web.py`、`tools/cleanup_headless_edge.py` |

### 第三轮（2026-09-13，迁入 monorepo 并在新位置补齐）

工程迁到 `D:\ProjectFiles\GithubPackage\NexcoreGraph\web\NexcoreGraph_web`（仓库根 `D:\ProjectFiles\GithubPackage\NexcoreGraph`）。新位置的副本是旧版，已就地重做全部品牌改动并复验：

| 类型 | 变更 |
|---|---|
| 品牌 | `index.html` / `admin.html` 标题与描述（含英文名）、页面文案、导出文件名、采购清单文本、README |
| Logo | 新 Logo 256px + favicon.ico + apple-touch-icon-180 + web-app-manifest-192/512；页面新增 `favicon` / `apple-touch-icon` / `theme-color` 链接 |
| 资产清单 | `assets/manifest.json` 增补 brand 段（中英文名、徽标描述、色板、品牌文件列表） |
| 存储键 | `tianshu_web_*` → `nexcore_web_*`（含登录态与 AI 球位置） |
| 文档 | `docs/` 下放本整改文档 |
| 验证 | 冒烟检测（登录态、1600×1000）：标题正确、看板 907 字、19 按钮、0 破图、**异常 0 条** |

## 附录 B 术语

| 术语 | 含义 |
|---|---|
| Agent Trace | 一次 AI 请求的执行轨迹可视化（意图 → 检索 → 生成 → 工具 → 确认） |
| 快答 | 命中本地规则的零模型调用回答 |
| 证据块 | 代码查询得到的事实行，注入模型上下文（≤30 条、带来源） |
| 红线 | AI 行为三原则（数值由代码产出、写操作先预览、单请求 ≤2 次模型调用） |
