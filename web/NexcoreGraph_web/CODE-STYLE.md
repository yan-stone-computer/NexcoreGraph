# 启核图策 Web 端代码规范

## 模块边界

- `data.js`：仅放空业务初始状态与界面默认值。
- `knowledge.js`：食材保质期、知识库菜谱与存放规则。
- `rescue.js`：纯函数救援求解器，不访问 DOM、不写 localStorage。
- `mockapi.js`：唯一业务状态写入层，负责校验、日志、持久化与撤销数据。
- `agnes.js`：AI 网关/厂商直连与超时、错误分类。
- `graph-rag.js`：图谱检索与证据装配，不直接执行写操作。
- `app.js`、`workbench.js`、`rescue-view.js`、`graph-view.js`：视图与交互，只通过 `API` 修改状态。

## JavaScript

- 新文件使用 IIFE 与 `"use strict"`，避免污染全局作用域。
- 缩进 2 空格，语句结尾写分号，字符串默认使用双引号。
- 兼容当前浏览器基线，优先使用 `var`、具名函数和传统 `for`/`forEach`；不要把可选链作为兼容性前提。
- 函数只承担一个清晰职责；算法逻辑放入可单测模块，不埋在事件处理器里。
- 所有用户可控字符串进入 `innerHTML` 前必须经过 `esc()`。
- 任何写操作必须遵循“预览 → 确认 → 生效 → 可撤销 → 写日志”。
- AI 返回值不能直接写 `DB`，必须经过白名单工具或确定性 API。
- 新功能必须提供失败路径：空数据、无权限、网络失败、无模型 Key 均需可解释。

## 测试

- 纯算法使用 Node 内置测试运行器：`node --test tests/*.test.js`。
- 页面主流程使用 `python tools/verify_rescue_web.py` 的 Edge/CDP 验收。
- 新增测试先运行并确认失败，再写最小实现使其通过。
- 提交前至少运行 `node --check` 和对应自动化测试。

## 提交

- 提交信息使用 `feat/fix/test/docs/chore` 前缀。
- 一次提交只解决一个可说明的问题。
- 不提交 `.env`、真实 API Key、`node_modules`、构建缓存、临时数据库或大体积视频。
- 修改既有大文件前先看 `git diff`；与他人的未提交改动混在一起时使用 `git add -p` 分块暂存。
