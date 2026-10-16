# -*- coding: utf-8 -*-
"""生成文档 4.1 的核心架构图（手写 SVG + Edge 无头渲染）。

为什么不用 Pillow 画：文档里图宽 16.5cm，图内文字实际磅值 = 字号px × 图宽cm ÷ 画布宽px × 28.35。
Pillow 版本按 1560px 画布画 22px 字，落到文档里只有 8pt 左右，投影上根本看不清。
这里改成"收窄画布 + 放大字号"：画布 1200px、正文 26px，16.5cm 显示约 10pt。

内容与《作品介绍文档》4.1 一一对应：左鸿蒙端、右自建后端、中间两条通道、
下方外部能力与四条工程红线。改动文案时同时改 4.1，别让图文对不上。

用法：
    python tools/make_arch_figure.py                 # 生成 docs/images/arch-diagram.svg 与 .png（2 倍分辨率）
    python tools/make_arch_figure.py --scale 1       # 1 倍（1200px 宽）预览用
"""
import argparse
import os
import shutil
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_SVG = os.path.join(ROOT, 'docs', 'images', 'arch-diagram.svg')
OUT_PNG = os.path.join(ROOT, 'docs', 'images', 'arch-diagram.png')

W = 1200
H = 1010

# 注意：整个字体栈必须是"一个"带引号的属性值（外层双引号、族名用单引号），
# 否则 font-family 会在第一个引号处被截断，SVG 直接解析失败（Edge 只会渲染出报错页）。
FONT = "\"'Microsoft YaHei','Microsoft YaHei UI',SimHei,sans-serif\""
INK = '#26313A'
SUB = '#3C4A56'
MUTED = '#6B7A88'
TEAL = '#0F7A6B'          # 与软件主色一致的青绿
BLUE = '#3D6FB4'
ORANGE = '#E8893D'
CONN = '#2F5597'


