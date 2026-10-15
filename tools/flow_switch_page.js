/* 用流转通道远程切换端侧页面（不改坐标、不点屏幕）。
   原理：App 每 2 秒轮询 GET /api/flow/latest，收到别端发布的快照就应用。
   我们扮演"另一台设备"，发布一份带 tab 的页面状态 + 真实数据快照，让手机自己切页。
   用法：node tools/flow_switch_page.js <tabIndex> [bridgeUrl] [backendUrl]
   注意：json 必须是端侧 FlowState 的字段集合，v 必须等于端侧 FLOW_VERSION，否则会被判为版本不一致。 */
const http = require('http');

const TAB = Number(process.argv[2] || 2);
const BRIDGE = process.argv[3] || 'http://127.0.0.1:3100';
const BACKEND = process.argv[4] || 'http://127.0.0.1:3000';
const FAMILY = process.env.NXG_FAMILY || '';

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve(b));
    }).on('error', reject);
  });
}

function post(url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
    }, (res) => {
      let b = '';
      res.on('data', (c) => (b += c));
      res.on('end', () => resolve(res.statusCode + ' ' + b.slice(0, 200)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  // 1) 取一份真实数据快照：优先用中转里最新的（就是端侧自己产出的），没有就退回后端同步快照
  let data = '';
  try {
    const latest = JSON.parse(await get(BRIDGE + '/api/flow/latest'));
    if (latest && latest.found && latest.data) {
      data = String(latest.data);
      console.log('[flow] 复用中转里的真实快照，长度 ' + data.length);
    }
  } catch (e) {
    console.log('[flow] 读中转失败: ' + e.message);
  }
  if (data === '' && FAMILY !== '') {
    try {
      const snap = JSON.parse(await get(BACKEND + '/api/sync/download/' + FAMILY));
      data = JSON.stringify(snap.payload);
      console.log('[flow] 复用后端快照，长度 ' + data.length);
    } catch (e) {
      console.log('[flow] 读后端失败: ' + e.message);
    }
  }
  if (data === '') {
    console.log('[flow] 没有可用快照，放弃（空 data 会被端侧忽略）');
    process.exit(2);
  }

  // 2) 构造页面状态：v 由调用方通过 NXG_FLOW_VERSION 指定，默认 1
  const state = {
    v: Number(process.env.NXG_FLOW_VERSION || 1),
    tab: TAB,
    libId: '', overlay: '', overlayArg: '', overlayArg2: '', libMenuId: '',
    aiOpen: false, aiDraft: '', itemFilter: 'all', trendRange: '7', at: Date.now()
  };
  const body = JSON.stringify({ from: 'PC-Screenshot', json: JSON.stringify(state), data: data });
  console.log('[flow] publish tab=' + TAB + ' v=' + state.v + ' 体积=' + body.length);
  console.log('[flow] 结果: ' + (await post(BRIDGE + '/api/flow/publish', body)));
})();
