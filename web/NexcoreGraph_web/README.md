# 启核图策 · Web 端（用户端 + 管理员端）

启核图策 NexcoreGraph Web 端是面向家庭资源管理的 AI 原生工作台，覆盖拍照入库、资源库、临期预警、临期救援、AI 方案、协作与管理员端。当前交付采用零构建 HTML/CSS/JS，浏览器即可运行。

本轮针对评审反馈新增“临期救援驾驶舱”：用确定性多目标求解器计算菜谱匹配、临期程度、缺料与时间约束，提供 Pareto 非支配候选、1–3 道菜组合编排、反事实沙盘和完整决策轨迹。

“家庭智策”不再只围绕食品。当前业务覆盖食材、药箱、健身器材、维修工具、家电、衣橱、书籍、宠物用品、清洁耗材和其他资源，并提供全屋资源数、库存估值、生活资产和跨域风险汇总。药箱、训练、保修、维护、借出与归还各自使用独立规则，跨域问答由本地确定性汇总生成，不依赖模型在线。

## 一、项目文件结构

```
webapp/
├─ index.html            用户端入口（登录 / 看板 / 资源库 / 拍照入库 / AI 对话 / 方案 / 预警 / 采购 / 协作工作台 / 全局搜索 / 设置）
├─ admin.html            管理员端入口（同仓库独立入口，F10）
├─ design-tokens.json    设计令牌单一来源（与 web-demo 一致）
├─ css/
│  ├─ tokens.css         品牌色板与深浅色设计令牌
│  ├─ app.css            基础组件与页面布局
│  └─ extra.css          增量样式：相机 / 救援驾驶舱 / 预览卡 / 管理端
├─ js/
│  ├─ data.js            空业务初始状态与界面默认值
│  ├─ knowledge.js       食材保质期 25 项 / 菜谱 16 道 / 存放规则 10 条
│  ├─ rescue.js          临期救援求解器（纯函数：排序、Pareto、组合约束）
│  ├─ rescue-view.js     救援驾驶舱、反事实沙盘、决策回放和写操作预览
│  ├─ domains.js         药箱、健身、器具借用、家电保修、生活资产与全屋风险算法
│  ├─ domain-view.js     家庭智策全景、食材、药箱、健身、工具家电与生活资产交互
│  ├─ mockapi.js         业务状态层：校验、日志、持久化、执行与撤销
│  ├─ ai-providers.js    OpenAI Compatible / Anthropic / Gemini 多平台请求适配
│  ├─ agnes.js           AI 双通道、健康探测、超时与错误分类
│  ├─ graph.js          个人资源图谱构图与检索算子
│  ├─ graph-rag.js      证据装配、GraphRAG 和社区摘要
│  ├─ ai.js              AI 编排层（P0-1 意图路由 / P0-2 受约束工具 / P0-3 营养标注+创新菜谱 / P0-6 简报）
│  ├─ app.js             用户端交互与视图（复用原型全部组件与动效）
│  └─ admin.js           管理员端（用户 / 家庭 / 审计 / AI 用量 / 系统配置 / 知识库管理）
├─ tests/rescue.test.js  救援求解器单元测试
├─ CODE-STYLE.md         模块边界、编码规范与提交规则
└─ assets/img/           品牌与演示图片（复用基准）
```

## 二、已实现功能对照（按完整文档 F1-F10）

