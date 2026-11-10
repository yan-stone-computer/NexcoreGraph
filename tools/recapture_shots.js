/* 补拍：AI 工作台、拍照入库、管理端图谱看板 */
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
ws.addEventListener("message", (ev) => {
  const m = JSON.parse(ev.data);
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
async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(path.join(outDir, name + ".png"), Buffer.from(r.data, "base64"));
  console.log("shot:", name);
}
async function loginOnIndex() {
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
  await sleep(4200);
}

ws.onopen = async () => {
  try {
    await send("Runtime.enable"); await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send("Page.navigate", { url: "http://127.0.0.1:8090/index.html" });
    await sleep(1600);
    await js(`window.AGNES.saveCfg({ baseUrl: '${BASE}' })`);
    await loginOnIndex();
    await sleep(1200);
    await js(`(function(){var el=document.querySelector('[data-view="aiwork"]'); if(el) el.click();})()`);
    await sleep(1400);
    await shot("02-ai-workbench");

    await js(`(function(){var el=document.querySelector('[data-view="aiwork"]'); if(el) el.click();})()`);
    await sleep(900);
    /* 预警中心（浮层，已实测可打开）；拍照入库浮层在无摄像头时展示价值有限 */
    await js(`(function(){
      var b=document.querySelector('[data-action="overlay:open"][data-type="alerts"]');
      if (!b) {
        var all=document.querySelectorAll('[data-action]');
        for (var i=0;i<all.length;i++){
          if (all[i].getAttribute('data-action')==='overlay:open' && all[i].getAttribute('data-type')==='alerts'){ b=all[i]; break; }
        }
      }
      if (b) b.click();
    })()`);
    await sleep(900);
    await shot("04-alerts");
    await js(`(function(){var b=document.querySelector('[data-action="overlay:close"]'); if(b) b.click();})()`);
    await sleep(400);
    await js(`(function(){var el=document.querySelector('[data-view="graph"]'); if(el) el.click();})()`);
    await sleep(1600);
    await shot("06-graph");

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
    await js(`(function(){var el=document.querySelector('[data-view="graphstats"]'); if(el) el.click();})()`);
    await sleep(1400);
    await shot("09-admin");

    // 手机端
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url: "http://127.0.0.1:8090/index.html" });
    await sleep(2200);
    await js(`window.AGNES.saveCfg({ baseUrl: '${BASE}' })`);
    await sleep(4200);
    await js(`(function(){var el=document.querySelector('[data-view="dashboard"]'); if(el) el.click();})()`);
    await sleep(900);
    await shot("10-mobile");

    console.log("DONE");
    ws.close(); process.exit(0);
  } catch (e) { console.error("RECAPTURE FAILED:", e.message); ws.close(); process.exit(1); }
};
ws.onerror = (e) => { console.error("WS ERROR", String(e)); process.exit(1); };
