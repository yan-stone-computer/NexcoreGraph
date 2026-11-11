# -*- coding: utf-8 -*-
"""Build the AI Web Challenge technical document from the current Web client."""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Cm, Inches, Pt

import build_works_intro_doc as core


ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "deliverables" / "传智杯_启核图策_Web端"
DOCS = PKG / "01_技术文档"
SHOTS = PKG / "04_界面截图"
DIAGRAMS = SHOTS / "软件工程图"
OUT_DOCX = DOCS / "启核图策-Web端技术文档.docx"
OUT_PDF = DOCS / "启核图策-Web端技术文档.pdf"


def page_break(doc: Document) -> None:
    doc.add_page_break()


def add_caption(doc: Document, value: str) -> None:
    p = doc.add_paragraph(style="Caption")
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    core.add_run(p, value, 8.5, False, core.MUTED)


def add_label_value_table(doc: Document, rows: list[tuple[str, str]]) -> None:
    core.add_table(doc, ["模块", "职责与实现"], [[a, b] for a, b in rows], [1.7, 4.95])


def new_page_section(doc: Document, kicker: str, title: str) -> None:
    core.add_kicker(doc, kicker)
    core.add_heading(doc, title, 1)


def build() -> None:
    DOCS.mkdir(parents=True, exist_ok=True)
    doc = Document()
    core.setup_styles(doc)

    section = doc.sections[0]
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.65)
    section.bottom_margin = Cm(1.5)
    section.left_margin = Cm(1.85)
    section.right_margin = Cm(1.85)
    core.setup_running_furniture(section)
    header_runs = section.header.paragraphs[0].runs
    if header_runs:
        header_runs[0].text = "启核图策 NexcoreGraph  /  Web 端技术文档"
    header_team_runs = section.header.paragraphs[1].runs
    if header_team_runs:
        header_team_runs[0].text = "天枢序列WEB · 团队编号 38377"
    footer_runs = section.footer.paragraphs[0].runs
    if footer_runs:
        footer_runs[0].text = "天枢序列WEB · 38377  /  2026"

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(16)
    p.add_run().add_picture(
        str(ROOT / "docs" / "brand" / "mark-transparent-1024.png"),
        width=Inches(0.62),
    )
    core.add_kicker(doc, "2026 传智杯 · AI WEB 网页开发挑战赛")
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(24)
    p.paragraph_format.space_after = Pt(4)
    core.add_run(p, "让一张照片", 31, True, core.INK)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    core.add_run(p, "接着把事情做完", 31, True, core.GREEN_DARK)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(18)
    core.add_run(p, "启核图策 NexcoreGraph · 家庭资源决策与执行智能体", 14, False, core.MUTED)
    core.add_body(
        doc,
        "本作品把家庭物品照片转换为结构化事实，再把事实组织成可查询、可推理、可执行、可撤销的行动。"
        "AI 贯穿视觉输入、证据检索、方案生成和受控写入，而不是附加在传统库存表旁边的聊天框。",
    )
    core.add_metric_strip(
        doc,
        [
            ("Pareto", "多目标非支配"),
            ("13", "验收候选"),
            ("21 / 21", "Web 单测"),
            ("0 异常", "浏览器验收"),
        ],
    )
    core.add_callout(
        doc,
        "核心技术命题",
        "模型可以理解、建议和起草动作，但库存事实由代码维护，最终写入权限属于用户。",
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(24)
    p.paragraph_format.space_after = Pt(0)
    core.add_run(p, "天枢序列WEB · 团队编号 38377  /  2026-10-25  /  v1.0", 8.5, False, core.MUTED)

    page_break(doc)
    new_page_section(doc, "一页看懂", "从记录工具变成行动系统")
    core.add_body(
        doc,
        "家庭里最常见的问题不是“没有数据”，而是数据没有被转化成行动。鸡蛋在冰箱里临近过期，牛奶已经低于补充阈值，"
        "晚饭却仍要从头计划。启核图策将识别、事实、预警、方案、采购和协作串成同一条状态链。",
    )
    add_label_value_table(
        doc,
        [
            ("输入", "照片、自然语言、手动编辑；图片先进入视觉模型，文字先做意图路由。"),
            ("事实", "物品、库位、数量、期限、价格与操作日志；数值由代码计算，不让模型猜测。"),
            ("推理", "库存查询、知识库与资源图谱先装配证据，再交给大模型组织回答。"),
            ("行动", "写操作只生成草稿；预览、确认、执行、日志、撤销构成完整闭环。"),
        ],
    )
    core.add_heading(doc, "作品要回答的三个问题", 2)
    for number, title, body in [
        ("01", "AI 是否真的进入业务流程？", "照片直接产生库存候选，问答读取当前工作区，行动直接影响方案与采购。"),
        ("02", "回答是否可以被核对？", "数量、位置和期限来自确定性查询；GraphRAG 回答保留节点、关系与路径。"),
        ("03", "模型能否安全地改变数据？", "模型没有数据库写权限，只能生成白名单工具草稿等待用户确认。"),
    ]:
        p = doc.add_paragraph()
        p.paragraph_format.space_before = Pt(3)
        p.paragraph_format.space_after = Pt(1)
        core.add_run(p, f"{number}  {title}", 11.5, True, core.GREEN_DARK)
        p2 = doc.add_paragraph()
        p2.paragraph_format.left_indent = Cm(0.58)
        p2.paragraph_format.space_after = Pt(5)
        core.add_run(p2, body, 9.8, False, core.INK)
    core.add_callout(
        doc,
        "产品承诺",
        "照片进来，行动出去。AI 负责减少认知与输入成本，用户保留事实确认和最终执行权。",
    )

    page_break(doc)
    new_page_section(doc, "需求分析", "真实问题需要一个统一状态模型")
    core.add_body(
        doc,
        "家庭资源横跨食物、药品、工具、衣物和书籍。若每个库都采用不同表单，记录成本会迅速超过收益。"
        "作品采用统一的 Item 模型，把名称、类别、数量、单位、位置、期限和价格放在同一层，"
        "再由库类型、临期规则与场景知识扩展。",
    )
    core.add_table(
        doc,
        ["用户角色", "主要任务", "系统反馈"],
        [
            ["家庭管理员", "创建库、拍照入库、调整数量、管理成员", "统计、预警、日志和管理员入口"],
            ["普通成员", "查询位置、消耗物品、加入采购", "实时库存、确认卡与同步结果"],
            ["只读成员", "查看资源与方案", "写操作被拒绝并说明原因"],
            ["管理员", "审计、AI 用量、知识库与系统配置", "聚合指标与操作记录"],
        ],
        [1.65, 2.6, 2.4],
    )
    add_caption(doc, "表 1  家庭资源场景中的角色与核心任务。")
    core.add_heading(doc, "传统方案与 AI 原生方案", 2)
    core.add_table(
        doc,
        ["问题", "传统库存应用", "启核图策"],
        [
            ["录入成本", "逐项选择分类、数量与位置", "照片生成候选，只补缺失字段"],
            ["查询方式", "目录与筛选", "自然语言、全局搜索与图谱路径"],
            ["建议依据", "固定模板或无来源文本", "当前库存 + 知识库 + 图谱证据"],
            ["执行风险", "点击即修改", "预览、确认、日志与撤销"],
        ],
        [1.35, 2.45, 2.85],
    )
    add_caption(doc, "表 2  从高成本填写转向低摩擦确认。")
    core.add_body(
        doc,
        "目标不是让模型替用户做决定，而是减少“把现实世界转成可计算状态”的成本，并把每一次修改变成可追踪动作。",
    )

    page_break(doc)
    new_page_section(doc, "用户旅程", "一张照片串起库存、预警与行动")
    core.add_table(
        doc,
        ["阶段", "用户动作", "系统动作", "结果"],
        [
            ["识别", "拍照或上传图片", "视觉模型返回结构化候选", "名称、数量、位置、期限"],
            ["确认", "修改不确定字段", "校验字段并写入工作区", "库存事实与操作日志"],
            ["判断", "查看首页或问 AI", "计算临期、低库存和健康度", "今日待办与解释"],
            ["规划", "生成餐食或搭配方案", "读取真实存量与场景约束", "可执行方案"],
            ["执行", "勾选用料并确认", "扣减库存、写日志", "结果可撤销"],
            ["补齐", "查看采购清单", "合并缺口与已购项", "回到下一轮库存"],
        ],
        [1.05, 1.65, 2.15, 1.8],
    )
    add_caption(doc, "表 3  从视觉输入到下一次行动的状态流。")
    core.add_figure(
        doc,
        SHOTS / "03-dashboard.png",
        "图 1  看板将库存、临期、方案执行和预算汇总到同一屏。",
        6.35,
        "启核图策 Web 首页看板，显示资源总数、临期预警、方案执行率、本月花费和库存构成。",
    )
    core.add_callout(
        doc,
        "体验差异",
        "首页不只回答“家里有什么”，还直接指出“今天先处理什么”，让记录结果进入下一项家务决策。",
        fill=core.PALE_TEAL,
        accent="169B99",
    )

    page_break(doc)
    new_page_section(doc, "系统架构", "前端体验、AI 编排与事实层明确分层")
    core.add_table(
        doc,
        ["层级", "组成", "边界"],
        [
            ["体验层", "用户端、管理员端、移动布局", "输入意图与展示状态，不直接写数据库"],
            ["业务层", "资源、方案、采购、家庭、日志", "通过统一 API 维护领域状态"],
            ["AI 编排层", "意图路由、GraphRAG、工具协议", "只生成文本和动作草稿"],
            ["事实层", "本地状态、MySQL 快照、图谱索引", "确定性读写、版本与操作记录"],
            ["外部能力", "Agnes 文本与视觉模型", "由自建网关统一转发，Key 不下发"],
        ],
        [1.35, 2.55, 2.75],
    )
    add_caption(doc, "表 4  五层职责。相邻层通过稳定接口协作，模型不能跨越事实层。")
    core.add_heading(doc, "关键代码模块", 2)
    add_label_value_table(
        doc,
        [
            ("app.js", "用户端视图、事件和路由；调用 window.API 完成业务操作。"),
            ("mockapi.js", "本地工作区状态与业务 API；包含同步、撤销、日志和识别入口。"),
            ("ai.js / commands.js", "意图路由、受控工具协议、确认卡与本地快答。"),
            ("graph.js / graph-rag.js", "资源图谱构建、邻域/多跳检索、证据装配与回答来源。"),
            ("agnes.js", "自建网关与厂商直连双通道；健康探测、鉴权与超时控制。"),
            ("domains.js / domain-view.js", "药箱、健身、工具借用、家电保修、生活资产与全屋风险汇总。"),
            ("admin.js", "管理员端聚合指标、审计与知识库管理。"),
        ],
    )
    core.add_heading(doc, "与小程序端文档的关系", 2)
    core.add_table(
        doc,
        ["范围", "复用内容", "Web 端口径"],
        [
            ["共享能力", "品牌样式、统一资源模型、AI 网关契约、GraphRAG 与确认门", "术语和证据结构保持一致"],
            ["小程序端参考", "作品介绍、部署手册、截图组织和验收方法", "仅作为文档与产品基线"],
            ["Web 端差异", "浏览器界面、管理员入口、静态服务、桌面与窄屏适配", "实现与部署按本赛道重新核验"],
        ],
        [1.35, 3.25, 2.05],
    )
    add_caption(doc, "表 5  Web 端文档对小程序端交付物的复用与差异边界。")

    page_break(doc)
    new_page_section(doc, "软件工程图", "Web 系统架构图")
    core.add_figure(
        doc,
        DIAGRAMS / "01_Web系统架构.png",
        "图 2  Web 端分层架构：浏览器、AI 编排、Node.js 服务与确定性事实层。",
        6.45,
        "Web 软件系统架构图，展示浏览器、AI 编排、Node.js 服务、MySQL、外部模型和可信边界。",
    )
    core.add_body(
        doc,
        "架构图与源码模块一一对应：页面只消费业务 API，AI 层只能组织证据和动作草稿，"
        "服务端负责模型密钥、鉴权和同步，MySQL 与操作日志构成可回读的事实层。",
    )

    page_break(doc)
    new_page_section(doc, "AI 技术方案", "模型负责理解，代码负责事实")
    core.add_body(
        doc,
        "AI 调用层提供“自建网关优先、厂商直连兜底”双通道。默认请求经过 Node.js 网关，"
        "由服务端持有 Agnes Key，并统一执行超时、模型降级与用量记录；网关不可用时，用户可在本机设置页临时配置直连。",
    )
    core.add_table(
        doc,
        ["任务", "处理路径", "约束"],
        [
            ["问候 / 页面跳转", "本地意图路由", "0 次模型调用"],
            ["数量 / 位置 / 保质期", "库存与知识库确定查询", "数值不经过模型生成"],
            ["开放问题", "GraphRAG 证据 + 文本模型", "回答附来源与推理路径"],
            ["图片入库", "视觉模型 + 字段归一化", "低置信结果人工确认"],
            ["写操作", "受约束工具协议", "预览 → 确认 → 执行 → 撤销"],
        ],
        [1.75, 2.6, 2.3],
    )
    add_caption(doc, "表 6  按风险和能力划分的 AI 路由。")
    core.add_heading(doc, "模型可替换，事实不可替换", 2)
    core.add_body(
        doc,
        "模型接入不再写死单一厂商。设置页可选择平台模板，并继续修改 Base URL、文本模型、"
        "视觉模型、超时和 Key；请求层把差异归一化为 OpenAI Compatible、Anthropic Messages "
        "与 Gemini GenerateContent 三种协议。平台预设只减少输入成本，模型名称与地址始终可改。",
    )
    core.add_table(
        doc,
        ["接入方式", "协议与鉴权", "可配置项", "边界"],
        [
            ["OpenAI / DeepSeek / 千问 / Kimi / 智谱 / SiliconFlow", "Chat Completions · Bearer Key", "Base URL、文本模型、视觉模型、超时", "兼容格式不等于同一能力，模型质量按实际平台评测"],
            ["Anthropic Claude", "Messages API · x-api-key", "Base URL、模型、Key", "系统提示与消息角色由适配器转换"],
            ["Google Gemini", "GenerateContent · Key 查询参数", "Base URL、模型、Key", "文本和图片分别转换为 parts / inlineData"],
            ["vLLM / Ollama / One API / 企业代理", "OpenAI Compatible 或自定义代理", "全部请求字段与模型 ID", "用户自行保证服务可达与模型能力"],
            ["自建网关", "同源 /api/ai/chat 与 /api/ai/vision", "后端环境变量、限流、审计", "生产环境推荐，Key 不进入浏览器"],
        ],
        [1.35, 1.65, 1.85, 1.8],
    )
    add_caption(doc, "表 7  三种协议与自定义网关的统一接入矩阵。")
    core.add_callout(
        doc,
        "安全边界",
        "浏览器直连 Key 只存本机 localStorage，只显示末四位掩码，不进入同步快照；公网部署优先使用服务端网关。",
        fill="FFF1DE",
        accent="B87D16",
    )
    core.add_heading(doc, "可靠性设计", 2)
    for item in [
        "健康探测后缓存可用后端地址，避免每次对话重复探测。",
        "对话与视觉请求分别设置超时，失败后返回可理解的错误并保留本地操作。",
        "模型输出解析失败时不执行工具，也不伪造库存结果。",
        "服务端环境变量优先，公开构建产物不包含真实密钥。",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(4)
        core.add_run(p, item, 10.3, False, core.INK)
    core.add_figure(
        doc,
        SHOTS / "02-ai-workbench.png",
        "图 3  AI 工作台把待确认队列、实时统计、图谱社区和常驻对话放在同一入口。",
        4.20,
        "启核图策 AI 工作台，显示待确认队列、统计数据、图谱社区和对话。",
    )
    core.add_figure(
        doc,
        SHOTS / "20-ai-providers.png",
        "图 4  多平台 AI 通道：平台模板、协议、Base URL、文本/视觉模型和掩码 Key 可在同一页配置。",
        6.05,
        "启核图策多平台 AI 配置页，展示 DeepSeek、Claude、Gemini、自定义网关和模型字段。",
    )

    page_break(doc)
    new_page_section(doc, "工程资产", "来自团队自有 GitHub 项目的复用矩阵")
    core.add_body(
        doc,
        "本项目不是比赛期间从零拼接的孤立应用。团队将已开源的工程资产作为设计原则、接口边界和测试方法来源，"
        "再把与家庭资源场景相关的部分重新实现到 Web 端。除明确引入的依赖外，比赛包不要求外部仓库运行时。",
    )
    core.add_table(
        doc,
        ["自有仓库", "可复用内容", "本项目落点"],
        [
            ["NexcoreToolGuard", "风险分级、内容绑定确认、调用预算与熔断", "Agent 预览、确认、撤销与单请求调用上限"],
            ["nexcore-context-governor", "上下文分块、证据预算与可逆压缩", "GraphRAG 证据装配、限长与来源保留"],
            ["NexcoreMemory", "检索候选、图谱扩展、混合打分与召回回执", "个人资源图谱、路径来源与社区摘要"],
            ["NexcoreVision", "OCR、局部视觉证据与独立 VLM 语义分离", "多模态候选、人工补缺与不伪造结果"],
            ["alchemy-ui-skill", "版式系统、交互状态、响应式与预检", "设置页、家庭智策和移动端布局审查"],
            ["NexcoreGraph-Official", "品牌资产、发布材料与作品统一口径", "品牌、提交材料与后续在线发布准备"],
        ],
        [1.7, 2.7, 2.25],
    )
    add_caption(doc, "表 7A  团队自有 GitHub 工程资产的复用边界；具体代码仍以本仓库实现为准。")
    core.add_callout(
        doc,
        "复用原则",
        "复用设计原则与工程方法，不复制来路不明的代码；每个能力都回到本仓库源码、测试和评审证据。",
        fill=core.PALE_TEAL,
        accent="169B99",
    )

    page_break(doc)
    new_page_section(doc, "临期救援", "从“快过期了”推进到“今晚先做什么”")
    core.add_body(
        doc,
        "传统库存应用通常只显示保质期倒计时，用户仍要自己搜索菜谱、核对库存并手工扣减。"
        "临期救援驾驶舱把这一长串动作压缩为一条可复核决策链：匹配食材、计算临期贡献、排除忌口、"
        "比较缺料与时间、生成候选和组合菜单，最后通过受控写操作执行并允许撤销。"
        "算法核心是不依赖 DOM 的 rescue.js，单元测试覆盖临期优先、忌口、无日期、Pareto、"
        "组合约束和空库存；浏览器验收进一步验证预览前不写库存、执行后扣减、撤销后恢复。",
    )
    core.add_table(
        doc,
        ["能力层", "实现方式", "评审可观察证据"],
        [
            ["候选评分", "匹配率 40% + 临期程度 35% + 完整度 25%，偏好单独修正", "分数、四项贡献和推荐依据"],
            ["多目标决策", "救援覆盖、估值、匹配率、缺料、时间和蛋白计算 Pareto 非支配集", "PARETO 标识与被支配说明"],
            ["组合菜单", "最多 3 道菜、最多 12 个候选的确定性穷举，带总时长约束", "唯一临期覆盖、合并缺料、总时长"],
            ["反事实沙盘", "时间、菜数、缺料开关和排除食材即时重排", "同一页修改约束后候选顺序变化"],
            ["受控执行", "批量方案预览 → 确认 → 核销 → 撤销 → 审计", "库存恢复与救援历史"],
            ["AI 边界", "求解器 0 次模型调用；模型失败仍保留确定性候选", "断网/无 Key 演示"],
        ],
        [1.4, 3.55, 1.7],
    )
    add_caption(doc, "表 7  临期救援求解器的算法、产品与安全闭环。")
    core.add_figure(
        doc,
        SHOTS / "13-rescue-desktop.png",
        "图 5  临期救援驾驶舱：组合菜单、约束沙盘、Pareto 候选和实时救回统计位于同一工作面。",
        6.2,
        "临期救援驾驶舱，展示组合菜单、筛选器、Pareto 候选、评分贡献和操作按钮。",
    )

    page_break(doc)
    new_page_section(doc, "家庭智策", "统一事实层上的多生活域算法")
    core.add_body(
        doc,
        "项目不只管理食材。药品、健身器材、工具、家电、衣物、书籍、宠物用品和清洁耗材复用同一资源事实模型，"
        "但每个生活域使用不同的风险规则和规划算法。药箱关注有效期、过期与补货；"
        "工具与家电关注保修、维护、借用人、归还期限和逾期；健身模块把身高、体重、年龄、目标、训练水平和库存器材"
        "作为约束，计算 BMI、目标心率与每周训练安排。训练建议只保存在本机 Profile，"
        "不替代医疗诊断。全屋总览再跨域汇总资源数、库存估值、生活资产数和待处理风险，"
        "风险按生活域去重并可直接跳转到对应业务页。",
    )
    core.add_table(
        doc,
        ["生活域", "代码输入", "确定性输出"],
        [
            ["食材", "有效期、库存、低库存阈值", "临期队列、估值与 Pareto 救援入口"],
            ["药箱", "有效期、库存、低库存阈值", "临期/过期排序、补货提示"],
            ["健身", "身高体重、年龄、目标、水平、周频次、器材", "BMI、目标心率、训练日与动作"],
            ["工具家电", "剩余保修、维护周期、借用人、归还天数", "保修、维护、借出与逾期任务"],
            ["生活资产", "衣橱、家电、书籍、宠物、清洁耗材", "数量、估值、临期与低库存风险"],
            ["全屋汇总", "十个生活域的统一 Inventory 结果", "总资源、总估值、风险域与跨域问答"],
            ["通用资源", "库类型、数量、位置、日志", "搜索、GraphRAG、权限与审计"],
        ],
        [1.1, 2.6, 2.95],
    )
    add_caption(doc, "表 8  家庭智策的多生活域模型；药品与训练建议均保留人工判断和安全边界。")
    core.add_figure(
        doc,
        SHOTS / "17-family-domains.png",
        "图 6  家庭智策：身体数据、器材覆盖、BMI、目标心率和训练方案由代码计算。",
        6.1,
        "家庭智策页面，展示身体数据输入、训练计划、BMI、目标心率和器材覆盖。",
    )
    page_break(doc)
    new_page_section(doc, "软件工程图", "AI 数据处理与受控行动流")
    core.add_figure(
        doc,
        DIAGRAMS / "02_AI数据处理与受控行动流.png",
        "图 4  读路径优先事实，写路径必须经过参数校验、预览和用户确认。",
        6.45,
        "AI 数据处理与受控行动图，展示事实问答路径和受控写操作路径。",
    )
    core.add_body(
        doc,
        "读路径把本地事实和 GraphRAG 证据放在模型之前；写路径把工具草稿、参数校验、预览卡、"
        "用户确认、业务 API、日志和撤销串成可审计事务。",
    )

    page_break(doc)
    new_page_section(doc, "GraphRAG", "先找到证据，再让模型组织语言")
    core.add_body(
        doc,
        "资源图谱把家庭、库、物品、类别、菜谱、规则与场景连成多层网络。问题进入后，系统先匹配实体，"
        "再按意图选择结构查询、邻域查询或多跳路径；证据压缩后与问题一起交给模型。回答下方的节点、边和来源让推理可以被检查。",
    )
    core.add_heading(doc, "检索管线", 2)
    for index, item in enumerate(
        [
            "问题归一化并识别意图：事实查询、位置、期限、规划或开放解释。",
            "结构化检索：在物品、库位、数量、期限和操作记录中取事实。",
            "图谱检索：展开邻域与多跳关系，保留节点、边和来源。",
            "证据装配：限制条数与长度，生成带来源的上下文。",
            "模型生成：只基于证据组织语言；失败时降级为本地回答。",
        ],
        1,
    ):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.32)
        p.paragraph_format.space_after = Pt(3)
        core.add_run(p, f"{index:02d}  ", 9.8, True, core.GREEN)
        core.add_run(p, item, 10.2, False, core.INK)
    core.add_figure(
        doc,
        SHOTS / "06-graph.png",
        "图 5  资源图谱的社区总览：101 个节点、96 条边，构图 0 次模型调用。",
        6.35,
        "启核图策资源图谱社区总览，显示家庭、冰箱、药盒、工具箱和书架的关系。",
    )
    core.add_callout(
        doc,
        "可信边界",
        "图谱规模、节点数和边数来自具体演示工作区，会随库存变化；来源与调用次数在运行时展示，不写成固定产品指标。",
        fill=core.PALE_TEAL,
        accent="169B99",
    )

    new_page_section(doc, "Agent 与安全", "让模型提议，让用户授权")
    core.add_body(
        doc,
        "作品没有把模型输出直接绑定到数据库。AI 对话层只允许生成白名单动作草稿，包括数量调整、加入采购、执行方案和核销提醒；"
        "前端校验名称、数量与目标对象，再显示预览卡。只有用户点击确认后，统一业务 API 才会写入状态并生成操作日志。",
    )
    core.add_table(
        doc,
        ["工具", "触发示例", "用户可见预览", "可逆性"],
        [
            ["adjust", "鸡蛋还剩 5 个", "当前数量 → 目标数量", "可撤销"],
            ["shopping_add", "牛奶没了，加入采购清单", "物品、数量和来源", "可撤销"],
            ["plan_execute", "执行番茄炒蛋", "用料与库存扣减", "可撤销"],
            ["alert_done", "核销牛奶临期提醒", "提醒与对应物品", "写日志"],
        ],
        [1.35, 2.35, 2.0, 1.0],
    )
    add_caption(doc, "表 7  受约束工具及确认内容。")
    core.add_heading(doc, "五条执行规则", 2)
    for item in [
        "仅执行白名单工具；未知动作只作为普通文本显示。",
        "物品必须命中当前工作区；找不到时询问而不是猜测。",
        "数量必须为正数并受到上限约束。",
        "所有写操作先预览，再由用户确认。",
        "执行后写日志并保留撤销入口。",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(4)
        core.add_run(p, item, 10.3, False, core.INK)
    core.add_callout(
        doc,
        "执行记录",
        "最近一次数量变更可在设置页撤销；方案、物品、库和提醒等写操作同时留下日志，供用户回查。",
    )

    page_break(doc)
    new_page_section(doc, "软件工程图", "受控 Agent 写操作时序")
    core.add_figure(
        doc,
        DIAGRAMS / "03_受控Agent时序.png",
        "图 6  用户确认是界面、AI 编排、网关与数据库之间唯一的写入分界。",
        6.2,
        "受控 Agent 写操作时序图，展示用户、Web 界面、AI 编排、Node 网关和 MySQL 的交互。",
    )
    core.add_body(
        doc,
        "未确认的草稿只存在于界面层。确认后，Web 端才调用统一业务 API，再由 Node 网关完成版本校验和事务写入；"
        "成功后更新页面并返回日志与撤销入口。",
    )

    page_break(doc)
    new_page_section(doc, "多模态", "图片进入，结构化候选出来")
    core.add_body(
        doc,
        "拍照入库支持浏览器相机、文件上传与拖拽。图片在端侧压缩后发送到视觉模型，返回名称、类别、数量、单位、"
        "建议位置、保质期和价格；前端统一字段后进入人工补缺界面。识别失败时明确提示，不回退到伪造结果。",
    )
    core.add_table(
        doc,
        ["环节", "实现", "保护"],
        [
            ["采集", "相机 / 相册 / 拖拽", "仅在用户主动操作时请求权限"],
            ["压缩", "浏览器端限制尺寸与体积", "减少传输和等待"],
            ["识别", "自建网关 + 视觉模型链", "服务端密钥、超时与错误返回"],
            ["归一化", "数量、期限、价格和单位校验", "异常值回到可编辑候选"],
            ["入库", "目标库与字段人工确认", "确认后才写库存"],
        ],
        [1.2, 2.7, 2.75],
    )
    add_caption(doc, "表 8  多模态入库链路的输入、处理与保护。")
    core.add_heading(doc, "为什么不用静态识别结果", 2)
    core.add_body(
        doc,
        "竞赛演示中，最容易被质疑的是“识别看起来像真，但其实是写死的”。本版本将模型调用和失败路径放在代码中："
        "没有 Key、网络失败或返回空数组时，界面会显示对应状态；只有真实返回结果才进入候选表。",
    )
    core.add_callout(
        doc,
        "可核对证据",
        "源码：Web源码/js/agnes.js、Web源码/js/mockapi.js；界面：拍照入库页；演示视频：视觉识别与确认入库段落。",
    )

    page_break(doc)
    new_page_section(doc, "前端工程", "低依赖不等于低结构")
    core.add_body(
        doc,
        "本版本采用分文件的 HTML/CSS/JavaScript，不需要构建即可启动。代码按状态、AI、图谱、视图和管理员端拆分，"
        "页面统一通过 window.API 与业务状态交互。这个选择适合评审复现，也保留了迁移到 Vue 或 React 的清晰切面。",
    )
    core.add_table(
        doc,
        ["工程面", "当前实现", "可执行改进"],
        [
            ["组件与视图", "视图函数 + 事件委托", "按页面拆为组件，保留状态契约"],
            ["状态管理", "统一 API 与带版本工作区", "迁移 Pinia / Zustand"],
            ["样式系统", "设计令牌 + 主题变量", "继续抽取组件级 token"],
            ["可访问性", "语义标签、键盘搜索、浮层关闭", "补充 axe 与全键盘回归"],
            ["性能", "零框架开销、局部重绘", "路由拆包、图片懒加载与缓存"],
        ],
        [1.45, 2.75, 2.45],
    )
    add_caption(doc, "表 9  前端工程质量与下一阶段改造方向。")
    core.add_heading(doc, "可评审性取舍", 2)
    for item in [
        "无需安装前端依赖，克隆后即可启动，减少评审环境差异。",
        "业务 API 与视图解耦，后续迁移框架时保留既有数据契约。",
        "媒体查询覆盖窄屏，主操作改为图标导航和单列卡片。",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(4)
        core.add_run(p, item, 10.3, False, core.INK)

    page_break(doc)
    new_page_section(doc, "软件工程图", "前端模块依赖")
    core.add_figure(
        doc,
        DIAGRAMS / "05_前端模块依赖.png",
        "图 7  页面、状态、AI 编排、图谱与后端之间的依赖关系。",
        6.35,
        "Web 前端模块依赖图，展示页面、业务状态、AI 编排、图谱、知识库和后端服务。",
    )
    core.add_body(
        doc,
        "页面通过 window.API 访问业务状态；AI 编排消费事实和图谱服务；后端负责模型与数据持久化。"
        "新增功能应沿这些边界扩展，避免页面直接写数据库或模型绕过确认门。",
    )

    page_break(doc)
    new_page_section(doc, "业务闭环", "库存不是终点，而是下一次行动")
    core.add_figure(
        doc,
        SHOTS / "05-libraries.png",
        "图 8  资源库支持冰箱、药箱、工具箱和书架等自定义类型。",
        6.15,
        "启核图策资源库页面，显示四个不同类型的资源库。",
    )
    core.add_heading(doc, "任务如何流转", 2)
    core.add_table(
        doc,
        ["信号", "系统动作", "用户结果"],
        [
            ["临期 / 过期", "进入预警与今日待办", "优先消耗或处理"],
            ["低库存", "合并进采购清单", "减少重复购买"],
            ["方案执行", "按用料扣减库存", "结果可撤销"],
            ["家庭协作", "邀请码与实时同步", "同一份状态被多人维护"],
        ],
        [1.5, 2.55, 2.6],
    )
    add_caption(doc, "表 10  业务事件与后续动作。")
    core.add_body(
        doc,
        "看板、资源库、方案和采购共用同一份工作区状态，因此页面之间不是独立演示，而是连续数据流。"
        "这也是视觉识别能够产生实际价值的前提：识别结果必须进入统一事实层，才会影响后续判断。",
    )
    page_break(doc)
    new_page_section(doc, "管理与协作", "聚合指标与个人数据分开")
    core.add_body(
        doc,
        "管理员端与用户端共享业务契约，但只展示聚合视角：用户、家庭、审计、AI 用量、图谱统计、系统配置和知识库。"
        "涉及个人库存、成员或聊天正文的信息不在默认聚合页展开，避免管理视角越权。",
    )
    core.add_figure(
        doc,
        SHOTS / "09-admin.png",
        "图 9  管理员的图谱看板以匿名聚合方式展示节点、边、社区与模型主导率。",
        6.15,
        "启核图策管理员端图谱看板，显示家庭数、节点、边、社区和 AI 主导率。",
    )
    core.add_heading(doc, "多端同步与流转", 2)
    core.add_table(
        doc,
        ["能力", "机制", "用户价值"],
        [
            ["账号与家庭", "后端验证码登录、家庭快照", "同一家庭共享工作区"],
            ["活同步", "版本状态轮询与按 id 合并", "另一端自动收到更新"],
            ["页面流转", "明确发送 / 接收快照", "从桌面继续到另一设备"],
            ["冲突处理", "版本不一致时回拉确认", "避免静默覆盖"],
        ],
        [1.45, 2.65, 2.55],
    )
    add_caption(doc, "表 11  家庭协作与状态同步。")
    core.add_callout(
        doc,
        "隐私边界",
        "跨设备同步只搬运结构化工作区；聊天正文和图片二进制不随公开演示材料发布。",
        fill=core.PALE_TEAL,
        accent="169B99",
    )

    new_page_section(doc, "测试与证据", "所有结论都回到可复核的界面或代码")
    core.add_table(
        doc,
        ["核验项", "当前证据", "判断"],
        [
            ["首页与工作台", "真实页面截图、浏览器加载", "无白屏，统计区正常渲染"],
            ["AI 网关", "/api/health、真实模型配置", "后端可达时标记 ready"],
            ["视觉识别", "拍照入库入口与网关代码", "识别失败显式提示"],
            ["GraphRAG", "图谱页面、来源标签、检索模块", "证据链可见"],
            ["Agent 写入", "预览卡、确认交互、日志", "确认后才落库"],
            ["全屋多域", "21 项 Web 单测、浏览器回归、9 个生活域测试数据", "药箱、健身、工具、资产与跨域问答均通过"],
            ["多平台模型配置", "11 个平台/自定义模板、3 种协议、掩码 Key 与移动端设置页", "平台切换、Base URL、模型和协议标签均通过"],
            ["响应式", "移动端截图与媒体查询", "窄屏不依赖横向滚动"],
            ["安全", "安全静态服务、dotenv 回归测试、密钥边界", "点文件与路径穿越返回 404；浏览器不读取 dotenv"],
        ],
        [2.05, 2.45, 2.15],
    )
    add_caption(doc, "表 12  技术与体验核验项。")
    core.add_body(
        doc,
        "材料中的具体库存数、图谱节点数和临期数量来自演示工作区截图，会随用户数据变化。"
        "文档保留这些数字的采集上下文，不把它们包装成固定的产品性能指标。",
    )
    core.add_callout(
        doc,
        "可复现路径",
        "启动后端 → 启动 Web → 登录 → 拍照入库 → 查看看板与资源库 → 询问 AI → 确认写操作 → 查看日志与撤销。",
        fill=core.PALE_GREEN,
        accent=core.GREEN,
    )

    page_break(doc)
    new_page_section(doc, "部署与安全", "本地可复现，公网需明确边界")
    core.add_table(
        doc,
        ["项目", "本地评审", "公网部署"],
        [
            ["Web", "安全静态服务 8080（拒绝点文件）", "HTTPS 静态托管或反向代理，禁止发布 .env"],
            ["后端", "Node.js 3000", "仅暴露 API，经反向代理保护"],
            ["数据库", "MySQL 3307 / 3306", "私网访问、最小权限账号"],
            ["AI Key", "后端环境变量", "密钥管理服务，不下发客户端"],
            ["登录", "本地验证码联调", "真实邮件 / 短信通道与访问控制"],
        ],
        [1.45, 2.55, 2.65],
    )
    add_caption(doc, "表 13  本地评审与公网部署的边界。")
    core.add_heading(doc, "最短启动", 2)
    for index, item in enumerate(
        [
            "执行后端 init-db.sql，创建 tianshu 数据库。",
            "复制后端 .env.example 为 .env，填写数据库与 AI Key。",
            "在后端目录执行 npm ci、node server.js。",
            "在仓库根目录执行 python tools/serve_web.py --root web/NexcoreGraph_web --port 8090。",
            "浏览器打开 http://127.0.0.1:8090 并完成登录。",
        ],
        1,
    ):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.32)
        p.paragraph_format.space_after = Pt(3)
        core.add_run(p, f"{index:02d}  ", 9.8, True, core.GREEN)
        core.add_run(p, item, 10.2, False, core.INK)
    core.add_callout(
        doc,
        "不要发布",
        "真实 .env、API Key、数据库密码、家庭快照、聊天正文和带个人信息的截图都需要从公开仓库中排除。",
        fill="FFF1DE",
        accent="B87D16",
    )

    page_break(doc)
    new_page_section(doc, "软件工程图", "Web 部署拓扑")
    core.add_figure(
        doc,
        DIAGRAMS / "04_Web部署拓扑.png",
        "图 10  本地评审与外部模型、可选服务的部署关系。",
        6.25,
        "Web 部署拓扑图，展示浏览器、静态服务、Node 后端、MySQL、Agnes 和可选外部通道。",
    )
    core.add_body(
        doc,
        "本地评审只需 Web、Node 后端和 MySQL；公网部署通过 HTTPS 反向代理暴露前端和 API，"
        "数据库保持私网访问。flow-bridge、SMTP、SMS、TTS 与微信内容安全均为可选服务。",
    )

    page_break(doc)
    new_page_section(doc, "创新点", "技术创新必须落到可观察的系统行为")
    core.add_table(
        doc,
        ["创新", "技术做法", "应用价值"],
        [
            ["视觉输入状态化", "结构化候选 + 人工补缺 + 确认入库", "降低录入成本"],
            ["证据化回答", "结构化事实 + GraphRAG 路径", "回答可核对"],
            ["事实与推理分层", "本地快答优先，开放问题才调用模型", "成本与延迟更低"],
            ["受控 Agent", "白名单工具 + 预览 + 确认 + 撤销", "写操作可控"],
            ["多平台模型适配", "平台模板 + 三种协议 + 自定义 Base URL/模型", "不绑定厂商，演示可迁移"],
            ["通用资源模型", "不同库类型共享统一状态链", "覆盖更多家庭场景"],
            ["全屋跨域风险", "数量、估值、临期、低库存、保修、维护和借用统一去重汇总", "从单域记录升级为家庭运营总览"],
            ["多目标救援求解", "Pareto 前沿 + 约束组合 + 反事实沙盘", "从预警推进到行动"],
            ["可回放决策", "分数贡献、淘汰原因与库存证据分层展示", "推荐结果可复核"],
        ],
        [1.65, 2.65, 2.35],
    )
    add_caption(doc, "表 14  技术创新与应用创新的对应关系。")
    core.add_heading(doc, "评分维度回看", 2)
    core.add_table(
        doc,
        ["维度", "权重", "本作品的直接证据"],
        [
            ["AI 技术深度", "35%", "视觉、快答、GraphRAG、工具确认与降级"],
            ["创新性", "25%", "照片到行动、证据图谱、可控执行"],
            ["前端工程", "10%", "分层模块、统一 API、响应式布局"],
            ["实用性", "10%", "临期消耗、采购补齐与家庭协作"],
            ["用户体验", "10%", "统一入口、清晰反馈、可撤销操作"],
            ["社会与商业", "10%", "减少浪费、家庭订阅与知识库延展"],
        ],
        [1.5, 0.8, 4.35],
    )
    add_caption(doc, "表 15  与赛道评分权重对应的证据位置。")

    page_break(doc)
    new_page_section(doc, "总结与边界", "把已经做到的能力讲清楚")
    core.add_body(
        doc,
        "启核图策已经具备可运行的 Web 用户端、管理员端、AI 网关、真实视觉入口、GraphRAG 图谱证据和受控写操作。"
        "它不是把所有能力都做成自动执行，而是让模型在事实和权限边界内工作。",
    )
    core.add_heading(doc, "当前不主张的能力", 2)
    for item in [
        "没有将当前前端称为 React/Vue 工程，实际为免构建原生模块化实现。",
        "没有宣称实现 MCP 协议，当前采用受约束的本地工具协议。",
        "没有把订阅模板、公网域名和第三方审核配置写成已经上线。",
        "没有宣称所有识别结果都准确；不确定字段需要人工确认。",
    ]:
        p = doc.add_paragraph(style="List Bullet")
        p.paragraph_format.space_after = Pt(5)
        core.add_run(p, item, 10.3, False, core.INK)
    core.add_heading(doc, "下一阶段", 2)
    core.add_table(
        doc,
        ["阶段", "目标", "衡量标准"],
        [
            ["近期", "补充端到端自动化、性能预算与可访问性回归", "关键路径可自动重放"],
            ["中期", "迁移组件化框架并保持现有业务 API", "视觉回归一致、包体可控"],
            ["长期", "接入更多家庭设备与开放知识库", "跨设备采集、提醒和行动闭环"],
        ],
        [1.2, 3.15, 2.3],
    )
    add_caption(doc, "表 16  可验证的后续路线。")
    core.add_callout(
        doc,
        "一句话总结",
        "启核图策让 AI 把家庭里已经存在的资源，转化成今天就能完成的下一步。",
        fill=core.PALE_GREEN,
        accent=core.GREEN,
    )
    core.add_heading(doc, "团队与交付", 2)
    core.add_table(
        doc,
        ["项目项", "内容"],
        [
            ["作品名称", "启核图策 NexcoreGraph"],
            ["团队", "天枢序列WEB（38377）"],
            ["参赛信息", "广西师范大学 · 本科 B组"],
            ["成员", "高俊杰、周子琦、杨欢"],
            ["版本", "2026-10-25 · v1.0"],
        ],
        [1.45, 5.2],
    )

    # The table helper appends a spacer paragraph; remove the final one so it
    # cannot create a footer-only page after the last table.
    if doc.paragraphs and not doc.paragraphs[-1].text.strip():
        element = doc.paragraphs[-1]._element
        element.getparent().remove(element)

    doc.core_properties.title = "启核图策 Web 端技术文档"
    doc.core_properties.subject = "AI WEB 网页开发挑战赛技术方案、实现与证据"
    doc.core_properties.author = "天枢序列WEB"
    doc.core_properties.keywords = "AI Web, GraphRAG, multimodal, agent, NexcoreGraph"
    doc.save(OUT_DOCX)
    print(OUT_DOCX)


if __name__ == "__main__":
    build()
