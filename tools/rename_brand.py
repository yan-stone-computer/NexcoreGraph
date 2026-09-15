# -*- coding: utf-8 -*-
"""启核图策 NexcoreGraph · 品牌更名批量替换

把工程里的旧品牌名与本地存储前缀统一替换为新品牌：
    天枢图策 -> 启核图策
    tianshu_  -> nexcore_

用法：
    python tools/rename_brand.py --dry-run     # 只统计，不写盘
    python tools/rename_brand.py               # 实际写入

注意：不替换目录名 TianShuGraph（工程目录/包名重命名会影响 DevEco 签名与路径，
需单独决策，见三份整改文档的"品牌更名"章节）。
"""

import argparse
import os

REPLACEMENTS = [("天枢图策", "启核图策"), ("tianshu_", "nexcore_")]
SKIP_DIRS = {"build", "node_modules", "oh_modules", ".git", ".idea", ".hvigor", "dist", "_backup",
             ".uploads", ".preview", "intermediates", "cache"}
TEXT_EXT = {".ets", ".ts", ".tsx", ".js", ".jsx", ".json", ".json5", ".md", ".css", ".scss", ".sass",
            ".less", ".html", ".txt", ".xml", ".properties", ".bat", ".sh", ".wxml", ".wxss"}


def target_roots():
    return [
        r"D:\ProjectFiles\GithubPackage\NexcoreGraph\harmonyosapp\NexcoreGraph_harmonyos",
        r"D:\ProjectFiles\GithubPackage\NexcoreGraph\web\NexcoreGraph_web",
        r"D:\ProjectFiles\GithubPackage\NexcoreGraph\wxminiapp\NexcoreGraph_wxminiapp",
        r"D:\ProjectFiles\DevEcoStudioFiles\TianShuGraph",
        r"D:\ProjectFiles\CompetitionDemos\webapp",
        r"D:\ProjectFiles\CompetitionDemos\tianshu-weapp",
        r"D:\文件文档\开发文档\天枢图策\web-demo",
        r"D:\文件文档\开发文档\天枢图策\docs",
    ]


def iter_files(root):
    for base, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for name in files:
            if os.path.splitext(name)[1].lower() in TEXT_EXT:
                yield os.path.join(base, name)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    total_files = 0
    total_hits = 0
    for root in target_roots():
        if not os.path.isdir(root):
            print("SKIP missing root:", root)
            continue
        for path in iter_files(root):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    text = f.read()
            except (UnicodeDecodeError, OSError):
                continue
            new = text
            hits = 0
            for old, fresh in REPLACEMENTS:
                hits += new.count(old)
                new = new.replace(old, fresh)
            if hits == 0:
                continue
            total_files += 1
            total_hits += hits
            print("%3d  %s" % (hits, path))
            if not args.dry_run:
                with open(path, "w", encoding="utf-8", newline="") as f:
                    f.write(new)
    print("----")
    print("files:", total_files, "replacements:", total_hits, "dry_run:", args.dry_run)


if __name__ == "__main__":
    main()
