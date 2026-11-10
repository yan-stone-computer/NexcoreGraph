from pathlib import Path
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    Image,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


ROOT = Path(r"D:\ProjectFiles\GithubPackage\NexcoreGraph")
OUT = ROOT / "deliverables" / "启核图策_402887"
SHOTS = ROOT / "deliverables" / "screenshots"
BRAND = ROOT / "docs" / "brand"

GREEN = colors.HexColor("#4C9F70")
GREEN_DEEP = colors.HexColor("#2F6B4E")
INK = colors.HexColor("#1E2A26")
MUTED = colors.HexColor("#67736C")
TERRA = colors.HexColor("#C96F51")
TEAL = colors.HexColor("#2FA9C7")
PAPER = colors.HexColor("#FBF7F2")
PAPER_DEEP = colors.HexColor("#F1E7D8")
SURFACE = colors.HexColor("#FFFDF8")
LINE = colors.HexColor("#D8CDBE")
WHITE = colors.white

pdfmetrics.registerFont(TTFont("MSYH", r"C:\Windows\Fonts\msyh.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("MSYH-Bold", r"C:\Windows\Fonts\msyhbd.ttc", subfontIndex=0))
pdfmetrics.registerFont(TTFont("KaiTi", r"C:\Windows\Fonts\simkai.ttf"))

BODY = ParagraphStyle(
    "Body",
    fontName="MSYH",
    fontSize=10.5,
    leading=16.5,
    textColor=INK,
    spaceAfter=7,
)
BODY_SMALL = ParagraphStyle(
    "BodySmall",
    parent=BODY,
    fontSize=9,
    leading=13.5,
    textColor=MUTED,
    spaceAfter=4,
)
H1 = ParagraphStyle(
    "H1",
    fontName="MSYH-Bold",
    fontSize=17,
    leading=23,
    textColor=GREEN_DEEP,
    spaceBefore=10,
    spaceAfter=9,
    keepWithNext=True,
)
H2 = ParagraphStyle(
    "H2",
    fontName="MSYH-Bold",
    fontSize=12.5,
    leading=18,
    textColor=INK,
    spaceBefore=8,
    spaceAfter=5,
    keepWithNext=True,
)
COVER_TITLE = ParagraphStyle(
    "CoverTitle",
    fontName="KaiTi",
    fontSize=32,
    leading=43,
    textColor=INK,
    spaceAfter=12,
)
COVER_SUB = ParagraphStyle(
    "CoverSub",
    fontName="MSYH",
    fontSize=12,
    leading=19,
    textColor=MUTED,
    spaceAfter=8,
)
CAPTION = ParagraphStyle(
    "Caption",
    fontName="MSYH",
    fontSize=8.2,
    leading=11,
    textColor=MUTED,
    alignment=TA_CENTER,
    spaceBefore=4,
)
CALLOUT = ParagraphStyle(
    "Callout",
    fontName="MSYH-Bold",
    fontSize=10.5,
    leading=16,
    textColor=GREEN_DEEP,
)


def P(text, style=BODY):
    return Paragraph(text, style)


def H(text, level=1):
    return Paragraph(text, H1 if level == 1 else H2)


def callout(text, color=GREEN):
    t = Table([[P(text, CALLOUT)]], colWidths=[17 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F0F7F3")),
                ("BOX", (0, 0), (-1, -1), 1, color),
                ("LEFTPADDING", (0, 0), (-1, -1), 12),
                ("RIGHTPADDING", (0, 0), (-1, -1), 12),
                ("TOPPADDING", (0, 0), (-1, -1), 10),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 10),
            ]
        )
    )
    return t


