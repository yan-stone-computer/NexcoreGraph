#!/usr/bin/env python3
"""Build the concise HarmonyOS project-structure and deployment guide."""

from __future__ import annotations

from datetime import date
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / '项目结构与部署说明.docx'
ARCH_OVERVIEW = ROOT / 'docs' / 'images' / 'harmony-core-architecture@2x.png'
DEPLOY_TOPOLOGY = ROOT / 'docs' / 'images' / 'harmony-deployment-topology@2x.png'

FONT_BODY = 'Calibri'
FONT_CJK = 'Microsoft YaHei'
FONT_CODE = 'Consolas'
BLUE = '2E74B5'
BLUE_DARK = '1F4D78'
INK = '17231F'
MUTED = '5F7068'
RULE = 'D6DEEA'
TABLE_HEADER = 'E8EEF5'
CODE_FILL = 'F2F4F7'


def set_run_font(run, name: str = FONT_BODY, size: float | None = None,
                 color: str | None = None, bold: bool | None = None,
                 italic: bool | None = None) -> None:
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn('w:ascii'), name)
    run._element.get_or_add_rPr().rFonts.set(qn('w:hAnsi'), name)
    run._element.get_or_add_rPr().rFonts.set(qn('w:eastAsia'), FONT_CJK)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = RGBColor.from_string(color)
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def shade_paragraph(paragraph, fill: str) -> None:
    p_pr = paragraph._p.get_or_add_pPr()
    shd = OxmlElement('w:shd')
    shd.set(qn('w:fill'), fill)
    p_pr.append(shd)


def add_body(doc: Document, value: str, *, after: float = 6, bold_prefix: str = ''):
    paragraph = doc.add_paragraph(style='Normal')
    paragraph.paragraph_format.space_after = Pt(after)
    paragraph.paragraph_format.line_spacing = 1.25
    if bold_prefix and value.startswith(bold_prefix):
        first = paragraph.add_run(bold_prefix)
        set_run_font(first, size=11, color=INK, bold=True)
        rest = paragraph.add_run(value[len(bold_prefix):])
        set_run_font(rest, size=11, color=INK)
    else:
        run = paragraph.add_run(value)
        set_run_font(run, size=11, color=INK)
    return paragraph


def add_code(doc: Document, lines: list[str]) -> None:
    for line in lines:
        paragraph = doc.add_paragraph()
        paragraph.paragraph_format.space_before = Pt(0)
        paragraph.paragraph_format.space_after = Pt(0)
        paragraph.paragraph_format.left_indent = Inches(0.12)
        paragraph.paragraph_format.right_indent = Inches(0.08)
        paragraph.paragraph_format.line_spacing = 1.0
        run = paragraph.add_run(line if line else ' ')
        set_run_font(run, name=FONT_CODE, size=9, color=INK)
        shade_paragraph(paragraph, CODE_FILL)


def set_cell_width(cell, width_dxa: int) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn('w:tcW'))
    if tc_w is None:
        tc_w = OxmlElement('w:tcW')
        tc_pr.append(tc_w)
    tc_w.set(qn('w:w'), str(width_dxa))
    tc_w.set(qn('w:type'), 'dxa')


def set_cell_shading(cell, fill: str) -> None:
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn('w:shd'))
    if shd is None:
        shd = OxmlElement('w:shd')
        tc_pr.append(shd)
    shd.set(qn('w:fill'), fill)


def set_cell_margins(table, top: int = 80, bottom: int = 80, start: int = 120, end: int = 120) -> None:
    tbl_pr = table._tbl.tblPr
    mar = tbl_pr.find(qn('w:tblCellMar'))
    if mar is None:
        mar = OxmlElement('w:tblCellMar')
        tbl_pr.append(mar)
    for key, value in (('top', top), ('bottom', bottom), ('start', start), ('end', end)):
        node = mar.find(qn(f'w:{key}'))
        if node is None:
            node = OxmlElement(f'w:{key}')
            mar.append(node)
        node.set(qn('w:w'), str(value))
        node.set(qn('w:type'), 'dxa')


