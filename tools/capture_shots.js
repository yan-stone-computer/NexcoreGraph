/* 用 CDP 登录真实后端、灌入演示数据、逐页截图（供 PPT / 视频使用） */
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
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m.result);
    pending.delete(m.id);
  }
});
const send = (method, params) => new Promise((res) => {
  const id = ++seq;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params: params || {} }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function js(expr) {
  const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
  if (r && r.exceptionDetails) {
    throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  }
  return r && r.result ? r.result.value : null;
}

async function shot(name) {
  const r = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(path.join(outDir, name + ".png"), Buffer.from(r.data, "base64"));
  console.log("shot:", name);
}

async function nav(view) {
  await js(`(function(){var el=document.querySelector('[data-view="${view}"]'); if(el) el.click();})()`);
  await sleep(900);
}

async function login() {
  const code = await js(`(async function(){
    var r=await fetch('${BASE}/api/auth/code',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({account:'${ACCOUNT}'})});
    var j=await r.json(); return j.devCode || '';
  })()`);
  if (!code) throw new Error("no devCode from backend");
  await js(`(function(){
    var p=document.getElementById('login-phone'), c=document.getElementById('login-code');
    p.value='${ACCOUNT}'; p.dispatchEvent(new Event('input',{bubbles:true}));
    c.value='${code}'; c.dispatchEvent(new Event('input',{bubbles:true}));
    document.getElementById('login-form').dispatchEvent(new Event('submit',{cancelable:true,bubbles:true}));
  })()`);
  await sleep(4500);
}

async function seed() {
  const res = await js(`(async function(){
    if (window.DB.libraries.length > 0) return 'already';
    var A = window.API;
    var specs = [
      ['冰箱','fridge','teal',[['鸡蛋',8,'个',3,'冷藏区中层',15.9],['鲜牛奶',1,'盒',3,'冷藏区上层',12.5],['番茄',4,'个',6,'冷藏区底层',6.8],['上海青',2,'把',4,'冷藏区底层',8.4],['五花肉',500,'克',90,'冷冻区',46]]],
      ['药盒','pill','red',[['布洛芬',1,'盒',30,'第一层',32],['创可贴',1,'盒',500,'第二层',9.9]]],
      ['工具箱','wrench','slate',[['螺丝刀套装',1,'套',0,'主隔层',89],['卷尺',1,'把',0,'配件盒',15]]],
      ['书架','book','brown',[['三体（全集）',1,'套',0,'第二层',168]]]
    ];
    for (var i=0;i<specs.length;i++){
      var s=specs[i];
      await A.createLibrary(s[0],s[1],s[2]);
      var l=window.DB.libraries.filter(function(x){return x.name===s[0];})[0];
      for (var j=0;j<s[3].length;j++){
        var it=s[3][j];
        await A.addItem(l.id,{name:it[0],qty:it[1],unit:it[2],expDays:it[3],pos:it[4],price:it[5],category:'食材',private:false});
      }
    }
    await A.generatePlans();
    return 'seeded';
  })()`);
  console.log("seed:", res);
  await sleep(1200);
}

ws.onopen = async () => {
  try {
    await send("Runtime.enable");
    await send("Page.enable");
    await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    await send("Page.navigate", { url: "http://127.0.0.1:8090/index.html" });
    await sleep(1600);
    await js(`window.AGNES.saveCfg({ baseUrl: '${BASE}' })`);
    await shot("01-login");

    await login();
    await seed();

    await nav("aiwork"); await shot("02-ai-workbench");
    await nav("dashboard"); await shot("03-dashboard");

    await js(`(function(){var b=document.querySelector('[data-action="overlay:open"][data-type="intake"]'); if(b) b.click();})()`);
    await sleep(700); await shot("04-intake");
    await js(`(function(){var b=document.querySelector('[data-action="overlay:close"]'); if(b) b.click();})()`);
    await sleep(400);

    await nav("libraries"); await shot("05-libraries");
    await nav("graph"); await shot("06-graph");
    await nav("workbench"); await shot("07-workbench");

    await js(`(function(){var all=document.querySelectorAll('[data-action]');for(var i=0;i<all.length;i++){if(all[i].getAttribute('data-action')==='overlay:open'&&all[i].getAttribute('data-type')==='settings'){all[i].click();return;}}})()`);
    await sleep(700);
    await js(`(function(){var el=document.getElementById('live-state'); if(el) el.scrollIntoView({block:'center'});})()`);
    await sleep(500); await shot("08-settings");

    // 管理端（同一账号是管理员）
    await send("Page.navigate", { url: "http://127.0.0.1:8090/admin.html" });
    await sleep(1500);
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
    await sleep(3200); await shot("09-admin");

    // 手机视口
    await send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    await send("Page.navigate", { url: "http://127.0.0.1:8090/index.html" });
    await sleep(2200);
    await js(`window.AGNES.saveCfg({ baseUrl: '${BASE}' })`);
    await sleep(1200); await shot("10-mobile");

    console.log("DONE");
    ws.close();
    process.exit(0);
  } catch (e) {
    console.error("CAPTURE FAILED:", e.message);
    ws.close();
    process.exit(1);
  }
};
ws.onerror = (e) => { console.error("WS ERROR", String(e)); process.exit(1); };
