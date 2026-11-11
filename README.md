# 启核图策 NexcoreGraph · Web 端

> 2026 第九届传智杯全国大学生数智创新与 AI 应用大赛
> 赛道：AI WEB 网页开发挑战赛
> 团队：天枢序列WEB（团队编号 38377）

启核图策是面向家庭资源管理的 AI 原生工作台。项目把照片、文字和表单输入转换为可查询、可推理、可执行、可撤销的家庭事实，覆盖食材、药箱、健身器材、工具家电、衣橱、书籍、宠物用品和清洁耗材。

## 项目介绍

核心能力：

- 拍照/上传识别、字段补缺和确认入库。
- 资源库 CRUD、库存增减、跨库搜索、执行与撤销。
- 临期救援 Pareto 多目标求解、组合菜单和反事实沙盘。
- GraphRAG 个人资源图谱与来源路径。
- 药箱有效期、健身训练方案、工具借用、家电保修与全屋资产风险。
- OpenAI Compatible、Anthropic Messages、Gemini GenerateContent 多平台模型接入。
- 受控 Agent：工具白名单、预览、确认、权限、审计和撤销。

## 技术架构

```text
页面 / 视图
  -> window.API 业务状态层
  -> AI 意图路由与 GraphRAG 证据层
  -> 自建网关 / 多平台模型适配器
  -> 确定性业务算法与本地快照
```

模型只负责理解、解释和生成草稿。库存数量、日期、Pareto 排序、训练指标、保修与借用风险均由代码计算；所有写操作必须经过用户确认。

## 目录

```text
web/NexcoreGraph_web/   Web 用户端、管理员端、静态资源和测试
docs/                   Web 端技术、部署、验收和口播材料
tools/                  Web 安全静态服务与浏览器验收脚本
deploy/                 Nginx 与后端服务模板
.ui-alchemy/            界面设计方向和质量约束
```

详细功能与模块说明见 `web/NexcoreGraph_web/README.md`。

## 安装与运行

环境要求：

- Chrome 或 Edge。
- Python 3.10+，用于安全静态服务。
- Node.js 24+，仅运行测试时需要。
- 后端与 MySQL 可选，用于真实登录、同步和服务端模型网关。

在仓库根目录执行：

```powershell
python tools/serve_web.py --root web/NexcoreGraph_web --port 8080
```

访问：

```text
http://127.0.0.1:8080/
http://127.0.0.1:8080/admin.html
```

Windows 也可双击 `web/NexcoreGraph_web/start.bat`。

## 测试

```powershell
cd web/NexcoreGraph_web
node --test tests/*.test.js

cd ../..
python tools/verify_rescue_web.py --url "http://127.0.0.1:8080/index.html#/rescue"
python tools/verify_admin_web.py "http://127.0.0.1:8080/admin.html"
```

## 环境变量

模板：`web/NexcoreGraph_web/.env.example`

浏览器不读取 `.env`。可在 Web 设置页填写平台、Base URL、文本/视觉模型、备用模型、超时和 API Key。
直连 Key 只保存在浏览器本机，不进入同步快照。公网部署建议使用服务端网关持有真实 Key。

## 代码规范

- 模块边界和提交规则见 `web/NexcoreGraph_web/CODE-STYLE.md`。
- 确定性算法与 DOM 分离，状态统一通过 `window.API` 访问。
- 数量、日期、排序和风险规则不由模型生成。
- 写操作必须保留预览、确认、日志和撤销能力。

## 团队信息

| 成员 | 分工 |
|---|---|
| 高俊杰 | 项目统筹、算法与跨端协作 |
| 周子琦 | 产品、测试与材料 |
| 杨欢 | Web 前端与交互实现 |

## 提交材料

- `docs/submission/启核图策-Web端-评委冲击版全功能口播稿.pdf`
- `docs/Web端-启动与多轮复核报告.md`
- `docs/Web端部署指南.md`
- `docs/AI模型多平台接入与自有工程复用.md`
