# 启核图策 NexcoreGraph 微信小程序代码说明

> 版本：2026-10-24  
> 工程目录：`D:\ProjectFiles\GithubPackage\NexcoreGraph\wxminiapp\NexcoreGraph_wxminiapp`  
> 技术栈：Taro 4.1.9 + React 18 + TypeScript + Sass + Zustand  
> 适用赛事：传智杯 AI 微信小程序开发挑战赛

## 1. 文档用途

本文说明小程序端的代码组织、运行方法、页面功能、数据流、AI 接入方式、真实能力、外部配置与故障边界，供开发维护、比赛答辩和提交材料引用。

本文按当前源码实际状态编写，不把尚未完成的微信审核、订阅模板审批或线上域名配置写成已上线。

## 2. 项目定位

启核图策是面向家庭资源管理的微信小程序，围绕“拍照建库 -> 临期预警 -> AI 规划 -> 方案核销 -> 采购补充 -> 家庭协作”形成闭环，重点解决家庭物品分散、保质期遗忘、重复购买和家庭信息不同步的问题。

小程序端承担四项核心职责：

1. 用微信相机或相册快速录入物品。
2. 在手机上查看库存、预警、方案和采购清单。
3. 通过 AI 对话执行查询、规划与受控写操作。
4. 提供分享、协作、订阅提醒和资源图谱等移动端入口。

## 3. 运行环境

### 3.1 本地构建

```powershell
cd D:\ProjectFiles\GithubPackage\NexcoreGraph\wxminiapp\NexcoreGraph_wxminiapp
npm install
npm run build:weapp
```

构建产物位于 `dist/`。微信开发者工具导入工程根目录，`project.config.json` 中的 `miniprogramRoot` 已指向 `dist/`。

### 3.2 推荐开发工具

使用最新稳定版微信开发者工具和基础库 `3.17.3` 或更高版本。

旧版开发者工具 `1.06.2504060` 会出现：

```text
Cannot read property 'enableUpdateWxAppCode' of undefined
Failed to load resource: the server responded with a status of 500
```

该问题来自旧版工具不能完整加载当前 Taro 4 产物，不是业务代码异常。应升级开发者工具，不能通过修改页面代码绕过。

### 3.3 后端联调

后端默认地址为：

```text
http://127.0.0.1:3000
```

开发者工具需关闭“合法域名校验”。真机预览时，手机与电脑需处在同一局域网，并将地址改成电脑局域网 IP。小程序“我的 -> 服务器连接”可以修改服务地址，无需重新打包。

## 4. 目录结构

```text
NexcoreGraph_wxminiapp/
├─ src/
│  ├─ app.config.ts                 # 页面、TabBar 与图谱分包
│  ├─ app.tsx                       # 全局生命周期、隐私授权
│  ├─ pages/
│  │  ├─ workbench/                 # AI 工作台
│  │  ├─ home/                      # 首页看板
│  │  ├─ library/                   # 资源库
│  │  ├─ library-detail/            # 库详情与物品管理
│  │  ├─ intake/                    # 拍照/选图与视觉识别
│  │  ├─ chat/                      # AI 对话与确认卡
│  │  ├─ plans/                     # 方案与核销
│  │  ├─ alerts/                    # 临期、低库存与保修预警
│  │  ├─ shopping/                  # 采购清单
│  │  ├─ graph/                     # 资源图谱独立分包
│  │  ├─ mine/                      # 设置、同步、分享与账户
│  │  └─ login/                     # 验证码登录
│  ├─ components/                   # 可复用列表、卡片、空态与输入组件
│  ├─ services/
│  │  ├─ api.ts                     # 本地资源域与 RPC 风格业务接口
│  │  ├─ auth.ts                    # 邮箱验证码与后端登录
│  │  ├─ agnes.ts                   # AI 网关/客户端 Key 代理
│  │  ├─ ai.ts                      # 意图路由、快速回答与工具编排
│  │  ├─ commands.ts                # 自然语言命令白名单
│  │  ├─ graph.ts                   # 端侧图谱构建
│  │  ├─ graphQuery.ts              # 图谱查询算子
│  │  ├─ graphRag.ts                # GraphRAG 证据装配
│  │  ├─ livesync.ts                # 流转与实时同步
│  │  └─ exportcsv.ts               # CSV 导出与文件分享
│  ├─ store/                        # Zustand 全局状态
│  ├─ data/                         # 演示种子数据与知识库
│  ├─ styles/                       # 主题、变量与兼容样式
│  └─ assets/                       # Logo、TabBar 图标与示例照片
├─ docs/                            # 整改、验收、后台填报和品牌资料
├─ dist/                            # 微信小程序编译产物
├─ project.config.json              # 微信开发者工具工程配置
└─ package.json
```

