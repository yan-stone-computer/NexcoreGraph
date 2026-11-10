#!/usr/bin/env python3
"""Build the seven HarmonyOS module schematics used in section 4.1."""

from __future__ import annotations

import base64
from pathlib import Path
from xml.sax.saxutils import escape


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs' / 'images' / 'harmony-modules'
ICON = ROOT / 'docs' / 'images' / 'architecture-assets' / 'harmony-core-icon-alpha.png'

W = 1400
H = 820
DOC_W = '159mm'
DOC_H = '93.2mm'

INK = '#17231f'
INK_2 = '#3f514a'
MUTED = '#5f7068'
LINE = '#aab5af'
GREEN = '#2f7f43'
GREEN_DARK = '#1f6031'
GREEN_PALE = '#edf6ef'
BLUE = '#507ba1'
BLUE_DARK = '#315b7d'
BLUE_PALE = '#eef4fa'
GRAY_PALE = '#f3f5f4'
WHITE = '#ffffff'


def rect(x: int, y: int, w: int, h: int, fill: str = WHITE, stroke: str = LINE,
         radius: int = 12, sw: float = 1.5, dashed: bool = False, gid: str = '') -> str:
    dash = ' stroke-dasharray="8 7"' if dashed else ''
    group = f'<g id="{gid}">' if gid else '<g>'
    return (group + f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" '
            f'fill="{fill}" stroke="{stroke}" stroke-width="{sw}"{dash}/></g>')


def text(x: int, y: int, value: str, size: int = 27, fill: str = INK,
         weight: int = 400, anchor: str = 'start') -> str:
    return (f'<text x="{x}" y="{y}" font-size="{size}" fill="{fill}" '
            f'font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>')


def text_units(value: str) -> float:
    return sum(1.0 if ord(ch) > 127 else 0.58 for ch in value)


def fit_size(value: str, width: int, base: int, floor: int) -> int:
    units = max(1.0, text_units(value))
    return max(floor, min(base, int((width - 36) / units)))


def card(gid: str, x: int, y: int, w: int, h: int, title: str,
         body: list[str], code: str, *, accent: bool = False,
         stroke: str = LINE, fill: str = WHITE, dashed: bool = False) -> str:
    if accent:
        fill = GREEN
    fg = WHITE if accent else INK
    body_fg = '#e4f0e7' if accent else INK_2
    code_fg = '#c8e2cf' if accent else MUTED
    dash = ' stroke-dasharray="8 7"' if dashed else ''
    title_size = fit_size(title, w, 29, 20)
    body_size = min(
        [fit_size(line, w, 25, 19) for line in body],
        default=25,
    )
    while body and body_size > 18:
        last_y = 71 + (body_size + 5) * (len(body) - 1)
        bottom_limit = h - (38 if code else 14)
        if last_y <= bottom_limit:
            break
        body_size -= 1
    code_size = fit_size(code, w, 18, 13) if code else 18
    out = [f'<g id="{gid}">',
           f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" '
           f'fill="{fill}" stroke="{GREEN if accent else stroke}" stroke-width="{2 if accent else 1.4}"{dash}/>',
           text(x + 18, y + 36, title, title_size, fg, 700)]
    for i, line in enumerate(body):
        out.append(text(x + 18, y + 71 + i * (body_size + 5), line, body_size, body_fg))
    if code:
        out.append(text(x + 18, y + h - 17, code, code_size, code_fg))
    out.append('</g>')
    return ''.join(out)


def label(x: int, y: int, value: str, *, color: str = MUTED, size: int = 21) -> str:
    return text(x, y, value, size, color, 400)


def arrow(points: list[tuple[int, int]], *, color: str = GREEN, width: float = 2.3,
          dashed: bool = False, marker: bool = True) -> str:
    d = ' '.join(('M' if i == 0 else 'L') + f'{x} {y}' for i, (x, y) in enumerate(points))
    dash = ' stroke-dasharray="9 7"' if dashed else ''
    end = ' marker-end="url(#arrow-green)"' if marker else ''
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" '
            f'stroke-linecap="round" stroke-linejoin="round"{dash}{end}/>')


