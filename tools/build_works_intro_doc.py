# -*- coding: utf-8 -*-
"""Build the redesigned NexcoreGraph mini-program work-introduction DOCX."""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT, WD_SECTION_START
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "deliverables" / "作品介绍增强" / "assets"
FINAL = ROOT / "deliverables" / "作品介绍增强" / "final"
OUT = FINAL / "启核图策-作品介绍文档-增强版.docx"

INK = "1C2923"
MUTED = "607069"
GREEN = "2F8458"
GREEN_DARK = "205A3D"
PALE_GREEN = "E8F5EC"
PALE_TEAL = "E2F5F3"
WARM = "FAF7F1"
LINE = "DDE7E1"
WHITE = "FFFFFF"
FONT = "Microsoft YaHei"
SERIF = "SimSun"


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, top=100, start=140, bottom=100, end=140) -> None:
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    mar = tc_pr.first_child_found_in("w:tcMar")
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tc_pr.append(mar)
    for name, value in (("top", top), ("start", start), ("bottom", bottom), ("end", end)):
        node = mar.find(qn(f"w:{name}"))
        if node is None:
            node = OxmlElement(f"w:{name}")
            mar.append(node)
        node.set(qn("w:w"), str(value))
        node.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths_in: list[float], indent_dxa: int = 120) -> None:
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:type"), "dxa")
    tbl_w.set(qn("w:w"), str(int(sum(widths_in) * 1440)))
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:type"), "dxa")
    tbl_ind.set(qn("w:w"), str(indent_dxa))
    grid = table._tbl.tblGrid
    for i, col in enumerate(grid.gridCol_lst):
        col.set(qn("w:w"), str(int(widths_in[i] * 1440)))
    for i, col_width in enumerate(widths_in):
        for cell in table.columns[i].cells:
            cell.width = Inches(col_width)
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def clear_cell_borders(cell) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = OxmlElement("w:tcBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        edge_node = OxmlElement(f"w:{edge}")
        edge_node.set(qn("w:val"), "nil")
        borders.append(edge_node)
    tc_pr.append(borders)


def set_cell_border(cell, **kwargs) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    borders = tc_pr.first_child_found_in("w:tcBorders")
    if borders is None:
        borders = OxmlElement("w:tcBorders")
        tc_pr.append(borders)
    for edge, attrs in kwargs.items():
        node = OxmlElement(f"w:{edge}")
        for key, value in attrs.items():
            node.set(qn(f"w:{key}"), str(value))
        borders.append(node)


def set_repeat_table_header(row) -> None:
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def paragraph_shading(paragraph, fill: str) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    p_pr.append(shd)


def paragraph_border(paragraph, color="DDE7E1", size=8, edge="bottom") -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = OxmlElement("w:pBdr")
    border = OxmlElement(f"w:{edge}")
    border.set(qn("w:val"), "single")
    border.set(qn("w:sz"), str(size))
    border.set(qn("w:space"), "4")
    border.set(qn("w:color"), color)
    p_bdr.append(border)
    p_pr.append(p_bdr)


def apply_font(run, size=None, bold=None, color=None, font=FONT) -> None:
    run.font.name = font
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), font)
    if size is not None:
        run.font.size = Pt(size)
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)


def add_run(paragraph, value: str, size=10.5, bold=False, color=INK, font=FONT):
    run = paragraph.add_run(value)
    apply_font(run, size, bold, color, font)
    return run


def add_body(doc, value: str, after=6, first_line=True, align=WD_ALIGN_PARAGRAPH.JUSTIFY):
    p = doc.add_paragraph(style="Body Text")
    p.alignment = align
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(after)
    p.paragraph_format.line_spacing = 1.333
    p.paragraph_format.first_line_indent = Cm(0.74) if first_line else Cm(0)
    add_run(p, value)
    return p


def add_kicker(doc, value: str, color=GREEN) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    add_run(p, value.upper(), 9, True, color)


def add_heading(doc, value: str, level=1) -> None:
    p = doc.add_paragraph(style=f"Heading {level}")
    p.paragraph_format.keep_with_next = True
    add_run(p, value, {1: 18, 2: 13.5, 3: 11.5}[level], True, GREEN_DARK)


