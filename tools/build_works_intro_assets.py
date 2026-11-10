# -*- coding: utf-8 -*-
"""Build editorial diagrams and screenshot strips for the NexcoreGraph brief."""
from __future__ import annotations

import base64
from html import escape
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_OUT = ROOT / "deliverables" / "作品介绍增强" / "assets"
DIAGRAM_OUT = ASSET_OUT / "diagrams"
SCREEN_OUT = ASSET_OUT / "screens"
SCREEN_SRC = SCREEN_OUT / "src"

INK = "#1C2923"
MUTED = "#607069"
LINE = "#9AA9A2"
GRID = "#DDE7E1"
GREEN = "#2F8458"
GREEN_DARK = "#205A3D"
PALE_GREEN = "#E8F5EC"
TEAL = "#169B99"
PALE_TEAL = "#E2F5F3"
WARM = "#FAF7F1"
PALE = "#F1F5F2"
WHITE = "#FFFFFF"
FONT = "Microsoft YaHei, Arial, sans-serif"


def text(
    x: float,
    y: float,
    value: str,
    size: int = 26,
    fill: str = INK,
    weight: int = 400,
    anchor: str = "start",
) -> str:
    # Keep every diagram readable at the 16.5 cm insertion width.
    size = max(size, 28)
    return (
        f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
        f'font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">'
        f"{escape(value)}</text>"
    )


def line(
    x1: float,
    y1: float,
    x2: float,
    y2: float,
    color: str = LINE,
    width: int = 3,
    dashed: bool = False,
    arrow: bool = False,
) -> str:
    dash = ' stroke-dasharray="10 8"' if dashed else ""
    marker = ' marker-end="url(#arrow)"' if arrow else ""
    return (
        f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" '
        f'stroke="{color}" stroke-width="{width}"{dash}{marker}/>'
    )


def path(
    d: str,
    color: str = LINE,
    width: int = 3,
    dashed: bool = False,
    arrow: bool = True,
) -> str:
    dash = ' stroke-dasharray="10 8"' if dashed else ""
    marker = ' marker-end="url(#arrow)"' if arrow else ""
    return (
        f'<path d="{d}" fill="none" stroke="{color}" '
        f'stroke-width="{width}"{dash}{marker}/>'
    )


def box(
    x: float,
    y: float,
    w: float,
    h: float,
    title: str,
    body: list[str],
    fill: str = WHITE,
    stroke: str = GRID,
    accent: str = GREEN,
    number: str | None = None,
    title_size: int = 28,
    body_size: int = 21,
) -> str:
    parts = [
        f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="18" '
        f'fill="{fill}" stroke="{stroke}" stroke-width="2"/>'
    ]
    tx = x + 28
    ty = y + 48
    if number:
        parts.append(
            f'<circle cx="{x + 36}" cy="{y + 36}" r="20" fill="{accent}"/>'
        )
        parts.append(text(x + 36, y + 44, number, 19, WHITE, 700, "middle"))
        tx = x + 68
        ty = y + 46
    parts.append(text(tx, ty, title, title_size, INK, 700))
    for index, row in enumerate(body):
        parts.append(text(x + 28, y + 92 + index * 34, row, body_size, MUTED))
    return "".join(parts)


def svg_shell(width: int, height: int, body: str) -> str:
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="{height / width * 210:.2f}mm" viewBox="0 0 {width} {height}">
<defs>
  <marker id="arrow" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
    <path d="M 0 0 L 12 6 L 0 12 z" fill="{LINE}"/>
  </marker>
  <marker id="arrowGreen" markerUnits="userSpaceOnUse" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto">
    <path d="M 0 0 L 12 6 L 0 12 z" fill="{GREEN}"/>
  </marker>
