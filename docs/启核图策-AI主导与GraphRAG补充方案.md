# 启核图策 NexcoreGraph · AI 主导与 GraphRAG 补充方案

> 版本：v1.0（规划稿，**尚未实现**）｜日期：2026-09-15｜适用：鸿蒙端 / Web 端 / 微信小程序端 / 安卓端 / Qt 桌面端 / 后端
> 定位：对《启核图策 · 项目完整文档》与三份《赛道专项整改与验收文档》的**补充方案**，不替代既有文档；冲突处以本文为准并回写原文档（见附录 A）。
> 一句话：**为每个用户自己的库构建个人资源知识图谱，用它驱动 GraphRAG；并把 AI 从"辅助面板"提升为"应用主体"。**

## 目录

- 第 1 章 总纲：AI 主体化与 GraphRAG 的定位
- 第 2 章 总体架构与 AI 主体化
- 第 3 章 知识图谱设计
- 第 4 章 GraphRAG 检索与查询编排
- 第 5 章 数据契约与接口
- 第 6 章 后端与 AI 网关改造
- 第 7 章 鸿蒙端改造（主力端）
- 第 8 章 Web 端改造（用户端 + 管理员端）
- 第 9 章 微信小程序端改造
- 第 10 章 安卓端改造
- 第 11 章 Qt 桌面端改造
- 第 12 章 里程碑排期与验收
- 第 13 章 风险登记与决策项
- 附录 A 需回写的既有文档
- 附录 B 降级预案与演示话术
- 附录 C 术语

---

# 第 1 章 总纲：AI 主体化与 GraphRAG 的定位

## 1.1 为什么需要这份补充方案

| 维度 | 现状（诚实口径） | 代码证据 |
|---|---|---|
| AI 的位置 | **辅助面板**：悬浮球 / 独立 tab，用户主动打开才有 AI | 鸿蒙 `store.aiOpen`、`pages/AiPanel.ets`；Web `ai-ball`；小程序 `pages/chat` |
| AI 的职责 | 回答问题 + 产出预览卡（写操作需用户点确认） | `common/AiGateway.ets`、`Router.directAnswer()` |
| 检索 | **关键字/倒排的轻量 RAG**：名称与别名精确命中 + 2-gram 倒排打分，无向量、无图 | `common/KnowledgeIndex.ets` |
| 知识范围 | 通用知识库（41 食材 / 16 菜谱 / 10 规则）+ 当前离线库存摘要（≤30 行） | `knowledge/*.json`、`Router.evidenceFor()` |
| 主动性 | 零。所有 AI 交互都由用户发起（唯一"主动"是服务卡片定时刷新） | `EntryFormAbility` |
| 三端一致性 | 意图集合与工具协议同构 | Web `js/ai.js`、小程序 `services/ai.ts`、鸿蒙 `Router.ets` |

**结论**：AI 目前在**交互上是被动的**、在**数据上是无结构的**（每次问答都从扁平列表现拼证据）。本方案同时解决这两点。

## 1.2 目标

1. **数据侧**：为"用户当前库"构建**个人资源知识图谱**（实例层 + 概念层 + 跨层边），支持增量重建；
2. **检索侧**：在图谱上实现 **GraphRAG**（local search / global search / multi-hop），回答可给出**推理路径与来源**；
3. **交互侧**：把 AI 提升为**主体**——默认首屏就是 AI、由 AI 编排多步动作、由 AI 主动发起事项，五端一致；
4. **不破坏既有验收红线**（数值由代码产出 / 写操作先预览 / 单请求 ≤2 次模型调用）。

## 1.3 AI 主体的四条判据

| # | 判据 | 反面（现状） | 落地要求 |
|---|---|---|---|
| A1 | **AI 是入口** | AI 藏在悬浮球里，功能页才是主角 | 默认首屏 = AI 工作台；功能页降级为"AI 的输出落地页/详情页" |
| A2 | **AI 是编排者** | 一次请求只做一件事，跨表/跨库要靠用户点 | 一次自然语言请求经工具链编排多步动作（查询→规划→改库→加采购），AI 决定顺序，用户只确认结果 |
| A3 | **AI 是发起者** | 只有被问才答 | 基于图谱变化主动发起：临期处置、缺料补货、数量异常、家庭周报；产出进入**待确认动作队列** |
| A4 | **AI 是解释者** | 回答是黑盒文本 | 回答必须带**图谱路径 + 来源（src/url）**，可展开看"AI 怎么得出这个结论" |

## 1.4 不可让渡给模型的东西（边界）

> **AI 主导交互与编排，代码主导事实与权限。**

| 项 | 裁决者 | 说明 |
|---|---|---|
| 数量 / 位置 / 日期 / 价格 | **代码**（图谱节点属性） | 模型不得报数，只能引用证据中的数字（红线 1 不变） |
| 写操作是否生效 | **用户**（预览确认） | 模型只产出意图，端侧白名单校验后由用户点击生效（红线 2 不变） |
| 角色权限 / 只读账号 | **代码** | 只读账号的写意图直接拒绝（F9.2 不变） |
| 模型调用预算 | **代码** | 单次请求 ≤2 次调用（红线 3 不变）；建图与社区摘要**必须离线/异步**（见 4.6） |
| 隐私边界 | **代码 + 用户开关** | 聊天/偏好/图谱默认仅本地，上云需显式开关（见 5.6） |

## 1.5 与三红线的关系（评审必答题）

| 红线 | 被 GraphRAG/AI 主体挑战的点 | 本方案对策 |
|---|---|---|
| 1 数值由代码产出 | 社区摘要天然含"概括性数字" | 摘要只允许引用图谱统计字段（代码已算出），UI 标注"统计由代码计算" |
| 2 写操作先预览 | AI 主动发起会诱导"自动执行" | 主动动作一律进**待确认队列**，执行仍需点击；提供撤销与操作日志 |
| 3 单请求 ≤2 次模型调用 | GraphRAG 的 map-reduce 摘要可能几十次调用 | 建图 **0 次**、社区检测 **0 次**（算法）、摘要**离线批量**、查询期 1 次（≤2） |

## 1.6 从"轻量 RAG"到"GraphRAG"

| 维度 | 现状（轻量 RAG） | 目标（GraphRAG） |
|---|---|---|
| 检索对象 | 知识库条目（概念） | **用户库实例 + 概念 + 关系**（图谱） |
| 检索方式 | 精确名 + 2-gram 倒排 | 精确命中 + **多跳遍历** + 子图抽取 + 社区摘要 |
| 能回答 | "牛奶放几天""鸡蛋在哪" | 上述 + "**下周哪些会浪费、能用它们做什么、还缺什么料**" + "**我家最常浪费的是哪一类**" |
| 证据形态 | 命中行（单条） | **路径**（节点→边→节点…）+ 来源 |
| 成本 | 0 次模型（快答） | 建图 0 次；查询 1 次（快答仍是 0 次） |

**关键设计**：图谱让"事实"从扁平列表变成**带关系的结构**，模型拿到的是"路径证据"而不是"30 行库存"，同等 token 预算下事实密度更高，红线更容易守。

## 1.7 总架构图（目标态）

```
┌──────────────────────── 交互层（AI 是主体）────────────────────────┐
│  AI 工作台（默认首屏）  │  图谱浏览器  │  待确认动作队列  │  主动通知  │
│  鸿蒙 / Web / 小程序 / 安卓 / Qt 五端同构的信息架构与话术           │
└───────────────▲─────────────────────────────────┬─────────────────┘
                │ 自然语言 / 卡片 / 图谱交互        │ 工具调用（预览确认）
┌───────────────┴───────── 编排层（Agent）─────────▼─────────────────┐
│ GraphRAG 编排器：意图 → 图检索 → 证据装配 → 模型措辞 → 工具意图     │
│ 快答 0 次模型 · 常规 1 次 · 上限 2 次 · 全部动作可撤销              │
└───────────────▲─────────────────────────────────┬─────────────────┘
                │ 路径证据（带 provenance）         │ 图查询算子
┌───────────────┴───────── 检索层（Graph）─────────▼─────────────────┐
│ 精确命中 │ 多跳遍历（≤3 跳）│ 子图抽取 │ 社区摘要（离线预计算）      │
└───────────────▲─────────────────────────────────┬─────────────────┘
                │                                  │
┌───────────────┴───────── 事实层（Graph Store）───▼─────────────────┐
│ 用户库实例图（库/物品/成员/方案/消耗/预警/采购）                     │
│ 概念图（食材/菜谱/存放规则/类别）     跨层边：instantiates / usedBy  │
└───────────────▲─────────────────────────────────┬─────────────────┘
                │ 增量重建（0 次模型，确定性）      │ 统计字段（代码计算）
┌───────────────┴───────── 数据源 ─────────────────▼─────────────────┐
│ 端侧本地库（libraries/plans/logs/alerts/shopping）+ knowledge/*.json │
│ 云同步快照（版本号 + 409 冲突二选一）                                │
└───────────────────────────────────────────────────────────────────┘
```

## 1.8 编号体系与阅读路径

| 既有编号 | 含义 | 本方案新增 |
|---|---|---|
| M0–M6 | 端内里程碑（主文档 1.10） | 保留 |
| M-1~M-13 | 鸿蒙端整改项（已落地 M-5/M-7~M-11/M-13） | 保留，作为本方案的事实基座 |
| F1–F10 | 功能需求 | 新增 **F11（图谱）**、**F12（AI 主体化）** |
| X1–X8 | 分布式与安全用例 | 保留；新增 **GX/AX/WX/MX/KX/QX/BG/CT** 用例并回归 X7/X8 |
| — | — | 新增 **G 系列**（图谱/GraphRAG）、**A 系列**（AI 主体化）任务编号 |

| 角色 | 建议阅读顺序 |
|---|---|
| 端负责人（高俊杰） | 第 1–4 章 → 第 5 章 → 第 7 章 → 第 12 章 |
| Web / 小程序（杨欢、查豪霆） | 第 1 章 → 第 5 章 → 第 8–9 章 → 第 12 章 |
| 后端同学 | 第 1 章 → 第 3–6 章 → 第 12 章 |
| 指导老师 / 评委 | 1.3–1.6（主体定义与红线）→ 3.2–3.4（图谱本体）→ 第 12 章 |
| 作品说明 / 答辩取材 | 1.3、1.4、3.7、4.6、12.3 |

---

# 第 2 章 总体架构与 AI 主体化

## 2.1 三个范式转变

| # | 转变 | 现状 | 目标 |
|---|---|---|---|
| P1 | **入口转变**：面板 → 主体 | 首页是看板，AI 是悬浮球 | 首页是 **AI 工作台**；看板成为工作台里的"数据段"，图谱是"结构段" |
| P2 | **检索转变**：扁平证据 → 图路径 | 每问一次从库存现拼 ≤30 行 | 图谱常驻内存，检索返回**路径 + 来源**，token 花在推理而非罗列 |
| P3 | **关系转变**：应答 → 主动 | 用户不点，AI 不动 | **事件驱动的主动 Agent**：库存变化 / 临期跨越 / 采购命中 / 成员操作 → 生成待确认事项 |

## 2.2 五层架构与职责

| 层 | 名称 | 职责 | 是否调用模型 |
|---|---|---|---|
| L4 | 交互层 | AI 工作台、图谱浏览器、动作队列、主动通知 | 否 |
| L3 | 编排层 | GraphRAG 编排器：意图 → 检索 → 证据 → 措辞 → 工具意图 | 是（0~2 次） |
| L2 | 检索层 | 精确命中 / 多跳 / 子图 / 社区摘要 | 否 |
| L1 | 事实层 | 图谱存储（实例图 + 概念图 + 跨层边） | 否（构建 0 次） |
| L0 | 数据源 | 端侧本地库、知识库 JSON、云同步快照 | 否 |

**分层收益**：L0–L2 全部确定性、可单测、可离线；只有 L3 涉及模型，红线校验点收敛到编排器出口一处。

## 2.3 端云职责矩阵

| 能力 | 端侧（默认） | 后端（可选/增强） | 理由 |
|---|---|---|---|
| 图谱构建 | ✅ 主责（确定性、0 成本） | 可选（对账/重建） | 图数据属用户隐私，端侧建图不扩隐私面 |
| 图谱存储 | ✅ 本地 | ✅ MySQL 邻接表 | 端侧离线可用；后端供管理员端与多设备对账 |
| 多跳/子图检索 | ✅ 主责 | ✅ 大库场景 | 端侧 500 节点规模毫秒级 |
| 社区检测 | ✅ 主责（算法，无语义成本） | 可选 | 确定性算法 |
| 社区摘要（LLM） | 触发 | ✅ 主责（集中限流/缓存） | 摘要贵且可复用 |
| 措辞/对话 | 经网关 | ✅ 主责（Key 收敛） | 现状已如此（M-7） |
| 主动事件判定 | ✅ 主责（规则 + 图变化） | ✅ 推送通道 | 端侧感知实时；后端负责跨设备/离线触达 |
| 运营看板 | ❌ | ✅ 主责 | 管理员端职责 F10 |

## 2.4 AI 工作台信息架构（五端一致）

```
┌──────────────────────────────────────────────────────────┐
│ ① AI 摘要条（今日一句话：临期 2 项，建议先消耗小白菜）      │
│ ② 待确认动作队列（AI 已准备，等你点）                       │
│    [调整] 鸡蛋 8 → 5        （确认 / 忽略 / 撤销）          │
│    [购物] 番茄 2 个          （确认 / 忽略）                │
│    [方案] 小白菜三吃（临期优先）（查看 / 执行 / 换一批）     │
│ ③ 图谱入口（本库结构：8 库 / 42 物品 / 12 概念 / 6 社区）    │
│ ④ 对话区（常驻输入，支持语音/拍照；答案带路径与来源）        │
│ ⑤ 快捷指令 chips（今日吃什么 / 盘点 / 本月报告 / 谁改了库存）│
└──────────────────────────────────────────────────────────┘
```