def band(x: int, y: int, w: int, h: int, title: str, *, dashed: bool = False,
         stroke: str = LINE) -> str:
    dash = '8 7' if dashed else ''
    return (f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="15" fill="none" '
            f'stroke="{stroke}" stroke-width="1.8" stroke-dasharray="{dash}"/>'
            + text(x + 20, y + 29, title, 23, stroke, 700))


def svg_start(title: str, subtitle: str, slug: str) -> str:
    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{DOC_W}" height="{DOC_H}" '
        f'viewBox="0 0 {W} {H}" role="img" aria-labelledby="title-{slug} desc-{slug}" '
        'font-family="Microsoft YaHei, Noto Sans SC, sans-serif">',
        f'<title id="title-{slug}">{escape(title)}</title>',
        f'<desc id="desc-{slug}">{escape(subtitle)}</desc>',
        '<defs><marker id="arrow-green" markerWidth="11" markerHeight="11" refX="9" refY="5.5" '
        'orient="auto" markerUnits="strokeWidth"><path d="M0 0 L11 5.5 L0 11 Z" fill="#2f7f43"/>'
        '</marker></defs>',
        rect(0, 0, W, H, WHITE, WHITE, 0, 0),
        text(40, 56, title, 43, INK, 700),
        text(40, 94, subtitle, 23, INK_2),
        '<line x1="40" y1="116" x2="1360" y2="116" stroke="#cbd3cf" stroke-width="1.4"/>',
    ]
    if ICON.exists():
        icon = base64.b64encode(ICON.read_bytes()).decode('ascii')
        parts.append(f'<image href="data:image/png;base64,{icon}" x="1260" y="34" width="100" height="36"/>')
    return ''.join(parts)


def svg_end() -> str:
    return '</svg>'


def ui_shell() -> str:
    p = [svg_start('ArkUI 交互与响应式外壳',
                   '同一页面树按设备类型与窗口宽度切换；平板侧栏与 AI 停靠面板共享显式宽度约束。', 'ui')]
    p += [
        card('entry-ability', 40, 145, 270, 150, 'EntryAbility',
             ['onCreate / onNewWant', 'onContinue / onBackground'],
             'EntryAbility.ets', accent=True),
        card('index-build', 350, 145, 280, 150, 'Index.build()',
             ['未登录 → LoginView', '已登录 → 选择外壳'],
             'Index.ets'),
        band(680, 145, 680, 170, '三档响应式外壳'),
        card('shell-compact', 700, 185, 190, 112, 'Compact',
             ['< 300vp / 手表', 'WatchShell'], ''),
        card('shell-normal', 910, 185, 200, 112, 'Normal',
             ['300–839vp', '底部 Tabs'], ''),
        card('shell-wide', 1130, 185, 210, 112, 'Wide',
             ['平板 / 2in1', '≥840vp → NavRail'], ''),
        arrow([(310, 220), (350, 220)]),
        arrow([(630, 220), (680, 220)]),
        card('breakpoints', 40, 350, 320, 170, 'applyBreakpoints()',
             ['deviceKind() + windowWidthVp()', '优先设备类型，宽度兜底',
              '写入 isCompact / isWide'],
             'Breakpoints.ets'),
        card('page-width', 400, 350, 320, 170, 'pageContentWidth()',
             ['窗口 − 侧栏 96vp − 页边距', 'Wide + AI 打开再减 420vp',
              '最小内容宽度 240vp'],
             'Breakpoints.ets'),
        card('layout', 760, 350, 300, 170, '布局容器',
             ['Row / Column / Tabs', 'NavRail / TopBar',
              'bindSheet / AiBall'],
             'Index.ets · Overlays.ets'),
        card('tokens', 1100, 350, 260, 170, 'Tokens',
             ['颜色 / 间距 / 字号', '全局 Token 统一',
              '三端视觉规则对齐'],
             'Tokens.ets'),
        band(40, 570, 1320, 175, '页面与交互层'),
        card('ai-workbench', 62, 610, 245, 105, 'AiWorkbench',
             ['对话 / 工具行 / 方案'], '页签 0'),
        card('library-views', 327, 610, 245, 105, '资源库视图',
             ['列表 / 详情 / 图谱'], 'LibrariesView · 页签 1'),
        card('workbench-view', 592, 610, 245, 105, 'WorkbenchView',
             ['计划 / 预警 / 采购'], '页签 2'),
        card('settings-view', 857, 610, 245, 105, 'SettingsView',
             ['同步 / 服务 / 诊断'], '页签 3'),
        card('overlays', 1122, 610, 215, 105, 'Overlays',
             ['Sheet / Intake'], 'bindSheet'),
        arrow([(200, 350), (200, 325), (680, 325), (680, 315)], dashed=True, width=1.8),
        arrow([(560, 350), (560, 315)], dashed=True, width=1.8),
        arrow([(910, 350), (910, 315)], dashed=True, width=1.8),
        arrow([(1230, 350), (1230, 315)], dashed=True, width=1.8),
        label(50, 770, '页面不在组件内部硬编码 padding；宽度、侧栏与停靠面板统一由 Breakpoints 计算。'),
    ]
    return ''.join(p) + svg_end()


