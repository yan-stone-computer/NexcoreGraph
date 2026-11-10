# -*- coding: utf-8 -*-
"""Build the 5-8 minute AI Web Challenge demo from real screens and slides."""
from __future__ import annotations

import argparse
import math
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(r"D:\ProjectFiles\GithubPackage\NexcoreGraph")
PKG = ROOT / "deliverables" / "传智杯_启核图策_Web端"
VIDEO_DIR = PKG / "03_演示视频"
SLIDES = ROOT / "deliverables" / "_web_deck_build" / "rendered"
RAW = ROOT / "deliverables" / "nexcoregraph-intro" / "assets" / "screen-demo.mp4"
BUILD = ROOT / "deliverables" / "_web_video_build"
VOICE = BUILD / "voice"
CLIPS = BUILD / "clips"
OUT = VIDEO_DIR / "启核图策-Web端演示视频.mp4"
SRT_OUT = VIDEO_DIR / "启核图策-Web端演示视频-字幕.srt"
ASS_OUT = VIDEO_DIR / "启核图策-Web端演示视频-字幕.ass"
STORY_OUT = VIDEO_DIR / "口播稿与分镜.md"

FPS = 30
VOICE_NAME = "zh-CN-YunxiNeural"
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"
EDGE_TTS = shutil.which("edge-tts") or "edge-tts"


SCENES = [
    {
        "id": "01",
        "kind": "slide",
        "image": "slide-01.png",
        "target": 16.0,
        "voice": "启核图策面向家庭资源管理。它从一张照片开始，把识别、证据、方案和受控执行连成一条连续流程。",
    },
    {
        "id": "02",
        "kind": "slide",
        "image": "slide-02.png",
        "target": 30.0,
        "voice": "家庭里真正麻烦的，不是完全没记录，而是记录没有变成下一步行动。物品散落在不同库位，普通聊天又缺少库存事实，建议也无法直接进入采购或消耗。启核图策把可信数据和可执行行动放在同一个系统中。",
    },
    {
        "id": "03",
        "kind": "slide",
        "image": "slide-03.png",
        "target": 30.0,
        "voice": "主流程从拍照开始。视觉模型返回结构化候选，用户补缺并确认入库。之后系统读取库存与图谱证据，生成方案或动作草稿，最后由用户确认执行，写入日志并保留撤销入口。",
    },
    {
        "id": "04",
        "kind": "operation",
        "start": 0.0,
        "end": 30.0,
        "speed": 0.95,
        "target": 34.0,
        "kicker": "REAL WEB WORKSPACE",
        "title": "先看真实工作区",
        "bullets": ["桌面与窄屏共用业务状态", "首页直接显示临期与低库存", "AI 工作台把待办和对话放在首屏"],
        "voice": "现在进入 Web 端真实界面。登录后首先看到 AI 工作台和首页数据：资源总数、临期预警、采购与方案状态来自同一份工作区。这里的数字由代码计算，不是模型写出的文案。",
    },
    {
        "id": "05",
        "kind": "slide",
        "image": "slide-08.png",
        "target": 38.0,
        "kicker": "MULTIMODAL INVENTORY",
        "title": "库存与预警进入行动",
        "bullets": ["资源库支持多种家庭物品类型", "临期与低库存进入待办", "写操作保留日志和撤销"],
        "voice": "资源库不限定为食材。冰箱、药箱、工具箱和书架使用同一个物品模型。临期、过期和低库存会进入预警中心，形成可处理的今日事项，而不是只停留在静态列表。",
    },
    {
        "id": "06",
        "kind": "operation",
        "start": 54.0,
        "end": 81.0,
        "speed": 0.66,
        "target": 44.0,
        "kicker": "GRAPHRAG EVIDENCE",
        "title": "图谱让证据可追溯",
        "bullets": ["库存、菜谱、规则和场景形成关系", "支持邻域和多跳路径", "回答保留节点、边和来源"],
        "voice": "资源图谱把家庭、库、物品、菜谱、规则和场景连接起来。系统先检索结构化事实，再装配图谱邻域或多跳路径，最后才把证据交给模型组织语言。这样回答有来源，也能解释为什么得出这个结论。",
    },
    {
        "id": "07",
        "kind": "slide",
        "image": "slide-07.png",
        "target": 46.0,
        "kicker": "AGENT SAFETY",
        "title": "模型只能提议，不能越权",
        "bullets": ["写操作先生成动作草稿", "对象和数量经过代码校验", "用户确认后才执行并可撤销"],
        "voice": "AI 对话接入了真实库存和知识库。高频问题走本地快答，开放问题才进入 GraphRAG。涉及修改数量、加入采购或执行方案时，模型只能生成受约束的工具草稿，必须由用户确认以后才能真正写入。",
    },
    {
        "id": "08",
        "kind": "operation",
        "start": 104.0,
        "end": 128.0,
        "speed": 0.64,
        "target": 40.0,
        "kicker": "COLLABORATION & ADMIN",
        "title": "协作与治理共用真实数据",
        "bullets": ["家庭成员通过同一工作区协作", "管理员查看聚合指标", "聊天和密钥不随公开材料发布"],
        "voice": "家庭协作通过同一账号和结构化快照同步，管理员端展示用户、家庭、审计、AI 用量和图谱的聚合指标。聚合页默认不展开个人库存和聊天正文，方便在可治理和可演示之间保持边界。",
    },
    {
        "id": "09",
        "kind": "slide",
        "image": "slide-05.png",
        "target": 40.0,
        "voice": "AI 集成没有把所有问题都交给模型。问候和页面跳转由本地路由处理，数量、位置和期限由确定性查询回答，复杂问题进入 GraphRAG，图片进入视觉模型，写操作进入受控工具链。后端统一持有密钥和超时策略。",
    },
    {
        "id": "10",
        "kind": "slide",
        "image": "slide-10.png",
        "target": 34.0,
        "voice": "对应赛道评分，AI 技术深度占百分之三十五，创新性占百分之二十五。作品以视觉输入、GraphRAG 证据和可撤销执行作为核心证据，同时保持明确的工程边界和可复核材料。",
    },
    {
        "id": "11",
        "kind": "slide",
        "image": "slide-11.png",
        "target": 16.0,
        "voice": "启核图策让每一件家庭资源，进入下一项可确认、可执行、可追溯的行动。",
    },
]