def table(rows, widths, header=True, font_size=9):
    pstyle = ParagraphStyle(
        "TableCell",
        fontName="MSYH",
        fontSize=font_size,
        leading=font_size + 4,
        textColor=INK,
    )
    hstyle = ParagraphStyle(
        "TableHead",
        parent=pstyle,
        fontName="MSYH-Bold",
        textColor=GREEN_DEEP,
    )
    data = []
    for r_index, row in enumerate(rows):
        style = hstyle if header and r_index == 0 else pstyle
        data.append([Paragraph(str(cell), style) for cell in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    style_cmds = [
        ("GRID", (0, 0), (-1, -1), 0.45, LINE),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]
    if header:
        style_cmds += [
            ("BACKGROUND", (0, 0), (-1, 0), PAPER_DEEP),
            ("FONTNAME", (0, 0), (-1, 0), "MSYH-Bold"),
        ]
    for i in range(1 if header else 0, len(rows)):
        if i % 2 == 0:
            style_cmds.append(("BACKGROUND", (0, i), (-1, i), colors.HexColor("#FCFAF7")))
    t.setStyle(TableStyle(style_cmds))
    return t


def image(path, width=8.1 * cm, max_height=5.4 * cm):
    with PILImage.open(path) as src:
        source_width, source_height = src.size
    height = width * source_height / source_width
    if height > max_height:
        height = max_height
        width = height * source_width / source_height
    return Image(str(path), width=width, height=height)


def screenshot_pair(items):
    image_row = [image(path, width=7.7 * cm, max_height=5.0 * cm) for path, _ in items]
    caption_row = [P(caption, CAPTION) for _, caption in items]
    pair = Table([image_row, caption_row], colWidths=[8.2 * cm, 8.2 * cm], hAlign="LEFT")
    pair.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (0, 0), 0),
                ("RIGHTPADDING", (0, 0), (0, 0), 9),
                ("LEFTPADDING", (1, 0), (1, 0), 9),
                ("RIGHTPADDING", (1, 0), (1, 0), 0),
            ]
        )
    )
    return pair


def cover(title, subtitle, logo=True):
    story = [Spacer(1, 2.2 * cm)]
    if logo:
        story += [Image(str(BRAND / "mark-transparent-1024.png"), width=2.8 * cm, height=2.8 * cm)]
        story += [Spacer(1, 0.5 * cm)]
    story += [
        P("第十四届全国大学生数字媒体科技作品及创意竞赛", COVER_SUB),
        P(title, COVER_TITLE),
        P(subtitle, COVER_SUB),
        Spacer(1, 0.5 * cm),
    ]
    line = Table([[""]], colWidths=[17 * cm], rowHeights=[0.12 * cm])
    line.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), GREEN)]))
    story += [line, Spacer(1, 1.1 * cm)]
    story += [
        P("<b>参赛作品材料</b>　匿名评审版", BODY),
        P("作品名称：启核图策 NexcoreGraph", BODY),
        P("材料日期：2026 年 10 月", BODY),
        Spacer(1, 1.7 * cm),
        P("本文件不包含学校、团队成员、指导教师等身份信息。", BODY_SMALL),
    ]
    return story


