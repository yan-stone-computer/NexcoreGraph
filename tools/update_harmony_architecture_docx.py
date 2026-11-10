#!/usr/bin/env python3
"""Replace the 4.1 architecture image and caption without rebuilding the DOCX."""

from pathlib import Path
import shutil

from docx import Document
from docx.shared import Cm


ROOT = Path(__file__).resolve().parents[1]
DOCX = Path('C:/Users/34274/Desktop/启核图策-鸿蒙端作品介绍.docx')
BACKUP = ROOT / 'docs' / 'backups' / '启核图策-鸿蒙端作品介绍-20261029-before-4.1.docx'
FIGURE = ROOT / 'docs' / 'images' / 'harmony-core-architecture@2x.png'


def main() -> None:
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    if not BACKUP.exists():
        shutil.copy2(DOCX, BACKUP)

    doc = Document(DOCX)
    heading_index = next(
        i for i, paragraph in enumerate(doc.paragraphs)
        if paragraph.text.strip().startswith('4.1 核心架构图')
    )
    image_paragraph = doc.paragraphs[heading_index + 1]
    blips = image_paragraph._p.xpath('.//a:blip')
    if len(blips) != 1:
        raise RuntimeError('Expected exactly one image below 4.1')

    relationship_id = blips[0].get(
        '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed'
    )
    image_part = doc.part.related_parts[relationship_id]
    image_part._blob = FIGURE.read_bytes()

    shape = doc.inline_shapes[0]
    shape.width = Cm(15.9)
    shape.height = Cm(13.17)
    shape._inline.docPr.set('title', '启核图策核心架构')
    shape._inline.docPr.set(
        'descr',
        'HarmonyOS 端、 自建后端、外部能力，以及入库、问答与多端协同三条执行路径的代码级架构图。'
    )

    caption = [
        '图 4-1',
        ' 核心架构：HarmonyOS 端由 ArkUI 交互外壳、本地编排与检索、多模态入库、GraphRAG、'
        'AI 网关客户端、本地快照，以及多端协同与系统入口组成；',
    ]
    caption2 = '自建后端负责 AI 受控网关、权威快照同步、身份与家庭协作、独立图谱 API，并以 MySQL 存储图谱五表；'
    caption3 = '下方三条执行路径分别对应拍照入库、可信问答与多端协同。'
    caption_paragraph = doc.paragraphs[heading_index + 2]
    caption_paragraph.runs[0].text = caption[0]
    caption_paragraph.runs[1].text = caption[1]
    for run in caption_paragraph.runs[2:]:
        run.text = ''

    for offset, value in ((3, caption2), (4, caption3)):
        paragraph = doc.paragraphs[heading_index + offset]
        if paragraph.runs:
            paragraph.runs[0].text = value
            for run in paragraph.runs[1:]:
                run.text = ''
        else:
            paragraph.add_run(value)

    extra = doc.paragraphs[heading_index + 5]
    if extra.runs:
        extra.runs[0].text = ''
        for run in extra.runs[1:]:
            run.text = ''

    doc.paragraphs[heading_index + 6].paragraph_format.keep_with_next = True

    doc.save(DOCX)
    print(DOCX)


if __name__ == '__main__':
    main()
