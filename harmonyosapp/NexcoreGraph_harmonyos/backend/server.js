/* 启核图策 · 本地同步后端（M2：本地优先 + 版本冲突提示，向 F9.10 增量同步演进）
   - GET   /api/health
   - POST  /api/auth/login               手机号 + 演示码登录（F9.1，自动建档并加入默认家庭）
   - GET   /api/families?phone=          我的家庭列表（F9.1）
   - POST  /api/families                 创建家庭（邀请码自动生成）
   - POST  /api/families/join            邀请码加入家庭（F9.3）
   - GET   /api/families/:id/members     成员与角色（F9.2）
   - POST  /api/families/:id/members     添加/改角色成员
   - DELETE /api/families/:id/members/:phone  移除/退出成员
   - POST  /api/families/:id/invite      撤销并重建邀请码
   - POST  /api/sync/upload              上传快照（baseVersion 落后 → 409 冲突，force 可覆盖；F9.10）
   - GET   /api/sync/status/:familyId    云端当前版本（冲突判断用）
   - GET   /api/sync/download/:familyId  拉取最新快照
   - GET   /api/logs/:familyId           操作日志

   AI 网关（整改文档 M-7，安全红线 D6：Agnes Key 只存服务端环境变量，端侧不再持有明文 Key）
   - POST  /api/ai/chat                  意图 + 证据 → 文本（单请求 ≤1 次模型调用，失败降级备用模型）
   - POST  /api/ai/vision                图片 base64 → 结构化识别 JSON（名称/类别/数量/位置/保质期/价格）
   - POST  /api/ai/tts                   文本 → 音频（未配置 TTS_ENDPOINT 时返回 501，端侧静默降级）
   - POST  /api/ai/usage                 端侧用量批次上报（含"本地快答"0 次模型记录）
   - GET   /api/ai/usage?familyId=&range= 用量聚合：路由分布 / 模型分布 / 平均耗时 / 快答占比 */

const express = require('express');
const os = require('os');
const crypto = require('crypto');
const mysql = require('mysql2/promise');
const { buildGraph } = require('./graphBuild');
const { GraphService } = require('./graphService');
const { buildEvidence, matchEntity } = require('./graphQuery');
const { sendMail } = require('./mailer');

/**
 * 可选：读取同目录 gitignore 的 backend/.env（AGNES_API_KEY=sk-xxx 等），
 * 便于本地开发不必每次手写环境变量。已存在的环境变量优先，文件不会被提交。
 */
function loadDotEnv() {
  try {
    const fs = require('fs');
    const path = require('path');
    const p = path.join(__dirname, '.env');
    if (!fs.existsSync(p)) {
      return;
    }
    fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((line) => {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
      }
    });
  } catch (_e) {
    /* 读不到就当没配 */
  }
}
loadDotEnv();

const PORT = process.env.PORT || 3000;
const DB = {
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '123456',
  database: process.env.DB_NAME || 'tianshu',
  charset: 'utf8mb4'
};

/* AI 网关配置：Key 只从服务端环境变量读取，任何情况下都不下发给端侧（D6/M-7） */
const AI = {
  baseUrl: process.env.AGNES_BASE_URL || 'https://api.agnes-ai.cn/v1',
  apiKey: process.env.AGNES_API_KEY || '',
  model: process.env.AGNES_MODEL || 'agnes-2.0-flash',
  // 备用模型必须是账号可用清单里的（GET /v1/models）；旧默认 agnes-1.5-flash 已下架，
  // 导致主模型失败后降级必然再失败，端侧只能回退演示数据（看着像"识别是假的"）
  modelAlt: process.env.AGNES_MODEL_ALT || 'agnes-3.0-flash',
  // 视觉识别（带图片）在免费上游通常要 15-25s，15s 会把正常请求误判成超时；
  // 文本快答仍由端侧 15s 目标时间约束，这里给足余量
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 30000),
  rpm: Number(process.env.AI_RPM || 20),
  ttsEndpoint: process.env.TTS_ENDPOINT || '',
  ttsKey: process.env.TTS_API_KEY || '',
  // 短信通道（可选）：配置后 /api/auth/code 会把验证码发出去；不配置则只打服务端日志
  smsEndpoint: process.env.SMS_ENDPOINT || '',
  smsKey: process.env.SMS_API_KEY || '',
  // 视觉识别模型链：实测 agnes-2.0-flash 连续调用第二次起就持续 429（免费额度按模型限流），
  // 而 agnes-2.5-flash 连测 3 次全部 200 且只要 0.6–2.8s；agnes-2.5-pro 在本 Key 上是 403
  // （无权限），不能放进链里。顺序 = 先快且稳的，再兜底。
  visionModels: String(process.env.AGNES_VISION_MODELS ||
    'agnes-2.5-flash,agnes-3.0-flash,agnes-2.0-flash')
    .split(',').map((s) => s.trim()).filter((s) => s !== ''),
  // 端到端硬预算：超预算立刻返回"识别超时"，不让端侧一直转圈（旧逻辑最坏可跑到 3 分钟）
  visionBudgetMs: Number(process.env.AI_VISION_BUDGET_MS || 25000),
  visionMaxTokens: Number(process.env.AI_VISION_MAX_TOKENS || 900)
};

const pool = mysql.createPool(Object.assign({ connectionLimit: 8 }, DB));
const graph = new GraphService(pool);
const app = express();
app.use(express.json({ limit: '8mb' }));