def add_table(doc: Document, headers: list[str], rows: list[list[str]],
              widths_in: list[float], font_size: float = 9.2):
    table = doc.add_table(rows=1, cols=len(headers))
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    table.autofit = False

    total_dxa = round(sum(widths_in) * 1440)
    table._tbl.tblPr.find(qn('w:tblW')).set(qn('w:w'), str(total_dxa))
    table._tbl.tblPr.find(qn('w:tblW')).set(qn('w:type'), 'dxa')
    tbl_ind = OxmlElement('w:tblInd')
    tbl_ind.set(qn('w:w'), '120')
    tbl_ind.set(qn('w:type'), 'dxa')
    table._tbl.tblPr.append(tbl_ind)
    layout = OxmlElement('w:tblLayout')
    layout.set(qn('w:type'), 'fixed')
    table._tbl.tblPr.append(layout)
    set_cell_margins(table)

    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths_in:
        col = OxmlElement('w:gridCol')
        col.set(qn('w:w'), str(round(width * 1440)))
        grid.append(col)

    for i, header in enumerate(headers):
        cell = table.rows[0].cells[i]
        set_cell_width(cell, round(widths_in[i] * 1440))
        set_cell_shading(cell, TABLE_HEADER)
        cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
        paragraph = cell.paragraphs[0]
        paragraph.paragraph_format.space_after = Pt(0)
        run = paragraph.add_run(header)
        set_run_font(run, size=font_size, color=INK, bold=True)

    header_props = table.rows[0]._tr.get_or_add_trPr()
    header_props.append(OxmlElement('w:tblHeader'))

    for values in rows:
        cells = table.add_row().cells
        for i, value in enumerate(values):
            set_cell_width(cells[i], round(widths_in[i] * 1440))
            cells[i].vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            paragraph = cells[i].paragraphs[0]
            paragraph.paragraph_format.space_after = Pt(0)
            paragraph.paragraph_format.line_spacing = 1.05
            run = paragraph.add_run(value)
            set_run_font(run, size=font_size, color=INK)
    doc.add_paragraph().paragraph_format.space_after = Pt(0)
    return table


def add_heading(doc: Document, text: str, level: int):
    paragraph = doc.add_paragraph(text, style=f'Heading {level}')
    paragraph.paragraph_format.keep_with_next = True
    return paragraph


def add_caption(doc: Document, number: str, value: str) -> None:
    paragraph = doc.add_paragraph()
    paragraph.paragraph_format.space_before = Pt(2)
    paragraph.paragraph_format.space_after = Pt(8)
    paragraph.paragraph_format.keep_together = True
    run = paragraph.add_run(number)
    set_run_font(run, size=9.2, color=INK, bold=True)
    rest = paragraph.add_run(' ' + value)
    set_run_font(rest, size=9.2, color=MUTED)


def add_figure(doc: Document, path: Path, width_cm: float, height_cm: float,
               title: str, description: str) -> None:
    paragraph = doc.add_paragraph()
    paragraph.alignment = WD_ALIGN_PARAGRAPH.CENTER
    paragraph.paragraph_format.space_before = Pt(4)
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.keep_with_next = True
    shape = paragraph.add_run().add_picture(str(path), width=Cm(width_cm), height=Cm(height_cm))
    shape._inline.docPr.set('title', title)
    shape._inline.docPr.set('descr', description)


def add_page_number(paragraph) -> None:
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    prefix = paragraph.add_run('Page ')
    set_run_font(prefix, size=8.5, color=MUTED)
    field = OxmlElement('w:fldSimple')
    field.set(qn('w:instr'), 'PAGE')
    run = OxmlElement('w:r')
    text = OxmlElement('w:t')
    text.text = '1'
    run.append(text)
    field.append(run)
    paragraph._p.append(field)