def esc(s):
    return (s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;'))


def tw(s, fs):
    """估算文字宽度：全角 1.0em，半角 0.55em（用来卡"不溢出"，比肉眼可靠）。"""
    total = 0.0
    for ch in s:
        total += 1.0 if ord(ch) > 0x2000 else 0.55
    return total * fs


class Canvas(object):
    def __init__(self, scale):
        self.s = scale
        self.parts = []
        self.warn = []

    def px(self, v):
        return round(v * self.s, 2)

    def rect(self, x, y, w, h, fill, stroke, radius, stroke_w=1.6):
        self.parts.append(
            '<rect x="%s" y="%s" width="%s" height="%s" rx="%s" fill="%s" stroke="%s" stroke-width="%s"/>'
            % (self.px(x), self.px(y), self.px(w), self.px(h), self.px(radius), fill, stroke, self.px(stroke_w)))

    def text(self, x, y, s, fs, bold=False, color=INK, anchor='middle'):
        self.parts.append(
            '<text x="%s" y="%s" font-family=%s font-size="%s" font-weight="%s" fill="%s" '
            'text-anchor="%s" dominant-baseline="central">%s</text>'
            % (self.px(x), self.px(y), FONT, self.px(fs), '700' if bold else '400', color, anchor, esc(s)))

    def check(self, s, fs, box_w, where):
        need = tw(s, fs)
        if need > box_w:
            self.warn.append('%s 溢出：需要 %.0fpx，可用 %.0fpx —— %s' % (where, need, box_w, s))

    def triangle(self, x_base, x_tip, y_center, half_h, color):
        self.parts.append('<polygon points="%s,%s %s,%s %s,%s" fill="%s"/>'
                          % (self.px(x_base), self.px(y_center - half_h),
                             self.px(x_tip), self.px(y_center),
                             self.px(x_base), self.px(y_center + half_h), color))

    def svg(self):
        head = ('<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d">'
                '<rect width="100%%" height="100%%" fill="#FFFFFF"/>'
                % (self.px(W), self.px(H), self.px(W), self.px(H)))
        return head + ''.join(self.parts) + '</svg>\n'


def panel(c, x, w, y0, h, title, accent, tint, cards):
    """一栏：标题条 + 若干"标签 + 说明"卡片。卡片文字按框宽做过溢出检查。"""
    c.rect(x, y0, w, h, tint, accent, 14, 2.0)
    c.rect(x + 14, y0 + 14, w - 28, 46, accent, accent, 10, 1.0)
    c.check(title, 28, w - 28 - 28, '栏 %s 标题' % title)
    c.text(x + w / 2, y0 + 37, title, 28, True, '#FFFFFF')
    cy = y0 + 74
    for label, detail in cards:
        c.rect(x + 14, cy, w - 28, 80, '#FFFFFF', '#D5E0EA', 10, 1.4)
        c.rect(x + 14, cy + 12, 6, 56, accent, accent, 3, 0.6)
        c.check(label, 28, w - 28 - 56, '卡片标题 %s' % label)
        c.check(detail, 26, w - 28 - 56, '卡片说明 %s' % label)
        c.text(x + 34, cy + 27, label, 28, True, accent, 'start')
        c.text(x + 34, cy + 56, detail, 26, False, SUB, 'start')
        cy += 90


def build(scale):
    c = Canvas(scale)

    # 顶部标题带
    title = '启核图策 核心架构 · 局域网自建（数据不出局域网）'
    c.rect(24, 16, W - 48, 58, '#DCE9F7', '#A8C6E8', 12, 1.6)
    c.check(title, 30, W - 48 - 40, '主标题')
    c.text(W / 2, 45, title, 30, True, '#1F4E79')

    # 两条通道：上=调用，下=数据回流（单个大实心三角形，不用细线箭头）
    c.triangle(545, 655, 250, 46, CONN)
    c.text(600, 176, 'HTTP 调用', 24, True, CONN)
    c.triangle(655, 545, 470, 46, CONN)      # 与上三角关于两栏中线对称（250 / 470）
    c.text(600, 534, 'JSON 快照', 24, True, CONN)

    # 左：鸿蒙端
    left = [
        ('拍照入库', 'CameraPicker 拍照 · 相册多选'),
        ('端侧处理', '缩放 ≤1024px · JPEG q80'),
        ('本地快答', '问候/位置/数量/临期 本地直答'),
        ('端侧构图', '库/物品/概念/社区 → 0 次模型'),
        ('落地与多端', '快照落盘 + 4 张服务卡片'),
    ]
    panel(c, 24, 491, 90, 540, '① 鸿蒙端（元服务 · API 23）', TEAL, '#F2F8F6', left)

    # 右：自建后端
    right = [
        ('AI 网关 /api/ai/*', 'Key 只在服务端 · 25s 预算'),
        ('模型链降级', '429 立即换 · 2.5→3.0→2.0'),
        ('知识图谱服务', '节点·边·社区·摘要·版本'),
        ('账号与同步', '验证码 + scrypt · rev 409'),
        ('协作与用量', '协作池 · 用量看板 · 操作日志'),
    ]
    panel(c, 685, 491, 90, 540, '② 自建后端（Node + MySQL）', ORANGE, '#FDF6EF', right)

    # 外部能力
    band_y = 654
    c.rect(24, band_y, W - 48, 110, '#FFFFFF', '#C7D2DC', 12, 1.6)
    c.rect(40, band_y + 16, 120, 78, '#EEF3F9', '#D3DEE8', 10, 1.2)
    c.text(100, band_y + 55, '外部能力', 24, True, '#41586E')
    ext = [
        ('大模型网关 Agnes', '视觉 + 文本生成'),
        ('SMTP 发信', 'SMTP over TLS 发信'),
        ('系统能力', '相机·相册·文件·图片'),
    ]
    ex = 176
    for head, sub in ext:
        c.rect(ex, band_y + 16, 320, 78, '#F7FAFC', '#D8E2EA', 10, 1.4)
        c.check(head, 26, 296, '外部能力标题 %s' % head)
        c.check(sub, 24, 296, '外部能力说明 %s' % head)
        c.text(ex + 16, band_y + 40, head, 26, True, '#2E3A46', 'start')
        c.text(ex + 16, band_y + 70, sub, 24, False, MUTED, 'start')
        ex += 340

    # 工程红线
    red_y = 782
    c.rect(24, red_y, W - 48, 200, '#FFF9E6', ORANGE, 12, 2.0)
    c.text(44, red_y + 32, '工程红线（代码层强制 · 提交前脚本自检 11 项）', 26, True, '#B26A1F', 'start')
    rules = [
        '端侧不持有模型密钥：AI 调用一律经自建后端 /api/ai/*',
        '端侧构图 0 次模型调用：图谱由代码生成，模型只读证据',
        '数字由代码计算：统计、排序与证据数字不交给模型猜',
        '隐私分级：聊天正文与图片二进制不随流转同步',
    ]
    ry = red_y + 76
    for r in rules:
        c.check(r, 26, W - 48 - 80, '红线 %s' % r[:10])
        c.text(48, ry, '▪', 26, True, ORANGE, 'start')
        c.text(72, ry, r, 26, False, INK, 'start')
        ry += 36
    return c


def find_edge():
    for p in (r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
              r'C:\Program Files\Microsoft\Edge\Application\msedge.exe'):
        if os.path.exists(p):
            return p
    return shutil.which('msedge')


def render(svg_path, png_path, width, height):
    edge = find_edge()
    if not edge:
        sys.exit('未找到 Edge，无法渲染 PNG')
    tmp = tempfile.mkdtemp(prefix='archfig_')
    try:
        tmp_png = os.path.join(tmp, 'out.png')
        cmd = [edge, '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
               '--user-data-dir=' + os.path.join(tmp, 'profile'),
               '--screenshot=' + tmp_png,
               '--window-size=%d,%d' % (width, height),
               'file:///' + os.path.abspath(svg_path).replace('\\', '/')]
        subprocess.run(cmd, check=False, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        if not os.path.exists(tmp_png):
            sys.exit('渲染失败：Edge 没有产出 PNG')
        shutil.copyfile(tmp_png, png_path)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--scale', type=float, default=2.0)
    args = ap.parse_args()

    c = build(args.scale)
    for w in c.warn:
        print('[warn]', w)
    with open(OUT_SVG, 'w', encoding='utf-8') as f:
        f.write(c.svg())
    render(OUT_SVG, OUT_PNG, int(W * args.scale), int(H * args.scale))
    print('SVG: %s' % OUT_SVG)
    print('PNG: %s (%dx%d，文档里按 16.5cm 宽显示，正文约 10pt)' % (OUT_PNG, W * args.scale, H * args.scale))
    if c.warn:
        print('有 %d 处文字溢出，先调整文案再交付' % len(c.warn))


if __name__ == '__main__':
    main()
