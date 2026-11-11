# -*- coding: utf-8 -*-
"""Admin-page browser verification with isolated state."""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile

from verify_rescue_web import cdp_ws, find_edge, free_port, test_db


PROBE = r"""
const ws = new WebSocket(process.argv[1]);
const url = process.argv[2];
const db = JSON.parse(process.argv[3]);
let id = 0;
const pending = new Map();
const errors = [];
const send = (method, params = {}) => new Promise((resolve) => {
  const mid = ++id;
  pending.set(mid, resolve);
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const done = pending.get(msg.id);
    pending.delete(msg.id);
    done(msg);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const detail = msg.params.exceptionDetails;
    errors.push((detail.exception && detail.exception.description) || detail.text);
  }
};
ws.onopen = async () => {
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false
  });
  await send("Page.navigate", { url });
  await sleep(800);
  await send("Runtime.evaluate", {
    expression: `localStorage.setItem("nexcore_web_db_v3", ${JSON.stringify(JSON.stringify(db))});
      sessionStorage.setItem("nexcore_admin_in", "1");
      sessionStorage.removeItem("nexcore_admin_token");`
  });
  await send("Page.reload");
  await sleep(900);
  const result = await send("Runtime.evaluate", {
    expression: `(async () => {
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const waitFor = async (fn, timeout = 5000) => {
        const start = Date.now();
        while (Date.now() - start < timeout) {
          const value = fn();
          if (value) return value;
          await sleep(80);
        }
        throw new Error("waitFor timeout");
      };
      const users = await waitFor(() => document.body.innerText.includes("用户管理"));
      const firstToggle = document.querySelector('[data-action="user:toggle"]');
      const before = window.DB.users[0] && window.DB.users[0].disabled;
      if (firstToggle) firstToggle.click();
      await waitFor(() => window.DB.users[0] && window.DB.users[0].disabled !== before);
      const userToggle = window.DB.users[0].disabled !== before;
      document.querySelector('[data-action="nav:go"][data-view="config"]').click();
      await waitFor(() => document.getElementById("cfg-provider"));
      document.getElementById("cfg-provider").value = "OpenAI Compatible / Anthropic / Gemini";
      document.getElementById("cfg-model").value = "review-model";
      document.querySelector('[data-action="config:save"]').click();
      await waitFor(() => window.DB.config.model === "review-model");
      return {
        users,
        userToggle,
        configView: document.body.innerText.includes("系统配置"),
        configSaved: window.DB.config.model === "review-model",
        providerField: Boolean(document.getElementById("cfg-provider")),
        overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth)
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  const detail = result.result && result.result.exceptionDetails;
  const value = result.result && result.result.result && result.result.result.value;
  if (value) value.errors = errors.slice(0, 5);
  console.log(JSON.stringify(detail ? {
    probeException: (detail.exception && detail.exception.description) || detail.text,
    errors
  } : value, null, 2));
  ws.close();
};
"""


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8080/admin.html"
    db = test_db()
    db["users"] = [{
        "phone": "reviewer@example.com",
        "name": "验收管理员",
        "role": "管理员",
        "familyId": db["familyId"],
        "createdAt": "2026-11-11",
        "disabled": False,
    }]
    edge = find_edge()
    port = free_port()
    profile = tempfile.mkdtemp(prefix="nexcore-admin-")
    process = subprocess.Popen(
        [
            edge,
            "--headless=new",
            "--remote-debugging-port=%d" % port,
            "--disable-gpu",
            "--no-sandbox",
            "--user-data-dir=%s" % profile,
            url,
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
    )
    try:
        ws_url = cdp_ws(port)
        response = subprocess.run(
            [
                "node",
                "-e",
                PROBE,
                ws_url,
                url,
                json.dumps(db, ensure_ascii=False),
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=60,
        )
        print((response.stdout or "").strip() or (response.stderr or "").strip())
        if response.returncode:
            raise SystemExit(response.returncode)
    finally:
        process.terminate()
        try:
            process.wait(timeout=8)
        except subprocess.TimeoutExpired:
            process.kill()


if __name__ == "__main__":
    main()
