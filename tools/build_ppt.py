# -*- coding: utf-8 -*-
"""启核图策 NexcoreGraph · 作品汇报 PPT（16:9，可编辑）"""
import os

from pptx import Presentation
from pptx.dml.color import RGBColor
from pptx.enum.shapes import MSO_SHAPE
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.util import Inches, Pt, Emu
from PIL import Image

ROOT = r"D:\ProjectFiles\GithubPackage\NexcoreGraph"
SHOTS = os.path.join(ROOT, "deliverables", "screenshots")
OUT = os.path.join(ROOT, "deliverables", "启核图策-作品汇报.pptx")
LOGO = os.path.join(ROOT, "docs", "brand", "mark-transparent-1024.png")

NAVY = RGBColor(0x0E, 0x14, 0x24)
NAVY2 = RGBColor(0x13, 0x17, 0x2B)
INK = RGBColor(0x0E, 0x14, 0x24)
MUTED = RGBColor(0x5C, 0x6C, 0x7C)
GREEN = RGBColor(0x2E, 0x8F, 0x63)
GREEN_BRIGHT = RGBColor(0x57, 0xD7, 0x94)
MINT = RGBColor(0xDC, 0xF6, 0xE8)
LIGHT = RGBColor(0xF5, 0xF9, 0xFB)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LINE = RGBColor(0xDC, 0xE7, 0xEE)

FONT = "Microsoft YaHei"
W, H = 13.333, 7.5


def add_rect(slide, x, y, w, h, fill=None, line=None, shape=MSO_SHAPE.RECTANGLE):
    s = slide.shapes.add_shape(shape, Inches(x), Inches(y), Inches(w), Inches(h))
    if fill is None:
        s.fill.background()
    else:
        s.fill.solid()
        s.fill.fore_color.rgb = fill
    if line is None:
        s.line.fill.background()
    else:
        s.line.color.rgb = line
        s.line.width = Pt(0.75)
    s.shadow.inherit = False
    return s


def add_text(slide, x, y, w, h, text, size=18, color=INK, bold=False,
             align=PP_ALIGN.LEFT, anchor=MSO_ANCHOR.TOP, spacing=1.15):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(h))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    p = tf.paragraphs[0]
    p.alignment = align
    p.line_spacing = spacing
    r = p.add_run()
    r.text = text
    r.font.name = FONT
    r.font.size = Pt(size)
    r.font.bold = bold
    r.font.color.rgb = color
    return tb


def bullets(slide, x, y, w, items, size=16, color=INK, gap=10):
    tb = slide.shapes.add_textbox(Inches(x), Inches(y), Inches(w), Inches(4.6))
    tf = tb.text_frame
    tf.word_wrap = True
    tf.margin_left = 0
    tf.margin_right = 0
    tf.margin_top = 0
    tf.margin_bottom = 0
    for i, it in enumerate(items):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        p.line_spacing = 1.25
        p.space_after = Pt(gap)
        r1 = p.add_run()
        r1.text = "· "
        r1.font.name = FONT
        r1.font.size = Pt(size)
        r1.font.bold = True
        r1.font.color.rgb = GREEN
        r2 = p.add_run()
        r2.text = it
        r2.font.name = FONT
        r2.font.size = Pt(size)
        r2.font.color.rgb = color
    return tb


def header(slide, kicker, title, dark=False):
    add_text(slide, 0.85, 0.62, 8, 0.32, kicker.upper(), 12,
             GREEN_BRIGHT if dark else GREEN, True)
    add_text(slide, 0.85, 1.0, 11.6, 0.7, title, 32,
             WHITE if dark else INK, True)
    add_rect(slide, 0.85, 1.86, 0.62, 0.09, GREEN_BRIGHT if dark else GREEN)


def picture(slide, path, x, y, w, h, border=True):
    im = Image.open(path)
    iw, ih = im.size
    box_ratio = w / h
    img_ratio = iw / ih
    if img_ratio > box_ratio:
        nw = w
        nh = w / img_ratio
    else:
        nh = h
        nw = h * img_ratio
    px = x + (w - nw) / 2
    py = y + (h - nh) / 2
    if border:
        add_rect(slide, px - 0.06, py - 0.06, nw + 0.12, nh + 0.12, WHITE, LINE)
    return slide.shapes.add_picture(path, Inches(px), Inches(py), Inches(nw), Inches(nh))


def notes(slide, text):
    slide.notes_slide.notes_text_frame.text = text


def new_slide(prs, bg=LIGHT):
    s = prs.slides.add_slide(prs.slide_layouts[6])
    add_rect(s, 0, 0, W, H, bg)
    return s