## 2.5 页面级 AI 上下文

| 触发 | 注入的上下文 | 示例提问 |
|---|---|---|
| 打开某库 | `libraryId` + 该库子图 | "这个库还能撑几天""帮我清库存" |
| 打开某物品 | `itemId` + 邻接子图（同库/同类别/相关菜谱） | "这个快过期了做什么""替代品有什么" |
| 打开预警中心 | 预警节点 + 触发路径 | "为什么提醒我""帮我一次性处理" |
| 打开协作工作台 | 成员子图 + 最近操作 | "谁改了鸡蛋""上周谁最活跃" |

> 实现：端侧维护 `AiContext` 单例（当前页面/选中对象/时间窗），编排器组装证据时自动并入，用户无需复述上下文。

## 2.6 主动 Agent：事件源与动作

| 事件源（代码判定，0 次模型） | AI 产出（1 次模型，可缓存） | 用户可见 |
|---|---|---|
| 物品进入临期（≤7 天） | 处置建议 + 候选方案（临期优先） | 工作台队列 + 卡片/推送 |
| 同类别临期 ≥3 项 | 社区摘要式洞察（"本周冰箱主题：绿叶菜"） | 摘要条 / 周报 |
| 采购命中已有库存 | 拦截说明 + 消耗替代方案 | 工作台队列 |
| 数量异常（同名两边矛盾） | 冲突解释 + 建议数量 | 冲突卡（复用 409 语义） |
| 家庭日志出现新成员操作 | 变更摘要 | 成员动态卡 |
| 每周固定时点 | **家庭资源周报**（图谱统计 + 社区摘要） | 月报卡片 / 分享海报 |

## 2.7 度量：怎么证明"AI 是主体"

| 指标 | 定义 | 目标值 | 采集方式 |
|---|---|---|---|
| AI 首屏到达率 | 冷启动后停留在 AI 工作台的比例 | ≥70% | 本地埋点（不采集个人数据） |
| AI 发起占比 | AI 主动事项数 / 全部 AI 交互数 | ≥30% | 动作队列统计 |
| 主动事项采纳率 | 被确认执行的主动事项 / 主动事项总数 | ≥40% | 队列事件 |
| 图谱证据覆盖率 | 回答中含路径证据的比例 | ≥80% | 编排器埋点 |
| 快答命中率 | 0 次模型回答 / 全部问答 | ≥60%（既有目标） | `/api/ai/usage` |
| 红线违规数 | 数值不符 / 未确认写入 / 超预算 | **0** | 自动化回归 |
| 单请求成本 | tokens / 次（含缓存命中） | 较现状 ≤-20% | 网关用量 |

## 2.8 降级与离线（AI 主体不等于单点故障）

| 故障 | 降级行为 |
|---|---|
| 无网 | 快答 + 图谱检索 + 方案生成全部可用（0 次模型）；模型类问题提示"离线，先给你事实" |
| 网关未配置 Key | 同上（现状已实现：503 → 端侧回退本地快答） |
| 图谱未构建完成 | 回退到现状的"证据行"装配（兼容路径保留 ≥1 个版本） |
| 模型超时/失败 | 主→备模型；仍失败则返回图谱路径证据 + 提示重试 |
| 端侧内存吃紧 | 图谱降级为只加载"当前库 + 邻接 1 跳" |

---

# 第 3 章 知识图谱设计

## 3.1 设计目标与明确不做的事

**做**：
- 为**用户当前库**构建个人资源图谱（实例层），并与通用知识库（概念层）用跨层边连通；
- 支撑 GraphRAG 三种检索模式（local / global / multi-hop）；
- 回答可给出**路径 + 来源**，且数值 100% 来自图谱属性。

**不做（避免过度设计）**：
- 不引入图数据库（Neo4j 等）：规模 ≤500 节点 / ≤3000 边，邻接表足够；
- 不做 LLM 实体关系抽取建图：实例侧全部**确定性抽取**（0 次模型）；
- 不做在线 map-reduce 摘要：社区摘要**离线预计算**（红线 3）；
- 不做端侧 embedding（列为 P2 可选增强，见 3.8）。

## 3.2 节点类型（本体）

| 层 | 节点 | 关键属性 | 来源 |
|---|---|---|---|
| 组织 | `Family` | id, name, memberCount | `store.family` |
| 组织 | `Member` | name, role, lastActive | `store.stats.activity` / 后端成员表 |
| 组织 | `Library` | id, name, icon, tone, count | `store.libraries` |
| **实例** | `ItemInstance` | id, no, name, qty, unit, price, priceSrc, expDays, pos, isPrivate, updatedAt | `Library.items` |
| **实例** | `Plan` | id, title, time, status, kcal, source | `store.plans` |
| **实例** | `ShoppingItem` | name, qty, source | `store.shopping` |
| **实例** | `Alert` | id, kind, title, at | `store.alerts` |
| **实例** | `LogEvent` | action, detail, at, day | `store.logs` |
| **实例** | `MemberAction` | who, count | `stats.activity` |
| 概念 | `FoodConcept` | key, name, category, unit, fridgeDays, pantryDays, openedDays, lowAt, tip, src, url | `knowledge/foods.json` |
| 概念 | `RecipeConcept` | name, time, kcal, tags | `knowledge/recipes.json` |
| 概念 | `RuleConcept` | id, text, src, url | `knowledge/storage-rules.json` |
| 概念 | `CategoryConcept` | name（蛋奶/蔬菜/水果/肉禽/药品/家电/衣物…） | foods.category + 库类型 |

## 3.3 边类型

| 边 | 语义 | 方向 | 属性 |
|---|---|---|---|
| `contains` | 库包含物品 | Library → ItemInstance | — |
| `belongsTo` | 物品/方案归属家庭 | X → Family | — |
| `locatedAt` | 物品位置（文本归一化） | ItemInstance → Library(+pos) | pos 文本 |
| `instantiates` | **实例 ↔ 概念**（跨层核心边） | ItemInstance → FoodConcept | 置信度：exact/alias/manual/unlinked |
| `inCategory` | 概念/物品归类 | X → CategoryConcept | — |
| `usedBy` | 概念被菜谱使用 | FoodConcept → RecipeConcept | qty 文本、是否主料 |
| `cooksTo` | 方案由菜谱/创意生成 | Plan → RecipeConcept | 含 `aiGenerated` 标记 |
| `consumes` | 方案消耗物品 | Plan → ItemInstance | 数量、是否临期时消耗 |
| `consumedBy` | 消耗事件（核销/自然语言改数量） | LogEvent/MemberAction → ItemInstance | delta |
| `triggers` | 阈值触发预警 | FoodConcept/ItemInstance → Alert | 命中规则（低库存/临期档） |
| `protects` | 存放规则约束某类概念 | RuleConcept → FoodConcept/CategoryConcept | 关键词命中 |
| `needs` | 方案缺料 → 采购项 | Plan → FoodConcept → ShoppingItem | — |
| `editedBy` | 成员操作留痕 | LogEvent → Member | — |
| `relatedTo` | 同类/替代/同场景弱关联 | X → X | 权重 |

## 3.4 跨层边的价值（GraphRAG 的关键）

只有连通实例层与概念层，才能回答"**我家的**鸡蛋 →（instantiates）→ 鸡蛋 →（usedBy）→ 番茄炒蛋 →（needs）→ 我缺番茄"这类问题。这条路径同时服务"清库存"和"补货"两个业务目标，是图谱相对扁平检索的核心增量。

## 3.5 构图流水线（全部 0 次模型）

```
① 抽取 Extract
   实例：libraries/plans/shopping/alerts/logs/activity → 节点 + 边
   概念：knowledge/*.json → 节点 + 边
② 归并 Resolve
   实例名 → 概念：精确名 → 去前后缀/别名（鲜/生/土、西红柿→番茄）→ 未命中挂"未归类"占位
   位置归一：冷藏区上层 / 冰箱·冷藏区 → canonical = 库 + 区 + 层
③ 社区 Community（确定性算法）
   一级社区 = 库；二级社区 = 类别；三级社区 = 场景（食材/药品/家电/衣橱/清洁）
   社区属性：节点数、临期数、金额、近 7 天消耗、健康度
④ 打分 Score（排序用，非模型）
   临期分 expScore = f(expDays)；消耗热度 heat = 近 30 天消耗次数；金额分 valueScore
⑤ 摘要 Summarize（唯一调用模型的环节，离线批量，见 4.6）
   每社区 1 条"社区洞察"（≤80 字），落本地缓存 + 后端表
⑥ 版本 Version
   graphVersion = hash(libraries + plans + logs + alerts + shopping + kbVersion)
```

**触发时机**：启动、入库确认、方案执行/撤销、数量变更、库增删改、同步拉取、摘要到期（每 24h）。

## 3.6 各端存储

| 端 | 存储 | 结构 | 规模上限 |
|---|---|---|---|
| 鸿蒙 | `Preferences`（图 JSON）+ 内存邻接表 | `{version, nodes[], edges[], communities[], summaries[]}` | ≤200KB |
| Web | localStorage（阶段 1）→ IndexedDB（阶段 2） | 同上 | ≤2MB |
| 小程序 | Storage（字段字典化压缩） | 同上（键名缩写） | ≤400KB |
| 安卓 | Room（nodes / edges / communities / summaries） | 关系表 + DAO | ≤5MB |
| Qt | SQLite（同安卓四表） | SQL + 内存图 | ≤20MB |
| 后端 | MySQL 邻接表（见 6.2） | `graph_nodes/edges/communities/summaries/versions` | 按家庭分片 |

## 3.7 可视化与创新点口径

| 端 | 形态 | 交互 |
|---|---|---|
| 鸿蒙 | Canvas 分层视图（库→物品→概念，默认 2 层折叠） | 点节点问 AI；长按看路径；社区着色 |
| Web 用户端 | 阶段 1 内联 SVG 分层图；阶段 2 ECharts `graph` 力导向 | 缩放/过滤/私有隐藏；点节点展开"路径 + 来源" |
| 管理员端 | 大屏图谱 + 运营指标 | **匿名聚合**（不含个人物品明细） |
| 小程序 | canvas 2d 轻量（≤60 节点，默认按社区聚合） | 点击展开社区 |
| 安卓 | Compose Canvas 力导向 | 同鸿蒙 |
| Qt | QML 大屏力导向 / 放射布局 | 全屏轮播、导出 PNG |

**可直接用于作品说明的创新点表述**

- **个人资源知识图谱**：不是通用知识图谱，而是**以用户当前库为事实源**、与通用知识库跨层连通的实例图谱，随每次入库/消耗自动增量重建（0 次模型成本）。
- **离线优先的 GraphRAG**：把最贵的"社区摘要"放到离线批量，查询期保持"快答 0 次 / 常规 1 次 / 上限 2 次"，在守住 AI 红线的前提下拿到图检索能力。
- **可解释的 AI 主体**：每条回答都能展开成"图谱路径 + 来源机构"，AI 主导交互但绝不主导事实。
- **图谱即世界模型**：AI 的主动性来自图谱事件（临期跨越、库存矛盾、缺料），而不是定时轮询文案。

## 3.8 可选增强（P2，明确不阻塞主线）

| 增强 | 价值 | 成本 | 建议 |
|---|---|---|---|
| 向量混合检索（embedding + 余弦） | 模糊语义查询（"有点酸的东西"） | 需 embedding 服务或端侧模型 | 省赛后评估；如做则仅对 `FoodConcept` / `RecipeConcept` 离线向量化 |
| 端侧小模型（离线识别/语义） | 零延迟、隐私更佳 | 体积与元服务限制冲突 | 仅应用包形态评估 |
| 图神经网络打分 | 排序更精准 | 数据量不足 | 不建议 |
| LLM 建图（真 GraphRAG 抽取） | 处理非结构化文本（说明书/发票） | 每份文档多次调用、口径漂移 | 仅在"导入说明书/保修单"场景局部使用，结果需人工确认 |

---

# 第 4 章 GraphRAG 检索与查询编排

## 4.1 检索算子（0 次模型）

| 算子 | 语义 | 复杂度 | 用途 |
|---|---|---|---|
| `matchEntity(q)` | 名称/别名精确 → 节点 id | O(n) 词典 | "鸡蛋""牛奶" |
| `neighbors(id, hops=1)` | 1 跳邻域 | O(deg) | "鸡蛋放哪" |
| `multiHop(seed, edges[], maxHops=3)` | 受限边类型多跳 | 剪枝 BFS | "临期食材能做什么、还缺什么" |
| `subgraph(filter)` | 过滤子图（库/类别/临期/私有） | O(n+e) | 图谱页筛选、私有物品排除 |
| `aggregate(community, metric)` | 社区统计（数量/金额/临期/消耗） | O(n) | global search 事实、周报 |
| `temporal(window)` | 时间窗事件（近 7/30 天） | O(logs) | "这周谁动了什么""浪费趋势" |
| `communityOf(id)` | 节点所属社区链 | O(1) | global search 入口 |

**检索预算**：单次 GraphRAG ≤3 跳、返回路径 ≤5 条、证据行 ≤12 行（比现状 30 行更省，但信息密度更高）。

## 4.2 模式判定（代码规则，0 次模型）

| 提问特征 | 模式 | 示例 |
|---|---|---|
| 命中实体名 + 单个事实词（在哪/多少/几天） | **快答（0 次）** | "鸡蛋放哪""牛奶还能放几天" |
| 命中实体 + 关联/用途/替代 | **local search（1 次）** | "快过期的鸡蛋能做什么" |
| 无实体但含全局词（这周/最常/整体/家里） | **global search（1 次，用社区摘要）** | "我家最常浪费的是什么" |
| 含多条件（临期 + 缺料 + 人数/忌口） | **multi-hop（1 次，必要时 2 次）** | "用临期食材做 4 人减脂晚餐，缺什么一起去买" |
| 写操作（改数量/加采购/执行方案） | **工具意图（0~1 次）** | "鸡蛋只剩 5 个" |

