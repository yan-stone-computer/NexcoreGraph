# -*- coding: utf-8 -*-
"""临期救援 Web 端端到端验收（headless Edge + CDP）。

覆盖：登录态数据注入、导航、15 分钟筛选、推荐预览、执行、撤销和移动端溢出。
不依赖后端；使用独立的临时浏览器 profile，不污染用户当前浏览器。
"""

import argparse
import json
import os
import socket
import subprocess
import sys
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
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def cdp_ws(port, timeout=30):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(
                "http://127.0.0.1:%d/json/list" % port, timeout=2
            ) as response:
                pages = json.loads(response.read().decode("utf-8"))
            page = next((row for row in pages if row.get("type") == "page"), None)
            if page:
                return page["webSocketDebuggerUrl"]
        except Exception:
            time.sleep(0.35)
    raise SystemExit("CDP 未就绪")


def item(item_id, name, kb_key, qty, unit, price, exp_days, pos):
    return {
        "id": item_id,
        "no": "NO-" + item_id[-3:],
        "name": name,
        "emoji": "",
        "img": "",
        "kbKey": kb_key,
        "qty": qty,
        "unit": unit,
        "price": price,
        "priceSrc": "测试种子",
        "expDays": exp_days,
        "pos": pos,
        "lowAt": 1,
        "addedAt": 1,
        "private": False,
        "expiring": 0 < exp_days <= 7,
    }


def test_db():
    items = [
        item("it-egg", "鸡蛋", "egg", 8, "个", 12, 1, "冷藏区上层"),
        item("it-tomato", "番茄", "tomato", 6, "个", 10, 2, "果蔬抽屉"),
        item("it-milk", "鲜牛奶", "milk", 3, "盒", 16, 1, "冷藏区上层"),
        item("it-oat", "燕麦", "oat", 2, "袋", 22, 180, "食品柜"),
        item("it-noodle", "挂面", "noodle", 3, "袋", 13, 180, "食品柜"),
        item("it-chicken", "鸡肉", "chicken", 2, "份", 26, 2, "冷藏区下层"),
        item("it-mushroom", "蘑菇", "mushroom", 4, "朵", 8, 1, "果蔬抽屉"),
        item("it-greens", "上海青", "greens", 2, "把", 7, 1, "果蔬抽屉"),
        item("it-tofu", "豆腐", "tofu", 2, "盒", 7, 2, "冷藏区中层"),
        item("it-bokchoy", "小白菜", "bokchoy", 2, "把", 6, 2, "果蔬抽屉"),
        item("it-cucumber", "黄瓜", "cucumber", 2, "根", 5, 3, "果蔬抽屉"),
        item("it-shrimp", "虾", "shrimp", 1, "袋", 36, 1, "冷冻区"),
    ]
    return {
        "user": {"name": "验收员", "phone": "reviewer@example.com", "role": "管理员", "initial": "验"},
        "family": {"id": "fam-review", "name": "评审体验家庭"},
        "familyId": "fam-review",
        "families": [{"id": "fam-review", "name": "评审体验家庭", "memberCount": 3}],
        "users": [],
        "members": {
            "fam-review": [
                {"name": "验收员", "phone": "reviewer@example.com", "role": "管理员"},
                {"name": "成员", "phone": "member@example.com", "role": "成员"},
            ]
        },
        "libraries": [
            {
                "id": "fridge",
                "name": "冰箱",
                "icon": "fridge",
                "tone": "teal",
                "count": len(items),
                "desc": "临期救援验收库存",
                "items": items,
            }
        ],
        "alerts": [],
        "plans": [],
        "shopping": [],
        "chat": [],
        "daily": [],
        "logs": [],
        "history7": [],
        "aiUsage": [],
        "workbench": None,
        "intake": {"step": 0, "results": []},
        "settings": {
            "private": True,
            "chat": True,
            "expiry": True,
            "digest": True,
            "low": True,
            "alertSoon": 7,
            "alertCritical": 3,
        },
        "profile": {"people": 3, "dislikes": "", "goal": "均衡", "enabled": True},
        "budget": 600,
        "config": {
            "model": "DeepSeek-V3",
            "visionModel": "Agnes-Vision",
            "webSearch": True,
            "searchCacheMin": 10,
            "rateLimitPerDay": 200,
            "unitPrice": 0.002,
            "visionPrice": 0.01,
            "identifyThreshold": 0.85,
            "pushTemplate": "【启核图策】{{content}}",
            "knowledgeVersion": 1,
        },
        "stats": {"mealsLeft": 0, "daysLeft": 0, "wasted": 0},
        "syncVersion": 1,
    }