def build():
    prs = Presentation()
    prs.slide_width = Inches(W)
    prs.slide_height = Inches(H)

    # 1 Cover
    s = new_slide(prs, NAVY)
    add_rect(s, 0, 0, 0.16, H, GREEN_BRIGHT)
    if os.path.exists(LOGO):
        s.shapes.add_picture(LOGO, Inches(1.0), Inches(1.25), Inches(1.5), Inches(1.5))
    add_text(s, 2.75, 1.35, 9.4, 0.55, "启核图策 NexcoreGraph", 46, WHITE, True)
    add_text(s, 2.78, 2.12, 9.2, 0.45, "家庭资源智能管家 · 作品汇报", 24, GREEN_BRIGHT, False)
    add_rect(s, 2.78, 2.85, 3.2, 0.05, RGBColor(0x3D, 0xD0, 0xAE))
    add_text(s, 2.78, 3.2, 9.0, 1.2,
             "拍照建库 · AI 规划 · 临期预警 · 家庭协作", 20, RGBColor(0xB7, 0xC6, 0xD9))
    add_text(s, 2.78, 5.5, 9.0, 0.4,
             "2026 第九届传智杯全国大学生数智创新与 AI 应用大赛 · AI WEB 网页开发挑战赛",
             13, RGBColor(0x7C, 0x8C, 0xA6))
    notes(s, "开场：一句话——把家里看得见但记不住的东西，用拍照变成可计算、可规划的资源。")

    # 2 痛点
    s = new_slide(prs)
    header(s, "01 / 为什么做", "家里的东西，看得见，但记不住")
    cols = [
        ("记不住", "冰箱深处的食材过期、药盒里的药忘记有效期、工具用完找不到。", "每月都在重复浪费"),
        ("算不清", "记账类应用要求先手工录入，门槛高，最后大多荒废。", "录入门槛 > 使用价值"),
        ("协作难", "全家各记各的，重复购买、口味冲突、谁买谁用说不清。", "信息不共享"),
    ]
    for i, (t, d, tag) in enumerate(cols):
        x = 0.85 + i * 4.0
        add_rect(s, x, 2.25, 3.55, 3.6, WHITE, LINE)
        add_text(s, x + 0.35, 2.55, 2.9, 0.4, t, 24, GREEN, True)
        add_text(s, x + 0.35, 3.15, 2.85, 1.5, d, 15, INK)
        add_rect(s, x + 0.35, 5.2, 2.6, 0.34, MINT)
        add_text(s, x + 0.5, 5.25, 2.4, 0.25, tag, 11, GREEN)
    add_text(s, 0.85, 6.35, 11.6, 0.4,
             "核心判断：入口必须是“拍照”，而不是“填表”。", 18, INK, True)
    notes(s, "讲三个真实场景，落到一句判断：录入门槛决定这个工具会不会被用起来。")

    # 3 产品全貌
    s = new_slide(prs)
    header(s, "02 / 产品全貌", "三端交付，一套后端，一个 AI 网关")
    boxes = [
        ("鸿蒙端", "ArkTS / ArkUI\n主端 · 分布式流转", 0.85),
        ("Web 端", "浏览器 · 用户端 + 管理端", 4.55),
        ("微信小程序", "Taro + React\n随手拍 · 轻量入口", 8.25),
    ]
    for t, d, x in boxes:
        add_rect(s, x, 2.3, 3.35, 1.85, WHITE, LINE)
        add_text(s, x + 0.3, 2.55, 2.8, 0.4, t, 22, INK, True)
        add_text(s, x + 0.3, 3.05, 2.75, 0.9, d, 14, MUTED)
    add_rect(s, 0.85, 4.6, 10.75, 0.02, LINE)
    add_text(s, 0.85, 4.85, 4.6, 0.5, "自建后端", 20, GREEN, True)
    add_text(s, 0.85, 5.3, 5.2, 0.9,
             "Node.js + Express + MySQL\n账号 / 家庭 / 同步 / 预警 / 图谱 / 审计", 14, INK)
    add_text(s, 6.6, 4.85, 5.0, 0.5, "AI 编排网关", 20, GREEN, True)
    add_text(s, 6.6, 5.3, 5.4, 0.9,
             "意图路由 + 证据装配 + 工具协议\nAgnes 视觉 / 对话 · GraphRAG", 14, INK)
    add_text(s, 0.85, 6.55, 11.6, 0.35,
             "同一份 REST 契约与设计令牌，三端功能对齐、数据互通。", 13, MUTED)
    notes(s, "强调不是三个 Demo，而是三端共用一套后端与一套契约。")

    # 4 核心闭环
    s = new_slide(prs)
    header(s, "03 / 核心闭环", "从一张照片，到一次可执行的决策")
    steps = ["拍照 / 相册", "AI 结构化识别", "补缺确认入库", "临期 / 低库存预警", "方案与采购", "勾选核销"]
    for i, t in enumerate(steps):
        x = 0.75 + (i % 3) * 4.15
        y = 2.35 + (i // 3) * 1.55
        add_rect(s, x, y, 3.55, 1.05, WHITE, LINE)
        add_rect(s, x, y, 0.1, 1.05, GREEN_BRIGHT)
        add_text(s, x + 0.35, y + 0.18, 0.5, 0.3, str(i + 1).zfill(2), 12, GREEN, True)
        add_text(s, x + 0.35, y + 0.5, 3.0, 0.4, t, 17, INK, True)
    add_text(s, 0.85, 5.75, 11.5, 0.9,
             "每一步都留下可核对的证据：识别字段可改、库存数量由代码计算、写操作先预览后生效、操作可撤销。",
             16, INK)
    notes(s, "闭环的关键不是功能多，而是每一步都能核对、能回退。")

    # 5 AI 工作台
    s = new_slide(prs)
    header(s, "04 / AI 原生", "AI 是入口，不是外挂聊天框")
    picture(s, os.path.join(SHOTS, "02-ai-workbench.png"), 0.75, 2.15, 8.1, 4.75)
    add_text(s, 9.2, 2.3, 3.3, 0.4, "AI 工作台", 22, GREEN, True)
    bullets(s, 9.2, 2.85, 3.35, [
        "待确认队列由图谱事件驱动",
        "20+ 操作可用一句话完成",
        "指令手册即“一定能命中的句子”",
        "快答 0 次模型调用",
    ], 14, INK, 6)
    notes(s, "演示时先展示工作台，再输入一句“鸡蛋还剩 5 个”看确认卡。")

    # 6 看板与预警
    s = new_slide(prs)
    header(s, "05 / 真实数据", "看板与预警，全部来自代码计算")
    picture(s, os.path.join(SHOTS, "03-dashboard.png"), 0.75, 2.2, 7.0, 4.6)
    picture(s, os.path.join(SHOTS, "04-alerts.png"), 7.95, 2.2, 4.6, 4.6)
    add_text(s, 0.85, 6.95, 11.5, 0.35,
             "KPI、趋势、库存构成、临期清单与操作日志可逐项对账。", 12, MUTED)
    notes(s, "强调数字都由端侧代码计算，模型只负责措辞。")

    # 7 资源库 + 图谱
    s = new_slide(prs)
    header(s, "06 / 数据底座", "资源库是账本，知识图谱是推理路径")
    picture(s, os.path.join(SHOTS, "05-libraries.png"), 0.75, 2.2, 6.9, 4.5)
    picture(s, os.path.join(SHOTS, "06-graph.png"), 7.85, 2.2, 4.7, 4.5)
    add_text(s, 0.85, 6.95, 11.5, 0.35,
             "物品 → 概念 → 菜谱 → 采购候选，构成本地 GraphRAG 的证据链。", 12, MUTED)
    notes(s, "点节点可以展示回答依据的路径与来源。")

    # 8 协作与多端
    s = new_slide(prs)
    header(s, "07 / 协作与同步", "牌桌式协作，多端活同步")
    picture(s, os.path.join(SHOTS, "07-workbench.png"), 0.75, 2.15, 7.4, 4.7)
    add_text(s, 8.5, 2.3, 4.0, 0.4, "协作工作台", 22, GREEN, True)
    bullets(s, 8.5, 2.85, 4.0, [
        "6 位邀请码入桌，成员与池子落在后端",
        "各自摆库、传库、合并，结束后按归属扣减",
        "活同步：改完自动发，对端 2 秒内自动收",
        "跨设备流转：整份快照一键交接",
    ], 14, INK, 6)
    notes(s, "现场可以用两个窗口同账号演示同步。")

    # 9 技术架构
    s = new_slide(prs)
    header(s, "08 / 技术架构", "端侧事实、服务端网关、可追溯的 AI")
    rows = [
        ("客户端", "鸿蒙 ArkTS / Web 原生 ES5 + 模块 / 小程序 Taro 4 + React 18"),
        ("服务端", "Node.js 18 + Express + MySQL 8；局域网自建，数据不出局域网"),
        ("AI 网关", "意图 + 证据由端侧装配，Key 在服务端 .env；主备模型自动降级"),
        ("检索", "本地知识库 + 2-gram 倒排 + 图谱 local / global / multi-hop"),
        ("同步", "全量快照 + 版本号；409 冲突由用户二选一，不静默合并"),
    ]
    for i, (k, v) in enumerate(rows):
        y = 2.3 + i * 0.82
        add_text(s, 0.9, y, 1.7, 0.4, k, 16, GREEN, True)
        add_text(s, 2.6, y, 9.9, 0.55, v, 15, INK)
        add_rect(s, 0.9, y + 0.62, 11.6, 0.01, LINE)
    notes(s, "重点讲 AI 网关与同步协议，都是能落到代码里的设计。")

    # 10 AI 可靠性
    s = new_slide(prs)
    header(s, "09 / AI 可靠性", "三条红线：不编数字、不盲写、不失控")
    cards = [
        ("数值由代码计算", "库存、价格、临期天数全部来自本地查询，模型只做理解与措辞。"),
        ("写操作先预览", "调整、采购、执行方案都先生成确认卡，用户确认后才落库，且可撤销。"),
        ("单请求 ≤2 次调用", "高频问题走本地快答 0 次模型；主模型失败自动降级备用模型。"),
    ]
    for i, (t, d) in enumerate(cards):
        x = 0.85 + i * 4.0
        add_rect(s, x, 2.3, 3.55, 2.6, WHITE, LINE)
        add_text(s, x + 0.3, 2.6, 3.0, 0.5, t, 19, GREEN, True)
        add_text(s, x + 0.3, 3.25, 3.0, 1.4, d, 14, INK)
    add_rect(s, 0.85, 5.3, 11.6, 1.05, MINT)
    add_text(s, 1.15, 5.5, 11.0, 0.7,
             "这套约束让 AI 从“会聊天”变成“敢用来做决定”：回答可追溯、写操作可回退、成本可预算。",
             15, RGBColor(0x0D, 0x5B, 0x3A))
    notes(s, "这一页是评委最关心的：AI 的边界与可控性。")

    # 11 工程质量
    s = new_slide(prs)
    header(s, "10 / 工程质量", "能跑、能验、能复现")
    stats = [("40 / 40", "后端接口用例通过"), ("0", "冒烟检测控制台异常"),
             ("≈3 万行", "三端自研代码"), ("0.63 MB", "小程序主包")]
    for i, (n, t) in enumerate(stats):
        x = 0.85 + i * 3.0
        add_text(s, x, 2.35, 2.7, 0.8, n, 34, GREEN, True)
        add_text(s, x, 3.15, 2.7, 0.5, t, 13, MUTED)
    bullets(s, 0.85, 4.05, 6.0, [
        "密码 scrypt 慢哈希 + 每用户随机盐，连续失败锁定",
        "AI Key 只在本机 .env，仓库只提交模板",
        "局域网自建服务器，数据不出局域网",
    ], 15, INK, 8)
    bullets(s, 7.0, 4.05, 5.3, [
        "冒烟工具校验溢出、破图、控制台异常",
        "上传截图与验收报告，可逐条复核",
        "启动器一键拉起后端 / 流转 / 网页",
    ], 15, INK, 8)
    notes(s, "用数字说话，强调可复现。")

    # 12 管理端
    s = new_slide(prs)
    header(s, "11 / 运营视角", "管理员端：用户、家庭、审计与图谱看板")
    picture(s, os.path.join(SHOTS, "09-admin.png"), 0.8, 2.2, 8.0, 4.6)
    add_text(s, 9.1, 2.35, 3.4, 0.4, "真实后端数据", 20, GREEN, True)
    bullets(s, 9.1, 2.9, 3.4, [
        "管理员登录走同一套验证码与 token",
        "用户 / 家庭 / 审计 / AI 用量",
        "图谱看板只展示聚合统计",
        "不含物品明细，符合脱敏口径",
    ], 13, INK, 5)
    notes(s, "管理端不是演示壳，登录与总览都走真实后端接口。")

    # 13 落地价值 + 收尾
    s = new_slide(prs, NAVY)
    add_rect(s, 0, 0, 0.16, H, GREEN_BRIGHT)
    add_text(s, 0.95, 1.15, 11.4, 0.7, "落地价值与下一步", 34, WHITE, True)
    add_text(s, 0.95, 2.15, 5.4, 0.4, "已经验证", 18, GREEN_BRIGHT, True)
    bullets(s, 0.95, 2.65, 5.3, [
        "三端可运行、数据互通",
        "拍照入库 → 预警 → 方案 → 核销闭环",
        "AI 回答可追溯、写操作可回退",
    ], 15, RGBColor(0xF2, 0xF7, 0xFB), 8)
    add_text(s, 6.7, 2.15, 5.6, 0.4, "下一步", 18, GREEN_BRIGHT, True)
    bullets(s, 6.7, 2.65, 5.6, [
        "接入更多家庭真实数据做 A/B 调参",
        "补充语音播报与订阅消息触达",
        "把知识图谱扩展到跨家庭匿名洞察",
    ], 15, RGBColor(0xF2, 0xF7, 0xFB), 8)
    add_text(s, 0.95, 5.9, 11.4, 0.5, "启核图策：拍照建库，AI 规划，全家协作。",
             24, WHITE, True)
    notes(s, "收尾落回一句话价值主张。")

    prs.save(OUT)
    print("WROTE", OUT, "slides:", len(prs.slides))


if __name__ == "__main__":
    build()
