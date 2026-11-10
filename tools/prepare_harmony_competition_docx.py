#!/usr/bin/env python3
"""Create the HarmonyOS competition copy from the existing Word source.

Only metadata and track labels are changed so the source document's layout and
visual design remain intact.
"""

from pathlib import Path
import shutil

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'docs' / '作品介绍文档.docx'
OUTPUT = (
    ROOT
    / 'deliverables'
    / '传智杯_启核图策_鸿蒙端'
    / '02_作品与技术文档'
    / '启核图策-鸿蒙端作品介绍.docx'
)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(SOURCE, OUTPUT)

    doc = Document(OUTPUT)
    replacements = {
        1: '团队名称：天枢序列（团队编号：38376；参赛人：高俊杰；队友：陈庚飞、罗渝川）',
        2: (
            '参赛赛事：2026第九届传智杯全国大学生数智创新与 AI 应用大赛；'
            '参赛赛道：HarmonyOSCodelabs挑战赛'
        ),
        4: '编制日期：2026 年 10 月 25 日',
        15: '附录 A：评审标准对照（赛道：HarmonyOSCodelabs挑战赛）',
        19: (
            '启核图策（NexcoreGraph）是一个 AI 主导的家庭资源智能管理系统，'
            '面向“HarmonyOSCodelabs挑战赛”打造。'
        ),
    }
    for index, text in replacements.items():
        doc.paragraphs[index].text = text

    info_table = doc.tables[15]
    values = {
        '解决方案/赛道': 'HarmonyOSCodelabs挑战赛',
        '团队名称': '天枢序列（38376 / 广西师范大学 / B组）',
        '队员': '陈庚飞、罗渝川（Codelabs 教程与截图、知识库检索测试、价值指标算法与测试用例）',
        '主要交付物': '源码工程、开发验证 HAP、Codelabs 教程、作品介绍文档、答辩 PPT；本轮不提交视频',
    }
    for row in info_table.rows:
        key = row.cells[0].text
        if key in values:
            row.cells[1].text = values[key]

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == '__main__':
    main()
