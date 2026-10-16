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
# 图片尺寸策略：按真实长宽比缩放，并同时受最大宽/最大高约束。
# 之前给所有图统一 14.5cm 宽，手机截图（1320×2848）算出来高 31cm，直接超出 A4 可用高度，
# 所以看起来"图太大"。Logo 这类小图标再单独限一份更小的尺寸。
IMG_MAX_W_CM = 12.0
IMG_MAX_H_CM = 15.5
LOGO_MAX_CM = 4.5
CERT_MAX_W_CM = 7.0
CERT_MAX_H_CM = 9.5
# 全宽技术图（架构图这类）：文档里字要看得清，实际磅值 ≈ 字号px × 图宽cm ÷ 画布宽px × 28.35，
# 12cm 宽时 26px 字只有 7pt 多。架构图按页面可用宽度 16.5cm 排，正文才到 10pt 左右。
WIDE_FIG_MAX_W_CM = 16.5
WIDE_FIGS = ('arch-diagram',)


def image_px(path):
    """不依赖 Pillow，直接读 PNG / JPEG 头部拿像素尺寸（读不到就返回 None）。"""
    try:
        with open(path, 'rb') as f:
            head = f.read(32)
            if head[:8] == b'\x89PNG\r\n\x1a\n':
                w = int.from_bytes(head[16:20], 'big')
                h = int.from_bytes(head[20:24], 'big')
                return w, h
            if head[:2] == b'\xff\xd8':
                f.seek(2)
                while True:
                    b = f.read(1)
                    while b and b != b'\xff':
                        b = f.read(1)
                    marker = f.read(1)
                    while marker == b'\xff':
                        marker = f.read(1)
                    if not marker:
                        return None
                    code = marker[0]
                    if code in (0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
                                0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf):
                        f.read(3)
                        h = int.from_bytes(f.read(2), 'big')
                        w = int.from_bytes(f.read(2), 'big')
                        return w, h
                    seg = f.read(2)
                    if len(seg) < 2:
                        return None
                    f.seek(int.from_bytes(seg, 'big') - 2, os.SEEK_CUR)
    except Exception:
        return None
    return None


def layout_size(path):
    """返回 (宽cm, 高cm)：等比缩放到不超上限；Logo/图标类用更小的上限。"""
    name = os.path.basename(path).lower()
    is_icon = any(k in name for k in ('logo', 'icon', 'avatar'))
    is_cert = 'cert' in name
    if is_icon:
        max_w, max_h = LOGO_MAX_CM, LOGO_MAX_CM
    elif is_cert:
        max_w, max_h = CERT_MAX_W_CM, CERT_MAX_H_CM
    elif any(k in name for k in WIDE_FIGS):
        max_w, max_h = WIDE_FIG_MAX_W_CM, IMG_MAX_H_CM
    else:
        max_w, max_h = IMG_MAX_W_CM, IMG_MAX_H_CM
    px = image_px(path)
    if not px or not px[0] or not px[1]:
        return (max_w, None)
    w, h = px
    scale = min(max_w / w, max_h / h)       # 两个约束取更严的那个
    return (w * scale, h * scale)


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
                w_cm, h_cm = layout_size(full)
                doc.add_picture(full, width=Cm(w_cm))
                doc.paragraphs[-1].alignment = WD_ALIGN_PARAGRAPH.CENTER
                print('  图 %s -> %.1f x %s cm' % (
                    os.path.basename(full), w_cm, ('%.1f' % h_cm) if h_cm else '?'))
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
            # 抬头信息（团队名称/解决方案/版本号…）居中加粗，让首页更像正式文档
            if p.text.startswith(('团队名称', '解决方案', '版本号', '编制日期', '技术栈')):
                for run in p.runs:
                    run.bold = True
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        i += 1

    # 页脚页码（python-docx 无现成 API，手写字段域）
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    footer = doc.sections[0].footer
    fp = footer.paragraphs[0]
    fp.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = fp.add_run()
    fld = OxmlElement('w:fldSimple')
    fld.set(qn('w:instr'), 'PAGE')
    run._r.addnext(fld)

    doc.save(OUT)
    print('已生成 ' + OUT + '  (%d 段, %d 表, %d 图)' % (
        len(doc.paragraphs), len(doc.tables),
        len(doc.inline_shapes)))


if __name__ == '__main__':
    main()