## 4.3 local search 时序

```
① 实体识别（词典精确匹配，命中 ItemInstance 与 FoodConcept）
② 邻域抽取：neighbors(item,1) ∪ usedBy(food) ∪ needs(plan)   （≤12 行证据）
③ 路径打分：临期优先 > 消耗热度 > 金额
④ 证据装配：每行 = 路径 + 事实 + 来源（src/url）
⑤ 模型 1 次（措辞 + 可选工具行）
⑥ 端侧校验工具行（白名单 + 库存回查）→ 预览卡
```

## 4.4 global search 时序

```
① 取相关社区（关键词命中社区标签；未命中取 Top3 社区）
② 读社区摘要（stale 则回退 aggregate 实时统计，不调模型）
③ 拼装：社区事实（代码算）+ 摘要（离线生成）
④ 模型 1 次（把统计与摘要组织成 2-3 句 + 1 条建议）
⑤ UI 标注"统计由代码计算、摘要基于 X 分钟前图谱"
```

## 4.5 multi-hop 时序（写操作场景）

```
问题："用临期食材做 4 人减脂晚餐，缺什么一起去买"
① 子图：临期物品（expDays ≤ 3 或 ≤ 7）
② 2 跳：ItemInstance →(instantiates)→ FoodConcept →(usedBy)→ RecipeConcept（按 tag 过滤：低卡/清库存）
③ 过滤：家庭偏好（人数/忌口，来自 Profile，可关闭）
④ 3 跳：RecipeConcept →(usedBy 反向)→ 缺失 FoodConcept → needs → ShoppingItem 候选
⑤ 模型 1 次（生成方案说明 + [菜] 工具行 + [购物] 工具行）
⑥ 端侧回查库存落 Plan、加采购清单（仍需预览确认）
```

## 4.6 社区摘要：离线预计算（守住红线 3）

| 项 | 设计 |
|---|---|
| 何时跑 | 社区结构变化（成员/物品跨库移动）+ 距上次 ≥24h + 用户手动刷新；**不在对话请求内** |
| 跑几次 | 每社区 1 次调用；全局串行 + 限流（默认每 10 分钟 ≤3 次） |
| 存哪里 | 本地 `summaries[]`（含 `generatedAt`、`basedOnVersion`）+ 后端 `graph_summaries` |
| 失效 | `graphVersion` 变化 → 标记 stale，UI 显示"摘要更新中"；**stale 摘要不参与回答**（防旧数据误导） |
| 内容约束 | 只允许引用 `aggregate()` 已算出的数字；提示词明写"不得新增数字" |
| 成本 | 每天 ≤ 社区数（示例 6）× 1 次 ≈ 6 次/天/家庭，与对话调用解耦 |

## 4.7 图谱与 GraphRAG 评测指标

| 指标 | 定义 | 目标 |
|---|---|---|
| 构图正确率 | 实例→概念边正确的比例（人工抽查 50 条） | ≥95% |
| 路径有效性 | 返回路径每条都真实存在于图谱且事实正确 | 100% |
| 多跳答案可用率 | 3 跳内给出可执行方案（含缺料/采购）的比例 | ≥85% |
| 社区摘要新鲜度 | stale 摘要参与回答的比例 | 0% |
| 构图耗时 | 500 物品全量重建 | ≤300ms（端侧） |
| 检索耗时 | 1 跳 / 3 跳子图 | ≤20ms / ≤80ms |
| 红线回归 | 数值不符 / 未确认写入 / 超预算 | **0** |

---

# 第 5 章 数据契约与接口

> 本章是**五端唯一的图契约来源**。任一端改动必须同步本章，禁止各端自造字段。

## 5.1 图谱 JSON（端侧通用持久化格式）

```jsonc
{
  "schema": 1,
  "version": "gv-7f3a91",
  "builtAt": 1789000000000,
  "kbVersion": "1.0",
  "nodes": [
    {
      "id": "item:egg-1", "type": "ItemInstance", "label": "鸡蛋",
      "props": { "libId": "fridge", "qty": 8, "unit": "个", "expDays": 3,
                 "pos": "冷藏区中层", "price": 15.9, "priceSrc": "拍照识别",
                 "isPrivate": true, "no": "NO-0001", "updatedAt": 1789000000000 },
      "community": ["lib:fridge", "cat:蛋奶", "scene:食材"]
    },
    {
      "id": "food:egg", "type": "FoodConcept", "label": "鸡蛋",
      "props": { "key": "egg", "category": "蛋奶", "unit": "个", "fridgeDays": 35,
                 "openedDays": -1, "lowAt": 5, "tip": "勿清洗后存放，大头朝上",
                 "src": "中国营养保健食品协会 / 上海市卫健委",
                 "url": "https://www.cnhfa.org.cn/kpfx/kpwzqt/show/10565" }
    },
    {
      "id": "plan:3", "type": "Plan", "label": "番茄炒蛋",
      "props": { "id": 3, "time": "10 分钟", "status": "pending", "kcal": 542,
                 "source": "AI 创新菜谱（AI 生成）" }
    }
  ],
  "edges": [
    { "id": "e1", "from": "lib:fridge", "to": "item:egg-1", "type": "contains", "props": {} },
    { "id": "e2", "from": "item:egg-1", "to": "food:egg", "type": "instantiates",
      "props": { "confidence": "exact" } },
    { "id": "e3", "from": "food:egg", "to": "recipe:番茄炒蛋", "type": "usedBy",
      "props": { "qty": "3 个", "primary": true } },
    { "id": "e4", "from": "plan:3", "to": "item:egg-1", "type": "consumes",
      "props": { "qty": 3, "wasExpiring": true } },
    { "id": "e5", "from": "item:egg-1", "to": "alert:91", "type": "triggers",
      "props": { "rule": "lowAt", "threshold": 5 } }
  ],
  "communities": [
    { "id": "lib:fridge", "level": 1, "label": "冰箱",
      "stats": { "items": 12, "expiring": 3, "value": 128.6, "consume7d": 5, "health": 75 } },
    { "id": "cat:蛋奶", "level": 2, "label": "蛋奶", "stats": { "items": 4, "expiring": 1 } },
    { "id": "scene:食材", "level": 3, "label": "食材", "stats": { "items": 20, "expiring": 4 } }
  ],
  "summaries": [
    { "community": "lib:fridge",
      "text": "冷藏区本周主题是绿叶菜，已有 2 项进入 3 天内临期；蛋奶类库存偏高。",
      "generatedAt": 1789000000000, "basedOnVersion": "gv-7f3a91", "model": "agnes-2.0-flash" }
  ],
  "index": { "byLabel": { "鸡蛋": ["item:egg-1", "food:egg"] },
             "byType": { "ItemInstance": ["item:egg-1"] } }
}
```

**硬约束**

| 约束 | 值 | 原因 |
|---|---|---|
| 节点规模 | ≤500（实例）+ ≤200（概念） | 端侧内存与包体积 |
| 边规模 | ≤3000 | 同上 |
| 路径长度 | ≤3 跳 | 延迟与可解释性 |
| 单条证据行 | ≤120 字符 | token 预算 |
| 图 JSON 体积 | 鸿蒙 ≤200KB / 小程序 ≤400KB / Web ≤2MB / 桌面 ≤20MB | 各端存储上限 |
| 图片 | **不入图**，仅存物品 id 引用 | 体积极大且无检索价值 |

## 5.2 端侧模块 API（跨语言语义一致）

| 函数 | 语义 | 鸿蒙（ArkTS） | Web（TS） | 小程序（TS） | 安卓（Kotlin） | Qt（C++） |
|---|---|---|---|---|---|---|
| `build()` | 全量构图（幂等） | `GraphBuild.rebuild()` | `rebuildGraph()` | `rebuildGraph()` | `GraphRepository.rebuild()` | `GraphEngine::rebuild()` |
| `apply(event)` | 增量更新（单事件） | `GraphBuild.applyEvent()` | `applyGraphEvent()` | 同 | `GraphRepository.apply()` | `GraphEngine::apply()` |
| `query(spec)` | 检索算子 | `GraphQuery.run()` | `queryGraph()` | 同 | `GraphQuery.run()` | `GraphEngine::query()` |
| `summaries()` | 读社区摘要（含 stale） | `GraphStore.summaries()` | `getGraphSummaries()` | 同 | `GraphRepository.summaries()` | `GraphEngine::summaries()` |
| `evidence(spec)` | 组装 GraphRAG 证据 | `GraphRag.evidence()` | `graphEvidence()` | 同 | `GraphRag.evidence()` | `GraphRag::evidence()` |
| `version()` | 当前图版本 | `GraphStore.version()` | `graphVersion()` | 同 | 同 | 同 |

**ArkTS 参考签名（鸿蒙端形态；其余端按上表同语义实现）**

```ts
// common/GraphStore.ets —— 图存储与版本
export function graphVersion(): string;
export function graphSnapshot(): GraphDoc;
export function saveGraph(doc: GraphDoc): void;

// common/GraphBuild.ets —— 构图（0 次模型）
export class GraphBuildStat { nodes: number = 0; edges: number = 0; communities: number = 0; ms: number = 0; }
export function rebuildGraph(): GraphBuildStat;
export function applyGraphEvent(action: string, detail: string): void;

// common/GraphQuery.ets —— 检索算子
export class QuerySpec { mode: string = 'local'; seed: string = ''; hops: number = 1; filters: string[] = []; }
export class GraphPath { nodes: string[] = []; edges: string[] = []; facts: string[] = []; src: string = ''; }
export function runQuery(spec: QuerySpec): GraphPath[];

// common/GraphRag.ets —— GraphRAG 编排（不可用时内部回退 Router.evidenceFor()）
export class RagEvidence { lines: string[] = []; paths: GraphPath[] = []; stale: boolean = false; }
export function ragEvidence(mode: string, question: string): RagEvidence;
```

## 5.3 REST 契约

### 5.3.1 新增 Graph 端点

| 方法 | 路径 | 入参 | 出参 |
|---|---|---|---|
| `POST` | `/api/graph/rebuild` | `{familyId, payload}` | `{ok, version, nodes, edges, communities, ms}` |
| `GET` | `/api/graph/:familyId?level=1&include=stats` | — | `{ok, version, nodes[], edges[], communities[], builtAt}` |
| `POST` | `/api/graph/query` | `{familyId, mode, seed?, hops?, question?, filters?}` | `{ok, paths[], facts[], stale, version}` |
| `POST` | `/api/graph/summaries` | `{familyId, community?, force?}` | `{ok, summaries[], generatedAt}` |

`mode`：`local`（实体邻域）｜`global`（社区摘要）｜`multi-hop`（多跳路径）。

### 5.3.2 扩展 AI 对话（向后兼容）

```jsonc
// POST /api/ai/chat —— 新增可选字段；旧端不传时行为与现状完全一致
{
  "familyId": "home",
  "user": "13800138000",
  "intent": "cook",
  "evidence": "……现有证据行（兼容保留）……",
  "graphEvidence": {
    "version": "gv-7f3a91",
    "mode": "multi-hop",
    "lines": [
      "冰箱·冷藏区中层｜鸡蛋 8个｜3天到期",
      "番茄炒蛋 需鸡蛋 3 个（冰箱·冷藏区中层｜现有 8 个）"
    ],
    "paths": [
      { "nodes": ["item:egg-1", "food:egg", "recipe:番茄炒蛋"],
        "edges": ["instantiates", "usedBy"],
        "facts": ["鸡蛋 8 个，3 天到期", "番茄炒蛋需鸡蛋 3 个"],
        "src": "知识库 · 中国营养保健食品协会" }
    ]
  },
  "question": "用临期食材做 4 人减脂晚餐，缺什么一起去买"
}
```

响应新增字段：

```jsonc
{
  "ok": true,
  "text": "……",
  "model": "agnes-2.0-flash",
  "ms": 1840,
  "tokens": 812,
  "traceId": "ai-1789000000-3f2a",
  "evidenceUsed": ["path:0", "path:2"],
  "warnings": ["summary_stale"]
}
```

### 5.3.3 摘要预计算

推荐**不新增端点**：端侧复用 `/api/ai/chat`，以 `intent: 'community-summary'` 调用，网关侧使用独立限流桶（`familyId:summary`），从而复用既有的超时/降级/留痕链路。

## 5.4 同步契约与隐私分级

| 项 | 现状 | 本方案 |
|---|---|---|
| payload 字段 | `{libraries, alerts, plans, shopping, daily, logs, baseVersion}` | **不变** |
| 图谱是否同步 | — | **默认不同步**：可由 payload + 知识库确定性重建（0 次模型），无需扩同步面 |
| 图版本对账 | — | 上传附带可选 `graphVersion`；不一致仅记日志，不阻塞同步 |
| 摘要是否同步 | — | 可选：独立端点拉取，避免污染库存快照的隐私边界 |
| 冲突语义 | 409 + 用户二选一 | 不变；新增"数量矛盾"图事件用于提示，不改协议 |

| 数据 | 分级 | 是否可上云 | 开关 |
|---|---|---|---|
| 库存 / 方案 / 采购 / 日志 | P1（协同必需） | ✅（现状） | 无（家庭协作必需） |
| 图谱结构（派生数据） | P1'（派生） | 默认 ❌（可重建；管理员端只看匿名聚合） | 家庭级开关 |
| 社区摘要 | P2 | 默认 ❌（本地生成） | 家庭级开关 |
| 聊天 / 偏好 / AI 用量 / 价值账本 | P3（仅本地） | ❌ | 不可开（现状口径） |

## 5.5 错误码与端侧行为