def add_callout(doc, label: str, value: str, fill=PALE_GREEN, accent=GREEN) -> None:
    table = doc.add_table(rows=1, cols=1)
    set_repeat_table_header(table.rows[0])
    set_table_geometry(table, [6.65], indent_dxa=0)
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    for edge in ("top", "right", "bottom"):
        set_cell_border(cell, **{edge: {"val": "nil"}})
    set_cell_border(cell, left={"val": "single", "sz": "22", "color": accent})
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(2)
    add_run(p, label, 8.5, True, accent)
    p2 = cell.add_paragraph()
    p2.paragraph_format.space_after = Pt(0)
    p2.paragraph_format.line_spacing = 1.2
    add_run(p2, value, 10.5, False, INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(1)


def add_metric_strip(doc, items: list[tuple[str, str]]) -> None:
    widths = [6.65 / len(items)] * len(items)
    table = doc.add_table(rows=1, cols=len(items))
    set_repeat_table_header(table.rows[0])
    set_table_geometry(table, widths, indent_dxa=0)
    for idx, (value, label) in enumerate(items):
        cell = table.cell(0, idx)
        set_cell_shading(cell, PALE_TEAL if idx % 2 == 0 else WARM)
        for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
            set_cell_border(cell, **{edge: {"val": "nil"}})
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(1)
        add_run(p, value, 16, True, GREEN_DARK)
        p2 = cell.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_after = Pt(0)
        add_run(p2, label, 8, False, MUTED)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_figure(doc, image_path: Path, caption: str, width_in=6.45, alt: str = "") -> None:
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    run = p.add_run()
    run.add_picture(str(image_path), width=Inches(width_in))
    inline = run._r.xpath(".//wp:inline")[0]
    doc_pr = inline.xpath("./wp:docPr")[0]
    doc_pr.set("descr", alt or caption)
    cap = doc.add_paragraph(style="Caption")
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    cap.paragraph_format.space_after = Pt(8)
    add_run(cap, caption, 8.5, False, MUTED)


def add_table(doc, headers: list[str], rows: list[list[str]], widths: list[float]) -> None:
    table = doc.add_table(rows=1, cols=len(headers))
    table.rows[0]._tr.get_or_add_trPr()
    set_repeat_table_header(table.rows[0])
    set_table_geometry(table, widths)
    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        set_cell_shading(cell, PALE_GREEN)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p.paragraph_format.space_after = Pt(0)
        add_run(p, header, 9, True, GREEN_DARK)
    for row in rows:
        cells = table.add_row().cells
        for i, value in enumerate(row):
            p = cells[i].paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.15
            add_run(p, value, 9, False, INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_bullets(doc, items: list[str]) -> None:
    for item in items:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.208
        add_run(p, item, 10.3)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run()
    begin = OxmlElement("w:fldChar")
    begin.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(begin)
    run._r.append(instr)
    run._r.append(end)
    apply_font(run, 8, False, MUTED)


def setup_styles(doc: Document) -> None:
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = FONT
    normal._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = RGBColor.from_string(INK)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.333
    for name, size, color in (
        ("Title", 30, INK),
        ("Subtitle", 14, MUTED),
        ("Heading 1", 18, GREEN_DARK),
        ("Heading 2", 13.5, GREEN_DARK),
        ("Heading 3", 11.5, INK),
        ("Body Text", 10.5, INK),
        ("Caption", 8.5, MUTED),
    ):
        style = styles[name]
        style.font.name = FONT
        style._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), FONT)
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
    for name in ("List Bullet", "List Number"):
        style = styles[name]
        style.font.name = FONT
        style.font.size = Pt(10.3)
        style.paragraph_format.left_indent = Cm(0.96)
        style.paragraph_format.first_line_indent = Cm(-0.49)
        style.paragraph_format.space_after = Pt(3)
        style.paragraph_format.line_spacing = 1.208


def new_portrait_section(doc: Document):
    section = doc.add_section(WD_SECTION_START.NEW_PAGE)
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.65)
    section.bottom_margin = Cm(1.55)
    section.left_margin = Cm(1.85)
    section.right_margin = Cm(1.85)
    section.header_distance = Cm(0.7)
    section.footer_distance = Cm(0.65)
    return section


def new_landscape_section(doc: Document):
    section = doc.add_section(WD_SECTION_START.NEW_PAGE)
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width = Cm(29.7)
    section.page_height = Cm(21)
    section.top_margin = Cm(1.15)
    section.bottom_margin = Cm(1.15)
    section.left_margin = Cm(1.45)
    section.right_margin = Cm(1.45)
    section.header_distance = Cm(0.55)
    section.footer_distance = Cm(0.5)
    return section


def setup_running_furniture(section) -> None:
    section.header.is_linked_to_previous = False
    section.footer.is_linked_to_previous = False
    hp = section.header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    hp.paragraph_format.space_after = Pt(0)
    add_run(hp, "启核图策 NexcoreGraph  /  作品介绍", 8, False, MUTED)
    hp2 = section.header.add_paragraph()
    hp2.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    hp2.paragraph_format.space_after = Pt(0)
    add_run(hp2, "天枢序列小程序 · 团队编号 38378", 7.5, False, MUTED)
    paragraph_border(hp2, color=LINE, size=6, edge="bottom")
    fp = section.footer.paragraphs[0]
    fp.paragraph_format.space_before = Pt(0)
    add_run(fp, "天枢序列小程序 · 38378  /  2026", 7.5, False, MUTED)
    add_page_number(section.footer.add_paragraph())


