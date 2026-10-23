/* 启核图策 · 桌面版本地服务（SQLite，零外部依赖）

   为什么单独写：正式后端 harmonyosapp/backend 依赖 MySQL（3307、root 密码）和邮箱 SMTP，
   别人电脑上装个 Web 端不该先装数据库、配邮箱。这里用 Node 24 内置的 node:sqlite，
   数据落在单个 .sqlite 文件里，安装包不需要 Node/npm/MySQL 任何开发环境。

   接口与 Web 端现有契约一致：
     GET  /api/health
     POST /api/auth/code | /api/auth/login          本机模式（验证码 123456）
     GET  /api/families / /api/families/:id/members
     GET  /api/sync/status/:fid | /api/sync/download/:fid | POST /api/sync/upload
     POST /api/flow/publish | GET /api/flow/latest
     POST /api/coop/create | /api/coop/join
     GET  /api/knowledge | /api/admin/overview
     GET/POST /api/config/ai
     POST /api/ai/chat | /api/ai/vision            有 Key 时转发 Agnes；没有就明确 503

   AI Key 存在应用数据目录的 config.json（不进仓库、不下发到页面）。
*/
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { DatabaseSync } = require('node:sqlite');
const { sendMail } = require('./mailer');

const PORT = Number(process.env.PORT || 0);
const DATA_DIR = process.env.NXG_DATA_DIR || path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'nexcoregraph.sqlite');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');
/* 打安装包时可以把作者自己的 Key 放进 config.seed.json（不进仓库），
   首次启动自动复制到应用数据目录，省掉首次设置页。 */
const SEED_CONFIG = path.join(__dirname, 'config.seed.json');
const WEB_DIR = process.env.NXG_WEB_DIR || (fs.existsSync(path.join(__dirname, 'web', 'index.html'))
  ? path.join(__dirname, 'web')
  : path.join(__dirname, '..', 'web', 'NexcoreGraph_web'));

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS users (
    account TEXT PRIMARY KEY, nickname TEXT, token TEXT, role TEXT, family_id TEXT
  );
  CREATE TABLE IF NOT EXISTS families (
    id TEXT PRIMARY KEY, name TEXT, owner TEXT, member_count INTEGER, invite_code TEXT, created_at INTEGER
  );
  CREATE TABLE IF NOT EXISTS members (
    family_id TEXT, phone TEXT, nickname TEXT, role TEXT, PRIMARY KEY (family_id, phone)
  );
  CREATE TABLE IF NOT EXISTS snapshots (
    family_id TEXT PRIMARY KEY, version INTEGER, updated_at INTEGER, payload TEXT
  );
  CREATE TABLE IF NOT EXISTS coop (
    code TEXT PRIMARY KEY, name TEXT, owner TEXT, created_at INTEGER, members TEXT
  );
  CREATE TABLE IF NOT EXISTS flow (
    id INTEGER PRIMARY KEY CHECK (id = 1), rev INTEGER, from_who TEXT, at INTEGER, summary TEXT, data TEXT
  );
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
  CREATE TABLE IF NOT EXISTS email_codes (
    email TEXT PRIMARY KEY, code_hash TEXT, exp_at INTEGER, sent_at INTEGER,
    attempts INTEGER, locked_until INTEGER
  );
