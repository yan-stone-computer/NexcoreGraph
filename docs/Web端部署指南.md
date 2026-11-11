# 启核图策 Web 端部署指南

> 适用版本：2026-11-11
> 仓库范围：Web 用户端与管理员端

## 1. 运行形态

| 形态 | 用途 | 必需组件 |
|---|---|---|
| 本地演示 | 开发、答辩和浏览器验收 | Chrome/Edge + Python 3.10+ |
| 局域网访问 | 平板、手机通过同一网络访问 | 本地静态服务 + 防火墙放行 |
| 公网 HTTPS | 在线演示加分项 | 云服务器 + 域名 + HTTPS |

Web 前端为零构建 HTML/CSS/JavaScript，不需要 npm install。

## 2. 本地启动

在仓库根目录执行：

```powershell
python tools/serve_web.py --root web/NexcoreGraph_web --port 8080
```

访问：

```text
http://127.0.0.1:8080/
http://127.0.0.1:8080/admin.html
```

Windows 也可双击：

```text
web/NexcoreGraph_web/start.bat
```

## 3. 环境要求

| 组件 | 要求 | 用途 |
|---|---|---|
| Chrome / Edge | 最新稳定版 | 页面与摄像头 |
| Python | 3.10+ | 安全静态服务 |
| Node.js | 24+，可选 | 单元测试 |

## 4. 模型配置

打开“设置 → 服务器连接 · AI 通道”，可配置：

- OpenAI Compatible、Anthropic Messages、Gemini GenerateContent。
- 平台、Base URL、文本模型、视觉模型、备用模型。
- 对话超时、视觉超时、上下文窗口、最大输出。
- 本机 API Key。

浏览器直连 Key 仅保存在 localStorage，显示时只保留末四位。公网部署推荐通过自己的服务端网关转发模型请求，不要把真实 Key 放进静态目录。

## 5. 安全静态服务

必须使用仓库自带服务器：

```powershell
python tools/serve_web.py --root web/NexcoreGraph_web --port 8080
```

服务会拒绝：

- `.env`、`.env.example` 与 `.git` 等点文件。
- 目录列表。
- 路径穿越。

不要使用会暴露目录的临时服务器。

## 6. 公网 HTTPS

1. 将 `web/NexcoreGraph_web` 部署到静态站点目录。
2. 使用 `deploy/nginx.nexcoregraph.conf.example`。
3. 替换 `demo.example.com`、证书路径和 `/srv/nexcoregraph`。
4. 配置 TLS 证书后重启 Nginx。
5. 检查响应头与 `.env` 隔离。

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 7. 部署验收

```bash
curl -I https://demo.example.com/
curl -o /dev/null -s -w "%{http_code}\n" https://demo.example.com/.env
curl -o /dev/null -s -w "%{http_code}\n" https://demo.example.com/.env.example
```

`.env` 与 `.env.example` 必须返回 `404`。

浏览器自动化：

```powershell
python tools/verify_rescue_web.py --url "http://127.0.0.1:8080/index.html#/rescue"
python tools/verify_admin_web.py "http://127.0.0.1:8080/admin.html"
```

单元测试：

```powershell
cd web/NexcoreGraph_web
node --test tests/*.test.js
```

## 8. 受限能力

- 邮箱验证码、家庭同步和服务端模型网关需要自行提供同源 API 服务。
- 摄像头在非 localhost 环境要求 HTTPS。
- 浏览器是否允许模型平台跨域直连取决于平台策略；失败时会明确显示错误并降级。
