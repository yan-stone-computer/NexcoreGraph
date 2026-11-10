# -*- coding: utf-8 -*-
"""Build the deployment topology diagram for the standalone runbook."""
from __future__ import annotations

from pathlib import Path

from build_works_intro_assets import (
    GREEN,
    GREEN_DARK,
    GRID,
    INK,
    LINE,
    MUTED,
    PALE_GREEN,
    PALE_TEAL,
    WARM,
    WHITE,
    box,
    line,
    path,
    svg_shell,
    text,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deliverables" / "传智杯_启核图策_小程序端" / "09_部署与运行" / "图示"


def topology() -> str:
    w, h = 1400, 940
    body = [
        text(46, 54, "本地部署拓扑", 36, INK, 700),
        text(46, 94, "默认在一台 Windows 电脑上运行数据库与后端，小程序通过本机地址访问。", 24, MUTED),
        f'<rect x="38" y="130" width="810" height="640" rx="26" fill="{WARM}" stroke="{GRID}" stroke-width="2"/>',
        text(66, 170, "运行主机 · Windows / macOS / Linux 均可", 24, GREEN_DARK, 700),
        box(70, 220, 330, 175, "MySQL 8.x", ["127.0.0.1:3307", "数据库：tianshu", "表结构首次启动自动创建"], WHITE, title_size=30, body_size=24),
        box(470, 200, 330, 155, "Node.js 后端", ["0.0.0.0:3000", "session · sync · AI · graph"], PALE_GREEN, title_size=30, body_size=24),
        box(470, 420, 330, 145, "flow-bridge", ["0.0.0.0:3100", "跨设备页面流转"], PALE_TEAL, title_size=30, body_size=24),
        box(70, 440, 330, 145, "微信开发者工具", ["导入小程序Demo", "关闭合法域名校验"], WHITE, title_size=29, body_size=24),
        line(404, 278, 466, 278, GREEN, 6, arrow=True),
        line(404, 505, 466, 505, GREEN, 6, arrow=True),
        path("M 235 436 L 235 410 L 633 410 L 633 360", GREEN, 5, arrow=True),
        text(276, 440, "HTTP 请求", 22, GREEN_DARK, 600),

        box(935, 205, 395, 170, "Agnes AI 云服务", ["可选：文本与视觉模型", "HTTPS / 自建网关转发"], WHITE, title_size=30, body_size=24),
        path("M 805 235 L 930 235", GREEN, 5, arrow=True),
        text(868, 208, "HTTPS", 22, GREEN_DARK, 600, "middle"),
        box(935, 440, 395, 205, "同网段手机 / PC 微信", ["API：电脑局域网 IP:3000", "流转：同一 IP:3100", "同一 WiFi / 网段"], PALE_TEAL, title_size=29, body_size=24),
        path("M 930 480 L 870 480 L 870 300 L 805 300", GREEN, 4, dashed=True, arrow=True),
        text(865, 458, "局域网 API", 22, GREEN_DARK, 600, "end"),
        line(930, 550, 804, 550, GREEN, 4, dashed=True, arrow=True),
        text(865, 588, "局域网流转", 22, GREEN_DARK, 600, "end"),
        text(46, 846, "默认只在本机验证时使用 127.0.0.1；换到手机或另一台电脑时，必须改成运行主机的局域网 IP。", 24, MUTED),
        text(46, 892, "公网发布还需要 HTTPS、备案/域名配置和微信后台合法域名设置，不能直接暴露 3000 端口。", 24, MUTED),
    ]
    return svg_shell(w, h, "".join(body))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "deployment-topology.svg").write_text(topology(), encoding="utf-8")
    print(OUT / "deployment-topology.svg")


if __name__ == "__main__":
    main()
