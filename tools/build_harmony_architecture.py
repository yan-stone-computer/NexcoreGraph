#!/usr/bin/env python3
"""Build the editable HarmonyOS core architecture schematic from the code map."""

from __future__ import annotations

import base64
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'images' / 'harmony-core-architecture.svg'
ICON = ROOT / 'docs' / 'images' / 'architecture-assets' / 'harmony-core-icon-alpha.png'

W = 1600
H = 1325
SVG_WIDTH = '1600'
SVG_HEIGHT = '1325'

INK = '#17231f'
INK_2 = '#3f514a'
MUTED = '#687870'
LINE = '#9fa9a4'
GREEN = '#2f7f43'
GREEN_DARK = '#1f6031'
GREEN_PALE = '#edf6ef'
BLUE = '#507ba1'
BLUE_PALE = '#eef4fa'
GRAY_PALE = '#f3f5f4'
WHITE = '#ffffff'


def rect(x: int, y: int, w: int, h: int, fill: str = WHITE, stroke: str = LINE,
         radius: int = 10, sw: float = 1.5, dashed: bool = False) -> str:
    dash = ' stroke-dasharray="7 7"' if dashed else ''
    return (
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash}/>'
    )


def text(x: int, y: int, value: str, size: int = 28, fill: str = INK,
         weight: int = 400, anchor: str = 'start') -> str:
    return (
        f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
        f'font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>'
    )


def lines(x: int, y: int, values: list[str], size: int = 26, leading: int = 32,
          fill: str = INK_2, weight: int = 400) -> str:
    spans = []
    for i, value in enumerate(values):
        dy = 0 if i == 0 else leading
        spans.append(f'<tspan x="{x}" dy="{dy}">{escape(value)}</tspan>')
    return (
        f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
        f'font-weight="{weight}">{"".join(spans)}</text>'
    )


def module(x: int, y: int, w: int, h: int, title: str, body: list[str], code: str,
           *, accent: bool = False, border: str = LINE, fill: str = WHITE) -> str:
    fg = WHITE if accent else INK
    body_color = '#e4f0e7' if accent else INK_2
    code_color = '#c8e2cf' if accent else MUTED
    out = [rect(x, y, w, h, fill=fill, stroke=GREEN if accent else border, radius=12,
                sw=2 if accent else 1.4)]
    out.append(text(x + 18, y + 34, title, 28, fg, 700))
    out.append(lines(x + 18, y + 70, body, 24, 29, body_color, 400))
    out.append(text(x + 18, y + h - 17, code, 15, code_color, 400))
    return ''.join(out)


def path(points: list[tuple[int, int]], color: str = GREEN, width: float = 2.2,
         marker: bool = True, dashed: bool = False) -> str:
    d = ' '.join(('M' if i == 0 else 'L') + f'{x} {y}' for i, (x, y) in enumerate(points))
    dash = ' stroke-dasharray="8 7"' if dashed else ''
    end = ' marker-end="url(#arrow-green)"' if marker else ''
    return (
        f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
        f'stroke-linecap="round" stroke-linejoin="round"{dash}{end}/>'
    )


def lane(y: int, label: str, items: list[tuple[str, str]]) -> str:
    out = [text(52, y + 30, label, 25, GREEN_DARK, 700)]
    xs = [40, 351, 662, 973, 1284]
    for i, ((title, detail), x) in enumerate(zip(items, xs)):
        out.append(rect(x, y + 42, 286, 67, fill=WHITE, stroke=LINE, radius=8, sw=1.2))
        out.append(text(x + 14, y + 70, title, 23, INK, 700))
        out.append(text(x + 14, y + 96, detail, 18, MUTED, 400))
        if i < len(items) - 1:
            out.append(path([(x + 286, y + 75), (x + 311, y + 75)], GREEN, 2.1))
    return ''.join(out)