## 5. 总体架构

小程序采用“页面层 -> 状态层 -> 业务服务层 -> 网络/本地存储”的分层结构。

```text
React 页面 / 组件
        │
        ▼
Zustand useStore
        │
        ▼
services/api.ts（库存、方案、预警、采购、协作）
        │
        ├─ Taro 本地存储（演示工作区、离线快照）
        ├─ services/auth.ts -> 后端 /api/auth/*
        ├─ services/agnes.ts -> 后端 /api/ai/*
        └─ services/livesync.ts -> 流转/同步接口
```

页面只负责展示和交互，数据修改统一经过服务层，避免不同页面直接改同一份数据。`useStore` 在异步操作完成后刷新 `db` 和 `stats` 快照，用于触发 React 重渲染。

## 6. 页面与功能

| 页面 | 核心功能 | 主要源码 |
|---|---|---|
| AI 工作台 | AI 对话、指令胶囊、语音播报入口、来源标识 | `src/pages/workbench/index.tsx` |
| 首页 | 库存总量、临期数、健康度、趋势、日常摘要 | `src/pages/home/index.tsx` |
| 资源库 | 分类库、搜索、排序、库详情入口 | `src/pages/library/index.tsx` |
| 库详情 | 物品增删改、数量调整、CSV 导出 | `src/pages/library-detail/index.tsx` |
| 拍照入库 | 相机/相册、示例照片、真实视觉识别、字段修正、确认入库 | `src/pages/intake/index.tsx` |
| AI 对话 | 流式结果展示、调整确认卡、采购写入确认 | `src/pages/chat/index.tsx` |
| 方案 | 临期优先方案、勾选执行、撤销与采购缺料 | `src/pages/plans/index.tsx` |
| 预警 | 临期、过期、低库存、药品与保修预警 | `src/pages/alerts/index.tsx` |
| 采购清单 | 缺料合并、低库存补充、去重 | `src/pages/shopping/index.tsx` |
| 资源图谱 | 节点、边、社区、关系路径 | `src/pages/graph/index.tsx` |
| 我的 | 主题、预算、提醒、服务器连接、同步、分享、注销 | `src/pages/mine/index.tsx` |
| 登录 | 验证码申请与登录、后端状态提示 | `src/pages/login/index.tsx` |

`pages/graph` 放入独立分包，主包不加载图谱页面，降低首屏体积。

## 7. 核心业务数据流

### 7.1 拍照入库

```text
chooseMedia
  -> 读取临时图片 base64
  -> POST /api/ai/vision
  -> 结构化物品数组
  -> 页面可编辑字段
  -> api.addItems()
  -> 本地库存快照
  -> 预警与统计重算
```

当前 `src/pages/intake/index.tsx` 始终执行真实视觉识别，不再回退到模拟识别数据。后端或模型不可用时直接提示识别失败；“示例照片识别”也使用同一真实视觉接口，只固定输入图片，不伪造识别结果。

“示例照片识别”使用仓库内 `src/assets/fridge.jpg`，走同一真实视觉接口，便于评审稳定演示；它不是跳过 AI 的假结果。

### 7.2 AI 对话

```text
用户文本
  -> 自然语言命令白名单
  -> 本地敏感词拦截
  -> 意图路由
  -> 本地快答 / GraphRAG 证据装配
  -> 单次模型调用
  -> 回复与来源标识
```

高频事实问题优先本地回答，例如“鸡蛋放哪”“牛奶还剩多少”“保质期多久”。这类问题不调用模型，数字直接取自库存与知识库。

需要模型表达的问题交给后端 `/api/ai/chat`。模型只负责组织和润色证据，不能改写库存数值。

### 7.3 写操作确认

`adjust`、`shopping_add`、`plan_create` 等写操作必须经过：

```text
识别意图 -> 生成预览卡 -> 用户确认 -> 执行 -> 记录日志 -> 可撤销
```

模型不能直接修改库存。确认卡显示原值、目标值和原因，页面明确提示“操作尚未执行”。

### 7.4 方案核销

1. 方案生成器按“临期优先 -> 清库存 -> 营养均衡”排序。
2. 用户勾选本轮实际使用的食材。
3. 核销时扣减对应库存并保存快照。
4. 缺料自动合并到采购清单。
5. 用户可撤销本轮核销，库存按快照恢复。