def add_header_footer(doc: Document) -> None:
    section = doc.sections[0]
    header = section.header
    paragraph = header.paragraphs[0]
    paragraph.paragraph_format.space_after = Pt(4)
    paragraph.paragraph_format.tab_stops.add_tab_stop(Inches(6.5), alignment=2)
    left = paragraph.add_run('启核图策 NexcoreGraph  ·  项目结构与部署说明')
    set_run_font(left, size=8.5, color=MUTED)
    p_pr = paragraph._p.get_or_add_pPr()
    borders = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')
    bottom.set(qn('w:sz'), '4')
    bottom.set(qn('w:space'), '4')
    bottom.set(qn('w:color'), RULE)
    borders.append(bottom)
    p_pr.append(borders)
    add_page_number(section.footer.paragraphs[0])


def configure_styles(doc: Document) -> None:
    normal = doc.styles['Normal']
    normal.font.name = FONT_BODY
    normal._element.rPr.rFonts.set(qn('w:eastAsia'), FONT_CJK)
    normal.font.size = Pt(11)
    normal.font.color.rgb = RGBColor.from_string(INK)

    settings = {
        'Heading 1': (16, BLUE, 18, 10),
        'Heading 2': (13, BLUE, 14, 7),
        'Heading 3': (12, BLUE_DARK, 10, 5),
    }
    for name, (size, color, before, after) in settings.items():
        style = doc.styles[name]
        style.font.name = FONT_BODY
        style._element.rPr.rFonts.set(qn('w:eastAsia'), FONT_CJK)
        style.font.size = Pt(size)
        style.font.color.rgb = RGBColor.from_string(color)
        style.font.bold = True
        paragraph_format = style.paragraph_format
        paragraph_format.space_before = Pt(before)
        paragraph_format.space_after = Pt(after)
        paragraph_format.keep_with_next = True


