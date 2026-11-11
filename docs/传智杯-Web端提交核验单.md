# 启核图策 NexcoreGraph · Web 端提交核验单

> 核验日期：2026-11-11
> 赛道：2026 第九届传智杯 · AI WEB 网页开发挑战赛
> 代码分支：`codex/web-competition-submission`

## 一、提交材料状态

| 官网要求 | 状态 | 证据与位置 | 提交前动作 |
|---|---|---|---|
| GitHub/Gitee 代码仓库 | 已推送，匿名访问仍为 404 | 远端 `https://github.com/yan-stone-computer/NexcoreGraph.git`；分支 `codex/web-competition-submission` 当前提交为 `92ae7f7` | 仓库当前不公开；提交前必须设为 Public，或向评审提供访问权限 |
| 代码结构清晰、有效注释、主流规范 | 已满足 | `README.md`、`web/NexcoreGraph_web/README.md`、`web/NexcoreGraph_web/CODE-STYLE.md`、模块头注释 | 无 |
| README 项目介绍、架构、运行、团队 | 已满足 | `README.md` 与 Web README | 提交前再跑一次链接检查 |
| 完整 Git 提交历史 | 已整理并推送 | Web、三端、文档、测试和仓库卫生按主题分组提交；多平台模型接入已作为独立主题提交并推送 | 在已授权账号下确认提交图；匿名 API 仍为 404 |
| 环境变量模板 | 已满足 | `web/NexcoreGraph_web/.env.example` | 不得上传真实 `.env` |
| 依赖清单 | 已满足 | Web 运行仅需现代浏览器 + Python 静态服务；测试需 Node 24；技术文档构建需 Python/docx/ReportLab/LibreOffice | 无 |
| 技术文档 PDF | 已生成并逐页栅格复核 | `deliverables/传智杯_Web端_提交材料_20261111/01_技术文档/启核图策-Web端技术文档.pdf`，实测 28 页 | 复核通过，含全屋多域、多平台模型接入和自有工程复用；提交前留档哈希 |
| AI 选型、集成与优化 | 已覆盖 | 技术文档“AI 技术方案”“临期救援”“家庭智策”“GraphRAG”“Agent 与安全”章节 | 无 |
| 技术创新点 | 已覆盖 | Pareto 非支配集、组合约束菜单、反事实沙盘、决策回放、全屋跨域风险去重、本地确定性多域问答 | 无 |
| 应用创新点 | 已覆盖 | 从食材扩展到药箱、健身、工具借用、家电保修、衣橱、书籍、宠物与清洁耗材 | 无 |
| 演示视频 5–8 分钟、1080p、普通话 | 本轮暂缓 | 用户确认暂时不需要视频 | 后续按 `docs/Web端-演示视频脚本.md` 录制 |
| 在线演示 | 可选，未提供 | 当前不伪造在线地址 | 如部署，需保持评审期可用并提供体验账号 |

## 二、敏感信息核验

运行：

```powershell
python tools/check_repo_hygiene.py
```

核验结果应满足：

```json
{
  "ok": true,
  "secrets": [],
  "largeFiles": [],
  "missingRequiredFiles": []
}
```

说明：扫描覆盖仓库中将被提交的文本文件；`deliverables/`、视频、ZIP、`.env`、依赖目录和临时转换目录不会进入源码 Git 历史。

Web 静态服务必须使用 `python tools/serve_web.py --root web/NexcoreGraph_web --port 8080`。浏览器不再读取 dotenv；服务对 `/.env`、`/.env.example`、路径穿越和目录列表均返回 404。

## 三、自动化验收

```powershell
cd web/NexcoreGraph_web
node --test tests/*.test.js
```

预期：23 项 Web 单元测试全部通过。

```powershell
cd ../..
python tools/verify_rescue_web.py `
  --url "http://127.0.0.1:8080/index.html#/rescue" `
  --domain-shot "web/NexcoreGraph_web/qa/shots/17-family-domains.png" `
  --overview-shot "web/NexcoreGraph_web/qa/shots/18-household-overview.png" `
  --assets-shot "web/NexcoreGraph_web/qa/shots/19-life-assets.png"
```

预期：

- 导航、筛选、决策抽屉、写操作预览、执行与撤销全部为 `true`。
- 药箱、健身、工具借用、生活资产、全屋风险、跨域 AI 与对应预警全部为 `true`。
- `consoleErrors` 为空。
- `tabletOverflowX` 与 `mobileOverflowX` 均为 0。
- 无模型 Key 时仍可通过确定性求解器完成主流程。

## 四、技术文档核验

```powershell
python -c "from pathlib import Path; import pymupdf; p=next(Path('deliverables').glob('*Web*/*/*技术文档.pdf')); print(len(pymupdf.open(p)))"
```

要求：页数不超过 30。本次实测 28 页，多平台模型接入、家庭智策表格、图表、页眉页脚与 10 个生活域说明均已逐页检查。

## 五、Git 仓库核验

```powershell
git status --short
git log --oneline --graph --decorate -20
git remote -v
```

要求：

1. 当前分支为 `codex/web-competition-submission`，已设置跟踪 `origin` 同名分支。
2. 源码改动按主题提交，而不是一个笼统的“最终版”提交。
3. `deliverables/`、`node_modules/`、`.env`、视频和 ZIP 不进入源码历史。
4. 推送到远端后，在 GitHub/Gitee 页面确认提交图和 Public/评审权限。

启动、性能、真实 AI 降级和跨端复核证据见 `docs/Web端-启动与多轮复核报告.md`。
本地、局域网和公网 HTTPS 部署步骤见 `docs/Web端部署指南.md`，配套模板位于 `deploy/`。

## 六、演示主路径

1. 使用评审邮箱登录。
2. 打开 AI 工作台，查看“今晚先救哪几样”。
3. 打开“家庭智策 → 全景”，展示全屋资源、估值、生活资产和跨域风险。
4. 依次展示药箱风险、健身身体数据与训练方案、工具借用/保修、生活资产。
5. 询问“全屋生活资产和借出情况怎么样”，展示 0 次模型调用的跨域回答。
6. 进入“临期救援驾驶舱”，切换模式并修改时间、菜数、缺料或排除食材。
7. 查看推荐依据、Pareto 标识、被支配原因、步骤和替代建议。
8. 预览今晚菜单，确认前说明“不会扣减库存”；执行后撤销并验证库存恢复。

## 七、仍需用户处理

- 确认远端仓库 Public 或提交评审访问权限。
- 如需要在线演示加分项，部署 Web 与后端并生成评审专用账号。
- 后续录制 5–8 分钟 MP4 视频；本轮不提交视频。
- 在官网最终提交后不得再修改材料，请先完成冻结检查和 SHA256 留档。