def run(cmd: list[str]) -> None:
    proc = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode:
        raise RuntimeError("\n".join([f"Command failed: {cmd}", proc.stderr[-6000:]]))


def duration(path: Path) -> float:
    proc = subprocess.run(
        [
            FFPROBE,
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode:
        raise RuntimeError(proc.stderr[-3000:])
    return float(proc.stdout.strip())


def format_srt_time(seconds: float) -> str:
    ms = int(round(seconds * 1000))
    h, rem = divmod(ms, 3600000)
    m, rem = divmod(rem, 60000)
    s, ms = divmod(rem, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def format_ass_time(seconds: float) -> str:
    cs = int(round(seconds * 100))
    h, rem = divmod(cs, 360000)
    m, rem = divmod(rem, 6000)
    s, cs = divmod(rem, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    text = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").strip()
    cues: list[tuple[float, float, str]] = []
    for block in re.split(r"\n{2,}", text):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 3:
            continue
        stamp = re.search(
            r"(\d+):(\d+):(\d+),(\d+)\s+-->\s+(\d+):(\d+):(\d+),(\d+)",
            lines[1],
        )
        if not stamp:
            continue
        values = [int(x) for x in stamp.groups()]
        start = values[0] * 3600 + values[1] * 60 + values[2] + values[3] / 1000
        end = values[4] * 3600 + values[5] * 60 + values[6] + values[7] / 1000
        cues.append((start, end, " ".join(lines[2:])))
    return cues


def split_caption(text: str, limit: int = 20) -> list[str]:
    clean = re.sub(r"\s+", "", text)
    chunks: list[str] = []
    current = ""
    for ch in clean:
        current += ch
        if len(current) >= limit or (ch in "。；，、！？" and len(current) >= 9):
            chunks.append(current)
            current = ""
    if current:
        chunks.append(current)
    return chunks or [clean]


def synthesize() -> None:
    VOICE.mkdir(parents=True, exist_ok=True)
    for scene in SCENES:
        text_path = VOICE / f"{scene['id']}.txt"
        audio_path = VOICE / f"{scene['id']}.mp3"
        srt_path = VOICE / f"{scene['id']}.srt"
        text_path.write_text(scene["voice"], encoding="utf-8")
        run(
            [
                EDGE_TTS,
                "--file",
                str(text_path),
                "--voice",
                VOICE_NAME,
                "--rate",
                "+5%",
                "--write-media",
                str(audio_path),
                "--write-subtitles",
                str(srt_path),
                "--no-progress",
            ]
        )
        print(f"VOICE {scene['id']} {duration(audio_path):.2f}s", flush=True)


def encode_slide(scene: dict, seconds: float) -> Path:
    source = SLIDES / scene["image"]
    output = CLIPS / f"{scene['id']}-video.mp4"
    frames = math.ceil(seconds * FPS)
    vf = (
        "scale=2000:1125:flags=lanczos,"
        f"zoompan=z='min(zoom+0.00012,1.02)':d={frames}:s=1920x1080:fps={FPS},"
        f"trim=duration={seconds:.3f},setpts=PTS-STARTPTS,format=yuv420p"
    )
    run(
        [
            FFMPEG,
            "-y",
            "-loop",
            "1",
            "-i",
            str(source),
            "-vf",
            vf,
            "-t",
            f"{seconds:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            str(output),
        ]
    )
    return output


def encode_operation(scene: dict, seconds: float) -> Path:
    output = CLIPS / f"{scene['id']}-video.mp4"
    title_file = CLIPS / f"{scene['id']}-title.txt"
    body_file = CLIPS / f"{scene['id']}-body.txt"
    kicker_file = CLIPS / f"{scene['id']}-kicker.txt"
    title_file.write_text(scene["title"], encoding="utf-8")
    body_file.write_text("\n".join(f"• {x}" for x in scene["bullets"]), encoding="utf-8")
    kicker_file.write_text(scene["kicker"], encoding="utf-8")

    def esc(path: Path) -> str:
        return str(path).replace("\\", "/").replace(":", "\\:")

    bold = "C\\:/Windows/Fonts/msyhbd.ttc"
    body = "C\\:/Windows/Fonts/msyh.ttc"
    raw_seconds = (scene["end"] - scene["start"]) / scene["speed"]
    tail = max(0.0, seconds - raw_seconds)
    fc = (
        f"[0:v]trim=start={scene['start']:.3f}:end={scene['end']:.3f},"
        f"setpts=(PTS-STARTPTS)/{scene['speed']:.4f},fps={FPS},"
        f"scale=1200:750:flags=lanczos,"
        f"tpad=stop_mode=clone:stop_duration={max(8.0, tail):.3f}[screen];"
        "[1:v]drawbox=x=0:y=0:w=1920:h=1080:color=0xF5F9FB:t=fill,"
        "drawbox=x=64:y=82:w=520:h=900:color=0xFFFFFF:t=fill,"
        "drawbox=x=64:y=82:w=520:h=900:color=0xD9E8E1:t=3,"
        "drawbox=x=640:y=140:w=1200:h=750:color=0xD9E8E1:t=4[bg];"
        "[bg][screen]overlay=x=640:y=140:shortest=1,"
        f"drawtext=fontfile='{body}':textfile='{esc(kicker_file)}':"
        "expansion=none:fontcolor=0x28A96A:fontsize=24:x=96:y=122,"
        f"drawtext=fontfile='{bold}':textfile='{esc(title_file)}':"
        "expansion=none:fontcolor=0x15251D:fontsize=48:line_spacing=8:x=96:y=176,"
        f"drawtext=fontfile='{body}':textfile='{esc(body_file)}':"
        "expansion=none:fontcolor=0x36483F:fontsize=28:line_spacing=24:x=96:y=310,"
        f"drawtext=fontfile='{body}':text='Web 端真实操作录屏':"
        "fontcolor=0x28A96A:fontsize=25:x=96:y=900,"
        f"drawtext=fontfile='{body}':text='{scene['id']} / 11':"
        "fontcolor=0x64766D:fontsize=21:x=1740:y=950,"
        "format=yuv420p[v]"
    )
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(RAW),
            "-f",
            "lavfi",
            "-i",
            f"color=c=0xF5F9FB:s=1920x1080:r={FPS}:d={seconds:.3f}",
            "-filter_complex",
            fc,
            "-map",
            "[v]",
            "-t",
            f"{seconds:.3f}",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            str(output),
        ]
    )
    return output


def add_audio(video: Path, audio: Path, seconds: float, output: Path) -> Path:
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(video),
            "-i",
            str(audio),
            "-filter_complex",
            f"[0:v]trim=duration={seconds:.3f},setpts=PTS-STARTPTS[v];"
            "[1:a]adelay=180:all=1,apad=pad_dur=3[a]",
            "-map",
            "[v]",
            "-map",
            "[a]",
            "-t",
            f"{seconds:.3f}",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "19",
            "-pix_fmt",
            "yuv420p",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            str(output),
        ]
    )
    return output


