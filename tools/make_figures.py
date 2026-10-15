"""生成作品介绍文档缺的两张图（PIL 手绘，无第三方依赖）：
  1) docs/images/arch-diagram.png        核心架构图
  2) docs/images/cross-device-sync.png   跨设备联动效果图（手机 + 平板截图并排 + 同步说明）
像素尺寸按 2 倍超采样绘制后缩放，保证 Word 里清晰。
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, 'docs', 'images')
FONT = 'C:/Windows/Fonts/msyh.ttc'
FONT_B = 'C:/Windows/Fonts/msyhbd.ttc'

GREEN = (87, 215, 148)
TEAL = (61, 208, 174)
BLUE = (39, 173, 215)
INK = (20, 28, 44)
BODY = (60, 76, 92)
MUTED = (120, 138, 152)
CARD = (245, 249, 251)
BORDER = (206, 220, 228)
WARN = (232, 145, 30)


def f(size, bold=False):
    return ImageFont.truetype(FONT_B if bold else FONT, size)


def rrect(d, box, radius, fill, outline=None, width=0):
    d.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def text(d, xy, s, size=22, color=INK, bold=False, anchor=None):
    d.text(xy, s, font=f(size, bold), fill=color, anchor=anchor)


def arrow(d, x1, y1, x2, y2, color=TEAL, width=4, head=10):
    d.line((x1, y1, x2, y2), fill=color, width=width)
    if y1 == y2:                       # 水平箭头
        d.polygon([(x2, y2), (x2 - head, y2 - head // 1.6), (x2 - head, y2 + head // 1.6)], fill=color)
    else:                              # 垂直箭头
        d.polygon([(x2, y2), (x2 - head // 1.6, y2 - head), (x2 + head // 1.6, y2 - head)], fill=color)


def arch_diagram():
    W, H, S = 1600, 1060, 2        # 逻辑尺寸 + 超采样倍数
    im = Image.new('RGB', (W * S, H * S), 'white')
    d = ImageDraw.Draw(im)
    d = ImageDraw.Draw(im)

    def X(v):
        return v * S

    text(d, (X(40), X(30)), '启核图策 NexcoreGraph · 核心架构', 34, INK, True)
    text(d, (X(40), X(80)), '端侧 ArkTS/ArkUI 原生 + 自建后端（局域网自建服务器，数据不出局域网）', 22, MUTED)

    # 端侧
    rrect(d, (X(40), X(130), X(760), X(560)), 24 * S, CARD, BORDER, 3 * S)
    text(d, (X(70), X(155)), '鸿蒙端（元服务 atomicService，API 23，ArkTS + ArkUI）', 25, INK, True)
    ui = [('AI 工作台 / 资源库 / 工作台 / 我的', '底部 Tab（手机）· 左侧通高导航（平板/2in1）'),
          ('拍照入库', 'CameraPicker 拍照 · 相册多选 · 压缩 ≤1024px/q80'),
          ('AI 助手', '意图路由 · 证据引用 · 工具行确认 · 语音输入'),
          ('数据同步', '登录即活同步（2s 轮询）· 显式「流转」接力'),
          ('本地存储', 'Preferences 快照 · 会话 · 主题 · 卡片数据')]
    y = 200
    for title, sub in ui:
        rrect(d, (X(70), X(y), X(730), X(y + 62)), 14 * S, 'white', BORDER, 2 * S)
        d.rectangle((X(70), X(y + 10), X(76), X(y + 52)), fill=GREEN)
        text(d, (X(96), X(y + 12)), title, 22, INK, True)
        text(d, (X(96), X(y + 40)), sub, 18, MUTED)
        y += 72

    # 后端
    rrect(d, (X(840), X(130), X(1560), X(560)), 24 * S, CARD, BORDER, 3 * S)
    text(d, (X(870), X(155)), '自建后端（Node.js + Express + MySQL）', 25, INK, True)
    be = [('AI 网关 /api/ai/*', '模型链自动降级 · 429 立即换模型 · 25s 硬预算 · 端侧零密钥'),
          ('知识图谱服务', '节点/边/社区/摘要/版本 五表 · 三模式证据装配'),
          ('同步与账号', '快照上传下载 · 版本冲突 409 · 验证码登录 · scrypt 密码'),
          ('流转中转（3100）', 'publish / latest(since rev)，局域网内多端数据同步'),
          ('用量与日志', 'ai_usage 按路由聚合 · ops_logs 操作留痕')]
    y = 200
    for title, sub in be:
        rrect(d, (X(870), X(y), X(1530), X(y + 62)), 14 * S, 'white', BORDER, 2 * S)
        d.rectangle((X(870), X(y + 10), X(876), X(y + 52)), fill=BLUE)
        text(d, (X(896), X(y + 12)), title, 22, INK, True)
        text(d, (X(896), X(y + 40)), sub, 18, MUTED)
        y += 72

    # 中间链路
    arrow(d, X(760), X(300), X(840), X(300), TEAL)
    text(d, (X(800), X(268)), 'HTTPS/HTTP', 17, MUTED, anchor='mm')
    arrow(d, X(840), X(420), X(760), X(420), BLUE)
    text(d, (X(800), X(452)), 'JSON 快照', 17, MUTED, anchor='mm')

    # 外部依赖
    rrect(d, (X(40), X(600), X(1560), X(760)), 24 * S, 'white', BORDER, 3 * S)
    text(d, (X(70), X(622)), '外部能力', 25, INK, True)
    ext = [('大模型网关（Agnes，OpenAI 兼容）', '视觉识别 · 文本生成 · 模型链降级'),
           ('SMTP 发信', '验证码邮件，自实现 SMTP-over-TLS'),
           ('系统能力', '相机 · 相册 · 文件(fd) · 图片编解码 · 传感器(受元服务限制)')]
    x = 70
    for title, sub in ext:
        rrect(d, (X(x), X(660), X(x + 470), X(726)), 14 * S, CARD, BORDER, 2 * S)
        text(d, (X(x + 20), X(672)), title, 20, INK, True)
        text(d, (X(x + 20), X(700)), sub, 17, MUTED)
        x += 500

    # 红线
    rrect(d, (X(40), X(800), X(1560), X(960)), 24 * S, (255, 250, 240), (240, 220, 180), 3 * S)
    text(d, (X(70), X(822)), '工程红线（代码层强制，提交前脚本自检）', 24, (180, 120, 20), True)
    for i, s in enumerate([
        '① 端侧不持有任何模型密钥：AI 调用一律经自建后端 /api/ai/*',
        '② 端侧构图 0 次模型调用：图谱由代码确定性生成，模型只读证据',
        '③ 数字由代码计算：统计、排序、证据数字不交给模型猜',
        '④ 隐私分级：聊天正文与图片二进制不随流转同步，图谱默认不进同步 payload',
    ]):
        text(d, (X(70), X(864 + i * 30)), s, 19, BODY)

    im = im.resize((W, H), Image.LANCZOS)
    out = os.path.join(IMG, 'arch-diagram.png')
    im.save(out)
    print('生成 ' + out)


def cross_device():
    """手机 + 平板截图并排，标注同步关系（图内不放任何未经核对的技术结论，只讲截图本身）"""
    phone = Image.open(os.path.join(IMG, 'shot-phone-library.jpeg')) if \
        os.path.exists(os.path.join(IMG, 'shot-phone-library.jpeg')) else None
    phone2 = Image.open(os.path.join(IMG, 'shot-phone-workbench.jpeg'))
    tablet = Image.open(os.path.join(IMG, 'shot-tablet-library.jpeg'))
    tablet2 = Image.open(os.path.join(IMG, 'shot-tablet-home.jpeg'))

    def thumb(img, h):
        w = int(img.width * h / img.height)
        return img.resize((w, h), Image.LANCZOS)

    ph = thumb(phone2, 760)
    tb = thumb(tablet2, 420)
    pad, top = 50, 150
    W = pad * 2 + ph.width + 150 + tb.width
    H = top + max(ph.height, tb.height) + 130
    S = 2
    im = Image.new('RGB', (W * S, H * S), 'white')
    d = ImageDraw.Draw(im)

    def X(v):
        return v * S

    text(d, (X(pad), X(40)), '跨设备联动：同一账号，手机与平板各自独立布局', 34, INK, True)
    text(d, (X(pad), X(92)), '手机（1320x2848，底部标签 + 单列）          平板（2880x1920，左侧通高导航 + 多列）',
         22, MUTED)

    x1 = pad
    x2 = pad + ph.width + 150
    im.paste(ph, (X(x1), X(top)))
    im.paste(tb, (X(x2), X(top + 40)))
    d.rectangle((X(x1), X(top), X(x1 + ph.width), X(top + ph.height)), outline=BORDER, width=3 * S)
    d.rectangle((X(x2), X(top + 40), X(x2 + tb.width), X(top + 40 + tb.height)), outline=BORDER, width=3 * S)

    mx = x1 + ph.width + 75
    arrow(d, X(mx - 55), X(top + 240), X(mx + 55), X(top + 240), TEAL)
    arrow(d, X(mx + 55), X(top + 330), X(mx - 55), X(top + 330), BLUE)
    text(d, (X(mx), X(top + 150)), '同一账号', 22, INK, True, anchor='mm')
    text(d, (X(mx), X(top + 182)), '2 秒轮询', 19, MUTED, anchor='mm')
    text(d, (X(mx), X(top + 415)), '实测 7 秒内', 19, TEAL, True, anchor='mm')
    text(d, (X(mx), X(top + 445)), '另一端自动呈现', 19, TEAL, True, anchor='mm')

    text(d, (X(pad), X(H - 70)),
         '说明：两端截图来自同一账号的真实运行环境；手机端为底部标签布局，平板端为左侧导航 + 多列内容，'
         '并非同一套布局放大。', 20, MUTED)

    im = im.resize((W, H), Image.LANCZOS)
    out = os.path.join(IMG, 'cross-device-sync.png')
    im.save(out)
    print('生成 ' + out)


if __name__ == '__main__':
    arch_diagram()
    cross_device()
