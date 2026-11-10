# -*- coding: utf-8 -*-
"""三端视频操作与口播说明（每端一个 docx）"""
import os
from docx import Document
from docx.enum.table import WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

OUT = r"D:\ProjectFiles\GithubPackage\NexcoreGraph\deliverables\三端视频材料"
INK = RGBColor(0x0E, 0x14, 0x24)
GREEN = RGBColor(0x2E, 0x8F, 0x63)
MUTED = RGBColor(0x5C, 0x6C, 0x7C)
FILL = "EAF4DC"

HARMONY = [
    ("0:00–0:14", "启动应用，停在登录页；鼠标/手指点一下「已连接 http://…（局域网自建服务器）」这行。",
     "这是启核图策的鸿蒙端。登录连的是我自己电脑上的局域网服务，数据不出局域网。"),
    ("0:14–0:32", "登录进首页；依次划过「AI 工作台 / 资源库 / 工作台 / 我的」；展示右下角悬浮 AI 球。",
     "首页把 AI 放在最前面：待确认动作、库存提醒、资源入口都在这一屏。底部是四个主入口。"),
    ("0:32–1:05", "点「拍照入库」→ 用系统相机拍冰箱（或从相册选一张）→ 等识别结果 → 停在结果卡片 → 补齐缺失字段 → 点确认入库。",
     "拍一张照片，AI 直接给结构化结果：名称、数量、存放位置、保质期、价格。缺的字段我来补，确认之后才入库。"),
    ("1:05–1:35", "打开 AI 面板，说或输入「鸡蛋还剩 5 个」；出现确认卡后点确认；回资源库看鸡蛋数量。",
     "写操作不会直接改库。它先生成确认卡，我点确认才生效，后面还能撤销。"),
    ("1:35–1:55", "输入「指令手册」看五组指令；再输入「把牛奶加进采购清单」，点确认。",
     "除了聊天，它还认识一组固定指令：查库存、建库改名、物品增减、采购方案、多端设置，命中就本地执行。"),
    ("1:55–2:15", "打开方案列表 → 勾选用料 → 执行 → 回资源库看库存减少 → 点撤销恢复。",
     "方案不是只给文字，勾选用料就能核销库存，做完可以撤销。"),
    ("2:15–2:35", "打开资源图谱，点一个物品节点，展示路径证据；再打开数据分析看板。",
     "库存本身构成一张知识图谱，点开物品能看到它依据哪条路径回答。看板上的数字由代码实时计算。"),
    ("2:35–3:05", "手机新建「药盒」库；平板不操作，等 7 秒自动出现；再演示「发送流转 / 接收流转」；点一条 AI 回复的播报。",
     "同一账号，手机这边建完，平板不用碰，几秒内自己出现。换设备也能把整份快照流转过去。"),
    ("3:05–3:30", "回到首页，停 2 秒再结束录制。",
     "启核图策：拍照建库，AI 规划，全家协作。"),
]

