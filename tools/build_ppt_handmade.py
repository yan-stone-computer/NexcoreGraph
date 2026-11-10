# -*- coding: utf-8 -*-
"""启核图策 · 温暖手工风作品汇报（16:9，可编辑）"""
import os
from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt
from PIL import Image

ROOT = r"D:\ProjectFiles\GithubPackage\NexcoreGraph"
SHOTS = os.path.join(ROOT, "deliverables", "screenshots")
OUT = os.path.join(ROOT, "deliverables", "启核图策-作品汇报-温暖手工版.pptx")

PAPER = RGBColor(0xFB, 0xF3, 0xE4)
PAPER2 = RGBColor(0xF6, 0xE8, 0xD2)
INK = RGBColor(0x3B, 0x2F, 0x26)
MUTED = RGBColor(0x7A, 0x6A, 0x58)
TERRA = RGBColor(0xC2, 0x70, 0x1F)
SAGE = RGBColor(0x5B, 0x89, 0x3B)
KRAFT = RGBColor(0xB0, 0x89, 0x68)
TAPE = RGBColor(0xE8, 0xD9, 0xB8)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)

TITLE_FONT = "KaiTi"
BODY_FONT = "Microsoft YaHei"
W, H = 13.333, 7.5


def rect(s, x, y, w, h, fill=None, line=None, dash=False, rot=0, shape=MSO_SHAPE.RECTANGLE):
    sh = s.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        sh.fill.background()
    else:
        sh.fill.solid()
        sh.fill.fore_color.rgb = fill
    if line is None:
        sh.line.fill.background()
    else:
        sh.line.color.rgb = line
        sh.line.width = Pt(1.25)
        if dash:
            from pptx.enum.dml import MSO_LINE_DASH_STYLE
            sh.line.dash_style = MSO_LINE_DASH_STYLE.DASH
    sh.shadow.inherit = False
    if rot:
        sh.rotation = rot
    return sh


def text(s, x, y, w, h, t, size=16, color=INK, bold=False, font=BODY_FONT,
         align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=1.2):
    tb = s.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    for m in ("margin_left", "margin_right", "margin_top", "margin_bottom"):
        setattr(tf, m, 0)
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    r = p.add_run()
    r.text = t
    r.font.name = font
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    return tb


def tape(s, x, y, w=1.0, h=0.28, rot=-4):
    return rect(s, x, y, w, h, TAPE, None, rot=rot)


def polaroid(s, img, x, y, w, h, rot=0):
    rect(s, x - 0.12, y - 0.12, w + 0.24, h + 0.62, WHITE, None, rot=rot)
    im = Image.open(img)
    iw, ih = im.size
    box = w / h
    ratio = iw / ih
    if ratio > box:
        nw, nh = w, w / ratio
    else:
        nh, nw = h, h * ratio
    s.shapes.add_picture(img, Inches(x + (w - nw) / 2), Inches(y + (h - nh) / 2),
                         Inches(nw), Inches(nh))
    tape(s, x + w / 2 - 0.55, y - 0.24, 1.1, 0.26, -3)


def new_slide(prs):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    rect(s, 0, 0, W, H, PAPER)
    # 纸张边角：淡淡的双层边框
    rect(s, 0.18, 0.18, W - 0.36, H - 0.36, None, PAPER2, dash=True)
    return s


def header(s, kicker, title):
    text(s, 0.75, 0.55, 6, 0.35, kicker, 12, TERRA, True)
    text(s, 0.75, 0.9, 11.8, 0.8, title, 30, INK, True, TITLE_FONT)
    rect(s, 0.78, 1.78, 1.6, 0.06, TERRA)


