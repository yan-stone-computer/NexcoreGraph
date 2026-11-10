# Git 提交与仓库整理说明

## 目标

保留真实开发历史，同时避免把本地缓存、依赖、视频、生成压缩包和敏感配置混入源码仓库。当前工作分支为 `codex/web-competition-submission`。

## 提交分组

本轮按以下主题组织提交：

1. 临期救援求解器与单元测试。
2. 救援驾驶舱、AI 工作台入口与交互。
3. 技术文档生成器和真实界面证据。
4. Web README、环境模板、代码规范和仓库卫生脚本。
5. 仓库既有三端代码、文档和工具。
6. 本提交计划与最终核验材料。

不制造虚假的开发日期或作者；历史日期以真实本地提交时间为准。

## 不进入 Git 的内容

`.gitignore` 已排除：

- `deliverables/`：最终提交包、生成的 PDF、ZIP、截图和视频。
- `*.zip`、`*.mp4`、`*.sha256`：二进制分发物。
- `.env`、`.env.local`：真实密钥。
- `node_modules/`、`oh_modules/`、`dist/`、`build/`：依赖和构建缓存。
- `docs/backups/`、`docs/qa/`、`tts-cache/`：临时与可重建材料。

## 推送

本轮已使用本机 Git 凭据推送比赛分支：

```powershell
git push -u origin codex/web-competition-submission
```

推送结果：新分支 `codex/web-competition-submission` 已创建并跟踪远端。

随后在 GitHub/Gitee 中确认：

- 默认分支是否保持稳定；
- 比赛提交分支是否可见；
- 仓库是 Public，或已为评审配置访问权限；
- `git log --oneline --graph` 能看到分主题提交。

## 提交前检查

```powershell
python tools/check_repo_hygiene.py
git status --short
git log --oneline --graph --decorate -20
```

匿名访问当前仍返回 404，因此仓库很可能仍是私有仓库。Git 推送成功不等于评审可以访问；必须在 GitHub/Gitee 页面确认 Public 或评委权限。

如果仓库历史中曾提交真实密钥，仅从当前文件删除不够，必须立即轮换密钥并评估历史清理，不能用“文件已删”代替密钥失效。
