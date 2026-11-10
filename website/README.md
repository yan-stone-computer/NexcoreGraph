# 启核图策官网

零依赖静态官网，参考“枢游记”项目的叙事式展示结构，使用启核图策自己的品牌、真实界面与工程证据重做。

预览图：`preview-desktop.png`、`preview-mobile.png`。Figma 连接不可用时的页面规格见 `FIGMA-HANDOFF.md`。

## 本地预览

在仓库根目录启动静态服务：

```powershell
python -m http.server 8095
```

打开 `http://127.0.0.1:8095/website/`。

“打开产品”链接指向仓库内的 `web/NexcoreGraph_web/index.html`。如只部署 `website/`，请把链接改为已部署的产品体验地址。

## 页面

- 首屏使用 ComfyUI Qwen Image 生成的品牌氛围图与真实手机界面。
- 产品闭环使用真实截图切换，支持查看完整原图。
- 可信 AI 与 GraphRAG 使用机制示意，不冒充产品截图。
- 多端协同展示 HarmonyOS、Web 与微信小程序真实界面。
- 工程证据列出当前仓库可追溯的数字与仍待真机复核的边界。

## 设计系统

- `design-tokens.json`：UI Alchemy 根据品牌绿色与信号蓝生成的色阶和对比度报告。
- `tokens.css`：官网使用的最终语义令牌。
- 字体：Noto Serif SC / Songti SC 作为展示字，HarmonyOS Sans SC / Microsoft YaHei 作为正文回退。

## 素材

生成图与真实截图来源记录在 `assets/manifest.json`。产品界面不重绘、不伪造；氛围图不含文字或品牌标识。
