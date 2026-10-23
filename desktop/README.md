# 启核图策 · 桌面安装包（Web 端）

给「没有开发环境的电脑」用的 Windows 安装包：装完双击就能用，不需要 Node、npm、MySQL、Python。

## 里面有什么

| 部分 | 说明 |
|---|---|
| Electron 外壳 | 一个独立窗口，不用先开浏览器、不用记端口 |
| 本地服务 `server.js` | 零外部依赖，Node 内置 `node:sqlite` 存数据（`nexcoregraph.sqlite`） |
| Web 端本体 | 与 `web/NexcoreGraph_web` 同一套页面（构建时复制进来） |
| 首次设置页 | 第一次打开要求填 Agnes API Key（只存本机，不进安装包、不上传） |

数据位置：`%APPDATA%\nexcoregraph-desktop\data\`

- `nexcoregraph.sqlite`：账号、家庭、同步快照、协作池、流转记录
- `config.json`：AI Key 与模型配置（删除即回到首次设置）

## 与正式后端的区别

正式后端（`harmonyosapp/.../backend`）用 MySQL + SMTP 邮箱验证码，适合局域网多人协作；
桌面版为了「装完即用」改成：

- 存储：SQLite（单文件，自动建表）
- 登录：本机模式，验证码固定 `123456`（不需要邮箱）
- AI：本地服务转发 Agnes，Key 存在本机；没有 Key 时明确报错，不返回模拟数据
- 同步 / 协作池 / 流转：同一台电脑上的本地实现，接口契约与正式后端一致

## 构建

```powershell
# 在仓库根目录
powershell -ExecutionPolicy Bypass -File desktop\build.ps1
```

产物：`desktop\dist\启核图策 Setup 1.0.0.exe`（NSIS 安装包，约 115MB）。
安装包不进 git（GitHub 单文件上限 100MB），需要时本地构建或单独分发。

构建脚本会：复制 `web/NexcoreGraph_web` → `desktop/web`，安装 electron / electron-builder，
再打 NSIS 安装包。首次构建需要联网下载 Electron 与 NSIS 组件。

## 开发时直接跑

```powershell
cd desktop
npm install
npm start
```

或者只起本地服务、用浏览器打开（调试接口时更轻）：

```powershell
cd desktop
$env:NXG_DATA_DIR="$env:TEMP\nxg-desktop"
$env:PORT="3311"
node server.js        # 打开 http://127.0.0.1:3311
```

`AGNES_API_KEY` 环境变量存在时优先使用，便于本机调试；正常安装包走首次设置页写入的 `config.json`。

## 端到端自检

安装/解包后带调试端口启动：

```powershell
& ".\dist\win-unpacked\启核图策.exe" --remote-debugging-port=9222
node ..\tools\electron_e2e.js --port 9222 --file ..\tools\desktop_e2e_check.js
```

检查项：页面标题与 URL、本机登录（123456）、用 `assets/img/fridge.jpg` 走真实 `/api/ai/vision`
（返回模型名、耗时、识别条目）。实测：7 项、agnes-2.5-flash、约 3.6s。
