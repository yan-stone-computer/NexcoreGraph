#!/usr/bin/env python3
"""Replace section 4.1 with one overview and seven code-aligned module figures."""

from __future__ import annotations

from pathlib import Path
import shutil

from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Pt


ROOT = Path(__file__).resolve().parents[1]
DOCX = Path('C:/Users/34274/Desktop/启核图策-鸿蒙端作品介绍.docx')
BACKUP = ROOT / 'docs' / 'backups' / '启核图策-鸿蒙端作品介绍-20261029-before-module-series.docx'
IMAGES = ROOT / 'docs' / 'images'
MODULES = IMAGES / 'harmony-modules'

MODULE_FIGURES = [
    (
        '4.1.2 ArkUI 交互与响应式外壳',
        MODULES / 'harmony-module-ui-shell@2x.png',
        '图 4-2',
        'ArkUI 交互外壳：EntryAbility 启动 Index，applyBreakpoints 按设备类型与窗口宽度写入 compact / wide；宽屏启用 NavRail，AI 面板打开时页面内容宽度同步扣除固定面板宽度。',
        'ArkUI 交互与响应式外壳架构图',
    ),
    (
        '4.1.3 本地编排与零模型快答',
        MODULES / 'harmony-module-local-routing@2x.png',
        '图 4-3',
        '本地编排与快答：AiGateway 先匹配受控命令，再按 11 类 Intent 选择确定性快答；问候、位置、数量和保质期由代码读取本地状态，开放问题才进入 GraphRAG 与模型路径。',
        '本地编排与零模型快答架构图',
    ),
    (
        '4.1.4 多模态入库闭环',
        MODULES / 'harmony-module-multimodal-intake@2x.png',
        '图 4-4',
        '多模态入库：CameraPicker 或 PhotoPicker 选图后压缩为 JPEG，经 /api/ai/vision 识别并映射为 IntakeResult；多图串行识别后按名称合并，字段补齐、用户确认后才写入资源库。',
        '多模态入库闭环架构图',
    ),
    (
        '4.1.5 个人资源图谱与 GraphRAG',
        MODULES / 'harmony-module-graphrag@2x.png',
        '图 4-5',
        '个人资源图谱与 GraphRAG：端侧 GraphBuild 从 Store 与知识库确定性构图，GraphStore 持久化 GraphDoc，GraphQuery 提供 local / global / multi-hop 证据包。当前问答不直接调用独立的后端 /api/graph/*。',
        '个人资源图谱与 GraphRAG 架构图',
    ),
    (
        '4.1.6 AI 受控网关与写操作确认',
        MODULES / 'harmony-module-ai-gateway@2x.png',
        '图 4-6',
        'AI 受控网关：本地命令与快答先短路；开放问题携带端侧证据请求自建 /api/ai/chat，厂商 Key 仅存服务端环境变量。返回的工具行先解析和校验，再由用户在端侧确认调整、采购或菜谱操作。',
        'AI 受控网关与写操作确认架构图',
    ),
    (
        '4.1.7 本地快照与三通道同步',
        MODULES / 'harmony-module-sync-channels@2x.png',
        '图 4-7',
        '本地快照与三通道同步：同一份 DataSnapshot 用于 Preferences 恢复、云端权威快照和 flow-bridge 实时流转；云端 409 冲突交给用户显式选择，本地图谱使用独立 graphDoc 存储。',
        '本地快照与三通道同步架构图',
    ),
    (
        '4.1.8 系统入口与跨设备接续',
        MODULES / 'harmony-module-system-entry@2x.png',
        '图 4-8',
        '系统入口与跨设备接续：EntryAbility 处理服务卡片目标与系统接续，EntryFormAbility 从 formSnapshot 刷新服务卡片；模拟器或同网调试由 flow-bridge 复用同一快照协议。',
        '系统入口与跨设备接续架构图',
    ),
]


def set_image_metadata(shape, title: str, description: str) -> None:
    shape._inline.docPr.set('title', title)
    shape._inline.docPr.set('descr', description)


def add_picture_before(anchor, path: Path, title: str, description: str,
                       width_cm: float, height_cm: float):
    paragraph = anchor.insert_paragraph_before()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.keep_with_next = True
    shape = paragraph.add_run().add_picture(str(path), width=Cm(width_cm), height=Cm(height_cm))
    set_image_metadata(shape, title, description)
    return paragraph


def add_caption_before(anchor, number: str, value: str):
    paragraph = anchor.insert_paragraph_before()
    paragraph.paragraph_format.keep_together = True
    paragraph.paragraph_format.space_after = Pt(6)
    number_run = paragraph.add_run(number)
    number_run.bold = True
    paragraph.add_run(' ' + value)
    return paragraph


def main() -> None:
    BACKUP.parent.mkdir(parents=True, exist_ok=True)
    if not BACKUP.exists():
        shutil.copy2(DOCX, BACKUP)

    doc = Document(DOCX)
    paragraphs = doc.paragraphs
    heading_index = next(
        i for i, paragraph in enumerate(paragraphs)
        if paragraph.text.strip() == '4.1 核心架构图'
    )
    key_index = next(
        i for i, paragraph in enumerate(paragraphs)
        if paragraph.text.strip() == '架构要点：'
    )
    key_points = paragraphs[key_index]
    first_item = paragraphs[key_index + 1]
    for paragraph in paragraphs[heading_index + 1:key_index]:
        element = paragraph._element
        element.getparent().remove(element)

    overview_heading = key_points.insert_paragraph_before('4.1.1 总体架构', style='Heading 3')
    overview_heading.paragraph_format.keep_with_next = True
    add_picture_before(
        key_points,
        IMAGES / 'harmony-core-architecture@2x.png',
        '启核图策核心架构',
        'HarmonyOS、服务端与外部能力总览，以及入库、问答和协同三条代码执行路径。',
        15.9,
        13.17,
    )
    add_caption_before(
        key_points,
        '图 4-1',
        '核心架构：HarmonyOS 端由 ArkUI 交互外壳、本地编排与检索、多模态入库、GraphRAG、AI 网关客户端、本地快照，以及多端协同与系统入口组成；自建后端负责 AI 受控网关、权威快照同步、身份与家庭协作、独立图谱 API，并以 MySQL 存储图谱五表；下方三条执行路径分别对应拍照入库、可信问答与多端协同。',
    )
    intro = key_points.insert_paragraph_before(
        '为避免把关键交互压进一张图，以下按代码职责继续展开七个模块。每张模块图保留真实入口、主要函数、数据边界和关键分支，便于逐项核对实现。'
    )
    intro.paragraph_format.keep_with_next = True
    intro.paragraph_format.space_before = Pt(4)
    intro.paragraph_format.space_after = Pt(4)

    for title, image, number, caption, alt in MODULE_FIGURES:
        module_heading = key_points.insert_paragraph_before(title, style='Heading 3')
        module_heading.paragraph_format.keep_with_next = True
        add_picture_before(key_points, image, alt, caption, 14.8, 8.67)
        add_caption_before(key_points, number, caption)

    key_points.paragraph_format.keep_with_next = True
    first_item.paragraph_format.keep_with_next = True
    doc.save(DOCX)
    print(DOCX)


if __name__ == '__main__':
    main()
