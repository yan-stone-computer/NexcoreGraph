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
from docx.oxml import OxmlElement
from docx.oxml.ns import qn

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

# 表格：正文可用宽度 16.5cm，列宽必须显式给定并固定布局。
# 之前用 python-docx 默认的自动布局 + 'Light Grid Accent 1'，遇到 2.1 这种中间列很长的表，
# Word 会把列排到页面外（读者看到的就是"空列 + 被截断的尾巴"）。
TABLE_MAX_W_CM = 16.5
TABLE_FS_PT = 9            # 表格正文
TABLE_CAPTION_PT = 9.5     # 表题
# 文档实际可用文字宽度：python-docx 默认模板左右页边距不对称（左 3.17cm / 右 2.5cm），
# 正文只有约 15.9cm。表格与全宽图都按它排版，否则右边会顶出正文边界、最后一列被压扁。
USABLE_CM = 15.9


def _el(tag, **attrs):
    e = OxmlElement(tag)
    for k, v in attrs.items():
        e.set(qn('w:' + k), str(v))
    return e


def _tbl_layout_fixed(t):
    """固定表格布局，防止 Word 自行伸缩把列挤出页面。"""
    tblPr = t._tbl.tblPr
    for tag in ('w:tblLayout',):
        old = tblPr.find(qn(tag))
        if old is not None:
            tblPr.remove(old)
    tblPr.append(_el('w:tblLayout', type='fixed'))
    # 单元格内边距：默认贴边很难看
    mar = OxmlElement('w:tblCellMar')
    for side, w in (('top', 40), ('left', 80), ('bottom', 40), ('right', 80)):
        mar.append(_el('w:' + side, w=w, type='dxa'))
    tblPr.append(mar)


def _three_line_borders(t):
    """三线表：去网格，只留顶线、表头下线、底线（学术文档惯例，也是"去 AI 味"的一步）。"""
    tblPr = t._tbl.tblPr
    borders = OxmlElement('w:tblBorders')
    for edge in ('top', 'left', 'bottom', 'right', 'insideH', 'insideV'):
        if edge in ('top', 'bottom'):
            borders.append(_el('w:' + edge, val='single', sz=12, space=0, color='000000'))
        else:
            borders.append(_el('w:' + edge, val='none', sz=0, space=0, color='auto'))
    tblPr.append(borders)


def _row_bottom_rule(row, sz=6):
    for cell in row.cells:
        tcPr = cell._tc.get_or_add_tcPr()
        b = OxmlElement('w:tcBorders')
        b.append(_el('w:bottom', val='single', sz=sz, space=0, color='000000'))
        tcPr.append(b)


def _row_repeat_header(row):
    trPr = row._tr.get_or_add_trPr()
    trPr.append(_el('w:tblHeader', val='true'))


def _set_widths(t, rows, ncol):
    """按各列最长内容分配列宽（上限 16.5cm），并写进 tblGrid 与每个单元格。"""
    weights = []
    for ci in range(ncol):
        longest = 0
        for cells in rows:
            txt = cells[ci] if ci < len(cells) else ''
            # 全角按 2 计、半角按 1 计，粗略反映视觉宽度
            w = sum(2 if ord(ch) > 0x2000 else 1 for ch in txt)
            longest = max(longest, w)
        weights.append(max(8, min(longest, 60)))
    total = float(sum(weights))
    total_cm = min(TABLE_MAX_W_CM, USABLE_CM)
    cm = [total_cm * w / total for w in weights]

    # 窄列兜底：像"图"这种内容很短的列，按比例分只会得到 1.5cm 左右，文字会竖着排。
    # 把低于下限的列抬到下限，再从其余列按权重扣回来。
    MIN_CM = 2.4
    for _ in range(8):
        short = [i for i, w in enumerate(cm) if w < MIN_CM]
        if not short:
            break
        rest = [i for i in range(ncol) if i not in short]
        rest_w = sum(weights[i] for i in rest)
        avail = total_cm - MIN_CM * len(short)
        if rest_w <= 0 or avail <= 0:
            break
        for i in rest:
            cm[i] = avail * weights[i] / rest_w
        for i in short:
            cm[i] = MIN_CM
    widths = [Cm(x) for x in cm]

    tblPr = t._tbl.tblPr
    old = tblPr.find(qn('w:tblInd'))
    if old is not None:
        tblPr.remove(old)
    tblPr.append(_el('w:tblInd', w=0, type='dxa'))

    grid = t._tbl.find(qn('w:tblGrid'))
    cols = grid.findall(qn('w:gridCol')) if grid is not None else []
    for gc, w in zip(cols, widths):
        gc.set(qn('w:w'), str(int(w.twips)))
    for row in t.rows:
        for cell, w in zip(row.cells, widths):
            cell.width = w


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
        # 全宽技术图也按正文可用宽度排，避免右边顶出页边
        max_w, max_h = min(WIDE_FIG_MAX_W_CM, USABLE_CM), IMG_MAX_H_CM
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

    CN_NUM = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8}
    chapter = 0        # 当前章号（用于"表 N-M"编号）
    tbl_no = 0         # 本章第几张表
    pending_cap = ''   # 表题（markdown 里写成 "表：xxx" 放在表格上一行）

    i = 0
    in_code = False
    while i < len(lines):
        line = lines[i].rstrip()

        # 表题（表例）：单独一行 "表：说明"，由脚本补上"表 N-M"编号
        if line.startswith('表：'):
            pending_cap = line[2:].strip()
            i += 1
            continue

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

            tbl_no += 1
            cap = '表 %s-%d' % (chapter, tbl_no)
            if pending_cap != '':
                cap += '　' + pending_cap
            pending_cap = ''
            cp = doc.add_paragraph()
            cr = cp.add_run(cap)
            cr.bold = True
            cr.font.size = Pt(TABLE_CAPTION_PT)
            cp.paragraph_format.space_before = Pt(8)
            cp.paragraph_format.space_after = Pt(2)
            cp.paragraph_format.keep_with_next = True

            t = doc.add_table(rows=0, cols=ncol)
            t.autofit = False
            for ri, cells in enumerate(rows):
                cr = t.add_row().cells
                for ci in range(ncol):
                    txt = cells[ci] if ci < len(cells) else ''
                    cr[ci].text = ''
                    add_runs(cr[ci].paragraphs[0], txt)
                    for run in cr[ci].paragraphs[0].runs:
                        run.font.size = Pt(TABLE_FS_PT)
                        if ri == 0:
                            run.bold = True
                    cr[ci].paragraphs[0].paragraph_format.space_before = Pt(1)
                    cr[ci].paragraphs[0].paragraph_format.space_after = Pt(1)
            _tbl_layout_fixed(t)
            _three_line_borders(t)
            _set_widths(t, rows, ncol)
            if len(t.rows) > 0:
                _row_bottom_rule(t.rows[0])
                _row_repeat_header(t.rows[0])
            sp = doc.add_paragraph()
            sp.paragraph_format.space_after = Pt(6)
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
            title = line[3:].strip()
            doc.add_heading(title, level=1)
            # 章号用于"表 N-M / 图 N-M"编号；换章时表格计数归零
            mch = re.match(r'^([一二三四五六七八])、', title)
            if mch:
                chapter = CN_NUM[mch.group(1)]
                tbl_no = 0
            else:
                mch = re.match(r'^附录 ([A-Z])', title)
                if mch:
                    chapter = mch.group(1)
                    tbl_no = 0
                else:
                    mch = re.match(r'^(\d+)[.、]', title)
                    if mch:
                        chapter = int(mch.group(1))
                        tbl_no = 0
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