| 模块 | 实现 |
|---|---|
| F1 拍照入库 | `getUserMedia` 真实摄像头 + 拖拽/多选上传；识别 → 补缺确认 → 入库；连拍 ≤6 张同名合并（D3）；待归类（F1.4）；价格/保质期来源标注（F1.5/F1.6）。视觉识别通过 `/api/ai/vision` 或本机直连配置调用真实多模态模型 |
| F2 资源库 | 8 个内置库全带物品；库增删改名排序/拖拽（软删可撤销）；物品 CRUD、数量步进、私有可见性（F2.5）；CSV 导入导出（F2.6，兼容 Excel）；260ms 防抖全局搜索 +「XX 放哪了」AI 定位（F2.4） |
| F3 规划预警 | 知识库驱动 2-3 个方案，固定优先级：临期优先 > 清库存 > 营养均衡（F3.8/D2）；营养速览（约，估算）与 AI 创新菜谱（P0-3）；预警引擎全库扫描：临期 3/7 档可配置、过期、低库存（D4 `lowAt`）、药品有效期、家电保修期；采购清单自动合并去重（F3.6） |
| F5 自然语言对话 | 意图路由：greet/where/qty/expiry/rescue 本地快答（0 次模型）；cook/creative/nutrition/summary 经 GraphRAG 证据装配后调用网关或厂商直连；「鸡蛋只剩 5 个」→ 调整预览卡 → 确认生效（F5.5/P0-2）；`shopping_add` 工具；Web Speech 语音输入（F5.3）；聊天仅本地 ≤200 条滚动（P0-5/D5） |
| F6 数量变更 | 勾选核销按勾选项扣减；操作日志全留痕（F6.4）；方案撤销回滚 + 最近操作撤销（F6.3） |
| F7 数据看板 | KPI/趋势/环形图/健康度全部代码实时计算，趋势与日志可对账；AI 简报手动触发，统计代码算、模型仅润色（P0-6/K9）；预算管理（D6，默认 600） |
| F9 家庭协作 | 邮箱验证码登录，角色 管理员/成员/只读（只读禁写 F9.2）；成员移除；限时邀请码生成/复制/撤销（F9.3）；牌桌协作传库/合并/结束清理（F9.6-F9.9）；同步：全量快照 + 版本号，可演示 409 冲突二选一（F9.10/D1/G2） |
| F10 管理员端 | 独立入口 `admin.html`（管理员角色鉴权）：用户管理（禁用/启用）、家庭管理（容量/成员/邀请码）、数据审计（日志 + 云端快照）、AI 用量（次数/费用/限流）、系统配置（模型/联网开关/识别阈值/推送模板）、知识库管理（编辑 + 保存草稿 + 版本发布） |
| F11 临期救援 | 确定性多目标评分、Pareto 非支配集、1–3 道菜约束组合、1/15/30/60 分钟沙盘、反事实排除、推荐依据、步骤与替代建议、预览确认、执行撤销和累计救回统计 |
| F12 家庭智策 | 全屋全景显示总资源、估值、生活资产与跨域风险；食材进入 Pareto 救援；药箱扫描有效期、过期与低库存；健身根据身高体重/年龄/目标/水平/周频次和现有器材生成 BMI、目标心率与训练日；工具家电扫描保修、维护、借用人和归还期限；衣橱、书籍、宠物用品、清洁耗材提供数量、估值、临期与低库存汇总；跨域 AI 回答覆盖资产、借出和风险 |
| F13 多平台模型接入 | 内置 OpenAI、DeepSeek、通义千问、Moonshot、Claude、Gemini、智谱、SiliconFlow、Ollama 与自定义网关模板；可编辑 Base URL、文本模型、备用模型、视觉模型、上下文窗口、最大输出、超时、通道策略和 API Key；自动适配三种请求协议，主模型 429/5xx 时只重试一次备用模型，Key 掩码显示且不进入同步快照 |

## 三、部署运行步骤

1. 环境要求：现代浏览器（Chrome / Edge 优先）、Python 3.10+（仅用于启动静态服务），以及可选的自建 AI 后端。
2. 直接双击 `index.html` 可查看界面；登录与邮箱验证码需要启动后端。
3. **推荐用仓库内置安全静态服务**（摄像头 `getUserMedia` 需要 HTTPS 或 localhost）：
   - 在仓库根目录执行 `python tools/serve_web.py --root web/NexcoreGraph_web --port 8080`
   - 浏览器访问 `http://127.0.0.1:8080`
   - 服务会拒绝 `.env`、点文件、目录列表和路径穿越；不要改用会公开目录的临时服务器
   - VS Code：安装 Live Server 插件 → 右键 index.html → Open with Live Server
4. 不要将 `.env` 放进 Web 静态目录。打开“设置 → 服务器连接 · AI 通道”，可选择主流平台、填写 Base URL、文本/视觉模型和 API Key；公网部署推荐在自建后端配置真实 Key。浏览器不会下载 dotenv 文件。
5. 登录使用邮箱和真实邮件验证码。评审账号在后端数据库中创建，不在前端硬编码固定验证码。
6. 管理员端：访问 `admin.html`，使用管理员邮箱完成验证码登录。
7. 救援功能 30 秒体验：登录 → AI 工作台“今晚先救哪几样” → 临期救援 → 查看组合菜单与推荐依据 → 预览并执行 → 在方案页撤销。

