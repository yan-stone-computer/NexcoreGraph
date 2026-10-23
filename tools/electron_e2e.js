/* 桌面包端到端检查：连上 Electron 的 CDP，在页面里执行一段 JS 并打印结果。

   用法：
     node tools/electron_e2e.js --port 9222 --js "document.title"
     node tools/electron_e2e.js --port 9222 --file check.js   （文件里写一段 async 表达式）

   为什么不用 Playwright：桌面包里的 Electron 已经自带 Chromium，开 --remote-debugging-port
   就能连，Node 22+ 自带 WebSocket，不用再装依赖。
*/
'use strict';
const fs = require('fs');

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf('--' + name);
  return i > -1 ? args[i + 1] : def;
}

const port = Number(arg('port', '9222'));
const js = arg('js', null);
const file = arg('file', null);
const code = file ? fs.readFileSync(file, 'utf8') : js;
if (!code) { console.error('缺少 --js 或 --file'); process.exit(2); }

(async () => {
  const deadline = Date.now() + 30000;
  let targets = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch('http://127.0.0.1:' + port + '/json/list');
      targets = await r.json();
      if (targets && targets.length) break;
    } catch (e) { /* 等应用起来 */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  const page = (targets || []).filter((t) => t.type === 'page')[0];
  if (!page) { console.error('没有找到页面 target'); process.exit(1); }
  console.log('target: ' + page.url);

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
  });
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });
  const call = (method, params) => new Promise((resolve) => {
    const mid = ++id;
    pending.set(mid, resolve);
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
  });

  const res = await call('Runtime.evaluate', {
    expression: '(async () => (' + code + '))()',
    awaitPromise: true,
    returnByValue: true
  });
  const out = res.result && res.result.result;
  if (res.result && res.result.exceptionDetails) {
    console.error('EXCEPTION: ' + JSON.stringify(res.result.exceptionDetails.exception || res.result.exceptionDetails));
    process.exit(1);
  }
  console.log(typeof out.value === 'string' ? out.value : JSON.stringify(out.value, null, 2));
  ws.close();
})();
