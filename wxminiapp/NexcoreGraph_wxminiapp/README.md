# 启核图策 NexcoreGraph · 微信小程序端

家庭资源智能管家：拍照入库、GraphRAG 规划、库存预警、方案核销、采购、家庭协作和 MySQL 同步。

技术栈：Taro 4.1.9 + React 18 + TypeScript + Sass + Zustand。

## 构建与运行

```powershell
npm install
npm run build:weapp
```

产物位于 `dist/`。微信开发者工具打开工程根目录，`project.config.json` 已配置 `miniprogramRoot: "dist/"` 和当前 AppID `wx25e3afb6ce695963`。

运行前需启动：

1. 自建后端 `http://127.0.0.1:3000`，健康检查 `/api/health` 返回 `ai: ready`。
2. MySQL `127.0.0.1:3307/tianshu`。
3. 如需跨设备流转，同时启动 `flow-bridge.js` 的 3100 端口。

## 真实能力

- 登录只接受后端邮箱验证码，固定演示码和本地假登录已移除。
- 工作区从 MySQL `sync_snapshots` 拉取，新增、编辑、数量调整、方案核销和回滚会自动上传。
- 拍照识别调用 `/api/ai/vision`，不再使用模拟识别结果。
- 高频库存事实由本地图谱直接回答，模型类问题调用 `/api/ai/chat`。
- 模型支持“自建网关优先”和“厂商直连”两种策略。客户端 Key 明文保存在本机 `.env`，界面仅做掩码显示。
- Windows 微信当前会拒绝 Agnes 厂商域名的证书链，真机环境应使用自建网关；网关在服务端使用同一 Agnes Key 转发，避免 `ERR_CERT_COMMON_NAME_INVALID`。
- 写库存采用“预览卡 → 用户确认 → 执行 → 可撤销”，模型不能直接改数据。

## 可信 AI 实验台（Wave 1）

“我的 → 可信 AI 实验台”提供四块可现场核验的能力：

- **What-if 推演**：在购买、执行方案、预算调整前，对比物品、库存单位、临期、低库存、预算占用和健康度变化；推演不会修改真实数据。
- **追加式事件日志**：拍照入库、数量调整、删除、移动、方案执行和采购变更会生成事件；支持整批关联和可恢复事件撤销。
- **SHA-256 审计链**：后端 `POST /api/events/append` 按家庭串接事件哈希，`GET /api/events/verify/:familyId` 可校验链完整性；重复事件按 eventId 幂等。
- **Agent 策略沙箱**：只读成员禁止写操作，成员删除类动作需要管理员确认，Agent 动作缺少证据会被拦截。
- **GraphRAG 检索轨迹**：每次模型问答保存路由、证据条数、路径和降级状态，AI 气泡中的“看依据”可直接打开实验台。
- **5 分钟导览**：从今日建议、录入、推演、权限到审计走真实页面，不播放伪造演示。

高级逻辑均有 Vitest 测试：

```powershell
npm test
npm run typecheck
npm run verify:weapp
```

真实模拟器自动化冒烟需要先启动开发者工具自动化端口：

```powershell
& 'C:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat' auto `
  --project 'D:\ProjectFiles\GithubPackage\NexcoreGraph\wxminiapp\NexcoreGraph_wxminiapp' `
  --trust-project --auto-port 9422 --lang zh

$env:WEAPP_AUTOMATOR_WS='ws://127.0.0.1:9422'
node ..\..\tools\test_weapp_runtime.js
node ..\..\tools\capture_weapp_pages.js
```

多轮真实复核结果见 `docs/qa/启核图策-微信小程序端多轮复核报告.md`。

完整部署流程见 `docs/启核图策-微信小程序端部署与运行指南.md`。

## 目录

```text
src/
├── app.config.ts
├── pages/                 # home/workbench/library/library-detail/intake/chat/plans/alerts/shopping/graph/mine/login
├── components/
├── services/
│   ├── auth.ts            # 邮箱验证码与登录
│   ├── workspace.ts       # MySQL 工作区同步
│   ├── agnes.ts           # 网关/厂商直连
│   ├── graphRag.ts        # 图谱证据与大模型编排
│   ├── family.ts          # 成员、邀请码和协作池
│   └── exportcsv.ts
├── store/
├── styles/
└── assets/
```

## 环境配置

复制 `.env.example` 为 `.env`，填写：

```text
TARO_APP_AI_KEY=<Agnes API Key>
TARO_APP_AI_MODEL=agnes-2.5-flash
TARO_APP_AI_VENDOR_BASE=https://api.agnes-ai.cn/v1
```

`TARO_APP_AI_KEY` 会在构建时内联进小程序产物。不要把含真实 Key 的 `.env`、`dist/common.js` 或 Demo 上传到公开仓库。

## 验证

最近一次构建与功能回归记录见：

`deliverables/传智杯_启核图策_小程序端/00_完整性校验/微信小程序回归测试记录.md`
