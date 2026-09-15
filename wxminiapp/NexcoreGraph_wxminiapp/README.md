# 启核图策 NexcoreGraph · 微信小程序端

> 技术栈：Taro 4.1.9 + React 18 + TypeScript + Sass + zustand（可编译到微信小程序 / H5）
> 赛道：传智杯 **AI 微信小程序开发挑战赛**（matchTrack id=10038）
> AppID：`wx9d1c625b399ecda3`（已在 `project.config.json` 配置）

## 一、目录结构

```
NexcoreGraph_wxminiapp/
├─ config/{index,dev,prod}.ts   # Taro 构建配置
├─ src/
│  ├─ app.config.ts             # 10 页注册 + tabBar（首页 / 资源库 / AI 助手 / 我的）
│  ├─ pages/                    # home / library / library-detail / intake / chat / plans / alerts / shopping / mine / login
│  ├─ components/               # ItemRow / PlanCard / StatCard / AlertItem / EmptyState / NameInputModal
│  ├─ services/                 # api.ts（本地模拟后端）· ai.ts（AI 编排层）· cloud.ts（待删除，见整改文档 D12）
│  ├─ data/                     # seed.ts · knowledge.ts（食材 25 / 菜谱 16 / 规则 10）
│  ├─ store/useStore.ts         # zustand
│  ├─ styles/                   # theme.scss · variables.scss · compat.scss
│  └─ assets/                   # logo.png / logo-512.png / tabbar 图标
├─ docs/                        # 本端专项整改与验收文档 + 后台填报清单 + 品牌头像
├─ project.config.json          # miniprogramRoot=dist（AppID 已配置）
└─ dist/                        # 构建产物
```

## 二、开发与构建

```bash
npm install            # 或 npm ci
npm run dev:weapp      # watch 开发（微信开发者工具打开本目录）
npm run build:weapp    # 生产构建，产物在 dist/
npm run build:h5       # 可选：H5 版本
```

微信开发者工具导入本目录即可（`miniprogramRoot` 已指向 `dist/`）。

## 三、演示账号

验证码统一 `123456`：

| 手机号 | 角色 |
|---|---|
| 13800138000 | 家庭管理员 |
| 13900139000 | 成员 |
| 13600136000 | 只读 |

## 四、AI 实现说明（重要）

`src/services/ai.ts` 已实现真实编排逻辑：意图路由（问候 / 位置 / 数量 / 保质期本地快答，0 次模型调用）、受约束工具协议（`[调整]`、`shopping_add`，先预览后确认）、营养估算、AI 创新菜谱、看板简报（统计由代码算，模型仅润色）。

当前**模型文本为本地模拟**（`modelReply` 内为模板 + 延时）。正式版改造：

1. `cook / creative / nutrition / summary / fallback` 改调 `POST /api/ai/chat`（分段流式：`Taro.request({ enableChunked: true })` + `onChunkReceived`）。
2. 拍照识别改调 `POST /api/ai/vision`（`Taro.uploadFile`）。
3. 保持三条红线：数值由代码查询产出、写操作先预览后确认、单请求 ≤2 次模型调用。

## 五、本地存储键

| 键 | 用途 |
|---|---|
| `nexcore_weapp_db_v1` | 业务数据（库 / 物品 / 方案 / 预警 / 日志） |
| `nexcore_weapp_cloud_v1` | 云端快照模拟 |
| `nexcore_weapp_logged_in` | 登录态 |

## 六、品牌

名称 **启核图策 / NexcoreGraph**；Logo 为圆形渐变徽标（绿→青→蓝 + 顶部嫩芽 + 白色 N）。头像规格图见 `docs/brand/`，后台填报内容见 `docs/启核图策-小程序后台填报清单.md`。
