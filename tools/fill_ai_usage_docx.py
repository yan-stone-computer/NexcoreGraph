from copy import deepcopy
from pathlib import Path

from docx import Document
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from docx.shared import Pt
from docx.table import Table
from docx.text.paragraph import Paragraph


REFERENCE = Path(
    r"C:\Users\34274\Downloads\2026年第十四届全国大参赛团队数字媒体科技作品及创意竞赛人工智能工具使用情况说明.docx"
)
OUTPUT = Path(
    r"D:\ProjectFiles\GithubPackage\NexcoreGraph\deliverables\启核图策_402887"
    r"\07_AI工具使用补充说明\启核图策-人工智能工具使用情况说明.docx"
)


def set_paragraph_text(paragraph: Paragraph, text: str, bold: bool | None = None) -> None:
    runs = paragraph.runs
    if not runs:
        run = paragraph.add_run(text)
    else:
        run = runs[0]
        run.text = text
        for extra in runs[1:]:
            extra._element.getparent().remove(extra._element)
    if bold is not None:
        run.bold = bold
    run.font.name = "仿宋"
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "仿宋")


def set_cell_text(cell, text: str, size: float = 9.0, bold: bool = False) -> None:
    cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
    paragraph = cell.paragraphs[0]
    for extra in cell.paragraphs[1:]:
        cell._tc.remove(extra._p)
    paragraph.alignment = WD_ALIGN_PARAGRAPH.LEFT
    paragraph.paragraph_format.space_before = Pt(1)
    paragraph.paragraph_format.space_after = Pt(1)
    paragraph.paragraph_format.line_spacing = 1.05
    run = paragraph.runs[0] if paragraph.runs else paragraph.add_run()
    run.text = text
    run.bold = bold
    run.font.name = "仿宋"
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "仿宋")
    run.font.size = Pt(size)


def add_row_like(table: Table, source_row_index: int = -1):
    row = table.add_row()
    source_tr = table.rows[source_row_index]._tr
    new_tr = row._tr
    for child in list(new_tr):
        new_tr.remove(child)
    for child in source_tr:
        new_tr.append(deepcopy(child))
    return table.rows[-1]


def set_table_grid_borders(table: Table, color: str = "808080", size: str = "6") -> None:
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        element = borders.find(qn(f"w:{edge}"))
        if element is None:
            element = OxmlElement(f"w:{edge}")
            borders.append(element)
        element.set(qn("w:val"), "single")
        element.set(qn("w:sz"), size)
        element.set(qn("w:space"), "0")
        element.set(qn("w:color"), color)
    for row in table.rows:
        for cell in row.cells:
            tc_pr = cell._tc.get_or_add_tcPr()
            tc_borders = tc_pr.find(qn("w:tcBorders"))
            if tc_borders is None:
                tc_borders = OxmlElement("w:tcBorders")
                tc_pr.append(tc_borders)
            for edge in ("top", "left", "bottom", "right"):
                element = tc_borders.find(qn(f"w:{edge}"))
                if element is None:
                    element = OxmlElement(f"w:{edge}")
                    tc_borders.append(element)
                element.set(qn("w:val"), "single")
                element.set(qn("w:sz"), size)
                element.set(qn("w:space"), "0")
                element.set(qn("w:color"), color)
    for row in table.rows:
        tr_pr = row._tr.get_or_add_trPr()
        if tr_pr.find(qn("w:cantSplit")) is None:
            tr_pr.append(OxmlElement("w:cantSplit"))


def clone_paragraph_before(anchor: Paragraph, source: Paragraph, text: str) -> Paragraph:
    element = deepcopy(source._p)
    anchor._p.addprevious(element)
    clone = Paragraph(element, source._parent)
    set_paragraph_text(clone, text, True)
    return clone


def clone_table_after(table: Table) -> Table:
    element = deepcopy(table._tbl)
    table._tbl.addnext(element)
    return Table(element, table._parent)


