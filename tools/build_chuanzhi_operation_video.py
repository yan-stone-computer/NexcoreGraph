# -*- coding: utf-8 -*-
"""Build the operation-first ChuanZhi Cup mini-program demo.

Run in three bounded stages so a long render can resume without redoing
voice generation or unrelated scenes:

    python tools/build_chuanzhi_operation_video.py --stage voice
    python tools/build_chuanzhi_operation_video.py --stage scenes
    python tools/build_chuanzhi_operation_video.py --stage assemble
"""
from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path


ROOT = Path(r"D:\ProjectFiles\GithubPackage\NexcoreGraph")
TOOLS = ROOT / "tools"
WORK = ROOT / "deliverables" / "video-new"
ASSETS = WORK / "assets"
BUILD = WORK / "build-operation"
VOICE = WORK / "voice-operation"
RENDERS = WORK / "renders"
OUT = RENDERS / "启核图策-小程序端实操增强版.mp4"
SRT_OUT = RENDERS / "启核图策-小程序端实操增强版-字幕.srt"
ASS_OUT = RENDERS / "启核图策-小程序端实操增强版-字幕.ass"
STORY_OUT = WORK / "口播稿与分镜-实操增强版.md"
SUBMIT_DIR = ROOT / "deliverables" / "传智杯_启核图策_小程序端" / "07_演示视频"

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"
EDGE_TTS = shutil.which("edge-tts") or "edge-tts"
FPS = 30
VOICE_NAME = "zh-CN-YunxiNeural"

sys.path.insert(0, str(TOOLS))
from build_chuanzhi_miniapp_video import (  # noqa: E402
    duration,
    escape_ass,
    format_ass_time,
    format_srt_time,
    parse_srt,
    run,
    split_caption,
)


