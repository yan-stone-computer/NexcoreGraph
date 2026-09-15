# -*- coding: utf-8 -*-
"""启核图策 NexcoreGraph · Logo 提取与多端资产生成

输入：一张包含圆形徽标（渐变圆 + 顶部嫩芽 + 白色 N + 白色弧线）的截图
输出：透明底母版 + Web/小程序图标尺寸 + 鸿蒙分层图标（foreground/background）+ 预览图

用法：
    python tools/extract_logo.py --src "C:\\path\\logo-screenshot.png" --out "assets\\brand"

说明：截图背景为纯色（默认 #F6F4EE 米白）时，按"圆内几何填充 + 圆外按色差估计 alpha"
     两步抠图，既保留白色 N/弧线（不会被当背景抠掉），又保留嫩芽的抗锯齿边缘。
"""

import argparse
import math
import os

from PIL import Image, ImageDraw

# 徽标品牌色（从截图采样）
BRAND = {
    "green": "#46B14C",      # 圆环上缘
    "sprout": "#B1EB59",     # 嫩芽
    "teal": "#2FD4B2",       # 过渡青
    "cyan": "#19BDC9",
    "blue": "#0CA8D6",       # 圆环右/下缘
    "blue_deep": "#029ED0",
    "white": "#FDFFFE",      # 内部 N 与弧线
    "surface_dark": "#13172B",
    "bg_source": (246, 244, 238),  # 截图的米白底
}


def color_dist(p, bg):
    return abs(p[0] - bg[0]) + abs(p[1] - bg[1]) + abs(p[2] - bg[2])


def find_crop_and_circle(img, bg, tol=30):
    """返回内容 bbox 与圆形的圆心/半径（用于区分"圆内白色元素"与"圆外背景"）。

    截图里可能还有别的 UI 元素（例如底部一条分隔线），先按空行把内容切成若干横向
    条带，只保留面积最大的一条（徽标本体），避免干扰圆心与半径的估计。
    """
    w, h = img.size
    px = img.load()
    rows = []  # (y, minx, maxx, count)
    for y in range(h):
        xs = []
        for x in range(w):
            if color_dist(px[x, y], bg) > tol:
                xs.append(x)
        if xs:
            rows.append((y, min(xs), max(xs), len(xs)))
    if not rows:
        raise SystemExit("截图中未检测到任何内容，请确认图片有效")

    bands = []
    current = [rows[0]]
    for r in rows[1:]:
        if r[0] - current[-1][0] <= 4:
            current.append(r)
        else:
            bands.append(current)
            current = [r]
    bands.append(current)
    band = max(bands, key=lambda b: sum(r[3] for r in b))

    minx = min(r[1] for r in band)
    maxx = max(r[2] for r in band)
    miny, maxy = band[0][0], band[-1][0]
    wide = [r for r in band if r[3] > 200]
    if not wide:
        raise SystemExit("未检测到圆形主体，请确认截图背景为纯色且徽标完整")
    cy = (wide[0][0] + wide[-1][0]) / 2
    cx = (min(r[1] for r in wide) + max(r[2] for r in wide)) / 2
    ry = (wide[-1][0] - wide[0][0]) / 2
    rx = (max(r[2] for r in wide) - min(r[1] for r in wide)) / 2
    return (minx, miny, maxx + 1, maxy + 1), (cx, cy, (rx + ry) / 2)


def cutout(img, bg, circle):
    """抠图：圆内几何填充为不透明（保住白色 N/弧线），圆外按色差估计抗锯齿 alpha。"""
    w, h = img.size
    px = img.load()
    cx, cy, R = circle
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    op = out.load()
    for y in range(h):
        for x in range(w):
            p = px[x, y]
            d = color_dist(p, bg)
            dc = math.hypot(x - cx, y - cy)
            if dc <= R - 1.5:
                a = 1.0
            else:
                a = max(0.0, min(1.0, (d - 10.0) / 25.0))
            if a <= 0.02:
                continue
            # 反混合：从"叠加在背景上的颜色"还原前景色
            r = (p[0] - (1 - a) * bg[0]) / a
            g = (p[1] - (1 - a) * bg[1]) / a
            b = (p[2] - (1 - a) * bg[2]) / a
            op[x, y] = (max(0, min(255, int(round(r)))), max(0, min(255, int(round(g)))),
                        max(0, min(255, int(round(b)))), int(round(a * 255)))
    return out