def build():
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)

    # 1 封面
    s = new_slide(prs)
    tape(s, 1.0, 0.55, 1.5, 0.34, -5)
    text(s, 0.95, 1.35, 11.5, 1.0, "启核图策 NexcoreGraph", 44, INK, True, TITLE_FONT)
    text(s, 0.98, 2.35, 11.2, 0.55, "家庭资源智能管家 · 作品汇报", 24, TERRA, False, TITLE_FONT)
    rect(s, 0.98, 3.05, 4.2, 0.05, KRAFT, dash=True)
    text(s, 0.98, 3.35, 11.0, 1.2,
         "把家里“看得见、但记不住”的东西，\n变成一份能算、能规划、能一起用的资源账本。",
         20, MUTED, False, TITLE_FONT, spacing=1.5)
    text(s, 0.98, 6.35, 11.5, 0.35,
         "2026 第九届传智杯全国大学生数智创新与 AI 应用大赛 · AI WEB 网页开发挑战赛",
         11.5, MUTED)
    for i, (x, rot) in enumerate([(10.4, 8), (11.1, -6)]):
        rect(s, x, 1.15 + i * 0.18, 1.15, 0.9, TAPE, None, rot=rot)

    # 2 痛点
    s = new_slide(prs)
    header(s, "01 · 为什么做", "家里的东西，看得见，但记不住")
    items = [("记不住", "冰箱深处的食材过期，药盒里的药忘了有效期。"),
             ("算不清", "记账类应用要求先填表，门槛高，最后都荒废。"),
             ("协作难", "全家各记各的，重复购买、谁买谁用说不清。")]
    for i, (t, d) in enumerate(items):
        x = 0.8 + i * 4.05
        rect(s, x, 2.25, 3.65, 3.1, WHITE, KRAFT, dash=True, rot=(-1.2 if i % 2 == 0 else 1.2))
        tape(s, x + 1.2, 2.1, 1.1, 0.25, -4)
        text(s, x + 0.35, 2.55, 3.0, 0.45, t, 24, TERRA, True, TITLE_FONT)
        text(s, x + 0.35, 3.15, 3.0, 1.5, d, 15, INK)
    text(s, 0.8, 5.95, 11.7, 0.5, "所以入口必须是拍照，而不是填表。", 20, SAGE, True, TITLE_FONT)

    # 3 闭环
    s = new_slide(prs)
    header(s, "02 · 核心闭环", "从一张照片，到一次能执行的决策")
    steps = ["拍照 / 相册", "AI 结构化识别", "补缺确认入库", "临期 / 低库存预警", "方案与采购", "勾选核销"]
    for i, st in enumerate(steps):
        x = 0.75 + (i % 3) * 4.15
        y = 2.25 + (i // 3) * 1.7
        rect(s, x, y, 3.5, 1.2, PAPER2, KRAFT, rot=(-0.8 if i % 2 == 0 else 0.8))
        text(s, x + 0.25, y + 0.18, 0.6, 0.3, "%02d" % (i + 1), 12, TERRA, True)
        text(s, x + 0.25, y + 0.55, 3.0, 0.45, st, 17, INK, True)
    text(s, 0.8, 6.0, 11.7, 0.6,
         "识别字段可改、数量由代码计算、写操作先预览后生效、每一步都能撤销。", 17, INK)

    # 4 三端
    s = new_slide(prs)
    header(s, "03 · 产品全貌", "三端交付，一套后端")
    for i, (t, d) in enumerate([("鸿蒙端", "ArkTS / ArkUI\n主端 · 分布式流转"),
                                ("Web 端", "浏览器\n用户端 + 管理端"),
                                ("微信小程序", "Taro + React\n随手拍 · 轻量入口")]):
        x = 0.85 + i * 4.05
        rect(s, x, 2.25, 3.5, 1.8, WHITE, KRAFT, dash=True)
        text(s, x + 0.3, 2.5, 2.9, 0.4, t, 21, TERRA, True, TITLE_FONT)
        text(s, x + 0.3, 3.0, 2.9, 0.9, d, 14, MUTED)
    rect(s, 0.85, 4.55, 11.6, 1.15, PAPER2, KRAFT)
    text(s, 1.1, 4.75, 5.4, 0.35, "自建后端", 18, SAGE, True, TITLE_FONT)
    text(s, 1.1, 5.12, 5.4, 0.4, "Node + Express + MySQL · 局域网自建", 13, INK)
    text(s, 6.8, 4.75, 5.4, 0.35, "AI 编排网关", 18, SAGE, True, TITLE_FONT)
    text(s, 6.8, 5.12, 5.4, 0.4, "意图路由 + 证据装配 + GraphRAG", 13, INK)
    text(s, 0.85, 6.05, 11.6, 0.4, "同一份 REST 契约与设计令牌，三端功能对齐、数据互通。", 13, MUTED)

    # 5 AI 工作台
    s = new_slide(prs)
    header(s, "04 · AI 原生", "AI 是入口，不是外挂聊天框")
    polaroid(s, os.path.join(SHOTS, "02-ai-workbench.png"), 0.8, 2.05, 7.9, 4.55, -1)
    text(s, 9.05, 2.2, 3.4, 0.45, "这一屏就是工作台", 21, TERRA, True, TITLE_FONT)
    text(s, 9.05, 2.75, 3.4, 2.2,
         "待确认队列\n由图谱事件驱动\n\n20+ 操作一句话完成\n\n高频问题 0 次模型调用", 14, INK, spacing=1.4)
    text(s, 9.05, 5.35, 3.4, 0.8, "写操作先出确认卡，\n点确认才落库。", 14, SAGE, True, TITLE_FONT)

    # 6 看板 + 预警
    s = new_slide(prs)
    header(s, "05 · 真实数据", "看板与预警，都由代码算出来")
    polaroid(s, os.path.join(SHOTS, "03-dashboard.png"), 0.7, 2.0, 6.9, 4.35, -1.2)
    polaroid(s, os.path.join(SHOTS, "04-alerts.png"), 7.9, 2.0, 4.7, 4.35, 1.2)
    text(s, 0.85, 6.55, 11.5, 0.4, "KPI、趋势、库存构成、临期清单与操作日志，可以逐项对账。", 12, MUTED)

    # 7 资源库 + 图谱
    s = new_slide(prs)
    header(s, "06 · 数据底座", "资源库是账本，图谱是推理路径")
    polaroid(s, os.path.join(SHOTS, "05-libraries.png"), 0.7, 2.0, 6.8, 4.3, 1)
    polaroid(s, os.path.join(SHOTS, "06-graph.png"), 7.8, 2.0, 4.8, 4.3, -1)
    text(s, 0.85, 6.55, 11.5, 0.4, "物品 → 概念 → 菜谱 → 采购候选，构成可追溯的证据链。", 12, MUTED)

    # 8 协作
    s = new_slide(prs)
    header(s, "07 · 协作与同步", "一张牌桌，把全家拉到一起")
    polaroid(s, os.path.join(SHOTS, "07-workbench.png"), 0.8, 2.05, 7.4, 4.5, -1)
    text(s, 8.5, 2.2, 4.0, 0.45, "六位邀请码入桌", 20, TERRA, True, TITLE_FONT)
    text(s, 8.5, 2.75, 4.0, 2.6,
         "各自摆库、传库、合并\n结束后按归属扣减\n\n活同步：改完自动发\n跨设备：整份快照流转", 14, INK, spacing=1.4)
    rect(s, 8.5, 5.55, 3.7, 0.9, PAPER2, KRAFT, dash=True, rot=1.5)
    text(s, 8.7, 5.72, 3.4, 0.6, "数据只在局域网内流转", 13, SAGE, True, TITLE_FONT)

    # 9 三条红线
    s = new_slide(prs)
    header(s, "08 · AI 可靠性", "三条红线：不编数字、不盲写、不失控")
    notes = [("数值由代码算", "库存、价格、天数\n全部来自本地查询", -2.5),
             ("写操作先预览", "确认卡之后才落库\n而且可以撤销", 1.8),
             ("单请求 ≤2 次", "高频问题本地快答\n主模型失败自动降级", -1.2)]
    for i, (t, d, rot) in enumerate(notes):
        x = 0.9 + i * 4.0
        rect(s, x, 2.35, 3.5, 2.7, WHITE, KRAFT, rot=rot)
        tape(s, x + 1.15, 2.18, 1.2, 0.25, -4)
        text(s, x + 0.3, 2.65, 2.95, 0.45, t, 18, TERRA, True, TITLE_FONT)
        text(s, x + 0.3, 3.25, 2.95, 1.2, d, 14, INK, spacing=1.4)
    text(s, 0.9, 5.55, 11.5, 0.9,
         "让 AI 从“会聊天”变成“敢用来做决定”：回答可追溯、写操作可回退、成本可预算。",
         17, SAGE, True, TITLE_FONT, spacing=1.4)

    # 10 结尾
    s = new_slide(prs)
    tape(s, 1.0, 0.7, 1.4, 0.32, -5)
    text(s, 1.0, 1.6, 11.4, 0.9, "启核图策", 42, INK, True, TITLE_FONT)
    text(s, 1.0, 2.55, 11.4, 0.6, "拍照建库 · AI 规划 · 全家协作", 22, TERRA, False, TITLE_FONT)
    rect(s, 1.0, 3.5, 4.0, 0.05, KRAFT, dash=True)
    text(s, 1.0, 3.85, 11.4, 1.4,
         "我们想做的不是又一个清单工具，\n而是一个真正参与家庭决策的 AI 资源管家。",
         19, MUTED, False, TITLE_FONT, spacing=1.6)
    text(s, 1.0, 6.4, 11.4, 0.4, "谢谢观看 · NexcoreGraph 2026", 12, MUTED)

    # 11 需求与场景（答辩补充）
    s = new_slide(prs)
    header(s, "附录 A · 需求", "谁在用、在什么场景用、先做什么")
    left = ("家庭决策者：负责采购与做饭，最关心临期与浪费\n"
            "同住成员：想知道东西在哪、还剩多少\n"
            "长辈：需要大字、少步骤、语音输入\n\n"
            "场景一：周末盘点冰箱，拍照建库并生成一周菜谱\n"
            "场景二：做饭前问“鸡蛋还剩几个”，按现有食材出方案\n"
            "场景三：全家拼菜，结束后按归属扣减库存")
    right = ("优先级（P0 → P2）\n\n"
             "P0  拍照入库 / 库存增删改 / 临期预警 / 方案与核销\n"
             "P0  账号家庭 / 三角色权限 / 全量快照同步\n"
             "P1  采购清单 / 图谱问答 / 多端活同步 / AI 简报\n"
             "P1  语音播报 / 订阅消息 / 管理端审计\n"
             "P2  跨家庭匿名洞察 / 智能体主动规划")
    rect(s, 0.8, 2.15, 6.0, 4.4, WHITE, KRAFT, dash=True, rot=-0.8)
    text(s, 1.05, 2.4, 5.5, 3.9, left, 14, INK, spacing=1.45)
    rect(s, 7.0, 2.15, 5.5, 4.4, PAPER2, KRAFT, dash=True, rot=0.8)
    text(s, 7.25, 2.4, 5.0, 3.9, right, 14, INK, spacing=1.45)

    # 12 架构与数据流
    s = new_slide(prs)
    header(s, "附录 B · 架构", "一次问答，数据是怎么走的")
    flow = ["用户输入\n拍照 / 文字", "意图路由\n11 类，本地优先", "证据装配\n库存 + 知识库 + 图谱",
            "AI 网关\nKey 在服务端", "结构化动作\n预览 → 确认 → 落库"]
    for i, t in enumerate(flow):
        x = 0.55 + i * 2.52
        rect(s, x, 2.2, 2.25, 1.35, WHITE, KRAFT, dash=True, rot=(-1 if i % 2 == 0 else 1))
        text(s, x + 0.15, 2.45, 1.95, 0.95, t, 12.5, INK, True, spacing=1.3)
    text(s, 0.8, 3.95, 11.8, 2.4,
         "关键设计\n"
         "· 端侧只发“意图 + 证据”，模型不接触数据库，也不允许直接写库。\n"
         "· 高频问题（问候 / 位置 / 数量 / 保质期）走本地快答，0 次模型调用。\n"
         "· 写操作返回白名单工具行（[调整] / [购物] / [菜]），由端侧解析成确认卡。\n"
         "· 单请求最多 2 次模型调用；主模型失败自动切备用模型，再失败降级本地回答。",
         14, INK, spacing=1.5)

    # 13 AI 设计细节
    s = new_slide(prs)
    header(s, "附录 C · AI 设计", "让模型做它擅长的事，其余交给代码")
    cols = [
        ("意图路由", "greet / where / qty / expiry\n本地直答\ncook / creative / nutrition /\nsummary 走模型"),
        ("证据装配", "库存 ≤30 条\n每条带库位 / 数量 / 到期\n知识库命中带来源\n图谱证据带路径"),
        ("工具协议", "[调整]名称|数量\n[购物]名称|数量\n[菜]菜名|耗时|亮点|用料\n白名单校验，名称必须存在"),
    ]
    for i, (t, d) in enumerate(cols):
        x = 0.85 + i * 4.0
        rect(s, x, 2.2, 3.6, 3.0, WHITE, KRAFT, dash=True)
        text(s, x + 0.3, 2.45, 3.0, 0.4, t, 18, TERRA, True, TITLE_FONT)
        text(s, x + 0.3, 3.0, 3.0, 2.0, d, 13, INK, spacing=1.5)
    text(s, 0.85, 5.55, 11.6, 1.2,
         "评测口径：回答中的数量必须与库存一致；写操作必须经过确认；"
         "同一问题两次调用内返回；断网时本地快答仍可用。", 14, SAGE, True, TITLE_FONT, spacing=1.4)

    # 14 指标与测试
    s = new_slide(prs)
    header(s, "附录 D · 指标", "用可复核的数字说明完成度")
    metrics = [("40/40", "后端接口用例"), ("0", "冒烟控制台异常"), ("7s", "跨设备落地"),
               ("0.63MB", "小程序主包"), ("27", "REST 接口"), ("3 万行", "三端自研代码")]
    for i, (n, t) in enumerate(metrics):
        x = 0.8 + (i % 3) * 4.0
        y = 2.1 + (i // 3) * 1.55
        rect(s, x, y, 3.6, 1.2, WHITE, KRAFT, rot=(-1 if i % 2 == 0 else 1))
        text(s, x + 0.25, y + 0.18, 1.6, 0.6, n, 26, TERRA, True, TITLE_FONT)
        text(s, x + 2.0, y + 0.35, 1.4, 0.5, t, 12, MUTED)
    text(s, 0.8, 5.45, 11.8, 1.3,
         "测试覆盖：验证码登录 / 家庭与邀请码 / 409 冲突 / 图谱 rebuild 与查询 / "
         "AI 对话与视觉识别 / 用量聚合；安全项：scrypt 慢哈希 + 随机盐、"
         "Key 只存服务端、局域网自建、聊天仅本地。", 13.5, INK, spacing=1.5)

    prs.save(OUT)
    print("WROTE", OUT, "slides:", len(prs.slides))


if __name__ == "__main__":
    build()