/* 建表（幂等）：业务表对齐开发文档第 6 节数据模型（账号 / 家庭 / 成员 / 快照 / 日志） */
async function initDb() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    phone VARCHAR(16) NOT NULL UNIQUE,
    nickname VARCHAR(64),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS families (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(64) NOT NULL,
    owner_phone VARCHAR(16),
    invite_code VARCHAR(16),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS family_members (
    family_id VARCHAR(64) NOT NULL,
    phone VARCHAR(16) NOT NULL,
    role VARCHAR(16) NOT NULL DEFAULT '成员',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (family_id, phone)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  /* 协作池（工作台）：必须先"创建"或"加入"才存在；有邀请码 + 有效期 + 成员 */
  await pool.query(`CREATE TABLE IF NOT EXISTS coop_sessions (
    code VARCHAR(16) PRIMARY KEY,
    owner_account VARCHAR(128) NOT NULL,
    family_id VARCHAR(64) NOT NULL,
    name VARCHAR(64) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS coop_members (
    code VARCHAR(16) NOT NULL,
    account VARCHAR(128) NOT NULL,
    nickname VARCHAR(64),
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (code, account)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sync_snapshots (
    family_id VARCHAR(64) PRIMARY KEY,
    payload MEDIUMTEXT NOT NULL,
    version BIGINT NOT NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS ops_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    family_id VARCHAR(64) NOT NULL,
    action VARCHAR(32) NOT NULL,
    detail VARCHAR(512),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  /* 整改文档 4.10 新增表：AI 用量留痕（M-10 端内与管理员端共用） */
  await pool.query(`CREATE TABLE IF NOT EXISTS ai_usage (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    family_id VARCHAR(64) NOT NULL,
    user_phone VARCHAR(16),
    route VARCHAR(32) NOT NULL,
    model VARCHAR(64),
    ms INT DEFAULT 0,
    tokens INT DEFAULT 0,
    source VARCHAR(16) DEFAULT 'gateway',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_family_time (family_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  /* 整改文档 4.10 新增表：推送订阅（M-12，Push Kit 接入前先落库） */
  await pool.query(`CREATE TABLE IF NOT EXISTS push_subscription (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    family_id VARCHAR(64) NOT NULL,
    user_phone VARCHAR(16),
    channel VARCHAR(16) NOT NULL DEFAULT 'push',
    token VARCHAR(255),
    topic VARCHAR(64),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_token (family_id, channel, token)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  /* 补充方案第 6.2 节：图谱五表（节点 / 边 / 社区 / 摘要 / 版本） */
  await pool.query(`CREATE TABLE IF NOT EXISTS graph_nodes (
    id VARCHAR(128) NOT NULL,
    family_id VARCHAR(64) NOT NULL,
    type VARCHAR(32) NOT NULL,
    label VARCHAR(128) NOT NULL,
    props JSON NULL,
    community VARCHAR(255) NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id, family_id),
    INDEX idx_family_type (family_id, type),
    INDEX idx_family_community (family_id, community)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS graph_edges (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    family_id VARCHAR(64) NOT NULL,
    from_id VARCHAR(128) NOT NULL,
    to_id VARCHAR(128) NOT NULL,
    type VARCHAR(32) NOT NULL,
    props JSON NULL,
    INDEX idx_from (family_id, from_id, type),
    INDEX idx_to (family_id, to_id, type)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS graph_communities (
    family_id VARCHAR(64) NOT NULL,
    id VARCHAR(128) NOT NULL,
    level TINYINT NOT NULL,
    label VARCHAR(128) NOT NULL,
    stats JSON NULL,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (family_id, id)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS graph_summaries (
    family_id VARCHAR(64) NOT NULL,
    community VARCHAR(128) NOT NULL,
    text VARCHAR(512) NOT NULL,
    model VARCHAR(64) NULL,
    based_on VARCHAR(64) NULL,
    generated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (family_id, community)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  await pool.query(`CREATE TABLE IF NOT EXISTS graph_versions (
    family_id VARCHAR(64) PRIMARY KEY,
    version VARCHAR(64) NOT NULL,
    nodes INT DEFAULT 0,
    edges INT DEFAULT 0,
    built_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

  /* 账号列扩容：登录名可能是邮箱（原 VARCHAR(16) 装不下），放宽到 128 并保持唯一约束。
     幂等：已经是 128 时 MODIFY 等于空操作。 */
  for (const q of [
    'ALTER TABLE users MODIFY phone VARCHAR(128) NOT NULL',
    'ALTER TABLE families MODIFY owner_phone VARCHAR(128) NULL',
    'ALTER TABLE family_members MODIFY phone VARCHAR(128) NOT NULL',
    // 登录密码：只存 scrypt(salt+password) 的自描述串，永不存明文
    'ALTER TABLE users ADD COLUMN pwd_scrypt VARCHAR(512) NULL',
    'ALTER TABLE users ADD COLUMN pwd_updated DATETIME NULL'
  ]) {
    try {
      await pool.query(q);
    } catch (e) {
      // 列已经存在是正常情况（幂等迁移），不用每次都报警吓人
      if (String(e.message).indexOf('Duplicate column') < 0) {
        console.warn('[db] 账号列扩容跳过:', e.message);
      }
    }
  }
}

function genInvite() {
  return 'TS-' + String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * 列出本机所有局域网 IPv4（用于告诉手机/平板该填哪个地址）。
 * 部署形态是「局域网自建服务器」：后端跑在你的电脑上，同一 WiFi 下的设备直连，
 * 不经过公网、不需要域名与备案。
 */
function lanAddresses() {
  const out = [];
  const nets = os.networkInterfaces();
  Object.keys(nets).forEach((name) => {
    (nets[name] || []).forEach((n) => {
      if (n.family === 'IPv4' && !n.internal) {
        // 虚拟网卡（VMware/VirtualBox/Hyper-V/WSL）不是手机能连的地址，单独标出来避免填错
        const virtual = /vmware|virtualbox|vethernet|hyper-v|wsl|loopback|docker/i.test(name);
        out.push({ iface: name, ip: n.address, virtual: virtual });
      }
    });
  });
  // 真实网卡排前面（手机/平板要填的就是这类）
  return out.sort((a, b) => Number(a.virtual) - Number(b.virtual));
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    time: Date.now(),
    service: 'nexcoregraph-backend',
    // 明确标注部署形态：端侧据此在界面上显示"局域网自建服务器"，避免被当成云端服务
    mode: 'lan-self-hosted',
    lanIps: lanAddresses().map((a) => a.ip),
    ai: AI.apiKey ? 'ready' : 'no-key'
  });
});

/* ---------- 账号（F9.1/F9.2）：邮箱/手机号 + 随机验证码 + TTL + 真 token ----------
   没有任何固定验证码：每次索取都现生成 6 位随机码，服务端按账号存 TTL（5 分钟）。
   下发通道：邮箱账号走 SMTP（MAIL_USER/MAIL_PASS，163 默认 smtp.163.com:465），
   手机号账号可走可选短信通道；两个通道都没配时，验证码只打进服务端日志（本地开发可登录，
   但端侧永远拿不到"默认码"）。可选 AUTH_SHOW_CODE=1 时响应里会回带 devCode（仅本地联调）。 */

const AUTH_TTL_MS = Number(process.env.AUTH_CODE_TTL_MS || 5 * 60 * 1000);
const AUTH_COOLDOWN_MS = Number(process.env.AUTH_CODE_COOLDOWN_MS || 60 * 1000);
const authCodes = new Map();     // account -> { code, expiresAt, sentAt, tries }
const authTokens = new Map();    // token -> { account, expiresAt }

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function genToken() {
  return 'nxg-' + Math.random().toString(36).slice(2) + Date.now().toString(36) +
    Math.random().toString(36).slice(2);
}

/* ---------- 登录密码存储：scrypt（内存硬慢哈希） + 每用户随机盐 ----------
   绝不存明文，也不用 MD5/SHA 这类快哈希。存成一列自描述字符串，方便以后换算法/调参数：
     scrypt$N=16384,r=8,p=1,keylen=64$<salt base64>$<hash base64>
   参数按 Node 默认上限取（N=16384,r=8,p=1，内存约 16MB/次），单次校验约几十毫秒，
   暴力破解成本随迭代次数线性上升；将来只调这一段即可整体升级，旧记录仍可验证。 */

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, saltBytes: 16 };

function b64(buf) {
  return Buffer.from(buf).toString('base64');
}

function hashPassword(plain) {
  const salt = crypto.randomBytes(SCRYPT.saltBytes);
  const hash = crypto.scryptSync(String(plain), salt, SCRYPT.keylen, {
    N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p
  });
  return `scrypt$N=${SCRYPT.N},r=${SCRYPT.r},p=${SCRYPT.p},keylen=${SCRYPT.keylen}$` +
    `${b64(salt)}$${b64(hash)}`;
}

/** 校验密码：按存储字符串里的参数重算，再用定长比较防时序侧信道 */
function verifyPassword(plain, stored) {
  try {
    const parts = String(stored || '').split('$');
    if (parts.length !== 4 || parts[0] !== 'scrypt') {
      return false;
    }
    const opt = {};
    parts[1].split(',').forEach((kv) => {
      const [k, v] = kv.split('=');
      opt[k] = Number(v);
    });
    const salt = Buffer.from(parts[2], 'base64');
    const want = Buffer.from(parts[3], 'base64');
    const got = crypto.scryptSync(String(plain), salt, want.length, {
      N: opt.N || SCRYPT.N, r: opt.r || SCRYPT.r, p: opt.p || SCRYPT.p
    });
    return got.length === want.length && crypto.timingSafeEqual(got, want);
  } catch (_e) {
    return false;
  }
}

/** 账号不存在时也烧掉同样的 CPU：避免用响应时间探测"这个账号是否注册过" */
function dummyVerify(plain) {
  verifyPassword(String(plain), 'scrypt$N=16384,r=8,p=1,keylen=64$AAAAAAAAAAAAAAAAAAAAAA==$' +
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==');
}

/* 密码登录失败节流：同一账号连续错 5 次锁 15 分钟（OTP 有次数上限，密码这条路必须自己防爆破） */
const pwdFails = new Map();   // account -> { count, until }
const PWD_MAX_FAILS = 5;
const PWD_LOCK_MS = 15 * 60 * 1000;

function pwdLocked(account) {
  const rec = pwdFails.get(account);
  if (!rec) {
    return 0;
  }
  if (rec.until > Date.now()) {
    return Math.ceil((rec.until - Date.now()) / 1000);
  }
  // 只有"锁确实到期了"才清记录；否则会把还在累计的失败次数一起删掉，
  // 导致永远凑不满 5 次（实测连错 6 次都没锁上就是这个原因）
  if (rec.until !== 0) {
    pwdFails.delete(account);
  }
  return 0;
}

function pwdFail(account) {
  const rec = pwdFails.get(account) || { count: 0, until: 0 };
  rec.count += 1;
  if (rec.count >= PWD_MAX_FAILS) {
    rec.until = Date.now() + PWD_LOCK_MS;
    rec.count = 0;
  }
  pwdFails.set(account, rec);
}

/** 账号：11 位手机号 或 邮箱（两者都能作为登录名，用户表里存的就是这串账号） */
function isPhone(s) {
  return /^1\d{10}$/.test(s);
}

function isEmail(s) {
  return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(s);
}

function accountError(s) {
  if (isPhone(s) || isEmail(s)) {
    return '';
  }
  return '请输入手机号或邮箱';
}

/** 短信通道（可选）：配置 SMS_ENDPOINT 后 POST { phone, text } 即可 */
async function sendSms(phone, text) {
  if (!AI.smsEndpoint) {
    return false;
  }
  try {
    const r = await fetch(AI.smsEndpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        AI.smsKey ? { 'Authorization': 'Bearer ' + AI.smsKey } : {}),
      body: JSON.stringify({ phone, text }),
      signal: AbortSignal.timeout(10000)
    });
    return r.ok;
  } catch (e) {
    console.warn('[auth] 短信下发失败:', e.message);
    return false;
  }
}

/**
 * 按账号类型下发验证码。返回实际使用的通道：
 * email=邮件已发出；sms=短信已发出；console=都没配，只打了服务端日志
 */
async function deliverCode(account, code) {
  const ttlMin = Math.round(AUTH_TTL_MS / 60000);
  const text = '【启核图策】验证码 ' + code + '，' + ttlMin + ' 分钟内有效。为保障安全，请勿向任何人透露。';
  if (isEmail(account)) {
    try {
      await sendMail({
        to: account,
        subject: '启核图策 · 登录验证码 ' + code,
        text: '你的登录验证码是 ' + code + '（' + ttlMin + ' 分钟内有效）。\n\n' +
          '如果不是你本人操作，忽略本邮件即可。'
      });
      console.log('[auth] 验证码邮件已发送: ' + account);
      return 'email';
    } catch (e) {
      // 本地联调（AUTH_SHOW_CODE=1）时邮件没配也能继续：把码打进日志并回带 devCode。
      // 生产环境（未开该开关）必须让错误抛出去，绝不能"假装发出去了"。
      if (process.env.AUTH_SHOW_CODE === '1') {
        console.warn('[auth] 邮件下发失败（本地联调降级为服务端日志）:', e.message);
        return 'console';
      }
      throw e;
    }
  }
  if (await sendSms(account, text)) {
    return 'sms';
  }
  console.log('[auth] 未配置下发通道，验证码只打印在服务端日志: ' + account + ' -> ' + code);
  return 'console';
}

app.post('/api/auth/code', async (req, res) => {
  const account = String((req.body || {}).account || (req.body || {}).phone || '').trim();
  const bad = accountError(account);
  if (bad !== '') {
    return res.status(400).json({ ok: false, error: bad });
  }
  const prev = authCodes.get(account);
  if (prev && Date.now() - prev.sentAt < AUTH_COOLDOWN_MS) {
    const left = Math.ceil((AUTH_COOLDOWN_MS - (Date.now() - prev.sentAt)) / 1000);
    return res.status(429).json({ ok: false, error: '请求过于频繁，请 ' + left + ' 秒后再试' });
  }
  const code = genCode();
  authCodes.set(account, { code, expiresAt: Date.now() + AUTH_TTL_MS, sentAt: Date.now(), tries: 0 });
  let channel = 'console';
  try {
    channel = await deliverCode(account, code);
  } catch (e) {
    authCodes.delete(account);      // 发不出去就别占着冷却时间
    console.warn('[auth] 验证码下发失败:', e.message);
    return res.status(502).json({ ok: false, error: '验证码发送失败：' + e.message });
  }
  const body = { ok: true, ttlSec: Math.round(AUTH_TTL_MS / 1000), channel };
  if (process.env.AUTH_SHOW_CODE === '1') {
    body.devCode = code;
  }
  res.json(body);
});

/* 登录：校验验证码 → 建档 → 返回 token 与真实的家庭列表（首次登录自动建一个空家庭） */
app.post('/api/auth/login', async (req, res) => {
  const raw = req.body || {};
  const account = String(raw.account || raw.phone || '').trim();
  const code = String(raw.code || '');
  const password = String(raw.password || '');
  const bad = accountError(account);
  if (bad !== '') {
    return res.status(400).json({ ok: false, error: bad });
  }
  /* 密码登录：账号已设过密码时可用（与验证码登录并存，验证码仍可用于找回/改密） */
  if (password !== '' && code === '') {
    const wait = pwdLocked(account);
    if (wait > 0) {
      return res.status(429).json({ ok: false, error: `密码错误次数过多，请 ${Math.ceil(wait / 60)} 分钟后再试` });
    }
    let rowPwd = null;
    try {
      const [rows] = await pool.query('SELECT pwd_scrypt FROM users WHERE phone = ?', [account]);
      rowPwd = rows.length > 0 ? rows[0].pwd_scrypt : null;
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
    if (!rowPwd) {
      dummyVerify(password);   // 没设过密码也烧同样的 CPU，防账号探测
      pwdFail(account);
      return res.status(400).json({ ok: false, error: '该账号还没有设置密码，请用验证码登录' });
    }
    if (!verifyPassword(password, rowPwd)) {
      pwdFail(account);
      return res.status(400).json({ ok: false, error: '密码错误' });
    }
    pwdFails.delete(account);
    // 密码正确：走与验证码登录相同的发 token 流程
    try {
      const [rows] = await pool.query('SELECT phone, nickname FROM users WHERE phone = ?', [account]);
      const [mine] = await pool.query(
        'SELECT f.id, f.name, fm.role, ' +
        '(SELECT COUNT(*) FROM family_members x WHERE x.family_id = f.id) AS member_count ' +
        'FROM family_members fm JOIN families f ON f.id = fm.family_id ' +
        "WHERE fm.phone = ? ORDER BY (fm.role = '管理员') DESC, f.id", [account]);
      const token = genToken();
      authTokens.set(token, { account, expiresAt: Date.now() + 30 * 24 * 3600 * 1000 });
      return res.json({
        ok: true, token, phone: account,
        nickname: rows.length > 0 ? rows[0].nickname : account.split('@')[0],
        role: mine.length > 0 ? mine[0].role : '管理员',
        families: mine,
        method: 'password'
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }
  const rec = authCodes.get(account);
  if (!rec) {
    return res.status(400).json({ ok: false, error: '请先获取验证码' });
  }
  if (Date.now() > rec.expiresAt) {
    authCodes.delete(account);
    return res.status(400).json({ ok: false, error: '验证码已过期，请重新获取' });
  }
  if (rec.tries >= 5) {
    authCodes.delete(account);
    return res.status(429).json({ ok: false, error: '验证码错误次数过多，请重新获取' });
  }
  if (code !== rec.code) {
    rec.tries += 1;
    return res.status(400).json({ ok: false, error: '验证码错误' });
  }
  authCodes.delete(account);
  try {
    const nick = isEmail(account) ? account.split('@')[0] : '用户' + account.slice(-4);
    await pool.query('INSERT IGNORE INTO users (phone, nickname) VALUES (?, ?)', [account, nick]);
    // 没有家庭的新账号：建一个属于他自己的空家庭（管理员），不再塞任何默认家庭/默认数据
    const [mine] = await pool.query(
      'SELECT f.id, f.name, fm.role, ' +
      '(SELECT COUNT(*) FROM family_members x WHERE x.family_id = f.id) AS member_count ' +
      'FROM family_members fm JOIN families f ON f.id = fm.family_id ' +
      "WHERE fm.phone = ? ORDER BY (fm.role = '管理员') DESC, f.id", [account]);
    if (mine.length === 0) {
      const fid = 'fam-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      await pool.query(
        'INSERT INTO families (id, name, owner_phone, invite_code) VALUES (?, ?, ?, ?)',
        [fid, nick + '的家', account, genInvite()]);
      await pool.query('INSERT INTO family_members (family_id, phone, role) VALUES (?, ?, ?)',
        [fid, account, '管理员']);
      mine.push({ id: fid, name: nick + '的家', role: '管理员', member_count: 1 });
    }
    const token = genToken();
    authTokens.set(token, { account, expiresAt: Date.now() + 30 * 24 * 3600 * 1000 });
    const [rows] = await pool.query('SELECT phone, nickname FROM users WHERE phone = ?', [account]);
    res.json({
      ok: true,
      token,
      phone: account,
      nickname: rows.length > 0 ? rows[0].nickname : nick,
      role: mine[0].role,
      families: mine,
      method: 'code',
      // 有没有设过密码，端侧据此决定是否展示"密码登录"
      hasPassword: await hasPassword(account)
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

async function hasPassword(account) {
  try {
    const [rows] = await pool.query('SELECT pwd_scrypt FROM users WHERE phone = ?', [account]);
    return rows.length > 0 && !!rows[0].pwd_scrypt;
  } catch (_e) {
    return false;
  }
}

/* 设置 / 修改登录密码：必须先通过验证码证明是账号本人（所以密码只能"改"不能"猜"） */
app.post('/api/auth/password', async (req, res) => {
  const raw = req.body || {};
  const account = String(raw.account || '').trim();
  const code = String(raw.code || '');
  const password = String(raw.password || '');
  const bad = accountError(account);
  if (bad !== '') {
    return res.status(400).json({ ok: false, error: bad });
  }
  if (password.length < 8) {
    return res.status(400).json({ ok: false, error: '密码至少 8 位' });
  }
  if (password.length > 64) {
    return res.status(400).json({ ok: false, error: '密码不要超过 64 位' });
  }
  const rec = authCodes.get(account);
  if (!rec) {
    return res.status(400).json({ ok: false, error: '请先获取验证码' });
  }
  if (Date.now() > rec.expiresAt) {
    authCodes.delete(account);
    return res.status(400).json({ ok: false, error: '验证码已过期，请重新获取' });
  }
  if (code !== rec.code) {
    rec.tries += 1;
    return res.status(400).json({ ok: false, error: '验证码错误' });
  }
  authCodes.delete(account);
  try {
    await pool.query('INSERT IGNORE INTO users (phone, nickname) VALUES (?, ?)',
      [account, account.split('@')[0]]);
    const stored = hashPassword(password);           // 只把 scrypt 串写库，明文不落任何地方
    await pool.query('UPDATE users SET pwd_scrypt = ?, pwd_updated = NOW() WHERE phone = ?',
      [stored, account]);
    pwdFails.delete(account);
    console.log('[auth] 已为 ' + account + ' 设置登录密码（scrypt N=' + SCRYPT.N + ', 每用户随机盐）');
    res.json({ ok: true, algo: 'scrypt', N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ---------- 协作池（工作台）：必须先创建或加入才存在 ----------
   创建 → 生成 6 位邀请码（默认 24 小时有效），创建者自动入池；
   加入 → 校验邀请码未过期，登记成员后返回池子信息。 */

const COOP_TTL_MS = Number(process.env.COOP_TTL_MS || 24 * 3600 * 1000);

function genCoopCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 去掉了易混的 I/O/0/1
  let s = '';
  for (let i = 0; i < 6; i++) {
    s += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return s;
}

async function coopMembers(code) {
  const [rows] = await pool.query(
    'SELECT account, nickname, joined_at FROM coop_members WHERE code = ? ORDER BY joined_at', [code]);
  return rows;
}

app.post('/api/coop/create', async (req, res) => {
  const account = String((req.body || {}).account || '').trim();
  const name = String((req.body || {}).name || '').trim();
  if (account === '') {
    return res.status(400).json({ ok: false, error: '缺少 account' });
  }
  try {
    const [mine] = await pool.query(
      'SELECT family_id FROM family_members WHERE phone = ? ORDER BY joined_at LIMIT 1', [account]);
    const familyId = mine.length > 0 ? mine[0].family_id : '';
    let code = genCoopCode();
    for (let i = 0; i < 5; i++) {
      const [dup] = await pool.query('SELECT code FROM coop_sessions WHERE code = ?', [code]);
      if (dup.length === 0) {
        break;
      }
      code = genCoopCode();
    }
    const expires = new Date(Date.now() + COOP_TTL_MS);
    await pool.query(
      'INSERT INTO coop_sessions (code, owner_account, family_id, name, expires_at) VALUES (?, ?, ?, ?, ?)',
      [code, account, familyId, name === '' ? '家庭协作牌桌' : name, expires]);
    await pool.query('INSERT INTO coop_members (code, account, nickname) VALUES (?, ?, ?)',
      [code, account, account.split('@')[0]]);
    const members = await coopMembers(code);
    res.json({ ok: true, code, name: name === '' ? '家庭协作牌桌' : name, expiresAt: expires.getTime(), members });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/coop/join', async (req, res) => {
  const account = String((req.body || {}).account || '').trim();
  const code = String((req.body || {}).code || '').trim().toUpperCase();
  if (account === '' || code === '') {
    return res.status(400).json({ ok: false, error: '缺少 account 或邀请码' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT code, name, expires_at FROM coop_sessions WHERE code = ?', [code]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: '邀请码不存在' });
    }
    if (new Date(rows[0].expires_at).getTime() < Date.now()) {
      return res.status(410).json({ ok: false, error: '邀请码已过期' });
    }
    await pool.query(
      'INSERT INTO coop_members (code, account, nickname) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE nickname = VALUES(nickname)',
      [code, account, account.split('@')[0]]);
    const members = await coopMembers(code);
    res.json({
      ok: true, code, name: rows[0].name,
      expiresAt: new Date(rows[0].expires_at).getTime(), members
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* 查询协作池是否还有效（本机缓存里的池子可能是上一版残留/已过期） */
app.get('/api/coop/:code', async (req, res) => {
  const code = String(req.params.code || '').trim().toUpperCase();
  try {
    const [rows] = await pool.query(
      'SELECT code, name, expires_at FROM coop_sessions WHERE code = ?', [code]);
    if (rows.length === 0) {
      return res.status(404).json({ ok: false, error: '协作池不存在' });
    }
    if (new Date(rows[0].expires_at).getTime() < Date.now()) {
      return res.status(410).json({ ok: false, error: '协作池已过期' });
    }
    const members = await coopMembers(code);
    res.json({
      ok: true, code, name: rows[0].name,
      expiresAt: new Date(rows[0].expires_at).getTime(), members
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* 我的家庭列表（含我的角色与成员数） */
app.get('/api/families', async (req, res) => {
  const phone = String(req.query.phone || '');
  if (!phone) {
    return res.status(400).json({ error: '缺少 phone' });
  }
  try {
    const [rows] = await pool.query(
      'SELECT f.id, f.name, f.invite_code, fm.role, ' +
      '(SELECT COUNT(*) FROM family_members x WHERE x.family_id = f.id) AS member_count ' +
      'FROM family_members fm JOIN families f ON f.id = fm.family_id WHERE fm.phone = ? ORDER BY f.id',
      [phone]);
    res.json({ ok: true, families: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 创建家庭（创建者即管理员，自动生成邀请码） */
app.post('/api/families', async (req, res) => {
  const { phone, name } = req.body || {};
  if (!phone || !name) {
    return res.status(400).json({ error: '缺少 phone 或 name' });
  }
  const id = 'fam-' + Date.now();
  const code = genInvite();
  try {
    await pool.query('INSERT INTO families (id, name, owner_phone, invite_code) VALUES (?, ?, ?, ?)',
      [id, String(name).slice(0, 32), phone, code]);
    await pool.query('INSERT INTO family_members (family_id, phone, role) VALUES (?, ?, ?)',
      [id, phone, '管理员']);
    res.json({ ok: true, family: { id, name, invite_code: code, role: '管理员', member_count: 1 } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 邀请码加入家庭（F9.3） */
app.post('/api/families/join', async (req, res) => {
  const { phone, code } = req.body || {};
  if (!phone || !code) {
    return res.status(400).json({ error: '缺少 phone 或 code' });
  }
  try {
    const [fams] = await pool.query('SELECT id, name, invite_code FROM families WHERE invite_code = ?', [code]);
    if (fams.length === 0) {
      return res.status(404).json({ error: '邀请码不存在或已撤销' });
    }
    const fam = fams[0];
    await pool.query('INSERT IGNORE INTO family_members (family_id, phone, role) VALUES (?, ?, ?)', [fam.id, phone, '成员']);
    res.json({ ok: true, family: { id: fam.id, name: fam.name, invite_code: fam.invite_code, role: '成员' } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 家庭成员与角色（F9.2） */
app.get('/api/families/:id/members', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT fm.phone, fm.role, fm.joined_at, u.nickname FROM family_members fm ' +
      'LEFT JOIN users u ON u.phone = fm.phone WHERE fm.family_id = ? ORDER BY fm.joined_at',
      [String(req.params.id).slice(0, 64)]);
    res.json({ ok: true, members: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 添加成员 / 调整角色 */
app.post('/api/families/:id/members', async (req, res) => {
  const { phone, role } = req.body || {};
  if (!phone) {
    return res.status(400).json({ error: '缺少 phone' });
  }
  try {
    await pool.query('INSERT INTO family_members (family_id, phone, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role = VALUES(role)',
      [String(req.params.id).slice(0, 64), phone, role === '只读' || role === '管理员' ? role : '成员']);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 移除 / 退出成员 */
app.delete('/api/families/:id/members/:phone', async (req, res) => {
  try {
    await pool.query('DELETE FROM family_members WHERE family_id = ? AND phone = ?',
      [String(req.params.id).slice(0, 64), String(req.params.phone).slice(0, 16)]);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 撤销并重建邀请码 */
app.post('/api/families/:id/invite', async (req, res) => {
  const code = genInvite();
  try {
    await pool.query('UPDATE families SET invite_code = ? WHERE id = ?',
      [code, String(req.params.id).slice(0, 64)]);
    res.json({ ok: true, invite_code: code });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 上传快照：版本冲突检测（F9.10）
   - baseVersion 为空 → 无条件覆盖（兼容旧客户端）
   - baseVersion < 云端版本 → 409，带云端 version/updatedAt；客户端提示“云端已更新”，可 force 覆盖 */
app.post('/api/sync/upload', async (req, res) => {
  const { familyId, payload, baseVersion, force, version } = req.body || {};
  if (!familyId || !payload) {
    return res.status(400).json({ error: '缺少 familyId 或 payload' });
  }
  const ver = Number(version) || Date.now();
  const base = baseVersion !== undefined && baseVersion !== null ? Number(baseVersion) : null;
  try {
    const fid = String(familyId).slice(0, 64);
    if (base !== null) {
      const [rows] = await pool.query('SELECT version, updated_at FROM sync_snapshots WHERE family_id = ?', [fid]);
      if (rows.length > 0 && ver !== rows[0].version && base < rows[0].version) {
        if (!force) {
          return res.status(409).json({
            error: '云端已有更新版本（冲突）',
            version: rows[0].version,
            updatedAt: rows[0].updated_at
          });
        }
      }
    }
    await pool.query(
      'INSERT INTO sync_snapshots (family_id, payload, version) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE payload = VALUES(payload), version = VALUES(version)',
      [fid, JSON.stringify(payload), ver]);
    await pool.query('INSERT INTO ops_logs (family_id, action, detail) VALUES (?, ?, ?)',
      [fid, 'upload', '版本 ' + ver + (force ? '（冲突覆盖）' : '')]);
    res.json({ ok: true, version: ver });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 云端当前版本（下载前冲突判断；无快照时 version=0） */
app.get('/api/sync/status/:familyId', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT version, updated_at FROM sync_snapshots WHERE family_id = ?',
      [String(req.params.familyId).slice(0, 64)]);
    if (rows.length === 0) {
      return res.json({ ok: true, version: 0, updatedAt: null });
    }
    res.json({ ok: true, version: rows[0].version, updatedAt: rows[0].updated_at });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 下载快照 */
app.get('/api/sync/download/:familyId', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT payload, version, updated_at FROM sync_snapshots WHERE family_id = ?',
      [String(req.params.familyId).slice(0, 64)]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '云端没有该家庭的快照' });
    }
    res.json({
      ok: true,
      version: rows[0].version,
      updatedAt: rows[0].updated_at,
      payload: JSON.parse(rows[0].payload)
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* 操作日志（最近 50 条） */
app.get('/api/logs/:familyId', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT action, detail, created_at FROM ops_logs WHERE family_id = ? ORDER BY id DESC LIMIT 50',
      [String(req.params.familyId).slice(0, 64)]);
    res.json({ ok: true, logs: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ==========================================================================
   AI 网关（M-7）：端侧只发意图 + 证据，Key 与模型调用全部发生在服务端。
   红线保持一致：数值由端侧代码计算后放进 evidence；写操作仍由端侧预览确认。
   ========================================================================== */

/** 按家庭限流：每分钟最多 AI.rpm 次模型调用（内存滑窗，单实例部署足够） */
const rateBuckets = new Map();
function rateLimited(familyId) {
  const now = Date.now();
  const key = String(familyId || 'anonymous');
  const b = rateBuckets.get(key) || { start: now, count: 0 };
  if (now - b.start >= 60000) {
    b.start = now;
    b.count = 0;
  }
  b.count += 1;
  rateBuckets.set(key, b);
  return b.count > AI.rpm;
}

/** 用量留痕：端侧与管理员端共用（M-10）；DB 不可用时只打日志，不影响回答 */
async function logAiUsage(row) {
  console.log('[ai-usage]', JSON.stringify(row));
  try {
    await pool.query(
      'INSERT INTO ai_usage (family_id, user_phone, route, model, ms, tokens, source) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [String(row.familyId || 'anonymous').slice(0, 64), String(row.user || '').slice(0, 16),
        String(row.route || 'other').slice(0, 32), String(row.model || '').slice(0, 64),
        Math.max(0, Math.round(row.ms || 0)), Math.max(0, Math.round(row.tokens || 0)),
        String(row.source || 'gateway').slice(0, 16)]);
  } catch (e) {
    console.warn('[ai-usage] 落库失败（不影响回答）:', e.message);
  }
}

/** 端侧按意图装配的证据块 → 系统提示（红线：数字只能来自证据） */
function buildChatSystemPrompt(intent, evidence, graphEvidence) {
  let sys = '你是「启核图策」家庭资源智能管家，用简洁友好的中文回答。回答必须只依据下面的证据数据，' +
    '不得编造证据里没有的物品或数量（引用名称要与证据一致）。\n' + String(evidence || '（无证据）');
  if (graphEvidence && Array.isArray(graphEvidence.lines) && graphEvidence.lines.length > 0) {
    sys += '\n【图谱证据】以下每条都来自该家庭自己的库存图谱（' +
      (graphEvidence.mode === 'multi-hop' ? '多跳推理' : graphEvidence.mode === 'global' ? '社区摘要' : '实体邻域') +
      '），括号内是推理路径：\n' + graphEvidence.lines.map((l, i) => `${i + 1}. ${l}`).join('\n');
    if (Array.isArray(graphEvidence.paths) && graphEvidence.paths.length > 0) {
      sys += '\n【可引用路径】\n' + graphEvidence.paths.slice(0, 5).map((p, i) => {
        const chain = (p.nodes || []).join(' → ');
        return `P${i}: ${chain}｜事实：${(p.facts || []).join('；')}${p.src ? `｜来源：${p.src}` : ''}`;
      }).join('\n');
    }
  }
  sys += '\n输出规则：\n' +
    '1. 涉及数量的回答，数字必须与证据一致；\n' +
    '2. 回答控制在 150 字以内，**直接给结论**：不要输出思考过程、推理步骤、"回复策略"或任何自我分析；\n' +
    '3. 如用户意图是修改库存（说了某物品还剩/用了多少），在最后一行单独输出：[调整]物品名|新数量（数字）。物品名必须来自证据；\n' +
    '4. 如用户要求把物品加入采购清单，在最后一行单独输出：[购物]物品名|数量（如"1 盒"，不确定写"适量"）；\n' +
    '5. 如用户要求创新菜谱，先给 1-2 句介绍，再在最后一行输出：[菜]菜名|预计耗时|亮点|用料1,用料2（每个用料为"名称 数量单位"，必须尽量用证据里的物品）。';
  if (graphEvidence && Array.isArray(graphEvidence.lines) && graphEvidence.lines.length > 0) {
    sys += '\n6. 引用图谱事实时必须保留对象名与数字，不得改写数量；\n' +
      '7. 证据不足时直接说明缺少哪条事实，不要推测；\n' +
      '8. 多步动作按"查询 → 方案 → 写操作"顺序输出工具行，每条工具行独占一行。';
  }
  if (intent === 'summary') {
    sys = '你是「启核图策」家庭库存分析师。根据下面给出的统计数据写 2-3 句中文总结与 1 条行动建议，' +
      '数字必须原样引用，不得新增或修改数字，不要输出标题和列表符号。\n' + String(evidence || '');
  }
  if (intent === 'community-summary') {
    sys = '你是「启核图策」家庭资源分析师。根据下面给出的"社区统计"写 1 句洞察（≤80 字），' +
      '数字必须原样引用，不得新增或修改数字，不要输出标题、列表符号或建议清单。\n' + String(evidence || '');
  }
  return sys;
}

/** 单次上游调用（失败抛错，由上层决定重试/降级）；timeoutMs 缺省用全局 AI.timeoutMs */
async function callAgnesOnce(messages, maxTokens, model, timeoutMs) {
  const res = await fetch(AI.baseUrl + '/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + AI.apiKey
    },
    body: JSON.stringify({
      model: model,
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.6
    }),
    signal: AbortSignal.timeout(Number(timeoutMs) > 0 ? Number(timeoutMs) : AI.timeoutMs)
  });
  if (!res.ok) {
    const err = new Error('上游返回 ' + res.status);
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  const text = data && data.choices && data.choices[0] && data.choices[0].message
    ? String(data.choices[0].message.content || '') : '';
  if (text === '') {
    throw new Error('上游返回为空');
  }
  const tokens = data && data.usage ? Number(data.usage.total_tokens || 0) : 0;
  return { text, tokens, model };
}

/**
 * 调用 Agnes（OpenAI 兼容）：同一模型内对 429/5xx 退避重试 3 次，再降级备用模型重试 3 次。
 * 免费上游偶发 429/503（限流/排队）很常见，不重试会直接失败到端侧（端侧只能回退演示数据，
 * 看起来就像"识别是假的"）。
 */
async function callAgnes(messages, maxTokens, model) {
  const attempts = [model, AI.modelAlt];
  let lastErr = null;
  for (let m = 0; m < attempts.length; m++) {
    for (let i = 0; i < 3; i++) {
      try {
        return await callAgnesOnce(messages, maxTokens, attempts[m]);
      } catch (e) {
        lastErr = e;
        const retryable = e.status === 429 || (e.status >= 500 && e.status < 600) ||
          String(e.message).indexOf('timeout') >= 0 || String(e.message).indexOf('aborted') >= 0;
        // 429/403 是"这个模型现在不能用"，同模型重试只是白等（免费额度按模型限流）→ 直接换下一个模型
        if (!retryable || i === 2 || e.status === 429 || e.status === 403) {
          break;
        }
        const waitMs = 800 * Math.pow(2, i);   // 0.8s / 1.6s
        console.warn('[ai-gateway] ' + attempts[m] + ' ' + e.message + '，' + waitMs + 'ms 后重试');
        await new Promise((r) => setTimeout(r, waitMs));
      }
    }
  }
  throw lastErr || new Error('上游调用失败');
}

async function agnesChat(messages, maxTokens) {
  return await callAgnes(messages, maxTokens, AI.model);
}

/**
 * 视觉识别专用调用链（与文本快答分开）。
 *
 * 为什么不能复用 callAgnes：实测 agnes-2.0-flash 连续发第二次就 429（免费额度按模型限流），
 * 旧逻辑会对同一个已经被限流的模型退避 0.8s + 1.6s 再重试两次，每次都把整张图重传一遍，
 * 用户看到的就是"发一张不相干的图，AI 识别特别久"。现在的策略：
 *   - 429 / 403（限流、无权限）：立刻换下一个模型，不睡、不重传；
 *   - 5xx / 超时：同模型只退避 400ms 再给一次机会，然后换下一个模型；
 *   - 全程受 AI.visionBudgetMs 硬预算约束，超预算直接抛 deadline 错误，端侧立刻给出"识别超时"。
 * 每次尝试的耗时都会进 trail，便于复盘到底卡在哪个模型（返回体里也带一份）。
 */
async function callAgnesVision(messages, maxTokens) {
  const deadline = Date.now() + AI.visionBudgetMs;
  const trail = [];
  let lastErr = null;
  for (let m = 0; m < AI.visionModels.length; m++) {
    const model = AI.visionModels[m];
    for (let i = 0; i < 2; i++) {
      const left = deadline - Date.now();
      if (left < 1500) {
        const e = new Error('上游排队/限流，' + AI.visionBudgetMs + 'ms 预算内没等到结果');
        e.deadline = true;
        e.trail = trail;
        e.lastErr = lastErr;
        throw e;
      }
      const t = Date.now();
      try {
        const out = await callAgnesOnce(messages, maxTokens, model, Math.min(AI.timeoutMs, left));
        trail.push(model + ':' + (Date.now() - t) + 'ms:ok');
        console.log('[ai-gateway] vision ' + trail.join(' → '));
        return Object.assign({}, out, { trail });
      } catch (e) {
        lastErr = e;
        const status = Number(e.status || 0);
        const isTimeout = String(e.message).indexOf('timeout') >= 0 ||
          String(e.message).indexOf('aborted') >= 0;
        trail.push(model + ':' + (Date.now() - t) + 'ms:' + (status > 0 ? status : (isTimeout ? 'timeout' : 'err')));
        // 429/403：模型级不可用，换模型；其他非重试错误也直接换模型
        if (status === 429 || status === 403 || status === 401 || status === 404) {
          break;
        }
        if (i === 0 && (isTimeout || (status >= 500 && status < 600))) {
          await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        break;
      }
    }
  }
  console.warn('[ai-gateway] vision 全部失败: ' + trail.join(' → '));
  const err = lastErr || new Error('上游调用失败');
  err.trail = trail;
  throw err;
}

/** 上游有时会套 ```json 代码块、"items" 包裹或直接返回单对象，这里统一抽出 JSON */
function extractVisionJson(text) {
  const t = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const s = t.indexOf('[');
  const e = t.lastIndexOf(']');
  if (s >= 0 && e > s) {
    try {
      return JSON.parse(t.substring(s, e + 1));
    } catch (_e) { /* 退到对象解析 */ }
  }
  const so = t.indexOf('{');
  const eo = t.lastIndexOf('}');
  if (so >= 0 && eo > so) {
    try {
      return JSON.parse(t.substring(so, eo + 1));
    } catch (_e) { /* 交给调用方报格式异常 */ }
  }
  return null;
}

/**
 * 归一化上游结果：模型偶尔返回裸字符串数组（["鸡蛋","牛奶"]）或换字段名（label/item/title），
 * 旧代码只认 name，于是"明明识别到了东西"却变成 0 项，端侧再回退演示数据 —— 看着像假的。
 */
function normalizeVisionItems(raw) {
  let list = raw;
  if (list && !Array.isArray(list)) {
    if (Array.isArray(list.items)) {
      list = list.items;
    } else if (Array.isArray(list.data)) {
      list = list.data;
    } else {
      list = [list];
    }
  }
  if (!Array.isArray(list)) {
    return [];
  }
  const num = (v, d) => {
    const n = Number(v);
    return isFinite(n) && n > 0 ? n : d;
  };
  const out = [];
  list.forEach((it) => {
    if (it === null || it === undefined) {
      return;
    }
    if (typeof it === 'string') {
      const name = it.trim();
      if (name !== '') {
        out.push({ name, category: '', qty: 1, unit: '个', pos: '', expDays: 7, price: 0, partial: true });
      }
      return;
    }
    if (typeof it !== 'object') {
      return;
    }
    const name = String(it.name || it.label || it.item || it.title || '').trim();
    if (name === '') {
      return;
    }
    out.push({
      name,
      category: String(it.category || it.type || ''),
      qty: num(it.qty || it.quantity || it.count, 1),
      unit: String(it.unit || '个'),
      pos: String(it.pos || it.position || it.location || ''),
      expDays: num(it.expDays || it.shelfLifeDays || it.expireDays, 7),
      price: num(it.price, 0)
    });
  });
  return out.slice(0, 60);
}

/**
 * 去掉模型自曝的"思考过程"。
 * 实测（平板上的真实回答）：agnes-3.0-flash 偶尔会把推理过程一起吐出来，
 * 形如「[思考过程：用户询问"药盒"。…回复策略：…回复内容：<正文>」，
 * 端侧原样展示会非常难看，也会泄露内部提示的措辞。这里统一裁到正文。
 */
function stripReasoning(text) {
  let s = String(text || '').trim();
  if (/^[\s\[【]*[\s\S]{0,40}?(思考过程|思考|推理过程|thinking|reasoning)/i.test(s)) {
    const m = s.match(/(回复内容|最终回复|最终答案|answer)\s*[:：]\s*([\s\S]*)$/i);
    if (m) {
      s = m[2].trim();
    } else {
      // 没有明确正文标记：优先砍掉第一个方括号块，其次按"回复策略/思考"等行切
      if (/^[\s\[【]/.test(s) && /[\]】]/.test(s)) {
        s = s.replace(/^[\s\[【][\s\S]*?[\]】]\s*/, '').trim();
      }
      s = s.replace(/^(思考过程|思考|推理过程|回复策略|thinking|reasoning)\s*[:：][^\n]*\n?/gim, '').trim();
    }
  }
  // 结尾残留的方括号 / 多余空行
  s = s.replace(/[\]】]\s*$/, '').replace(/\n{3,}/g, '\n\n').trim();
  return s === '' ? String(text || '').trim() : s;
}

/** 网关未配置 Key 时返回 503，端侧据此回退到本地快答 / 演示回复 */
function ensureKey(res) {
  if (!AI.apiKey) {
    res.status(503).json({ ok: false, error: 'AI 网关未配置：请在后端设置环境变量 AGNES_API_KEY' });
    return false;
  }
  return true;
}

/* AI 对话：intent + evidence 由端侧装配（红线 1），模型只做措辞与工具行输出 */
app.post('/api/ai/chat', async (req, res) => {
  const { familyId, user, intent, evidence, question, history, maxTokens, graphEvidence } = req.body || {};
  if (!question && intent !== 'community-summary') {
    return res.status(400).json({ ok: false, error: '缺少 question' });
  }
  if (!ensureKey(res)) {
    return;
  }
  if (rateLimited(familyId)) {
    return res.status(429).json({ ok: false, error: 'AI 调用过于频繁，请稍后再试（每分钟上限 ' + AI.rpm + ' 次）' });
  }
  const warnings = [];
  if (graphEvidence && Array.isArray(graphEvidence.lines)) {
    console.log('[ai-chat] graph evidence: mode=' + (graphEvidence.mode || '-') +
      ' version=' + (graphEvidence.version || '-') +
      ' lines=' + graphEvidence.lines.length +
      ' paths=' + (Array.isArray(graphEvidence.paths) ? graphEvidence.paths.length : 0));
  }
  if (graphEvidence && graphEvidence.stale === true) {
    warnings.push('summary_stale');
  }
  if (graphEvidence && Array.isArray(graphEvidence.lines) && graphEvidence.lines.length > 12) {
    warnings.push('graph_evidence_truncated');
  }
  const messages = [{ role: 'system', content: buildChatSystemPrompt(intent, evidence, graphEvidence) }];
  if (Array.isArray(history)) {
    history.slice(-8).forEach((m) => {
      messages.push({ role: m.who === 'me' ? 'user' : 'assistant', content: String(m.text || '') });
    });
  }
  messages.push({ role: 'user', content: String(question || '请写一句社区洞察。') });
  const t0 = Date.now();
  const traceId = 'ai-' + t0 + '-' + Math.random().toString(16).substring(2, 6);
  try {
    const out = await agnesChat(messages, Number(maxTokens) || 600);
    const ms = Date.now() - t0;
    out.text = stripReasoning(out.text);   // 模型偶尔自曝推理过程，裁到正文再回给端侧
    await logAiUsage({
      familyId, user, route: intent || 'other', model: out.model, ms, tokens: out.tokens,
      source: intent === 'community-summary' ? 'summary' : 'gateway'
    });
    // 证据引用回执：回答中出现了某条路径的数字 → 记为已引用（可解释性）
    const evidenceUsed = [];
    if (graphEvidence && Array.isArray(graphEvidence.paths)) {
      graphEvidence.paths.slice(0, 5).forEach((p, i) => {
        const nums = ((p.facts || []).join(' ').match(/\d+(\.\d+)?/g) || []);
        if (nums.length > 0 && nums.some((n) => out.text.indexOf(n) > -1)) {
          evidenceUsed.push('path:' + i);
        }
      });
    }
    res.json({
      ok: true, text: out.text, model: out.model, ms, tokens: out.tokens,
      traceId, evidenceUsed, warnings
    });
  } catch (e) {
    await logAiUsage({ familyId, user, route: intent || 'other', model: 'failed', ms: Date.now() - t0, tokens: 0 });
    res.status(502).json({ ok: false, error: '模型调用失败：' + e.message });
  }
});

/**
 * 视觉识别的系统提示。重点是让"不相干的图"快速返回空数组：
 * 旧提示词写的是"识别图中所有可见物品"，于是拍一张桌上电脑的照片，模型会认真列一堆
 * 屏幕/鼠标/文字并生成近千 token，既慢又会被当成库存物品。
 */
const VISION_RULES = '你是「启核图策」家庭库存识别引擎。只输出一个 JSON 数组，' +
  '不要输出任何解释、前后缀文字或 ``` 代码块标记。\n' +
  '数组元素格式：{"name":"鸡蛋","category":"蛋类","qty":8,"unit":"个","pos":"冷藏区","expDays":30,"price":15.9}\n' +
  '规则：\n' +
  '1. 只收录"家里会入库的物品"：食物、饮品、日用品、清洁用品、药品、工具、家居耗材；\n' +
  '2. 不要收录场景元素：屏幕、窗户、家具、人物、宠物、文字、图标、图表、logo、天空、建筑等；\n' +
  '3. 如果图中没有第 1 类物品（比如截图、风景、人像、文档、商品海报），直接返回 []，不要解释；\n' +
  '4. qty 必须是数字；单位用中文（个/瓶/袋/盒/把/斤）；识别不到价格填 0，识别不到保质期填 7；\n' +
  '5. 不要输出 bbox、confidence、坐标等额外字段。';

/* 视觉识别：端侧压缩后的 base64 JPEG → 结构化物品数组（F1.1/F1.5） */
app.post('/api/ai/vision', async (req, res) => {
  const { familyId, user, imageBase64, hints } = req.body || {};
  if (!imageBase64) {
    return res.status(400).json({ ok: false, error: '缺少 imageBase64' });
  }
  if (!ensureKey(res)) {
    return;
  }
  if (rateLimited(familyId)) {
    return res.status(429).json({ ok: false, error: 'AI 调用过于频繁，请稍后再试' });
  }
  const prompt = VISION_RULES + (hints ? '\n已知线索：' + String(hints).slice(0, 200) : '');
  const messages = [
    { role: 'system', content: '你是家庭物品识别引擎，只输出 JSON 数组，没有家庭物品时输出 []。' },
    { role: 'user', content: [{ type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + String(imageBase64) } }] }
  ];
  const t0 = Date.now();
  try {
    const out = await callAgnesVision(messages, AI.visionMaxTokens);
    const raw = extractVisionJson(out.text);
    const ms = Date.now() - t0;
    if (raw === null) {
      await logAiUsage({ familyId, user, route: 'vision', model: out.model + '·格式异常', ms, tokens: out.tokens });
      return res.status(502).json({
        ok: false, error: '模型返回格式异常，请换一张图或重拍', ms, model: out.model, trail: out.trail
      });
    }
    const items = normalizeVisionItems(raw);
    await logAiUsage({ familyId, user, route: 'vision', model: out.model, ms, tokens: out.tokens });
    console.log('[ai-vision] items=' + items.length + ' ms=' + ms + ' model=' + out.model +
      ' trail=' + out.trail.join(' → '));
    res.json({
      ok: true, items, model: out.model, ms, tokens: out.tokens,
      trail: out.trail, noHouseholdItems: items.length === 0
    });
  } catch (e) {
    const ms = Date.now() - t0;
    await logAiUsage({ familyId, user, route: 'vision', model: e.deadline ? 'timeout' : 'failed', ms, tokens: 0 });
    console.log('[ai-vision] failed ms=' + ms + ' deadline=' + (e.deadline === true) +
      ' trail=' + (Array.isArray(e.trail) ? e.trail.join(' → ') : '-'));
    res.status(e.deadline === true ? 504 : 502).json({
      ok: false, ms,
      error: (e.deadline === true ? '识别超时（上游限流），请重拍或稍后再试：' : '识别失败：') + e.message,
      trail: Array.isArray(e.trail) ? e.trail : []
    });
  }
});

/* TTS 播报（M-9）：未配置 TTS_ENDPOINT 时明确返回 501，端侧静默降级为纯文字 */
app.post('/api/ai/tts', async (req, res) => {
  const { text, voice } = req.body || {};
  if (!text) {
    return res.status(400).json({ ok: false, error: '缺少 text' });
  }
  if (!AI.ttsEndpoint) {
    return res.status(501).json({ ok: false, error: 'TTS 未配置（演示环境使用端侧系统 TTS，无系统引擎时静默降级）' });
  }
  try {
    const r = await fetch(AI.ttsEndpoint, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' },
        AI.ttsKey ? { 'Authorization': 'Bearer ' + AI.ttsKey } : {}),
      body: JSON.stringify({ text: String(text).slice(0, 500), voice: voice || 'zh-CN-female' }),
      signal: AbortSignal.timeout(AI.timeoutMs)
    });
    const data = await r.json();
    res.json({ ok: !!data.url || !!data.audioBase64, url: data.url || '', audioBase64: data.audioBase64 || '' });
  } catch (e) {
    res.status(502).json({ ok: false, error: 'TTS 调用失败：' + e.message });
  }
});

/* 端侧用量上报（含"本地快答"0 次模型记录），供 M-10 统计快答占比 */
app.post('/api/ai/usage', async (req, res) => {
  const { familyId, user, rows } = req.body || {};
  const list = Array.isArray(rows) ? rows.slice(0, 50) : [];
  if (list.length === 0) {
    return res.status(400).json({ ok: false, error: '缺少 rows' });
  }
  for (const r of list) {
    await logAiUsage({
      familyId, user, route: r.route, model: r.model,
      ms: r.ms, tokens: 0, source: r.model === '本地快答' ? 'local' : 'client'
    });
  }
  res.json({ ok: true, inserted: list.length });
});

/* 用量聚合：路由分布 / 模型分布 / 平均耗时 / 快答占比（端内 M-10 与管理员端共用） */
app.get('/api/ai/usage', async (req, res) => {
  const familyId = String(req.query.familyId || '').slice(0, 64);
  const days = Math.min(90, Math.max(1, Number(req.query.range || 7)));
  try {
    const [rows] = await pool.query(
      'SELECT route, model, source, COUNT(*) AS calls, AVG(ms) AS avg_ms, SUM(tokens) AS tokens ' +
      'FROM ai_usage WHERE family_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY) ' +
      'GROUP BY route, model, source ORDER BY calls DESC', [familyId, days]);
    const totals = await pool.query(
      'SELECT COUNT(*) AS calls, SUM(source = \'local\') AS fast, AVG(ms) AS avg_ms ' +
      'FROM ai_usage WHERE family_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)', [familyId, days]);
    const t = totals[0][0] || { calls: 0, fast: 0, avg_ms: 0 };
    const fastCalls = Number(t.fast || 0);
    const allCalls = Number(t.calls || 0);
    res.json({
      ok: true,
      range: days,
      total: allCalls,
      fastCalls: fastCalls,
      fastShare: allCalls === 0 ? 0 : Math.round(fastCalls * 1000 / allCalls) / 10,
      avgMs: Math.round(Number(t.avg_ms || 0)),
      byRoute: rows.map((r) => ({
        route: r.route, model: r.model, source: r.source,
        calls: Number(r.calls), avgMs: Math.round(Number(r.avg_ms || 0)), tokens: Number(r.tokens || 0)
      }))
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ==========================================================================
   图谱服务（补充方案第 6 章）：重建 / 读取 / 查询 / 社区摘要 / 运营指标
   红线：图查询不调用模型；摘要为离线预计算，走独立限流桶与独立用量来源。
   ========================================================================== */

function dbUnavailable(res, e) {
  res.status(503).json({ ok: false, error: '图谱服务不可用（数据库未就绪）：' + e.message });
}

/* 重建图谱：复用同步 payload，确定性抽取，0 次模型 */
app.post('/api/graph/rebuild', async (req, res) => {
  const { familyId, payload } = req.body || {};
  if (!familyId || !payload) {
    return res.status(400).json({ ok: false, error: '缺少 familyId 或 payload' });
  }
  const fid = String(familyId).slice(0, 64);
  const t0 = Date.now();
  try {
    const built = buildGraph(fid, payload);
    const saved = await graph.save(fid, built);
    res.json({
      ok: true, version: saved.version, nodes: saved.nodes, edges: saved.edges,
      communities: saved.communities, ms: Date.now() - t0, stats: built.stats
    });
  } catch (e) {
    dbUnavailable(res, e);
  }
});

/* 读取图谱（level 可过滤；include=stats 时带社区统计） */
app.get('/api/graph/:familyId', async (req, res) => {
  const fid = String(req.params.familyId).slice(0, 64);
  const level = Number(req.query.level || 0);
  try {
    const g = await graph.load(fid);
    if (g === null) {
      return res.status(404).json({ ok: false, error: '该家庭尚无图谱，请先 /api/graph/rebuild' });
    }
    const communities = level > 0 ? g.communities.filter((c) => c.level === level) : g.communities;
    const communityIds = new Set(communities.map((c) => c.id));
    const nodes = level > 0
      ? g.nodes.filter((n) => n.type !== 'ItemInstance' || (n.community || []).some((c) => communityIds.has(c)))
      : g.nodes;
    res.json({
      ok: true, version: g.version, builtAt: g.builtAt,
      nodes, edges: g.edges, communities,
      counts: { nodes: g.nodes.length, edges: g.edges.length, communities: g.communities.length }
    });
  } catch (e) {
    dbUnavailable(res, e);
  }
});

/* 图查询与证据装配：纯算法，不调用模型 */
app.post('/api/graph/query', async (req, res) => {
  const { familyId, mode, seed, question, hops, limit } = req.body || {};
  if (!familyId) {
    return res.status(400).json({ ok: false, error: '缺少 familyId' });
  }
  const m = mode === 'global' || mode === 'multi-hop' ? mode : 'local';
  const fid = String(familyId).slice(0, 64);
  try {
    const idx = await graph.index(fid);
    if (idx === null) {
      return res.status(404).json({ ok: false, error: '该家庭尚无图谱' });
    }
    const maxHops = Math.min(Math.max(Number(hops) || 3, 1), 3);
    const summaries = m === 'global' ? await graph.summaries(fid) : [];
    // seed 可以是节点 id，也可以是自然语言（统一交给实体识别）
    let query = String(question || '');
    if (seed) {
      const byId = idx.byId.get(String(seed));
      query = byId ? byId.label : (query !== '' ? query : String(seed));
    }
    const ev = buildEvidence(idx, m, query, { summaries, limit: Math.min(Number(limit) || 12, 20) });
    res.json({
      ok: true, mode: m, version: idx.graph.version, hops: maxHops, query,
      lines: ev.lines, paths: ev.paths, stale: ev.stale,
      matched: seed ? [String(seed)] : matchEntity(idx, query).slice(0, 5)
    });
  } catch (e) {
    dbUnavailable(res, e);
  }
});

/* 社区摘要预计算（离线批量）：每社区 1 次模型调用，独立限流桶 familyId:summary */
app.post('/api/graph/summaries', async (req, res) => {
  const { familyId, force, maxCalls } = req.body || {};
  if (!familyId) {
    return res.status(400).json({ ok: false, error: '缺少 familyId' });
  }
  if (!ensureKey(res)) {
    return;
  }
  const fid = String(familyId).slice(0, 64);
  try {
    const pending = await graph.pendingSummaries(fid);
    if (pending.version === '') {
      return res.status(404).json({ ok: false, error: '该家庭尚无图谱' });
    }
    const cap = Math.min(Math.max(Number(maxCalls) || 3, 1), 5);
    const todo = pending.stale.slice(0, cap);
    const generated = [];
    for (const c of todo) {
      if (rateLimited(fid + ':summary')) {
        generated.push({ community: c.id, text: '', skipped: 'rate_limited' });
        continue;
      }
      const st = c.stats || {};
      const statsText = `${c.label}：共 ${st.items || 0} 件；临期 ${st.expiring || 0} 项；` +
        `价值约 ¥${st.value || 0}；健康度 ${st.health === undefined ? '—' : st.health + '%'}`;
      const messages = [
        { role: 'system', content: buildChatSystemPrompt('community-summary', statsText, null) },
        { role: 'user', content: '请写一句社区洞察。' }
      ];
      const t0 = Date.now();
      try {
        const out = await agnesChat(messages, 200);
        await graph.saveSummary(fid, c.id, out.text.trim(), out.model, pending.version);
        await logAiUsage({
          familyId: fid, user: '', route: 'community-summary', model: out.model,
          ms: Date.now() - t0, tokens: out.tokens, source: 'summary'
        });
        generated.push({ community: c.id, text: out.text.trim(), model: out.model });
      } catch (e) {
        generated.push({ community: c.id, text: '', skipped: e.message });
      }
    }
    res.json({
      ok: true, version: pending.version, pending: pending.stale.length,
      generated, forced: !!force
    });
  } catch (e) {
    dbUnavailable(res, e);
  }
});

/* 管理员端运营指标（匿名聚合，不含物品明细） */
app.get('/api/admin/graph/stats', async (_req, res) => {
  try {
    res.json({ ok: true, stats: await graph.statsAll() });
  } catch (e) {
    dbUnavailable(res, e);
  }
});

/* 启动：DB 不可用时降级为"仅 AI 网关"模式，保证断库也能演示 AI 红线验收（X7） */
initDb().then(() => {
  console.log('[nexcoregraph-backend] DB 就绪');
}).catch((e) => {
  console.error('[nexcoregraph-backend] DB 初始化失败，降级为仅 AI 网关模式:', e.message);
}).finally(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log('[nexcoregraph-backend] listening on http://0.0.0.0:' + PORT);
        // 打 Key 前缀便于排查"用的哪把 Key"（曾出现：系统里残留失效旧 Key → 一直 401 → 端侧静默回退演示数据）
        const keyTag = AI.apiKey
          ? ('已配置 Key (' + AI.apiKey.slice(0, 7) + '****' + AI.apiKey.slice(-4) + ')')
          : '未配置 AGNES_API_KEY（仅本地快答可用）';
        console.log('[nexcoregraph-backend] AI 网关: ' + keyTag + ' | model=' + AI.model + ' alt=' + AI.modelAlt +
          ' | vision=' + AI.visionModels.join('>') + ' budget=' + AI.visionBudgetMs + 'ms maxTok=' + AI.visionMaxTokens);
        // 验证码下发通道：邮箱账号是否有授权码、短信通道是否配好（只打账号，不打密码）
        const mailTag = process.env.MAIL_USER
          ? ('邮箱 ' + process.env.MAIL_USER + ' @ ' + (process.env.MAIL_HOST || 'smtp.163.com') +
            (process.env.MAIL_PASS ? '（已配置授权码）' : '（缺 MAIL_PASS 授权码）'))
          : '邮箱未配置（缺 MAIL_USER / MAIL_PASS）';
        console.log('[nexcoregraph-backend] 验证码通道: ' + mailTag +
          ' | 短信=' + (AI.smsEndpoint ? '已配置' : '未配置') +
          ' | AUTH_SHOW_CODE=' + (process.env.AUTH_SHOW_CODE === '1' ? '1（联调）' : '0'));
        // 局域网自建服务器：把手机/平板该填的地址直接打出来，省得自己查 ipconfig
        const lans = lanAddresses();
        if (lans.length === 0) {
          console.log('[nexcoregraph-backend] 部署形态: 局域网自建服务器（未发现局域网网卡，检查是否连着 WiFi/网线）');
        } else {
          console.log('[nexcoregraph-backend] 部署形态: 局域网自建服务器（不经过公网，不需要域名与备案）');
          lans.forEach((a) => {
            console.log('[nexcoregraph-backend]   ' +
              (a.virtual ? '虚拟网卡（手机连不上，别填这个）: ' : '手机/平板填这个地址: ') +
              'http://' + a.ip + ':' + PORT + '   [' + a.iface + ']');
          });
          console.log('[nexcoregraph-backend]   同一 WiFi + 电脑防火墙放行 ' + PORT +
            '/3100（首次运行可执行 tools/start-lan.ps1，它会提示放行命令）');
        }
  });
});