SCENES = [
    {
        "id": "01",
        "kind": "plain",
        "source": ASSETS / "hf-intro-outro.mp4",
        "segments": [(0.0, 7.3)],
        "speed": 1.0,
        "target": 10.0,
        "freeze": 2.0,
        "voice": "一张家庭照片，能不能直接变成全家可以执行的行动？启核图策，连接库存、预警、方案、采购和协作。接下来进入真实小程序操作。",
    },
    {
        "id": "02",
        "kind": "operation",
        "source": ASSETS / "operations-full-20261024.mp4",
        "segments": [(0.0, 45.0)],
        "speed": 3.00,
        "target": 14.0,
        "kicker": "实机操作 · 首页看板",
        "title": "首页总览\n库存、预警和待办",
        "bullets": [
            "总库存、临期与低库存同步汇总",
            "冰箱、食品柜、药箱和衣柜分类呈现",
            "临期条目直接进入今日待办",
        ],
        "voice": "首页先汇总总库存、临期和低库存，库存构成按冰箱、食品柜、药箱和衣柜拆分。向下滑动，临期物品直接进入今日待办，首页一眼就能判断今天该处理什么。",
    },
    {
        "id": "03",
        "kind": "operation",
        "source": ASSETS / "simulator-demo-raw.mp4",
        "segments": [(0.0, 42.0)],
        "speed": 2.20,
        "target": 18.0,
        "kicker": "AI 能力 · 视觉识别",
        "title": "拍照入库\n先识别，再确认",
        "bullets": [
            "视觉模型返回名称、数量、位置、保质期",
            "候选字段可以逐项修改，支持连拍合并",
            "确认之后才把结果写入库存",
        ],
        "voice": "点击示例照片，视觉模型开始识别名称、数量、位置和保质期。识别结果不是直接写入，而是先变成可以逐项修改的候选卡片；确认数量、库位和分类之后，才会执行入库。",
    },
    {
        "id": "04",
        "kind": "operation",
        "source": ASSETS / "simulator-demo-raw.mp4",
        "segments": [(24.0, 34.0), (44.0, 62.0)],
        "speed": 1.90,
        "target": 16.0,
        "kicker": "实机操作 · 确认入库",
        "title": "确认入库\n页面与数据同步",
        "bullets": [
            "首页统计随入库结果同步刷新",
            "资源库新增物品，可继续搜索与编辑",
            "详情页保留数量和位置等结构化字段",
        ],
        "voice": "确认入库后，资源库和首页同步刷新。进入物品详情，可以继续调整数量与位置；资源库支持搜索、新建库和逐项编辑，所有变化都保留可回读的数据记录。",
    },
    {
        "id": "05",
        "kind": "operation",
        "source": ASSETS / "operations-full-20261024.mp4",
        "segments": [(76.0, 101.0), (118.0, 146.0), (146.0, 168.0)],
        "speed": 4.00,
        "target": 20.0,
        "kicker": "实机操作 · 预警到方案",
        "title": "预警转行动\n方案可直接执行",
        "bullets": [
            "按临期优先、清库存、营养均衡生成方案",
            "展示用料、耗时、热量和蛋白质",
            "执行会扣减库存，撤销可以回滚",
        ],
        "voice": "预警中心把临期风险转成行动。进入方案页，系统按照临期优先、清库存和营养均衡生成菜谱，并标出用料、耗时、热量和蛋白质。点击执行会扣减库存，执行错了还可以撤销回滚。",
    },
    {
        "id": "06",
        "kind": "operation",
        "source": ASSETS / "operations-full-20261024.mp4",
        "segments": [(180.0, 207.0), (207.0, 224.0)],
        "speed": 2.80,
        "target": 17.0,
        "kicker": "实机操作 · 采购清单",
        "title": "采购清单\n补齐方案缺口",
        "bullets": [
            "方案缺口与低库存自动汇总",
            "已购项目可以直接勾选",
            "补货数量与库存联动",
        ],
        "voice": "方案缺口和低库存会自动汇总成采购清单。已购买项目可以直接勾选，补货数量会与库存联动；采购完成后，这些物品又能参与下一轮方案计算。",
    },
    {
        "id": "07",
        "kind": "operation",
        "source": ASSETS / "operations-full-20261024.mp4",
        "segments": [(270.0, 302.0)],
        "speed": 2.30,
        "target": 15.0,
        "kicker": "AI 能力 · 本地图谱",
        "title": "AI 工作台\n快问直接答",
        "bullets": [
            "高频库存问题不走模型",
            "开放问题进入 GraphRAG",
            "回答标注节点、关系与模型证据",
        ],
        "voice": "AI 工作台把对话接进真实数据。高频库存问题由本地图谱直接回答，不调用模型；开放问题再交给 GraphRAG，回答下方会显示节点、关系和模型调用证据。",
    },
    {
        "id": "08",
        "kind": "operation",
        "source": ASSETS / "operations-full-20261024.mp4",
        "segments": [(350.0, 362.0), (385.0, 408.0)],
        "speed": 2.40,
        "target": 16.0,
        "kicker": "AI 能力 · 餐食规划",
        "title": "今晚吃什么\n结合真实库存回答",
        "bullets": [
            "读取临期食材、营养目标与真实存量",
            "生成多套可核销的餐食方案",
            "从建议直接进入执行",
        ],
        "voice": "比如问今晚吃什么，AI 会读取临期食材、营养目标和库里真实存量，给出多套可执行的菜谱，并直接生成对应的方案卡片。",
    },
    {
        "id": "09",
        "kind": "operation",
        "source": ASSETS / "operations-full-20261024.mp4",
        "segments": [
            (318.0, 350.0),
            (405.0, 415.0),
            (ASSETS / "op-ai-confirm-20261025c.mp4", 0.8, 8.2, 1.7),
        ],
        "speed": 2.80,
        "target": 20.0,
        "kicker": "AI 能力 · 多轮行动",
        "title": "继续追问\n从问答走到行动",
        "bullets": [
            "追问优先级、采买与消耗",
            "写操作先生成预览卡",
            "用户确认后才修改库存",
        ],
        "voice": "继续追问本周先处理什么，或者鸡蛋只剩五个，回答会回到库存与预警，推荐消耗或采买动作。涉及写操作时，模型只能生成预览，必须由用户确认以后才执行。",
    },
    {
        "id": "10",
        "kind": "operation",
        "source": ASSETS / "op-library-outfit-clean-20261024.mp4",
        "segments": [(17.0, 33.0), (34.0, 58.0)],
        "speed": 2.30,
        "target": 18.0,
        "kicker": "AI 能力 · 衣橱搭配",
        "title": "12°C 通勤\n读取真实衣物库存",
        "bullets": [
            "按温度和场合选择衣柜场景",
            "生成可直接执行的搭配方案",
            "列出鞋、围巾和包的库存依据",
        ],
        "voice": "衣柜也可以被结构化。选择温度和场合，AI 读取真实衣物库存，生成一套通勤搭配，并列出鞋、围巾和包的具体库存依据。",
    },
    {
        "id": "11",
        "kind": "operation",
        "source": ASSETS / "op-family-real-20261024.mp4",
        "segments": [(0.0, 15.0)],
        "speed": 1.25,
        "target": 13.0,
        "kicker": "实机操作 · 家庭协作",
        "title": "家庭协作池\n一次录入，全家同步",
        "bullets": [
            "通过邀请码加入协作池",
            "跨设备实时同步资源状态",
            "共同维护库存与行动进度",
        ],
        "voice": "家庭协作池通过邀请码加入，并支持跨设备实时同步。一个人录入，全家看到；一个人执行扣减，其他设备立即同步最新库存。",
    },
    {
        "id": "12",
        "kind": "plain",
        "source": ASSETS / "hf-intro-outro.mp4",
        "segments": [(8.0, 15.2)],
        "speed": 1.0,
        "target": 11.0,
        "freeze": 3.0,
        "voice": "从识别、整理、预警，到规划、采购和协作，启核图策让每一件家庭资源，都能转化成下一步行动。",
    },
]


