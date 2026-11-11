"""Build the polished oral-script DOCX from the submission Markdown.

Design preset: compact_reference_guide
Page: Letter, 1-inch margins
Body: Calibri 11pt, 6pt after, 1.25 line spacing
Tables: fixed 9360 DXA geometry with 120 DXA indent
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


USB = 9360
INDENT = 120
HEADER_FILL = "E8EEF5"
BORDER = "C9D3E1"
HEADING_BLUE = "2E74B5"
HEADING_DARK = "1F4D78"
TEXT = RGBColor(31, 41, 55)
MUTED = RGBColor(86, 99, 115)


def set_run_font(run, name="Calibri", size=11, bold=None, color=None):
    run.font.name = name
    run.font.size = Pt(size)
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    if bold is not None:
        run.bold = bold
    if color is not None:
        run.font.color.rgb = color


def set_cell_margins(cell, top=80, bottom=80, start=120, end=120):
    tc = cell._tc
    tcPr = tc.get_or_add_tcPr()
    mar = tcPr.find(qn("w:tcMar"))
    if mar is None:
        mar = OxmlElement("w:tcMar")
        tcPr.append(mar)
    for side, width in (("top", top), ("bottom", bottom), ("start", start), ("end", end)):
        node = OxmlElement(f"w:{side}")
        node.set(qn("w:w"), str(width))
        node.set(qn("w:type"), "dxa")
        mar.append(node)


def shade_cell(cell, fill):
    tcPr = cell._tc.get_or_add_tcPr()
    shd = OxmlElement("w:shd")
    shd.set(qn("w:fill"), fill)
    tcPr.append(shd)


def set_table_borders(table):
    tblPr = table._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        node = OxmlElement(f"w:{edge}")
        node.set(qn("w:val"), "single")
        node.set(qn("w:sz"), "4")
        node.set(qn("w:space"), "0")
        node.set(qn("w:color"), BORDER)
        borders.append(node)
    tblPr.append(borders)


def set_table_geometry(table, column_widths):
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False
    tblPr = table._tbl.tblPr
    tblW = OxmlElement("w:tblW")
    tblW.set(qn("w:w"), str(sum(column_widths)))
    tblW.set(qn("w:type"), "dxa")
    tblPr.append(tblW)
    tblInd = OxmlElement("w:tblInd")
    tblInd.set(qn("w:w"), str(INDENT))
    tblInd.set(qn("w:type"), "dxa")
    tblPr.append(tblInd)
    layout = OxmlElement("w:tblLayout")
    layout.set(qn("w:type"), "fixed")
    tblPr.append(layout)
    grid = table._tbl.tblGrid
    for col, width in zip(grid.gridCol_lst, column_widths):
        col.set(qn("w:w"), str(width))
    for row in table.rows:
        for cell, width in zip(row.cells, column_widths):
            cell.width = width


def add_page_number(paragraph):
    run = paragraph.add_run()
    fldChar = OxmlElement("w:fldChar")
    fldChar.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = "PAGE"
    end = OxmlElement("w:fldChar")
    end.set(qn("w:fldCharType"), "end")
    run._r.append(fldChar)
    run._r.append(instr)
    run._r.append(end)
    set_run_font(run, size=9, color=MUTED)


def add_inline_runs(paragraph, text, size=11):
    parts = re.split(r"(\*\*[^*]+\*\*|`[^`]+`)", text)
    for part in parts:
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            run = paragraph.add_run(part[2:-2])
            set_run_font(run, size=size, bold=True, color=TEXT)
        elif part.startswith("`") and part.endswith("`"):
            run = paragraph.add_run(part[1:-1])
            set_run_font(run, name="Consolas", size=max(9, size - 1), color=RGBColor(31, 77, 120))
        else:
            # Keep hyperlink labels readable without injecting raw Markdown.
            part = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", part)
            run = paragraph.add_run(part)
            set_run_font(run, size=size, color=TEXT)


def set_heading(paragraph, size, color, before, after):
    paragraph.paragraph_format.space_before = Pt(before)
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.keep_with_next = True
    for run in paragraph.runs:
        set_run_font(run, size=size, bold=(size <= 16), color=RGBColor.from_string(color))


def setup_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = "Calibri"
    normal.font.size = Pt(11)
    normal.font.color.rgb = TEXT
    normal._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    for style_name, size, color, before, after in (
        ("Heading 1", 16, HEADING_BLUE, 18, 10),
        ("Heading 2", 13, HEADING_BLUE, 14, 7),
        ("Heading 3", 12, HEADING_DARK, 10, 5),
    ):
        style = styles[style_name]
        style.font.name = "Calibri"
        style.font.size = Pt(size)
        style.font.bold = style_name != "Heading 1"
        style.font.color.rgb = RGBColor.from_string(color)
        style._element.rPr.rFonts.set(qn("w:eastAsia"), "Microsoft YaHei")
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True
        style.paragraph_format.line_spacing = 1.25


def add_title_block(doc, title, metadata):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(8)
    run = p.add_run(title)
    set_run_font(run, size=24, bold=True, color=RGBColor.from_string(HEADING_DARK))

    for line in metadata:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        add_inline_runs(p, line, size=9)
        for run in p.runs:
            run.font.color.rgb = MUTED

    callout = doc.add_table(rows=1, cols=1)
    set_table_geometry(callout, [USB])
    cell = callout.cell(0, 0)
    shade_cell(cell, "F4F6F9")
    set_cell_margins(cell, 140, 140, 160, 160)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    run = p.add_run("主叙事：别人记录家庭资源，我们推演家庭资源，并让 AI 的动作可约束、可验证、可追溯。")
    set_run_font(run, size=11, bold=True, color=RGBColor.from_string(HEADING_DARK))
    callout.style = "Table Grid"
    for row in callout.rows:
        for c in row.cells:
            set_cell_margins(c)

    doc.add_paragraph().add_run().add_break()
    doc.add_page_break()


def parse_title_and_meta(lines):
    title = "启核图策 · 评委冲击版口播稿与镜头插入方案"
    meta = []
    for line in lines[:12]:
        if line.startswith("# "):
            title = line[2:].strip()
        elif line.startswith("> "):
            meta.append(line[2:].strip())
    return title, meta


def parse_table(lines, start):
    rows = []
    i = start
    while i < len(lines) and lines[i].lstrip().startswith("|"):
        raw = lines[i].strip().strip("|")
        cells = [c.strip() for c in raw.split("|")]
        if not all(re.fullmatch(r":?-{2,}:?", c) for c in cells):
            rows.append(cells)
        i += 1
    return rows, i


def width_weights(rows, cols):
    weights = []
    for ci in range(cols):
        longest = 10
        for row in rows:
            text = row[ci] if ci < len(row) else ""
            longest = max(longest, min(60, sum(2 if ord(ch) > 0x2000 else 1 for ch in text)))
        weights.append(longest)
    total = sum(weights)
    widths = [max(950, int(USB * w / total)) for w in weights]
    delta = USB - sum(widths)
    widths[-1] += delta
    return widths


def add_table(doc, rows):
    cols = max(len(r) for r in rows)
    normalized = [r + [""] * (cols - len(r)) for r in rows]
    table = doc.add_table(rows=len(normalized), cols=cols)
    table.style = "Table Grid"
    set_table_borders(table)
    set_table_geometry(table, width_weights(normalized, cols))
    for ri, row in enumerate(normalized):
        for ci, value in enumerate(row):
            cell = table.cell(ri, ci)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            set_cell_margins(cell)
            if ri == 0:
                shade_cell(cell, HEADER_FILL)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.1
            add_inline_runs(p, value, size=9)
            if ri == 0:
                for run in p.runs:
                    run.bold = True
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def add_quote(doc, lines):
    table = doc.add_table(rows=1, cols=1)
    set_table_geometry(table, [USB])
    cell = table.cell(0, 0)
    shade_cell(cell, "F4F6F9")
    set_cell_margins(cell, 120, 120, 160, 160)
    for idx, line in enumerate(lines):
        p = cell.paragraphs[0] if idx == 0 else cell.add_paragraph()
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.25
        add_inline_runs(p, line, size=11)
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def build(md_path: Path, out_path: Path):
    lines = md_path.read_text(encoding="utf-8").splitlines()
    title, metadata = parse_title_and_meta(lines)
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.right_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)
    setup_styles(doc)

    header = section.header.paragraphs[0]
    header.text = "启核图策 NexcoreGraph · 评委会口播制作包"
    header.alignment = WD_ALIGN_PARAGRAPH.LEFT
    for run in header.runs:
        set_run_font(run, size=8, color=MUTED)
    footer = section.footer.paragraphs[0]
    footer.text = "内部制作稿"
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    for run in footer.runs:
        set_run_font(run, size=8, color=MUTED)
    footer.add_run(" · ")
    add_page_number(footer)

    add_title_block(doc, title, metadata)

    i = 0
    while i < len(lines):
        line = lines[i].rstrip()
        if i < 12 and line.startswith("> "):
            i += 1
            continue
        if line.startswith("# "):
            i += 1
            continue
        if line.startswith("## "):
            p = doc.add_paragraph(style="Heading 1")
            p.add_run(line[3:].strip())
            set_heading(p, 16, HEADING_BLUE, 18, 10)
            i += 1
            continue
        if line.startswith("### "):
            p = doc.add_paragraph(style="Heading 2")
            p.add_run(line[4:].strip())
            set_heading(p, 13, HEADING_BLUE, 14, 7)
            i += 1
            continue
        if line.startswith("#### "):
            p = doc.add_paragraph(style="Heading 3")
            p.add_run(line[5:].strip())
            set_heading(p, 12, HEADING_DARK, 10, 5)
            i += 1
            continue
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|[\s:\-|]+\|$", lines[i + 1].strip()):
            rows, i = parse_table(lines, i)
            add_table(doc, rows)
            continue
        if line.startswith("> "):
            quote_lines = []
            while i < len(lines) and lines[i].startswith("> "):
                quote_lines.append(lines[i][2:].strip())
                i += 1
            add_quote(doc, quote_lines)
            continue
        if line.startswith("- "):
            p = doc.add_paragraph(style="List Bullet")
            add_inline_runs(p, line[2:].strip(), size=11)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.25
            i += 1
            continue
        if re.match(r"^\d+\.\s+", line):
            p = doc.add_paragraph(style="List Number")
            add_inline_runs(p, re.sub(r"^\d+\.\s+", "", line), size=11)
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.25
            i += 1
            continue
        if line.strip():
            p = doc.add_paragraph()
            add_inline_runs(p, line.strip(), size=11)
        i += 1

    doc.save(out_path)
    print(out_path)


if __name__ == "__main__":
    source = Path(sys.argv[1] if len(sys.argv) > 1 else "docs/submission/启核图策-评委冲击版口播稿.md")
    target = Path(sys.argv[2] if len(sys.argv) > 2 else source.with_suffix(".docx"))
    build(source, target)