def local_routing() -> str:
    p = [svg_start('本地编排与零模型快答',
                   '命令匹配和确定性意图先于模型调用；高频事实题直接由代码读取本地状态并构造 AIReply。', 'routing')]
    p += [
        card('question', 40, 155, 230, 140, '用户问题',
             ['文本 / 语音转写', '同一入口进入'], '', accent=True),
        card('ask-ai', 310, 155, 250, 140, 'askAI()',
             ['本地优先', '证据再提交网关'], 'AiGateway.ets'),
        card('match-command', 600, 155, 250, 140, 'matchCommand',
             ['白名单自然语言指令', '不改开放问答'], 'Commands.ets'),
        card('run-command', 890, 155, 230, 140, 'runCommand',
             ['执行受控操作', '返回 CmdReply'], 'Commands.ets'),
        card('cmd-reply', 1160, 155, 200, 140, 'AIReply',
             ['route = cmd:*', '0 次模型'], ''),
        card('route-intent', 40, 365, 270, 150, 'routeIntent()',
             ['11 类 Intent', '规则匹配，无模型'], 'Router.ets'),
        card('direct-answer', 350, 365, 280, 150, 'directAnswer()',
             ['greet / where / qty / expiry', '数值与来源由代码生成'],
             'Router.ets'),
        card('direct-reply', 670, 365, 230, 150, 'AIReply',
             ['route / srcNote', '0 次模型'], ''),
        card('knowledge', 940, 365, 420, 150, 'KnowledgeIndex',
             ['lookup() 食材事实 · rulesFor() 规则', '证据行保留 src / url'],
             'KnowledgeIndex.ets', stroke=BLUE, fill=BLUE_PALE),
        card('other-route', 40, 585, 280, 150, 'open question',
             ['routeIntent = other', '进入受控模型路径'], '', stroke=BLUE),
        card('evidence', 360, 585, 340, 150, 'evidenceFor()',
             ['按意图装配库存证据', '家庭偏好与来源片段'], 'Router.ets'),
        card('graph-evidence', 740, 585, 300, 150, 'GraphRAG evidence',
             ['ragEvidence(mode, q)', '路径 + 事实 + 来源'], 'GraphQuery.ets'),
        card('next-gateway', 1080, 585, 280, 150, 'AI 网关闭环',
             ['POST /api/ai/chat', '详见模块图 4-6'], '', stroke=BLUE, fill=BLUE_PALE),
        arrow([(270, 225), (310, 225)]),
        arrow([(560, 225), (600, 225)]),
        arrow([(850, 225), (890, 225)]),
        arrow([(1120, 225), (1160, 225)]),
        arrow([(435, 295), (435, 345), (175, 365)], dashed=True, width=1.9),
        label(220, 337, '未命中命令'),
        arrow([(175, 515), (175, 585)], dashed=True, width=1.9),
        arrow([(310, 440), (350, 440)]),
        arrow([(630, 440), (670, 440)]),
        label(760, 557, 'cook / creative / nutrition / summary / other 进入模型路径', size=20),
        arrow([(320, 660), (360, 660)]),
        arrow([(700, 660), (740, 660)]),
        arrow([(1040, 660), (1080, 660)], color=BLUE),
        label(50, 782, '快答路径包括本地命令与问候、位置、数量、保质期；所有数值来自代码，不交给模型生成。'),
    ]
    return ''.join(p) + svg_end()


