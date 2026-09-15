# -*- coding: utf-8 -*-
"""启核图策 NexcoreGraph · Web 端冒烟检查（headless Edge + CDP）

打开指定页面，回传：标题、控制台错误、页面文本长度、关键元素是否渲染、横向溢出。

用法：
    python tools/smoke_web.py --url "file:///D:/ProjectFiles/CompetitionDemos/webapp/index.html"
    python tools/smoke_web.py --url "file:///.../admin.html" --need "管理员"
    python tools/smoke_web.py --url "file:///.../index.html" --need "看板" --storage "nexcore_logged_in=1"

--storage 会在加载后写入 localStorage 并刷新页面，用于检查登录态页面（默认登录页）。
输出 JSON：标题、正文长度、横向溢出、关键文本命中、按钮/图片数量、破图数、控制台异常。
"""

import argparse
import json
import os
import subprocess
import socket
import tempfile
import time
import urllib.request

EDGE_CANDIDATES = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_edge():
    for path in EDGE_CANDIDATES:
        if os.path.isfile(path):
            return path
    raise SystemExit("未找到 msedge.exe")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def cdp(port, method, params=None, timeout=30):
    """用 /json/list 找到页面 target，通过 WebSocket 发一条命令。"""
    ws_url = None
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/json/list" % port, timeout=2) as r:
                pages = json.loads(r.read().decode("utf-8"))
            page = next((p for p in pages if p.get("type") == "page"), None)
            if page:
                ws_url = page["webSocketDebuggerUrl"]
                break
        except Exception:
            time.sleep(0.4)
    if ws_url is None:
        raise SystemExit("CDP 未就绪")
    return ws_url


def run_probe(ws_url, url, need, storage, shot="", width=1440, height=900):
    """Node 侧：导航 → 可选写入 localStorage → 刷新 → 采集结果与异常。"""
    js = r"""
const ws = new WebSocket(process.argv[1]);
const url = process.argv[2];
const need = process.argv[3];
const storage = JSON.parse(process.argv[4] || "{}");
const shot = process.argv[5] || "";
const fs = require("fs");
const width = parseInt(process.argv[6] || "1440", 10);
const height = parseInt(process.argv[7] || "900", 10);
let id = 0; const pending = new Map(); const errors = [];
const send = (method, params) => new Promise((res) => {
  const mid = ++id; pending.set(mid, res);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else if (m.method === 'Runtime.exceptionThrown') {
    const d = m.params.exceptionDetails;
    errors.push((d.exception && d.exception.description) || d.text);
  }
};
ws.onopen = async () => {
  await send('Runtime.enable'); await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width, height, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url });
  await sleep(1200);
  const keys = Object.keys(storage);
  if (keys.length) {
    const expr = keys.map(k => `localStorage.setItem(${JSON.stringify(k)},${JSON.stringify(storage[k])})`).join(';');
    await send('Runtime.evaluate', { expression: expr });
    await send('Page.reload');
    await sleep(1500);
  }
  const expr = `JSON.stringify({title:document.title,
    len:(document.body.innerText||'').length,
    overflowX:document.documentElement.scrollWidth-window.innerWidth,
    hasNeed:(document.body.innerText||'').indexOf(${JSON.stringify(need)})>-1,
    buttons:document.querySelectorAll('button').length,
    imgs:document.querySelectorAll('img').length,
    brokenImgs:Array.prototype.filter.call(document.images,i=>i.complete&&i.naturalWidth===0).length})`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
  const out = JSON.parse(r.result.result.value);
  out.errors = errors.slice(0, 5);
  if (shot) {
    const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(shot, Buffer.from(cap.result.data, 'base64'));
    out.shot = shot;
  }
  console.log(JSON.stringify(out, null, 1));
  ws.close();
};
"""
    res = subprocess.run(["node", "-e", js, ws_url, url, need, json.dumps(storage, ensure_ascii=False),
                          shot, str(width), str(height)],
                         capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90)
    return (res.stdout or res.stderr or "").strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--need", default="", help="页面里应当出现的文本片段")
    ap.add_argument("--storage", action="append", default=[], help="登录态等预置键，形如 k=v（可多次）")
    ap.add_argument("--shot", default="", help="可选：把页面截图保存到该路径")
    ap.add_argument("--width", type=int, default=1440, help="截图/检测视口宽度")
    ap.add_argument("--height", type=int, default=900, help="截图/检测视口高度")
    ap.add_argument("--port", type=int, default=0, help="调试端口，0=自动选空闲端口")
    args = ap.parse_args()

    storage = {}
    for pair in args.storage:
        k, _, v = pair.partition("=")
        storage[k] = v

    edge = find_edge()
    if args.port == 0:
        args.port = free_port()
    profile = tempfile.mkdtemp(prefix="nexcore-smoke-")
    proc = subprocess.Popen(
        [edge, "--headless=new", "--remote-debugging-port=%d" % args.port, "--disable-gpu",
         "--no-sandbox", "--user-data-dir=%s" % profile, "--allow-file-access-from-files",
         args.url],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    try:
        ws_url = cdp(args.port, "Page.navigate")
        print(run_probe(ws_url, args.url, args.need, storage, args.shot, args.width, args.height))
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()