</defs>
<rect width="{width}" height="{height}" fill="{WHITE}"/>
{body}
</svg>
"""


def product_loop() -> str:
    w, h = 1400, 1040
    body = [
        text(46, 52, "从一张照片，到全家完成一次行动", 34, INK, 700),
        text(46, 92, "AI 降低记录成本，规则守住事实，确认门守住写权限。", 24, MUTED),
        text(46, 146, "输入", 24, GREEN, 700),
        text(476, 146, "判断与规划", 24, GREEN, 700),
        text(906, 146, "行动与协作", 24, GREEN, 700),
    ]
    cards = [
        ("01", "拍一张照片", ["冰箱、药箱、衣柜", "先记录，不先填表"]),
        ("02", "生成结构化库存", ["名称、数量、位置、", "保质期与参考价格"]),
        ("03", "识别当下优先级", ["临期、低库存与缺口", "进入今日待办"]),
        ("04", "给出下一步方案", ["结合真实存量", "生成可执行餐食"]),
        ("05", "执行或补齐", ["扣减库存、可撤销", "缺料进入采购清单"]),
        ("06", "让全家看见", ["邀请码建立协作池", "多设备同步同一状态"]),
    ]
    positions = [
        (45, 180),
        (505, 180),
        (965, 180),
        (965, 475),
        (505, 475),
        (45, 475),
    ]
    for index, ((x, y), (number, title, rows)) in enumerate(zip(positions, cards)):
        fill = PALE_GREEN if index in (1, 2, 3) else WHITE
        body.append(
            box(
                x,
                y,
                390,
                180,
                title,
                rows,
                fill,
                number=number,
                title_size=29,
                body_size=24,
            )
        )
    body += [
        line(435, 270, 501, 270, GREEN, 5, arrow=True),
        line(895, 270, 961, 270, GREEN, 5, arrow=True),
        line(1160, 360, 1160, 471, GREEN, 5, arrow=True),
        line(961, 565, 899, 565, GREEN, 5, arrow=True),
        line(501, 565, 439, 565, GREEN, 5, arrow=True),
        path("M 240 655 L 240 770 L 930 770 L 930 365 L 899 365", GREEN, 4, dashed=True),
        text(565, 812, "反馈：确认后的新事实重新进入资源图谱", 24, GREEN_DARK, 600, "middle"),
        f'<rect x="45" y="850" width="1310" height="120" rx="20" fill="{WARM}" stroke="{GRID}" stroke-width="2"/>',
        text(76, 890, "结果回流", 28, GREEN_DARK, 700),
        text(
            76,
            930,
            "库存变化、方案执行与采购完成被写回图谱，下一次判断基于更新后的家庭事实。",
            24,
            INK,
        ),
        text(46, 1000, "用户只负责拍照与确认；重复记录、关系整理和行动排序交给系统。", 24, MUTED),
    ]
    return svg_shell(w, h, "".join(body))


def system_architecture() -> str:
    w, h = 1400, 1320
    body = [
        text(44, 52, "五层系统架构", 34, INK, 700),
        text(44, 92, "体验、接口、编排、事实与协同彼此分层，写权限只在确认门之后进入事实层。", 23, MUTED),
    ]

    bands = [
        (38, 126, 1324, 184, "L1  体验层 · Taro / React / TypeScript", WHITE),
        (38, 350, 1324, 184, "L2  接口层 · Node.js + Express", PALE),
        (38, 574, 1324, 184, "L3  编排层 · 规则 / GraphRAG / 模型", PALE_GREEN),
        (38, 798, 1324, 184, "L4  事实层 · MySQL 快照与图谱", WHITE),
        (38, 1022, 1324, 170, "L5  协同层 · 版本轮询与显式流转", PALE_TEAL),
    ]
    for x, y, bw, bh, title, fill in bands:
        body.append(f'<rect x="{x}" y="{y}" width="{bw}" height="{bh}" rx="22" fill="{fill}" stroke="{GRID}" stroke-width="2"/>')
        body.append(text(x + 22, y + 32, title, 24, GREEN_DARK, 700))

    exp_titles = [
        ("AI 工作台", "问答、证据与待办"),
        ("拍照入库", "识别后人工确认"),
        ("资源库 / 图谱", "物品与关系"),
        ("方案 / 协作", "执行与家庭同步"),
    ]
    for i, (title, sub) in enumerate(exp_titles):
        x = 60 + i * 320
        body.append(box(x, 174, 292, 106, title, [sub], WHITE, title_size=27, body_size=22))

    api_titles = [
        ("会话与家庭", "token 与成员身份"),
        ("工作区快照", "版本读取与上传"),
        ("AI 代理", "vision 与 chat 接口"),
        ("协作与日志", "邀请码、流转、用量"),
    ]
    for i, (title, sub) in enumerate(api_titles):
        x = 60 + i * 320
        body.append(box(x, 398, 292, 106, title, [sub], WHITE, title_size=27, body_size=22))

    orchestration = [
        ("本地指令", "确定性规则 · 0 次模型"),
        ("意图路由", "快问直答 / 复杂任务"),
        ("GraphRAG", "邻域 / 社区 / 多跳"),
        ("模型与确认门", "先预览，再授权写入"),
    ]
    for i, (title, sub) in enumerate(orchestration):
        fill = PALE_TEAL if title == "确认门" else WHITE
        if title == "模型与确认门":
            fill = PALE_TEAL
        body.append(box(60 + i * 320, 622, 292, 108, title, [sub], fill, title_size=27, body_size=22))

    data_titles = [
        ("工作区快照", "sync_snapshots"),
        ("图谱对象", "节点 / 边 / 社区"),
        ("操作日志", "可回读、可撤销"),
        ("家庭与流转", "成员、版本与接力"),
    ]
    for i, (title, sub) in enumerate(data_titles):
        x = 60 + i * 320
        body.append(box(x, 846, 292, 106, title, [sub], WHITE, title_size=27, body_size=22))

    body += [
        box(60, 1068, 292, 86, "微信小程序 A", ["主操作端"], PALE_TEAL, title_size=26, body_size=22),
        box(380, 1068, 292, 86, "微信小程序 B", ["家庭协同端"], PALE_TEAL, title_size=26, body_size=22),
        box(700, 1068, 292, 86, "PC 微信", ["真机复测"], PALE_TEAL, title_size=26, body_size=22),
        box(1020, 1068, 292, 86, "flow-bridge · 3100", ["显式页面流转"], PALE_TEAL, title_size=25, body_size=22),
        line(700, 310, 700, 346, GREEN, 5, arrow=True),
        line(700, 534, 700, 570, GREEN, 5, arrow=True),
        line(700, 758, 700, 794, GREEN, 5, arrow=True),
        line(700, 982, 700, 1018, GREEN, 5, arrow=True),
    ]
    return svg_shell(w, h, "".join(body))


def controlled_ai() -> str:
    w, h = 1400, 1280
    icon = ASSET_OUT / "icons" / "control-gate.png"
    icon_uri = "data:image/png;base64," + base64.b64encode(icon.read_bytes()).decode("ascii")
    body = [
        text(44, 52, "受控 AI 执行链", 34, INK, 700),
        text(44, 92, "先分层判断，再让所有写操作经过同一个用户授权边界。", 24, MUTED),
        f'<rect x="38" y="126" width="1324" height="520" rx="24" fill="{WARM}" stroke="{GRID}" stroke-width="2"/>',
        f'<rect x="38" y="682" width="1324" height="540" rx="24" fill="{PALE_GREEN}" stroke="{GRID}" stroke-width="2"/>',
        text(65, 162, "AI 建议区 · 可理解、可提议，不直接写入", 24, GREEN_DARK, 700),
        text(410, 718, "用户授权区 · 预览、确认、提交与审计", 24, GREEN_DARK, 700),
        f'<image href="{icon_uri}" x="1284" y="690" width="64" height="64" preserveAspectRatio="xMidYMid meet"/>',
        box(64, 210, 250, 145, "用户请求", ["一张照片", "一句自然语言问题"], WHITE, title_size=28, body_size=24),
        box(355, 186, 420, 160, "本地事实通道", ["意图规则 · 库存回查", "位置 / 数量 / 临期", "0 次模型调用"], PALE_GREEN, title_size=28, body_size=24),
        box(355, 398, 420, 160, "生成推理通道", ["GraphRAG 证据装配", "模型措辞与工具意图", "复杂问题按需调用"], WHITE, title_size=28, body_size=24),
        box(835, 270, 300, 190, "候选回复", ["事实可被核对", "动作只能成为草稿"], WHITE, title_size=29, body_size=24),
        line(314, 270, 351, 270, GREEN, 5, arrow=True),
        path("M 314 300 L 334 300 L 334 469 L 351 469", GREEN, 5, arrow=True),
        line(775, 266, 831, 336, GREEN, 5, arrow=True),
        line(775, 478, 831, 404, GREEN, 5, arrow=True),
        path("M 985 460 L 985 650 L 232 650 L 232 778", GREEN, 5, arrow=True),
        text(248, 708, "预览", 23, GREEN_DARK, 700),

        box(62, 790, 320, 160, "写操作预览", ["对象：鸡蛋 · 当前 1 个", "目标：改为 5 个"], WHITE, title_size=28, body_size=23),
        f'<rect x="410" y="770" width="340" height="245" rx="20" fill="{WHITE}" stroke="{GRID}" stroke-width="2"/>',
        text(435, 810, "用户授权", 28, GREEN_DARK, 700),
        f'<rect x="430" y="835" width="136" height="135" rx="16" fill="{WARM}" stroke="{GRID}" stroke-width="2"/>',
        text(498, 878, "取消", 27, INK, 700, "middle"),
        text(498, 920, "库存不变", 22, MUTED, 400, "middle"),
        f'<rect x="592" y="835" width="132" height="135" rx="16" fill="{PALE_TEAL}" stroke="{TEAL}" stroke-width="2"/>',
        text(658, 878, "执行", 27, GREEN_DARK, 700, "middle"),
        text(658, 920, "受控写入", 22, GREEN_DARK, 400, "middle"),
        box(795, 790, 240, 160, "提交事实层", ["库存更新成功", "写入操作记录"], WHITE, title_size=27, body_size=22),
        box(1078, 790, 248, 160, "可回滚结果", ["结果可回读", "支持撤销"], PALE_TEAL, title_size=27, body_size=22),
        line(382, 870, 406, 870, GREEN, 5, arrow=True),
        line(750, 902, 791, 870, GREEN, 5, arrow=True),
        line(1035, 870, 1074, 870, GREEN, 5, arrow=True),
        text(84, 1015, "取消分支不会触发数据库事务。", 23, MUTED),
        text(78, 1170, "红线：模型输出只能成为草稿；确认门之后的代码路径才能修改用户数据。", 23, GREEN_DARK, 700),
    ]
    return svg_shell(w, h, "".join(body))


def family_sync() -> str:
    w, h = 1400, 900
    body = [
        text(44, 52, "一份库存，如何在两台设备上保持一致", 34, INK, 700),
        text(44, 92, "同步传递版本化事实，不传递整页截图；冲突时重拉，再按 id 原地合并。", 23, MUTED),
        box(48, 180, 390, 270, "① 设备 A 发生修改", ["新增物品", "调整数量", "执行方案或勾选采购"], WARM, title_size=28, body_size=24),
        box(505, 180, 390, 270, "② 上传版本化快照", ["sync_snapshots", "记录 rev 与家庭 ID", "MySQL 保存权威状态"], PALE_GREEN, title_size=28, body_size=24),
        box(962, 180, 390, 270, "③ 设备 B 应用更新", ["轮询状态并读取版本", "按 id 原地合并", "当前页面局部刷新"], PALE_TEAL, title_size=28, body_size=24),
        line(438, 315, 501, 315, GREEN, 5, arrow=True),
        line(895, 315, 958, 315, GREEN, 5, arrow=True),
        text(469, 287, "上传", 22, GREEN_DARK, 700, "middle"),
        text(926, 287, "下发", 22, GREEN_DARK, 700, "middle"),
        box(505, 560, 390, 180, "冲突处理", ["版本不一致时返回 409", "重新拉取后按 id 合并"], WHITE, title_size=27, body_size=22),
        box(48, 560, 390, 180, "显式流转（可选）", ["flow-bridge · 3100", "把当前页面送往另一设备"], PALE_TEAL, title_size=27, body_size=22),
        box(962, 560, 390, 180, "同步边界", ["库、物品、方案、采购、协作", "图片与聊天正文不随流转发送"], WHITE, title_size=27, body_size=22),
        line(700, 450, 700, 556, GREEN, 4, dashed=True, arrow=True),
        text(730, 515, "版本校验", 22, GREEN_DARK, 600),
        text(700, 820, "跨设备看到的是同一份结构化状态；同步失败时保留当前页面，不让用户操作被覆盖。", 23, MUTED, 500, "middle"),
    ]
    return svg_shell(w, h, "".join(body))


def make_diagrams() -> None:
    DIAGRAM_OUT.mkdir(parents=True, exist_ok=True)
    figures = {
        "01_product_loop.svg": product_loop(),
        "02_system_architecture.svg": system_architecture(),
        "03_controlled_ai.svg": controlled_ai(),
        "04_family_sync.svg": family_sync(),
    }
    for name, content in figures.items():
        (DIAGRAM_OUT / name).write_text(content, encoding="utf-8")


def font(size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(r"C:\Windows\Fonts\msyh.ttc", size=size)


def rounded_panel(im: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    mask = Image.new("L", im.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    shade = Image.new("RGB", im.size, (31, 44, 37))
    im.paste(shade, (4, 6), mask.point(lambda x: int(x * 0.16)))


def fit_image(path: Path, size: tuple[int, int]) -> Image.Image:
    im = Image.open(path).convert("RGB")
    im.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, "#F9F7F2")
    canvas.paste(im, ((size[0] - im.width) // 2, (size[1] - im.height) // 2))
    return canvas


def screenshot_strip(name: str, items: list[tuple[str, str]]) -> None:
    canvas_w = 1980
    phone_w, phone_h = 500, 983
    gap = 60
    top = 70
    footer = 90
    canvas_h = top + phone_h + footer
    im = Image.new("RGB", (canvas_w, canvas_h), "#FBF8F2")
    draw = ImageDraw.Draw(im)
    start_x = (canvas_w - (3 * phone_w + 2 * gap)) // 2
    for i, (filename, label) in enumerate(items):
        x = start_x + i * (phone_w + gap)
        y = top
        panel = (x - 10, y - 10, x + phone_w + 10, y + phone_h + 10)
        rounded_panel(im, panel, 30)
        draw.rounded_rectangle(panel, radius=30, fill="#FFFFFF", outline="#DDE7E1", width=2)
        img = fit_image(SCREEN_SRC / filename, (phone_w, phone_h))
        mask = Image.new("L", img.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, phone_w, phone_h), radius=26, fill=255)
        im.paste(img, (x, y), mask)
        draw.rounded_rectangle((x + 16, y + 16, x + 60, y + 60), radius=22, fill=GREEN)
        draw.text((x + 38, y + 38), str(i + 1), font=font(23), fill="white", anchor="mm")
        draw.text((x + phone_w // 2, y + phone_h + 50), label, font=font(25), fill=INK, anchor="mm")
    im.save(SCREEN_OUT / name, quality=94)


def make_screenshot_strips() -> None:
    SCREEN_OUT.mkdir(parents=True, exist_ok=True)
    screenshot_strip(
        "01_intake_strip.png",
        [
            ("intake.png", "拍照或相册入口"),
            ("recognition.png", "识别结果逐项确认"),
            ("library.png", "确认后进入资源库"),
        ],
    )
    screenshot_strip(
        "02_decision_strip.png",
        [
            ("dashboard.png", "库存与临期总览"),
            ("plans.png", "可执行餐食方案"),
            ("shopping.png", "缺料进入采购清单"),
        ],
    )
    screenshot_strip(
        "03_ai_strip.png",
        [
            ("workbench.png", "多轮对话与行动建议"),
            ("graph.png", "资源图谱与关系证据"),
            ("mine.png", "服务器与跨设备流转"),
        ],
    )
    screenshot_strip(
        "04_proof_strip.png",
        [
            ("simulator.png", "微信开发者工具运行"),
            ("pcdebug.png", "PC 微信真机调试"),
            ("recognition.png", "视觉识别真实返回"),
        ],
    )


def main() -> None:
    make_diagrams()
    make_screenshot_strips()
    print(f"WROTE {DIAGRAM_OUT}")
    print(f"WROTE {SCREEN_OUT}")


if __name__ == "__main__":
    main()