def multimodal_intake() -> str:
    p = [svg_start('多模态入库闭环',
                   '拍照、相册、压缩、识图、字段补缺与用户确认串行执行；空结果和失败均回到明确出口。', 'intake')]
    p += [
        card('intake-entry', 40, 150, 235, 150, 'IntakePanel',
             ['拍照 / 相册 / 手动', '统一确认面板'], 'Overlays.ets', accent=True),
        band(310, 145, 340, 160, '输入源（二选一）'),
        card('camera', 330, 185, 140, 105, 'CameraPicker',
             ['系统相机', '取消即返回'], ''),
        card('album', 490, 185, 140, 105, 'PhotoPicker',
             ['最多 6 张', '相册选图'], ''),
        card('jpeg', 690, 150, 255, 150, '影像预处理',
             ['uriToJpegBase64', '长边限制 1024'], 'withTimeout'),
        card('vision-client', 980, 150, 380, 150, 'recognizeImage()',
             ['AiGateway 视觉入口', '端侧 45s 读超时'], 'AiGateway.ets'),
        card('vision-api', 980, 365, 380, 150, 'POST /api/ai/vision',
             ['服务端视觉识图', '端侧不持有厂商 Key'], 'AI 受控网关', stroke=BLUE, fill=BLUE_PALE),
        card('vision-map', 650, 365, 290, 150, 'IntakeResult',
             ['映射 GatewayItem', '缺字段进入待确认'], 'AiGateway.ets'),
        card('field-fill', 340, 365, 270, 150, '字段补缺',
             ['expDays 缺失查知识库', '查不到按“不适用”'], 'KnowledgeIndex.lookup()'),
        card('merge', 40, 365, 260, 150, '识别结果合并',
             ['单张：直接使用', '多图：逐张串行识别'], 'compressAndRecognize'),
        card('merge-detail', 40, 585, 310, 150, 'mergeIntakeResults',
             ['多图按名称去重', '数量累加，字段补首值'], 'Api.ets'),
        card('review', 390, 585, 300, 150, 'IntakePanel 复核',
             ['字段编辑 / 重试 / 手动', '空结果明确提示'], 'Overlays.ets'),
        card('add-items', 730, 585, 290, 150, 'addItems()',
             ['写入库 / 缺库自动创建', '保质期生成预警'], 'Api.ets', accent=True),
        card('after-save', 1060, 585, 300, 150, '落库结果',
             ['Library.items += Item', 'Alert 仅给有保质期物品'], 'placeItems()'),
        arrow([(275, 225), (310, 225)]),
        arrow([(650, 225), (690, 225)]),
        arrow([(945, 225), (980, 225)]),
        arrow([(1170, 300), (1170, 365)], color=BLUE),
        arrow([(980, 440), (940, 440)], color=BLUE),
        arrow([(650, 440), (610, 440)]),
        arrow([(340, 440), (300, 440)]),
        arrow([(170, 515), (170, 585)]),
        arrow([(300, 470), (360, 470), (360, 540), (540, 540), (540, 585)], dashed=True, width=1.8),
        arrow([(350, 650), (390, 650)]),
        arrow([(690, 650), (730, 650)]),
        arrow([(1020, 650), (1060, 650)]),
        label(560, 535, '单张直接进入复核', size=20),
        label(40, 770, '空图不是演示数据：返回“无可入库物品”；识别失败可重试或转为手动录入。'),
    ]
    return ''.join(p) + svg_end()


