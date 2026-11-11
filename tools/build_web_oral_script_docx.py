"""Build the Web-track oral script without inheriting mini-program cover labels."""
from __future__ import annotations

import sys
from pathlib import Path

from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt, RGBColor


TOOLS = Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
import build_oral_script_docx as core  # noqa: E402


def add_web_metric_strip(doc):
    metrics = (
        ("08:00", "完整主口播"),
        ("11 个", "模型平台模板"),
        ("60 秒", "答辩浓缩版"),
    )
    table = doc.add_table(rows=1, cols=3)
    table.style = "Table Grid"
    core.set_table_borders(table)
    core.set_table_geometry(table, [3120, 3120, 3120])
    core.set_row_flags(table.rows[0], header=True)
    for cell, (value, label) in zip(table.rows[0].cells, metrics):
        core.shade_cell(cell, "F4F6F9")
        core.set_cell_margins(cell, 105, 105, 120, 120)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_after = Pt(1)
        core.set_run_font(
            p.add_run(value),
            size=13,
            bold=True,
            color=RGBColor.from_string(core.HEADING_DARK),
        )
        p2 = cell.add_paragraph()
        p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p2.paragraph_format.space_after = Pt(0)
        core.set_run_font(p2.add_run(label), size=8.5, color=core.MUTED)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_web_title_block(doc, title, metadata):
    product = "启核图策 Web 端"
    subtitle = "多平台模型 · 全屋资源 · 评委冲击版口播"
    if "·" in title:
        product, subtitle = [part.strip() for part in title.split("·", 1)]

    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    core.set_run_font(
        p.add_run("2026 传智杯 · AI WEB 网页开发挑战赛 · 路演制作包"),
        size=9,
        bold=True,
        color=RGBColor(86, 99, 115),
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(4)
    p.paragraph_format.space_after = Pt(3)
    core.set_run_font(
        p.add_run(product),
        size=30,
        bold=True,
        color=RGBColor.from_string(core.HEADING_DARK),
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(12)
    core.set_run_font(
        p.add_run(subtitle),
        size=14,
        color=RGBColor.from_string(core.HEADING_BLUE),
    )
    for line in metadata:
        p = doc.add_paragraph()
        p.paragraph_format.space_after = Pt(2)
        core.add_inline_runs(p, line, size=9)
        for run in p.runs:
            run.font.color.rgb = core.MUTED

    add_web_metric_strip(doc)
    callout = doc.add_table(rows=1, cols=1)
    callout.style = "Table Grid"
    core.set_table_geometry(callout, [core.USB])
    core.set_row_flags(callout.rows[0], header=True)
    cell = callout.cell(0, 0)
    core.shade_cell(cell, "F4F6F9")
    core.set_cell_margins(cell, 140, 140, 120, 120)
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    core.set_run_font(
        p.add_run("主叙事：模型可以替换，全家事实、约束和用户权限不能替换。"),
        size=11,
        bold=True,
        color=RGBColor.from_string(core.HEADING_DARK),
    )
    doc.add_page_break()


def build(source: Path, target: Path) -> None:
    core.add_metric_strip = add_web_metric_strip
    core.add_title_block = add_web_title_block
    core.build(source, target)


if __name__ == "__main__":
    source = Path(
        sys.argv[1]
        if len(sys.argv) > 1
        else "docs/submission/启核图策-Web端-评委冲击版全功能口播稿.md"
    )
    target = Path(
        sys.argv[2]
        if len(sys.argv) > 2
        else source.with_suffix(".docx")
    )
    build(source, target)
