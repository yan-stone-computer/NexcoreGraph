# -*- coding: utf-8 -*-
"""Build the Web client's software-engineering figure set."""
from __future__ import annotations

from pathlib import Path

from build_works_intro_assets import (
    GREEN,
    GREEN_DARK,
    GRID,
    INK,
    LINE,
    MUTED,
    PALE_GREEN,
    PALE_TEAL,
    WARM,
    WHITE,
    box,
    line,
    path,
    svg_shell,
    text,
)


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "deliverables" / "传智杯_启核图策_Web端" / "04_界面截图" / "软件工程图"


def system_architecture() -> str:
    w, h = 1600, 1060
    body = [
        text(48, 56, "Web 软件系统架构", 38, INK, 700),
        text(48, 98, "浏览器交互、AI 编排、Node.js 服务与事实层彼此分层。", 23, MUTED),
        f'<rect x="42" y="136" width="1040" height="174" rx="22" fill="{WHITE}" stroke="{GRID}" stroke-width="2"/>',
        text(70, 174, "体验层 · Browser", 24, GREEN_DARK, 700),
        box(66, 194, 290, 88, "用户端", ["app.js · workbench.js"], WHITE, title_size=27, body_size=21),
        box(382, 194, 290, 88, "管理员端", ["admin.html · admin.js"], WHITE, title_size=27, body_size=21),
        box(698, 194, 350, 88, "本地状态", ["localStorage · workspace"], PALE_GREEN, title_size=27, body_size=21),
        f'<rect x="42" y="336" width="1040" height="174" rx="22" fill="{PALE_GREEN}" stroke="{GRID}" stroke-width="2"/>',
        text(70, 374, "编排层 · AI orchestration", 24, GREEN_DARK, 700),
        box(66, 394, 236, 88, "意图路由", ["本地快答优先"], WHITE, title_size=26, body_size=20),
        box(332, 394, 236, 88, "GraphRAG", ["证据 + 路径"], WHITE, title_size=26, body_size=20),
        box(600, 394, 236, 88, "工具协议", ["只生成草稿"], WHITE, title_size=26, body_size=20),
        box(868, 394, 180, 88, "模型通道", ["网关 / 直连"], PALE_TEAL, title_size=25, body_size=20),
        f'<rect x="42" y="536" width="1040" height="174" rx="22" fill="{WHITE}" stroke="{GRID}" stroke-width="2"/>',
        text(70, 574, "服务层 · Node.js + Express", 24, GREEN_DARK, 700),
        box(66, 594, 236, 88, "登录与家庭", ["auth · family"], WARM, title_size=25, body_size=20),
        box(332, 594, 236, 88, "同步接口", ["sync · version"], WARM, title_size=25, body_size=20),
        box(600, 594, 236, 88, "AI 网关", ["chat · vision"], WARM, title_size=25, body_size=20),
        box(868, 594, 180, 88, "安全与用量", ["audit · usage"], PALE_TEAL, title_size=24, body_size=19),
        f'<rect x="42" y="736" width="1040" height="174" rx="22" fill="{WHITE}" stroke="{GRID}" stroke-width="2"/>',
        text(70, 774, "事实层 · Deterministic state", 24, GREEN_DARK, 700),
        box(66, 794, 286, 88, "MySQL 快照", ["tianshu · snapshots"], WHITE, title_size=26, body_size=20),
        box(380, 794, 286, 88, "资源图谱", ["nodes · edges · community"], PALE_GREEN, title_size=26, body_size=20),
        box(696, 794, 352, 88, "操作记录", ["logs · undo · trace"], WHITE, title_size=26, body_size=20),
        line(562, 312, 562, 332, GREEN, 5, arrow=True),
        line(562, 512, 562, 532, GREEN, 5, arrow=True),
        line(562, 712, 562, 732, GREEN, 5, arrow=True),
        f'<rect x="1110" y="136" width="446" height="174" rx="22" fill="{PALE_TEAL}" stroke="{GRID}" stroke-width="2"/>',
        text(1140, 174, "外部能力", 25, GREEN_DARK, 700),
        text(1140, 214, "Agnes 文本模型", 24, INK),
        text(1140, 250, "Agnes 视觉模型", 24, INK),
        text(1140, 286, "SMTP / SMS / TTS（可选）", 21, MUTED),
        f'<rect x="1110" y="348" width="446" height="154" rx="22" fill="{WARM}" stroke="{GRID}" stroke-width="2"/>',
        text(1140, 386, "可信边界", 25, GREEN_DARK, 700),
        text(1140, 424, "模型：只读事实，生成草稿", 22, INK),
        text(1140, 460, "用户：确认后才允许写入", 22, INK),
        f'<rect x="1110" y="536" width="446" height="374" rx="22" fill="{WHITE}" stroke="{GRID}" stroke-width="2"/>',
        text(1140, 576, "Web 端特有差异", 25, GREEN_DARK, 700),
        text(1140, 618, "静态服务 8090", 24, INK),
        text(1140, 654, "用户端与管理员端共仓库", 21, MUTED),
        text(1140, 690, "桌面 / 窄屏响应式布局", 21, MUTED),
        text(1140, 726, "浏览器导入导出与语音能力", 21, MUTED),
        line(1090, 418, 1106, 418, GREEN, 4, arrow=True),
        text(48, 970, "关键约束：浏览器不持有服务端密钥，模型没有数据库写权限。", 23, GREEN_DARK, 700),
        text(48, 1012, "所有 AI 请求统一经编排层收敛，事实层通过确定 API 更新。", 22, MUTED),
    ]
    return svg_shell(w, h, "".join(body))


