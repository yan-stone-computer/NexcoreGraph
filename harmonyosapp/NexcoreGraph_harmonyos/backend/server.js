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
const mysql = require('mysql2/promise');
const { buildGraph } = require('./graphBuild');
const { GraphService } = require('./graphService');
const { buildEvidence, matchEntity } = require('./graphQuery');

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
  modelAlt: process.env.AGNES_MODEL_ALT || 'agnes-1.5-flash',
  timeoutMs: Number(process.env.AI_TIMEOUT_MS || 15000),
  rpm: Number(process.env.AI_RPM || 20),
  ttsEndpoint: process.env.TTS_ENDPOINT || '',
  ttsKey: process.env.TTS_API_KEY || ''
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
}

function genInvite() {
  return 'TS-' + String(Math.floor(1000 + Math.random() * 9000));
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

/* 演示登录：验证码固定 123456，用户首次登录自动建档并加入默认家庭（F9.1） */
app.post('/api/auth/login', async (req, res) => {
  const { phone, code } = req.body || {};
  if (!/^1\d{10}$/.test(String(phone || ''))) {
    return res.status(400).json({ error: '请输入 11 位手机号' });
  }
  if (String(code) !== '123456') {
    return res.status(400).json({ error: '验证码错误（演示码 123456）' });
  }
  try {
    await pool.query('INSERT IGNORE INTO users (phone, nickname) VALUES (?, ?)', [phone, '用户' + phone.slice(-4)]);
    // 首个登录者创建默认家庭并成为管理员；后续登录者加入为成员（F9.1/F9.2）
    const [famIns] = await pool.query(
      'INSERT IGNORE INTO families (id, name, owner_phone, invite_code) VALUES (?, ?, ?, ?)',
      ['home', '幸福小家', phone, 'TS-4821']);
    const role = famIns.affectedRows === 1 ? '管理员' : '成员';
    await pool.query(
      'INSERT INTO family_members (family_id, phone, role) VALUES (?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE role = role',
      ['home', phone, role]);
    const [rows] = await pool.query('SELECT id, phone, nickname FROM users WHERE phone = ?', [phone]);
    res.json({ token: 'demo-' + phone, user: rows[0] });
  } catch (e) {
    res.status(500).json({ error: e.message });
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
    '2. 回答控制在 150 字以内；\n' +
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

/** 调用 Agnes（OpenAI 兼容）；主模型失败自动降级备用模型，单请求最多 2 次调用 */
async function callAgnes(messages, maxTokens, model) {
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
    signal: AbortSignal.timeout(AI.timeoutMs)
  });
  if (!res.ok) {
    throw new Error('上游返回 ' + res.status);
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

async function agnesChat(messages, maxTokens) {
  try {
    return await callAgnes(messages, maxTokens, AI.model);
  } catch (e) {
    console.warn('[ai-gateway] 主模型失败，降级备用模型:', e.message);
    return await callAgnes(messages, maxTokens, AI.modelAlt);
  }
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
  const prompt = '识别图中所有可见物品并估算信息。只输出一个 JSON 数组，不要输出任何其他文字、解释或代码块标记。' +
    '格式：[{"name":"鸡蛋","category":"蛋类","qty":8,"unit":"个","pos":"冷藏区","expDays":30,"price":15.9}]。' +
    'qty 为数字；识别不了的物品跳过；价格识别不了填 0。' +
    (hints ? '已知线索：' + String(hints).slice(0, 200) : '');
  const messages = [
    { role: 'system', content: '你是家庭物品识别引擎，只输出 JSON 数组。' },
    { role: 'user', content: [{ type: 'text', text: prompt },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + String(imageBase64) } }] }
  ];
  const t0 = Date.now();
  try {
    const out = await agnesChat(messages, 1500);
    let jsonText = out.text.trim();
    const s = jsonText.indexOf('[');
    const e = jsonText.lastIndexOf(']');
    if (s >= 0 && e > s) {
      jsonText = jsonText.substring(s, e + 1);
    }
    const items = JSON.parse(jsonText);
    const ms = Date.now() - t0;
    await logAiUsage({ familyId, user, route: 'vision', model: out.model, ms, tokens: out.tokens });
    res.json({ ok: true, items, model: out.model, ms, tokens: out.tokens });
  } catch (e) {
    await logAiUsage({ familyId, user, route: 'vision', model: 'failed', ms: Date.now() - t0, tokens: 0 });
    res.status(502).json({ ok: false, error: '识别失败：' + e.message });
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
    console.log('[nexcoregraph-backend] AI 网关: ' + (AI.apiKey ? '已配置 Key' : '未配置 AGNES_API_KEY（仅本地快答可用）'));
  });
});