def make_cut(scene: dict) -> Path:
    output = BUILD / f"{scene['id']}-cut.mp4"
    parts = []
    labels = []
    sources: list[Path] = []
    for segment in scene["segments"]:
        source = scene["source"] if len(segment) == 2 else segment[0]
        if source not in sources:
            sources.append(source)
    for idx, segment in enumerate(scene["segments"]):
        if len(segment) == 2:
            source = scene["source"]
            start, end = segment
            speed = scene["speed"]
        else:
            source, start, end, speed = segment
        label = f"v{idx}"
        labels.append(f"[{label}]")
        parts.append(
            f"[{sources.index(source)}:v]trim=start={start:.3f}:end={end:.3f},"
            f"setpts=(PTS-STARTPTS)/{speed:.4f},"
            "scale=512:1080:force_original_aspect_ratio=decrease,"
            "pad=512:1080:(ow-iw)/2:(oh-ih)/2:color=0x101010,"
            f"setsar=1,fps={FPS}[{label}]"
        )
    if len(labels) == 1:
        tail = f"{labels[0]}null,tpad=stop_mode=clone:stop_duration=8[v]"
    else:
        tail = (
            f"{''.join(labels)}concat=n={len(labels)}:v=1:a=0,"
            "tpad=stop_mode=clone:stop_duration=8[v]"
        )
    filter_complex = ";".join(parts + [tail])
    input_args: list[str] = []
    for source in sources:
        input_args.extend(["-i", str(source)])
    run([
        FFMPEG, "-y", *input_args,
        "-filter_complex", filter_complex, "-map", "[v]", "-an",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "18",
        "-pix_fmt", "yuv420p", str(output),
    ])
    return output


def make_plain(scene: dict, cut: Path, seconds: float) -> Path:
    output = BUILD / f"{scene['id']}-video.mp4"
    vf = (
        "scale=1920:1080:force_original_aspect_ratio=decrease,"
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xFBF7F2,"
        f"tpad=stop_mode=clone:stop_duration={scene.get('freeze', 2.0):.2f},"
        "format=yuv420p"
    )
    run([
        FFMPEG, "-y", "-i", str(cut), "-vf", vf, "-t", f"{seconds:.3f}",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(output),
    ])
    return output


def textfile_arg(path: Path) -> str:
    return str(path).replace("\\", "/").replace(":", "\\:")


def make_operation(scene: dict, cut: Path, seconds: float) -> Path:
    sid = scene["id"]
    kicker_file = BUILD / f"{sid}-kicker.txt"
    title_file = BUILD / f"{sid}-title.txt"
    body_file = BUILD / f"{sid}-body.txt"
    kicker_file.write_text(scene["kicker"], encoding="utf-8")
    title_file.write_text(scene["title"], encoding="utf-8")
    body_file.write_text(
        "\n".join(f"• {item}" for item in scene["bullets"]),
        encoding="utf-8",
    )

    f_bold = "C\\:/Windows/Fonts/msyhbd.ttc"
    f_body = "C\\:/Windows/Fonts/msyh.ttc"
    fc = (
        "[0:v]drawbox=x=680:y=56:w=1160:h=968:color=0xFBF7F2:t=fill,"
        "drawbox=x=680:y=56:w=1160:h=968:color=0xDED3C5:t=4,"
        "drawbox=x=680:y=56:w=12:h=968:color=0x4C9F70:t=fill[bg];"
        "[1:v]scale=-2:940:flags=lanczos,format=yuv420p[phone];"
        "[bg][phone]overlay=x=145:y=72:shortest=1,"
        f"drawtext=fontfile='{f_body}':textfile='{textfile_arg(kicker_file)}':"
        "expansion=none:fontcolor=0x4C9F70:fontsize=28:x=752:y=112,"
        f"drawtext=fontfile='{f_bold}':textfile='{textfile_arg(title_file)}':"
        "expansion=none:fontcolor=0x1E2A26:fontsize=54:line_spacing=14:x=752:y=166,"
        f"drawtext=fontfile='{f_body}':textfile='{textfile_arg(body_file)}':"
        "expansion=none:fontcolor=0x34453D:fontsize=35:line_spacing=24:x=752:y=410,"
        f"drawtext=fontfile='{f_body}':text='真实小程序录屏 · 无静态替代':"
        "fontcolor=0x748078:fontsize=24:x=752:y=880,"
        f"drawtext=fontfile='{f_body}':text='{sid} / 12':"
        "fontcolor=0x748078:fontsize=24:x=1685:y=943,"
        "format=yuv420p[v]"
    )
    output = BUILD / f"{sid}-video.mp4"
    run([
        FFMPEG, "-y",
        "-f", "lavfi", "-i", f"color=c=0xF4EEE5:s=1920x1080:r={FPS}:d={seconds:.3f}",
        "-i", str(cut),
        "-filter_complex", fc, "-map", "[v]", "-t", f"{seconds:.3f}",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(output),
    ])
    return output