def square(icon, size, scale=0.92):
    """把可能非方的 logomark 放进正方形画布（等比、居中、留安全边距）。"""
    w, h = icon.size
    target = size * scale
    k = min(target / w, target / h)
    resized = icon.resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(resized, ((size - resized.size[0]) // 2, (size - resized.size[1]) // 2), resized)
    return canvas


def gradient_background(size, dark=BRAND["surface_dark"]):
    """应用图标底层：深海军蓝 + 品牌青绿径向辉光（与徽标同色系）。"""
    bgcolor = tuple(int(dark[i:i + 2], 16) for i in (1, 3, 5))
    img = Image.new("RGBA", (size, size), bgcolor + (255,))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(glow)
    steps = 60
    for i in range(steps, 0, -1):
        r = int(size * 0.72 * i / steps)
        alpha = int(38 * (1 - i / steps))
        d.ellipse((size * 0.5 - r, size * 0.32 - r, size * 0.5 + r, size * 0.32 + r),
                  fill=(93, 226, 148, alpha))
    for i in range(steps, 0, -1):
        r = int(size * 0.62 * i / steps)
        alpha = int(44 * (1 - i / steps))
        d.ellipse((size * 0.38 - r, size * 0.72 - r, size * 0.38 + r, size * 0.72 + r),
                  fill=(12, 168, 214, alpha))
    return Image.alpha_composite(img, glow)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--bg", default=None, help="截图底色，形如 246,244,238（默认取左上角像素）")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    img = Image.open(args.src).convert("RGB")
    bg = tuple(int(v) for v in args.bg.split(",")) if args.bg else img.getpixel((0, 0))

    bbox, circle = find_crop_and_circle(img, bg)
    crop = img.crop(bbox)
    cx, cy, R = circle
    local_circle = (cx - bbox[0], cy - bbox[1], R)
    mark = cutout(crop, bg, local_circle)
    mark_bbox = mark.getchannel("A").getbbox()
    mark = mark.crop(mark_bbox)
    mark.save(os.path.join(args.out, "nexcore-graph-logomark.png"))

    for s in (1024, 512, 256, 192, 128, 96, 64, 48, 32):
        square(mark, s).save(os.path.join(args.out, "nexcore-graph-logo-%d.png" % s))

    # Web 图标
    square(mark, 180).save(os.path.join(args.out, "apple-touch-icon-180.png"))
    square(mark, 512).save(os.path.join(args.out, "web-app-manifest-512.png"))
    square(mark, 192).save(os.path.join(args.out, "web-app-manifest-192.png"))
    mark.resize((32, 32), Image.LANCZOS).save(
        os.path.join(args.out, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

    # 鸿蒙分层图标（前台/背景）+ 合成预览
    fg = square(mark, 1024, scale=0.66)
    bgimg = gradient_background(1024)
    fg.save(os.path.join(args.out, "harmonyos-icon-foreground-1024.png"))
    bgimg.save(os.path.join(args.out, "harmonyos-icon-background-1024.png"))
    Image.alpha_composite(bgimg, fg).save(os.path.join(args.out, "harmonyos-icon-composite-1024.png"))

    # 预览：深色底 + 浅色底
    for name, color in (("_preview-dark.png", (19, 23, 43, 255)), ("_preview-light.png", (251, 247, 242, 255))):
        m = square(mark, 256)
        canvas = Image.new("RGBA", (336, 336), color)
        canvas.paste(m, (40, 40), m)
        canvas.convert("RGB").save(os.path.join(args.out, name))

    print("logomark(size):", mark.size)
    print("circle:", tuple(round(v, 1) for v in circle))
    print("files:", len(os.listdir(args.out)))


if __name__ == "__main__":
    main()