def graph_rag() -> str:
    p = [svg_start('个人资源图谱与 GraphRAG',
                   '端侧确定性构图与检索；GraphDoc 持久化到本地，模型只读取最终证据包。', 'graph')]
    p += [
        band(40, 145, 320, 355, '端侧事实源'),
        card('store-source', 60, 185, 280, 140, 'Store',
             ['libraries / items', 'plans / alerts / logs'], 'Store.ets'),
        card('knowledge-source', 60, 350, 280, 130, 'KnowledgeIndex',
             ['食材事实 / 规则', 'RECIPES 菜谱关系'], 'KnowledgeIndex.ets',
             stroke=BLUE, fill=BLUE_PALE),
        card('graph-build', 410, 180, 330, 230, 'GraphBuild',
             ['确定性读 Store', '实体归一与别名解析',
              '节点 / 边 / 社区写入', '0 次模型调用'],
             'GraphBuild.ets', accent=True),
        card('graph-store', 790, 145, 260, 150, 'GraphStore',
             ['GraphDoc 缓存', 'dirty / freshness', 'Preferences: graphDoc'],
             'GraphStore.ets'),
        card('graph-query', 790, 350, 260, 150, 'GraphQuery',
             ['无图/脏图自动重建', '线性扫描 + 邻接缓存',
              'GraphRAG 证据装配'], 'GraphQuery.ets', stroke=GREEN),
        card('evidence', 1100, 225, 260, 220, 'RagEvidence',
             ['lines：事实 / 来源', 'paths：节点链 + 边类型',
              '≤12 行、≤5 路径', '提交给 /api/ai/chat'],
             'GraphModel.ets', stroke=BLUE, fill=BLUE_PALE),
        card('ontology', 410, 485, 330, 165, '本体与社区',
             ['ItemInstance / FoodConcept', 'RecipeConcept / Plan / Alert',
              '一级库 · 二级类别 · 三级场景'], 'GraphModel.ets'),
        card('modes', 790, 525, 260, 175, '三模检索',
             ['local：实体邻域', 'global：社区统计',
              'multi-hop：临期→菜谱'], 'modeForIntent()'),
        card('backend-graph', 1100, 525, 260, 170, '独立图谱 API',
             ['/api/graph/*', 'MySQL 图谱五表',
              '当前 HarmonyOS 问答未直调'], '/api/graph/*',
             stroke=BLUE, fill=BLUE_PALE, dashed=True),
        arrow([(340, 255), (410, 255)]),
        arrow([(340, 415), (375, 415), (375, 320), (410, 320)], color=BLUE, dashed=True),
        arrow([(740, 255), (790, 220)]),
        arrow([(920, 295), (920, 350)]),
        arrow([(1050, 425), (1100, 425)]),
        arrow([(575, 485), (575, 410)], dashed=True),
        arrow([(920, 500), (920, 525)]),
        label(1090, 500, '独立后端能力，当前端侧不直调', size=20),
        label(40, 745, '当前问答边界：端侧 GraphQuery.ragEvidence() 生成证据，再交给 AI 网关；不直接请求 /api/graph/*。'),
    ]
    return ''.join(p) + svg_end()