def write_captions(starts: list[float]) -> None:
    srt_blocks: list[str] = []
    ass_events: list[str] = []
    index = 1
    for scene, offset in zip(SCENES, starts):
        for start, end, value in parse_srt(VOICE / f"{scene['id']}.srt"):
            chunks = split_caption(value)
            total_chars = sum(max(1, len(x)) for x in chunks)
            cursor = start
            span = max(0.8, end - start)
            for chunk in chunks:
                cue_end = min(end, cursor + span * max(1, len(chunk)) / total_chars)
                if cue_end <= cursor:
                    cue_end = cursor + 0.55
                s0 = offset + cursor + 0.18
                s1 = offset + cue_end + 0.18
                srt_blocks.append(
                    f"{index}\n{format_srt_time(s0)} --> {format_srt_time(s1)}\n{chunk}\n"
                )
                safe = chunk.replace("\\", "＼").replace("{", "（").replace("}", "）")
                ass_events.append(
                    f"Dialogue: 0,{format_ass_time(s0)},{format_ass_time(s1)},Caption,,0,0,0,,{safe}"
                )
                index += 1
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
Style: Caption,Microsoft YaHei,44,&H00FFFFFF,&H00FFFFFF,&H001B241E,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,120,120,48,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ASS_OUT.write_text(ass_header + "\n".join(ass_events) + "\n", encoding="utf-8")