## 8. AI 能力接入

### 8.1 调用策略

`src/services/agnes.ts` 支持两种通道：

1. 自建后端网关 `/api/ai/chat`、`/api/ai/vision`，Key 保存在服务端环境中。
2. 客户端 Key 代理：小程序通过本机自建网关的 `/api/ai/chat`、`/api/ai/vision` 发送明文 `x-agnes-key`，后端使用该 Key 请求 Agnes；微信端无需直接访问第三方证书链。

默认优先自建网关，也可以在“我的 -> 服务器连接”切换为厂商直连。客户端 Key 以明文保存在本机 `.env` 和 Storage 中，界面输入框默认掩码显示；构建时 Taro 会将 `TARO_APP_AI_KEY` 内联进产物。Windows 微信会拒绝 Agnes 厂商域名证书，直连失败后自动回退到携带同一客户端 Key 的本机网关。全部通道都不可用时会明确报错，并只展示可由本地图谱直接证明的事实，不生成伪模型回答。

### 8.2 视觉识别

后端视觉接口接受 `imageBase64`，返回：

```json
[
  {
    "name": "鸡蛋",
    "category": "生鲜",
    "qty": 6,
    "unit": "个",
    "pos": "冷藏区",
    "expDays": 14,
    "price": 12.9
  }
]
```

页面会把结果映射为 `IntakeResult`，补齐知识库键、图标、保质期和待确认状态，再由用户确认入库。

### 8.3 GraphRAG

端侧图谱按物品、家庭库、位置、食品概念和菜谱关系构图。`graphRag.ts` 根据问题选择 `fast`、`local`、`global`、`multi-hop` 或 `tool` 模式，并把证据行、关系路径和图谱版本传给模型。

约束是“模型可以表达，不能造数”：模型回答必须基于代码计算出的证据。

### 8.4 内容安全

发送前做本地敏感词兜底，再调用后端 `/api/security/check`。配置微信 `WX_APPID/WX_SECRET` 后，后端可接入 `msgSecCheck`；未配置时本地前置拦截仍生效。

## 9. 登录、密码与权限

### 9.1 验证码登录

`src/services/auth.ts` 使用以下契约：

```text
POST /api/auth/code
POST /api/auth/login
```

验证码连续次数、过期时间和服务端令牌均由后端控制，登录失败会直接提示，不再进入固定验证码或本地假登录流程。

### 9.2 密码安全

后端密码不使用明文、MD5 或单次 SHA，而使用：

- `scrypt` 迭代式内存硬慢哈希；
- 每用户 16 字节随机盐；
- `N=16384, r=8, p=1, keylen=64`；
- 自描述存储串 `scrypt$N=...$salt$hash`；
- 校验时使用 `timingSafeEqual` 降低时序攻击风险。

小程序端保存的是登录状态与短期业务快照，不保存用户密码。

### 9.3 角色权限

演示工作区保留管理员、成员、只读三种角色。只读账号在写操作前由 `guard()` 拒绝，避免仅靠按钮隐藏实现权限控制。

## 10. 微信生态能力

| 能力 | 实现位置 | 当前状态 |
|---|---|---|
| 相机/相册 | `chooseMedia` | 已实现 |
| 分享 | 页面分享回调与卡片入口 | 已实现 |
| CSV 导出 | `exportcsv.ts` | 已实现 |
| 订阅消息 | 设置与预警入口 | 代码路径已预留，模板 ID 需在微信后台申请后配置 |
| 语音转文字 | 工作台入口 | 依赖插件权限，未授权时隐藏或降级 |
| 语音播报 | `/api/ai/tts` | 后端配置 `TTS_ENDPOINT` 后启用 |
| 流转同步 | `flow-bridge.js` 与 `livesync.ts` | 需同时启动 3000 与 3100 服务 |
| 内容安全 | `/api/security/check` | 本地兜底可用，微信内容安全需配置 AppID/Secret |

## 11. 本地存储

| 存储键 | 内容 |
|---|---|
| `nexcore_weapp_db_v1` | 库、物品、方案、预警、日志、预算等业务快照 |
| `nexcore_weapp_cloud_v1` | 本地模拟的云端版本快照 |
| `nexcore_weapp_logged_in` | 登录状态 |
| `nexcore_ai_cfg_v1` | AI 服务地址、模型、直连配置与客户端 Key |
| `nexcore_summary_rate_v1` | 社区摘要限流时间戳 |

