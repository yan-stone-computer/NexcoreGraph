# -*- coding: utf-8 -*-
"""清理本工具链自己启动的 headless Edge 实例（按 user-data-dir 前缀识别，不碰用户正常浏览器）。

识别前缀：nexcore-smoke- / nexcore-edge- / codex-edge-cdp-
用法：python tools/cleanup_headless_edge.py
"""

import json
import subprocess

PS = ("Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | "
      "Select-Object ProcessId,CommandLine | ConvertTo-Json -Compress")
PREFIXES = ("nexcore-smoke-", "nexcore-edge-", "codex-edge-cdp-", "codex-edge-nexcore-")


def main():
    res = subprocess.run(["powershell", "-NoProfile", "-Command", PS],
                         capture_output=True, text=True, encoding="utf-8", errors="replace")
    raw = (res.stdout or "").strip() or "[]"
    try:
        procs = json.loads(raw)
    except json.JSONDecodeError:
        print("解析进程列表失败，跳过清理")
        return
    if isinstance(procs, dict):
        procs = [procs]
    killed = 0
    for p in procs:
        cmd = p.get("CommandLine") or ""
        if any(pre in cmd for pre in PREFIXES):
            subprocess.run(["taskkill", "/PID", str(p["ProcessId"]), "/T", "/F"],
                           capture_output=True)
            killed += 1
    print("已清理 headless Edge 进程:", killed)


if __name__ == "__main__":
    main()