WEB = [
    ("0:00–0:14", "登录页，鼠标停在「已连接 http://…（局域网自建服务器）」这行；展示手机号/邮箱输入框。",
     "这是启核图策的网页端。账号、家庭与库存都来自我自己电脑上的后端，没有演示账号，也没有固定验证码。"),
    ("0:14–0:32", "登录进入 AI 工作台；依次划过「待确认队列 / 实时统计 / 图谱社区」。",
     "登录后先看到的是 AI 工作台：待确认动作、实时库存、图谱社区都在这一屏。"),
    ("0:32–1:05", "首页看板 → 点「拍照入库」→ 拖入冰箱照片 → 等识别 → 停在结果卡片 → 补缺 → 点确认入库。",
     "上传一张冰箱照片，AI 识别名称、数量、保质期、位置和价格；确认之后才入库。"),
    ("1:05–1:35", "AI 输入「鸡蛋还剩 5 个」→ 确认卡 → 确认；再输入「今晚吃什么」→ 展示方案卡与下方证据来源。",
     "写操作先出确认卡；问今晚吃什么，方案下方会标出它引用的证据。"),
    ("1:35–1:55", "打开方案 → 勾选用料 → 执行 → 撤销；打开采购清单看合并结果。",
     "方案可以勾选核销，做完可撤销；缺料会自动合并进采购清单。"),
    ("1:55–2:20", "打开资源图谱，点物品节点看路径；回首页看板看 KPI、趋势、环形图。",
     "库存、菜谱、采购构成证据链；看板上的数字全部由代码计算。"),
    ("2:20–2:50", "设置 →「多端活同步」显示已连接；另一窗口不操作，等它自动更新；点「发送流转」，另一窗口点「接收流转」。",
     "多端是活的：这边改完，另一台两秒内自动收；也能整份快照流转。"),
    ("2:50–3:10", "打开 admin.html 登录；依次切「用户 / 家庭 / 审计 / AI 用量 / 图谱看板」。",
     "管理员端用同一套真实数据：用户、家庭、审计、用量与图谱看板。"),
    ("3:10–3:30", "回用户端首页，停 2 秒再结束录制。",
     "启核图策：拍照建库，AI 规划，全家协作。"),
]

WX = [
    ("0:00–0:14", "打开小程序，停在登录页，展示名称与局域网连接提示。",
     "这是启核图策的微信小程序端，轻量、即开即用，和网页、鸿蒙共用一套后端。"),
    ("0:14–0:32", "登录进首页；依次指出 KPI、健康度、7 天趋势、库存构成。",
     "首页先给你一眼看清：多少件、几件临期、健康度和本月花费。"),
    ("0:32–1:05", "点「拍照入库」→ chooseMedia 调相机/相册 → 选图 → 识别结果 → 补缺 → 确认入库。",
     "拍照或从相册选图，AI 给出名称、数量、保质期和位置，补缺后确认入库。"),
    ("1:05–1:35", "打开 AI 工作台，输入「鸡蛋还剩 5 个」→ 确认卡 → 确认；再问「今晚吃什么」。",
     "写操作先弹确认，确认后才改库存；问吃什么，它按真实库存给方案。"),
    ("1:35–1:55", "打开方案页 → 勾选执行 → 打开采购清单看合并结果。",
     "方案可以勾选核销，缺料自动进入采购清单。"),
    ("1:55–2:15", "打开预警页；再到「我的」页看订阅提醒入口、导出 CSV、服务器连接。",
     "临期和低库存集中提醒；可以导出清单，也能查看服务器连接。"),
    ("2:15–2:40", "打开资源图谱（分包加载）→ 点节点看路径；回首页看分享卡片。",
     "图谱页独立分包，主包保持轻量；分享卡片带图谱统计，点进来直达工作台。"),
    ("2:40–3:05", "展示 AI 回复的「播报」按钮（若 TTS 已配置）；回到首页。",
     "AI 回复可以语音播报，也能直接分享。"),
    ("3:05–3:20", "停在首页，停 2 秒再结束录制。",
     "启核图策：拍照建库，AI 规划，全家协作。"),
]


def set_cell_bg(cell, hex_fill):
    shd = OxmlElement("w:shd")
    shd.set(qn("w:val"), "clear")
    shd.set(qn("w:color"), "auto")
    shd.set(qn("w:fill"), hex_fill)
    cell._tc.get_or_add_tcPr().append(shd)


def font(run, size=10.5, bold=False, color=INK):
    run.font.name = "Microsoft YaHei"
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    run.font.size = Pt(size)
    run.font.bold = bold
    run.font.color.rgb = color


