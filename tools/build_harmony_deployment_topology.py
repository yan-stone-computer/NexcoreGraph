#!/usr/bin/env python3
"""Build the deployment-topology schematic for the HarmonyOS technical guide."""

from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'images' / 'harmony-deployment-topology.svg'

W = 1400
H = 760
INK = '#17231f'
INK_2 = '#3f514a'
MUTED = '#5f7068'
LINE = '#aab5af'
GREEN = '#2f7f43'
GREEN_DARK = '#1f6031'
GREEN_PALE = '#edf6ef'
BLUE = '#507ba1'
BLUE_DARK = '#315b7d'
BLUE_PALE = '#eef4fa'
GRAY_PALE = '#f3f5f4'
WHITE = '#ffffff'


def rect(x: int, y: int, w: int, h: int, fill: str = WHITE, stroke: str = LINE,
         radius: int = 12, sw: float = 1.5, dashed: bool = False) -> str:
    dash = ' stroke-dasharray="8 7"' if dashed else ''
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash}/>')


def text(x: int, y: int, value: str, size: int = 26, fill: str = INK,
         weight: int = 400, anchor: str = 'start') -> str:
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
            f'font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>')


def card(x: int, y: int, w: int, h: int, title: str, body: list[str], code: str,
         *, fill: str = WHITE, stroke: str = LINE) -> str:
    out = [rect(x, y, w, h, fill=fill, stroke=stroke),
           text(x + 18, y + 35, title, 28, INK, 700)]
    for i, line in enumerate(body):
        out.append(text(x + 18, y + 71 + i * 29, line, 22, INK_2))
    if code:
        out.append(text(x + 18, y + h - 16, code, 16, MUTED))
    return ''.join(out)


def arrow(points: list[tuple[int, int]], color: str = GREEN,
          width: float = 2.2, dashed: bool = False) -> str:
    d = ' '.join(('M' if i == 0 else 'L') + f'{x} {y}' for i, (x, y) in enumerate(points))
    dash = ' stroke-dasharray="9 7"' if dashed else ''
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round"{dash} '
            'marker-end="url(#arrow-green)"/>')


def main() -> None:
    p = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="159mm" height="86.3mm" '
        f'viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc" '
        'font-family="Microsoft YaHei, Noto Sans SC, sans-serif">',
        '<title id="title">启核图策鸿蒙端部署拓扑</title>',
        '<desc id="desc">HarmonyOS 设备通过局域网访问 Node.js 网关、流转中转与 MySQL，'
        'AI 和邮件由后端连接外部服务。</desc>',
        '<defs><marker id="arrow-green" markerWidth="11" markerHeight="11" refX="9" refY="5.5" '
        'orient="auto" markerUnits="strokeWidth"><path d="M0 0 L11 5.5 L0 11 Z" fill="#2f7f43"/>'
        '</marker></defs>',
        rect(0, 0, W, H, WHITE, WHITE, 0, 0),
        text(40, 54, '部署实现拓扑', 43, INK, 700),
        text(40, 91, '应用与本地数据驻留设备；同网 PC 运行 API、流转中转和 MySQL。', 23, INK_2),
        '<line x1="40" y1="112" x2="1360" y2="112" stroke="#cbd3cf" stroke-width="1.4"/>',
        text(50, 157, 'HarmonyOS 设备', 25, GREEN_DARK, 700),
        rect(30, 130, 370, 505, WHITE, GREEN, 15, 2),
        card(55, 180, 320, 145, 'ArkTS / ArkUI 应用',
             ['手机 / 平板 / 2in1', 'compact 档使用 WatchShell'],
             '', fill=GREEN_PALE, stroke=GREEN),
        card(55, 335, 320, 190, '服务地址探测',
             ['手动地址优先', '10.0.2.2 · LAN IP · 127.0.0.1',
              '流转：10.0.2.2 · LAN IP · 127.0.0.1'],
             'Backend.ets · FlowBridge.ets'),
        text(62, 578, '本地保存', 22, GREEN_DARK, 700),
        text(62, 608, 'Preferences：userData · graphDoc', 20, INK_2),
        text(470, 157, '同一局域网', 25, GREEN_DARK, 700),
        rect(450, 130, 205, 505, GRAY_PALE, LINE, 15, 1.5, dashed=True),
        text(475, 235, 'WiFi / LAN', 25, INK, 700),
        text(475, 270, 'HTTP :3000', 21, INK_2),
        text(475, 300, 'HTTP :3100', 21, INK_2),
        text(475, 345, '设备与电脑需', 20, MUTED),
        text(475, 373, '处于同一网段', 20, MUTED),
        text(475, 420, '防火墙放行', 20, MUTED),
        text(475, 448, 'TCP 3000 / 3100', 20, MUTED),
        text(720, 157, '部署主机', 25, BLUE_DARK, 700),
        rect(700, 130, 670, 505, WHITE, BLUE, 15, 2),
        card(730, 170, 280, 200, 'Express API',
             ['GET /api/health', 'Auth / Sync / AI', 'Graph API',
              '监听 0.0.0.0:3000'],
             'backend/server.js', fill=BLUE_PALE, stroke=BLUE),
        card(1060, 170, 280, 200, 'flow-bridge',
             ['publish / latest', '零依赖 JSON 中转',
              '监听 0.0.0.0:3100'],
             'backend/flow-bridge.js', fill=BLUE_PALE, stroke=BLUE),
        card(730, 390, 280, 150, 'MySQL',
             ['127.0.0.1:3307 · tianshu', '启动时自动建表迁移'],
             'server.js · initDb()'),
        card(1060, 390, 280, 150, '运行时文件',
             ['flow-bridge.json', 'tts-cache/ · 日志/快照'],
             '部署后生成，不随源码分发'),
        card(730, 560, 280, 70, '外部 AI · AGNES_*', [], ''),
        card(1060, 560, 280, 70, 'SMTP · MAIL_*', [], ''),
        arrow([(375, 245), (450, 245)]),
        arrow([(655, 245), (730, 245)], color=BLUE),
        arrow([(375, 430), (450, 430)], dashed=True),
        arrow([(870, 370), (870, 390)], color=BLUE),
        arrow([(1200, 370), (1200, 390)], color=BLUE),
        arrow([(870, 540), (870, 560)], color=BLUE, dashed=True),
        arrow([(1200, 540), (1200, 560)], color=BLUE, dashed=True),
        text(40, 683, '部署顺序：创建数据库 → 配置 .env → 启动 server.js :3000 → 启动 flow-bridge.js :3100 → '
             'DevEco Studio 构建并运行应用。', 20, MUTED),
        text(40, 718, '注意：.env、flow-bridge.json、tts-cache、node_modules、构建缓存不进入提交压缩包。', 18, MUTED),
        '</svg>',
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(''.join(p), encoding='utf-8')
    print(OUT)


if __name__ == '__main__':
    main()
