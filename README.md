# 启核图策 NexcoreGraph

> 多域家庭资源数字孪生 —— 食品 · 药品 · 健身器材 · 工具 · 可审计 Agent
> 参赛：**2026 第九届传智杯全国大学生数智创新与 AI 应用大赛**（AI WEB 网页开发 / AI 微信小程序开发 / HarmonyOS Codelabs 三个赛道）
> 团队：高俊杰（Qt / 鸿蒙 / 安卓，罗渝川辅助）；杨欢（Web / 小程序，查豪霆辅助）

---

## 一、仓库结构

| 目录 | 端 | 技术栈 | 当前状态 |
|---|---|---|---|
| `website/` | 官方展示站 | 零依赖 HTML / CSS / JS | 已完成响应式官网、真实界面切换、GraphRAG 可视化与工程证据页 |
| `harmonyosapp/NexcoreGraph_harmonyos` | 鸿蒙（主力端） | ArkTS + ArkUI（HarmonyOS NEXT / API 23）+ Node 后端 + MySQL | 多域资源模型、身体数据训练、AI 网关、8 类模型平台适配、GraphRAG、应用接续、多端同步、4 张服务卡片已实现；待补签名 HAP 与双机真机证据 |
| `web/NexcoreGraph_web` | Web 用户端 + 管理员端 | 当前：免构建原生 HTML/CSS/JS；Node 24 仅用于测试 | 已实现多平台模型接入、AI 网关/平台直连、GraphRAG、视觉识别、临期救援 Pareto、全屋多域智策、管理员端和浏览器验收。平台层支持 OpenAI Compatible、Anthropic Messages、Gemini GenerateContent 与自定义网关 |
| `wxminiapp/NexcoreGraph_wxminiapp` | 微信小程序 | Taro 4.1.9 + React 18 + TypeScript + Sass + zustand | 10 页可编译（0.55MB）、AppID 已配置；待补：接真实模型与流式、协作工作台页、订阅消息/分享、隐私与内容安全合规 |
| `androidapp/` | 安卓 | Kotlin + Jetpack Compose（规划） | **空目录**，待迁入 |
| `desktopapp/` | Qt 桌面 | C++ + Qt 6 + QML（规划） | **空目录**，待迁入 |
| `docs/` | 文档 | — | 三份赛道专项整改与验收文档 + 小程序后台填报清单 + **AI 主导与 GraphRAG 补充方案（单文件）** |

---

## 二、快速开始

### 官网

```bash
python -m http.server 8095
# 浏览器打开 http://127.0.0.1:8095/website/
```

### 鸿蒙端

```bash
cd harmonyosapp/NexcoreGraph_harmonyos
# 用 DevEco Studio 5.x 打开工程（API 12 / NEXT）
# 后端（可选，同步与登录用）：
cd backend && npm install && start.bat      # 默认 0.0.0.0:3000，需本机 MySQL
```

### Web 端（用户端 + 管理员端）

```bash
cd web/NexcoreGraph_web
cd ../..
python tools/serve_web.py --root web/NexcoreGraph_web --port 8080
# 浏览器打开 http://127.0.0.1:8080 （用户端）与 http://127.0.0.1:8080/admin.html （管理员端）
# 登录使用邮箱 + 后端真实邮件验证码；新版不再使用固定演示码
```

评审账号需在后端数据库中创建，并通过真实邮箱接收验证码，避免公开仓库泄露固定测试凭据。

### Web 端自动测试

```powershell
cd web/NexcoreGraph_web
node --test tests/*.test.js
cd ../..
python tools/verify_rescue_web.py --url "http://127.0.0.1:8080/index.html#/rescue"
```

部署、公网 HTTPS、Nginx 与管理端配置见 [docs/Web端部署指南.md](docs/Web端部署指南.md)。
正式演示、60 秒救场版、全功能操作分镜和评委问答见 [docs/submission/启核图策-Web端-评委冲击版全功能口播稿.md](docs/submission/启核图策-Web端-评委冲击版全功能口播稿.md)。
Web 多域业务、训练安全边界、全屋资产和借用规则见 [web/NexcoreGraph_web/README.md](web/NexcoreGraph_web/README.md)。
多平台模型配置、三种协议、密钥边界与自有 GitHub 工程复用矩阵见 [docs/AI模型多平台接入与自有工程复用.md](docs/AI模型多平台接入与自有工程复用.md)。
鸿蒙端多域资源、模型平台热配置与自有开源项目复用说明见 [docs/submission/开源复用与模型平台说明.md](docs/submission/开源复用与模型平台说明.md)。

### 微信小程序

```bash
cd wxminiapp/NexcoreGraph_wxminiapp
npm install
npm run dev:weapp        # 或用微信开发者工具直接打开本目录（miniprogramRoot=dist/）
npm run build:weapp      # 生产构建，产物 dist/
```

AppID：`wx9d1c625b399ecda3`（已写入 `project.config.json`）。