def landscape_figure(doc: Document, heading: str, image_path: Path, caption: str, alt: str):
    doc.add_page_break()
    add_kicker(doc, "系统设计")
    with Image.open(image_path) as image:
        width, height = image.size
    usable_w = 6.55
    usable_h = 6.85
    img_h = usable_w * height / width
    if img_h > usable_h:
        usable_w = usable_h * width / height
        img_h = usable_h
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(3)
    p.paragraph_format.keep_with_next = True
    run = p.add_run()
    run.add_picture(str(image_path), width=Inches(usable_w))
    inline = run._r.xpath(".//wp:inline")[0]
    inline.xpath("./wp:docPr")[0].set("descr", alt)
    cap = doc.add_paragraph(style="Caption")
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(cap, caption, 8.5, False, MUTED)


def build() -> None:
    FINAL.mkdir(parents=True, exist_ok=True)
    doc = Document()
    setup_styles(doc)
    cover = doc.sections[0]
    cover.orientation = WD_ORIENT.PORTRAIT
    cover.page_width = Cm(21)
    cover.page_height = Cm(29.7)
    cover.top_margin = Cm(1.45)
    cover.bottom_margin = Cm(1.35)
    cover.left_margin = Cm(1.75)
    cover.right_margin = Cm(1.75)

    # Cover
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    logo_run = p.add_run()
    logo_run.add_picture(str(ASSETS / "brand-mark.png"), width=Inches(0.62))
    logo_inline = logo_run._r.xpath(".//wp:inline")[0]
    logo_inline.xpath("./wp:docPr")[0].set("descr", "启核图策品牌徽标")
    add_kicker(doc, "第九届传智杯 AI 微信小程序开发挑战赛")
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(16)
    p.paragraph_format.space_after = Pt(2)
    add_run(p, "一张照片，", 31, True, INK)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    add_run(p, "接着把事情做完", 31, True, GREEN_DARK)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(10)
    add_run(p, "启核图策 NexcoreGraph  /  家庭资源决策与执行智能体", 14, False, MUTED)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    add_run(p, "从识别一件物品，到让全家完成一次采购、消耗或协作。", 11.5, False, GREEN)
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.paragraph_format.space_after = Pt(8)
    hero_run = p.add_run()
    hero_run.add_picture(str(ASSETS / "hero" / "cover-hero.png"), width=Inches(6.55))
    hero_inline = hero_run._r.xpath(".//wp:inline")[0]
    hero_inline.xpath("./wp:docPr")[0].set(
        "descr", "家庭厨房中手机扫描食材并连接成资源关系的概念插画"
    )
    add_metric_strip(
        doc,
        [
            ("7 项", "单张冰箱图识别"),
            ("5.413 s", "视觉识别实测"),
            ("34 件", "演示库存规模"),
            ("双向", "模拟器与 PC 微信流转"),
        ],
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(8)
    p.paragraph_format.space_after = Pt(0)
    add_run(
        p,
        "团队：天枢序列小程序  ·  团队编号：38378  ·  负责人：高俊杰  ·  2026 年 10 月",
        8.2,
        False,
        MUTED,
    )

    # Main portrait body
    section = new_portrait_section(doc)
    setup_running_furniture(section)
    add_kicker(doc, "一页看懂")
    add_heading(doc, "这不是又一张库存表", 1)
    add_body(
        doc,
        "家里的东西往往不是完全没记录，而是记录了也来不及用。牛奶买了三瓶，没人知道冰箱里还有两瓶；"
        "鸡蛋在冷藏区放了一周，直到临期提醒出现才被想起来；工具箱里明明有一把螺丝刀，找的时候还是要把抽屉翻一遍。"
    )
    add_body(
        doc,
        "启核图策把入口放在一张照片上。视觉模型把物品变成结构化记录，图谱把物品、位置、期限和用途连起来，"
        "AI 再把这些事实收束成今天能做的动作。用户不需要先学一套收纳方法，也不用把家庭资产从头手工录入。"
    )
    add_callout(
        doc,
        "产品承诺",
        "照片进来，行动出去。AI 可以理解、建议和起草操作，但库存事实由代码维护，写入权限由用户确认。",
    )
    add_metric_strip(
        doc,
        [
            ("少填表", "识别后只补缺"),
            ("可追溯", "回答带事实与路径"),
            ("先确认", "写操作预览后执行"),
            ("能协作", "多设备共享同一状态"),
        ],
    )
    add_heading(doc, "核心技术命题", 2)
    add_body(
        doc,
        "作品要解决的问题不是把家庭物品存进一张表，而是把非结构化视觉输入转换为可查询、可推理、可执行并且可回滚的资源状态。"
        "这句话决定了系统不能只围绕聊天框设计，而必须同时具备数据建模、证据装配、权限约束和状态同步。"
    )
    add_callout(
        doc,
        "设计目标",
        "最小化不可信行动：允许模型理解和提议，但不允许模型绕过事实层直接改变用户资产。",
        fill=PALE_TEAL,
        accent="169B99",
    )
    add_heading(doc, "四项技术贡献", 2)
    for number, title, text in [
        ("01", "视觉输入状态化", "将照片中的物品转成带类型、库位、数量、期限与价格的候选状态，而不是一段不可计算的描述。"),
        ("02", "事实与推理分层", "本地规则、图谱证据与生成模型分工，简单事实不调用模型，复杂问题才进入 GraphRAG。"),
        ("03", "写操作事务化", "把提议、预览、确认、执行、审计和撤销串成受控事务，模型输出停留在草稿层。"),
        ("04", "多端状态合并", "用版本快照、冲突回拉和按 id 合并维护共享工作区，避免覆盖另一台设备正在编辑的内容。"),
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(1)
        add_run(p, f"{number}  {title}", 11.5, True, GREEN_DARK)
        p2 = doc.add_paragraph()
        p2.paragraph_format.left_indent = Cm(0.58)
        p2.paragraph_format.space_after = Pt(4)
        add_run(p2, text, 9.8, False, INK)
    add_heading(doc, "读这份文档的三条线", 2)
    add_body(
        doc,
        "第一条是用户体验：从拍照到采购、消耗与家庭协作怎样连成一条链。第二条是 AI 边界：什么由规则计算，"
        "什么交给模型，以及用户确认发生在哪一步。第三条是工程证据：真实识别、同步、测试与运行截图能核对到什么程度。"
    )

    add_kicker(doc, "问题与机会")
    add_heading(doc, "真正稀缺的不是记录，而是下一步", 1)
    add_body(
        doc,
        "设想一个普通的周五傍晚：冰箱里有快蔫的菠菜，冷藏区还有几个鸡蛋；家人顺手买了牛奶，却没看到柜里已经有两瓶；"
        "孩子问晚饭吃什么，工具箱又临时找不到。每件事都不大，但都需要有人先知道家里有什么，再给出一个能马上执行的决定。"
    )
    add_body(
        doc,
        "传统库存工具把“记下来”当成终点。用户要自己建分类、填数量、盯到期日，记录越完整，维护成本越高。"
        "普通聊天助手又会停在“回答”这一步：它可能建议你吃番茄炒蛋，却不知道鸡蛋只剩一个，也不能把缺料同步给正在超市的家人。"
    )
    add_heading(doc, "三个断点，决定产品从哪里切入", 2)
    for number, title, text in [
        ("01", "看不见", "物品散在冰箱、药箱、衣柜和工具箱里，状态没有共同视图。"),
        ("02", "想不起", "临期、缺料和可用资源没有被整理成今天的优先顺序。"),
        ("03", "传不到", "一个人知道的库存，无法在采购、做饭和整理时变成全家的共同信息。"),
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(1)
        add_run(p, f"{number}  {title}", 12, True, GREEN_DARK)
        p2 = doc.add_paragraph()
        p2.paragraph_format.left_indent = Cm(0.6)
        p2.paragraph_format.space_after = Pt(6)
        add_run(p2, text, 10.5, False, INK)
    add_body(
        doc,
        "产品选择从最小的输入开始。拍照比填表更接近家庭真实动作；确认比全自动更符合家庭数据的使用边界；"
        "共享同一份结构化事实，比在聊天群里反复问“家里还有没有”更能减少沟通成本。"
    )
    # Product loop landscape
    landscape_figure(
        doc,
        "一条从看见到行动的完整链路",
        ASSETS / "diagrams" / "01_product_loop.png",
        "图 1  产品闭环。确认后的结果重新进入资源图谱，为下一轮判断提供新材料。",
        "产品闭环示意：照片、结构化库存、优先级、方案、执行、家庭同步与图谱反馈。",
    )

    add_kicker(doc, "真实操作")
    add_heading(doc, "先识别，再确认入库", 1)
    add_body(
        doc,
        "拍照入库是本作品最短、也最有说服力的入口。用户从相机或相册选择图片，系统把视觉结果转成名称、数量、"
        "位置、保质期和参考价格。识别结果不会直接改库存，而是先进入可编辑的候选列表。用户确认目标库和字段之后，"
        "物品才进入资源库。"
    )
    add_body(
        doc,
        "这条路径有明确的失败处理：没有识别出物品就说明原因，模型不可用就提示服务状态，不用示例数据假装成功。"
        "一次真实冰箱图片识别返回 7 项，耗时 5.413 秒。这个数字不夸张，但它足以把“回家后逐件登记”变成一次拍照加几次确认。"
    )
    add_figure(
        doc,
        ASSETS / "screens" / "01_intake_strip.png",
        "图 2  拍照入库的真实路径：选择图片、修改候选字段、确认后进入资源库。",
        6.5,
        "三张真实小程序截图：拍照入库、AI 识别结果确认、资源库。",
    )
    add_callout(
        doc,
        "体验细节",
        "候选结果保留可编辑字段，用户只修改不确定的部分。AI 负责减少输入，人工确认负责把事实锁定。",
    )

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    add_kicker(doc, "从库存到行动")
    add_heading(doc, "首页先回答：今天先做什么", 1)
    add_body(
        doc,
        "入库之后，系统不把用户留在物品列表里。首页把库存量、临期数量、低库存任务、待执行方案和资源图谱规模放在同一屏，"
        "让“家里有什么”直接过渡到“今天该处理什么”。临近保质期的物品优先进入待办，缺料则进入采购清单。"
    )
    add_body(
        doc,
        "方案页读取真实库存后生成可核销的餐食。执行方案会扣减对应数量并留下操作记录；如果选错，可以撤销回滚。"
        "采购清单承接方案里的缺口，已购项可勾选，补货数量再回到库存，形成下一轮计算的输入。"
    )
    add_figure(
        doc,
        ASSETS / "screens" / "02_decision_strip.png",
        "图 3  从看板、方案到采购：三个页面共同完成一次从判断到补货的动作。",
        6.5,
        "三张真实小程序截图：首页库存看板、可执行餐食方案、采购清单。",
    )
    add_heading(doc, "动作不是一句建议，而是一组可核对的数据", 2)
    add_table(
        doc,
        ["用户看到的结论", "系统实际读取 / 修改的数据", "可信边界"],
        [
            ["鸡蛋只剩 1 个", "鸡蛋数量、单位、库位与操作记录", "数量来自库存，不由模型估算"],
            ["今晚可做 3 个方案", "临期食材、真实存量、缺料数量", "方案排序读取结构化库存"],
            ["缺 3 瓶牛奶", "采购清单条目与库存缺口", "勾选购买后再回写库存"],
            ["图谱有 246 个节点", "当前演示工作区的节点与关系", "数字随库存变化，不写死"],
        ],
        [2.15, 2.55, 1.95],
    )
    p = doc.add_paragraph(style="Caption")
    add_run(p, "表 1  页面结论与底层数据之间的对应关系。数据来源：真实小程序录屏与回归记录。", 8.5, False, MUTED)

    # Architecture landscape
    landscape_figure(
        doc,
        "五层架构：体验、接口、编排、事实与协同",
        ASSETS / "diagrams" / "02_system_architecture.png",
        "图 4  系统分层架构。模型与写操作被放在不同层，确认门位于 UI 意图与数据提交之间。",
        "五层系统架构，从微信小程序体验层到 MySQL 事实层和跨设备协同层。",
    )

    add_kicker(doc, "AI 如何参与")
    add_heading(doc, "让模型读懂问题，让图谱提供事实", 1)
    add_body(
        doc,
        "AI 工作台没有把每句话都交给大模型。位置、数量、保质期这类高频问题先经过本地规则和图谱查询，"
        "命中后直接回答并标注“0 次模型调用”。开放问题才进入 GraphRAG 或 Agnes 模型，回答下方会保留节点、关系和来源说明。"
    )
    add_body(
        doc,
        "这让回答有了两层可信度。第一层是数据来源：物品名称、数量、位置和期限来自当前工作区的结构化记录。"
        "第二层是推理来源：复杂问题装配实体、关系、社区摘要或多跳路径，模型只负责组织语言。"
    )
    add_figure(
        doc,
        ASSETS / "screens" / "03_ai_strip.png",
        "图 5  AI 工作台、资源图谱与服务器设置。界面把回答依据、同步状态和模型通道同时展示出来。",
        6.5,
        "三张真实小程序截图：AI 工作台、资源图谱、服务器与跨设备流转设置。",
    )
    add_heading(doc, "为什么需要图谱，而不是只做向量检索", 2)
    add_body(
        doc,
        "家庭资源问题经常不是“找一段相似文本”，而是连续关系：某件物品属于哪个库、放在哪个位置、"
        "还能放多久、会进入什么方案、缺了以后去哪张采购单。图谱把这些关系显式保存下来，"
        "数量与期限仍由代码计算，模型只负责把事实翻译成用户能读懂的建议。"
    )

    # Controlled AI landscape
    landscape_figure(
        doc,
        "写操作必须经过确认门",
        ASSETS / "diagrams" / "03_controlled_ai.png",
        "图 6  受控 AI 执行链。事实查询与生成推理在候选区汇合；预览、授权、写入与审计依次隔离。",
        "双通道 AI 推理与受控写操作流程图：本地事实通道、生成推理通道、候选草稿、用户授权、提交事实层与审计。",
    )

    add_kicker(doc, "可核验的信任")
    add_heading(doc, "一句“改成 5 个”，到底发生了什么", 1)
    add_body(
        doc,
        "真实录屏中，用户在 AI 工作台输入“鸡蛋还剩 5 个”。系统没有直接写库，而是弹出“确认执行”，"
        "明确显示鸡蛋将从 1 个改为 5 个。用户点击执行后，变更才进入库存并返回可撤销的结果。"
    )
    table = doc.add_table(rows=1, cols=2)
    set_repeat_table_header(table.rows[0])
    set_table_geometry(table, [2.0, 4.55], indent_dxa=0)
    clear_cell_borders(table.cell(0, 0))
    clear_cell_borders(table.cell(0, 1))
    c0 = table.cell(0, 0)
    p = c0.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p.add_run().add_picture(str(ASSETS / "screens" / "confirmation.png"), width=Inches(1.62))
    inline = p.runs[0]._r.xpath(".//wp:inline")[0]
    inline.xpath("./wp:docPr")[0].set("descr", "真实确认执行弹窗，鸡蛋从1个改为5个")
    c1 = table.cell(0, 1)
    p = c1.paragraphs[0]
    p.paragraph_format.space_after = Pt(4)
    add_run(p, "这次确认同时锁定了三件事", 12, True, GREEN_DARK)
    for index, text in enumerate(
        [
            "对象：哪一件库存，当前数量是多少。",
            "变化：目标数量与单位是什么。",
            "权限：点击“执行”之前，用户数据保持不变。",
        ],
        1,
    ):
        p2 = c1.add_paragraph()
        p2.paragraph_format.space_after = Pt(5)
        add_run(p2, f"{index}. {text}", 9.5, False, INK)
    p3 = c1.add_paragraph()
    p3.paragraph_format.space_before = Pt(4)
    add_run(
        p3,
        "结果写入后仍保留操作记录，并可通过撤销回退。模型没有数据库写权限，聊天中的工具行也不会绕过确认门。",
        9.2,
        False,
        MUTED,
    )
    cap = doc.add_paragraph(style="Caption")
    cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
    add_run(cap, "图 7  微信开发者工具中的真实确认弹窗。", 8.5, False, MUTED)

    add_body(
        doc,
        "这条链路比“点一下就自动改”慢一步，但家庭数据需要的正是这一步。它让用户知道系统准备改什么，"
        "也让出错之后的回滚有明确起点。"
    )
    add_heading(doc, "本地快答和模型回答共用一张对话，但不共用权限", 2)
    add_body(
        doc,
        "规则命中时，回答直接来自库存与图谱；未命中时，系统才组织证据交给模型。无论走哪条路，"
        "自然语言工具行都只能生成待确认动作。这个边界同时解决了三个问题：快问不必等待模型，"
        "数字不会由模型猜测，错误操作可以撤销。"
    )

    # Family sync landscape
    landscape_figure(
        doc,
        "一份库存，如何在两台设备上保持一致",
        ASSETS / "diagrams" / "04_family_sync.png",
        "图 8  多端同步与显式流转。版本化快照负责自动同步，flow-bridge 负责页面接力。",
        "多设备库存同步与显式页面流转流程图。",
    )

    add_kicker(doc, "工程深度")
    add_heading(doc, "可演示的背后，是一套能落地的工程约束", 1)
    add_body(
        doc,
        "小程序端使用 Taro 4.1.9、React 18、TypeScript、Sass 与 Zustand，核心页面覆盖 AI 工作台、拍照入库、"
        "资源库、图谱、方案、采购和“我的”。服务端使用 Node.js、Express 与 MySQL，工作区以版本化快照保存，"
        "AI 请求经过自建接口层，跨设备流转由独立的 3100 端口桥接服务完成。"
    )
    add_table(
        doc,
        ["工程问题", "实现方式", "为什么这样做"],
        [
            ["识别结果不稳定", "字段归一化、候选确认、失败显式提示", "不让模型输出直接变成用户资产"],
            ["多端状态冲突", "版本快照 + 409 + 按 id 原地合并", "避免整页刷新与重复覆盖"],
            ["AI 调用成本", "本地规则优先、单请求调用上限、用量记录", "快问不花模型成本，复杂问题可追踪"],
            ["写操作风险", "工具草稿、确认门、操作日志、撤销", "把权限留在用户手里"],
            ["数据边界", "结构化快照同步，图片与聊天正文不随流转发送", "减少不必要的数据搬运"],
        ],
        [1.45, 2.5, 2.7],
    )
    p = doc.add_paragraph(style="Caption")
    add_run(p, "表 2  关键工程取舍。各项均可在源码、回归记录或真实界面中核对。", 8.5, False, MUTED)
    add_heading(doc, "三个关键取舍", 2)
    add_body(
        doc,
        "识别不等于入库。视觉模型返回的是一组候选，字段归一化、目标库选择和最终确认仍由业务代码处理。"
        "如果返回为空或请求失败，页面会直接说明原因；示例数据只用于入口提示，不会被伪装成一次成功识别。"
    )
    add_body(
        doc,
        "同步不等于覆盖。每次工作区变化都带有版本号，其他设备先检查版本，再按 id 合并。发生冲突时重新拉取，"
        "避免把用户正在编辑的整页内容直接替换掉。跨设备“流转”则是另一条显式路径，用户知道页面被送到哪里。"
    )
    add_body(
        doc,
        "模型不等于事实源。数量、位置和期限先从库存与图谱读取；模型只负责组织语言或提出动作草稿。"
        "只要涉及写库存，草稿就必须经过确认门。这三条取舍决定了产品能不能从演示走向真实家庭使用。"
    )
    add_heading(doc, "系统属性与实现机制", 2)
    add_table(
        doc,
        ["系统属性", "实现机制", "评委可核对的证据"],
        [
            ["事实一致性", "结构化物品 + 服务端工作区快照", "首页、资源库与确认弹窗中的数量一致"],
            ["解释可追溯", "GraphRAG 节点、关系与路径证据", "AI 回答下方显示来源与调用模式"],
            ["行动可控性", "草稿 → 确认门 → 写入 → 撤销", "鸡蛋改量确认弹窗与操作日志"],
            ["并发一致性", "版本号、409 冲突回拉、按 id 合并", "模拟器与 PC 微信双向流转记录"],
            ["资源泛化", "与库类型无关的统一物品模型", "冰箱、衣柜、药箱与工具箱共用链路"],
        ],
        [1.35, 2.65, 2.65],
    )
    p = doc.add_paragraph(style="Caption")
    add_run(p, "表 3  系统属性矩阵。技术名词都对应可以查看的界面或回归结果。", 8.5, False, MUTED)

    doc.add_paragraph().add_run().add_break(WD_BREAK.PAGE)
    add_kicker(doc, "测试与证据")
    add_heading(doc, "不是“看起来能用”，而是每一步都能回查", 1)
    add_body(
        doc,
        "作品使用真实微信开发者工具模拟器与 PC 微信真机完成回归。视觉识别、本地事实直答、方案执行、"
        "采购补齐、资源图谱、双向流转和写操作确认都留下了运行结果。接口级自动化测试覆盖认证、家庭、"
        "同步、AI 与图谱等路径，当前记录为 40 项通过。"
    )
    add_table(
        doc,
        ["核验项", "结果", "证据"],
        [
            ["单张冰箱图片识别", "7 项，5.413 秒", "真实图片与识别结果截图"],
            ["本地高频事实直答", "0 次模型调用", "AI 工作台来源标签"],
            ["模拟器 ↔ PC 微信", "双向流转成功", "回归记录第 12 节"],
            ["写操作授权", "先弹窗、确认后生效", "作品视频第 09 段与截图"],
            ["图谱演示规模", "246 节点、525 边", "最新工作区实时摘要"],
            ["成片交付", "193.649 秒，12 段，63 条字幕", "完整视频与独立 SRT"],
        ],
        [2.1, 2.0, 2.5],
    )
    p = doc.add_paragraph(style="Caption")
    add_run(p, "表 4  可直接向评委展示的验收结果。", 8.5, False, MUTED)
    add_figure(
        doc,
        ASSETS / "screens" / "04_proof_strip.png",
        "图 9  微信开发者工具、PC 微信真机与复测记录。",
        6.5,
        "三张技术验证截图：微信开发者工具运行、PC 微信真机调试、识别与同步复测。",
    )
    add_callout(
        doc,
        "结果口径",
        "图谱规模、库存数量和识别项数来自具体演示工作区。它们会随用户数据变化，因此文档保留采集时间与上下文，不把这些数字写成固定产品指标。",
        fill=PALE_TEAL,
        accent="169B99",
    )

    add_kicker(doc, "边界与判断")
    add_heading(doc, "哪些事已经做到，哪些事没有假装做到", 1)
    add_body(
        doc,
        "竞赛作品最容易失分的地方，不是功能少，而是把未验证的能力写得像已经上线。启核图策把已实现与待配置分开记录："
        "本地识别、库存、方案、采购、图谱、协作和测试已经跑通；订阅消息模板、微信内容安全凭据、部分真机文件分享"
        "仍需账号侧配置。文档与演示都不依赖这些外部配置才能完成核心闭环。"
    )
    add_table(
        doc,
        ["事项", "当前状态", "对产品的影响"],
        [
            ["核心库存与行动链", "已实现并回归", "可完整演示拍照、方案、采购与确认"],
            ["多设备同步", "已实现并双向复测", "家庭共享与页面接力可用"],
            ["微信订阅消息", "接口与入口就绪，模板待配置", "不影响站内预警与待办"],
            ["真机文件分享", "模拟器受限，需真机复核", "CSV 导出不作为核心演示依赖"],
            ["视觉模型", "需要本机后端与模型通道", "失败时明确报错，不回退假数据"],
        ],
        [1.85, 2.35, 2.4],
    )
    p = doc.add_paragraph(style="Caption")
    add_run(p, "表 5  已实现能力、外部依赖与不影响核心闭环的范围。", 8.5, False, MUTED)
    add_heading(doc, "隐私不是一句口号，而是同步边界", 2)
    add_body(
        doc,
        "家庭数据采用自建后端与 MySQL 存储，本地开发环境可以运行在同一局域网；仓库中的真实密钥不进入公开提交物。"
        "跨设备同步只发送结构化工作区快照，图片二进制与聊天正文不随流转发送。写操作留有日志，"
        "确认与撤销让用户能看到改动从哪里来、怎样回去。"
    )
    add_heading(doc, "下一步，把一次演示变成可持续的日常工具", 2)
    add_body(
        doc,
        "短期先完成账号侧配置与更多真机场景，补齐订阅提醒、文件分享和弱网恢复；中期把家庭成员、采购与临期数据"
        "做成更清晰的周报，继续降低重复购买；长期接入更多 HarmonyOS 与微信设备触点，让提醒和采集发生在用户"
        "最方便的地方。路线图只列已经具备工程基础的延伸，不把尚未验证的硬件能力写成现成功能。"
    )
    for phase, text in [
        ("现在", "本地后端、小程序、写操作确认、图谱与双向流转已经形成可演示闭环。"),
        ("近期", "补齐账号侧模板与真机分享，扩大弱网、多人冲突和图片边界测试。"),
        ("之后", "扩展家庭周报、预算与浪费分析，接入更多设备入口。"),
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(1)
        add_run(p, phase, 11, True, GREEN_DARK)
        p2 = doc.add_paragraph()
        p2.paragraph_format.left_indent = Cm(0.62)
        p2.paragraph_format.space_after = Pt(5)
        add_run(p2, text, 10.2, False, INK)

    add_callout(
        doc,
        "我们最想被记住的一句话",
        "启核图策不是替家庭多记一本账，而是把已经存在的资源变成下一步行动。",
        fill=PALE_GREEN,
        accent=GREEN,
    )

    # Final appendix
    add_kicker(doc, "评审索引")
    add_heading(doc, "三分钟看清这项作品", 1)
    add_table(
        doc,
        ["评委关心的问题", "作品给出的答案", "材料位置"],
        [
            ["有没有真实闭环", "拍照入库、预警、方案、采购、协作连续可走", "正文第 2–5 节与真实录屏"],
            ["AI 是否只是聊天框", "视觉识别、本地快答、GraphRAG、受控工具写入", "图 4–6"],
            ["技术是否站得住", "Taro/React/TS、Express/MySQL、版本同步与确认门", "图 4、图 8、表 2"],
            ["是否能被验证", "真实截图、回归记录、193.649 秒演示视频", "表 4、图 9"],
            ["是否诚实", "明确外部配置与未验证边界", "表 5"],
        ],
        [1.75, 3.15, 1.7],
    )
    p = doc.add_paragraph(style="Caption")
    add_run(p, "表 6  评审阅读索引。", 8.5, False, MUTED)
    add_heading(doc, "项目信息", 2)
    add_table(
        doc,
        ["项目项", "内容"],
        [
            ["作品名称", "启核图策 NexcoreGraph"],
            ["参赛项目", "第九届传智杯 AI 微信小程序开发挑战赛"],
            ["团队名称", "天枢序列小程序"],
            ["团队编号", "38378"],
            ["项目负责人", "高俊杰"],
            ["团队成员", "罗渝川"],
            ["技术栈", "Taro 4.1.9 · React 18 · TypeScript · Sass · Zustand · Node.js · Express · MySQL"],
            ["交付形态", "微信小程序 Demo、源码、后端、作品介绍、答辩 PPT、193.649 秒演示视频"],
            ["文档版本", "2026-10-25 · 作品介绍增强版"],
        ],
        [1.55, 5.0],
    )
    add_body(
        doc,
        "更多可复核材料见同目录回归记录、评分点证据表、演示视频与完整小程序源码。本文档只使用已经实现或明确标注为待配置的能力。",
        after=0,
    )

    doc.core_properties.title = "启核图策 NexcoreGraph 作品介绍文档"
    doc.core_properties.subject = "第九届传智杯 AI 微信小程序开发挑战赛"
    doc.core_properties.author = "天枢序列小程序"
    doc.core_properties.keywords = "NexcoreGraph, 家庭资源, GraphRAG, 微信小程序, Taro"
    doc.core_properties.comments = "作品介绍文档增强版"
    doc.save(OUT)
    print(OUT)


if __name__ == "__main__":
    build()