## 四、测试与验收

```powershell
cd web/NexcoreGraph_web
node --check js/domains.js
node --check js/domain-view.js
node --check js/mockapi.js
node --check js/ai-providers.js
node --check js/agnes.js
node --check js/ai.js
node --check js/app.js
node --test tests/*.test.js

cd ../..
python tools/verify_rescue_web.py `
  --url "http://127.0.0.1:8080/index.html#/rescue" `
  --domain-shot "web/NexcoreGraph_web/qa/shots/17-family-domains.png" `
  --overview-shot "web/NexcoreGraph_web/qa/shots/18-household-overview.png" `
  --assets-shot "web/NexcoreGraph_web/qa/shots/19-life-assets.png" `
  --settings-shot "web/NexcoreGraph_web/qa/shots/20-ai-providers.png"

python tools/verify_admin_web.py "http://127.0.0.1:8080/admin.html"
```

端到端脚本会在临时浏览器中注入九个生活域的评审数据，验证导航、筛选、决策抽屉、预览、执行、撤销、库存 CRUD、搜索、药箱、健身身体数据、工具借用、生活资产、跨域 AI、多平台配置切换和移动端溢出；不会污染本机浏览器数据。

## 五、团队信息

| 成员 | 分工 |
|---|---|
| 高俊杰 | Qt / 鸿蒙 / 安卓，罗渝川辅助 |
| 杨欢 | Web / 小程序，查豪霆辅助 |

## 六、环境变量

| 变量 | 用途 | 是否必填 |
|---|---|---|
| `NEXCORE_API_BASE` | 自建 AI 后端地址；留空时自动探测同源与 localhost:3000 | 否 |
| `AGNES_API_KEY` | 自建网关兼容变量名；服务端填写真实 Key，Web 设置页也可给本机直连保存 Key | 使用网关或直连时必填 |
| `AGNES_MODEL` | 自建网关使用的模型 ID；不再限定单一厂商 | 否 |
| `AGNES_VENDOR_BASE` | 自建网关的 OpenAI Compatible Base URL | 否 |
| `AGNES_CHAT_TIMEOUT_MS` | 对话超时，默认 30000ms | 否 |
| `AGNES_VISION_TIMEOUT_MS` | 视觉识别超时，默认 45000ms | 否 |

## 七、注意事项

- **数据存储**：业务状态使用 `nexcore_web_db_v3` 持久化；初始业务库为空，登录后由后端快照恢复。聊天/库存刷新不丢，图片以压缩缩略图存储。
- **AI 说明**：文本链路支持“自建网关优先 + 厂商直连回落”，视觉走 `/api/ai/vision`。临期救援的库存匹配、排序、缺料和估值均为确定性代码计算，模型只解释；失败时仍保留规则结果，不冒充模型输出。
- **多平台说明**：设置页提供 13 个平台/自定义模板，支持 OpenAI Compatible、Anthropic Messages 和 Gemini GenerateContent。平台预设只填默认值，Base URL、文本模型、视觉模型和超时均可手改。完整矩阵见 [AI模型多平台接入与自有工程复用.md](../../docs/AI模型多平台接入与自有工程复用.md)。
- **多域说明**：全屋资源数、估值、生活资产、风险域、药箱临期、训练指标、保修与借出倒计时均由 `domains.js` 计算。药品只做库存、有效期、存放和安全提醒，不提供处方或诊断。
- **AI 行为红线自查**：数量/位置/日期一律本地查询产出；`[调整]`/`shopping_add` 均为预览确认制；简报数字与看板同源（`computeStats`）。
- **HTTPS**：生产部署必须 HTTPS（摄像头 / Web Push / Service Worker 依赖）。
- **技术栈说明**：当前交付采用免构建原生 HTML/CSS/JS，模块边界为“纯算法 / 状态层 / 证据层 / 视图层”。Vue 3 + Vite + Pinia 是后续工程化方向，不计入当前已实现能力。
- **未做（按文档为可选项/后续里程碑）**：PWA/Service Worker 离线缓存、Web Push 推送、Excel(xlsx) 二进制解析（CSV 已兼容 Excel）、大屏全屏看板模式、ECharts 替换内联 SVG 图表（当前 SVG 与原型视觉一致且零依赖）。