---

## 三、品牌规范

| 项 | 取值 |
|---|---|
| 中文名 / 英文名 | 启核图策 / **NexcoreGraph** |
| 定稿图标 | **E3**：四角取景框（识别）+ 折面地图（地图）+ 带节点路线与终点旗（规划）+ 官方圆徽标（绿 `#46B14C` → 青 `#2FD4B2` → 蓝 `#0CA8D6`，含顶部嫩芽与白色 N）作为框内元素之一 |
| 底色 | 深海军蓝 `#13172B` |
| 品牌资产 | `docs/brand/`：应用图标（1024/512/256/192/180/144/96/64/48/32）、圆角版、去底透明版、圆形头像、横版/竖版组合标（浅底+深底）、单色版、favicon.ico |
| 品牌规范 | `docs/启核图策-NexcoreGraph-品牌规范.md`（配色、留白、最小尺寸、禁忌、文件清单） |
| 本地存储键前缀 | `nexcore_` |

> 图标保持满幅深底，不自行加圆角或描边（平台自带遮罩）；≤32px 用 `icon-32` 或单色版；不改配色与渐变方向。

---

## 四、提交前检查清单

- [ ] `node_modules` / `dist` / `oh_modules` / `build` 未入库（见 `.gitignore`）
- [ ] 各端 `README` 与 `docs/` 文档与代码一致
- [ ] 小程序 AppID、服务类目、隐私保护指引已配置
- [ ] 后端 AI Key 只在服务端，端侧无 `sk-` 明文
- [ ] 演示截图/视频为最新品牌（启核图策 + 新 Logo）
- [ ] `androidapp` / `desktopapp` 如本期交付，需迁入代码与文档

---

## 五、自带验证工具（`tools/`）

| 工具 | 用途 | 用法示例 |
|---|---|---|
| `smoke_web.py` | Web 端冒烟检测（headless Edge + CDP）：标题、正文长度、横向溢出、关键文本、按钮/图片数、破图数、控制台异常，可截图 | `python tools/smoke_web.py --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html" --storage "nexcore_logged_in=1" --shot shot.png` |
| `serve_web.py` | 安全静态服务：拒绝 `.env`、点文件、目录列表与路径穿越 | `python tools/serve_web.py --root "web/NexcoreGraph_web" --port 8080` |
| `verify_rescue_web.py` | 救援求解器真实浏览器端到端与响应式验收 | `python tools/verify_rescue_web.py --url "http://127.0.0.1:8080/index.html#/rescue"` |
| `cleanup_headless_edge.py` | 清理本工具启动的 headless Edge 进程（按临时 profile 前缀识别，不影响正常浏览器） | `python tools/cleanup_headless_edge.py` |

小程序端验证：`cd wxminiapp/NexcoreGraph_wxminiapp && npm run build:weapp`（编译通过即视为产物可用，当前 66 文件 / 0.55MB）。

---

## 六、AI 主导与 GraphRAG 补充方案（规划稿，未实现）

> 定位：对《项目完整文档》与三份赛道整改文档的**补充方案**。核心主张是两句话——
> **① 为每个用户自己的库构建个人资源知识图谱，用它驱动 GraphRAG；② 把 AI 从"辅助面板"提升为"应用主体"。**
> 同时明确边界：**AI 主导交互与编排，代码主导事实与权限**（数值、写操作生效权、权限、模型预算、隐私边界不可让渡）。

方案文件：[docs/启核图策-AI主导与GraphRAG补充方案.md](docs/启核图策-AI主导与GraphRAG补充方案.md)（13 章 + 3 附录，单文件）

| 章节 | 内容 |
|---|---|
| 第 1–2 章 | AI 主体四判据与边界、与三红线的关系、五层架构、端云职责矩阵、AI 工作台信息架构、度量指标、降级 |
| 第 3–4 章 | 图谱本体（13 类节点 / 14 类边）、构图流水线（0 次模型）、检索算子、local/global/multi-hop 时序、离线社区摘要 |
| 第 5–6 章 | 图 JSON Schema、五端模块 API、REST 契约、同步与隐私分级、契约测试；后端五表与 Graph 服务 |
| 第 7–11 章 | 各端改造：鸿蒙（主力端）、Web（用户端 + 管理员端）、微信小程序、安卓、Qt 桌面 |
| 第 12–13 章 | G0–G5 / A1–A3 排期、46 条用例与红线回归、12 项风险、Q1–Q8 决策项 |
| 附录 A/B/C | 既有文档回写清单、降级预案与演示话术、术语 |

**与既有实现的关系**：M-7（AI 网关）、M-8（知识库 RAG 与来源）、M-9~M-11、M-13 均已落地，是本方案的**事实基座**；本方案新增的是 **G 系列**（图谱/GraphRAG）与 **A 系列**（AI 主体化）编号，不推翻既有红线与里程碑。
