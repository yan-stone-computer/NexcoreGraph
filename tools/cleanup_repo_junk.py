# -*- coding: utf-8 -*-
"""清理仓库垃圾文件，并可选清理可再生的构建产物。

默认只清垃圾文件（误用 shell 重定向产生的 $null / 换行名文件 / 陈旧构建日志）；
加 --build-caches 时额外删除构建产物（DevEco 的 entry/build、.hvigor、.preview 等，
共约 36MB，删除后重新构建即可恢复）。

用法：
    python tools/cleanup_repo_junk.py --dry-run
    python tools/cleanup_repo_junk.py
    python tools/cleanup_repo_junk.py --build-caches
"""

import argparse
import os
import shutil

ROOT = r"D:\ProjectFiles\GithubPackage\NexcoreGraph"
# 垃圾文件识别规则：0~64 字节且文件名只由这些字符组成，或明确的陈旧日志
JUNK_CHARS = set("$null{}`\n\r\\ ")
JUNK_NAMES = {"build-h5.log"}

# 可再生的构建/缓存目录（相对仓库根）
BUILD_CACHES = [
    r"harmonyosapp\NexcoreGraph_harmonyos\.hvigor",
    r"harmonyosapp\NexcoreGraph_harmonyos\.preview",
    r"harmonyosapp\NexcoreGraph_harmonyos\entry\build",
    r"harmonyosapp\NexcoreGraph_harmonyos\entry\.preview",
    r"wxminiapp\NexcoreGraph_wxminiapp\dist",
    r"wxminiapp\NexcoreGraph_wxminiapp\.swc",
]


def is_junk(name, size):
    if name in JUNK_NAMES:
        return True
    if size <= 64 and name and all(c.lower() in JUNK_CHARS for c in name):
        return True
    return False


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--build-caches", action="store_true",
                    help="同时删除可再生的构建产物（entry/build、.hvigor、.preview、dist 等）")
    args = ap.parse_args()
    removed = 0
    for base, dirs, files in os.walk(ROOT):
        dirs[:] = [d for d in dirs if d not in {"node_modules", ".git", "oh_modules", "dist", "build"}]
        for name in files:
            path = os.path.join(base, name)
            try:
                size = os.path.getsize(path)
            except OSError:
                continue
            if not is_junk(name, size):
                continue
            rel = os.path.relpath(path, ROOT)
            if args.dry_run:
                print("将删除:", repr(rel), size, "字节")
            else:
                os.remove(path)
                print("已删除:", repr(rel), size, "字节")
            removed += 1
    print("----")
    print("共", removed, "个文件", "（dry-run）" if args.dry_run else "")

    if not args.build_caches:
        return
    print("---- 构建产物 ----")
    for rel in BUILD_CACHES:
        path = os.path.join(ROOT, rel)
        if not os.path.isdir(path):
            print("skip (not found):", rel)
            continue
        size = sum(os.path.getsize(os.path.join(b, f))
                   for b, _, fs in os.walk(path) for f in fs)
        if args.dry_run:
            print("将删除:", rel, "%.1f MB" % (size / 1048576))
        else:
            shutil.rmtree(path, ignore_errors=True)
            print("已删除:", rel, "%.1f MB" % (size / 1048576))


if __name__ == "__main__":
    main()
