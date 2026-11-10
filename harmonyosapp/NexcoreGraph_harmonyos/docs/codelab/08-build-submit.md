# 08 · 构建、签名、合规与验收

## 目标

生成可验证的 HAP，完成安全扫描与赛事材料核对，并给出可复现的评委运行路径。

## 前置条件

- DevEco Studio、Node.js、MySQL 可用。
- 已取得团队自己的签名证书与 Profile。
- 服务端 `.env` 只在本机存在，未进入提交包。

## 步骤

1. 运行静态检查：

```powershell
python tools/check_release.py
```

2. 重新构建：

```powershell
powershell -ExecutionPolicy Bypass -File tools/build.ps1 -Task assembleHap
```

3. 在 DevEco Studio 配置团队签名，生成 signed HAP。不要把证书私钥放进公开仓库。
4. 在模拟器或真机安装，按教程 00–07 走一次主链路。
5. 运行端到端后端：

```powershell
cd backend
npm install
$env:AGNES_API_KEY = '服务端密钥'
node server.js
node flow-bridge.js
```

6. 核对 `docs/privacy.md` 的采集范围、权限用途与 AI 生成内容标识。
7. 核对报名信息、HAP、源码、Codelab、技术文档、演示视频和评分证据。

## 验证

静态检查应全部通过，重点确认：

```text
PASS 端侧/后端无模型密钥明文
PASS 知识库 rawfile 随包
PASS 服务卡片多端尺寸与定时刷新
PASS 设备类型含 2in1 且权限合规
PASS AI 网关四端点 + Key 取环境变量
PASS 端侧构图 0 次模型调用
```

在 HAP 与源码中再次检索 `sk-`，不得存在真实厂商密钥。真机 Release 必须使用 signed HAP；若当前包为 unsigned，只能标注为开发验证包，不能写成“已签名 Release”。

![应用图标](./images/08-app-icon.png)

## 常见问题

**构建成功但没有 signed HAP**：`build-profile.json5` 没有签名配置。先在 DevEco Studio 完成签名，再重新构建。

**为什么不能把设备端 Key 放在 HAP**：HAP 可被解包，任何内置厂商密钥都应视为已泄露。密钥必须只存在后端环境变量。

**提交前最后检查**：删除 `build/`、`oh_modules/`、`.env`、临时日志、测试凭据与旧赛事材料，只保留可复现所需文件。
