# -*- coding: utf-8 -*-
"""Assemble the ChuanZhi Cup mini-program demo video.

The final film combines:
- HyperFrames opening / closing motion
- existing PPT summary slides
- real WeChat DevTools simulator recording
- Remotion technical-evidence cards
- Edge TTS male narration and timed captions
"""
from __future__ import annotations

import math
import re
import shutil
import subprocess
from pathlib import Path


ROOT = Path(r"D:\ProjectFiles\GithubPackage\NexcoreGraph")
WORK = ROOT / "deliverables" / "video-new"
ASSETS = WORK / "assets"
AUDIO = WORK / "audio-v2"
BUILD = WORK / "build"
OUT = WORK / "renders" / "启核图策-小程序端演讲视频-评分版.mp4"
SRT_OUT = WORK / "renders" / "启核图策-小程序端演讲视频-评分版-字幕.srt"
ASS_OUT = WORK / "renders" / "启核图策-小程序端演讲视频-评分版-字幕.ass"

FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"
FPS = 30


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if proc.returncode:
        raise RuntimeError("\n".join([f"Command failed: {cmd}", proc.stderr[-4000:]]))


def duration(path: Path) -> float:
    proc = subprocess.run(
        [FFPROBE, "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if proc.returncode:
        raise RuntimeError(proc.stderr[-2000:])
    return float(proc.stdout.strip())


def encode_still(image: Path, seconds: float, output: Path, zoom: float = 1.055) -> None:
    frames = math.ceil(seconds * FPS)
    vf = (
        "scale=1920:1080:force_original_aspect_ratio=decrease,"
        "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xFBF7F2,"
        f"zoompan=z='min(zoom+0.00030,{zoom})':d={frames}:s=1920x1080:fps={FPS},"
        "format=yuv420p"
    )
    run([
        FFMPEG, "-y", "-loop", "1", "-i", str(image), "-vf", vf,
        "-t", f"{seconds:.3f}", "-an", "-c:v", "libx264", "-preset", "medium",
        "-crf", "19", "-pix_fmt", "yuv420p", str(output),
    ])


def encode_slide_pair(first: Path, second: Path, seconds: float, output: Path) -> None:
    half = seconds / 2
    frames = math.ceil(half * FPS)
    fade = 0.55
    offset = half - fade / 2
    fc = (
        f"[0:v]scale=1920:1080,zoompan=z='min(zoom+0.00024,1.045)':d={frames}:"
        f"s=1920x1080:fps={FPS},trim=duration={half:.3f},setpts=PTS-STARTPTS[v0];"
        f"[1:v]scale=1920:1080,zoompan=z='min(zoom+0.00024,1.045)':d={frames}:"
        f"s=1920x1080:fps={FPS},trim=duration={half:.3f},setpts=PTS-STARTPTS[v1];"
        f"[v0][v1]xfade=transition=fade:duration={fade}:offset={offset:.3f},"
        f"trim=duration={seconds:.3f},format=yuv420p[v]"
    )
    run([
        FFMPEG, "-y", "-loop", "1", "-i", str(first), "-loop", "1", "-i", str(second),
        "-filter_complex", fc, "-map", "[v]", "-t", f"{seconds:.3f}", "-an",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        str(output),
    ])


def encode_trim(
    source: Path,
    output: Path,
    start: float,
    end: float,
    seconds: float,
    speed: float = 1.0,
    freeze: float = 0.0,
) -> None:
    vf = (
        f"trim=start={start:.3f}:end={end:.3f},setpts=(PTS-STARTPTS)/{speed:.4f},"
        f"fps={FPS}"
    )
    if freeze > 0:
        vf += f",tpad=stop_mode=clone:stop_duration={freeze:.3f}"
    vf += ",scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0xFBF7F2"
    run([
        FFMPEG, "-y", "-i", str(source), "-vf", vf, "-t", f"{seconds:.3f}",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-pix_fmt", "yuv420p", str(output),
    ])


def make_demo_source(raw: Path) -> tuple[Path, Path, Path]:
    a = BUILD / "screen-photo.mp4"
    b = BUILD / "screen-results.mp4"
    c = BUILD / "screen-ai.mp4"
    run([
        FFMPEG, "-y", "-i", str(raw),
        "-vf", "trim=start=4:end=38,setpts=(PTS-STARTPTS)/1.6,fps=30",
        "-t", "21.2", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(a),
    ])
    fc = (
        "[0:v]trim=start=43:end=58,setpts=(PTS-STARTPTS)/1.2,fps=30[v0];"
        "[0:v]trim=start=65:end=68.3,setpts=PTS-STARTPTS,fps=30[v1];"
        "[v0][v1]concat=n=2:v=1:a=0,trim=duration=15.3,setpts=PTS-STARTPTS[v]"
    )
    run([
        FFMPEG, "-y", "-i", str(raw), "-filter_complex", fc, "-map", "[v]",
        "-t", "15.3", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(b),
    ])
    run([
        FFMPEG, "-y", "-i", str(raw),
        "-vf", "trim=start=75:end=90,setpts=PTS-STARTPTS,fps=30,tpad=stop_mode=clone:stop_duration=0.8",
        "-t", "15.8", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-pix_fmt", "yuv420p", str(c),
    ])
    return a, b, c


def composite_demo(source: Path, seconds: float, title: str, bullets: str, output: Path) -> None:
    safe = re.sub(r"[^0-9A-Za-z一-龥_-]", "_", title)
    title_file = BUILD / f"{safe}-title.txt"
    body_file = BUILD / f"{safe}-body.txt"
    title_file.write_text(title, encoding="utf-8")
    body_file.write_text(bullets, encoding="utf-8")
    title_file_arg = str(title_file).replace("\\", "/").replace(":", "\\:")
    body_file_arg = str(body_file).replace("\\", "/").replace(":", "\\:")
    f_title = "C\\:/Windows/Fonts/msyhbd.ttc"
    f_body = "C\\:/Windows/Fonts/msyh.ttc"
    fc = (
        "[0:v]drawbox=x=720:y=72:w=1100:h=936:color=0xFFFDF8:t=fill,"
        "drawbox=x=720:y=72:w=1100:h=936:color=0xD8CDBE:t=4[bg];"
        "[1:v]scale=-2:920,format=yuv420p[phone];"
        "[bg][phone]overlay=x=168:y=80:shortest=1,"
        f"drawtext=fontfile='{f_title}':textfile='{title_file_arg}':"
        "expansion=none:fontcolor=0x1E2A26:fontsize=56:x=790:y=142,"
        f"drawtext=fontfile='{f_body}':textfile='{body_file_arg}':"
        "expansion=none:fontcolor=0x34453D:fontsize=34:line_spacing=18:x=790:y=250,"
        "drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':text='真实小程序录屏':"
        "fontcolor=0x4C9F70:fontsize=28:x=790:y=930,"
        "drawtext=fontfile='C\\:/Windows/Fonts/msyh.ttc':text='NexcoreGraph':"
        "fontcolor=0x67736C:fontsize=24:x=1690:y=940,"
        "format=yuv420p[v]"
    )
    run([
        FFMPEG, "-y",
        "-f", "lavfi", "-i", f"color=c=0xFBF7F2:s=1920x1080:r=30:d={seconds:.3f}",
        "-i", str(source),
        "-filter_complex", fc, "-map", "[v]", "-t", f"{seconds:.3f}",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "19",
        "-pix_fmt", "yuv420p", str(output),
    ])


def add_audio(video: Path, audio: Path, seconds: float, output: Path) -> None:
    run([
        FFMPEG, "-y", "-i", str(video), "-i", str(audio),
        "-filter_complex",
        "[0:v]trim=duration={0:.3f},setpts=PTS-STARTPTS[v];"
        "[1:a]adelay=120:all=1,apad=pad_dur=4[a]".format(seconds),
        "-map", "[v]", "-map", "[a]", "-t", f"{seconds:.3f}",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-ac", "2", str(output),
    ])


def parse_srt(path: Path) -> list[tuple[float, float, str]]:
    text = path.read_text(encoding="utf-8-sig").replace("\r\n", "\n").strip()
    cues: list[tuple[float, float, str]] = []
    for block in re.split(r"\n{2,}", text):
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        if len(lines) < 3:
            continue
        stamp = re.search(r"(\d+):(\d+):(\d+),(\d+)\s+-->\s+(\d+):(\d+):(\d+),(\d+)", lines[1])
        if not stamp:
            continue
        values = [int(x) for x in stamp.groups()]
        start = values[0] * 3600 + values[1] * 60 + values[2] + values[3] / 1000
        end = values[4] * 3600 + values[5] * 60 + values[6] + values[7] / 1000
        cues.append((start, end, " ".join(lines[2:])))
    return cues


def split_caption(text: str, max_chars: int = 18) -> list[str]:
    clean = re.sub(r"\s+", "", text)
    pieces: list[str] = []
    current = ""
    for ch in clean:
        current += ch
        if len(current) >= max_chars or (ch in "。；，、！？" and len(current) >= 8):
            pieces.append(current.strip())
            current = ""
    if current:
        pieces.append(current.strip())
    return pieces or [clean]


def write_merged_captions(scene_starts: list[float]) -> None:
    global_index = 1
    srt_blocks: list[str] = []
    ass_events: list[str] = []
    for idx, offset in enumerate(scene_starts, start=1):
        srt = AUDIO / f"{idx:02d}.srt"
        for start, end, text in parse_srt(srt):
            chunks = split_caption(text)
            total_chars = sum(max(1, len(x)) for x in chunks)
            cursor = start
            span = max(0.8, end - start)
            for chunk in chunks:
                share = span * max(1, len(chunk)) / total_chars
                cue_end = min(end, cursor + max(0.55, share))
                if cue_end <= cursor:
                    cue_end = cursor + 0.55
                s_start = offset + cursor + 0.12
                s_end = offset + cue_end + 0.12
                srt_blocks.append(
                    f"{global_index}\n"
                    f"{format_srt_time(s_start)} --> {format_srt_time(s_end)}\n"
                    f"{chunk}\n"
                )
                ass_events.append(
                    f"Dialogue: 0,{format_ass_time(s_start)},{format_ass_time(s_end)},Caption,,0,0,0,,{escape_ass(chunk)}"
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
Style: Caption,Microsoft YaHei,44,&H00FFFFFF,&H00FFFFFF,&H001B241E,&H80000000,1,0,0,0,100,100,0,0,1,2,1,2,120,120,42,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    ASS_OUT.write_text(ass_header + "\n".join(ass_events) + "\n", encoding="utf-8")


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


def escape_ass(text: str) -> str:
    return text.replace("\\", "＼").replace("{", "（").replace("}", "）")


def main() -> None:
    BUILD.mkdir(parents=True, exist_ok=True)
    OUT.parent.mkdir(parents=True, exist_ok=True)

    raw = ASSETS / "simulator-demo-raw.mp4"
    photo_raw, results_raw, ai_raw = make_demo_source(raw)

    scene_videos: list[Path] = []
    scene_durations = [8.5, 13.4, 13.9, 21.2, 15.3, 15.8, 13.1, 13.8, 13.9, 14.2, 10.0]

    # 01 HyperFrames opening
    encode_trim(ASSETS / "hf-intro-outro.mp4", BUILD / "v01.mp4", 0, 7.3, 8.5, freeze=1.2)
    scene_videos.append(BUILD / "v01.mp4")

    # 02 New presentation: real pain point
    encode_still(ASSETS / "deck-v2" / "slide-02.png", 13.4, BUILD / "v02.mp4")
    scene_videos.append(BUILD / "v02.mp4")

    # 03 New presentation: one-photo-to-action flow
    encode_still(ASSETS / "deck-v2" / "slide-03.png", 13.9, BUILD / "v03.mp4")
    scene_videos.append(BUILD / "v03.mp4")

    # 04-06 Real simulator recording with evidence panel
    composite_demo(
        photo_raw,
        21.2,
        "拍照入库 / 真实模型识别",
        "识别 7 项物品\n耗时约 5.17 秒\n名称、数量、位置和保质期可修改\n确认后才写入数据库",
        BUILD / "v04.mp4",
    )
    composite_demo(
        results_raw,
        15.3,
        "库存更新 / 首页与资源库",
        "库存 34 → 40 件\n临期 25 件 · 低库存 13 件\n库存健康度 40%\n资源库支持搜索、新建与编辑",
        BUILD / "v05.mp4",
    )
    composite_demo(
        ai_raw,
        15.8,
        "AI 工作台 / 可解释回答",
        "本地快答：0 次模型调用\nGraphRAG：回答附带节点与边\n写操作：预览 → 确认 → 执行\n三端客户端 Key 保留",
        BUILD / "v06.mp4",
    )
    scene_videos += [BUILD / "v04.mp4", BUILD / "v05.mp4", BUILD / "v06.mp4"]

    # 07 New presentation: AI is an operating layer
    encode_still(ASSETS / "deck-v2" / "slide-04.png", 13.1, BUILD / "v07.mp4")
    scene_videos.append(BUILD / "v07.mp4")

    # 08 New presentation: trust boundary
    encode_still(ASSETS / "deck-v2" / "slide-05.png", 13.8, BUILD / "v08.mp4")
    scene_videos.append(BUILD / "v08.mp4")

    # 09 New presentation: verifiable results
    encode_still(ASSETS / "deck-v2" / "slide-06.png", 13.9, BUILD / "v09.mp4")
    scene_videos.append(BUILD / "v09.mp4")

    # 10 New presentation: scoring evidence matrix
    encode_still(ASSETS / "deck-v2" / "slide-07.png", 14.2, BUILD / "v10.mp4")
    scene_videos.append(BUILD / "v10.mp4")

    # 11 HyperFrames closing
    encode_trim(ASSETS / "hf-intro-outro.mp4", BUILD / "v11.mp4", 8, 15.2, 10.0, freeze=2.8)
    scene_videos.append(BUILD / "v11.mp4")

    with_audio: list[Path] = []
    for idx, (video, seconds) in enumerate(zip(scene_videos, scene_durations), start=1):
        dst = BUILD / f"a{idx:02d}.mp4"
        add_audio(video, AUDIO / f"{idx:02d}.mp3", seconds, dst)
        with_audio.append(dst)

    concat_list = BUILD / "concat.txt"
    concat_list.write_text(
        "\n".join(f"file '{p.as_posix()}'" for p in with_audio) + "\n",
        encoding="utf-8",
    )
    joined = BUILD / "joined.mp4"
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", str(concat_list), "-c", "copy", str(joined)])

    scene_starts: list[float] = []
    cursor = 0.0
    for seconds in scene_durations:
        scene_starts.append(cursor)
        cursor += seconds
    write_merged_captions(scene_starts)

    ass_path = str(ASS_OUT).replace("\\", "/").replace(":", "\\:")
    total = duration(joined)
    vf = (
        f"ass='{ass_path}',"
        "fade=t=in:st=0:d=0.35,"
        f"fade=t=out:st={max(0, total-0.7):.3f}:d=0.7,"
        "format=yuv420p"
    )
    af = (
        f"afade=t=in:st=0:d=0.25,afade=t=out:st={max(0, total-0.7):.3f}:d=0.7,"
        "loudnorm=I=-18:TP=-1.5:LRA=9"
    )
    run([
        FFMPEG, "-y", "-i", str(joined), "-vf", vf, "-af", af,
        "-c:v", "libx264", "-preset", "medium", "-crf", "18",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-movflags", "+faststart",
        str(OUT),
    ])
    print(f"WROTE {OUT}")
    print(f"DURATION {duration(OUT):.2f}s")
    print(f"CAPTIONS {SRT_OUT}")


if __name__ == "__main__":
    main()