def build_svg() -> str:
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{SVG_WIDTH}" height="{SVG_HEIGHT}" '
        f'viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc" '
        'font-family="Microsoft YaHei, Noto Sans SC, sans-serif">',
        '<title id="title">启核图策鸿蒙端核心架构</title>',
        '<desc id="desc">从 HarmonyOS 元服务、端侧本地编排、GraphRAG、'
        '本地快照，到自建 Node 服务、MySQL 与外部 AI 服务，并列出入库、问答与多端协同三条执行路径。</desc>',
        '<defs>',
        '<marker id="arrow-green" markerWidth="11" markerHeight="11" refX="9" refY="5.5" '
        'orient="auto" markerUnits="strokeWidth"><path d="M0 0 L11 5.5 L0 11 Z" fill="#2f7f43"/></marker>',
        '<marker id="arrow-blue" markerWidth="11" markerHeight="11" refX="9" refY="5.5" '
        'orient="auto" markerUnits="strokeWidth"><path d="M0 0 L11 5.5 L0 11 Z" fill="#507ba1"/></marker>',
        '<marker id="arrow-gray" markerWidth="11" markerHeight="11" refX="9" refY="5.5" '
        'orient="auto" markerUnits="strokeWidth"><path d="M0 0 L11 5.5 L0 11 Z" fill="#9fa9a4"/></marker>',
        '</defs>',
        rect(0, 0, W, H, WHITE, WHITE, 0, 0),
        text(40, 54, '启核图策核心架构', 42, INK, 700),
        text(40, 88, '端侧负责交互、事实与本地执行；服务端负责网关治理、身份与权威快照', 24, INK_2),
        '<line x1="40" y1="110" x2="1560" y2="110" stroke="#cbd3cf" stroke-width="1.5"/>',
    ]

    if ICON.exists():
        icon_b64 = base64.b64encode(ICON.read_bytes()).decode('ascii')
        parts.append(
            f'<image href="data:image/png;base64,{icon_b64}" x="1445" y="34" width="106" height="38"/>'
        )

    # Platform boundaries.
    parts.extend([
        rect(30, 125, 900, 650, WHITE, GREEN, 14, 2),
        text(52, 160, 'HarmonyOS 元服务 · Stage / ArkTS / ArkUI', 30, GREEN_DARK, 700),
        text(52, 187, 'CameraPicker · Preferences · FormExtension · onContinue', 20, MUTED),
        rect(990, 125, 580, 540, WHITE, BLUE, 14, 2),
        text(1012, 160, '自建后端 · Node.js + Express :3000', 29, '#315b7d', 700),
        rect(990, 685, 580, 90, GRAY_PALE, LINE, 12, 1.4),
        text(1012, 720, '流转中转 · flow-bridge.js :3100', 28, INK, 700),
        text(1012, 748, '/api/flow/publish · /api/flow/latest?since=rev', 19, MUTED),
        rect(990, 790, 580, 100, GRAY_PALE, LINE, 14, 1.4),
        text(1012, 825, '外部能力边界', 28, INK, 700),
    ])

    # HarmonyOS modules.
    parts.extend([
        module(55, 210, 270, 145, 'ArkUI 交互外壳',
               ['Tabs / NavRail / Sheet', '三档断点 · 侧栏 AI'],
               'Index / Overlays', border=GREEN),
        module(345, 210, 270, 145, '本地编排与检索',
               ['Commands / Router', 'KnowledgeIndex'],
               'Commands / Router', border=GREEN),
        module(635, 210, 270, 145, '多模态入库',
               ['拍照 → 压缩 → 识别', '补缺字段 → 用户确认'],
               'Overlays / AiGateway', border=GREEN),
        module(55, 370, 420, 180, '个人资源图谱与 GraphRAG',
               ['确定性构图 · 0 次模型调用', 'local / global / multi-hop', '节点链 + 事实 + 来源'],
               'GraphBuild / GraphStore / GraphQuery', accent=True, fill=GREEN),
        module(495, 370, 420, 180, 'AI 网关客户端',
               ['askAI → 证据 → 工具行', '确认卡 · 撤销 · 用量留痕'],
               'AiGateway / Api / Store', border=BLUE),
        module(55, 580, 420, 165, '本地事实与快照',
               ['Store ↔ Preferences', 'userData · graphDoc · formSnapshot',
                '图谱不进入同步 payload'],
               'Store / LocalStore', border=GREEN),
        module(495, 580, 420, 165, '多端协同与系统入口',
               ['LiveSync 2s 轮询 · 系统接续', 'FormExtension 读取快照'],
               'LiveSync / Continuation / FormAbility', border=BLUE),
    ])

    # Backend modules.
    parts.extend([
        module(1012, 205, 255, 145, 'AI 受控网关',
               ['chat / vision', 'tts / usage'],
               '/api/ai/* · 服务端 Key', border=BLUE),
        module(1287, 205, 255, 145, '认证 / 家庭 / 协作',
               ['OTP · scrypt', '角色与家庭成员'],
               '/api/auth · families · coop', border=BLUE),
        module(1012, 370, 255, 145, '权威快照同步',
               ['全量快照 + 版本号', '409 冲突由用户处理'],
               '/api/sync/upload · status', border=BLUE),
        module(1287, 370, 255, 145, '图谱服务（独立）',
               ['五表 · 独立 API'],
               '/api/graph/* · 端侧未调用', border=GRAY_PALE),
        rect(1012, 535, 530, 105, BLUE_PALE, '#9db8cf', 9, 1.2),
        text(1030, 569, 'MySQL 权威库', 25, '#315b7d', 700),
        text(1030, 601, 'users · families · sync · ai_usage · coop_* · graph_*', 17, INK_2),
    ])

    # External capabilities.
    parts.extend([
        rect(1012, 835, 255, 44, WHITE, LINE, 7, 1.1),
        text(1027, 854, '大模型上游', 21, INK, 700),
        text(1027, 874, 'OpenAI 兼容 · 文本 / 视觉 / TTS', 14, MUTED),
        rect(1287, 835, 255, 44, WHITE, LINE, 7, 1.1),
        text(1302, 854, 'SMTP 邮件', 21, INK, 700),
        text(1302, 874, 'TLS 发信 · mailer.js', 14, MUTED),
    ])

    # Main connections inside the client.
    parts.extend([
        path([(325, 275), (345, 275)], GREEN, 2.3),
        path([(480, 340), (295, 370)], GREEN, 2.0),
        path([(760, 340), (705, 370)], GREEN, 2.0),
        path([(475, 460), (495, 460)], GREEN, 2.3),
        path([(705, 550), (705, 570), (480, 570), (480, 580)], GREEN, 2.0, dashed=True),
        path([(475, 662), (495, 662)], GREEN, 2.3),
    ])

    # Cross-process channels.
    parts.extend([
        path([(915, 460), (970, 460), (970, 270), (1012, 270)], BLUE, 2.2),
        path([(915, 665), (970, 665), (970, 435), (1012, 435)], BLUE, 2.2),
        path([(915, 720), (990, 720), (990, 730), (1012, 730)], BLUE, 2.2),
        path([(1139, 350), (1005, 350), (1005, 858), (1012, 858)], BLUE, 2.0),
        path([(1414, 350), (1552, 350), (1552, 858), (1542, 858)], '#9fa9a4', 1.6, dashed=True),
        path([(1414, 515), (1414, 535)], BLUE, 1.8),
        path([(1139, 515), (1139, 535)], BLUE, 1.8),
    ])

    # Three executable paths, each traced to current code.
    parts.extend([
        '<line x1="30" y1="905" x2="1570" y2="905" stroke="#cbd3cf" stroke-width="1.5"/>',
        text(40, 945, '三条主执行路径（与当前 ArkTS / 后端代码一一对应）', 30, INK, 700),
        lane(970, '① 入库', [
            ('CameraPicker', 'photoAccessHelper'),
            ('端侧图像压缩', 'JPEG · 长边 ≤1024'),
            ('AiGateway', 'POST /api/ai/vision'),
            ('补缺 + 确认', '用户点确认才入库'),
            ('LocalStore → 图谱', 'addItems · 标记脏图'),
        ]),
        lane(1075, '② 问答', [
            ('本地编排', 'matchCommand / routeIntent'),
            ('0 模型快答', '位置 / 数量 / 临期'),
            ('GraphRAG 证据', 'ragEvidence(mode, question)'),
            ('受控网关', 'POST /api/ai/chat'),
            ('工具行 → 确认', '[调整] / [购物] / [菜]'),
        ]),
        lane(1180, '③ 协同', [
            ('数据快照', 'buildDataSnapshot'),
            ('本地 + 云端', 'saveUserData · autoUpload'),
            ('版本冲突', '/api/sync/* · 409'),
            ('实时流转', '/api/flow/* · rev'),
            ('原地合并', 'applyDataSnapshot'),
        ]),
        text(40, 1314, '注：图谱服务为后端独立 API；当前 HarmonyOS 问答使用端侧 GraphQuery 生成证据，再提交给 AI 网关。', 18, MUTED),
        '</svg>',
    ])
    return '\n'.join(parts)


def main() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(build_svg(), encoding='utf-8')
    print(OUT)


if __name__ == '__main__':
    main()