| HTTP | 语义 | 端侧行为 |
|---|---|---|
| 400 | 参数缺失 / 模式非法 | toast 并回退快答 |
| 404 | 该家庭无图谱 | 本地重建后重试一次 |
| 409 | 图谱版本冲突 | 提示"正在重建图谱"并本地静默重建 |
| 429 | 限流 | 降级为图谱事实 + 提示稍后再问 |
| 501 | 摘要 / 模型未配置 | 隐藏摘要区，保留下方统计 |
| 502 | 上游模型失败 | 主→备模型已内建；再失败只回图谱事实 |
| 503 | 后端/DB 不可用 | 端侧本地图继续工作（离线优先） |

## 5.6 契约测试（提交前必跑）

| 用例 | 断言 |
|---|---|
| CT-1 图 JSON 往返 | 五端序列化→反序列化后 `version` 一致、节点/边计数一致 |
| CT-2 跨端同构 | 同一 payload 在鸿蒙与 Web 构图，`nodes/edges` 数量一致（允许私有物品过滤差异） |
| CT-3 旧端兼容 | 不传 `graphEvidence` 调 `/api/ai/chat`，响应与现状逐字段一致 |
| CT-4 红线回归 | 20 条 golden QA：数值全部与库存一致；写操作均需确认；单请求模型调用 ≤2 |
| CT-5 降级 | 图谱缺失 / 摘要 stale / 网关 503 三种场景问答仍可用 |

---

# 第 6 章 后端与 AI 网关改造

> 工程：`harmonyosapp/NexcoreGraph_harmonyos/backend/`（Node.js + Express + MySQL）
> 前提：M-7 已落地（`/api/ai/{chat,vision,tts,usage}`、Key 取环境变量、限流、降级、`ai_usage` 留痕）

## 6.1 改造总览

| 模块 | 现状 | 目标 | 动作 |
|---|---|---|---|
| AI 网关 | ✅ 4 端点 | 接收 `graphEvidence` 并注入路径证据 | 改 `/api/ai/chat` |
| 图谱服务 | ❌ | 图存储 + 重建 + 查询 + 版本 | 新增 `graphService.js` + 4 端点 |
| 图查询算子 | ❌ | 邻域/多跳/子图/聚合（纯算法、可单测） | 新增 `graphQuery.js` |
| 摘要调度 | ❌ | 离线/异步生成社区摘要并落表 | 新增 `summaryScheduler.js` |
| 用量观测 | ✅ `ai_usage` | 增记 `intent=community-summary`、`traceId` | `server.js` 小改 |
| 管理端指标 | 🟡 部分 | 图谱运营指标（匿名聚合） | 新增 `/api/admin/graph/stats` |

## 6.2 表结构（幂等建表，追加至 `initDb()`）

```sql
CREATE TABLE IF NOT EXISTS graph_nodes (
  id          VARCHAR(128) NOT NULL,
  family_id   VARCHAR(64)  NOT NULL,
  type        VARCHAR(32)  NOT NULL,
  label       VARCHAR(128) NOT NULL,
  props       JSON         NULL,
  community   VARCHAR(255) NULL,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id, family_id),
  INDEX idx_family_type (family_id, type),
  INDEX idx_family_community (family_id, community)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graph_edges (
  id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  family_id VARCHAR(64)  NOT NULL,
  from_id   VARCHAR(128) NOT NULL,
  to_id     VARCHAR(128) NOT NULL,
  type      VARCHAR(32)  NOT NULL,
  props     JSON         NULL,
  INDEX idx_from (family_id, from_id, type),
  INDEX idx_to   (family_id, to_id, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graph_communities (
  family_id  VARCHAR(64)  NOT NULL,
  id         VARCHAR(128) NOT NULL,
  level      TINYINT      NOT NULL,
  label      VARCHAR(128) NOT NULL,
  stats      JSON         NULL,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (family_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graph_summaries (
  family_id    VARCHAR(64)  NOT NULL,
  community    VARCHAR(128) NOT NULL,
  text         VARCHAR(512) NOT NULL,
  model        VARCHAR(64)  NULL,
  based_on     VARCHAR(64)  NULL,
  generated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (family_id, community)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS graph_versions (
  family_id VARCHAR(64) PRIMARY KEY,
  version   VARCHAR(64) NOT NULL,
  nodes     INT DEFAULT 0,
  edges     INT DEFAULT 0,
  built_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

> 选型说明：**不引入图数据库**。规模 ≤500 节点 / ≤3000 边，邻接表 + 索引足够；避免为演示项目增加部署依赖（与《完整文档》"不为 Agent 而 Agent"同一取向）。

## 6.3 服务模块划分

| 文件 | 职责 | 可单测 |
|---|---|---|
| `server.js` | 入口：路由注册 + 启动（DB 不可用时降级为"仅 AI 网关"模式） | — |
| `graphService.js` | 图 CRUD：重建 / 读取 / 版本；事务写入 | 是 |
| `graphQuery.js` | 检索算子：`neighbors` / `multiHop` / `subgraph` / `aggregate` | ✅ 纯函数 |
| `summaryScheduler.js` | 摘要预计算：触发判定 + 串行 + 缓存 + stale | 是 |
| `aiGateway.js` | 从 `server.js` 抽出 AI 调用与提示词装配 | ✅ 纯函数 |

## 6.4 端点实现要点

| 端点 | 要点 |
|---|---|
| `POST /api/graph/rebuild` | 复用同步 payload；**事务**写入（先删该家庭旧图，再按 500 行/批插入）；单家庭节点上限 500，超出截断并返回 `truncated`；重建期间查询走旧版本（双缓冲） |
| `GET /api/graph/:familyId` | 支持 `level` 过滤与 `include` 白名单，避免一次吐全图 |
| `POST /api/graph/query` | **纯算法、不调模型**；强制 `hops ≤ 3`、`limit ≤ 50`；返回路径 + facts + 版本；`stale` 摘要不返回 |
| `POST /api/graph/summaries` | 串行执行 + 每家庭 ≤3 次/10 分钟；`(family_id, community, based_on)` 命中即复用；`force=true` 才重算 |
| `POST /api/ai/chat`（扩展） | 带 `graphEvidence` 时拼入"图谱证据"块并追加输出规则；返回 `traceId`/`evidenceUsed`/`warnings` |
| `GET /api/admin/graph/stats` | 匿名聚合：家庭数、平均节点/边/社区数、摘要命中率、路径引用率；**不含物品明细** |

## 6.5 提示词装配（GraphRAG 版）

在现有 `buildChatSystemPrompt()` 的证据块后追加：

```text
【图谱证据】以下每条都来自该家庭自己的库存图谱，括号内是推理路径：
1. 冰箱·冷藏区中层｜鸡蛋 8个｜3天后到期   (路径: 我家的鸡蛋 → 鸡蛋(食材) → 番茄炒蛋)
2. 番茄炒蛋需鸡蛋 3 个，当前库存 8 个        (路径: 番茄炒蛋 → 鸡蛋)
3. 缺料：虾仁（虾仁蒸蛋需要，当前无库存）    (路径: 虾仁蒸蛋 → 虾仁)