def main() -> None:
    assert REFERENCE.exists(), REFERENCE
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    doc = Document(REFERENCE)

    props = doc.core_properties
    props.author = "NexcoreGraph"
    props.last_modified_by = "NexcoreGraph"
    props.title = "启核图策 人工智能工具使用情况说明"
    props.subject = "第十四届全国大学生数字媒体科技作品及创意竞赛"
    props.comments = ""
    props.category = "参赛材料"

    set_paragraph_text(doc.paragraphs[1], "（匿名评审版）")

    # 1. Basic information.
    basic = doc.tables[0]
    set_cell_text(basic.cell(1, 1), "启核图策")
    set_cell_text(basic.cell(2, 1), "402887")
    set_cell_text(basic.cell(3, 1), "本科及以上学历赛道 / 移动与网络应用开发")
    set_cell_text(basic.cell(4, 1), "□ 未使用　☑ 已使用")

    # 2. Main AI tools.
    tools = doc.tables[1]
    tool_rows = [
        (
            "Agnes 2.5 / 3.0 Flash（多模态与文本模型）",
            "产品运行时的拍照识别、自然语言指令、方案与说明生成",
            "输出物品候选字段、意图路由建议、方案文案和受约束工具意图；回答引用代码提供的库存证据",
            "学生设计提示词、接口、校验与降级；数值由代码校验；写操作经用户预览确认",
        ),
        (
            "Qwen-Image-2.1（本地 ComfyUI）",
            "介绍视频辅助视觉素材",
            "生成三幅无关键文字的手绘叙事素材，用于家庭物品、关系图和多人协作场景",
            "学生编写提示词、筛选图片、控制构图；真实界面与产品结论由人工排版覆盖",
        ),
        (
            "Edge TTS（zh-CN-YunxiNeural）",
            "介绍视频中文解说",
            "将人工定稿的分镜口播转为分段语音",
            "学生改写口语、逐段试听、调整音画时序；不使用真人声音克隆",
        ),
    ]
    for row, values in zip(tools.rows[1:4], tool_rows):
        for cell, value in zip(row.cells, values):
            set_cell_text(cell, value, size=8.4)

    # 3. Representative process one: product AI.
    set_paragraph_text(
        doc.paragraphs[16],
        "代表性流程一：拍照入库与 AI 规划／证据回答",
        True,
    )
    process = doc.tables[2]
    outputs = doc.tables[3]
    resources = doc.tables[4]
    process_values = {
        1: "把照片和自然语言请求转成可确认的家庭资源操作；一次输入可串联识别、规划、证据和工具意图。",
        2: "Agnes 2.5／3.0 Flash 通过受控 AI 网关调用；本地确定性规则负责高频意图路由；GraphRAG 负责路径证据。",
        3: "用户拍摄或上传的图片、用户文字请求、家庭资源事实、品类与保质期知识、当前图谱节点与边。",
        4: "结构化物品候选、自然语言回答、方案草稿、工具意图和带来源的证据说明。",
        5: "学生编写接口与提示词约束；代码负责数量、日期和价格；低置信度或失败时明确报错，不填充假数据；写操作先生成确认卡。",
        6: "AI 工作台、拍照入库、资源库、资源知识图谱、预警与方案页面。",
        7: "真实界面截图、接口自测 40 项、密码安全测试 15 项、发布前自检 11 项。",
    }
    for row_index, text in process_values.items():
        set_cell_text(process.cell(row_index, 1), text, size=8.8)

    # 4. AI-assisted final outputs.
    output_rows = [
        (
            "AI 工作台回答、拍照候选、方案与工具意图",
            "由 Agnes 模型辅助生成候选和表达；数量、日期、价格来自代码事实",
            "学生设置证据约束、工具白名单、确认与撤销机制，并完成真实数据联调",
            "AI 工作台／拍照入库／资源库／知识图谱／预警与方案",
        ),
        (
            "评审视频辅助素材与中文旁白",
            "Qwen-Image-2.1 生成三幅辅助插画；Edge TTS 根据人工定稿脚本生成语音",
            "学生筛选裁切、置入真实 UI 与实测数据，并逐段试听、修订措辞和音画时序",
            "视频片头、关系示意、片尾与全片解说",
        ),
    ]
    for row, values in zip(outputs.rows[1:3], output_rows):
        for cell, value in zip(row.cells, values):
            set_cell_text(cell, value, size=8.5)

    # 5. Student contribution.
    set_paragraph_text(
        doc.paragraphs[26],
        "本作品学生原创贡献约 70% 以上。核心创意与系统方案由学生提出：面向家庭中食品、药品和日用品分散、临期难追踪、采购与消耗脱节的问题，设计“拍照入库—资源图谱—AI 规划—家庭协作—提醒—核销”闭环。学生完成需求分析、交互与视觉规范、三端开发、GraphRAG 检索、AI 工具协议、安全、测试、部署和答辩材料。",
    )
    set_paragraph_text(
        doc.paragraphs[27],
        "学生独立定义数据模型、接口契约、工具白名单、用户确认与撤销机制，并对模型输出、生成素材、文案和测试结论进行人工筛选、修改与复核。整体成果中学生原创工作约占 70% 以上，AI 主要承担辅助性内容生成与表达工作。",
    )
    set_paragraph_text(
        doc.paragraphs[29],
        "AI 主要用于识别候选生成、语言表达和辅助素材生成，约占总工作量的 30% 以下，不拥有家庭事实、权限判定或写操作决定权。",
    )
    set_paragraph_text(
        doc.paragraphs[30],
        "AI 输出必须引用资源事实；失败时不回退假数据；生成素材只用于叙事镜头，产品能力和结果以真实录屏、截图与测试为准。",
    )

    # 6. Representative materials.
    set_paragraph_text(
        doc.paragraphs[33],
        "本项目保留代表性材料：介绍视频分镜与口播、AI 辅助素材生成记录、真实产品截图、操作录屏、功能测试摘要及视频工程文件。",
    )
    set_paragraph_text(
        doc.paragraphs[34],
        "提交附件已排除账号、密钥、邮箱授权码、个人信息和未公开数据；生成素材记录只保留必要提示与结果信息，不提交完整对话记录。",
    )

    # 7. Actual third-party resources.
    set_paragraph_text(doc.paragraphs[48], "【本项目第三方资源使用情况】", True)
    set_paragraph_text(
        doc.paragraphs[49],
        "本项目使用开源字体、图标、AI 模型、语音服务和视频合成工具。主要资源的名称、来源、用途与许可情况列于下表，详细说明另见《第三方资源说明》。",
    )
    set_paragraph_text(
        doc.paragraphs[50],
        "AI 生成素材、学生原创素材与第三方资源分别记录。生成模型输出不作为第三方授权素材的替代证明。",
    )
    resource_rows = [
        ("LXGW WenKai（字体）", "@fontsource/lxgw-wenkai / 本地 WOFF2", "介绍视频标题与说明文字", "SIL Open Font License"),
        ("Tabler Icons（图标）", "Tabler 官方图标库", "答辩 PPT 图标", "MIT License"),
        ("Qwen-Image-2.1（生成模型）", "本地 ComfyUI / Qwen 模型权重", "介绍视频辅助插画", "Qwen Research License；不主张商业权利，正式发布前复核条款"),
        ("HyperFrames / GSAP；Edge TTS（合成与语音）", "HyperFrames 0.8.188 / GSAP 3.14.2；Microsoft Edge TTS", "动态排版、转场、渲染与中文旁白", "按各上游许可使用；语音遵循服务条款，未使用真人声音克隆"),
    ]
    for row, values in zip(resources.rows[1:5], resource_rows):
        for cell, value in zip(row.cells, values):
            set_cell_text(cell, value, size=8.0)

    for paragraph in doc.paragraphs:
        text = paragraph.text.strip()
        if text == "四、最终成果中的AI生成或辅助内容":
            paragraph.paragraph_format.page_break_before = True
        if text == "（四）版权材料提交要求":
            paragraph.paragraph_format.page_break_before = True
        if text == "八、填写确认与提交提示":
            paragraph.paragraph_format.page_break_before = True

    for current in doc.tables:
        set_table_grid_borders(current)

    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
