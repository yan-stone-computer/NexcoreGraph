# -*- coding: utf-8 -*-
"""启动 headless Edge，运行 capture_shots.js 抓取作品截图。"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request

EDGE = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_edge():
    for p in EDGE:
        if os.path.isfile(p):
            return p
    raise SystemExit("no msedge.exe")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else r"D:\ProjectFiles\GithubPackage\NexcoreGraph\deliverables\screenshots"
    base = sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:3005"
    account = sys.argv[3] if len(sys.argv) > 3 else "demo-show@example.com"
    port = free_port()
    profile = os.path.join(os.environ.get("TEMP", "."), "edge_shots_%d" % port)
    proc = subprocess.Popen([
        find_edge(), "--headless=new", "--disable-gpu", "--no-first-run",
        "--no-default-browser-check", "--remote-debugging-port=%d" % port,
        "--user-data-dir=%s" % profile, "--window-size=1440,900",
        "http://127.0.0.1:8090/index.html",
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws = None
        for _ in range(60):
            try:
                with urllib.request.urlopen("http://127.0.0.1:%d/json/list" % port, timeout=2) as r:
                    pages = json.loads(r.read().decode("utf-8"))
                page = next((p for p in pages if p.get("type") == "page"), None)
                if page:
                    ws = page["webSocketDebuggerUrl"]
                    break
            except Exception:
                time.sleep(0.4)
        if not ws:
            raise SystemExit("CDP not ready")
        script_name = sys.argv[4] if len(sys.argv) > 4 else "capture_shots.js"
        script = os.path.join(os.path.dirname(os.path.abspath(__file__)), script_name)
        res = subprocess.run(["node", script, ws, out, base, account],
                             capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=180)
        print(res.stdout.strip())
        if res.returncode != 0:
            print(res.stderr.strip()[:2000])
            raise SystemExit(1)
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
