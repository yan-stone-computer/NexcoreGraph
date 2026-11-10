# -*- coding: utf-8 -*-
"""Build the standalone deployment and operations runbook."""
from __future__ import annotations

from pathlib import Path

from docx import Document
from docx.enum.section import WD_ORIENT
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Inches, Pt, RGBColor
from PIL import Image

import build_works_intro_doc as core


ROOT = Path(__file__).resolve().parents[1]
PKG = ROOT / "deliverables" / "传智杯_启核图策_小程序端"
DEPLOY = PKG / "09_部署与运行"
OUT_DOCX = DEPLOY / "启核图策-部署与运行手册.docx"
OUT_PDF = DEPLOY / "启核图策-部署与运行手册.pdf"
TOPOLOGY = DEPLOY / "图示" / "deployment-topology.png"
DEVTOOLS = PKG / "06_作品介绍文档" / "截图" / "11_小程序模拟器验收.png"


def render_jpeg(source: Path, name: str, cache: Path) -> Path:
    """Use a renderer-safe image copy without changing the source screenshots."""
    target = cache / f"{name}.jpg"
    with Image.open(source) as image:
        rgba = image.convert("RGBA")
        canvas = Image.new("RGB", rgba.size, "white")
        canvas.paste(rgba, mask=rgba.getchannel("A"))
        canvas.save(target, "JPEG", quality=95, optimize=True)
    return target


def add_code(doc: Document, lines: list[str]) -> None:
    table = doc.add_table(rows=1, cols=1)
    core.set_table_geometry(table, [6.65], indent_dxa=0)
    cell = table.cell(0, 0)
    core.set_cell_shading(cell, "F3F6F4")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        core.set_cell_border(cell, **{edge: {"val": "single", "sz": "4", "color": "D8E2DC"}})
    p = cell.paragraphs[0]
    p.paragraph_format.space_after = Pt(0)
    p.paragraph_format.line_spacing = 1.08
    for index, line in enumerate(lines):
        run = p.add_run(line)
        core.apply_font(run, 8.2, False, "26342D", "Cascadia Mono")
        if index < len(lines) - 1:
            run.add_break()
    doc.add_paragraph().paragraph_format.space_after = Pt(0)


