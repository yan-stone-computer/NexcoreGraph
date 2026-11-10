# -*- coding: utf-8 -*-
"""Compose a broadcast-ready 1920x1080 cover from Qwen art and a real Web screenshot."""
from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(r"D:\ProjectFiles\GithubPackage\NexcoreGraph")
PKG = ROOT / "deliverables" / "传智杯_启核图策_Web端"
SHOTS = PKG / "04_界面截图"
VIDEO = PKG / "03_演示视频"
LOGO = ROOT / "web" / "NexcoreGraph_web" / "assets" / "img" / "logo.png"

FONT_REGULAR = r"C:\Windows\Fonts\msyh.ttc"
FONT_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"

INK = "#F8FCF9"
MUTED = "#C9DDD3"
GREEN = "#58F09A"
MINT = "#C9F8DE"
WHITE = "#FFFFFF"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REGULAR, size=size)


def cover_crop(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def contain(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", size, (0, 0, 0, 0))
    canvas.alpha_composite(
        copy.convert("RGBA"),
        ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2),
    )
    return canvas


def rounded_mask(size: tuple[int, int], radius: int) -> Image.Image:
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
    return mask


def add_shadow(canvas: Image.Image, box: tuple[int, int, int, int], radius: int) -> None:
    x0, y0, x1, y1 = box
    shadow = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    layer = Image.new("RGBA", (x1 - x0 + 40, y1 - y0 + 40), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(
        (20, 20, layer.width - 20, layer.height - 20),
        radius=radius,
        fill=(0, 0, 0, 110),
    )
    layer = layer.filter(ImageFilter.GaussianBlur(18))
    shadow.alpha_composite(layer, (x0 - 20, y0 - 20 + 12))
    canvas.alpha_composite(shadow)


def browser_card(screenshot_path: Path, size: tuple[int, int] = (900, 566)) -> Image.Image:
    w, h = size
    radius = 24
    result = Image.new("RGBA", size, (18, 33, 27, 255))
    mask = rounded_mask(size, radius)
    chrome_h = 42
    screen = cover_crop(
        Image.open(screenshot_path).convert("RGB"),
        (w - 12, h - chrome_h - 12),
    ).convert("RGBA")
    result.alpha_composite(screen, (6, chrome_h))

    draw = ImageDraw.Draw(result)
    draw.text((24, 10), "●  ●  ●", font=font(17), fill="#7F9C8C")
    draw.rounded_rectangle((100, 8, w - 24, 34), radius=13, fill="#233C31")
    draw.text((120, 12), "127.0.0.1:8090  ·  启核图策 Web 端", font=font(15), fill="#CBE5D8")
    result.putalpha(mask)
    return result


def render(background_path: Path, output_png: Path, output_jpg: Path) -> None:
    canvas = cover_crop(Image.open(background_path).convert("RGB"), (1920, 1080)).convert("RGBA")

    # Left editorial reading field: deep translucent green with a soft teal edge.
    veil = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    vd = ImageDraw.Draw(veil)
    vd.rectangle((0, 0, 930, 1080), fill=(10, 50, 35, 218))
    vd.rectangle((930, 0, 1040, 1080), fill=(10, 50, 35, 72))
    canvas.alpha_composite(veil)

    draw = ImageDraw.Draw(canvas)
    draw.rectangle((0, 0, 1920, 7), fill=GREEN)
    draw.rectangle((0, 1042, 1920, 1044), fill=(88, 240, 154, 110))

    logo = contain(Image.open(LOGO).convert("RGBA"), (82, 82))
    canvas.alpha_composite(logo, (92, 72))
    draw.text((194, 82), "启核图策", font=font(34, True), fill=WHITE)
    draw.text((196, 122), "NexcoreGraph", font=font(18), fill=MUTED)

    draw.text((96, 188), "2026 传智杯  /  AI WEB 网页开发挑战赛", font=font(24, True), fill=GREEN)
    draw.multiline_text(
        (92, 248),
        "让一张照片\n接着把事情做完",
        font=font(78, True),
        fill=WHITE,
        spacing=10,
    )
    draw.text((96, 470), "家庭资源决策与执行智能体", font=font(34, True), fill=MINT)
    draw.multiline_text(
        (96, 530),
        "从真实库存与图谱证据出发，\n把识别、规划、采购和协作接成行动。",
        font=font(25),
        fill=MUTED,
        spacing=12,
    )
    labels = [("真实视觉", 96), ("GraphRAG", 246), ("受控执行", 426)]
    for label, x in labels:
        draw.rounded_rectangle((x, 642, x + 125, 684), radius=21, fill=(29, 92, 63, 210), outline=(83, 198, 126, 180), width=2)
        draw.text((x + 16, 651), label, font=font(20, True), fill="#DFF7E8")

    draw.text((96, 924), "天枢序列WEB  ·  团队编号 38377", font=font(24, True), fill=WHITE)
    draw.text((96, 966), "本科 B组  ·  3 人团队", font=font(20), fill=MUTED)
    draw.text((96, 1010), "WEB 端演示视频  ·  06:08", font=font(18, True), fill=GREEN)

    card = browser_card(SHOTS / "03-dashboard.png")
    add_shadow(canvas, (918, 246, 1818, 812), 24)
    canvas.alpha_composite(card, (918, 246))

    # Small evidence badge floating over the interface.
    badge = Image.new("RGBA", (350, 66), (0, 0, 0, 0))
    bd = ImageDraw.Draw(badge)
    bd.rounded_rectangle((0, 0, 349, 65), radius=18, fill=(247, 252, 249, 245), outline=(89, 151, 113, 220), width=2)
    bd.text((24, 12), "AI 生成", font=font(19, True), fill="#20784B")
    bd.text((123, 12), "·  用户确认后执行", font=font(19), fill="#445D51")
    canvas.alpha_composite(badge, (1030, 846))

    draw.text((1370, 1000), "NEXCOREGRAPH  /  WEB  /  2026", font=font(16, True), fill="#D4EADF")
    draw.line((1204, 1008, 1350, 1008), fill=(88, 240, 154, 150), width=2)

    output_png.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(output_png, quality=96)
    canvas.convert("RGB").save(output_jpg, quality=94, subsampling=0, progressive=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("background", type=Path)
    parser.add_argument("--png", type=Path, default=VIDEO / "启核图策-Web端演示视频-封面.png")
    parser.add_argument("--jpg", type=Path, default=VIDEO / "启核图策-Web端演示视频-封面.jpg")
    args = parser.parse_args()
    render(args.background, args.png, args.jpg)
    print(args.png)
    print(args.jpg)


if __name__ == "__main__":
    main()