def ai_data_flow() -> str:
    w, h = 1600, 900
    body = [
        text(46, 56, "AI 数据处理与受控行动流", 38, INK, 700),
        text(46, 98, "读路径优先本地事实；写路径必须经过工具白名单和用户确认。", 23, MUTED),
        text(54, 150, "READ PATH · 问事实", 23, GREEN, 700),
        box(48, 178, 250, 118, "输入", ["文本问题", "照片 / 文件"], WHITE),
        box(348, 178, 250, 118, "意图识别", ["数量 / 位置 / 期限", "规划 / 开放问题"], WHITE),
        box(648, 178, 280, 118, "事实与证据", ["结构化库存", "知识库 + 图谱边"], PALE_GREEN),
        box(978, 178, 270, 118, "响应", ["本地直答或模型润色", "保留来源与调用模式"], PALE_TEAL),
        box(1298, 178, 254, 118, "用户", ["看到答案与依据", "继续追问或行动"], WHITE),
        line(298, 237, 344, 237, GREEN, 5, arrow=True),
        line(598, 237, 644, 237, GREEN, 5, arrow=True),
        line(928, 237, 974, 237, GREEN, 5, arrow=True),
        line(1248, 237, 1294, 237, GREEN, 5, arrow=True),
        text(54, 356, "WRITE PATH · 做动作", 23, GREEN, 700),
        box(48, 390, 220, 118, "工具草稿", ["adjust / shopping_add", "plan_execute"], WHITE),
        box(316, 390, 220, 118, "参数校验", ["对象必须存在", "数量在合法范围"], WHITE),
        box(584, 390, 240, 118, "预览卡", ["当前值 → 目标值", "明确影响范围"], PALE_GREEN),
        box(884, 390, 210, 118, "用户确认", ["取消：不写库", "执行：提交"], PALE_TEAL),
        box(1152, 390, 190, 118, "事实层", ["API 写入", "更新快照"], WHITE),
        box(1390, 390, 162, 118, "审计", ["日志 / 撤销"], WARM),
        line(268, 449, 312, 449, GREEN, 5, arrow=True),
        line(536, 449, 580, 449, GREEN, 5, arrow=True),
        line(824, 449, 880, 449, GREEN, 5, arrow=True),
        line(1094, 449, 1148, 449, GREEN, 5, arrow=True),
        line(1342, 449, 1386, 449, GREEN, 5, arrow=True),
        f'<rect x="46" y="584" width="1508" height="220" rx="24" fill="{WARM}" stroke="{GRID}" stroke-width="2"/>',
        text(78, 626, "失败与降级策略", 27, GREEN_DARK, 700),
        text(78, 674, "网关不可用：显式切换直连或返回错误，不伪造模型结果。", 23, INK),
        text(78, 718, "识别为空：返回空候选并提示重拍，不把模板内容写入库存。", 23, INK),
        text(78, 762, "写入失败：保留原状态；执行成功：记录日志并保留撤销入口。", 23, INK),
        text(46, 860, "红线：模型输出只能影响语言与草稿，不能越过确认门修改事实。", 23, GREEN_DARK, 700),
    ]
    return svg_shell(w, h, "".join(body))


