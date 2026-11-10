# -*- coding: utf-8 -*-
"""检查仓库的提交卫生：敏感信息、异常大文件和关键交付文件。"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
TEXT_EXTENSIONS = {
    ".bat",
    ".css",
    ".env",
    ".ets",
    ".html",
    ".ini",
    ".js",
    ".json",
    ".md",
    ".mjs",
    ".ps1",
    ".py",
    ".sh",
    ".sql",
    ".scss",
    ".toml",
    ".ts",
    ".tsx",
    ".txt",
    ".yaml",
    ".yml",
}
SECRET_PATTERNS = {
    "openai-style-key": re.compile(r"sk-[A-Za-z0-9_-]{20,}"),
    "github-token": re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),
    "aws-access-key": re.compile(r"AKIA[0-9A-Z]{16}"),
    "private-key": re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
}
IGNORE_PARTS = {".git", "node_modules", "deliverables", "oh_modules", "dist", "build"}


def git_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-co", "--exclude-standard", "-z"],
        cwd=ROOT,
        capture_output=True,
        check=True,
    )
    paths = []
    for raw in result.stdout.split(b"\0"):
        if not raw:
            continue
        path = ROOT / raw.decode("utf-8", errors="replace")
        if not path.is_file():
            continue
        if any(part in IGNORE_PARTS for part in path.relative_to(ROOT).parts):
            continue
        paths.append(path)
    return sorted(set(paths))


def check() -> dict:
    files = git_files()
    secrets = []
    large = []
    for path in files:
        relative = str(path.relative_to(ROOT)).replace("\\", "/")
        size = path.stat().st_size
        if size > 8 * 1024 * 1024:
            large.append({"path": relative, "bytes": size})
        if path.suffix.lower() not in TEXT_EXTENSIONS and path.name != ".env.example":
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        for line_number, line in enumerate(text.splitlines(), 1):
            for kind, pattern in SECRET_PATTERNS.items():
                if pattern.search(line):
                    secrets.append({"path": relative, "line": line_number, "kind": kind})

    required = [
        "README.md",
        "web/NexcoreGraph_web/README.md",
        "web/NexcoreGraph_web/.env.example",
        "web/NexcoreGraph_web/CODE-STYLE.md",
        "web/NexcoreGraph_web/js/rescue.js",
        "web/NexcoreGraph_web/tests/rescue.test.js",
    ]
    missing = [path for path in required if not (ROOT / path).is_file()]
    return {
        "ok": not secrets and not missing,
        "scannedFiles": len(files),
        "secrets": secrets,
        "largeFiles": large,
        "missingRequiredFiles": missing,
        "branch": subprocess.run(
            ["git", "branch", "--show-current"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip(),
    }


def main() -> None:
    result = check()
    print(json.dumps(result, ensure_ascii=False, indent=2))
    raise SystemExit(0 if result["ok"] else 1)


if __name__ == "__main__":
    main()