def add_step_heading(doc: Document, value: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(4)
    p.paragraph_format.keep_with_next = True
    core.add_run(p, value, 12.5, True, core.GREEN_DARK)


def add_note(doc: Document, label: str, value: str, kind: str = "note") -> None:
    colors = {
        "note": (core.PALE_TEAL, "169B99"),
        "warn": ("FFF1DE", "B87D16"),
        "ok": (core.PALE_GREEN, core.GREEN),
    }
    fill, accent = colors[kind]
    core.add_callout(doc, label, value, fill=fill, accent=accent)


def add_link_line(doc: Document, label: str, value: str) -> None:
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(3)
    core.add_run(p, label + "：", 9.5, True, core.GREEN_DARK)
    core.add_run(p, value, 9.5, False, core.INK, "Cascadia Mono")


def build() -> None:
    DEPLOY.mkdir(parents=True, exist_ok=True)
    image_cache = DEPLOY / "_work" / "render_inputs"
    image_cache.mkdir(parents=True, exist_ok=True)
    logo = render_jpeg(ROOT / "docs" / "brand" / "mark-transparent-1024.png", "brand-mark", image_cache)
    topology = render_jpeg(TOPOLOGY, "deployment-topology", image_cache)
    devtools = render_jpeg(DEVTOOLS, "wechat-devtools", image_cache)

    doc = Document()
    core.setup_styles(doc)

    section = doc.sections[0]
    section.orientation = WD_ORIENT.PORTRAIT
    section.page_width = Cm(21)
    section.page_height = Cm(29.7)
    section.top_margin = Cm(1.7)
    section.bottom_margin = Cm(1.55)
    section.left_margin = Cm(1.85)
    section.right_margin = Cm(1.85)
    core.setup_running_furniture(section)
    header_run = section.header.paragraphs[0].runs
    if header_run:
        header_run[0].text = "启核图策 NexcoreGraph  /  部署与运行"

    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(10)
    p.paragraph_format.space_after = Pt(16)
    p.add_run().add_picture(str(logo), width=Inches(0.64))
    core.add_kicker(doc, "技术交付 · 部署与运行手册")
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(26)
    p.paragraph_format.space_after = Pt(6)
    core.add_run(p, "从收到压缩包，", 30, True, core.INK)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(8)
    core.add_run(p, "到完成一次完整演示", 30, True, core.GREEN_DARK)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(14)
    core.add_run(p, "启核图策 NexcoreGraph  /  微信小程序端", 14, False, core.MUTED)
    p = doc.add_paragraph()
    p.paragraph_format.space_after = Pt(14)
    core.add_run(
        p,
        "面向评委、评审助教和首次部署人员。所需源码、预构建 Demo、后端、配置模板与验证脚本均在本参赛包内。",
        11,
        False,
        core.INK,
    )
    core.add_metric_strip(
        doc,
        [
            ("20–40 min", "首次部署"),
            ("3 个端口", "3000 / 3100 / 3307"),
            ("Node 18+", "后端运行环境"),
            ("MySQL 8.x", "工作区权威存储"),
        ],
    )
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(26)
    p.paragraph_format.space_after = Pt(0)
    core.add_run(p, "天枢序列小程序 · 团队编号 38378  /  2026-10-25  /  v1.1", 8.5, False, core.MUTED)

    doc.add_page_break()
    core.add_kicker(doc, "最短启动")
    core.add_heading(doc, "最短启动路径", 2)
    for index, item in enumerate(
        [
            "安装 Node.js、MySQL 8.x、微信开发者工具。",
            "创建 MySQL 数据库 tianshu。",
            "复制后端 .env.example 为 .env，填写数据库和可选的 Agnes Key。",
            "运行后端目录里的 start-all.cmd。",
            "在微信开发者工具导入小程序Demo，登录并完成自检。",
        ],
        1,
    ):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.35)
        p.paragraph_format.space_after = Pt(3)
        core.add_run(p, f"{index:02d}  ", 10, True, core.GREEN)
        core.add_run(p, item, 10.5, False, core.INK)
    add_step_heading(doc, "路径约定")
    core.add_body(
        doc,
        "本手册以参赛包根目录为起点，所有相对路径都从该目录进入。Windows 用户使用 PowerShell；"
        "若命令提示“无法加载脚本”，可改用文中给出的 node 直接启动命令。"
    )
    add_note(
        doc,
        "交付原则",
        "AI Key 不属于源码，压缩包不附带任何有效密钥。评阅 AI 识别与问答时，请使用自己的 Agnes Key，或由项目组在演示现场配置。",
    )

    doc.add_page_break()
    core.add_kicker(doc, "部署目标")
    core.add_heading(doc, "先理解运行关系", 1)
    core.add_body(
        doc,
        "微信小程序本身不直接运行数据库。默认部署由三个本机服务组成：微信开发者工具加载小程序，Node.js 后端提供登录、同步、AI 与图谱接口，"
        "MySQL 保存工作区与业务记录。跨设备页面接力时才需要额外的 flow-bridge。"
    )
    core.add_figure(
        doc,
        topology,
        "图 1  本地部署拓扑。评审时通常只需要开发者工具、Node.js 后端和 MySQL；流转服务为可选组件。",
        6.45,
        "本地部署拓扑，展示微信开发者工具、Node 后端、MySQL、AI 云服务、流转服务和局域网设备关系。",
    )
    core.add_heading(doc, "目录与职责", 2)
    core.add_table(
        doc,
        ["目录", "用途", "必须启动"],
        [
            ["05_完整作品文件/小程序Demo", "已构建的小程序，可直接导入开发者工具", "微信开发者工具"],
            ["05_完整作品文件/小程序源码", "Taro 源码、构建配置与说明", "重新构建时"],
            ["05_完整作品文件/后端服务", "Node.js、Express、MySQL、GraphRAG 与 AI 网关", "是"],
            ["09_部署与运行", "本手册、拓扑图、快速入口", "否"],
        ],
        [2.15, 3.25, 1.25],
    )
    p = doc.add_paragraph(style="Caption")
    core.add_run(p, "表 1  参赛包中的运行相关目录。", 8.5, False, core.MUTED)
    add_note(
        doc,
        "端口说明",
        "后端默认 3000，流转默认 3100，MySQL 开发默认 3307。可分别通过 PORT、FLOW_PORT 和 DB_PORT 调整；修改后同步更新小程序中的服务器地址。",
    )

    core.add_kicker(doc, "部署前检查")
    core.add_heading(doc, "先确认环境，再开始安装", 1)
    core.add_table(
        doc,
        ["依赖", "推荐版本", "检查命令", "用途"],
        [
            ["Node.js", "18 LTS 或更高", "node -v", "运行后端与构建 Taro"],
            ["npm", "随 Node.js", "npm -v", "安装依赖"],
            ["MySQL", "8.x", "mysql --version", "账号、家庭、快照与图谱"],
            ["微信开发者工具", "Stable 版", "GUI 检查", "运行与调试小程序"],
            ["浏览器 / PowerShell", "Windows 10/11", "系统自带", "查看日志与健康检查"],
        ],
        [1.35, 1.55, 1.55, 2.15],
    )
    p = doc.add_paragraph(style="Caption")
    core.add_run(p, "表 2  最小运行环境。无法验证的依赖请先补齐，不要跳过。", 8.5, False, core.MUTED)
    core.add_heading(doc, "检查端口是否被占用", 2)
    add_code(
        doc,
        [
            "Get-NetTCPConnection -State Listen |",
            "  Where-Object { $_.LocalPort -in 3000,3100,3307 } |",
            "  Select-Object LocalAddress,LocalPort,OwningProcess",
        ],
    )
    core.add_body(
        doc,
        "如果输出为空，三个默认端口均可使用。若已有旧进程占用，先关闭旧后端或修改 .env 中的 PORT / FLOW_PORT，并同步修改小程序里的服务器地址。"
    )
    add_note(
        doc,
        "网络边界",
        "本机模拟器默认访问 127.0.0.1:3000。换到手机或另一台电脑时，127.0.0.1 指向设备自身，必须改成后端电脑的局域网 IP。",
        "warn",
    )

    doc.add_page_break()
    core.add_kicker(doc, "第 1 步")
    core.add_heading(doc, "创建 MySQL 数据库", 1)
    core.add_body(
        doc,
        "后端只会在已存在的数据库中自动创建表，不会替你创建数据库本身。先创建名为 tianshu 的库，字符集必须是 utf8mb4。"
    )
    add_step_heading(doc, "方式 A：命令行（推荐）")
    add_code(
        doc,
        [
            'mysql -h 127.0.0.1 -P 3307 -u root -p -e "CREATE DATABASE IF NOT EXISTS tianshu DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"',
        ],
    )
    add_step_heading(doc, "方式 B：MySQL Workbench")
    core.add_body(
        doc,
        "连接本机 MySQL，打开 05_完整作品文件/后端服务/init-db.sql，执行其中的 CREATE DATABASE 语句。随后后端首次启动会自动创建 users、families、sync_snapshots、"
        "graph_nodes、graph_edges、ai_usage 等业务表。"
    )
    core.add_heading(doc, "确认数据库可用", 2)
    add_code(
        doc,
        [
            'mysql -h 127.0.0.1 -P 3307 -u root -p -e "SHOW DATABASES LIKE \'tianshu\';"',
        ],
    )
    core.add_body(
        doc,
        "若 MySQL 实际监听 3306，请将命令中的 3307 改为 3306。数据库用户、密码和端口也必须在后端 .env 中保持一致。"
    )
    add_note(
        doc,
        "数据安全",
        "root/123456 只适合本机开发。公开或多人环境应新建最小权限账号，不要把 3307 直接开放到公网。",
        "warn",
    )

    doc.add_page_break()
    core.add_kicker(doc, "第 2 步")
    core.add_heading(doc, "配置并启动 Node.js 后端", 1)
    core.add_body(
        doc,
        "进入 05_完整作品文件/后端服务，将 .env.example 复制为 .env。下面是最小配置模板；不要把填好的 .env 提交到公开仓库。"
    )
    add_code(
        doc,
        [
            "PORT=3000",
            "FLOW_PORT=3100",
            "DB_HOST=127.0.0.1",
            "DB_PORT=3307",
            "DB_USER=root",
            "DB_PASSWORD=你的数据库密码",
            "DB_NAME=tianshu",
            "",
            "AGNES_BASE_URL=https://api.agnes-ai.cn/v1",
            "AGNES_API_KEY=你的_Agnes_Key",
            "AGNES_MODEL=agnes-3.0-flash",
            "AGNES_MODEL_ALT=agnes-2.5-flash",
            "AGNES_VISION_MODELS=agnes-2.5-flash,agnes-3.0-flash,agnes-2.0-flash",
            "AUTH_SHOW_CODE=1",
        ],
    )
    add_step_heading(doc, "启动方式")
    core.add_body(
        doc,
        "双击 start-all.cmd 可同时打开后端与流转服务窗口；只验证主流程时，运行 start-backend.ps1 即可。首次启动会自动执行 npm ci 安装 express 与 mysql2。"
    )
    add_code(
        doc,
        [
            'cd "05_完整作品文件/后端服务"',
            "powershell -ExecutionPolicy Bypass -File .\\start-backend.ps1",
        ],
    )
    core.add_body(
        doc,
        "macOS / Linux 或脚本执行策略受限时，可在后端目录执行 npm ci，然后分别运行 node server.js 与 node flow-bridge.js；"
        "flow-bridge 是跨设备接力的可选服务，不启动不影响登录、库存和 AI 主流程。"
    )
    core.add_heading(doc, "检查服务", 2)
    add_code(
        doc,
        [
            'Invoke-RestMethod http://127.0.0.1:3000/api/health',
            'powershell -ExecutionPolicy Bypass -File .\\verify-services.ps1',
        ],
    )
    core.add_body(
        doc,
        "正常响应包含 service=nexcoregraph-backend，且配置 Key 后 ai=ready。数据库初始化失败时后端仍可能启动为“仅 AI 网关”模式，因此还必须完成一次登录和库存保存验证。"
    )
    add_note(
        doc,
        "判断真正就绪",
        "仅看到端口监听不算部署成功。至少完成一次验证码登录，并确认首页工作区、库存保存与 MySQL 回读正常。",
        "ok",
    )

    core.add_kicker(doc, "第 3 步")
    core.add_heading(doc, "配置 AI 与登录验证码", 1)
    core.add_body(
        doc,
        "拍照识别、开放问答和方案生成需要 Agnes Key。若暂不配置，本地库存、手动编辑、采购和部分事实快答仍可运行；但视觉识别和模型回答会明确返回未配置或服务错误。"
    )
    core.add_heading(doc, "AI Key 的两种方式", 2)
    core.add_table(
        doc,
        ["方式", "适用环境", "操作"],
        [
            ["后端 .env", "开发者工具、PC 微信、局域网真机", "填写 AGNES_API_KEY，重启后端；推荐"],
            ["小程序设置页", "临时联调", "我的 → 服务器连接 · AI 通道 → 粘贴 Key"],
        ],
        [1.5, 2.25, 2.9],
    )
    p = doc.add_paragraph(style="Caption")
    core.add_run(p, "表 3  AI Key 配置方式。公开部署只应使用服务端环境变量。", 8.5, False, core.MUTED)
    core.add_heading(doc, "本地验证码登录", 2)
    core.add_body(
        doc,
        "项目没有固定演示验证码。AUTH_SHOW_CODE=1 时，后端会在调试响应和日志中返回随机验证码；不配置 SMTP 时必须查看后端窗口日志。"
    )
    add_code(
        doc,
        [
            '$body = @{ account = "judge@example.com" } | ConvertTo-Json',
            'Invoke-RestMethod -Uri http://127.0.0.1:3000/api/auth/code `',
            '  -Method Post -ContentType "application/json" -Body $body',
        ],
    )
    core.add_body(
        doc,
        "把响应中的 devCode 填入小程序登录页，然后点击登录。不要再次点击“获取验证码”，否则会生成新码覆盖旧码。正式环境必须删除 AUTH_SHOW_CODE=1。"
    )
    add_note(
        doc,
        "邮件通道（可选）",
        "如需真实邮件发送，在 .env 配置 MAIL_HOST、MAIL_PORT、MAIL_USER、MAIL_PASS。MAIL_PASS 是邮箱 SMTP 授权码，不是邮箱登录密码。",
    )

    core.add_kicker(doc, "第 4 步")
    core.add_heading(doc, "在微信开发者工具中运行", 1)
    core.add_body(
        doc,
        "建议先用已构建的 小程序Demo 完成验收；需要修改源码时，再回到 小程序源码 重新构建。两种方式的产物入口都由 project.config.json 指向 dist/。"
    )
    core.add_heading(doc, "最省事的运行方式", 2)
    for text_value in (
        "打开微信开发者工具，选择“导入项目”。",
        "项目目录选择 05_完整作品文件/小程序Demo。",
        "若当前 AppID 不属于你的账号，在导入页改用你的小程序 AppID、测试号，或修改 project.config.json。",
        "开发阶段如遇合法域名提示，在开发者工具中关闭“校验合法域名、web-view 域名、TLS 版本及 HTTPS 证书”。",
    ):
        p = doc.add_paragraph(style="List Number")
        p.paragraph_format.space_after = Pt(3)
        core.add_run(p, text_value, 10.2, False, core.INK)
    core.add_figure(
        doc,
        devtools,
        "图 2  小程序在微信开发者工具中的运行状态。左侧是项目结构，右侧是真实模拟器。",
        6.45,
        "微信开发者工具运行 NexcoreGraph 小程序的真实截图。",
    )
    core.add_heading(doc, "从源码重新构建", 2)
    add_code(
        doc,
        [
            'cd "05_完整作品文件/小程序源码"',
            "Copy-Item .env.example .env",
            "npm ci",
            "npm run build:weapp",
        ],
    )
    core.add_body(
        doc,
        "小程序 .env 中的 TARO_APP_AI_KEY 会在构建时内联到产物。若 AI 统一走后端网关，可留空；不要把带真实 Key 的 .env、dist/common.js 或 Demo 上传到公开仓库。"
    )

    core.add_kicker(doc, "首次运行")
    core.add_heading(doc, "登录后完成一次真实闭环", 1)
    core.add_body(
        doc,
        "新账号首次登录会自动创建空家庭，不附带伪造库存。建议用项目自带的冰箱图片完成一次入库，再验证首页、图谱、写操作确认和采购联动。"
    )
    core.add_table(
        doc,
        ["验收动作", "预期结果"],
        [
            ["打开登录页并获取验证码", "提示验证码已生成 / 已发送，不出现固定演示码"],
            ["输入账号与 6 位验证码登录", "进入 AI 工作台或首页，家庭空间创建成功"],
            ["拍照入库，选择 fridge.jpg", "返回结构化候选物品，用户可修改后确认"],
            ["确认入库", "资源库出现物品，首页与 MySQL 快照同步"],
            ["输入“鸡蛋还剩 5 个”", "先出现确认弹窗，执行后才改变数量"],
            ["打开资源图谱", "显示节点、边与来源说明"],
        ],
        [2.5, 4.15],
    )
    p = doc.add_paragraph(style="Caption")
    core.add_run(p, "表 4  最小功能验收路径。", 8.5, False, core.MUTED)
    add_link_line(doc, "冰箱测试图", "05_完整作品文件/小程序源码/src/assets/fridge.jpg")
    add_link_line(doc, "接口回归记录", "00_完整性校验/微信小程序回归测试记录.md")
    add_note(
        doc,
        "登录失败优先检查",
        "确认后端窗口能看到 [auth] 验证码日志；若数据库连接失败，验证码虽然生成，登录仍会失败。先修复 MySQL，再重新登录。",
        "warn",
    )

    doc.add_page_break()
    core.add_kicker(doc, "局域网与真机")
    core.add_heading(doc, "手机、平板或 PC 微信如何连接", 1)
    core.add_body(
        doc,
        "让运行后端的电脑和手机处于同一个 WiFi / 网段。后端健康接口会列出可用局域网地址；真实网卡给出的地址才适合手机填写，虚拟网卡地址通常连不上。"
    )
    add_code(
        doc,
        [
            '$h = Invoke-RestMethod http://127.0.0.1:3000/api/health',
            "$h.lanIps",
            "# 手机地址示例：http://192.168.1.20:3000",
        ],
    )
    core.add_heading(doc, "Windows 防火墙", 2)
    core.add_body(
        doc,
        "首次运行时 Windows 可能弹出防火墙提示，请允许专用网络访问。若未弹窗，可在管理员 PowerShell 中放行 TCP 3000 和 3100。"
    )
    add_code(
        doc,
        [
            'New-NetFirewallRule -DisplayName "NexcoreGraph Backend" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -Profile Private',
            'New-NetFirewallRule -DisplayName "NexcoreGraph Flow" -Direction Inbound -Protocol TCP -LocalPort 3100 -Action Allow -Profile Private',
        ],
    )
    core.add_body(
        doc,
        "在小程序“我的 → 服务器连接”里把地址改为 http://<电脑局域网IP>:3000，然后点击连通测试。"
        "如果 3000 正常但流转失败，再启动 flow-bridge 并检查 3100。"
    )
    add_note(
        doc,
        "真机注意",
        "Windows 微信访问 Agnes 厂商域名可能出现证书错误。使用本机后端转发，不要强制在小程序端直连厂商域名。正式发布还必须使用 HTTPS 并在微信后台配置合法域名。",
        "warn",
    )

    doc.add_page_break()
    core.add_kicker(doc, "公网与安全")
    core.add_heading(doc, "从本地演示走向可访问部署", 1)
    core.add_body(
        doc,
        "本地演示只需要 127.0.0.1 或局域网地址。若要让外网用户访问，需要反向代理提供 HTTPS，并在微信公众平台配置 request 合法域名；不能把 MySQL 3307 或未经保护的 Node 端口直接暴露到公网。"
    )
    core.add_table(
        doc,
        ["项目", "本地评审", "公网部署"],
        [
            ["API 地址", "http://127.0.0.1:3000 或局域网 IP", "https://你的域名，经 Nginx/Caddy 反向代理"],
            ["微信合法域名", "开发者工具可关闭校验", "必须配置 HTTPS 域名"],
            ["AUTH_SHOW_CODE", "可设为 1 便于联调", "必须关闭"],
            ["MySQL", "仅监听本机", "只允许应用内网访问，建立最小权限账号"],
            ["AI Key", "后端 .env", "服务端密钥管理，不下发客户端"],
        ],
        [1.55, 2.45, 2.65],
    )
    p = doc.add_paragraph(style="Caption")
    core.add_run(p, "表 5  本地评审与公网部署的边界。", 8.5, False, core.MUTED)
    add_note(
        doc,
        "不要公开的文件",
        "backend/.env、小程序 .env、含真实 Key 的 dist/common.js、包含家庭数据的 MySQL 快照与 flow-bridge.json，都不应进入公开仓库或公开下载链接。",
        "warn",
    )

    doc.add_page_break()
    core.add_kicker(doc, "故障排查")
    core.add_heading(doc, "按现象定位问题", 1)
    core.add_table(
        doc,
        ["现象", "常见原因", "处理"],
        [
            ["后端启动后提示数据库初始化失败", "库未创建、端口错误、账号密码错误", "检查 tianshu 是否存在，核对 DB_*；先手工连接 MySQL"],
            ["ER_ACCESS_DENIED_ERROR", "DB_USER / DB_PASSWORD 不匹配", "修正 .env；确认 MySQL 用户允许从 127.0.0.1 登录"],
            ["登录提示发送失败", "SMTP 未配置或授权码错误", "本地开启 AUTH_SHOW_CODE=1 并查看后端日志"],
            ["小程序提示未发现后端", "服务未启动或地址仍是 127.0.0.1", "运行 verify-services.ps1；真机改为电脑局域网 IP"],
            ["AI 返回 no-key / 503", "Agnes Key 未配置或失效", "在 backend/.env 配置有效 Key 后重启"],
            ["真机证书错误", "厂商域名证书链被 Windows 微信拒绝", "统一走自建后端，不要在端侧直连厂商"],
            ["端口被占用", "旧 Node 进程仍在运行", "关闭旧窗口或用 Get-NetTCPConnection 找到 OwningProcess"],
            ["AppID 无权限", "项目配置中的 AppID 不属于当前账号", "改用测试号 / 自有 AppID / 修改 project.config.json"],
        ],
        [2.05, 2.25, 2.35],
    )
    p = doc.add_paragraph(style="Caption")
    core.add_run(p, "表 6  常见部署问题。处理时先看后端终端日志，再看小程序控制台。", 8.5, False, core.MUTED)
    core.add_heading(doc, "推荐排查顺序", 2)
    for index, item in enumerate(
        [
            "MySQL：命令行能连接，数据库 tianshu 存在。",
            "后端：/api/health 返回 ok，日志显示 DB 就绪与 AI 状态。",
            "登录：能拿到随机验证码并成功进入首页。",
            "小程序：能读取资源库并写入一条物品。",
            "网络：真机使用电脑局域网 IP，而非 127.0.0.1。",
        ],
        1,
    ):
        p = doc.add_paragraph()
        p.paragraph_format.left_indent = Cm(0.35)
        p.paragraph_format.space_after = Pt(3)
        core.add_run(p, f"{index:02d}  ", 10, True, core.GREEN)
        core.add_run(p, item, 10.2, False, core.INK)

    doc.add_page_break()
    core.add_kicker(doc, "验收清单")
    core.add_heading(doc, "部署完成的标准", 1)
    core.add_table(
        doc,
        ["检查项", "通过标准"],
        [
            ["数据库", "tianshu 存在，核心业务表和图谱表可查询"],
            ["后端", "/api/health 返回 ok=true，日志显示数据库就绪"],
            ["AI", "配置 Key 后 health 显示 ai=ready；不配置时明确提示"],
            ["登录", "随机验证码可登录，新账号自动建立空家庭"],
            ["小程序", "Demo 或重新构建产物可打开，页面无白屏"],
            ["拍照入库", "识别、人工确认、写入库存连续完成"],
            ["写操作", "先弹确认框，执行后才改库存并可撤销"],
            ["同步", "同账号或流转后，另一端看到最新结构化状态"],
            ["安全", "公开环境中 AUTH_SHOW_CODE 已关闭，.env 未外泄"],
        ],
        [2.1, 4.55],
    )
    p = doc.add_paragraph(style="Caption")
    core.add_run(p, "表 7  交付验收清单。全部通过后即可用于评阅。", 8.5, False, core.MUTED)
    core.add_heading(doc, "快速命令卡", 2)
    add_code(
        doc,
        [
            "# 1. 检查服务",
            'powershell -ExecutionPolicy Bypass -File "05_完整作品文件/后端服务/verify-services.ps1"',
            "",
            "# 2. 重新构建小程序（可选）",
            'cd "05_完整作品文件/小程序源码"',
            "npm ci",
            "npm run build:weapp",
        ],
    )
    core.add_heading(doc, "可选服务开关", 2)
    core.add_table(
        doc,
        ["服务", "环境变量", "未配置时的行为"],
        [
            ["Agnes AI", "AGNES_API_KEY", "本地库存与部分快答仍可用，视觉识别和模型回答明确报错"],
            ["邮件验证码", "MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS", "不发送邮件；本地可查看日志或 devCode"],
            ["短信验证码", "SMS_ENDPOINT, SMS_API_KEY", "不发送短信；不影响本机验证码联调"],
            ["语音播报", "TTS_ENDPOINT / EDGE_TTS_BIN", "优先尝试本机语音能力；失败时返回明确错误"],
            ["微信内容安全", "WX_APPID, WX_SECRET", "不调用微信审核接口，本地使用敏感词兜底"],
        ],
        [1.35, 2.45, 2.85],
    )
    doc.core_properties.title = "启核图策部署与运行手册"
    doc.core_properties.subject = "微信小程序端本地部署、配置、验收与排障"
    doc.core_properties.author = "天枢序列小程序"
    doc.core_properties.keywords = "NexcoreGraph, deployment, runbook, WeChat mini program, MySQL"
    doc.save(OUT_DOCX)
    print(OUT_DOCX)


if __name__ == "__main__":
    build()