def ai_gateway() -> str:
    p = [svg_start('AI 受控网关与写操作确认',
                   '本地路径先短路；开放问题携带端侧证据进入自建网关，工具行只在用户确认后执行。', 'gateway')]
    p += [
        card('user-input', 40, 150, 235, 145, 'AiPanel',
             ['askAI(question)', '展示来源与工具卡'], 'AiPanel.ets', accent=True),
        card('ask-ai', 310, 150, 260, 145, 'AiGateway.askAI',
             ['本地优先', '开放问题再走模型'], 'AiGateway.ets'),
        card('local-path', 610, 150, 300, 145, 'Commands / Router',
             ['本地命令与四类快答', '命中即返回 AIReply'], '0 次模型'),
        card('local-reply', 950, 150, 410, 145, 'AIReply',
             ['route / srcNote / opKind', '本地路径不调用模型'], ''),
        card('evidence', 40, 355, 275, 150, '证据装配',
             ['modeForIntent()', 'ragEvidence + evidenceFor'], 'GraphQuery / Router'),
        card('request', 350, 355, 290, 150, 'callJson',
             ['POST /api/ai/chat', '端侧不发送厂商 Key'], 'Backend.ets', stroke=BLUE),
        card('server-gateway', 675, 355, 300, 150, 'AI 受控网关',
             ['Key 只存服务端环境变量', '主模型 + 备用模型'], 'Node.js · Express', stroke=BLUE, fill=BLUE_PALE),
        card('response', 1010, 355, 350, 150, 'GatewayChat',
             ['text / model / traceId', 'evidenceUsed / warnings'], 'AiGateway.ets'),
        card('tool-parse', 40, 585, 260, 145, 'parseToolLines',
             ['白名单解析', '未知行不进入正文'], 'AiGateway.ets'),
        card('adjust', 330, 585, 240, 145, '调整数量',
             ['核对名称在库中', '确认后更新数量'], '[调整] name | qty'),
        card('shopping', 600, 585, 240, 145, '加入采购',
             ['名称长度校验', '确认后写清单'], '[购物] name | qty'),
        card('dish', 870, 585, 230, 145, '创新菜谱',
             ['校验字段后确认', 'addAIPlan 落方案'], '[菜] title | time'),
        card('usage', 1130, 585, 230, 145, '用量与追踪',
             ['recordUsage', '/api/ai/usage'], 'route / model / ms'),
        arrow([(275, 222), (310, 222)]),
        arrow([(570, 222), (610, 222)]),
        arrow([(910, 222), (950, 222)]),
        arrow([(475, 295), (475, 325), (180, 325), (180, 355)], dashed=True),
        label(275, 342, '开放问题'),
        arrow([(315, 430), (350, 430)], color=BLUE),
        arrow([(640, 430), (675, 430)], color=BLUE),
        arrow([(975, 430), (1010, 430)], color=BLUE),
        arrow([(1185, 505), (1185, 525), (170, 525), (170, 585)], color=BLUE, dashed=True),
        arrow([(300, 657), (320, 657), (320, 555)], marker=False),
        arrow([(320, 555), (985, 555)], marker=False),
        arrow([(450, 555), (450, 585)]),
        arrow([(720, 555), (720, 585)]),
        arrow([(985, 555), (985, 585)]),
        label(350, 515, '响应回传后解析工具行', size=20),
        label(50, 770, '写操作不静默合并：模型只给工具行，端侧校验并通过确认按钮落地；工具内容不直接执行。'),
    ]
    return ''.join(p) + svg_end()


def sync_channels() -> str:
    p = [svg_start('本地快照与三通道同步',
                   '同一份 DataPayload 支撑本地恢复、云端权威同步与局域网实时流转；409 冲突交用户选择。', 'sync')]
    p += [
        card('data-change', 40, 150, 250, 150, '数据变更',
             ['库 / 物品 / 计划', '预警 / 采购 / 设置'], 'Store', accent=True),
        card('snapshot', 340, 150, 300, 150, 'buildDataSnapshot',
             ['全量快照 + 版本字段', '图谱不进入同步 payload'],
             'Continuation.ets'),
        card('local-store', 690, 150, 280, 150, '本机落盘',
             ['saveUserData()', '6s 内容对比 / 变更才写'],
             'LocalStore.ets'),
        card('prefs', 1020, 150, 330, 150, 'Preferences',
             ['nexcore_local.userData', '断网 / 杀进程可恢复'], 'LocalStore.ets', stroke=BLUE, fill=BLUE_PALE),
        card('cloud-upload', 340, 365, 300, 155, '云端权威快照',
             ['autoUpload：2.5s 防抖', '/api/sync/* + baseVersion'],
             'SyncApi.ets', stroke=BLUE, fill=BLUE_PALE),
        card('conflict', 690, 365, 280, 155, '409 冲突',
             ['不静默合并', '用户二选一'],
             'tryUploadSync()'),
        card('conflict-choices', 1020, 365, 330, 155, '显式选择',
             ['forceUploadSync：覆盖云端', 'downloadSync：拉取云端'],
             'SyncApi.ets'),
        card('live-publish', 40, 585, 250, 155, '实时流转源端',
             ['scheduleLivePublish', '600ms 合并发布'], 'LiveSync.ets'),
        card('flow-bridge', 340, 585, 300, 155, 'flow-bridge.js :3100',
             ['/api/flow/publish', '/api/flow/latest?since=rev'],
             'FlowBridge.ets', stroke=BLUE, fill=BLUE_PALE),
        card('live-poll', 690, 585, 280, 155, '目标端轮询 / 合并',
             ['2s poll', 'applyDataSnapshot()'], 'LiveSync.ets'),
        card('graph-store', 1020, 585, 330, 155, '本地图谱另存',
             ['nexcore_local.graphDoc', 'dirty 后按需重建'], 'GraphStore.ets'),
        arrow([(290, 225), (340, 225)]),
        arrow([(640, 225), (690, 225)]),
        arrow([(970, 225), (1020, 225)]),
        arrow([(490, 300), (490, 365)], color=BLUE),
        arrow([(640, 442), (690, 442)]),
        arrow([(970, 442), (1020, 442)]),
        arrow([(190, 300), (190, 530), (165, 530), (165, 585)], dashed=True),
        arrow([(290, 662), (340, 662)], color=BLUE),
        arrow([(640, 662), (690, 662)], color=BLUE),
        arrow([(970, 662), (1020, 662)], color=BLUE),
        label(40, 780, '云端权威通道与 3100 流转通道职责分开：前者解决账号数据与冲突，后者解决同网设备实时跟进。'),
    ]
    return ''.join(p) + svg_end()