`);

const q = {
  userGet: db.prepare('SELECT * FROM users WHERE account = ?'),
  userPut: db.prepare('INSERT INTO users (account,nickname,token,role,family_id) VALUES (?,?,?,?,?)'),
  familyGet: db.prepare('SELECT * FROM families WHERE id = ?'),
  familyPut: db.prepare('INSERT INTO families (id,name,owner,member_count,invite_code,created_at) VALUES (?,?,?,?,?,?)'),
  membersAll: db.prepare('SELECT phone,nickname,role FROM members WHERE family_id = ?'),
  memberPut: db.prepare('INSERT OR REPLACE INTO members (family_id,phone,nickname,role) VALUES (?,?,?,?)'),
  snapGet: db.prepare('SELECT * FROM snapshots WHERE family_id = ?'),
  snapPut: db.prepare('INSERT OR REPLACE INTO snapshots (family_id,version,updated_at,payload) VALUES (?,?,?,?)'),
  coopGet: db.prepare('SELECT * FROM coop WHERE code = ?'),
  coopPut: db.prepare('INSERT OR REPLACE INTO coop (code,name,owner,created_at,members) VALUES (?,?,?,?,?)'),
  flowGet: db.prepare('SELECT * FROM flow WHERE id = 1'),
  flowPut: db.prepare('INSERT OR REPLACE INTO flow (id,rev,from_who,at,summary,data) VALUES (1,?,?,?,?,?)'),
  kvGet: db.prepare('SELECT v FROM kv WHERE k = ?'),
  kvPut: db.prepare('INSERT OR REPLACE INTO kv (k,v) VALUES (?,?)'),
  codeGet: db.prepare('SELECT * FROM email_codes WHERE email = ?'),
  codePut: db.prepare('INSERT OR REPLACE INTO email_codes (email,code_hash,exp_at,sent_at,attempts,locked_until) VALUES (?,?,?,?,?,?)'),
  codeDel: db.prepare('DELETE FROM email_codes WHERE email = ?')
};

const now = () => Date.now();
const hash = (s) => crypto.createHash('sha256').update(String(s) + '|nxg').digest('hex').slice(0, 32);

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}
function ensureConfig() {
  try {
    if (!fs.existsSync(CONFIG_FILE) && fs.existsSync(SEED_CONFIG)) {
      fs.copyFileSync(SEED_CONFIG, CONFIG_FILE);
    }
  } catch (e) { /* 读不到种子就退回首次设置页 */ }
}
ensureConfig();
function writeJson(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file);
}
function aiConfig() {
  const cfg = readJson(CONFIG_FILE, {});
  return {
    apiKey: process.env.AGNES_API_KEY || cfg.apiKey || '',
    model: process.env.AGNES_MODEL || cfg.model || 'agnes-2.5-flash',
    baseUrl: (process.env.AGNES_BASE_URL || cfg.baseUrl || 'https://api.agnes-ai.cn/v1').replace(/\/+$/, ''),
    visionModel: cfg.visionModel || process.env.AGNES_VISION_MODEL || 'agnes-2.5-flash'
  };
}
function smtpConfig() {
  const cfg = readJson(CONFIG_FILE, {});
  const seed = readJson(SEED_CONFIG, {});
  const s = cfg.smtp || seed.smtp || {};
  return {
    host: process.env.MAIL_HOST || s.host || 'smtp.163.com',
    port: Number(process.env.MAIL_PORT || s.port || 465),
    user: process.env.MAIL_USER || s.user || '',
    pass: process.env.MAIL_PASS || s.pass || '',
    from: process.env.MAIL_FROM || s.from || process.env.MAIL_USER || s.user || ''
  };
}
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
function codeHash(email, code) {
  return crypto.createHash('sha256').update(email + '|' + code + '|nxg-code').digest('hex');
}

function send(res, code, obj) {
  const body = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': body.length,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-Auth-Token',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  });
  res.end(body);
}
function body(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (c) => { raw += c; if (raw.length > 40 * 1024 * 1024) req.destroy(); });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
  });
}

/* ---------- 静态文件（Web 端本体） ---------- */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json'
};
function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const full = path.normalize(path.join(WEB_DIR, rel));
  if (!full.startsWith(path.normalize(WEB_DIR))) { res.writeHead(403); res.end('forbidden'); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(buf);
  });
}

/* ---------- AI 转发 ---------- */
async function callVendor(payload, model, timeoutMs) {
  const cfg = aiConfig();
  if (!cfg.apiKey) {
    const e = new Error('未配置 AI Key：请在首次设置页或「设置 → AI」填写');
    e.status = 503;
    throw e;
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 45000);
  try {
    const res = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(Object.assign({ model: model || cfg.model }, payload)),
      signal: ctrl.signal
    });
    const text = await res.text();
    if (!res.ok) {
      const e = new Error('上游 ' + res.status + '：' + text.slice(0, 160));
      e.status = 502;
      throw e;
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- 路由 ---------- */
const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { send(res, 204, {}); return; }
  const u = new URL(req.url, 'http://127.0.0.1');
  const p = u.pathname;

  try {
    if (p === '/api/health') {
      const c = aiConfig();
      send(res, 200, { ok: true, mode: 'desktop-sqlite', db: 'sqlite', aiConfigured: !!c.apiKey, model: c.model, at: now() });
      return;
    }

    if (p === '/api/config/ai' && req.method === 'GET') {
      const c = aiConfig();
      send(res, 200, { ok: true, configured: !!c.apiKey, model: c.model, baseUrl: c.baseUrl });
      return;
    }
    if (p === '/api/config/ai' && req.method === 'POST') {
      const b = await body(req);
      const next = readJson(CONFIG_FILE, {});
      if (b.apiKey !== undefined) next.apiKey = String(b.apiKey || '').trim();
      if (b.model) next.model = String(b.model).trim();
      if (b.baseUrl) next.baseUrl = String(b.baseUrl).trim();
      writeJson(CONFIG_FILE, next);
      send(res, 200, { ok: true, configured: !!aiConfig().apiKey });
      return;
    }
    if (p === '/setup.html') {
      fs.readFile(path.join(__dirname, 'setup.html'), (err, buf) => {
        if (err) { res.writeHead(404); res.end('setup not found'); return; }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
        res.end(buf);
      });
      return;
    }

    /* ---- 账号：只支持邮箱；验证码真实发信（163 SMTP over TLS） ---- */
    if (p === '/api/auth/code' && req.method === 'POST') {
      const b = await body(req);
      const email = String(b.account || '').trim().toLowerCase();
      if (!EMAIL_RE.test(email)) {
        send(res, 400, { ok: false, error: '只支持邮箱登录/注册，请输入邮箱地址' });
        return;
      }
      const cur = q.codeGet.get(email);
      if (cur && cur.sent_at && now() - cur.sent_at < 60 * 1000) {
        send(res, 429, { ok: false, error: '刚刚已发过，请 60 秒后再试' });
        return;
      }
      const smtp = smtpConfig();
      if (!smtp.user || !smtp.pass) {
        send(res, 503, { ok: false, error: '未配置发信邮箱（SMTP_USER / SMTP_PASS）' });
        return;
      }
      const code = String(crypto.randomInt(100000, 1000000));
      const expAt = now() + 5 * 60 * 1000;
      try {
        await sendMail({
          host: smtp.host, port: smtp.port, user: smtp.user, pass: smtp.pass, from: smtp.from,
          to: email,
          subject: '启核图策登录验证码',
          text: '你的验证码是 ' + code + '，5 分钟内有效。\n如果不是你本人操作，请忽略这封邮件。'
        });
      } catch (e) {
        send(res, 502, { ok: false, error: '邮件发送失败：' + (e.message || 'SMTP 异常') });
        return;
      }
      q.codePut.run(email, codeHash(email, code), expAt, now(), 0, 0);
      send(res, 200, { ok: true, hint: '验证码已发送到 ' + email + '，5 分钟内有效' });
      return;
    }
    if (p === '/api/auth/login' && req.method === 'POST') {
      const b = await body(req);
      const account = String(b.account || '').trim().toLowerCase();
      const code = String(b.code || '').trim();
      if (!EMAIL_RE.test(account)) {
        send(res, 400, { ok: false, error: '只支持邮箱登录/注册，请输入邮箱地址' });
        return;
      }
      const row = q.codeGet.get(account);
      if (!row || !row.exp_at || row.exp_at < now()) {
        send(res, 400, { ok: false, error: '验证码已过期，请重新获取' });
        return;
      }
      if (row.locked_until && row.locked_until > now()) {
        send(res, 429, { ok: false, error: '尝试次数过多，请 15 分钟后再试' });
        return;
      }
      if (codeHash(account, code) !== row.code_hash) {
        const attempts = Number(row.attempts || 0) + 1;
        const lock = attempts >= 5 ? now() + 15 * 60 * 1000 : 0;
        q.codePut.run(account, row.code_hash, row.exp_at, row.sent_at, attempts, lock);
        send(res, 400, { ok: false, error: lock ? '验证码错误次数过多，已锁定 15 分钟' : '验证码不正确' });
        return;
      }
      q.codeDel.run(account);
      let user = q.userGet.get(account);
      if (!user) {
        const famId = 'fam-' + hash(account).slice(0, 10);
        const nickname = account.split('@')[0];
        const famName = nickname + '的家';
        const invite = hash(famId + 'invite').slice(0, 6).toUpperCase();
        q.familyPut.run(famId, famName, account, 1, invite, now());
        q.memberPut.run(famId, account, nickname, '管理员');
        q.userPut.run(account, nickname, hash(account + now()), '管理员', famId);
        user = q.userGet.get(account);
      }
      const fam = q.familyGet.get(user.family_id);
      send(res, 200, {
        ok: true, token: user.token, nickname: user.nickname, role: user.role,
        families: [{ id: fam.id, name: fam.name, role: user.role, member_count: fam.member_count, invite_code: fam.invite_code }]
      });
      return;
    }
    if (p === '/api/families' && req.method === 'GET') {
      const acc = String(u.searchParams.get('phone') || '');
      const user = q.userGet.get(acc);
      if (!user) { send(res, 200, { ok: true, families: [] }); return; }
      const fam = q.familyGet.get(user.family_id);
      send(res, 200, {
        ok: true,
        families: fam ? [{ id: fam.id, name: fam.name, role: user.role, member_count: fam.member_count, invite_code: fam.invite_code }] : []
      });
      return;
    }
    let m = /^\/api\/families\/([^/]+)\/members$/.exec(p);
    if (m && req.method === 'GET') {
      send(res, 200, { ok: true, members: q.membersAll.all(decodeURIComponent(m[1])) });
      return;
    }

    /* ---- 同步 ---- */
    m = /^\/api\/sync\/status\/([^/]+)$/.exec(p);
    if (m && req.method === 'GET') {
      const s = q.snapGet.get(decodeURIComponent(m[1]));
      send(res, 200, { ok: true, version: s ? s.version : 0, updatedAt: s ? s.updated_at : null });
      return;
    }
    m = /^\/api\/sync\/download\/([^/]+)$/.exec(p);
    if (m && req.method === 'GET') {
      const s = q.snapGet.get(decodeURIComponent(m[1]));
      if (!s) { send(res, 404, { ok: false, error: '还没有快照' }); return; }
      send(res, 200, { ok: true, version: s.version, updatedAt: s.updated_at, payload: JSON.parse(s.payload || '{}') });
      return;
    }
    if (p === '/api/sync/upload' && req.method === 'POST') {
      const b = await body(req);
      const fid = String(b.familyId || '');
      if (!fid) { send(res, 400, { ok: false, error: '缺少 familyId' }); return; }
      const cur = q.snapGet.get(fid);
      const base = Number(b.baseVersion || 0);
      if (cur && !b.force && base && base < cur.version) {
        send(res, 409, { ok: false, error: '云端已有更新版本', version: cur.version, updatedAt: cur.updated_at });
        return;
      }
      const version = Number(b.version) || now();
      q.snapPut.run(fid, version, now(), JSON.stringify(b.payload || {}));
      send(res, 200, { ok: true, version });
      return;
    }

    /* ---- 流转 ---- */
    if (p === '/api/flow/publish' && req.method === 'POST') {
      const b = await body(req);
      const rev = now();
      q.flowPut.run(rev, b.from || '', rev, b.json || '', b.data || '');
      send(res, 200, { ok: true, rev });
      return;
    }
    if (p === '/api/flow/latest' && req.method === 'GET') {
      const since = Number(u.searchParams.get('since') || 0);
      const f = q.flowGet.get();
      if (!f || (since && f.rev <= since)) { send(res, 200, { ok: true, found: false }); return; }
      send(res, 200, { ok: true, found: true, rev: f.rev, from: f.from_who, at: f.at, data: f.data });
      return;
    }

    /* ---- 协作池 ---- */
    if (p === '/api/coop/create' && req.method === 'POST') {
      const b = await body(req);
      const code = hash(String(b.account || '') + now()).slice(0, 6).toUpperCase();
      q.coopPut.run(code, b.name || '家庭协作牌桌', b.account || '', now(), JSON.stringify([b.account || '']));
      send(res, 200, { ok: true, code, name: b.name || '家庭协作牌桌', members: 1 });
      return;
    }
    if (p === '/api/coop/join' && req.method === 'POST') {
      const b = await body(req);
      const code = String(b.code || '').toUpperCase();
      const room = q.coopGet.get(code);
      if (!room) { send(res, 404, { ok: false, error: '邀请码不存在或已过期' }); return; }
      const members = JSON.parse(room.members || '[]');
      if (members.indexOf(b.account || '') < 0) members.push(b.account || '');
      q.coopPut.run(code, room.name, room.owner, room.created_at, JSON.stringify(members));
      send(res, 200, { ok: true, code, name: room.name, members: members.length });
      return;
    }

    /* ---- 知识库版本 / 管理员概览 ---- */
    if (p === '/api/knowledge') {
      const row = q.kvGet.get('knowledge');
      send(res, 200, { ok: true, version: row ? Number(row.v) : 1 });
      return;
    }
    if (p === '/api/admin/overview') {
      const count = (t) => Number(db.prepare('SELECT COUNT(*) AS n FROM ' + t).get().n);
      send(res, 200, {
        ok: true, users: count('users'), families: count('families'),
        snapshots: count('snapshots'), coop: count('coop')
      });
      return;
    }

    /* ---- AI 网关 ---- */
    if (p === '/api/ai/chat' && req.method === 'POST') {
      const b = await body(req);
      const cfg = aiConfig();
      const t0 = now();
      const data = await callVendor({
        messages: b.messages || [{ role: 'user', content: String(b.question || '') }],
        temperature: 0.4, max_tokens: 900
      }, cfg.model, 45000);
      const txt = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      send(res, 200, { ok: true, text: txt, model: data.model || cfg.model, ms: now() - t0 });
      return;
    }
    if (p === '/api/ai/vision' && req.method === 'POST') {
      const b = await body(req);
      const cfg = aiConfig();
      const t0 = now();
      const data = await callVendor({
        temperature: 0.1, max_tokens: 900,
        messages: [
          { role: 'system', content: '你是家庭物品识别引擎，只输出 JSON 数组，没有家庭物品时输出 []。' },
          {
            role: 'user',
            content: [
              { type: 'text', text: '识别图中的家庭物品（食材/衣物/药品/工具/书籍/宠物食品/家电等），输出 JSON 数组，字段：name,category,qty,unit,pos,expDays,price；没有保质期的 expDays 填 0；只输出 JSON。' },
              { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + String(b.imageBase64 || '') } }
            ]
          }
        ]
      }, cfg.visionModel, 45000);
      const txt = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
      let items = [];
      try {
        const s = txt.indexOf('['); const e = txt.lastIndexOf(']');
        items = s >= 0 && e > s ? JSON.parse(txt.slice(s, e + 1)) : [];
      } catch (err) { items = []; }
      send(res, 200, { ok: true, items, model: data.model || cfg.visionModel, ms: now() - t0, noHouseholdItems: items.length === 0 });
      return;
    }

    if (p.startsWith('/api/')) { send(res, 404, { ok: false, error: '未知接口 ' + p }); return; }
    serveStatic(req, res, p);
  } catch (e) {
    send(res, e.status || 500, { ok: false, error: e.message || '服务异常' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  const port = server.address().port;
  console.log('[nxg-desktop] sqlite: ' + DB_FILE);
  console.log('[nxg-desktop] listening on http://127.0.0.1:' + port);
  if (process.send) process.send({ type: 'ready', port });
});
