/* 真实操作录屏：CDP Page.startScreencast 采集浏览器帧，按时间戳落盘 */
const fs = require("fs");
const path = require("path");

const wsUrl = process.argv[2];
const outDir = process.argv[3];
const BASE = process.argv[4] || "http://127.0.0.1:3005";
const ACCOUNT = process.argv[5] || "demo-show@example.com";
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const ws = new WebSocket(wsUrl);
let seq = 0;
const pending = new Map();
let frames = [];
let recording = false;

ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
  if (m.method === "Page.screencastFrame") {
    if (recording) frames.push({ t: m.params.metadata.timestamp, data: m.params.data });
    ws.send(JSON.stringify({ id: ++seq, method: "Page.screencastFrameAck", params: { sessionId: m.params.sessionId } }));
    return;
  }
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
});
const send = (method, params) => new Promise((res) => {
  const id = ++seq; pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function js(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r && r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r && r.result ? r.result.value : null;
}
async function click(sel) {
  return js(`(function(){var el=document.querySelector(${JSON.stringify(sel)}); if(el){el.click();return true;} return false;})()`);
}

ws.onopen = async () => {
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:8090/index.html" });
    await sleep(1600);
    await js(`window.AGNES.saveCfg({ baseUrl: '${BASE}' })`);

    const code = await js(`(async function(){
      var r=await fetch('${BASE}/api/auth/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'${ACCOUNT}'})});
      var j=await r.json(); return j.devCode || '';
    })()`);
    await js(`(function(){
      var p=document.getElementById('login-phone'), c=document.getElementById('login-code');
      p.value='${ACCOUNT}'; p.dispatchEvent(new Event('input',{bubbles:true}));
      c.value='${code}'; c.dispatchEvent(new Event('input',{bubbles:true}));
      document.getElementById('login-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
    })()`);
    await sleep(4500);

    await send("Page.startScreencast", { format: "jpeg", quality: 82, maxWidth: 1440, maxHeight: 900, everyNthFrame: 1 });
    recording = true;
    await sleep(1200);

    // 拍照入库：打开浮层 → 喂真实图片 → 识别 → 确认入库
    await click('[data-action="overlay:open"][data-type="intake"]'); await sleep(1200);
    try {
      const doc = await send("DOM.getDocument", { depth: -1 });
      const q = await send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: 'input[type="file"]' });
      if (q && q.nodeId) {
        await send("DOM.setFileInputFiles", { nodeId: q.nodeId, files: ["D:\\ProjectFiles\\GithubPackage\\NexcoreGraph\\web\\NexcoreGraph_web\\assets\\img\\fridge.jpg"] });
        await sleep(4500);
        await click('[data-action="intake:confirm"]'); await sleep(2500);
      }
    } catch (e) { /* 上传失败则不阻塞其余演示 */ }
    await click('[data-action="overlay:close"]'); await sleep(800);

    await click('[data-view="dashboard"]'); await sleep(3500);
    await click('[data-view="libraries"]'); await sleep(3000);
    await click('[data-view="graph"]'); await sleep(4000);
    await click('[data-action="overlay:open"][data-type="alerts"]'); await sleep(3000);
    await click('[data-action="overlay:close"]'); await sleep(800);
    await click('[data-action="overlay:open"][data-type="plans"]'); await sleep(3000);
    await click('[data-action="overlay:close"]'); await sleep(600);
    await click('[data-action="overlay:open"][data-type="shopping"]'); await sleep(2500);
    await click('[data-action="overlay:close"]'); await sleep(600);
    await click('[data-view="aiwork"]'); await sleep(1200);
    await click('[data-action="ai:toggle"]'); await sleep(1500);
    await js(`(function(){
      var i=document.getElementById('chat-text');
      if(!i) return false;
      i.value='鸡蛋还剩 5 个'; i.dispatchEvent(new Event('input',{bubbles:true}));
      i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true}));
      return true;
    })()`);
    await sleep(3500);
    await click('[data-action="chat:card-confirm"]'); await sleep(3000);
    await click('[data-action="ai:close"]'); await sleep(800);
    await click('[data-view="workbench"]'); await sleep(3000);

    // 管理端
    await send("Page.navigate", { url: "http://127.0.0.1:8090/admin.html" });
    await sleep(1600);
    await js(`window.AGNES.saveCfg({ baseUrl: '${BASE}' })`);
    const acode = await js(`(async function(){
      var r=await fetch('${BASE}/api/auth/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'${ACCOUNT}'})});
      var j=await r.json(); return j.devCode || '';
    })()`);
    await js(`(function(){
      document.getElementById('admin-phone').value='${ACCOUNT}';
      document.getElementById('admin-code').value='${acode}';
      document.getElementById('admin-login-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
    })()`);
    await sleep(3200);
    await click('[data-view="graphstats"]'); await sleep(2500);

    recording = false;
    await send("Page.stopScreencast");

    let prev = frames.length ? frames[0].t : 0;
    const meta = [];
    frames.forEach((f, i) => {
      const name = "f" + String(i).padStart(5, "0") + ".jpg";
      fs.writeFileSync(path.join(outDir, name), Buffer.from(f.data, "base64"));
      const dur = Math.max(0.05, Math.min(0.6, f.t - prev));
      meta.push({ file: name, duration: dur });
      prev = f.t;
    });
    meta.push({ file: meta.length ? meta[meta.length - 1].file : "", duration: 1.5 });
    fs.writeFileSync(path.join(outDir, "timing.json"), JSON.stringify(meta, null, 1));
    console.log("frames:", frames.length, "out:", outDir);
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error("RECORD FAILED:", e.message);
    ws.close();
    process.exit(1);
  }
};
ws.onerror = (e) => { console.error("WS ERROR", String(e)); process.exit(1); };