def agent_sequence() -> str:
    w, h = 1600, 1070
    xs = [140, 430, 720, 1010, 1300]
    names = ["用户", "Web 界面", "AI 编排", "Node 网关", "MySQL"]
    body = [
        text(46, 54, "受控 Agent 写操作时序", 38, INK, 700),
        text(46, 96, "系统先读事实、再生成工具草稿；只有用户确认后才进入写入事务。", 23, MUTED),
    ]
    for x, name in zip(xs, names):
        body.append(box(x - 100, 148, 200, 72, name, [], PALE_GREEN if name == "AI 编排" else WHITE, title_size=26))
        body.append(line(x, 220, x, 930, GRID, 2, dashed=True))
    events = [
        (140, 430, 292, "1  输入问题 / 照片", GREEN),
        (430, 720, 338, "2  健康探测与请求", GREEN),
        (720, 430, 390, "3  本地事实或 GraphRAG 证据", GREEN),
        (430, 720, 448, "4  生成回答或工具草稿", GREEN),
        (720, 430, 506, "5  预览卡（对象 / 变化）", GREEN),
        (430, 140, 566, "6  用户确认 / 取消", GREEN),
        (430, 720, 630, "7  确认后的白名单动作", GREEN),
        (720, 1010, 690, "8  校验并提交", GREEN),
        (1010, 1300, 748, "9  事务写入", GREEN),
        (1300, 1010, 812, "10  返回版本", GREEN),
        (1010, 430, 872, "11  更新结果 + 日志 + 撤销入口", TEAL if False else GREEN),
    ]
    for x1, x2, y, label, color in events:
        body.append(line(x1, y, x2, y, color, 5, arrow=True))
        body.append(text(min(x1, x2) + 18, y - 12, label, 19, GREEN_DARK, 600))
    body.append(f'<rect x="530" y="510" width="104" height="72" rx="14" fill="{WHITE}" stroke="{GREEN}" stroke-width="3"/>')
    body.append(text(582, 552, "确认门", 23, GREEN_DARK, 700, "middle"))
    body.append(text(46, 1000, "任何未确认草稿只存在于界面，不触发库存、采购或方案写入。", 23, GREEN_DARK, 700))
    return svg_shell(w, h, "".join(body))


