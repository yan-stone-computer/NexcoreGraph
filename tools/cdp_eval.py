# -*- coding: utf-8 -*-
"""在 headless Edge 里打开页面并执行一段 JS（CDP），用于本地联调与回归。

用法：
  python tools/cdp_eval.py --url http://127.0.0.1:8090/index.html --eval "document.title"
  python tools/cdp_eval.py --url ... --storage "k=v" --eval "localStorage.getItem('k')"
"""
import argparse
import json
import os
import socket
import subprocess
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
    raise SystemExit("no msedge.exe")


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def ws_url(port, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d/json/list" % port, timeout=2) as r:
                pages = json.loads(r.read().decode("utf-8"))
            page = next((p for p in pages if p.get("type") == "page"), None)
            if page:
                return page["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.4)
    raise SystemExit("CDP not ready")


JS = r"""
const ws = new WebSocket(process.argv[1]);
const url = process.argv[2];
const storage = JSON.parse(process.argv[3] || "{}");
const expr = process.argv[4];
let id = 0;
const send = (method, params) => new Promise((res) => {
  const myId = ++id;
  const onMsg = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id === myId) { ws.removeEventListener("message", onMsg); res(m.result); }
  };
  ws.addEventListener("message", onMsg);
  ws.send(JSON.stringify({ id: myId, method, params }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
ws.onopen = async () => {
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url });
  await sleep(1200);
  for (const k of Object.keys(storage)) {
    await send("Runtime.evaluate", { expression: `localStorage.setItem(${JSON.stringify(k)}, ${JSON.stringify(storage[k])})` });
  }
  await send("Page.reload");
  await sleep(2200);
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  console.log(JSON.stringify({
    ok: !(r && r.exceptionDetails),
    value: r && r.result ? r.result.value : null,
    desc: r && r.result ? r.result.description : null,
    error: r && r.exceptionDetails
      ? ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text)
      : null
  }, null, 1));
  ws.close();
  process.exit(0);
};
ws.onerror = (e) => { console.log(JSON.stringify({ ok: false, error: String(e) })); process.exit(1); };
"""


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True)
    ap.add_argument("--storage", action="append", default=[])
    ap.add_argument("--eval", required=True)
    args = ap.parse_args()
    storage = {}
    for pair in args.storage:
        k, _, v = pair.partition("=")
        storage[k] = v
    port = free_port()
    edge = find_edge()
    profile = os.path.join(os.environ.get("TEMP", "."), "edge_cdp_%d" % port)
    proc = subprocess.Popen([
        edge, "--headless=new", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
        "--remote-debugging-port=%d" % port, "--user-data-dir=%s" % profile, args.url,
    ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws = ws_url(port)
        res = subprocess.run(["node", "-e", JS, ws, args.url, json.dumps(storage, ensure_ascii=False), args.eval],
                             capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=120)
        print((res.stdout or "").strip())
        if res.returncode != 0:
            print((res.stderr or "").strip()[:2000])
    finally:
        proc.terminate()


if __name__ == "__main__":
    main()