`api.ts` 中明确区分“可持久化的资源数据”和“可重置的演示种子数据”。正式部署时，应由后端持久层替换本地演示快照。

## 12. 隐私与合规

- `app.tsx` 注册 `onNeedPrivacyAuthorization`，相机与相册使用前给出用途说明。
- 图片仅用于物品识别与入库展示。
- AI 生成或识别结果在界面标注来源与“需人工确认”。
- 正式提审前必须在微信公众平台补全服务类目、隐私保护指引和体验说明。
- 当前工程没有声称已通过审核或已发布体验版；提交材料只记录本地构建、开发者工具运行和后端联调结果。

## 13. 构建与验证结果

2026-10-24 最新构建：

```text
npm run build:weapp
Compiled successfully in 29.71s
```

当前 `dist/` 统计：

- 文件数：74
- 总字节：1,008,435
- 约 0.962 MiB / 1.01 MB

真实视觉接口实测：

- 输入：`web/NexcoreGraph_web/assets/img/fridge.jpg`
- 模型：`agnes-2.5-flash`
- 返回物品：6 项
- 耗时：约 2.7 秒
- 示例结果：鸡蛋、番茄、牛奶等

Agnes 客户端 Key 代理实测：

- `agnes-2.5-flash`：HTTP 200，内容 `OK`
- `agnes-3.0-flash`：HTTP 200，内容 `OK`
- 小程序“测试连接”：`agnes-2.5-flash` 约 405ms
- 小程序真实方案问答来源：`agnes-2.5-flash（厂商直连）+ GraphRAG`；Windows 微信直连被证书链拦截时，自动回退到本机网关并使用同一客户端 Key。
- 工具栏曾因漏发 `Authorization: Bearer` 出现 401，现已修复并在小程序运行时复测通过

## 14. 已知边界与提交前检查

1. 当前分包源码位于 `src/pages/graph`，构建后图谱页由独立分包加载。
2. 本地业务存储仍是可重置的演示工作区；正式多用户持久化应接后端数据库或云开发。
3. 后端 `/api/auth/*`、`/api/ai/*` 联网才提供真实账号与模型能力；后端/模型失败时只展示本地图谱事实或明确报错，不伪造模型输出。
4. 订阅消息模板 ID、`WX_APPID/WX_SECRET`、`TTS_ENDPOINT` 属于外部配置，不写入仓库。
5. 微信开发者工具应使用新版；旧版 1.06 的 `enableUpdateWxAppCode` 错误不可作为业务缺陷处理。
6. 正式提交前必须替换 `touristappid` 为团队真实 AppID，并重新完成体验版预览。
7. 不把 `.env`、API Key、邮箱授权码、`node_modules` 或开发者工具私有配置打进参赛 ZIP。

## 15. 最近代码变更

| 变更 | 文件 | 目的 |
|---|---|---|
| 后端验证码成功后进入已校验工作区 | `src/store/useStore.ts`、`src/services/api.ts`、`src/pages/login/index.tsx` | 避免真实验证码被本地演示码重复拦截 |
| 拍照入库接入真实视觉接口 | `src/pages/intake/index.tsx`、`src/services/agnes.ts` | 从模拟识别升级为 `/api/ai/vision` |
| 增加示例冰箱照片 | `src/assets/fridge.jpg` | 保证评审演示可稳定触发真实视觉识别 |
| 移除模拟结果回退 | `src/pages/intake/index.tsx`、`src/services/ai.ts` | 后端或模型失败时明确报错，不用模板内容冒充真实模型输出 |
| 新增代码说明 | `NexcoreGraph_wxminiapp-代码说明.md` | 提供工程维护与答辩引用依据 |

## 16. 快速排障

### 页面白屏或基础库报错

先升级微信开发者工具，再将基础库设为 `3.17.3` 或更高。确认 `project.config.json` 的 `miniprogramRoot` 是 `dist/`。

### 登录页显示“未找到本机后端”

启动后端，确认 `http://127.0.0.1:3000/api/health` 返回 `ok: true` 与 `ai: ready`。在“我的 -> 服务器连接”修改地址后重试。

### 拍照识别失败

确认后端视觉接口可用；开发工具中可点“示例照片识别”。识别失败表示真实视觉接口不可用，应检查后端和 Key，不允许用本地模拟内容替代模型结果。

### 分享或导出失败

CSV 导出依赖用户目录与微信文件分享能力；开发者工具与真机行为可能不同，最终以真机预览为准。
