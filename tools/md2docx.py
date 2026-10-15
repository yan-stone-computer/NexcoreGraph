"""把 docs/作品介绍文档.md 转成 Word（python-docx）。

只覆盖本项目文档用到的语法：#/##/###/#### 标题、表格、图片、引用、代码块、**加粗**。
标题层级按提交模板映射：`#`→Title，`##`→Heading 1，`###`→Heading 2，`####`→Heading 3。
"""
import os
import re
import sys

from docx import Document
from docx.shared import Cm, Pt
from docx.enum.text import WD_ALIGN_PARAGRAPH

SRC = sys.argv[1] if len(sys.argv) > 1 else 'docs/作品介绍文档.md'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'docs/作品介绍文档.docx'
BASE = os.path.dirname(os.path.abspath(SRC))
IMG_WIDTH_CM = 14.5


def add_runs(par, text):
    """处理 **加粗** 与 `行内代码`"""
    for seg in re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text):
        if not seg:
            continue
        if seg.startswith('**') and seg.endswith('**'):
            par.add_run(seg[2:-2]).bold = True
        elif seg.startswith('`') and seg.endswith('`'):
            r = par.add_run(seg[1:-1])
            r.font.name = 'Consolas'
        else:
            par.add_run(seg)


def main():
    with open(SRC, encoding='utf-8') as f:
        lines = f.read().split('\n')

    doc = Document()
    style = doc.styles['Normal']
    style.font.name = '微软雅黑'
    style.font.size = Pt(10.5)
    # 中文字体需要单独设置 eastAsia，否则 Word 里会回落到宋体
    from docx.oxml.ns import qn
    style.element.rPr.rFonts.set(qn('w:eastAsia'), '微软雅黑')

    i = 0
    in_code = False
    while i < len(lines):
        line = lines[i].rstrip()

        # 代码块
        if line.startswith('```'):
            in_code = not in_code
            i += 1
            continue
        if in_code:
            p = doc.add_paragraph()
            r = p.add_run(line)
            r.font.name = 'Consolas'
            r.font.size = Pt(9)
            i += 1          # 少了这一行会在这里死循环（第一版就踩了）
            continue

        # 表格
        if line.startswith('|') and i + 1 < len(lines) and re.match(r'^\|[\s:\-|]+\|$', lines[i + 1].strip()):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not re.match(r'^[\s:\-]+$', ''.join(cells)):
                    rows.append(cells)
                i += 1
            ncol = max(len(r) for r in rows)
            t = doc.add_table(rows=0, cols=ncol)
            t.style = 'Light Grid Accent 1'
            for ri, cells in enumerate(rows):
                cr = t.add_row().cells
                for ci in range(ncol):
                    txt = cells[ci] if ci < len(cells) else ''
                    cr[ci].text = ''
                    add_runs(cr[ci].paragraphs[0], txt)
                    if ri == 0:
                        for run in cr[ci].paragraphs[0].runs:
                            run.bold = True
            doc.add_paragraph()
            continue

        # 图片
        m = re.match(r'^!\[(.*?)\]\((.*?)\)$', line)
        if m:
            alt, path = m.group(1), m.group(2)
            full = os.path.normpath(os.path.join(BASE, path))
            if os.path.exists(full):
                doc.add_picture(full, width=Cm(IMG_WIDTH_CM))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
            else:
                doc.add_paragraph('[缺图] ' + alt + ' -> ' + path)
            i += 1
            continue

        # 标题
        if line.startswith('#### '):
            doc.add_heading(line[5:].strip(), level=3)
        elif line.startswith('### '):
            doc.add_heading(line[4:].strip(), level=2)
        elif line.startswith('## '):
            doc.add_heading(line[3:].strip(), level=1)
        elif line.startswith('# '):
            h = doc.add_heading(line[2:].strip(), level=0)
            h.alignment = WD_ALIGN_PARAGRAPH.CENTER
        elif line.startswith('> '):
            p = doc.add_paragraph()
            r = p.add_run(line[2:].strip())
            r.italic = True
            r.font.size = Pt(9)
        elif line.strip() == '---':
            pass
        elif line.strip() == '':
            pass
        elif re.match(r'^[-*] ', line):
            p = doc.add_paragraph(style='List Bullet')
            add_runs(p, line[2:].strip())
        elif re.match(r'^\d+\. ', line):
            p = doc.add_paragraph(style='List Number')
            add_runs(p, re.sub(r'^\d+\. ', '', line))
        else:
            p = doc.add_paragraph()
            add_runs(p, line.strip())
        i += 1

    doc.save(OUT)
    print('已生成 ' + OUT + '  (%d 段, %d 表, %d 图)' % (
        len(doc.paragraphs), len(doc.tables),
        len(doc.inline_shapes)))


if __name__ == '__main__':
    main()