def deployment_topology() -> str:
    w, h = 1600, 930
    body = [
        text(46, 54, "Web 端部署拓扑", 38, INK, 700),
        text(46, 96, "本地评审使用两个端口与 MySQL；公网部署通过 HTTPS 反向代理收敛入口。", 23, MUTED),
        f'<rect x="40" y="136" width="990" height="650" rx="26" fill="{WARM}" stroke="{GRID}" stroke-width="2"/>',
        text(70, 176, "本机 / 内网", 25, GREEN_DARK, 700),
        box(72, 218, 410, 130, "Web 静态服务", ["127.0.0.1:8090", "index.html · admin.html"], WHITE),
        box(554, 218, 430, 130, "Node.js 后端", ["0.0.0.0:3000", "auth · sync · AI gateway"], PALE_GREEN),
        box(72, 414, 410, 130, "浏览器", ["用户端 / 管理员端", "localStorage + fetch"], PALE_TEAL),
        box(554, 414, 430, 130, "MySQL 8.x", ["127.0.0.1:3307", "tianshu · snapshots · graph"], WHITE),
        box(354, 604, 430, 110, "flow-bridge（可选）", ["127.0.0.1:3100", "跨设备页面接力"], PALE_TEAL),
        line(482, 283, 550, 283, GREEN, 5, arrow=True),
        line(770, 348, 770, 410, GREEN, 5, arrow=True),
        line(482, 480, 550, 480, GREEN, 5, arrow=True),
        line(770, 544, 770, 600, GREEN, 4, dashed=True, arrow=True),
        box(1100, 190, 430, 172, "Agnes AI 云服务", ["chat / vision", "HTTPS · 服务端 Key"], WHITE),
        box(1100, 410, 430, 172, "可选外部通道", ["SMTP / SMS", "TTS / 微信内容安全"], WARM),
        line(990, 274, 1096, 274, GREEN, 5, arrow=True),
        text(1025, 246, "HTTPS", 20, GREEN_DARK, 600),
        line(990, 478, 1096, 478, GREEN, 4, dashed=True, arrow=True),
        text(1050, 812, "公网发布：Web 与 API 都经 HTTPS 域名访问；MySQL 不暴露公网。", 22, GREEN_DARK, 600, "middle"),
        text(42, 858, "端口：Web 8090 · API 3000 · flow 3100 · MySQL 3307（按实际安装可改为 3306）。", 22, MUTED),
        text(42, 896, "评审包可携带服务端体验 Key；公开仓库只能保留 .env.example。", 22, MUTED),
    ]
    return svg_shell(w, h, "".join(body))


def frontend_modules() -> str:
    w, h = 1600, 900
    body = [
        text(46, 54, "前端模块依赖", 38, INK, 700),
        text(46, 96, "页面与状态解耦；AI、图谱和后端通过明确的服务边界协作。", 23, MUTED),
        box(48, 174, 330, 196, "页面 / 视图", ["index.html", "app.js · admin.js", "workbench · graph-view"], WHITE),
        box(470, 174, 330, 196, "业务状态", ["window.API", "mockapi.js", "localStorage / snapshot"], PALE_GREEN),
        box(892, 174, 330, 196, "AI 编排", ["ai.js · commands.js", "graph-rag.js", "agnes.js"], PALE_TEAL),
        box(48, 480, 330, 196, "资源图谱", ["graph.js", "graphQuery.js", "来源与路径"], WHITE),
        box(470, 480, 330, 196, "知识库", ["知识、菜谱、规则", "来源与版本"], WHITE),
        box(892, 480, 330, 196, "后端服务", ["Express · MySQL", "AI 网关 · 同步"], WARM),
        line(378, 272, 466, 272, GREEN, 5, arrow=True),
        line(800, 272, 888, 272, GREEN, 5, arrow=True),
        line(1057, 370, 1057, 476, GREEN, 5, arrow=True),
        line(800, 578, 888, 578, GREEN, 5, arrow=True),
        line(470, 578, 382, 578, GREEN, 5, arrow=True),
        path("M 720 380 L 720 430 L 213 430 L 213 476", GREEN, 4, dashed=True, arrow=True),
        text(220, 420, "事实查询", 20, GREEN_DARK, 600),
        text(48, 776, "禁止：页面直接写数据库、模型直接改库存、密钥进入公开构建产物。", 23, GREEN_DARK, 700),
        text(48, 820, "建议：新功能沿用 window.API 与 GraphRAG 服务，避免复制状态逻辑。", 22, MUTED),
    ]
    return svg_shell(w, h, "".join(body))


def build() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    figures = {
        "01_Web系统架构.svg": system_architecture(),
        "02_AI数据处理与受控行动流.svg": ai_data_flow(),
        "03_受控Agent时序.svg": agent_sequence(),
        "04_Web部署拓扑.svg": deployment_topology(),
        "05_前端模块依赖.svg": frontend_modules(),
    }
    for name, content in figures.items():
        (OUT / name).write_text(content, encoding="utf-8")
        print(OUT / name)


if __name__ == "__main__":
    build()
