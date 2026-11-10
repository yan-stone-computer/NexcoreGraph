#!/usr/bin/env python3
"""Refine the NexcoreGraph resume block with evidence-backed claims."""

from pathlib import Path

from docx import Document


ROOT = Path(__file__).resolve().parents[1]
DOCX = ROOT / 'docs' / '启核图策NexcoreGraph-简历项目经历.docx'


def set_body(paragraph, body: str) -> None:
    """Keep the bold label run and replace only the explanatory run."""
    if len(paragraph.runs) < 2:
        paragraph.add_run()
    paragraph.runs[1].text = body
    for run in paragraph.runs[2:]:
        run.text = ''


def main() -> None:
    doc = Document(DOCX)
    paragraphs = doc.paragraphs

    paragraphs[0].runs[0].text = '启核图策 NexcoreGraph｜家庭资源智能管家（鸿蒙 / Web / 小程序三端）'
    paragraphs[1].runs[0].text = '核心开发（AI 编排 / 鸿蒙端 / 后端）'
    set_body(
        paragraphs[1],
        '技术栈：ArkTS / ArkUI（HarmonyOS NEXT）· Node.js + Express + MySQL · '
        'Taro 4 + React 18 + TypeScript',
    )
    set_body(
        paragraphs[2],
        '面向家庭实物资源“看得见但记不住”的痛点，构建“拍照建库 → AI 规划 → '
        '临期预警 → 家庭协作”闭环，把非结构化照片转成可查询、可推理、可执行的资源状态，'
        '已落地鸿蒙、Web（含管理端）与微信小程序三端。',
    )

    replacements = [
        (
            'AI 编排与可信执行：',
            '设计 11 类意图路由与受约束工具协议，将问候、位置、数量、保质期等高频问题转为'
            '端侧 0 模型直答；库存、价格与期限由代码计算，模型只负责理解与措辞；调整、采购、'
            '方案执行均先预览确认后落库并支持撤销。网关采用主备模型降级与 429 快速切换，'
            '实测对话约 2.9s、视觉识别 2.3-2.9s。',
        ),
        (
            '个人资源图谱与 GraphRAG：',
            '设计 13 类节点 / 14 类边的资源本体，端侧以 0 次模型调用完成确定性构图'
            '（实测 32 节点 / 41 边 / 3 社区，66ms）；实现 local / global / multi-hop '
            '三模检索，回答附节点链、事实与来源，图谱不可用时回退证据行。',
        ),
        (
            '三端架构与数据一致性：',
            '以统一设计令牌驱动鸿蒙、Web 与小程序界面，抽象 29 个后端 REST 端点及统一端侧访问层，'
            '客户端不直连数据库；设计“全量快照 + 版本号”同步协议，冲突返回 409 由用户选择覆盖或拉取，'
            '避免静默覆盖；同账号跨设备活同步实测 7 秒内落地。',
        ),
        (
            '多模态入库闭环：',
            '打通“拍照 / 相册 → 视觉识别名称、数量、保质期、位置与价格 → 字段补缺确认 → 入库”'
            '链路，支持最多 6 张连拍去重与数量合并；识别失败可重试或转手动录入，'
            '不相关图片不会生成虚假库存。',
        ),
        (
            '账号与数据安全：',
            '模型密钥仅驻服务端；密码采用 scrypt（N=16384 / r=8 / p=1）+ 16 字节随机盐存储，'
            '自描述串支持参数升级，timingSafeEqual 防时序侧信道；未设密码账号执行等量计算防账号探测，'
            '连续 5 次失败锁定 15 分钟。',
        ),
    ]

    for index, (label, body) in enumerate(replacements, start=4):
        paragraphs[index].runs[0].text = label
        set_body(paragraphs[index], body)

    for paragraph in paragraphs[9:]:
        paragraph._element.getparent().remove(paragraph._element)

    doc.save(DOCX)
    print(DOCX)


if __name__ == '__main__':
    main()