def page_decor(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(PAPER)
    canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
    canvas.setFillColor(GREEN)
    canvas.rect(1.8 * cm, A4[1] - 1.45 * cm, 1.1 * cm, 0.12 * cm, fill=1, stroke=0)
    canvas.setFont("MSYH", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(1.8 * cm, A4[1] - 1.2 * cm, "启核图策 NexcoreGraph  ·  参赛材料")
    canvas.drawRightString(A4[0] - 1.8 * cm, 1.1 * cm, f"{canvas.getPageNumber():02d}")
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    canvas.line(1.8 * cm, 1.45 * cm, A4[0] - 1.8 * cm, 1.45 * cm)
    canvas.restoreState()


def build_pdf(filename, cover_title, cover_subtitle, story, logo=True):
    path = OUT / filename
    path.parent.mkdir(parents=True, exist_ok=True)
    doc = BaseDocTemplate(
        str(path),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.75 * cm,
        bottomMargin=1.65 * cm,
        title=cover_title,
        author="NexcoreGraph 参赛作品",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates(PageTemplate(id="main", frames=[frame], onPage=page_decor))
    doc.build(cover(cover_title, cover_subtitle, logo=logo) + [PageBreak()] + story)
    print(path)


def material_checklist():
    story = [
        H("一、材料组织说明"),
        P("本目录按照竞赛《参赛作品材料提交规范》的建议结构整理。可直接上传的内容、需在报名系统单独上传的内容，以及必须由本人或学校补充的内容已分开放置。"),
        callout("作品编号已确认为 402887。提交前仍需完成系统生成的承诺书、按需补充的学籍材料，以及评审账号或访问方式核验。"),
        Spacer(1, 0.25 * cm),
        H("二、官方材料清单与当前状态"),
        table(
            [
                ["序号", "材料", "当前状态", "位置 / 说明"],
                ["1", "参赛报名信息", "信息已核对，需官网确认", "按 00_报名系统填写文案 复制，并核对团队信息"],
                ["2", "参赛承诺书", "需系统生成并签章", "报名系统生成后放入 08_学籍证明等专项材料"],
                ["3", "作品截图", "已准备 10 张", "09_报名系统单独上传/作品截图"],
                ["4", "作品评审视频", "已准备", "09_报名系统单独上传/启核图策-作品评审视频.mp4"],
                ["5", "作品汇报 PPT", "已准备", "09_报名系统单独上传/启核图策-作品汇报PPT.pptx"],
                ["6", "参赛打包文件", "已准备", "上传《NexcoreGraph_第十四届数媒竞赛_参赛打包.zip》"],
                ["7", "作品及成果文件", "已准备", "01_作品及成果文件"],
                ["8", "作品展示视频", "已准备", "02_作品展示视频/功能操作版"],
                ["9", "作品介绍文档", "已准备 PDF", "03_作品介绍文档"],
                ["10", "运行或使用说明", "已准备 PDF", "04_运行或使用说明"],
                ["11", "补充成果材料", "已准备", "05_补充成果材料"],
                ["12", "第三方资源说明", "已准备 PDF", "06_第三方资源说明"],
                ["13", "AI 工具使用说明", "已准备 PDF", "07_AI工具使用补充说明"],
                ["14", "学籍证明等专项材料", "按专项赛要求补充", "08_学籍证明等专项材料"],
            ],
            [1.1 * cm, 3.5 * cm, 4.2 * cm, 8.2 * cm],
            font_size=8.4,
        ),
        Spacer(1, 0.35 * cm),
        H("三、目录结构"),
        P("00_提交前核对：材料清单、系统填写文案与最终检查。"),
        P("01_作品及成果文件：Windows 可运行安装包、三端源码、设计成果。"),
        P("02_作品展示视频：作品评审视频与功能操作展示视频。"),
        P("03_作品介绍文档：项目定位、创新点、实现方式、成果状态、原创贡献。"),
        P("04_运行或使用说明：安装、启动、演示顺序与故障排查。"),
        P("05_补充成果材料：性能与功能测试摘要、三端对照、工程证据。"),
        P("06_第三方资源说明：开源组件、字体、模型与素材来源。"),
        P("07_AI工具使用补充说明：工具、用途、人工筛选与最终成果。"),
        P("08_学籍证明等专项材料：按赛事和专项赛要求由本人补充。"),
        P("09_报名系统单独上传：报名系统按栏目上传的截图、视频和 PPT。"),
        H("四、提交前必须人工完成"),
        table(
            [
                ["检查项", "操作"],
                ["作品编号", "已确认为 402887；提交前再次核对官网显示值"],
                ["系统报名信息", "姓名、学校、指导教师等仅在官网系统填写，不写入评审材料"],
                ["承诺书", "从官网生成、核对、盖章并按要求上传"],
                ["测试账号或访问方式", "如报名系统要求，填写评审期间可用的账号或运行说明"],
                ["学籍证明", "仅国际专项等要求适用时提供"],
                ["最终上传", "文件上传成功不等于正式提交，须点击提交审核并观察状态"],
            ],
            [5.0 * cm, 12.0 * cm],
        ),
    ]
    build_pdf("00_提交前核对/参赛材料清单与提交前核对.pdf", "参赛材料清单与提交前核对", "材料结构、提交状态与人工补填事项", story)


def system_copy():
    story = [
        H("一、作品标题"),
        P("<b>启核图策 NexcoreGraph：面向家庭资源的可解释知识图谱与 AI 协作平台</b>"),
        H("二、作品简介"),
        P("启核图策面向家庭中食品、药品和日用品分散、临期难追踪、采购与消耗脱节的问题，构建了“拍照入库—资源图谱—AI 规划—家庭协作—临期提醒—执行核销”的完整闭环。作品包含 HarmonyOS、Web 用户端与管理端、微信小程序三端，并共享统一 REST 后端和同一套家庭事实。"),
        P("技术创新包括：端侧确定性构图与 GraphRAG 路径证据、受约束的 AI 工具协议、写操作预览确认机制、三端快照同步与版本冲突处理。回答中的数量、日期和价格来自代码事实，模型只做意图理解和表达，不直接修改数据。"),
        H("三、核心创新点"),
        P("<b>1. 私有资源图谱驱动回答。</b>物品、类别、位置、菜谱、方案和预警形成关系网络，支持 local、global 与 multi-hop 检索，回答可展示路径与来源。"),
        P("<b>2. AI 编排、代码定事实、用户授权。</b>模型调用收敛在受控网关；高频问题本地直答，写操作先生成确认卡，单次请求模型调用有上限。"),
        P("<b>3. 三端连续体验。</b>鸿蒙原生应用、Web 用户端与管理端、微信小程序共享业务语义，并采用快照版本和按 id 原地合并完成多端同步。"),
        H("四、应用价值"),
        P("作品适用于普通家庭、多人合住、家庭照护与小型共享空间。它降低了记录和维护成本，把库存信息推进为可解释、可执行的家庭决策，并支持局域网私有部署。"),
        H("五、原创贡献与 AI 使用"),
        P("核心功能、三端界面、GraphRAG 检索、AI 工具协议、测试与部署文档由参赛学生自主完成。生成式 AI 主要用于辅助视觉素材、文案组织和实现检索；所有 AI 输出均经学生筛选、修改、联调和实测，最终功能与数据链路以真实运行结果为准。"),
        H("六、系统填报可选短文案"),
        P("启核图策是一款面向家庭资源管理的可解释 AI 应用。它通过拍照识别、私有知识图谱和受控工具协议，把分散物品转化为可推理的家庭决策，并在鸿蒙、Web 与微信小程序之间保持实时协作。"),
    ]
    build_pdf("00_提交前核对/报名系统填写文案.pdf", "报名系统填写参考", "可直接核对后复制到官网系统，最终以系统字段限制为准", story)


def project_document():
    story = [
        H("一、项目定位"),
        P("启核图策不是单纯的库存记录工具，而是家庭资源的智能管理层。它回答的不只是“家里有什么”，还包括“什么时候会过期、和什么有关、能做什么、还缺什么、谁去执行”。"),
        P("目标用户包括家庭决策者、共同居住成员和需要照护的家庭。核心场景覆盖食品保质期、药品位置、日用品补充、菜谱规划、采购与家庭协作。"),
        callout("核心主张：AI 负责编排，代码负责事实，用户掌握写操作。"),
        H("二、完整闭环"),
        table(
            [
                ["步骤", "用户动作", "系统结果"],
                ["拍", "相机或相册上传", "压缩图片并发送视觉识别请求"],
                ["识", "查看候选结果", "名称、数量、位置、保质期等结构化字段"],
                ["存", "补缺并确认", "写入对应资源库，形成可信事实"],
                ["链", "自动建图", "物品、类别、菜谱、方案与采购形成关系"],
                ["算", "自然语言提问", "GraphRAG 装配带来源的路径证据"],
                ["提醒", "查看临期与影响", "给出优先级和下一步建议"],
                ["执行", "确认方案、采购或核销", "写回资源事实并保留日志"],
            ],
            [2.1 * cm, 6.0 * cm, 8.9 * cm],
        ),
        H("三、系统架构"),
        P("三端通过统一 REST 契约连接家庭事实层、AI 网关与图谱存储。端侧负责即时交互，服务端负责持久化、模型调用和权限控制，端侧不直接连接数据库。"),
        table(
            [
                ["层级", "组成", "职责"],
                ["客户端", "HarmonyOS / Web / 微信小程序", "拍照、资源库、AI、协作与设置"],
                ["接口层", "REST 契约与错误码", "统一账号、家庭、库存、图谱和同步语义"],
                ["服务层", "Node.js + Express", "鉴权、协作、同步、预警、图谱与用量"],
                ["AI 层", "受控网关与工具协议", "意图路由、证据装配、模型降级与预算"],
                ["数据层", "MySQL / 本地持久化", "家庭数据块、图谱节点边、快照与日志"],
            ],
            [3.0 * cm, 6.0 * cm, 8.0 * cm],
        ),
        PageBreak(),
        H("四、核心功能与真实界面"),
        P("以下均为真实界面截图，不包含演示占位数据。"),
        screenshot_pair(
            [
                (SHOTS / "02-ai-workbench.png", "AI 工作台：结论、待确认事项与库存摘要"),
                (SHOTS / "04-intake.png", "拍照入库：视觉识别与可编辑结果"),
            ]
        ),
        Spacer(1, 0.35 * cm),
        screenshot_pair(
            [
                (SHOTS / "05-libraries.png", "资源库：统一组织食品、药品与日用品"),
                (SHOTS / "06-graph.png", "资源知识图谱：路径与证据可追溯"),
            ]
        ),
        PageBreak(),
        H("五、关键创新"),
        P("<b>1. GraphRAG 证据装配。</b>端侧确定性构图不调用模型；查询阶段按问题选择 local、global 或 multi-hop。系统把节点、边、路径和来源提供给模型，数量与日期继续由代码裁决。"),
        P("<b>2. AI 写操作边界。</b>模型只能输出受约束的工具意图；覆盖 22 条常用自然语言操作，高频问题可 0 次模型调用直答。端侧先显示预览卡，用户确认后才执行。"),
        P("<b>3. 三端连续。</b>快照 DTO 同时服务本地持久化、备份和流转；按 revision 过滤变化，按 id 原地合并，旧版本写入触发冲突而不是静默覆盖。"),
        screenshot_pair(
            [
                (SHOTS / "03-dashboard.png", "数据看板：把差异转化为行动优先级"),
                (SHOTS / "07-workbench.png", "家庭协作：成员共享同一家庭事实"),
            ]
        ),
        PageBreak(),
        H("六、实测成果"),
        table(
            [
                ["指标", "实测结果", "说明"],
                ["后端接口", "40/40 通过", "认证、家庭、同步、协作、图谱、AI、用量与边界"],
                ["密码安全", "15/15 通过", "慢哈希、随机盐、锁定、防账号探测"],
                ["发布自检", "11/11 通过", "无密钥明文入库、构图 0 次模型调用等"],
                ["冰箱图识别", "2.3–2.9 秒 / 6–7 项", "真实视觉网关，端到端"],
                ["无关图片", "0.5–4.3 秒 / 0 项", "不伪造识别结果"],
                ["图谱构图", "32 节点 / 41 边 / 3 社区 / 66ms", "确定性端侧构图"],
                ["跨端同步", "7 秒内", "含 2 秒轮询间隔的双设备实测"],
                ["小程序构建", "66 文件 / 0.55MB", "微信 Taro 4 构建产物"],
            ],
            [4.0 * cm, 6.2 * cm, 6.8 * cm],
            font_size=8.6,
        ),
        H("七、安全与隐私"),
        P("密码使用 Node crypto.scrypt，参数 N=16384、r=8、p=1、keylen=64，单次约 16MB 内存；每个用户使用 16 字节随机盐，并以 timingSafeEqual 做定长比较。连续错误会触发锁定，账号不存在时也执行等量计算以降低账号探测风险。"),
        P("模型 Key 只驻服务端，不下发到客户端；三端客户端 Key 配置均保留。家庭数据优先留在局域网，聊天、偏好与图谱可设置为仅本地。"),
        screenshot_pair(
            [
                (SHOTS / "09-admin.png", "管理端：用户、家庭、审计、用量与图谱统计"),
                (SHOTS / "08-settings.png", "设置：服务器连接、备份、账号与隐私"),
            ]
        ),
        PageBreak(),
        H("八、完成状态与原创贡献"),
        table(
            [
                ["状态", "内容"],
                ["已完成", "三端主要流程、真实 AI 网关、资源库、图谱、预警、协作、同步、管理端、测试与部署说明"],
                ["正在完善", "订阅消息模板、部分平台侧能力与更丰富的家庭场景"],
                ["后续计划", "主动 Agent、家庭权限细化、更多设备协同与私有化部署增强"],
            ],
            [3.2 * cm, 13.8 * cm],
        ),
        H("学生原创贡献"),
        P("参赛学生自主完成需求定义、交互与视觉设计、三端实现、GraphRAG 检索链路、受控工具协议、测试用例、部署与答辩材料。生成式 AI 仅用于辅助视觉素材、文字组织和实现检索，输出经学生筛选、修改、联调和实测。"),
        H("九、应用价值"),
        P("家庭资源管理的真正价值不是多记几个字段，而是在有限预算和时间下减少浪费、降低重复购买、提升协作效率，并让每个建议都能解释来源。作品支持局域网私有部署，后续可迁移到公网服务或扩展为更完整的家庭智能层。"),
        callout("每一件东西都值得被理解；每一个决定，都应该有证据。"),
    ]
    build_pdf("03_作品介绍文档/启核图策-作品介绍文档.pdf", "启核图策 NexcoreGraph", "面向家庭资源的可解释知识图谱与 AI 协作平台", story)


def run_guide():
    story = [
        H("一、最快的运行方式：Windows 桌面版"),
        P("1. 解压本参赛包后，进入“01_作品及成果文件/可运行程序”。"),
        P("2. 双击“启核图策-Windows桌面版-安装程序.exe”并按提示安装。"),
        P("3. 第一次启动进入设置页。按页面提示填写 AI 服务配置；配置只保存在本机，不进入安装包。"),
        P("4. 完成邮箱验证码登录后即可进入 AI 工作台。桌面版内置 SQLite 本地服务，不要求预先安装 MySQL、Node.js 或 Python。"),
        callout("桌面版适合评委快速体验。真实三端联调、多人局域网协作与 GraphRAG 后端验证使用源码运行方式。"),
        H("二、源码运行：Web + 后端"),
        P("环境要求：Windows 10/11、Node.js 18+、MySQL 8、Python 3（仅用于静态 Web 服务）。修复源码解压目录后执行："),
        table(
            [
                ["步骤", "命令 / 操作", "成功标志"],
                ["1", "进入 harmonyosapp/NexcoreGraph_harmonyos/backend", "存在 server.js 与 .env.example"],
                ["2", "复制 .env.example 为 .env，填入自己的数据库与 AI 配置", ".env 不提交、不外发"],
                ["3", "powershell -ExecutionPolicy Bypass -File tools/start-lan.ps1", "后端 :3000 与流转 :3100 就绪"],
                ["4", "进入 web/NexcoreGraph_web，执行 start.bat", "Web 打开 :8090"],
                ["5", "访问 http://127.0.0.1:3000/api/health", "返回 ok=true 且 ai=ready"],
            ],
            [1.3 * cm, 10.2 * cm, 5.5 * cm],
            font_size=8.5,
        ),
        H("三、微信小程序与鸿蒙端"),
        P("<b>微信小程序：</b>在 wxminiapp/NexcoreGraph_wxminiapp 中安装依赖并执行 npm run build:weapp，然后用微信开发者工具导入 dist。API 域名必须加入微信合法域名；开发阶段可按开发者工具要求关闭域名校验。"),
        P("<b>鸿蒙端：</b>使用 DevEco Studio 打开 harmonyosapp/NexcoreGraph_harmonyos，等待依赖同步完成后运行 HAP。模拟器访问本机后端时使用 10.0.2.2:3000；真机使用同一局域网内的电脑 IP。"),
        H("四、演示顺序"),
        P("建议按“AI 工作台 → 拍照入库 → 用户确认 → 资源库 → 一句话操作 → 确认卡 → 图谱 → 看板预警 → 家庭协作 → 多端同步 → 管理端”的顺序演示。每一步停顿 1–2 秒，确保评委看清真实状态变化。"),
        PageBreak(),
        H("五、常见问题与处理"),
        table(
            [
                ["现象", "排查方法"],
                ["Web 显示无法连接后端", "先检查 http://127.0.0.1:3000/api/health；确认启动的是当前版本后端"],
                ["登录验证码收不到", "本地未配置 SMTP 时验证码打印在后端日志；生产环境需配置发信或短信通道"],
                ["摄像头或上传不可用", "使用 http://127.0.0.1:8090，不要直接双击 file:// 打开页面"],
                ["多端同步不动", "确认 flow-bridge.js 已在 3100 端口运行，并检查两端账号是否相同"],
                ["小程序请求失败", "检查服务器域名白名单、HTTPS 与运行环境网络"],
                ["鸿蒙模拟器无法连本机", "使用 10.0.2.2:3000；真机使用同一 WiFi 下的电脑局域网 IP"],
            ],
            [5.2 * cm, 11.8 * cm],
        ),
        H("六、文档与测试对应"),
        P("接口测试、密码安全测试、双设备同步、图谱性能和构建结果详见“05_补充成果材料/功能测试与性能结果摘要.pdf”。源码包不包含 .env、数据库密码或模型 Key。"),
        H("七、评审材料匿名说明"),
        P("运行说明、评审视频、PPT 与介绍文档均不包含学校、团队成员或指导教师身份信息。需要系统生成或本人签章的材料位于“08_学籍证明等专项材料”。"),
    ]
    build_pdf("04_运行或使用说明/启核图策-运行或使用说明.pdf", "运行或使用说明", "Windows 快速体验、三端源码启动与故障排查", story)


def test_summary():
    story = [
        H("一、验证范围"),
        P("测试覆盖后端接口、认证与密码安全、资源库、拍照识别、AI 对话、图谱、多端同步、协作池、管理端、Web 与鸿蒙界面流程，以及发布前检查。"),
        table(
            [
                ["项目", "结果", "说明"],
                ["后端接口", "40 / 40", "含 200、400、404、409 与数据库降级路径"],
                ["密码安全", "15 / 15", "scrypt、随机盐、定时比较、锁定、防探测"],
                ["发布前自检", "11 / 11", "含无密钥明文、构图 0 次模型调用等红线"],
                ["崩溃巡检", "无新增 jscrash", "鸿蒙模拟器整轮流程"],
            ],
            [3.2 * cm, 3.2 * cm, 10.6 * cm],
        ),
        H("二、关键性能结果"),
        table(
            [
                ["场景", "结果", "证据口径"],
                ["冰箱照片识别", "2.3–2.9 秒，6–7 项", "端到端，含上传"],
                ["无关图片", "0.5–4.3 秒，0 项", "模型明确返回空结果"],
                ["AI 对话", "0.9–3.0 秒", "主模型 503 时可自动降级"],
                ["图谱构图", "66ms", "32 节点、41 边、3 社区"],
                ["多端同步", "7 秒内", "手机与平板同账号双设备实测"],
                ["小程序构建", "66 文件，0.55MB", "Taro 4 微信构建产物"],
            ],
            [4.2 * cm, 5.2 * cm, 7.6 * cm],
        ),
        H("三、功能验证结论"),
        P("主链路已可运行：拍照入库、确认后写库、AI 自然语言操作、GraphRAG 证据回答、看板与预警、家庭协作、跨设备同步及管理端统计均能产生真实状态变化。失败场景有明确错误提示或降级路径，不返回伪造数据。"),
        H("四、已识别边界"),
        P("订阅消息、`msgSecCheck`、TTS 端点等平台侧能力需要额外凭据或正式账号配置；部分能力受元服务形态限制。上述边界在作品介绍与运行说明中均单独标明，不将后续计划描述为已完成。"),
        H("五、复现路径"),
        P("源码启动后依次运行接口自测、密码安全测试、发布前自检与双设备登录同步。具体命令以源码包内工程 README 和“运行或使用说明”为准。"),
    ]
    build_pdf("05_补充成果材料/功能测试与性能结果摘要.pdf", "功能测试与性能结果摘要", "可复现实测数据与已完成状态", story)


def third_party():
    story = [
        H("一、说明"),
        P("本项目使用了开源软件、字体、模型和生成式内容。下表列出主要资源的名称、来源、用途与许可状态。安装包与源码不包含第三方付费密钥或个人凭据。"),
        table(
            [
                ["资源", "类型", "来源", "用途", "许可 / 说明"],
                ["HarmonyOS / ArkTS / ArkUI", "开发框架", "华为开发者平台", "鸿蒙端", "遵循官方 SDK 许可"],
                ["Taro 4 / React 18", "开源框架", "npm / GitHub", "微信小程序", "MIT 等上游许可"],
                ["Node.js / Express / mysql2", "开源软件", "npm / GitHub", "后端与接口", "各包上游许可"],
                ["Qwen-Image-2.1", "本地生成模型", "阿里云 / Qwen", "视频辅助素材", "Qwen Research License；不主张商业权利"],
                ["HyperFrames / GSAP", "视频合成", "npm / GitHub", "片头、转场、渲染", "各包上游许可"],
                ["LXGW WenKai", "字体", "@fontsource/lxgw-wenkai", "视频字体", "SIL Open Font License"],
                ["Tabler Icons", "图标", "Tabler", "PPT 图标", "MIT"],
                ["Edge TTS", "语音合成", "Microsoft Edge TTS", "中文解说", "使用公开语音服务生成"],
            ],
            [4.0 * cm, 2.6 * cm, 3.8 * cm, 3.2 * cm, 3.4 * cm],
            font_size=8.2,
        ),
        H("二、项目自有素材"),
        P("产品截图、操作录屏、界面设计、品牌图标、GraphRAG 截图、测试日志与工程报告来自本项目自身运行成果。生成式素材只用于视频开场、关系示意与收尾，不替代真实产品界面。"),
        H("三、使用边界"),
        P("第三方组件与模型的最终使用应遵循其最新许可条款。若进行商业发布、上架或二次分发，应在发布前再次核对模型、字体、图标与语音服务条款。"),
    ]
    build_pdf("06_第三方资源说明/启核图策-第三方资源说明.pdf", "第三方资源说明", "开源组件、模型、字体与媒体来源", story)


def ai_usage():
    story = [
        H("一、AI 使用总则"),
        P("生成式 AI 用于辅助素材、文案组织和实现检索；核心产品逻辑、三端实现、测试与最终取舍由参赛学生完成。AI 生成内容在进入作品或材料前均经过人工筛选、修改和验证。"),
        table(
            [
                ["工具 / 模型", "使用环节", "输入", "输出与人工处理"],
                ["Qwen-Image-2.1（本地 ComfyUI）", "视频辅助素材", "手账风家庭资源场景描述", "生成 3 张无关键文字素材；人工检查并用作片头、图谱与收尾"],
                ["HyperFrames / GSAP", "视频合成", "分镜、真实录屏、生成素材", "生成转场、字幕层级与 MP4；人工逐帧检查"],
                ["Edge TTS", "中文解说", "审核后的分镜口播", "生成男声语音；人工试听、按画面节点排布"],
                ["生成式 AI 辅助写作", "材料组织", "项目事实、测试数据", "生成初稿；学生核对事实、删除夸大表述并统一口径"],
                ["生成式 AI 辅助编程", "实现与排查", "需求、报错、接口约束", "提供建议或代码片段；学生修改、运行测试并确认结果"],
            ],
            [4.0 * cm, 3.2 * cm, 4.0 * cm, 5.8 * cm],
            font_size=8.4,
        ),
        H("二、对作品功能的影响"),
        P("作品的 GraphRAG、工具协议、同步、资源库、权限与安全逻辑不是由生成式 AI 在运行时随意生成。系统内的 AI 回答受证据装配和工具白名单约束；数量、日期、价格等事实由代码读取，写操作必须由用户确认。"),
        H("三、版权与隐私"),
        P("提交材料不包含 API Key、数据库密码、个人邮箱授权码或第三方付费凭据。新闻性素材、第三方字体、图标与模型的来源和许可见“第三方资源说明”。AI 输出未用于伪造用户评价、实验结果或未实现的平台能力。"),
        callout("原则：AI 可以辅助表达和实现，但不能替代事实、运行结果与学生责任。"),
    ]
    build_pdf("07_AI工具使用补充说明/启核图策-AI工具使用情况补充说明.pdf", "AI 工具使用情况补充说明", "工具、用途、人工处理与原创贡献", story)


def identity_records():
    story = [
        H("一、承诺书信息确认"),
        table(
            [
                ["字段", "确认值"],
                ["作品编号", "402887"],
                ["作品名称", "启核图策"],
                ["作品分类", "移动与网络应用开发"],
                ["参赛赛道", "本科及以上学历赛道"],
                ["参赛院校", "广西师范大学"],
                ["指导教师", "刘鹏、张汝昌"],
                ["团队成员", "高俊杰、杨欢、罗渝川、张天杰、查豪霆"],
            ],
            [4.0 * cm, 13.0 * cm],
        ),
        callout("本页是内部核对记录，不是官网生成的正式承诺书。正式提交时必须使用报名系统生成的文件并按要求签章。"),
        H("二、团队成员与原创贡献核对"),
        P("下表依据项目内现有工程说明整理，仅用于报名核对；评审版作品介绍、PPT 和视频继续保持匿名。张天杰的具体分工在现有材料中无明确记录，请本人确认后补充。"),
        table(
            [
                ["成员", "现有材料中的主要工作", "确认状态"],
                ["高俊杰", "项目负责人；鸿蒙端、AI 网关端侧改造、分布式场景、整体集成与验收", "已有工程记录"],
                ["杨欢", "Web 与小程序工程架构、AI 对话与流式、Agent 工具链路、订阅消息与合规、整体验收", "已有工程记录"],
                ["罗渝川", "Codelabs 教程与截图、知识库检索测试、价值指标与测试用例、演示视频剪辑", "已有工程记录"],
                ["查豪霆", "管理端、看板、拍照链路前端、小程序页面、图表、测试与视觉回归", "已有工程记录"],
                ["张天杰", "待本人补充", "待确认"],
            ],
            [2.5 * cm, 12.1 * cm, 2.4 * cm],
            font_size=8.4,
        ),
        H("三、匿名评审边界"),
        P("以下身份信息只保留在“08_学籍证明等专项材料”中，不写入作品介绍、PPT、视频、截图或报名系统单独上传的评审材料。"),
        P("学校、指导教师和成员姓名如出现在旧版说明文档中，不应直接作为评审材料提交。报名系统需要填写身份信息的页面，按系统要求单独完成。"),
    ]
    build_pdf("08_学籍证明等专项材料/承诺书信息与团队贡献核对.pdf", "承诺书信息与团队贡献核对", "内部身份材料，不进入匿名评审稿", story)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    material_checklist()
    system_copy()
    project_document()
    run_guide()
    test_summary()
    third_party()
    ai_usage()
    identity_records()


if __name__ == "__main__":
    main()