def system_entry() -> str:
    p = [svg_start('系统入口与跨设备接续',
                   'Service Card、系统流转和 FormExtension 复用同一份快照与页面状态，入口参数直接驱动全局导航。', 'entry')]
    p += [
        card('entry-ability', 530, 145, 340, 145, 'EntryAbility',
             ['onCreate / onNewWant', 'onContinue / onBackground'],
             'EntryAbility.ets', accent=True),
        card('card-entry', 40, 350, 270, 155, '服务卡片',
             ['postCardAction target', '直达功能入口'], 'FormExtension'),
        card('continue-entry', 330, 350, 280, 155, '系统接续',
             ['onContinue → wantParam', 'isContinuation → restoreFlow'],
             'Continuation.ets'),
        card('form-entry', 630, 350, 290, 155, 'FormExtensionAbility',
             ['onAddForm / onUpdateForm', '读取 formSnapshot'], 'EntryFormAbility.ets'),
        card('bridge-entry', 940, 350, 410, 155, 'flow-bridge 兜底',
             ['模拟器 / 无 dsoftbus', 'publish + pull 同一快照'],
             'FlowBridge.ets', stroke=BLUE, fill=BLUE_PALE),
        card('targets', 40, 575, 360, 150, '卡片目标',
             ['ai / libs / alerts', 'intake / plans / shopping'], 'handleCardWant()'),
        card('continue-guard', 430, 575, 330, 150, '接续边界',
             ['未登录页面拒绝接续', 'allowContinue(loggedIn)'], 'EntryAbility.ets'),
        card('form-data', 790, 575, 260, 150, '卡片数据',
             ['formSnapshot 优先', '内置快照兜底'], 'LocalStore.ets'),
        card('background-save', 1080, 575, 270, 150, '后台刷新',
             ['onBackground', 'saveFormSnapshot()'], 'EntryAbility.ets'),
        arrow([(700, 290), (700, 330), (175, 330), (175, 350)]),
        arrow([(700, 290), (700, 330), (470, 330), (470, 350)]),
        arrow([(700, 290), (700, 350)]),
        arrow([(700, 290), (700, 330), (1145, 330), (1145, 350)], color=BLUE, dashed=True),
        arrow([(175, 505), (220, 505), (220, 575)]),
        arrow([(470, 505), (595, 505), (595, 575)]),
        arrow([(775, 505), (775, 520), (920, 520), (920, 575)]),
        arrow([(780, 650), (790, 650)], dashed=True),
        arrow([(1080, 650), (1050, 650)], dashed=True),
        label(40, 780, '真实设备优先走系统接续；模拟器或局域网调试由 flow-bridge 复用同一快照，不另造数据协议。'),
    ]
    return ''.join(p) + svg_end()


FIGURES = {
    'harmony-module-ui-shell.svg': ui_shell,
    'harmony-module-local-routing.svg': local_routing,
    'harmony-module-multimodal-intake.svg': multimodal_intake,
    'harmony-module-graphrag.svg': graph_rag,
    'harmony-module-ai-gateway.svg': ai_gateway,
    'harmony-module-sync-channels.svg': sync_channels,
    'harmony-module-system-entry.svg': system_entry,
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for name, build in FIGURES.items():
        path = OUT / name
        path.write_text(build(), encoding='utf-8')
        print(path)


if __name__ == '__main__':
    main()