def write_storyboard(starts: list[float], durations: list[float]) -> None:
    lines = [
        "# 启核图策 Web 端 · 演示视频分镜",
        "",
        "成片为 1920×1080、30 fps，中文旁白与同步字幕。画面由真实 Web 操作录屏和答辩 PPT 证据页组成。",
        "",
        "| 场景 | 时间 | 画面 | 口播 |",
        "|---|---:|---|---|",
    ]
    for scene, start, seconds in zip(SCENES, starts, durations):
        visual = scene.get("title") or f"证据页 {scene.get('image', '')}"
        lines.append(f"| {scene['id']} | {start:.1f}–{start + seconds:.1f}s | {visual} | {scene['voice']} |")
    lines += [
        "",
        "## 证据边界",
        "",
        "- Web 操作画面来自已有真实界面录屏；数字来自演示工作区。",
        "- PPT 证据页用于解释架构、AI 路由与评分点，不替代真实操作。",
        "- 不宣称当前前端为 React/Vue，也不宣称已实现 MCP 协议。",
    ]
    STORY_OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build() -> None:
    VIDEO_DIR.mkdir(parents=True, exist_ok=True)
    BUILD.mkdir(parents=True, exist_ok=True)
    CLIPS.mkdir(parents=True, exist_ok=True)
    if not all((VOICE / f"{s['id']}.mp3").exists() for s in SCENES):
        synthesize()
    av_files: list[Path] = []
    durations: list[float] = []
    for scene in SCENES:
        voice_path = VOICE / f"{scene['id']}.mp3"
        seconds = max(scene["target"], duration(voice_path) + 0.8)
        clip = (
            encode_slide(scene, seconds)
            if scene["kind"] == "slide"
            else encode_operation(scene, seconds)
        )
        av = add_audio(clip, voice_path, seconds, CLIPS / f"{scene['id']}-av.mp4")
        av_files.append(av)
        durations.append(duration(av))
        print(f"SCENE {scene['id']} {durations[-1]:.2f}s", flush=True)

    concat_file = CLIPS / "concat.txt"
    concat_file.write_text(
        "\n".join(f"file '{p.as_posix()}'" for p in av_files) + "\n",
        encoding="utf-8",
    )
    joined = CLIPS / "joined.mp4"
    run(
        [
            FFMPEG,
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_file),
            "-c",
            "copy",
            str(joined),
        ]
    )
    starts: list[float] = []
    cursor = 0.0
    for seconds in durations:
        starts.append(cursor)
        cursor += seconds
    write_captions(starts)
    write_storyboard(starts, durations)

    total = duration(joined)
    ass_path = str(ASS_OUT).replace("\\", "/").replace(":", "\\:")
    vf = (
        f"ass='{ass_path}',"
        "fade=t=in:st=0:d=0.35,"
        f"fade=t=out:st={max(0.0, total - 0.8):.3f}:d=0.8,"
        "format=yuv420p"
    )
    af = (
        "afade=t=in:st=0:d=0.25,"
        f"afade=t=out:st={max(0.0, total - 0.8):.3f}:d=0.8,"
        "loudnorm=I=-18:TP=-1.5:LRA=9"
    )
    run(
        [
            FFMPEG,
            "-y",
            "-i",
            str(joined),
            "-vf",
            vf,
            "-af",
            af,
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "18",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            "-ar",
            "48000",
            "-ac",
            "2",
            "-movflags",
            "+faststart",
            str(OUT),
        ]
    )
    print(f"DURATION {duration(OUT):.2f}s", flush=True)
    print(f"WROTE {OUT}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--voice-only", action="store_true")
    args = parser.parse_args()
    if args.voice_only:
        synthesize()
    else:
        build()


if __name__ == "__main__":
    main()