def add_voice(video: Path, voice: Path, seconds: float, output: Path) -> None:
    run([
        FFMPEG, "-y", "-i", str(video), "-i", str(voice),
        "-filter_complex",
        f"[0:v]trim=duration={seconds:.3f},setpts=PTS-STARTPTS[v];"
        "[1:a]adelay=250:all=1,apad=pad_dur=3[a]",
        "-map", "[v]", "-map", "[a]", "-t", f"{seconds:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
        "-ar", "48000", "-ac", "2", str(output),
    ])


def synthesize_voices(force: bool = False) -> None:
    VOICE.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        stem = VOICE / scene["id"]
        text_path = stem.with_suffix(".txt")
        media_path = stem.with_suffix(".mp3")
        subtitle_path = stem.with_suffix(".srt")
        text_path.write_text(scene["voice"], encoding="utf-8")
        if not force and media_path.exists() and subtitle_path.exists():
            print(f"VOICE {scene['id']} reused", flush=True)
            continue
        run([
            EDGE_TTS, "--file", str(text_path), "--voice", VOICE_NAME,
            "--rate", "+6%", "--write-media", str(media_path),
            "--write-subtitles", str(subtitle_path), "--no-progress",
        ])
        print(
            f"VOICE {scene['id']} {duration(media_path):.2f}s",
            flush=True,
        )


def build_scenes(only: set[str] | None = None) -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    VOICE.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        sid = scene["id"]
        if only and sid not in only:
            continue
        voice_path = VOICE / f"{sid}.mp3"
        subtitle_path = VOICE / f"{sid}.srt"
        if not voice_path.exists() or not subtitle_path.exists():
            raise FileNotFoundError(f"Missing voice assets for scene {sid}")
        seconds = max(scene["target"], duration(voice_path) + 0.60)
        cut = make_cut(scene)
        if scene["kind"] == "operation":
            video = make_operation(scene, cut, seconds)
        else:
            video = make_plain(scene, cut, seconds)
        add_voice(video, voice_path, seconds, BUILD / f"{sid}-av.mp4")
        print(f"SCENE {sid} {seconds:.2f}s", flush=True)


def write_captions(scene_starts: list[float]) -> None:
    srt_blocks: list[str] = []
    ass_events: list[str] = []
    global_index = 1
    for scene, offset in zip(SCENES, scene_starts):
        for start, end, text in parse_srt(VOICE / f"{scene['id']}.srt"):
            chunks = split_caption(text, max_chars=20)
            total = sum(max(1, len(chunk)) for chunk in chunks)
            cursor = start
            span = max(0.8, end - start)
            for chunk in chunks:
                share = span * max(1, len(chunk)) / total
                cue_end = min(end, cursor + max(0.55, share))
                s_start = offset + cursor + 0.25
                s_end = offset + cue_end + 0.25
                srt_blocks.append(
                    f"{global_index}\n"
                    f"{format_srt_time(s_start)} --> {format_srt_time(s_end)}\n"
                    f"{chunk}\n"
                )
                ass_events.append(
                    f"Dialogue: 0,{format_ass_time(s_start)},{format_ass_time(s_end)},"
                    f"Caption,,0,0,0,,{escape_ass(chunk)}"
                )
                global_index += 1
                cursor = cue_end
    SRT_OUT.parent.mkdir(parents=True, exist_ok=True)
    SRT_OUT.write_text("\n".join(srt_blocks), encoding="utf-8")
    ass_header = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
