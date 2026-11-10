# 启核图策 NexcoreGraph · Web 端提交核验单

> 核验日期：2026-11-10
> 赛道：2026 第九届传智杯 · AI WEB 网页开发挑战赛
> 代码分支：`codex/web-competition-submission`

## 一、提交材料状态

| 官网要求 | 状态 | 证据与位置 | 提交前动作 |
|---|---|---|---|
| GitHub/Gitee 代码仓库 | 待确认访问权限 | 远端 `https://github.com/yan-stone-computer/NexcoreGraph.git`；未登录网页访问返回 404，但 `git ls-remote` 可读取 `main` | 确认仓库已设为 Public，或给评审提供访问权限 |
| 代码结构清晰、有效注释、主流规范 | 已满足 | `README.md`、`web/NexcoreGraph_web/README.md`、`web/NexcoreGraph_web/CODE-STYLE.md`、模块头注释 | 无 |
| README 项目介绍、架构、运行、团队 | 已满足 | `README.md` 与 Web README | 提交前再跑一次链接检查 |
| 完整 Git 提交历史 | 已整理 | 按 Web 求解器、AI 集成、测试、文档、三端代码和工具分组提交 | 推送当前分支并确认提交图可见 |
| 环境变量模板 | 已满足 | `web/NexcoreGraph_web/.env.example` | 不得上传真实 `.env` |
| 依赖清单 | 已满足 | Web 运行仅需现代浏览器 + Python 静态服务；测试需 Node 24；技术文档构建需 Python/docx/ReportLab/LibreOffice | 无 |
| 技术文档 PDF | 已生成 | `deliverables/传智杯_启核图策_Web端/01_技术文档/启核图策-Web端技术文档.pdf`，实测 23 页 | 提交前复核版式与文件哈希 |
| AI 选型、集成与优化 | 已覆盖 | 技术文档“AI 技术方案”“临期救援”“GraphRAG”“Agent 与安全”章节 | 无 |
| 技术创新点 | 已覆盖 | Pareto 非支配集、组合约束菜单、反事实沙盘、决策回放、确定性救援排序 | 无 |
| 应用创新点 | 已覆盖 | 从临期倒计时推进到今晚菜单；救援历史；拍照后即时下一步 | 无 |
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

## 三、自动化验收

```powershell
cd web/NexcoreGraph_web
node --test tests/rescue.test.js
```

预期：6 项单元测试全部通过。

```powershell
cd ../..
python tools/verify_rescue_web.py `
  --url "file:///D:/ProjectFiles/GithubPackage/NexcoreGraph/web/NexcoreGraph_web/index.html#/rescue" `
  --desktop-shot "web/NexcoreGraph_web/qa/shots/13-rescue-desktop.png" `
  --workbench-shot "web/NexcoreGraph_web/qa/shots/14-workbench-rescue.png" `
  --mobile-shot "web/NexcoreGraph_web/qa/shots/15-rescue-mobile.png" `
  --drawer-shot "web/NexcoreGraph_web/qa/shots/16-rescue-steps.png"
```

预期：

- 导航、筛选、决策抽屉、写操作预览、执行与撤销全部为 `true`。
- `consoleErrors` 为空。
- `mobileOverflowX` 为 0。
- 无模型 Key 时仍可通过确定性求解器完成主流程。

## 四、技术文档核验

```powershell
python -c "from pathlib import Path; import pymupdf; p=next(Path('deliverables').glob('*Web*/*/*技术文档.pdf')); print(len(pymupdf.open(p)))"
```

要求：页数不超过 30。当前实测 23 页。

## 五、Git 仓库核验

```powershell
git status --short
git log --oneline --graph --decorate -20
git remote -v
```

要求：

1. 当前分支为 `codex/web-competition-submission`。
2. 源码改动按主题提交，而不是一个笼统的“最终版”提交。
3. `deliverables/`、`node_modules/`、`.env`、视频和 ZIP 不进入源码历史。
4. 推送到远端后，在 GitHub/Gitee 页面确认提交图和 Public/评审权限。

## 六、演示主路径

1. 使用评审邮箱登录。
2. 打开 AI 工作台，查看“今晚先救哪几样”。
3. 进入“临期救援驾驶舱”。
4. 切换“综合救援 / 最快开饭 / 最少缺料 / 营养优先”。
5. 修改时间、菜数、缺料开关或排除食材，观察候选与组合菜单重排。
6. 查看推荐依据、Pareto 标识、被支配原因、步骤和替代建议。
7. 预览今晚菜单，确认前说明“不会扣减库存”。
8. 执行后在方案页撤销，验证库存恢复和日志。

## 七、仍需用户处理

- 确认远端仓库 Public 或提交评审访问权限。
- 如需要在线演示加分项，部署 Web 与后端并生成评审专用账号。
- 后续录制 5–8 分钟 MP4 视频；本轮不提交视频。
- 在官网最终提交后不得再修改材料，请先完成冻结检查和 SHA256 留档。