输出规则（在原有 1-5 条基础上追加）：
6. 引用图谱事实时必须保留对象名与数字，不得改写数量；
7. 证据不足时直接说明缺少哪条事实，不要推测；
8. 多步动作按"查询 → 方案 → 写操作"顺序输出工具行，每条工具行独占一行。
```

## 6.6 摘要预计算调度

| 项 | 设计 |
|---|---|
| 触发 | ① 端侧调用（用户打开工作台且摘要 stale）；② 可选定时任务（每日 08:00 为活跃家庭生成） |
| 并发 | 全局串行；每家庭 ≤3 次/10 分钟（限流桶键 `familyId:summary`，与对话桶隔离） |
| 幂等 | `(family_id, community, based_on)` 命中即跳过 |
| 失败 | 记 `ai_usage(source='summary')`，最多重试 2 次；UI 显示"暂无摘要"而非报错 |
| 成本控制 | 仅对"节点数 ≥3 且近 7 天有变化"的社区生成；单家庭每日上限默认 8 条 |

## 6.7 红线对齐（后端责任）

| 红线 | 后端责任 | 测试方式 |
|---|---|---|
| 数值由代码产出 | 图查询返回的 `facts` 全部取自 DB 字段；提示词显式禁止造数 | CT-4：断言回答中的数字集合 ⊆ 证据数字集合 |
| 写操作先预览 | 后端**不提供任何写端点**，只返回文本 + 工具行 | 端点白名单审查 |
| 单请求 ≤2 次调用 | `/api/ai/chat` 内主+备模型 ≤2 次；摘要走独立端点与独立限流桶 | 单元测试统计调用次数 |

## 6.8 迁移与兼容

1. **纯追加**：新增表与端点，不改既有端点签名；`/api/ai/chat` 新字段均可选。
2. **旧端不变**：不传 `graphEvidence` 时提示词与响应与当前完全一致（CT-3）。
3. **DB 不可用**：沿用 M-7 降级——服务照常启动、`/api/ai/*` 可用；`/api/graph/*` 返回 503，端侧继续用本地图。
4. **回滚**：图谱端点可整体下线，端侧回退到"证据行"装配，保留 ≥1 个版本兼容期。

## 6.9 后端验收

| 编号 | 用例 | 期望 |
|---|---|---|
| BG-1 | 上传 8 库 / 40 物品 payload → `rebuild` | 200，返回节点/边/社区计数，`graph_versions` 落库 |
| BG-2 | 同一 payload 重建两次 | 幂等：计数一致、无重复边 |
| BG-3 | `query` multi-hop（临期→菜谱→缺料） | 返回 ≥2 条路径，路径节点均存在于图 |
| BG-4 | `summaries` 生成后再调 | 首次 1 次模型/社区；二次命中缓存 0 次调用 |
| BG-5 | 摘要基于旧版本 | `stale=true`，端侧不采用 |
| BG-6 | 不传 `graphEvidence` 调 chat | 响应与现状逐字段一致 |
| BG-7 | 并发 10 个家庭请求摘要 | 全部成功且未超限，`ai_usage` 可审计 |
| BG-8 | 停掉 MySQL 后调 `/api/ai/chat` | 仍可回答（降级模式） |

---

# 第 7 章 鸿蒙端改造（主力端）

> 工程：`harmonyosapp/NexcoreGraph_harmonyos/entry`｜API 基线：compileSdk/targetSdk `6.1.0(23)`（API 26 特性仅作预览标注）

## 7.1 现状（改造起点）

| 维度 | 现状 | 位置 |
|---|---|---|
| AI 入口 | 悬浮球 / `store.aiOpen`，非首屏 | `pages/Index.ets`、`pages/AiPanel.ets` |
| 首屏 | 看板（KPI + 图表 + 临期 + 摘要） | `pages/DashboardView.ets` |
| 检索 | 证据行 ≤30 条 + 知识库命中 | `common/Router.ets`、`common/KnowledgeIndex.ets` |
| 模型调用 | 经网关（M-7 已落地） | `common/AiGateway.ets`、`common/Backend.ets` |
| 卡片 | 4 张，数据来自本地快照（M-5 已落地） | `entryformability/EntryFormAbility.ets`、`pages/card/*` |
| 语音 | ASR 占位降级；TTS 走网关 + AVPlayer（元服务限制，已实测） | `common/Asr.ets`、`common/Tts.ets` |
| 形态约束 | 元服务 atomicService，installedFree，包 ≤10MB | `AppScope/app.json5` |

## 7.2 目标形态：Tab 重排（AI 优先）

| 顺序 | Tab | 变化 |
|---|---|---|
| 0 | **AI 工作台**（新） | 摘要条 + 待确认队列 + 图谱入口 + 常驻对话 + 快捷 chips；看板作为其中"数据段" |
| 1 | 资源库 | 不变；新增页面级"问 AI"入口 |
| 2 | 图谱（新） | 分层图谱 + 社区筛选 + 点节点问 AI |
| 3 | 协作工作台 | 不变；新增"谁改了什么"图谱化事件流 |
| 4 | 我的 | 新增"图谱与 AI 主体"分区（开关 + 摘要刷新 + 图规模） |

## 7.3 改造清单（文件级）

| 文件 | 类型 | 职责 |
|---|---|---|
| `common/GraphModel.ets` | 新增 | 节点/边/社区/摘要类型（对齐第 5.1 节） |
| `common/GraphBuild.ets` | 新增 | 确定性构图（0 次模型）、增量事件、版本 hash |
| `common/GraphStore.ets` | 新增 | Preferences 持久化、快照、stale 判定 |
| `common/GraphQuery.ets` | 新增 | `matchEntity/neighbors/multiHop/subgraph/aggregate` |
| `common/GraphRag.ets` | 新增 | 证据装配（路径 + 来源）；不可用时回退 `Router.evidenceFor()` |
| `common/GraphSummary.ets` | 新增 | 摘要预计算触发（限流、串行、缓存） |
| `common/AiContext.ets` | 新增 | 页面级上下文单例 |
| `common/AiGateway.ets` | 改动 | 请求体新增 `graphEvidence`；解析 `traceId/evidenceUsed/warnings` |
| `common/Api.ets` | 改动 | 写操作后调用 `applyGraphEvent()`；方案执行写入 `wasExpiring` |
| `pages/AiWorkbench.ets` | 新增 | AI 首屏（复用 AiPanel 对话能力） |
| `pages/GraphView.ets` | 新增 | Canvas 分层图谱 + 社区着色 + 点节点问 AI |
| `pages/Index.ets` | 改动 | Tab 重排；默认停在 AI 工作台 |
| `pages/Overlays.ets` | 改动 | 设置页新增"图谱与 AI 主体"分区 |
| `entryformability/EntryFormAbility.ets` | 改动 | 快照新增"AI 洞察"字段（摘要条一句话） |
| `pages/card/*.ets` | 改动 | 卡片文案改 AI 视角；点击直达 AI 工作台 |

## 7.4 性能与容量预算

| 项 | 预算 | 说明 |
|---|---|---|
| 图谱内存 | ≤8MB（500 节点/3000 边） | 平坦数组 + Map 索引，避免深拷贝 |
| 全量重建 | ≤300ms | `aboutToAppear` 后延迟执行，不阻塞首帧 |
| 增量更新 | ≤5ms/事件 | 只改受影响邻接表 |
| 图谱绘制 | ≥55fps | Canvas 单层 + 视口裁剪 + 节点上限 60（超出按社区聚合） |
| 包体积 | 元服务包 ≤10MB | 图谱是运行时产物不入包；新增代码预估 ≤120KB |

## 7.5 后台任务与系统级智能体

- **后台任务**：用 Deferred Task（`workScheduler`）在充电 + 空闲时预计算社区摘要，避免占用前台对话预算；失败不重试超过 2 次。本期建议只用 deferred，**不新增权限**。
- **分布式延伸**（与 M-1~M-4 同批）：把**图版本 + 变更事件**纳入分布式数据对象会话，A 端改数量 → 事件同步 → B 端**增量构图**（而非全量重建），满足 X2/X3 的"1 秒内一致"。
- **系统级智能体接入**（鸿蒙专属加分项，逐项 POC 后再合入）：

| 能力 | 用途 | API 基线 |
|---|---|---|
| Intents Kit | 声明应用意图（查库存/加采购/看临期），供小艺调用 | API 12+，需确认设备支持 |
| ArkTS script 应用 Skill | 把端内能力暴露给系统智能体 | 较新，按 SDK 实际可用性验证 |
| Agent Framework Kit | 应用内拉起系统智能体组合 | 预览特性，**仅 POC，不进主链路** |
| 服务卡片 + AI 洞察 | 卡片即 AI 输出面 | 已具备（M-5） |

## 7.6 验收用例（鸿蒙端）

| 编号 | 前置 | 步骤 | 期望 |
|---|---|---|---|
| GX1 | 8 库 40 物品 | 冷启动后进入「图谱」页 | ≤1.5s 出图；节点数与库存一致；社区着色正确 |
| GX2 | 同上 | 新库加 3 个物品 | 增量更新 ≤5ms；无需重启应用 |
| GX3 | 鸡蛋 8 个、3 天到期 | 问"用快过期的鸡蛋做什么" | 回答含**路径证据**与来源；数字与库存一致 |
| GX4 | 无网 | 问"冰箱里最该先吃什么" | 图谱事实 + 方案仍可用（0 次模型），提示离线 |
| GX5 | 摘要基于旧版本 | 打开工作台 | 显示"摘要更新中"；stale 摘要不参与回答 |
| GX6 | 500 物品压力数据 | 触发全量重建 | ≤300ms；内存峰值 ≤8MB |
| AX1 | 冷启动 | 观察默认页 | 默认停在 AI 工作台，摘要条有内容 |
| AX2 | 任意 | 说"鸡蛋只剩 5 个" | 进入待确认队列；**未点确认前库存不变**（红线 2） |
| AX3 | 打开某库 | 说"这个库还能撑几天" | 正确解析指代（页面上下文），答案带该库子图证据 |
| AX4 | 卡片已添加 | 点卡片 | 直达 AI 工作台对应上下文 |
| AX5 | 20 条 golden QA | 批量执行 | 数值全部与库存一致；模型调用 ≤2 次/问 |

## 7.7 风险（鸿蒙端）

| 风险 | 等级 | 对策 |
|---|---|---|
| Canvas 图谱低端机掉帧 | 🟠 中 | 节点上限 + 社区聚合 + 视口裁剪；提供列表降级视图 |
| 后台任务配额导致摘要不及时 | 🟡 低 | 摘要非关键路径；前台打开工作台时补算 |
| 系统级智能体能力不可用 | 🟠 中 | 仅作加分项，POC 先行，不阻塞主线 |
| 元服务包体积超限 | 🟠 中 | 图谱运行时生成；新增代码 ≤120KB；构建后跑体积检查 |
| 图谱与证据行双轨口径漂移 | 🟠 中 | `GraphRag` 单点出口 + CT-2/CT-5 契约测试 |

---

# 第 8 章 Web 端改造（用户端 + 管理员端）

> 工程：`web/NexcoreGraph_web/`（现状：免构建原生 HTML/CSS/JS 零依赖；目标：Vue 3 + TS + Vite）

## 8.1 现状

| 维度 | 现状 |
|---|---|
| 形态 | `index.html` + `admin.html` 双入口；`js/{data,knowledge,mockapi,ai,app,admin}.js`；零依赖直开可用 |
| AI 位置 | 悬浮球 + 对话浮层（`ai-ball`），非首屏 |
| AI 层 | `js/ai.js`（意图路由 + 工具协议；模型部分为本地模拟，待接 `/api/ai/chat`） |
| 数据层 | `js/mockapi.js`（localStorage `nexcore_web_db_v2`，接口签名对齐 REST 契约） |
| 管理员端 | `js/admin.js`：用户 / 家庭 / 审计 / AI 用量 / 系统配置 / 知识库（F10） |

## 8.2 两阶段实施路径（关键决策）

> 直接等 Vue3 重构会拖到省赛后，因此分两阶段；阶段 1 在当前零依赖架构内即可演示。

| 阶段 | 形态 | 交付 | 时间 |
|---|---|---|---|
| **阶段 1（省赛前）** | 现架构内新增 `js/graph.js`（IIFE）+ `js/workbench.js` | 构图、GraphRAG 证据、AI 工作台、内联 SVG 分层图谱（不引第三方） | 与第 12 章 G 阶段并行 |
| **阶段 2（省赛后/Vue 重构）** | `src/graph/*.ts` + `views/AiWorkbench.vue` + `views/GraphExplorer.vue` | 模块化、类型安全、ECharts 力导向、SSE 流式 | 收口阶段 |

阶段 1 与阶段 2 **共用同一份契约**（第 5 章），迁移是"搬文件 + 加类型"，不是重写逻辑。

## 8.3 AI 主体化（用户端）

| # | 改造 | 说明 |
|---|---|---|
| W-A1 | 默认首屏 = AI 工作台 | 摘要条 + 待确认队列 + 图谱入口 + 常驻对话；看板成为工作台内"数据段" |
| W-A2 | ⌘K 升级为 AI 指令面板 | 保留现有全局搜索（260ms 防抖），⌘K 优先给 AI 指令（自然语言 → 动作预览） |
| W-A3 | 页面级上下文 | 侧边栏切换页面时写入 `AiContext`，支持"这个库"指代 |
| W-A4 | 待确认动作队列 | 右侧固定栏；支持"确认/忽略/批量确认"，全部可撤销（复用 F6.3 回滚链路） |
| W-A5 | 主动触达 | 站内红点（必需）+ 浏览器通知（PWA 可选） |
| W-A6 | 流式输出（阶段 2） | `/api/ai/chat?stream=1`（SSE）；未就绪时保留 typing 态 |

## 8.4 图谱落地（文件级）

| 文件 | 阶段 | 职责 |
|---|---|---|
| `js/graph.js` / `src/graph/build.ts` | 1 / 2 | 构图（确定性、0 次模型）、增量、版本 |
| `js/graph.js` / `src/graph/query.ts` | 1 / 2 | 精确 / 邻域 / 多跳 / 子图 / 聚合算子 |
| `js/graph-rag.js` / `src/graph/rag.ts` | 1 / 2 | 证据装配 → 注入 `ai.js` 请求体 |
| `js/graph-store.js` / `src/graph/store.ts` | 1 / 2 | localStorage（阶段 1）→ IndexedDB（阶段 2）；stale 判定 |
| `js/workbench.js` / `views/AiWorkbench.vue` | 1 / 2 | AI 首屏 |
| `js/graph-view.js` / `views/GraphExplorer.vue` | 1 / 2 | 阶段 1 内联 SVG；阶段 2 ECharts `graph` |
| `js/ai.js` | 改 | 证据来源从 `evidenceFor()` 切到 `ragEvidence()`，保留回退 |

**图谱浏览器交互**：缩放/平移、按库与类别过滤、临期高亮、私有物品默认隐藏（F2.5）、点节点 → 右侧"路径 + 来源 + 问 AI"；超过 60 节点按社区聚合显示。

## 8.5 管理员端改造（F10 扩展）

| 模块 | 新增内容 |
|---|---|
| 图谱运营看板 | 家庭数、平均节点/边/社区数、摘要生成量与命中率、路径引用率、AI 主导率（**匿名聚合**，不含物品明细） |
| 知识库图谱化维护 | 概念图维护：食材↔菜谱↔替代品↔存放规则；发布后 `kbVersion` +1，端侧下次构建自动生效 |
| 摘要审核与重算 | 按家庭/社区查看（可脱敏）、手动重算、异常摘要下线 |
| AI 治理 | 限流配置（`AI_RPM`、摘要桶）、模型与备用模型切换、按 `traceId` 回放证据 |
| 合规检查 | 一键跑"无密钥明文 / 证据来源齐全 / AI 生成标识齐全"三项自检 |

## 8.6 验收用例（Web 端）

| 编号 | 场景 | 期望 |
|---|---|---|
| WX1 | 打开站点 | 首屏为 AI 工作台；摘要条与队列有内容 |
| WX2 | 说"这周最该先处理什么" | global search：社区摘要 + 代码统计，标注"摘要基于 X 分钟前图谱" |
| WX3 | 打开图谱页 | 阶段 1 无第三方依赖；≤60 节点渲染 <300ms；私有物品不显示 |
| WX4 | 点击节点 | 展开"路径 + 来源"，可"问 AI"（自动带入节点上下文） |
| WX5 | 断网 | 工作台与图谱检索可用（快答 0 次模型）；模型类问题提示离线 |
| WX6 | 管理员端看板 | 仅匿名聚合指标，无任何物品明细字段 |
| WX7 | 旧数据兼容 | 既有 `nexcore_web_db_v2` 数据可迁移（保留字段 + 忽略未知） |

## 8.7 风险（Web 端）

| 风险 | 等级 | 对策 |
|---|---|---|
| 零依赖约束下做可视化 | 🟠 中 | 阶段 1 用内联 SVG 分层图（≤60 节点）；阶段 2 再上力导向 |
| 阶段 1/2 双实现分叉 | 🟠 中 | 契约唯一（第 5 章）+ CT-2 对拍 |
| localStorage 容量（~5MB） | 🟡 低 | 图谱 ≤200KB；必要时只存精简图（不含 tip 长文本） |
| SSE 需后端与代理支持 | 🟡 低 | 阶段 2 项；阶段 1 保留 typing 态 |
| 管理员端隐私边界 | 🔴 高 | 只暴露匿名聚合；明细需二次确认并写审计日志 |

---

# 第 9 章 微信小程序端改造

> 工程：`wxminiapp/NexcoreGraph_wxminiapp/`（Taro 4.1.9 + React 18 + TS + Sass + zustand）

## 9.1 现状

| 维度 | 现状 |
|---|---|
| 页面 | 10 页：home / library / library-detail / intake / plans / alerts / shopping / chat / mine / login |
| tabBar | 首页 · 资源库 · AI 助手 · 我的 |
| AI 位置 | 第 3 个 tab（`pages/chat`），仍属"辅助"定位 |
| AI 层 | `services/ai.ts`（与 Web/鸿蒙同构的意图路由 + 工具协议） |
| 数据层 | `services/api.ts`（本地模拟后端，与 REST 契约同签名） |
| 口径冲突 | `services/cloud.ts` 使用 `Taro.cloud.callFunction`，与《完整文档》2.3"不用微信云开发"矛盾 |
| 体积 | 当前构建 66 文件 / 0.55MB |

## 9.2 改造清单

| # | 改造 | 说明 |
|---|---|---|
| M-A1 | **AI 首 tab**：`pages/chat` 升级为 `pages/workbench` 并置首位 | 摘要条 + 待确认队列 + 图谱入口 + 对话 |
| M-A2 | 图谱页 `pages/graph` | canvas 2d 轻量图谱（≤60 节点，超出按社区聚合）；点节点问 AI |
| M-A3 | 订阅消息主动触达 | 临期处置、周报、社区摘要（一次性订阅，授权后由后端下发） |
| M-A4 | 分享卡片带图谱快照 | `onShareAppMessage` 传图谱统计（"8 库 42 件 · 本周 3 项临期"），落地页直达工作台 |
| M-A5 | 页面级 AI 上下文 | 从库详情/物品进工作台时带入 `libId/itemId` |

| 文件 | 职责 |
|---|---|
| `src/services/graph.ts` | 构图 + 增量 + 版本（复用 `services/api.ts` 的 `db`） |
| `src/services/graphQuery.ts` | 算子：matchEntity / neighbors / multiHop / subgraph / aggregate |
| `src/services/graphRag.ts` | 证据装配 → 注入 `services/ai.ts` |
| `src/store/useGraphStore.ts` | zustand 图状态（只读快照 + stale） |
| `src/pages/workbench/` | AI 首屏（替换原 chat 页，保留对话组件） |
| `src/pages/graph/` | canvas 图谱页 |
| `src/utils/graphPack.ts` | 字段字典化压缩/解压（Storage 体积优化） |

## 9.3 约束与对策

| 约束 | 值 | 对策 |
|---|---|---|
| 主包体积 | ≤2MB | 图谱运行时生成；图谱页独立分包；主包只留工作台 |
| 总包体积 | ≤20MB | 当前 0.55MB，余量充足 |
| Storage | ~10MB | 图 JSON 压缩后 ≤400KB（键名缩写 + 字典复用）；聊天仍只存 200 条 |
| canvas | 2d + 同层渲染兼容性 | 节点 ≤60 + 固定迭代 80 次的简易力导向；低端机降级为"社区列表 + 计数" |
| 无 eval | 不支持动态执行 | 构图与检索全部静态代码 |

## 9.4 平台合规（审核必过）

| 项 | 要求 | 落地 |
|---|---|---|
| AI 生成内容标识 | 识别结果与方案标注"AI 生成" | 复用端内文案，在结果卡显著位置展示 |
| 内容安全 | 输入/输出过 `security.msgSecCheck` | 发送前 + 展示前各一次；失败降级为提示，不阻断本地功能 |
| 隐私保护指引 | 采集范围/权限用途/本地优先 | 与 `docs/privacy.md` 一致，后台填报同步更新 |
| 订阅消息 | 需用户授权 + 模板审核 | 仅申请临期与周报两个模板；未授权时站内红点兜底 |
| 域名白名单 | 自建后端 HTTPS + 备案 | 统一走自建 REST（同时解决 `cloud.ts` 口径冲突） |

## 9.5 验收用例（小程序端）

| 编号 | 场景 | 期望 |
|---|---|---|
| MX1 | 打开小程序 | 首屏为 AI 工作台；原对话能力可用 |
| MX2 | 进入图谱页 | ≤60 节点渲染 ≤500ms；分包加载成功，主包体积不超标 |
| MX3 | 断网 | 图谱事实 + 快答可用；模型类问题提示离线 |
| MX4 | 库详情 → 问 AI | "这个库还能撑几天"正确解析指代 |
| MX5 | 订阅消息授权 | 授权后能收到临期/周报；未授权不报错 |
| MX6 | 分享 | 分享卡片含图谱统计；被分享者打开直达工作台 |
| MX7 | 内容安全 | 含敏感词输入被拦截并提示，不调用模型 |

## 9.6 风险（小程序端）

| 风险 | 等级 | 对策 |
|---|---|---|
| `cloud.ts` 与自建后端双轨 | 🟠 中 | 本期统一自建 REST；云开发分支删除或仅留 H5 调试 |
| 低端安卓机 canvas 卡顿 | 🟠 中 | 节点上限 + 分包懒加载 + 列表降级视图 |
| 订阅消息模板审核周期 | 🟠 中 | 提前提交；未通过不影响工作台 |
| 主包 2MB 限制 | 🟠 中 | 图谱与图谱页进分包；构建后跑体积检查 |
| 内容安全接口耗时 | 🟡 低 | 异步校验 + 本地敏感词兜底 |

---

# 第 10 章 安卓端改造

> 工程：`androidapp/`（当前为空目录，需迁入/新建；Kotlin + Jetpack Compose，minSdk 24+）
> 定位：在多端复制中验证"AI 主体化"信息架构的可移植性，并利用 Android 后台能力把主动式 AI 做得更激进。

## 10.1 技术映射

| 概念 | 鸿蒙（ArkTS） | 安卓（Kotlin） |
|---|---|---|
| 全局状态 | `@ObservedV2 Store` | `ViewModel` + `StateFlow` |
| 数据模型 | `Db.ets` | Room entities |
| 业务动作 | `Api.ets` | Repository |
| AI 客户端 | `AiGateway.ets` | `AiGateway`（OkHttp/Retrofit） |
| 图谱存储 | Preferences 图 JSON | **Room 四表**（nodes/edges/communities/summaries）+ 内存图 |
| 图谱检索 | `GraphQuery.ets` | `GraphQuery`（纯 Kotlin，可单测） |
| 图谱视图 | Canvas | Compose `Canvas` 力导向 |
| AI 首屏 | `AiWorkbench.ets` | `AiWorkbenchScreen`（默认 start destination） |
| 卡片 | Form Kit | AppWidget（可选，后置） |
| 主动任务 | workScheduler deferred | **WorkManager**（周期 + 约束：充电/空闲/网络） |
| 通知 | 服务卡片 + 应用内 | **NotificationChannel** + 通知动作按钮（确认/忽略） |

## 10.2 AI 主体化与图谱落地

| # | 内容 | 说明 |
|---|---|---|
| K-A1 | AI-first 导航 | `NavHost` 默认 `AiWorkbench`；底部导航第一项为 AI；其余页面作为其"落地页" |
| K-A2 | 通知即入口 | 通知内动作：确认调整 / 加入采购 / 查看图谱，点通知直达上下文（含 `traceId`） |
| K-A3 | 页面上下文 | `AiContext`（CompositionLocal）随导航写入，支持"这个库"指代 |
| K-A4 | 主动 Agent | WorkManager 周期任务（默认 6h）：增量构图 + 摘要预计算 |
| K-A5 | 模型 Provider 抽象 | 接口化 `AiProvider`：`GatewayProvider`（默认）/ `OnDeviceProvider`（预留），避免绑定单一厂商 |

```kotlin
// Room 表（同第 5 章契约）
@Entity(tableName = "graph_nodes") data class GraphNodeEntity(@PrimaryKey val id: String, val type: String, val label: String, val props: String, val community: String?)
@Entity(tableName = "graph_edges") data class GraphEdgeEntity(@PrimaryKey(autoGenerate = true) val id: Long, val fromId: String, val toId: String, val type: String, val props: String?)
@Entity(tableName = "graph_communities") data class GraphCommunityEntity(@PrimaryKey val id: String, val level: Int, val label: String, val stats: String)
@Entity(tableName = "graph_summaries") data class GraphSummaryEntity(@PrimaryKey val community: String, val text: String, val basedOn: String, val generatedAt: Long)
```

| 文件 | 职责 |
|---|---|
| `data/graph/GraphRepository.kt` | 重建/增量/查询/摘要读写（事务 + 版本） |
| `domain/graph/GraphQuery.kt` | 算子（纯函数 + 单测） |
| `domain/graph/GraphRag.kt` | 证据装配 → `AiGateway` |
| `data/graph/GraphBuildWorker.kt` | WorkManager：增量构图（0 次模型） |
| `data/graph/SummaryWorker.kt` | WorkManager：社区摘要预计算（受限流约束） |
| `ui/workbench/AiWorkbenchScreen.kt` | AI 首屏 |
| `ui/graph/GraphScreen.kt` | Compose Canvas 图谱 |

**权限**：图谱无需新增权限；通知需 `POST_NOTIFICATIONS`（Android 13+，运行时申请）；语音需 `RECORD_AUDIO`（可选）。

## 10.3 验收与风险

| 编号 | 场景 | 期望 |
|---|---|---|
| KX1 | 冷启动 | 默认进入 AI 工作台；首帧 <1.5s（中端机） |
| KX2 | 断网 + 已有图谱 | 图谱检索与快答可用；模型类问题提示离线 |
| KX3 | 通知动作 | 点"确认调整"后库存变更并留痕；点"忽略"不写入 |
| KX4 | WorkManager 执行 | 约束满足时完成增量构图；不满足时顺延不报错 |
| KX5 | 图谱页 | 60 节点渲染 ≥55fps；点节点可问 AI |
| KX6 | Provider 切换 | 切换 `OnDeviceProvider`（桩实现）不影响主链路与红线校验 |

| 风险 | 等级 | 对策 |
|---|---|---|
| 安卓工程尚未迁入（空目录） | 🔴 高 | 优先级排在鸿蒙/Web/小程序之后；先用同一契约写 `GraphQuery` 纯逻辑并单测，UI 后置 |
| 厂商后台限制导致主动任务不及时 | 🟠 中 | WorkManager 约束 + 前台补算；与推送通道解耦 |
| 端侧模型体积与包大小 | 🟠 中 | Provider 抽象 + 可选下载（AAB 动态特性） |
| Compose Canvas 长列表性能 | 🟡 低 | 节点上限 + 社区聚合 + `graphicsLayer` 缓存 |

---

# 第 11 章 Qt 桌面端改造

> 工程：`desktopapp/`（当前为空目录，需迁入/新建；C++ + Qt 6 + QML）
> 定位：不做小屏复刻，承担端上做不了的三件事：算力、大屏图谱、批量入口。

## 11.1 差异化定位

1. **算力承担者**：社区摘要预计算、历史归档、全量重建与对账；
2. **大屏图谱**：QML 力导向/放射布局全屏展示，评审现场演示"家庭资源图谱"的最佳载体；
3. **批量入口**：Excel/CSV 批量导入 → **自动建图并给出差异报告**（新增多少节点、影响哪些社区、哪些摘要失效）。

## 11.2 技术映射与文件清单

| 概念 | 鸿蒙（ArkTS） | Qt（C++/QML） |
|---|---|---|
| 全局状态 | `@ObservedV2 Store` | `QAbstractItemModel` + QML 单例 |
| 业务动作 | `Api.ets` | Service 层（`Q_INVOKABLE`） |
| AI 客户端 | `AiGateway.ets` | `AiGateway`（`QNetworkAccessManager`） |
| 图谱存储 | Preferences 图 JSON | **SQLite 四表**（同第 5/6 章结构） |
| 图谱检索 | `GraphQuery.ets` | `GraphEngine`（`QtConcurrent` 并行构图） |
| 图谱视图 | Canvas | QML Canvas / `QtGraphs` / `QQuickPaintedItem` |
| AI 首屏 | `AiWorkbench.ets` | 主窗口默认页 `AiWorkbench.qml` |
| 主动通知 | 服务卡片 | `QSystemTrayIcon` + 系统通知 |
| 后台任务 | workScheduler | `QTimer` + 托盘常驻（无系统后台限制） |

| 文件 | 职责 |
|---|---|
| `src/graph/GraphEngine.{h,cpp}` | 构图、增量、版本、并行全量重建 |
| `src/graph/GraphQuery.{h,cpp}` | 算子（可单测） |
| `src/graph/GraphRag.{h,cpp}` | 证据装配 → AiGateway |
| `src/graph/GraphStore.{h,cpp}` | SQLite 持久化（四表 + 事务）+ 版本 |
| `src/ai/AiGateway.{h,cpp}` | 网关客户端（chat / vision / usage / graph） |
| `src/import/XlsxImporter.{h,cpp}` | 批量导入 → 触发建图 → 差异报告 |
| `src/jobs/SummaryScheduler.{h,cpp}` | 摘要预计算调度（串行 + 限流 + 缓存） |
| `qml/pages/AiWorkbench.qml` | AI 首屏（摘要 + 队列 + 图谱缩略 + 对话） |
| `qml/pages/GraphFullscreen.qml` | 大屏图谱（全屏/轮播、导出 PNG） |
| `qml/components/GraphView.qml` | 力导向/放射布局 |
| `qml/pages/ImportWizard.qml` | 导入向导（字段映射 → 预览 → 差异报告 → 确认） |

## 11.3 AI 主体化落地（桌面）

| # | 改造 | 说明 |
|---|---|---|
| Q-A1 | 主窗口默认 = AI 工作台 | 保留左侧导航（桌面习惯），但启动页与托盘菜单首项都是 AI |
| Q-A2 | 托盘常驻 + 通知 | 临期处置、周报、导入完成；托盘菜单含"问 AI""打开图谱" |
| Q-A3 | 大屏轮播模式 | 评审演示：图谱 + 关键指标 + AI 洞察自动轮播 |
| Q-A4 | 批量导入即建图 | 导入后自动重建 + 差异报告（新增/变更/失效摘要） |
| Q-A5 | 键盘优先 | `Ctrl+K` AI 指令；`Ctrl+G` 图谱；方向键在图谱中导航 |

## 11.4 容量、验收与风险

| 项 | 预算 |
|---|---|
| 节点规模 | ≤2000（契约仍建议与移动端一致 ≤500） |
| 全量重建 | ≤200ms（多线程） |
| 图谱渲染 | 800 节点 ≥55fps；超过按社区聚合 |
| 图库体积 | ≤20MB（含历史归档） |

| 编号 | 场景 | 期望 |
|---|---|---|
| QX1 | 冷启动 | 默认 AI 工作台；托盘常驻 |
| QX2 | 导入 200 行 CSV | 自动建图并给出差异报告 |
| QX3 | 大屏图谱 | 800 节点 ≥55fps；导出 PNG 成功 |
| QX4 | 托盘通知 | 点击直达对应上下文（含确认/忽略动作） |
| QX5 | 断网 | 图谱事实 + 方案生成可用；模型类问题提示离线 |
| QX6 | 与移动端对账 | 同一 payload 构图，节点/边计数与鸿蒙一致（CT-2） |

| 风险 | 等级 | 对策 |
|---|---|---|
| 桌面工程尚未迁入（空目录） | 🔴 高 | 列为"省赛后扩展"；先完成契约与 `GraphQuery` 纯逻辑（C++ 单测） |
| QML 力导向布局性能 | 🟠 中 | 预计算布局 + 交互时才重排；超阈值切聚合视图 |
| 打包分发（NSIS/Inno）与签名 | 🟡 低 | 沿用既有文档 2.5 方案 |
| 与移动端图谱口径漂移 | 🟠 中 | 契约唯一（第 5 章）+ CT-2 对拍 |

---

# 第 12 章 里程碑排期与验收

> 对齐既有排期：省赛 2026 年 11 月、国赛 2026 年 12 月、报名截止 **2026-11-23**；本表与《鸿蒙端专项整改文档》S0–S6 并行，不推翻原排期。

## 12.1 阶段划分

| 阶段 | 时间 | 内容 | 交付物 | 通过门槛 |
|---|---|---|---|---|
| **G0 契约冻结** | 09/16–09/22 | 图本体、JSON Schema、REST 契约、隐私分级定稿 | 本方案第 3/5 章定稿；CT-1~CT-3 就绪 | 五端确认；旧端兼容断言通过 |
| **G1 端侧图谱内核** | 09/23–10/05 | 鸿蒙 `Graph{Build,Store,Query}`：确定性构图 + 增量 + 版本 | `entry/src/main/ets/common/Graph*.ets` + 单测 | GX2/GX6（增量 ≤5ms、500 物品重建 ≤300ms） |
| **G2 GraphRAG 编排** | 10/06–10/16 | `GraphRag` 证据装配 + 网关 `graphEvidence` + 路径与来源展示 | 鸿蒙 + 后端联调 | GX3/GX4 + CT-4（红线回归） |
| **G3 摘要离线预计算** | 10/17–10/26 | 社区摘要生成/缓存/stale 治理 | `GraphSummary` + `graph_summaries` 表 | GX5 + BG-4/BG-5；对话预算未受影响 |
| **G4 AI 工作台 + 图谱可视化** | 10/20–11/03 | 鸿蒙 AI 首屏与图谱页；Web 阶段 1 | `AiWorkbench`/`GraphView`；`workbench.js`/`graph.js` | AX1~AX4、WX1~WX4 |
| **A1 主动 Agent** | 与 G3 并行 | 事件源 + 待确认队列 + 撤销链路 | 队列 UI + 事件判定 | AX2（未确认不写入） |
| **G5 跨端复制** | 11/04–11/15 | 小程序（AI 首 tab + 分包图谱 + 订阅消息）；安卓/Qt 纯逻辑与骨架 | 小程序可编译且分包合规；安卓/Qt 引擎单测 | MX1~MX4；安卓/Qt 单测全绿 |
| **A2 触达通道** | 11/05–11/12 | 小程序订阅消息、桌面托盘通知（鸿蒙 Push 待 Q3） | 模板申请 + 通知动作 | MX5、QX4 |
| **A3 度量与运营** | 11/10–11/18 | AI 主导率/采纳率/路径覆盖率埋点；管理员端图谱看板 | 埋点 + 看板 | WX6；指标可出数 |
| **S6 收口（沿用）** | 11/14–11/20 | 全量用例 + 提交材料 + 演示视频 | 验收报告 v1 | 红线 0 违规 + 材料齐全 |

> 关键纪律：**每个阶段都必须保持"现有功能可用"**（CT-3 常跑），不允许出现"为了图谱把主线弄坏"的中间态。

## 12.2 用例汇总

| 端 | 用例 | 数量 |
|---|---|---|
| 契约/后端 | CT-1~CT-5、BG-1~BG-8 | 13 |
| 鸿蒙 | GX1~GX6、AX1~AX5 | 11 |
| Web | WX1~WX7 | 7 |
| 小程序 | MX1~MX7 | 7 |
| 安卓 | KX1~KX6 | 6 |
| Qt | QX1~QX6 | 6 |
| 既有回归 | 主文档 A–K、整改文档 X1–X8 与 A–K | 全部保留 |

**红线回归（任一不过即整体不通过）**

| 编号 | 断言 |
|---|---|
| R1 | 20 条 golden QA 中，回答里的数字集合 ⊆ 图谱证据数字集合 |
| R2 | 所有写操作（改数量/加采购/执行方案）均需用户确认后才生效 |
| R3 | 单次问答的模型调用 ≤2 次（快答 0 次、常规 1 次、GraphRAG 多跳 ≤2 次） |

## 12.3 评测指标与目标值

| 类别 | 指标 | 基线（现状） | 目标 |
|---|---|---|---|
| 图谱 | 构图正确率（人工抽查 50 条边） | — | ≥95% |
| 图谱 | 全量重建耗时（500 物品，鸿蒙） | — | ≤300ms |
| GraphRAG | 路径证据覆盖率 | 0（无路径证据） | ≥80% |
| GraphRAG | 多跳答案可用率（3 跳内可执行方案） | — | ≥85% |
| GraphRAG | 摘要 stale 参与回答比例 | — | 0% |
| AI 主体 | AI 首屏到达率 | 未测 | ≥70% |
| AI 主体 | AI 发起占比 | 0 | ≥30% |
| AI 主体 | 主动事项采纳率 | — | ≥40% |
| 成本 | 单次问答 tokens | 现状基线 | ≤-20% |
| 成本 | 快答命中率 | 文档目标 ≥60% | ≥60% |
| 质量 | 红线违规数 | 0 | **0** |

## 12.4 材料清单更新

| 材料 | 变化 |
|---|---|
| 源码工程 | 新增各端图谱模块（`Graph*.ets` 等） |
| Codelabs 教程 | 新增 2 步：`08-构建个人资源知识图谱`、`09-GraphRAG 检索与来源引用` |
| 作品说明文档 | 新增章节：AI 主体化定义与边界、图谱本体、离线摘要设计、可解释性 |
| 演示视频 | 新增 2 个必拍镜头：图谱页点节点问 AI（路径+来源）、主动队列确认 |
| 验收报告 | 增加 GX/WX/MX/KX/QX/BG/CT 用例页与红线回归页 |
| 隐私声明 | 增加"图谱为派生数据、默认仅本地"与 P1'/P2/P3 分级说明 |

## 12.5 提交门槛（Definition of Done）

1. **功能**：各端 AI 工作台可用；图谱可视；GraphRAG 回答带路径与来源；主动队列可确认/忽略/撤销；
2. **红线**：R1/R2/R3 自动化回归全绿，并纳入提交前检查脚本；
3. **兼容**：旧端不传 `graphEvidence` 时行为与现状一致（CT-3）；
4. **降级**：断网、网关 503、图谱缺失、摘要 stale 四种场景均可演示；
5. **合规**：无密钥明文（HAP/前端包扫描）、AI 生成标识齐全、隐私声明更新；
6. **可复现**：`tools/check_release.py` + 各端构建脚本一条命令通过。

---

# 第 13 章 风险登记与决策项

## 13.1 风险登记（跨端）

| # | 风险 | 等级 | 影响 | 对策 | 责任 |
|---|---|---|---|---|---|
| R1 | **红线被 GraphRAG 稀释**：摘要/模型引入未经代码计算的数字 | 🔴 高 | 直接判不通过 | 摘要只允许引用 `aggregate()` 结果；提示词硬约束；R1 自动化回归 | 全队 |
| R2 | **单请求预算被打破**：摘要混入对话链路 | 🔴 高 | 判不通过 | 摘要独立端点 + 独立限流桶 + 后台任务；单测统计调用次数 | 后端 |
| R3 | 图谱规模膨胀（物品数远超预期） | 🟠 中 | 端侧卡顿/OOM | 节点 500 / 边 3000 硬上限 + 截断标记 + 社区聚合渲染 | 鸿蒙/Web |
| R4 | 跨端口径不一致（同名边不同语义） | 🟠 中 | 演示穿帮 | 契约唯一（第 5 章）+ CT-2 对拍 + 五端共通测试数据 | 全队 |
| R5 | 元服务包 ≤10MB 被挤爆 | 🟠 中 | 无法安装 | 图谱运行时生成不入包；新增代码 ≤120KB；构建后体积检查 | 高俊杰 |
| R6 | 小程序主包 2MB 限制 | 🟠 中 | 无法上传审核 | 图谱页独立分包 + 字典化压缩 | 杨欢 |
| R7 | 隐私扩面（图谱/摘要上云） | 🔴 高 | 合规与评委信任 | 默认仅本地；P1'/P2 分级 + 家庭级开关；管理员端只看匿名聚合 | 全队 |
| R8 | 模型不稳定导致路径证据被忽略 | 🟠 中 | 回答质量波动 | 提示词保留"证据不足就直说"；关键事实在 UI 侧由代码直接展示 | 后端/端 |
| R9 | 摘要成本失控（社区多、更新频繁） | 🟠 中 | 费用与限流 | 社区数上限 + 24h 冷却 + 每家庭每日上限（默认 8 条） | 后端 |
| R10 | 安卓/Qt/小程序人力不足导致排期滑坡 | 🔴 高 | 交付缺口 | "鸿蒙优先、Web 次之、其余纯逻辑先行"；UI 后置 | 高俊杰/杨欢 |
| R11 | 分布式设备不足影响跨端用例 | 🟠 中 | 演示受限 | 用例拆"单机可演示/双机增强"两档；录屏兜底 | 高俊杰 |
| R12 | 图谱可视化低端设备掉帧 | 🟠 中 | 演示卡顿 | 节点上限 + 社区聚合 + 列表降级视图 | 各端 |

## 13.2 待决策项

| # | 决策项 | 选项 | 影响 | 建议 |
|---|---|---|---|---|
| Q1 | 品牌主色是否迁移到 Logo 色系（既有） | A 不动 / B 迁移 | 五端令牌与对比度校验 | 沿用 A（低风险）；图谱社区配色用辅助品牌色 |
| Q2 | 是否改包名 `com.nexcore.graph` 与工程目录名（既有） | 改 / 不改 | 签名与 AGC 配置 | 省赛后统一改；提交前锁定 |
| Q3 | Push Kit 是否本期接入（既有） | 接入 / 后置 | 需 AGC 凭据与真机推送 | 本期用"工作台 + 卡片 + 小程序订阅消息"替代；Push 后置 |
| Q4 | **图谱是否上云** | 仅本地 / 可选上云 | 隐私分级与后端负载 | 默认仅本地（可重建）；上云作为家庭级开关 |
| Q5 | **是否引入向量检索 / embedding** | 引入 / 不引入 | 成本、口径、红线 | 暂不引入；先用 2-gram + 图谱多跳覆盖；省赛后 P2 评估 |
| Q6 | **社区摘要预计算放端侧还是后端** | 端侧 / 后端 / 双轨 | 成本与一致性 | **后端为主**（集中限流与缓存），端侧保留触发与本地降级生成 |
| Q7 | 小程序 `services/cloud.ts`（微信云开发）是否删除 | 删除 / 保留调试 | 与《完整文档》2.3 冲突 | 本期统一自建 REST，删除云开发分支 |
| Q8 | 是否引入端侧小模型 | 引入 / 不引入 | 包体积与元服务限制 | 不引入（元服务形态禁用相关 Kit 已实测）；仅应用包形态评估 |

---

# 附录 A 需回写的既有文档

| 文档 | 回写内容 |
|---|---|
| `docs/启核图策-项目完整文档.md` | 新增 F11（图谱）、F12（AI 主体化）；1.6 架构图补图谱层；1.7 数据模型补图节点/边；2.0 公共约定补本方案指针 |
| `docs/启核图策-鸿蒙端专项整改与验收文档.md` | 第 4 章新增 G/A 编号条目；第 7 章补 GX/AX 用例；附录 C 之后新增附录 D（本方案执行记录，随实施填写） |
| `docs/启核图策-Web端专项整改与验收文档.md` | 4.x 补 WX 用例与两阶段路径 |
| `docs/启核图策-微信小程序端专项整改与验收文档.md` | 4.x 补 MX 用例、分包与订阅消息方案；修正 `cloud.ts` 口径 |
| `docs/启核图策-NexcoreGraph-品牌规范.md` | 补充"图谱社区配色"（使用辅助品牌色，不改主色） |
| 各端 `docs/privacy.md` | 补 P1'/P2/P3 分级、图谱派生数据默认仅本地、摘要开关 |

# 附录 B 降级预案与演示话术

| 场景 | 降级动作 | 演示话术 |
|---|---|---|
| 后端/网关挂掉 | 端侧图谱事实 + 快答 + 规则方案，全部 0 次模型 | "我们的 AI 是本地优先：断网也能看图、能查事实、能出方案，模型只是措辞层" |
| 模型超时 | 主→备模型；再失败展示路径证据 | "证据先给你看，措辞可以稍后" |
| 图谱未就绪 | 回退现状的证据行装配 | "图谱在后台增量构建，当前用扁平证据兜底" |
| 摘要 stale | 显示"摘要更新中" + 实时统计 | "我们不允许过期摘要参与回答" |
| 双设备不可用 | 单机演示 + 录屏 | "分布式场景请看这段录屏（X2/X4）" |

# 附录 C 术语

| 术语 | 含义 |
|---|---|
| 实例层 / 概念层 | 实例层 = 用户库中的具体物品、方案、预警；概念层 = 通用知识库中的食材、菜谱、规则 |
| 跨层边 | 连接实例与概念的边，如 `instantiates`（我家的鸡蛋 → 鸡蛋）、`usedBy`（鸡蛋 → 番茄炒蛋） |
| 社区 | 图中按库 / 类别 / 场景聚合的节点群（一级 / 二级 / 三级），用于 global search 与洞察 |
| 社区摘要 | 对某个社区生成的一句话洞察（≤80 字），**离线预计算**，带 `basedOnVersion` |
| local / global / multi-hop | GraphRAG 三种检索模式：实体邻域 / 社区摘要 / 多跳路径 |
| 路径证据 | 回答所依据的"节点 → 边 → 节点 …"序列，附事实与来源，用于可解释性 |
| stale | 摘要基于的 `graphVersion` 已过期，不参与回答 |
| 红线 | AI 行为三原则：数值由代码产出、写操作先预览、单请求 ≤2 次模型调用 |
| 快答 | 意图路由命中的 0 次模型回答 |
| AI 主体 | AI 是入口、编排者、发起者、解释者；但事实与权限仍由代码裁决 |

---

# 附录 D 实施进度（滚动更新）

## D.1 第一轮（2026-09-15）：后端图谱服务 + 端侧图谱内核

| 编号 | 内容 | 状态 | 证据 |
|---|---|---|---|
| 6.2 | 图谱五表（nodes/edges/communities/summaries/versions） | ✅ 已实现 | `backend/server.js` `initDb()`；BG-1 落库、`graph_versions` 可查 |
| 6.3 | 服务模块：`graphBuild.js` / `graphService.js` / `graphQuery.js` | ✅ 已实现 | 三个模块各司其职，查询算子为纯函数 |
| 6.4 | 端点 `POST /api/graph/rebuild`、`GET /api/graph/:familyId`、`POST /api/graph/query`、`POST /api/graph/summaries`、`GET /api/admin/graph/stats` | ✅ 已实现 | 联调：rebuild 200 / 无图 404 / 断库 503 |
| 6.5 | GraphRAG 提示词装配 + `traceId`/`evidenceUsed`/`warnings` 回执 | ✅ 已实现 | 带 `graphEvidence` 调用返回三字段；不带时与现状逐字段一致（BG-6） |
| 6.7 | 红线对齐：无写端点、摘要独立限流桶、断库降级 | ✅ 已实现 | BG-8：DB 不可用时图端点 503、AI 仍 200 |
| G1 | 端侧图谱内核 `GraphModel/GraphStore/GraphBuild/GraphQuery` | ✅ 已实现（编译通过） | `entry/src/main/ets/common/Graph*.ets`；设置页可见规模/版本/重建耗时 |
| G2 | GraphRAG 编排接线（AiGateway 附 `graphEvidence`，意图→模式映射） | ✅ 已实现（编译通过） | `AiGateway.ets`；简报走 global，食谱类走 multi-hop |
| 门禁 | `tools/check_release.py` 扩展图谱相关 4 项检查 | ✅ | 11 项全 PASS |

**关键实现决策（与原方案的偏离，均已验证）**

| 决策 | 原方案 | 实际做法 | 理由 |
|---|---|---|---|
| 端侧增量更新 | `applyEvent` 逐事件增量 | **新鲜度自校验 + 按需全量重建** | 500 节点全量重建 <20ms，无需在上百处业务函数埋点；`freshness` 指纹避免陈旧图 |
| 端侧社区摘要 | 端侧可生成 | **端侧不生成**，global 模式用社区统计；摘要由 `POST /api/graph/summaries` 预计算 | 落实 Q6"后端为主"，避免端侧占用对话预算 |
| 图谱页 UI | G4 交付 | **本轮未做**（仅设置页状态卡） | 优先打通"数据 → 检索 → 证据 → 网关"链路；UI 属下一轮 |

## D.2 已验证用例（后端，真实 MySQL + 假上游）

| 用例 | 结果 |
|---|---|
| BG-1 重建（8 库/40 物品 payload） | 200；60 节点 / 88 边 / 8 社区 / 未归类 1 项 / kbVersion 1.0 |
| BG-2 幂等重建 | 节点/边计数与版本号完全一致 |
| BG-3 multi-hop（临期→菜谱→缺料） | 3 条路径；含"鸡蛋 8 个（3 天到期）→ 番茄炒蛋 需 2 种食材" |
| BG-4 摘要生成 | 首次每社区 1 次调用；二次 `pending=0`（缓存命中，0 次调用） |
| BG-5 摘要过期 | 版本变化 → `stale=true` 且旧摘要不参与回答；重算后恢复 |
| BG-6 旧端兼容 | 不传 `graphEvidence` → 响应与现状一致 |
| BG-8 断库降级 | 图端点 503、`/api/ai/chat` 仍 200 |
| local search（"牛奶还能放几天"） | 命中 `item:milk → food:milk → recipe:牛奶燕麦粥`，来源"中国营养保健食品协会"，含冷藏 7 天/开封 1 天建议 |

## D.3 下一轮待办（按优先级）

1. **G4 UI**：鸿蒙 `AiWorkbench`（AI 首屏 + 待确认队列）与 `GraphView`（Canvas 分层图谱）；
2. **CT-2 跨端对拍**：需启动模拟器/真机，比对端侧与后端在同一 payload 下的节点/边计数；
3. **端侧摘要触发**：工作台打开时若摘要过期 → 调 `POST /api/graph/summaries`（离线批量、独立限流）；
4. **Web 阶段 1**：`js/graph.js` + 工作台（零依赖，可先演示）；
5. 小程序/安卓/Qt 按第 9–11 章复制契约与引擎。

## D.4 真机（模拟器）验证结果（2026-09-15）

设备：HarmonyOS 模拟器 `emulator`，API 22（6.0.0.130）；安装方式：`hdc install`（该模拟器不校验签名，直接用 unsigned HAP）。

| 验证项 | 方法 | 结果 |
|---|---|---|
| 端侧构图 | 进入「我的 → 设置」，读取图谱卡 | **62 节点 · 88 边 · 18 社区**（版本 `gv-…`，值只能来自真实构建） |
| 构图时效性 | 修改算法版本号后重进设置 | 自动重建（17 → 18 社区，宠物食品正确归入"宠物"场景） |
| GraphRAG 端到端 | AI 面板提问"今晚吃什么" | 回复下方显示 **`证据：库存图谱（multi-hop）｜已引用 3 条路径`** |
| 网关侧证据 | 后端控制台 | **`[ai-chat] graph evidence: mode=multi-hop version=gv-… lines=7 paths=3`** |
| 工具协议 | 同一回复解析 `[菜]` 行 | 自动生成方案卡「番茄炒蛋 · AI 创新菜谱（AI 生成）· 约 542 千卡/份 · 食材齐全」 |
| 用量链路 | 端侧 → `/api/ai/usage` | 后端记录 `route=cook model=agnes-2.0-flash source=gateway` 与 `source=client` 各若干 |
| 默认主题 | 截图像素统计（Pillow） | **（已按用户反馈改为默认浅色，见 D.7）** 初版为深色：深海军蓝底 (18,23,43)、经典橙像素 = 0 |
| 主题可切换 | 点击「经典橙」→ 截图 | 橙 3056 / 蓝 0；点回「启核绿青蓝」→ 蓝 3501 / 橙 0 |
| AI 头像 | 面板布局树 + 头像区域像素 | 头像为 96×96 `Image` 节点；区域像素分布 白 6186 / 绿 2345 / 青蓝 3089（官方徽标） |
| 未做 | — | UI 颜色的人工观感复核（自动化只能验证色值族）；`GraphView`/`AiWorkbench` 两个新页面（G4） |

> 说明：`hdc shell uitest uiInput text` 仅支持 ASCII，中文提问需用 `uiInput text <中文>`（已在 D.4 验证可行）。

## D.5 仓库与版本管理（2026-09-15）

| 项 | 内容 |
|---|---|
| 远端 | `https://github.com/yan-stone-computer/NexcoreGraph`（**私有**） |
| 首次推送 | 3 个提交：`chore: 初始化仓库与忽略规则` → `feat(harmonyos): 导入鸿蒙端工程…` → `docs: 补充方案与赛道整改文档` |
| 说明 | 原工程无 git 历史（历史只在备份 zip 中），故"保留 git 记录"自本仓库建立之日起生效，后续按提交粒度延续 |
| 未入库（下一轮） | `web/`、`wxminiapp/`、根 `tools/`（保持"先存鸿蒙"） |
| 网络 | 本机 github.com:443 被重置（api.github.com 可达），首次推送经 `ssh.github.com:443` 完成；建议开启代理后 `git push` 走 HTTPS |

## D.6 G4 交付 + logo 统一（2026-09-15）

| 项 | 内容 | 真机证据 |
|---|---|---|
| AI 工作台（G4） | 新增 `pages/AiWorkbench.ets`；`Index` 的 Tab0 由看板改为 AI 工作台：AI 摘要条（数值代码计算）+ 待确认队列 + 图谱入口 + 快捷指令 + 对话入口 | 首屏文本：`AI 工作台` / `临期 2 项 · 建议先消耗「鲜牛奶」（2 天后到期）` / `待确认` / `库存知识图谱` / `打开图谱` / `AI 对话` / `今日吃什么` |
| 待确认动作队列 | 队列项来自 **AI 对话预览卡**（`[调整]`/`[购物]` 未确认项）与 **pending 方案**，点"确认/执行"才写入（红线 2） | 可见队列行 `清库存 · 20 分钟 · 消耗 1 种食材` + 执行按钮 |
| 图谱面板（G4） | 新增 `pages/GraphPanel.ets`（`store.overlay='graph'`）：Canvas 分层布局（库→物品→概念）、临期高亮、"仅临期"筛选、社区着色、点节点出**路径证据**、一键"问 AI 关于它" | Canvas 命中（按布局密度 3.376 换算）点"冰箱"→ 证据卡 `冰箱：共 5 件，临期 4 项，价值约 ¥57.9` + `临期：鸡蛋 8个（3 天）` + `临期：鲜牛奶 1盒（2 天）` |
| 页面级上下文 | `store.aiPrefill` → `AiPanel.aboutToAppear` 消费，打开对话即带入提问（免复述） | 代码路径 + 真机按钮 `问 AI 关于它` |
| **logo 统一规则** | **应用图标保持不变**（`AppScope/media/{foreground,background}.png` + `entry/media/startIcon.png` + `layered_image.json`，git 无改动）；**其余 logo 位一律用官方徽标** | 登录页 logo 区域像素：亮色（绿青/蓝青/白）**91.5%**、深底仅 2 px → 已从 E3 图标切为官方徽标 |
| 鸿蒙端替换点 | `entry/media/logo.png` 一处覆盖 **7 个引用**：顶栏、登录页、AI 面板（头部+介绍卡）、3 张服务卡片 | `rg app.media.logo` 引用清单 |
| 小程序端 | 登录页 `src/assets/logo.png` 换为官方徽标；`logo-512.png`（小程序应用图标）按规则保持不变 | 源码引用核验（`logo-512` 未被代码引用） |
| Web 端 | 页面内 `assets/img/logo.png`、`favicon-32.png`、`apple-touch-icon-180.png` 本已是官方徽标，无需变更 | 素材像素核验（中心 (43,206,180)，透明角） |
| 待人工复核 | 各端 logo 位的观感（尺寸/留白）；应用图标在桌面/启动页的实际显示 | — |

## D.7 配色与工作台布局修正（2026-09-15，基于用户反馈）

**反馈 1：主题里看不到绿色 —— 配色没按 logo 来。**

| 项 | 修正前 | 修正后 |
|---|---|---|
| `primary` 主操作 | 信号蓝 `#0CA8D6` | **启核绿 `#46B14C`**（浅色态 `#2F8F3A`；hover `#5ACB63`；容器 `rgba(70,177,76,0.18)`） |
| `success` | 启核绿（与旧 primary 语义重叠） | **嫩芽黄绿 `#B1EB59`**（徽标高光色） |
| 数据/辅助 | 无明确分工 | 信号蓝 `#0CA8D6`（`tone-indigo`）+ 科技青 `#19BDC9`（`tone-teal`），仅用于数据表达 |
| 品牌渐变 | 无 | AI 摘要条铺 **绿→青→蓝 135°** 低透明度渐变，呼应徽标三段 |

**验证（全新安装，默认态）**：首屏底色 `(18,23,43)` = 深海军蓝；主按钮（AI 对话）取样 `(57,173,66)` = **启核绿** ✓。

**反馈 2：有组件重叠 / UX 不够好。**

用布局树做了程序化重叠检测（排除父子包含关系），定位到真问题并修复：

| 问题 | 证据 | 修复 |
|---|---|---|
| 悬浮 AI 球遮挡工作台底部内容 | 球 `[1091,2304,1267,2480]` 与价值指标行 `[13,2276,1307,2323]` 重叠 3344 px² | 工作台底部加 64vp 留白（FAB 高度 + 边距） |
| 价值指标散落在页面底部、像"遗留信息" | 3 个裸文本挤在末行 | 上移为紧跟摘要条的**三栏小卡**（等宽、带边框），复用 `MiniStat` |
| 摘要条与品牌感弱 | 纯色容器 | 改为品牌三段渐变 |

**复验**：四个 Tab（AI 工作台 / 资源库 / 协作工作台 / 我的）**被悬浮球遮挡的文本元素均为 0**；其余检测项经核验为 SVG 图标内部 Path 与图片框的固有偏差，非视觉重叠。

**反馈 3：默认应为亮色，不是深色。**

| 项 | 修正 |
|---|---|
| 默认明暗 | `T.dark` 默认由 `true` 改为 **`false`**；`resetDefault()` 同步改为浅色（"恢复品牌默认主题"回到浅色） |
| 浅色态主色 | 启核绿加深版 `#2F8F3A`（深色态仍为 `#46B14C`），保证白底对比度 |
| 服务卡片残留旧品牌橙 | `StockCard` 的"拍照入库"胶囊 `#FF8833` → **启核绿 `#46B14C`**（文字色改 `#06210A`）；`LibCard` 橙色渐变底 → **绿→青 `#46B14C → #2FD4B2`** |
| 设置页文案 | "默认深色…" → "默认浅色（冷白底 + 启核绿主色），可手动切换深色" |

**验证（全新安装，默认态）**：首屏底色 `(245,249,252)` = 冷白 `#F5F9FB`；主操作按钮填充取样 `(49,143,59)` = **启核绿 `#2F8F3A`**；页面无经典橙像素。

**反馈 4：配色与徽标存在色差，不是同一套颜色。**

原因：此前色值取自品牌文档转述（`#46B14C` 等），**并非徽标本体像素** —— `#46B14C` 在徽标渐变里根本不存在。

| 处置 | 内容 |
|---|---|
| 取色方法 | 读母版 `nexcore-graph-logomark.png`（308×430），按不透明区域高度百分比逐行取"饱和度>0.25"像素均值，得 8 级阶梯（见品牌规范 §6） |
| `primary` | `#46B14C` → **`#57D794`**（徽标 30% 实测值），明暗两态**同值填充**（消除色差） |
| `accent` | `#2FD4B2` → **`#3DD0AE`**（徽标 45%） |
| 数据蓝 | `#0CA8D6` → **`#27ADD7`**（徽标 90%）；科技青 `#19BDC9` → **`#26C2BC`**（徽标 60%）；嫩芽 `#B1EB59` → **`#ABE05A`**（徽标 2%） |
| `success` | 改为 **`#8CD35B`**（徽标 15%） |
| 新增 `primary-ink` | 浅色 `#2E8F63` / 深色 `#8CD35B`：文字与图标用派生墨绿保证对比度；**填充仍用徽标原值**。批量替换 7 个文件共 20 处（文字/图标），填充处保持不变 |
| 服务卡片 | `StockCard` 胶囊 → `#57D794`（文字 `#0B2A1C`）；`LibCard` 渐变 → `#57D794 → #26C2BC` |
| 摘要条渐变 | `#8CD35B → #3DD0AE → #27ADD7`（徽标 15%/45%/90%） |

**验证（全新安装，默认态）**：整屏扫描命中 `#57D794`（容差 ±10）的采样点 **1753 个**，示例像素 `(88,215,148)` vs 徽标实测 `(87,215,148)` → **ΔRGB = (1,0,0)，无可见色差**。