ScaledBorderAndShadow: yes
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Caption,Microsoft YaHei,44,&H00FFFFFF,&H00FFFFFF,&H001B241E,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,120,120,90,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ASS_OUT.write_text(ass_header + "\n".join(ass_events) + "\n", encoding="utf-8")


def write_storyboard(scene_starts: list[float], scene_durations: list[float]) -> None:
    rows = [
        "# 启核图策小程序端 · 实操增强版分镜",
        "",
        "视频以真实小程序操作和 AI 功能为主线，1920×1080、30 fps。"
        "旁白为 Edge TTS 中文男声，字幕与成片音轨同步。",
        "",
        "| 场景 | 时间 | 画面与操作 | 口播 |",
        "|---|---:|---|---|",
    ]
    for scene, start, seconds in zip(SCENES, scene_starts, scene_durations):
        end = start + seconds
        visual = scene.get("title", "品牌片头/片尾").replace("\n", " · ")
        if scene["kind"] == "operation":
            visual = f"真实录屏：{visual}"
        rows.append(
            f"| {scene['id']} | {start:.1f}–{end:.1f}s | "
            f"{visual} | {scene['voice']} |"
        )
    rows += [
        "",
        "## 证据边界",
        "",
        "- 功能画面全部来自微信开发者工具中的真实小程序录屏。",
        "- 片头与片尾仅承担品牌包装，不作为功能证据。",
        "- 旁白不披露视频、图片和 PPT 的制作工具。",
    ]
    STORY_OUT.write_text("\n".join(rows) + "\n", encoding="utf-8")


def assemble() -> None:
    av_files = [BUILD / f"{scene['id']}-av.mp4" for scene in SCENES]
    missing = [path for path in av_files if not path.exists()]
    if missing:
        raise FileNotFoundError(f"Missing scene files: {missing}")

    concat_file = BUILD / "concat.txt"
    concat_file.write_text(
        "\n".join(f"file '{path.as_posix()}'" for path in av_files) + "\n",
        encoding="utf-8",
    )
    joined = BUILD / "joined.mp4"
    run([
        FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_file),
        "-c", "copy", str(joined),
    ])

    scene_durations = [duration(path) for path in av_files]
    scene_starts: list[float] = []
    cursor = 0.0
    for seconds in scene_durations:
        scene_starts.append(cursor)
        cursor += seconds
    write_captions(scene_starts)
    write_storyboard(scene_starts, scene_durations)

    total = duration(joined)
    ass_path = str(ASS_OUT).replace("\\", "/").replace(":", "\\:")
    vf = (
        f"ass='{ass_path}',"
        "fade=t=in:st=0:d=0.35,"
        f"fade=t=out:st={max(0, total-0.8):.3f}:d=0.8,"
        "format=yuv420p"
    )
    af = (
        "afade=t=in:st=0:d=0.25,"
        f"afade=t=out:st={max(0, total-0.8):.3f}:d=0.8,"
        "loudnorm=I=-18:TP=-1.5:LRA=9"
    )
    run([
        FFMPEG, "-y", "-i", str(joined), "-vf", vf, "-af", af,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", str(OUT),
    ])

    SUBMIT_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copy2(OUT, SUBMIT_DIR / OUT.name)
    shutil.copy2(SRT_OUT, SUBMIT_DIR / SRT_OUT.name)
    shutil.copy2(STORY_OUT, SUBMIT_DIR / STORY_OUT.name)

    print(f"WROTE {OUT}", flush=True)
    print(f"DURATION {duration(OUT):.2f}s", flush=True)
    print(f"SIZE {OUT.stat().st_size / 1024 / 1024:.2f} MiB", flush=True)
    print(f"STORY {STORY_OUT}", flush=True)
    assert OUT.exists() and OUT.stat().st_size > 1_000_000
    assert len(parse_srt(SRT_OUT)) >= len(SCENES)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--stage",
        choices=("voice", "scenes", "assemble", "all"),
        required=True,
    )
    parser.add_argument("--force-voice", action="store_true")
    parser.add_argument(
        "--only",
        help="Comma-separated scene IDs for the scenes stage; default renders all.",
    )
    args = parser.parse_args()

    if args.stage in ("voice", "all"):
        synthesize_voices(force=args.force_voice)
    if args.stage in ("scenes", "all"):
        only = {item.strip() for item in args.only.split(",")} if args.only else None
        build_scenes(only=only)
    if args.stage in ("assemble", "all"):
        assemble()


if __name__ == "__main__":
    main()
