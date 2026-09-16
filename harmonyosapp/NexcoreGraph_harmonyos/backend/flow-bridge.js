/* 启核图策 · 跨设备流转中转（演示/兜底通道）
 *
 * 为什么需要它：HarmonyOS 的系统级「应用接续」要求两台设备同账号、同网段、
 * 且两端都是正式签名包 —— 模拟器之间无法组网（没有 dsoftbus），演示时用不了。
 * 这个中转服务让「同一份流程快照」真的从设备 A 传到设备 B：
 *   设备 A：POST /api/flow/publish  { from, json }
 *   设备 B：GET  /api/flow/latest    -> { found, from, at, json } -> 还原
 * 端上走的还是 Continuation.ets 里同一份快照（字段、版本、隐私口径完全一致），
 * 所以「系统接续」和「中转流转」在演示时表现一致。
 *
 * 零依赖、不碰 MySQL，直接：node backend/flow-bridge.js（默认 3100 端口）
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.FLOW_PORT || 3100);
const FILE = path.join(__dirname, 'flow-bridge.json');

let latest = null;   // { from: string, at: number, json: string }
try {
  latest = JSON.parse(fs.readFileSync(FILE, 'utf8'));
} catch (_e) {
  latest = null;
}

function persist() {
  try {
    fs.writeFileSync(FILE, JSON.stringify(latest));
  } catch (_e) {
    // 落盘失败不影响内存态，演示仍可继续
  }
}

function send(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    send(res, 200, { ok: true, service: 'nexcore-flow-bridge', port: PORT, has: latest !== null });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/flow/publish') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try {
        const b = JSON.parse(body || '{}');
        const json = String(b.json || '');
        if (json === '' || json.length > 4096) {
          send(res, 400, { ok: false, error: 'snapshot empty or too large' });
          return;
        }
        latest = { from: String(b.from || '未知设备'), at: Date.now(), json: json };
        persist();
        console.log('[flow-bridge] published from=' + latest.from + ' bytes=' + json.length);
        send(res, 200, { ok: true, at: latest.at });
      } catch (e) {
        send(res, 400, { ok: false, error: 'bad json' });
      }
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/flow/latest') {
    if (latest === null) {
      send(res, 200, { found: false });
      return;
    }
    const since = Number(url.searchParams.get('since') || 0);
    if (since > 0 && latest.at <= since) {
      send(res, 200, { found: false });
      return;
    }
    send(res, 200, { found: true, from: latest.from, at: latest.at, json: latest.json });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/flow/clear') {
    latest = null;
    persist();
    send(res, 200, { ok: true });
    return;
  }

  send(res, 404, { ok: false, error: 'not found' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('[flow-bridge] listening on http://0.0.0.0:' + PORT +
    '  (publish: POST /api/flow/publish, pull: GET /api/flow/latest)');
});