def build(name, title, subtitle, duration, prep, rows, note):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    sec.top_margin = sec.bottom_margin = Cm(1.8)
    sec.left_margin = sec.right_margin = Cm(1.8)
    normal = doc.styles["Normal"]
    normal.font.name = "Microsoft YaHei"
    normal.element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.font.size = Pt(10.5)

    p = doc.add_paragraph()
    font(p.add_run(title), 18, True, INK)
    p = doc.add_paragraph()
    font(p.add_run(subtitle), 10, False, MUTED)
    p = doc.add_paragraph()
    font(p.add_run("时长：" + duration + "　｜　口播即字幕，可按行做提词器"), 9.5, False, GREEN)

    p = doc.add_paragraph()
    font(p.add_run("录制前准备"), 12, True, GREEN)
    for item in prep:
        p = doc.add_paragraph(style="List Bullet")
        font(p.add_run(item), 10, False, INK)

    p = doc.add_paragraph()
    font(p.add_run("分镜与口播（照着操作、照着说）"), 12, True, GREEN)

    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    widths = [Cm(2.2), Cm(6.4), Cm(8.2)]
    headers = ["时间", "操作（做什么 / 点哪里）", "口播（说什么 / 字幕）"]
    for i, text in enumerate(headers):
        cell = table.rows[0].cells[i]
        cell.width = widths[i]
        set_cell_bg(cell, FILL)
        p = cell.paragraphs[0]
        font(p.add_run(text), 9.5, True, GREEN)

    for t, op, say in rows:
        cells = table.add_row().cells
        for i, text in enumerate((t, op, say)):
            cells[i].width = widths[i]
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(2)
            p.paragraph_format.line_spacing = 1.15
            font(p.add_run(text), 9.3, i == 0, INK if i != 0 else GREEN)

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    font(p.add_run("说明"), 10.5, True, GREEN)
    p = doc.add_paragraph()
    font(p.add_run(note), 9.5, False, MUTED)

    path = os.path.join(OUT, name)
    doc.save(path)
    print("WROTE", path)


def main():
    os.makedirs(OUT, exist_ok=True)
    build(
        "鸿蒙端-视频操作与口播.docx",
        "启核图策 NexcoreGraph · 鸿蒙端视频操作与口播",
        "赛道：HarmonyOS Codelabs 挑战赛｜主端：ArkTS / ArkUI，强调分布式流转与服务卡片",
        "3 分 30 秒",
        ["启动后端与流转中转（tools/start-lan.ps1），模拟器登录同一账号。",
         "关闭 AI 半模态浮层，避免遮挡底部导航。",
         "库存留 3–5 件带保质期物品，另建一个非食材库；相册准备一张冰箱照片。"],
        HARMONY,
        "服务卡片若已添加到桌面，可在开场补 3 秒展示；TTS 未配置时跳过播报动作，口播改为“语音播报可按端侧能力开启”。")
    build(
        "Web端-视频操作与口播.docx",
        "启核图策 NexcoreGraph · Web 端视频操作与口播",
        "赛道：AI WEB 网页开发挑战赛｜用户端 + 独立管理员端，强调 AI 原生工作台与 GraphRAG",
        "3 分 30 秒",
        ["双击 NexcoreWork.exe，等后端 / 流转 / 网页三个状态灯变绿。",
         "用管理员账号登录（验证码在启动器日志或邮箱）。",
         "账户里准备 3–5 个库、10 件左右物品；另开一个隐身窗口登录同账号，用于活同步演示。"],
        WEB,
        "验证码环节可先点“获取验证码”，切到启动器日志展示验证码再回来输入；管理端只停在聚合页，不展示个人手机号列表。")
    build(
        "小程序端-视频操作与口播.docx",
        "启核图策 NexcoreGraph · 小程序端视频操作与口播",
        "赛道：AI 微信小程序开发挑战赛｜Taro 4 + React 18，强调轻量、订阅提醒与分享",
        "3 分 20 秒",
        ["npm run dev:weapp，微信开发者工具打开 wxminiapp/NexcoreGraph_wxminiapp。",
         "登录演示账号；首页准备 3–5 个库、10 件左右物品。",
         "订阅消息模板未配置时，口播改为“订阅提醒入口已预留”。"],
        WX,
        "图谱页是独立分包，首次进入的短暂加载要保留，正好说明主包轻量的设计。")


if __name__ == "__main__":
    main()