def main() -> None:
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.right_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)
    configure_styles(doc)
    add_header_footer(doc)

    # Technical-document title block.
    kicker = doc.add_paragraph()
    kicker.paragraph_format.space_before = Pt(24)
    kicker.paragraph_format.space_after = Pt(8)
    run = kicker.add_run('TECHNICAL DOCUMENT')
    set_run_font(run, size=10, color='2F7F43', bold=True)

    title = doc.add_paragraph()
    title.paragraph_format.space_before = Pt(0)
    title.paragraph_format.space_after = Pt(8)
    run = title.add_run('启核图策 NexcoreGraph')
    set_run_font(run, size=28, color=INK, bold=True)

    subtitle = doc.add_paragraph()
    subtitle.paragraph_format.space_after = Pt(24)
    run = subtitle.add_run('鸿蒙端项目结构与部署说明')
    set_run_font(run, size=16, color=BLUE_DARK, bold=False)

    add_table(
        doc,
        ['项目', '内容'],
        [
            ['文档范围', '代码项目结构、运行关系、环境配置与本地部署'],
            ['客户端', 'HarmonyOS NEXT / ArkTS / ArkUI / Stage 模型'],
            ['服务端', 'Node.js + Express + MySQL'],
            ['工程入口', 'harmonyosapp/NexcoreGraph_harmonyos'],
            ['文档版本', date(2026, 10, 29).isoformat()],
        ],
        [1.45, 5.05],
        9.8,
    )
    note = doc.add_paragraph()
    note.paragraph_format.space_before = Pt(8)
    note.paragraph_format.space_after = Pt(0)
    note.paragraph_format.left_indent = Inches(0.12)
    shade_paragraph(note, 'EDF6EF')
    run = note.add_run('说明：本文件只描述项目如何组织、如何运行和如何部署，不包含产品宣传、比赛故事或界面讲解。')
    set_run_font(run, size=10.5, color='1F6031')
    doc.add_page_break()

    add_heading(doc, '1  文档范围与代码基线', 1)
    add_body(
        doc,
        '本文以当前 HarmonyOS 工程和后端代码为准，给出可直接用于交接、复现和部署的工程说明。'
        '阅读对象是能够使用 DevEco Studio、Node.js 和 MySQL 的开发者或验收人员。',
    )
    add_table(
        doc,
        ['项目', '当前实现'],
        [
            ['HarmonyOS', 'API 23 / Stage 模型 / atomicService；手机、平板、2in1，compact 档使用 WatchShell'],
            ['客户端', 'ArkTS + ArkUI；页面、业务服务、本地存储和同步均位于 entry 模块'],
            ['后端', 'Express 服务默认监听 0.0.0.0:3000；同一目录包含图谱服务与邮件模块'],
            ['数据', 'MySQL 默认 127.0.0.1:3307，数据库名 tianshu；服务启动时幂等建表并迁移'],
            ['流转', '独立 flow-bridge.js 默认监听 0.0.0.0:3100，使用本地 JSON 保存最新记录'],
        ],
        [1.45, 5.05],
        9.4,
    )

    add_heading(doc, '2  代码项目结构', 1)
    add_heading(doc, '2.1  工程根目录', 2)
    add_code(doc, [
        'NexcoreGraph_harmonyos/',
        '├─ AppScope/                     # 应用级配置与公共资源',
        '├─ entry/',
        '│  ├─ src/main/ets/',
        '│  │  ├─ entryability/           # UIAbility 生命周期、接续、卡片参数',
        '│  │  ├─ entryformability/       # FormExtensionAbility 服务卡片',
        '│  │  ├─ pages/                  # 页面、浮层与 AI 工作台',
        '│  │  ├─ components/             # 通用 ArkUI 组件',
        '│  │  └─ common/                 # 网络、路由、图谱、存储与同步',
        '│  └─ src/main/resources/        # 页面资源与 rawfile 知识库',
        '├─ backend/                      # Node.js + Express + MySQL 服务',
        '├─ knowledge/                    # 食材、菜谱、存储规则与来源',
        '├─ docs/                         # Codelab 与工程说明',
        '├─ tools/                        # 构建、局域网启动和发布检查脚本',
        '├─ build-profile.json5',
        '├─ oh-package.json5',
        '└─ hvigorfile.ts',
    ])
    doc.add_page_break()

    add_heading(doc, '2.2  鸿蒙客户端模块职责', 2)
    add_table(
        doc,
        ['路径', '职责'],
        [
            ['entryability/EntryAbility.ets', '应用启动、卡片 target 路由、onContinue 接续、后台刷新服务卡片'],
            ['entryformability/EntryFormAbility.ets', '服务卡片添加/刷新；优先读取 formSnapshot'],
            ['pages/Index.ets', '登录分流、响应式布局、NavRail、Tabs、AI 面板停靠'],
            ['pages/Overlays.ets', '入库、资源库、计划、预警、采购、设置等浮层与交互'],
            ['pages/AiPanel.ets / AiWorkbench.ets', 'AI 对话、工具确认、计划生成和结果展示'],
            ['components/Widgets.ets', '通用按钮、卡片、输入框等 UI 组件'],
            ['common/Backend.ets', '健康探测、服务地址选择与 JSON HTTP 请求'],
            ['common/AiGateway.ets', 'AI 客户端、证据装配、工具行解析与用量上报'],
            ['common/Commands.ets / Router.ets', '本地命令、意图路由、零模型快答与证据行'],
            ['common/KnowledgeIndex.ets', 'rawfile 知识库索引、查询、规则与来源'],
            ['common/Graph*.ets', '图谱模型、确定性构建、持久化与 GraphRAG 查询'],
            ['common/Store.ets / LocalStore.ets / Db.ets', '全局状态、Preferences 持久化与领域对象'],
            ['common/SyncApi.ets / LiveSync.ets / FlowBridge.ets', '云端快照、跨端轮询和局域网流转'],
            ['common/Continuation.ets', '页面、业务数据和快照的序列化/恢复'],
            ['common/Tokens.ets / Icons.ets', '主题令牌与图标资源'],
        ],
        [2.25, 4.25],
        8.8,
    )
    doc.add_page_break()

    add_heading(doc, '2.3  后端代码职责', 2)
    add_table(
        doc,
        ['文件', '职责'],
        [
            ['server.js', 'Express 路由、鉴权、家庭与协作、同步、AI 网关、图谱 API、启动迁移'],
            ['graphBuild.js', '基于家庭业务数据构建后端图谱'],
            ['graphQuery.js', 'local / global / multi-hop 图谱证据查询'],
            ['graphService.js', '图谱节点、边、社区、摘要和版本的服务层'],
            ['flow-bridge.js', '3100 端口跨设备流转中转；不连接 MySQL'],
            ['mailer.js', 'SMTP 验证码邮件'],
            ['package.json / package-lock.json', 'Express 与 mysql2 依赖及启动入口'],
        ],
        [2.0, 4.5],
        9.0,
    )

    add_heading(doc, '2.4  资源、配置与构建产物', 2)
    add_table(
        doc,
        ['项目', '说明'],
        [
            ['entry/src/main/resources/rawfile/knowledge/', '随包知识库：foods、recipes、storage-rules、sources'],
            ['entry/src/main/module.json5', 'Ability、FormExtension、权限和页面配置'],
            ['build-profile.json5 / oh-package.json5', 'API、签名、产品与依赖配置'],
            ['tools/build.ps1 / build.bat / build.sh', '定位 DevEco SDK 并执行 assembleHap'],
            ['entry-default-unsigned.hap', '已生成构建产物；真机安装前需在 DevEco Studio 中签名'],
        ],
        [2.25, 4.25],
        9.0,
    )

    doc.add_page_break()
    add_heading(doc, '3  运行架构', 1)
    add_body(
        doc,
        '客户端负责页面、本地状态、意图路由、端侧图谱和证据装配；自建后端负责鉴权、权威快照、'
        'AI 受控网关和后端图谱；流转中转只处理局域网内最新流程记录。',
    )
    add_figure(
        doc,
        ARCH_OVERVIEW,
        15.2,
        12.59,
        '启核图策核心架构',
        'HarmonyOS 客户端、自建后端、flow-bridge、MySQL 与外部能力之间的代码级架构。',
    )
    add_caption(doc, '图 3-1', '运行架构总览。端侧问答使用 GraphQuery.ragEvidence 生成证据后再调用 AI 网关；当前客户端不直接调用 /api/graph/*。')
    add_body(
        doc,
        '数据路径分为三条：本地状态由 Store 与 Preferences 管理；账号数据经 /api/sync/* 进行版本化同步；'
        '跨设备实时流程经 flow-bridge 的 /api/flow/* 传播。图谱由 GraphBuild 确定性生成，'
        'GraphStore 单独保存 graphDoc，不进入账号快照 payload。',
    )

    doc.add_page_break()
    add_heading(doc, '4  部署实现', 1)
    add_body(
        doc,
        '推荐采用同局域网自建部署：HarmonyOS 应用运行在手机、平板或模拟器上，'
        'API 服务、流转中转和 MySQL 运行在同一台开发电脑。',
    )
    add_figure(
        doc,
        DEPLOY_TOPOLOGY,
        15.2,
        8.25,
        '部署实现拓扑',
        'HarmonyOS 设备通过局域网访问 3000 API 与 3100 流转中转，Express 服务访问 MySQL 和可选外部服务。',
    )
    add_caption(doc, '图 4-1', '部署拓扑。设备端先解析服务地址；API 与流转中转分别使用 3000、3100 端口。')

    add_heading(doc, '4.1  运行组件、端口与通信路径', 2)
    add_table(
        doc,
        ['组件', '默认地址', '用途'],
        [
            ['HarmonyOS 应用', '设备本机', 'UI、离线状态、端侧图谱、请求发起与结果展示'],
            ['Express API', '0.0.0.0:3000', '/api/health、/api/auth/*、/api/sync/*、/api/ai/*、/api/graph/*'],
            ['flow-bridge', '0.0.0.0:3100', '/api/flow/publish、/api/flow/latest、/api/health'],
            ['MySQL', '127.0.0.1:3307', '账号、家庭、同步快照、日志、AI 用量与图谱数据'],
            ['外部 AI', 'AGNES_BASE_URL', '由后端调用；客户端不持有厂商 Key'],
            ['SMTP', 'MAIL_HOST/MAIL_PORT', '邮箱验证码；未配置时不阻断其他功能'],
        ],
        [1.45, 1.75, 3.3],
        8.8,
    )
    doc.add_page_break()

    add_heading(doc, '4.2  服务端环境变量', 2)
    add_table(
        doc,
        ['变量', '用途 / 部署要求'],
        [
            ['PORT', 'Express 监听端口，默认 3000'],
            ['DB_HOST / DB_PORT / DB_NAME', 'MySQL 主机、端口和数据库名；默认 127.0.0.1、3307、tianshu'],
            ['DB_USER / DB_PASSWORD', '数据库账号；部署时必须显式设置强密码'],
            ['AGNES_API_KEY / AGNES_BASE_URL / AGNES_MODEL', 'AI 网关上游配置；未配置 Key 时 AI 接口返回 503'],
            ['AI_TIMEOUT_MS / AI_RPM', '上游超时与家庭级每分钟限流'],
            ['MAIL_HOST / MAIL_PORT / MAIL_USER / MAIL_PASS', 'SMTP 验证码；MAIL_PASS 填写邮箱授权码'],
            ['AUTH_SHOW_CODE', '仅本地调试可设 1；生产环境不得开启'],
            ['FLOW_PORT', '流转中转端口，默认 3100'],
        ],
        [2.25, 4.25],
        8.8,
    )

    add_heading(doc, '4.3  MySQL 与后端服务', 2)
    add_body(
        doc,
        '创建使用 utf8mb4 的数据库后启动后端；server.js 的 initDb() 会幂等创建业务表并执行兼容迁移，'
        '因此不需要手工维护 SQL 初始化脚本。',
    )
    add_code(doc, [
        'cd NexcoreGraph_harmonyos/backend',
        'Copy-Item .env.example .env',
        '# 编辑 .env，至少配置 DB_*；需要 AI 时配置 AGNES_API_KEY',
        'npm install',
        'npm start',
    ])
    add_body(
        doc,
        '启动完成后访问 http://127.0.0.1:3000/api/health。健康检查应返回 service="nexcoregraph-backend"，'
        '并同时报告局域网 IPv4、AI 是否已配置和 lan-self-hosted 部署模式。',
    )

    add_heading(doc, '4.4  启动流转中转', 2)
    add_body(
        doc,
        'flow-bridge 与 MySQL、Express 进程相互独立，主要服务模拟器或同网设备实时流转。'
        '首次运行会在 backend 目录生成 flow-bridge.json；该文件是运行状态，不进入源码包。',
    )
    add_code(doc, [
        'cd NexcoreGraph_harmonyos/backend',
        'node flow-bridge.js',
        '# 健康检查',
        'Invoke-RestMethod http://127.0.0.1:3100/api/health',
    ])

    add_heading(doc, '4.5  构建并安装 HarmonyOS 应用', 2)
    add_body(
        doc,
        '使用 DevEco Studio 打开 NexcoreGraph_harmonyos 工程，等待 ohpm/SDK 同步后选择目标设备运行。'
        '命令行构建可执行 tools/build.ps1；需要安装到真机时，应先在 DevEco Studio 配置签名。',
    )
    add_code(doc, [
        'DevEco Studio -> Open -> harmonyosapp/NexcoreGraph_harmonyos',
        'Tools -> SDK Manager -> HarmonyOS SDK (API 23)',
        'Run -> 选择 Phone / Tablet / 2in1',
        '',
        '# 或在工程根目录执行',
        'pwsh -File tools/build.ps1 -Task assembleHap',
    ])
    add_body(
        doc,
        '构建输出位于 entry/build/default/outputs/default/entry-default-unsigned.hap。'
        '未签名 HAP 仅作为构建证据，不应直接作为真机安装包提交。',
    )

    add_heading(doc, '4.6  设备网络与地址配置', 2)
    add_body(
        doc,
        '模拟器通常使用 10.0.2.2 访问宿主机。真机需要与电脑处于同一 WiFi/局域网，'
        '并在电脑防火墙放行 TCP 3000 与 TCP 3100；随后在应用的“我的 → 服务器连接”中填写电脑局域网地址。',
    )
    add_table(
        doc,
        ['场景', '应用应填写的地址'],
        [
            ['HarmonyOS 模拟器访问宿主机', 'http://10.0.2.2:3000'],
            ['真机与电脑同一 WiFi', 'http://电脑局域网 IPv4:3000'],
            ['客户端与后端同机预览', 'http://127.0.0.1:3000'],
        ],
        [2.3, 4.2],
        9.2,
    )
    add_body(
        doc,
        '客户端会通过 /api/health 验证候选项后才缓存服务地址。修改地址后无需重新打包。'
        '3100 流转中转不可用时，云端快照同步仍可工作，但跨设备实时流转会降级。',
    )

    doc.add_page_break()
    add_heading(doc, '5  部署验收', 1)
    add_table(
        doc,
        ['检查项', '通过标准'],
        [
            ['API 服务', 'http://127.0.0.1:3000/api/health 返回 200 和 lan-self-hosted'],
            ['数据库', '服务启动无连接错误；initDb 完成建表和迁移'],
            ['流转中转', 'http://127.0.0.1:3100/api/health 返回 nexcore-flow-bridge'],
            ['客户端', 'DevEco Studio 同步、编译成功；HAP 生成'],
            ['设备连通', '应用能显示后端地址并完成登录/同步'],
            ['AI', '配置 AGNES_API_KEY 后对话和视觉接口可用；未配置时本地快答仍可用'],
            ['提交安全', '压缩包不包含 .env、数据库、node_modules 或运行缓存'],
        ],
        [1.75, 4.75],
        9.1,
    )

    add_heading(doc, '6  常见部署问题', 1)
    add_table(
        doc,
        ['现象', '排查'],
        [
            ['客户端找不到服务', '确认同网段、电脑 IPv4 地址、防火墙 3000 端口和手动服务器地址'],
            ['后端启动时报数据库错误', '检查 MySQL 是否运行、DB_PORT/DB_NAME/账号密码是否正确'],
            ['AI 接口返回 503', '服务端未配置 AGNES_API_KEY；本地命令和快答不依赖该 Key'],
            ['实时流转不可用', '检查 3100 端口、flow-bridge 进程和防火墙；云端同步可独立使用'],
            ['真机无法安装 HAP', '在 DevEco Studio 配置签名后重新构建，不要直接安装 unsigned HAP'],
        ],
        [2.0, 4.5],
        9.0,
    )

    add_heading(doc, '7  提交包目录', 1)
    add_code(doc, [
        '启核图策-鸿蒙端-完整作品文件/',
        '├─ 源代码/',
        '│  ├─ NexcoreGraph_harmonyos/    # 客户端与后端源码',
        '│  └─ 构建产物/                  # entry-default-unsigned.hap',
        '└─ 项目文档/',
        '   ├─ 项目结构与部署说明.docx',
        '   ├─ 项目结构与部署说明.pdf',
        '   └─ 架构图/                    # SVG 与 PNG 源文件',
    ])

    OUT.parent.mkdir(parents=True, exist_ok=True)
    doc.save(OUT)
    print(OUT)


if __name__ == '__main__':
    main()