PROBE_JS = r"""
const ws = new WebSocket(process.argv[1]);
const url = process.argv[2];
const db = JSON.parse(process.argv[3]);
const desktopShot = process.argv[4] || "";
const mobileShot = process.argv[5] || "";
const workbenchShot = process.argv[6] || "";
const drawerShot = process.argv[7] || "";
const testModelFallback = process.argv[8] === "1";
const fs = require("fs");
let id = 0;
const pending = new Map();
const errors = [];
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const mid = ++id;
  pending.set(mid, { resolve, reject });
  ws.send(JSON.stringify({ id: mid, method, params }));
});
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
ws.onmessage = event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const job = pending.get(msg.id);
    pending.delete(msg.id);
    job.resolve(msg);
  } else if (msg.method === "Runtime.exceptionThrown") {
    const detail = msg.params.exceptionDetails;
    errors.push((detail.exception && detail.exception.description) || detail.text);
  }
};
ws.onopen = async () => {
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false
  });
  await send("Page.navigate", { url });
  await sleep(900);
  const storage = {
    "nexcore_web_db_v3": JSON.stringify(db),
    "nexcore_logged_in": "1"
  };
  for (const key of Object.keys(storage)) {
    await send("Runtime.evaluate", {
      expression: `localStorage.setItem(${JSON.stringify(key)},${JSON.stringify(storage[key])})`
    });
  }
  await send("Page.reload");
  await sleep(2200);
  await send("Runtime.evaluate", { expression: `location.hash = "#/aiwork"` });
  await sleep(1300);
  const workbenchResult = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      titleVisible: document.body.innerText.includes("今晚先救哪几样"),
      solverVisible: document.body.innerText.includes("Pareto + 组合求解"),
      rescueCta: Boolean(document.querySelector('[data-action="nav:go"][data-view="rescue"]'))
    })`,
    returnByValue: true
  });
  const workbench = JSON.parse(workbenchResult.result.result.value);
  if (workbenchShot) {
    const image = await send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: false
    });
    fs.writeFileSync(workbenchShot, Buffer.from(image.result.data, "base64"));
  }
  await send("Runtime.evaluate", { expression: `location.hash = "#/rescue"` });
  await sleep(1000);
  if (desktopShot) {
    const image = await send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: false
    });
    fs.writeFileSync(desktopShot, Buffer.from(image.result.data, "base64"));
  }
  const probe = `(async () => {
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const waitFor = async (fn, timeout = 6000) => {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        const value = fn();
        if (value) return value;
        await sleep(80);
      }
      throw new Error("waitFor timeout");
    };
    const nav = await waitFor(() => Array.from(document.querySelectorAll(".nav-item"))
      .find(el => el.textContent.includes("临期救援")));
    nav.click();
    await waitFor(() => document.body.innerText.includes("临期救援驾驶舱"));
    await waitFor(() => document.querySelectorAll(".rescue-card").length > 0);
    const initialCards = document.querySelectorAll(".rescue-card").length;
    const portfolio = await waitFor(() => document.querySelector(".rescue-portfolio")?.innerText);
    const timeButton = document.querySelector('[data-rescue-action="time"][data-value="15"]');
    timeButton.click();
    await waitFor(() => document.body.innerText.includes("当前模式：综合救援"));
    await sleep(600);
    const filtered = await window.API.rescueCandidates({ mode: "rescue", maxMinutes: 15, includeMissing: true });
    const filter = filtered.candidates.length > 0 && filtered.candidates.every(c => c.timeMinutes <= 15);
    const detailsButton = await waitFor(() => document.querySelector('[data-rescue-action="details"]'));
    detailsButton.click();
    await waitFor(() => document.querySelector("#rescue-overlay.show .rescue-drawer-panel"));
    const drawerText = document.querySelector("#rescue-overlay.show").innerText;
    document.querySelector("#rescue-overlay [data-rescue-action=close-overlay]").click();
    await waitFor(() => !document.querySelector("#rescue-overlay.show"));
    const previewButton = await waitFor(() => document.querySelector('[data-rescue-action="preview"]'));
    previewButton.click();
    await waitFor(() => document.querySelector("#rescue-overlay.show .rescue-preview-panel"));
    const previewBeforeWrite = document.querySelector("#rescue-overlay.show").innerText.includes("确认前不会扣减库存");
    document.querySelector('#rescue-overlay [data-rescue-action="confirm"][data-execute="1"]').click();
    await waitFor(() => !document.querySelector("#rescue-overlay.show"), 12000);
    const executed = await waitFor(() => window.API.getState().plans.find(p => p.rescue && p.status === "done"), 12000);
    const snapshot = executed.snapshot.slice();
    await window.API.rollbackPlan(executed.id);
    const undoRestoresStock = snapshot.every(row => {
      const hit = window.API.getState().libraries.flatMap(l => l.items || []).find(it => it.id === row.id);
      return hit && hit.qty === row.before;
    });
    return {
      navigation: document.body.innerText.includes("临期救援驾驶舱"),
      initialCards,
      portfolio: Boolean(portfolio),
      filter,
      drawer: drawerText.includes("推荐依据") && drawerText.includes("做法"),
      previewBeforeWrite,
      execute: Boolean(executed),
      undoRestoresStock,
      paretoVisible: document.body.innerText.includes("PARETO"),
      noModelLabel: document.body.innerText.includes("0 次模型调用") || document.body.innerText.includes("离线可运行"),
      consoleErrors: []
    };
  })()`;
  const result = await send("Runtime.evaluate", {
    expression: probe,
    awaitPromise: true,
    returnByValue: true
  });
  let value = result.result && result.result.result ? result.result.result.value : null;
  if (!value) {
    const detail = result.result && result.result.exceptionDetails;
    value = {
      ok: false,
      probeException: detail
        ? ((detail.exception && detail.exception.description) || detail.text)
        : "Runtime.evaluate returned no value"
    };
  }
  if (value) value.consoleErrors = errors.slice(0, 5);
  if (value) {
    value.workbench = workbench.titleVisible && workbench.solverVisible && workbench.rescueCta;
  }
  if (testModelFallback) {
    const fallbackResult = await send("Runtime.evaluate", {
      expression: `window.AI.reply("请总结一下我的家庭资源").then(function (r) {
        return JSON.stringify({ model: r.model, src: r.src || "", text: String(r.text || "").slice(0, 180) });
      })`,
      awaitPromise: true,
      returnByValue: true
    });
    const fallbackValue = fallbackResult.result.result.value;
    if (value) value.modelFallback = JSON.parse(fallbackValue);
  }
  if (drawerShot) {
    await send("Runtime.evaluate", {
      expression: `document.querySelector('[data-rescue-action="details"]').click()`
    });
    await sleep(350);
    const drawerImage = await send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: false
    });
    fs.writeFileSync(drawerShot, Buffer.from(drawerImage.result.data, "base64"));
    await send("Runtime.evaluate", {
      expression: `document.querySelector('#rescue-overlay [data-rescue-action="close-overlay"]').click()`
    });
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1024, height: 768, deviceScaleFactor: 1, mobile: false
  });
  await sleep(450);
  const tabletOverflow = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      titleVisible: document.body.innerText.includes("临期救援驾驶舱")
    })`,
    returnByValue: true
  });
  const tablet = JSON.parse(tabletOverflow.result.result.value);
  if (value) {
    value.tabletOverflowX = tablet.overflowX;
    value.tabletTitleVisible = tablet.titleVisible;
  }
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390, height: 844, deviceScaleFactor: 1, mobile: true
  });
  await sleep(500);
  const overflow = await send("Runtime.evaluate", {
    expression: `JSON.stringify({
      overflowX: Math.max(0, document.documentElement.scrollWidth - window.innerWidth),
      titleVisible: document.body.innerText.includes("临期救援驾驶舱")
    })`,
    returnByValue: true
  });
  const mobile = JSON.parse(overflow.result.result.value);
  if (value) {
    value.mobileOverflowX = mobile.overflowX;
    value.mobileTitleVisible = mobile.titleVisible;
  }
  if (mobileShot) {
    const image = await send("Page.captureScreenshot", {
      format: "png", captureBeyondViewport: false
    });
    fs.writeFileSync(mobileShot, Buffer.from(image.result.data, "base64"));
  }
  console.log(JSON.stringify(value, null, 2));
  ws.close();
};
"""


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", required=True)
    parser.add_argument("--desktop-shot", default="")
    parser.add_argument("--mobile-shot", default="")
    parser.add_argument("--workbench-shot", default="")
    parser.add_argument("--drawer-shot", default="")
    parser.add_argument("--test-model-fallback", action="store_true")
    args = parser.parse_args()
    edge = find_edge()
    port = free_port()
    profile = tempfile.mkdtemp(prefix="nexcore-rescue-")
    process = subprocess.Popen(
        [
            edge,
            "--headless=new",
            "--remote-debugging-port=%d" % port,
            "--disable-gpu",
            "--no-sandbox",
            "--allow-file-access-from-files",
            "--user-data-dir=%s" % profile,
            args.url,
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
                PROBE_JS,
                ws_url,
                args.url,
                json.dumps(test_db(), ensure_ascii=False),
                args.desktop_shot,
                args.mobile_shot,
                args.workbench_shot,
                args.drawer_shot,
                "1" if args.test_model_fallback else "0",
            ],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=120,
        )
        output = (response.stdout or "").strip()
        print(output or (response.stderr or "").strip())
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
