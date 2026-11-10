# -*- coding: utf-8 -*-
"""启核图策 · 作品介绍视频（截图推拉 + 男声旁白 + 字幕）

每段 = 一张截图 + 一段 edge-tts 男声，单独编码后拼接。
想换成 EV 录屏素材时，把 SEGMENTS 里的图片路径换成录屏截帧即可。
"""
import os
import subprocess
import sys
import textwrap
import time

ROOT = r"D:\ProjectFiles\GithubPackage\NexcoreGraph"
SHOTS = os.path.join(ROOT, "deliverables", "screenshots")
RENDER = os.path.join(ROOT, "deliverables", "ppt-render")
TMP = os.path.join(ROOT, "deliverables", "video-build")
OUT = os.path.join(ROOT, "deliverables", "启核图策-作品介绍.mp4")
PY = sys.executable
FFMPEG = r"C:\Users\34274\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0.1-full_build\bin\ffmpeg.exe"
FFPROBE = os.path.join(os.path.dirname(FFMPEG), "ffprobe.exe")
FONT = r"C\:/Windows/Fonts/msyhbd.ttc"
VOICE = "zh-CN-YunxiNeural"
EDGE_DIR = r"C:\Users\34274\AppData\Local\Temp\edge-tts-new"   # edge-tts 7.3.1（旧版会被 403）

SEGMENTS = [
    (os.path.join(RENDER, "title-01.png"),
     "启核图策 NexcoreGraph，一款面向家庭的 AI 资源管家。家里的东西看得见，但记不住。我们让一张照片完成建档。"),
    (os.path.join(SHOTS, "01-login.png"),
     "登录连的是你自己电脑上的局域网服务，数据不出局域网。账号、家庭与库存都来自后端，没有演示账号，也没有固定验证码。"),
    (os.path.join(SHOTS, "02-ai-workbench.png"),
     "进来先是 AI 工作台。待确认动作、实时库存和图谱社区都在这一屏。高频问题本地直答，不调用模型。"),
    (os.path.join(SHOTS, "03-dashboard.png"),
     "看板上的库存总量、临期数量、消耗趋势和本月花费，全部由代码实时计算，每一个数字都能和操作日志对上。"),
    (os.path.join(SHOTS, "04-alerts.png"),
     "食材临期、药品到期、库存过低，预警中心集中列出，并给出一条可以执行的建议。"),
    (os.path.join(SHOTS, "05-libraries.png"),
     "资源库是整套系统的账本。冰箱、药盒、工具箱、书架都能自己建，物品支持数量、位置、保质期、价格和私有可见性。"),
    (os.path.join(SHOTS, "06-graph.png"),
     "库存还会构成一张知识图谱。点开物品，能看到它连到哪些菜谱、依据哪条路径回答，结论因此是可追溯的。"),
    (os.path.join(SHOTS, "07-workbench.png"),
     "家庭协作做成一张牌桌。六位邀请码入桌，各自摆库，结束后按归属扣减。多端之间自动同步，也能整份流转。"),
    (os.path.join(SHOTS, "09-admin.png"),
     "管理员端用同一套真实数据，查看用户、家庭、审计和 AI 用量，图谱看板只展示聚合统计。"),
    (os.path.join(SHOTS, "10-mobile.png"),
     "从桌面到手机，同一套后端、同一份数据。启核图策，拍照建库，AI 规划，全家协作。"),
]


def run(cmd, env=None):
    p = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace", env=env)
    if p.returncode != 0:
        raise RuntimeError((p.stderr or p.stdout)[-1200:])
    return p


def duration(path):
    p = run([FFPROBE, "-v", "error", "-show_entries", "format=duration",
             "-of", "default=noprint_wrappers=1:nokey=1", path])
    return float(p.stdout.strip())


def tts(text, out):
    env = os.environ.copy()
    env["PYTHONPATH"] = EDGE_DIR + os.pathsep + env.get("PYTHONPATH", "")
    for attempt in range(3):
        if os.path.exists(out) and os.path.getsize(out) > 2000:
            return
        try:
            os.remove(out)
        except OSError:
            pass
        try:
            run([PY, "-m", "edge_tts", "--voice", VOICE, "--rate=+4%",
                 "--text", text, "--write-media", out], env=env)
        except Exception as e:
            print("tts retry %d: %s" % (attempt + 1, str(e)[-200:]))
            time.sleep(1.5)
    if not (os.path.exists(out) and os.path.getsize(out) > 2000):
        raise RuntimeError("TTS failed: " + out)


def wrap(text, width=30):
    lines = []
    for chunk in text.split("。"):
        chunk = chunk.strip()
        if not chunk:
            continue
        lines.extend(textwrap.wrap(chunk + "。", width=width))
    return "\n".join(lines[:3])


def main():
    os.makedirs(TMP, exist_ok=True)
    parts = []
    for i, (img, text) in enumerate(SEGMENTS):
        idx = "%02d" % (i + 1)
        mp3 = os.path.join(TMP, idx + ".mp3")
        txt = os.path.join(TMP, idx + ".txt")
        seg = os.path.join(TMP, idx + ".mp4")
        if not os.path.exists(mp3) or os.path.getsize(mp3) < 2000:
            tts(text, mp3)
        with open(txt, "w", encoding="utf-8", newline="") as f:
            f.write(wrap(text))
        dur = duration(mp3) + 0.55
        frames = int(dur * 30)
        txt_arg = txt.replace("\\", "/").replace(":", "\\:")
        vf = (
            "scale=1920:1080:force_original_aspect_ratio=decrease,"
            "pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=0x0E1424,"
            f"zoompan=z='min(zoom+0.00055,1.07)':d={frames}:s=1920x1080:fps=30,"
            f"drawtext=fontfile='{FONT}':textfile='{txt_arg}':fontcolor=white:fontsize=30:"
            "line_spacing=10:box=1:boxcolor=black@0.55:boxborderw=20:"
            "x=(w-text_w)/2:y=h-210"
        )
        run([FFMPEG, "-y", "-loop", "1", "-i", img, "-i", mp3,
             "-vf", vf, "-t", "%.2f" % dur, "-r", "30",
             "-c:v", "libx264", "-preset", "medium", "-crf", "20",
             "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k",
             "-shortest", seg])
        parts.append(seg)
        print("segment", idx, "%.1fs" % dur)

    lst = os.path.join(TMP, "list.txt")
    with open(lst, "w", encoding="utf-8", newline="") as f:
        for p in parts:
            f.write("file '%s'\n" % p.replace("\\", "/"))
    run([FFMPEG, "-y", "-f", "concat", "-safe", "0", "-i", lst,
         "-c", "copy", OUT])
    print("WROTE", OUT, "%.1fs" % duration(OUT))


if __name__ == "__main__":
    main()
