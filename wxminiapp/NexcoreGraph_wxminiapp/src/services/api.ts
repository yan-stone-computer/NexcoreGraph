// 启核图策 · 小程序 API 层（本地模拟后端，对应 webapp js/mockapi.js 的迁移）
// 覆盖：登录鉴权、物品与库、预警引擎、方案与核销、拍照识别模拟、同步（本地模拟）、邀请码、AI 用量、预算
import Taro from '@tarojs/taro'
import { SEED } from '@/data/seed'
import { KB } from '@/data/knowledge'
import { loadSession, clearSession, type AccountSession } from '@/services/session'
import { pushRemote } from '@/services/workspace'
import { createCompensation, eventById, recordEvent, sealPendingEvents, timeline as eventTimeline } from '@/services/eventStore'
import type { DomainEventType } from '@/domain/eventJournal'
import type {
  DB, Item, Library, Alert, Plan, ShoppingItem, ChatMsg, Stats, Profile, SyncStatus, IntakeResult
} from '@/types'

const LS_KEY = 'nexcore_weapp_db_v1'
const LS_CLOUD = 'nexcore_weapp_cloud_v1'
const LS_LOGIN = 'nexcore_weapp_logged_in'
const LATENCY = 200
let persistenceEnabled = false
let applyingRemote = false
let persistenceTimer: any = null

function seed(): DB {
  return JSON.parse(JSON.stringify(SEED))
}

function merge(dst: Record<string, any>, src: Record<string, any>) {
  Object.keys(src).forEach((k) => {
    if (dst[k] === undefined) { dst[k] = src[k]; return }
    if (typeof src[k] === 'object' && src[k] !== null && !Array.isArray(src[k]) &&
        typeof dst[k] === 'object' && dst[k] !== null && !Array.isArray(dst[k])) merge(dst[k], src[k])
  })
  return dst
}

function load(): DB {
  try {
    const s = Taro.getStorageSync(LS_KEY)
    if (s) return merge(JSON.parse(s), seed()) as DB
  } catch (e) { console.error('[API] load db error:', e) }
  return seed()
}

export let db: DB = load()

function save() {
  try {
    Taro.setStorageSync(LS_KEY, JSON.stringify(db))
  } catch (e) { console.error('[API] save db error:', e) }
  computeAlerts()
  computeDaily()
  scheduleRemotePush()
}

function scheduleRemotePush() {
  if (!persistenceEnabled || applyingRemote || !loadSession()) return
  if (persistenceTimer) clearTimeout(persistenceTimer)
  persistenceTimer = setTimeout(() => {
    persistenceTimer = null
    pushRemote(api.snapshotPayload(), api.localVersion()).then((r) => {
      db.syncVersion = r.version
      try { Taro.setStorageSync(LS_KEY, JSON.stringify(db)) } catch (e) { /* ignore */ }
    }).catch((e) => {
      console.warn('[workspace] remote save failed:', e && e.message)
    })
  }, 900)
}

function sleep() { return new Promise((r) => setTimeout(r, LATENCY + Math.random() * 180)) }
function nid(p: string) { return p + Date.now() + Math.floor(Math.random() * 1000) }
export function todayStr() { return new Date().toISOString().slice(0, 10) }
export function nowTime() {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function findItem(idOrName: string): { lib: Library; item: Item } | null {
  for (let i = 0; i < db.libraries.length; i++) {
    const lib = db.libraries[i]
    for (let j = 0; (lib.items || []).length > j; j++) {
      if (lib.items[j].id === idOrName || lib.items[j].name === idOrName) return { lib, item: lib.items[j] }
    }
  }
  return null
}
function findLib(id: string): Library | null {
  return db.libraries.filter((l) => l.id === id)[0] || null
}

/* P0-4 忌口列表：仅当「注入 AI 规划」开启时参与规划过滤（H3）；"不吃香菜"归一为"香菜" */
function profileDislikes(): string[] {
  const p = db.profile || ({} as Profile)
  if (p.enabled === false || !p.dislikes) return []
  return String(p.dislikes).split(/[、,，;；\s]+/).filter(Boolean)
    .map((d) => d.replace(/^(不吃|不吃|讨厌|忌口|过敏)/, ''))
}

function pushLog(action: string, detail: string, extra?: Record<string, any>) {
  db.logs.unshift(Object.assign({ action, detail, at: new Date().toLocaleString('zh-CN', { hour12: false }), ts: Date.now() }, extra || {}))
  if (db.logs.length > 120) db.logs.length = 120
}

function eventKey(prefix: string): string {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8)
}

function recordDomainEvent(
  type: DomainEventType,
  targetId: string,
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
  correlationId?: string
): void {
  try {
    recordEvent({
      familyId: db.familyId || 'local',
      type,
      targetId,
      before,
      after,
      actor: db.user?.phone || db.user?.name || 'local-user',
      idempotencyKey: eventKey(type),
      correlationId
    })
  } catch (e) {
    console.warn('[events] record failed:', e)
  }
}

/* 写权限：只读账号禁止写库存（F9.2） */
function guard() {
  if (db.user && db.user.role === '只读') throw new Error('只读账号无写权限（F9.2）')
}

/* AI 用量（F10.5） */
function aiLog(route: string, model?: string, ms?: number) {
  const cfg = db.config || ({} as DB['config'])
  const unit = route.indexOf('vision') > -1 ? (cfg.visionPrice || 0.01) : (cfg.unitPrice || 0.002)
  db.aiUsage.unshift({
    route, model: model || cfg.model || 'DeepSeek-V3', ms: Math.round(ms || 0),
    cost: model === '本地快答' ? 0 : unit,
    at: new Date().toLocaleString('zh-CN', { hour12: false }), day: todayStr()
  })
  if (db.aiUsage.length > 300) db.aiUsage.length = 300
}

function nextNo(): string {
  db.meta = db.meta || { noSeq: 0 }
  let max = db.meta.noSeq || 0
  db.libraries.forEach((l) => (l.items || []).forEach((it) => {
    const m = /NO-(\d+)/.exec(it.no || '')
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }))
  db.meta.noSeq = max
  return 'NO-' + String(++db.meta.noSeq).padStart(4, '0')
}

function recount(lib: Library) {
  lib.count = (lib.items || []).length
  lib.desc = lib.items.length + ' 件'
}

/* ---------- 预警引擎（F3.9-F3.14） ---------- */
function computeAlerts() {
  const soon = (db.settings && db.settings.alertSoon) || 7
  const crit = (db.settings && db.settings.alertCritical) || 3
  const out: Alert[] = []
  db.libraries.forEach((lib) => {
    (lib.items || []).forEach((it) => {
      const where = lib.name + ' · ' + (it.pos || '未设置')
      if (it.expDays != null && it.expDays < 9000) {
        if (it.expDays <= 0) {
          out.push({ id: it.id + '-exp0', type: 'expiring', icon: 'alert', tone: 'red', text: it.name + ' 已过期，请立即处理', meta: '今天 · ' + where })
        } else if (it.med && it.expDays <= crit) {
          out.push({ id: it.id + '-med', type: 'medicine', icon: 'pill', tone: 'red', text: it.name + ' ' + it.expDays + ' 天后到期，请确认库存（F3.12）', meta: '刚刚 · ' + where })
        } else if (it.expDays <= crit) {
          out.push({ id: it.id + '-c', type: 'expiring', icon: 'clock', tone: 'red', text: it.name + ' ' + it.expDays + ' 天后到期，建议优先消耗', meta: '刚刚 · ' + where })
        } else if (it.expDays <= soon) {
          out.push({ id: it.id + '-s', type: 'expiring', icon: 'clock', tone: 'amber', text: it.name + ' ' + it.expDays + ' 天后到期，可纳入近几日方案', meta: '刚刚 · ' + where })
        }
      }
      if (it.warrantyDays != null && it.warrantyDays <= 30) {
        out.push({ id: it.id + '-w', type: 'warranty', icon: 'shield', tone: 'muted', text: it.name + ' ' + it.warrantyDays + ' 天后过保修期（F3.13）', meta: '本周 · ' + where })
      }
      if ((it.lowAt || 0) > 0 && it.qty <= it.lowAt) {
        out.push({ id: it.id + '-low', type: 'low', icon: 'package', tone: 'teal', text: it.name + ' 低于阈值（阈值 ' + it.lowAt + ' ' + it.unit + '，当前 ' + it.qty + ' ' + it.unit + '）', meta: '刚刚 · 规则自动化（D4 lowAt）' })
      }
      it.expiring = it.expDays != null && it.expDays <= soon && it.expDays < 9000
    })
  })
  const order: Record<string, number> = { red: 0, amber: 1, teal: 2, muted: 3 }
  out.sort((a, b) => order[a.tone] - order[b.tone])
  db.alerts = out
}

/* 每日摘要：取预警前 3 条（F8.2），保留用户勾选状态 */
function computeDaily() {
  const prev: Record<string, boolean> = {}
  ;(db.daily || []).forEach((t) => { prev[t.text] = t.done })
  db.daily = db.alerts.slice(0, 3).map((a, i) => {
    const text = a.text.replace(/（F[\d.]+）|（.*?自动化.*?）/g, '')
    return { id: i + 1, text, done: !!prev[text] }
  })
}

/* ---------- 看板统计（F7） ---------- */
function computeStats(): Stats {
  let totalItems = 0, expiringN = 0, lowN = 0
  db.libraries.forEach((l) => (l.items || []).forEach((it) => {
    totalItems++
    if (it.expiring) expiringN++
    if ((it.lowAt || 0) > 0 && it.qty <= it.lowAt) lowN++
  }))
  const dom = new Date().getDate()
  let spent = 0
  db.libraries.forEach((l) => (l.items || []).forEach((it) => {
    if (it.addedAt && it.addedAt <= dom) spent += it.price || 0
  }))
  const planDone = db.plans.filter((p) => p.status === 'done').length
  const planTotal = db.plans.length || 1
  const trend = { consume: [] as number[], purchase: [] as number[], labels: [] as string[] }
  const dayMs = 86400000
  const todayKey = todayStr()
  let liveC = 0, liveP = 0
  db.logs.forEach((l) => {
    if (l.day !== todayKey) return
    if (l.kind === 'consume') liveC += l.n || 0
    if (l.kind === 'intake') liveP += l.n || 0
  })
  const h7 = db.history7 || []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * dayMs)
    trend.labels.push((d.getMonth() + 1) + '/' + d.getDate())
    const seedRow = h7.filter((r) => r.d === i)[0] || { consume: 0, purchase: 0 }
    trend.consume.push(i === 0 ? liveC : seedRow.consume)
    trend.purchase.push(i === 0 ? liveP : seedRow.purchase)
  }
  const byName: Record<string, number> = {}
  db.logs.forEach((l) => {
    if (l.kind === 'consume' && l.name && Date.now() - l.ts < 7 * dayMs) byName[l.name] = (byName[l.name] || 0) + (l.n || 0)
  })
  const top = Object.keys(byName).sort((a, b) => byName[b] - byName[a])[0] || '—'
  const fridgeItems = (findLib('fridge') || { items: [] }).items || []
  const edible = fridgeItems.filter((i2) => i2.expDays < 9000 && i2.expDays > 0)
  const meals = Math.max(1, Math.round(edible.length * 1.2))
  return {
    totalItems, expiringN, lowN,
    spent: Math.round(spent), budget: db.budget || 600,
    planPct: Math.round((planDone / planTotal) * 100), planDone, planTotal: db.plans.length,
    trend, topFood: top, mealsLeft: meals, daysLeft: Math.max(1, Math.round(meals / 2.5)),
    wasteN: db.logs.filter((l) => l.action === 'expired').length,
    health: Math.max(40, 100 - Math.round((expiringN / Math.max(1, totalItems)) * 100) - lowN * 2)
  }
}

/* ---------- 物品变更统一入口 ---------- */
function applyQtyChange(hit: { lib: Library; item: Item }, delta: number, reason: string) {
  const before = hit.item.qty
  hit.item.qty = Math.max(0, hit.item.qty + delta)
  pushLog(delta < 0 ? 'consume' : 'qty',
    (delta < 0 ? '消耗「' : '补充「') + hit.item.name + '」' + (delta > 0 ? '+' : '') + delta + ' ' + hit.item.unit + '（' + reason + '）',
    { kind: delta < 0 ? 'consume' : 'intake', name: hit.item.name, n: Math.abs(delta), day: todayStr(), undo: { id: hit.item.id, qty: before } })
  return { before, after: hit.item.qty }
}

/* ---------- 启动：编号补齐 / 知识库发布内容回放 ---------- */
;(function boot() {
  db.libraries.forEach(recount)
  if (db.knowledge) {
    try {
      Object.keys((db.knowledge as any).foods || {}).forEach((k) => {
        if (KB.foods[k]) Object.assign(KB.foods[k], (db.knowledge as any).foods[k])
      })
      if (Array.isArray((db.knowledge as any).recipes)) (KB as any).recipes = (db.knowledge as any).recipes
      if (Array.isArray((db.knowledge as any).rules)) (KB as any).rules = (db.knowledge as any).rules
    } catch (e) { console.error('[API] knowledge replay error:', e) }
  }
  if (!db.syncVersion) db.syncVersion = 1
  save()
})()

const pristine: DB = JSON.parse(JSON.stringify(db))

/* 登录态 */
export function isLoggedIn(): boolean {
  try { return Taro.getStorageSync(LS_LOGIN) === '1' } catch (e) { return false }
}
function setLoggedIn(v: boolean) {
  try { Taro.setStorageSync(LS_LOGIN, v ? '1' : '0') } catch (e) { console.error('[API] login flag error:', e) }
}
export function logout() {
  db.user = undefined
  persistenceEnabled = false
  clearSession()
  setLoggedIn(false)
  save()
}

/* ================================================================
 * 对外 API
 * ================================================================ */
export const api = {
  getState: (): DB => db,
  getStats: (): Stats => computeStats(),

  initializeRemoteWorkspace: (
    session: AccountSession,
    payload: Record<string, any> | null,
    version: number
  ) => {
    applyingRemote = true
    persistenceEnabled = false
    const base = SEED as DB
    const starterLibs = JSON.parse(JSON.stringify(base.libraries)).slice(0, 4).map((l: Library) => ({
      ...l,
      count: 0,
      items: []
    }))
    Object.keys(db).forEach((k) => delete (db as any)[k])
    Object.assign(db, {
      theme: base.theme,
      settings: JSON.parse(JSON.stringify(base.settings)),
      profile: JSON.parse(JSON.stringify(base.profile)),
      budget: base.budget,
      config: JSON.parse(JSON.stringify(base.config)),
      libraries: starterLibs,
      alerts: [],
      plans: [],
      shopping: [],
      chat: [],
      daily: [],
      intake: {},
      history7: [],
      logs: [],
      aiUsage: [],
      users: [],
      families: [],
      members: {},
      invite: { code: '', familyId: session.familyId, expiresInDays: 7, used: 0, max: 3, revoked: true },
      workbench: { name: '家庭协作', expires: '', code: '', myDeck: [], seats: [], chat: [], members: [], plan: {} },
      familyId: session.familyId,
      family: { name: session.familyName, memberCount: 1 },
      user: {
        name: session.nickname || session.account,
        phone: session.account,
        role: session.role || '管理员',
        initial: (session.nickname || session.account).charAt(0)
      },
      syncVersion: version || 0
    })
    if (payload) {
      if (Array.isArray(payload.libraries) && payload.libraries.length) db.libraries = payload.libraries
      if (Array.isArray(payload.plans)) db.plans = payload.plans
      if (Array.isArray(payload.shopping)) db.shopping = payload.shopping
      if (Array.isArray(payload.logs)) db.logs = payload.logs
      if (Array.isArray(payload.daily)) db.daily = payload.daily
      if (Array.isArray(payload.alerts)) db.alerts = payload.alerts
    }
    db.libraries.forEach(recount)
    setLoggedIn(true)
    computeAlerts()
    computeDaily()
    try { Taro.setStorageSync(LS_KEY, JSON.stringify(db)) } catch (e) { /* ignore */ }
    applyingRemote = false
    persistenceEnabled = true
    return db
  },

  persistNow: (force = false) => {
    if (!loadSession()) return Promise.reject(new Error('尚未登录'))
    return pushRemote(api.snapshotPayload(), api.localVersion(), { force }).then((r) => {
      db.syncVersion = r.version
      try { Taro.setStorageSync(LS_KEY, JSON.stringify(db)) } catch (e) { /* ignore */ }
      return r
    })
  },

  clearAccountSession: () => {
    persistenceEnabled = false
    if (persistenceTimer) {
      clearTimeout(persistenceTimer)
      persistenceTimer = null
    }
    clearSession()
  },

  enablePersistence: () => {
    persistenceEnabled = Boolean(loadSession())
    if (persistenceEnabled) scheduleRemotePush()
    return persistenceEnabled
  },

  reset: (): DB => {
    Object.keys(db).forEach((k) => delete (db as any)[k])
    Object.assign(db, JSON.parse(JSON.stringify(pristine)))
    db.libraries.forEach(recount)
    setLoggedIn(false)
    save()
    return db
  },

  /* ===== 拍照识别（F1：本地模拟，正式版为 /api/ai/vision） ===== */
  recognize: (imgs: string[]): Promise<IntakeResult[]> => {
    const t0 = Date.now()
    return sleep().then(() => {
      const pool = [
        { name: '鸡蛋', kbKey: 'egg', emoji: '🥚', unit: '个' }, { name: '鲜牛奶', kbKey: 'milk', emoji: '🥛', unit: '盒' },
        { name: '番茄', kbKey: 'tomato', emoji: '🍅', unit: '个' }, { name: '上海青', kbKey: 'greens', emoji: '🥬', unit: '把' },
        { name: '五花肉', kbKey: 'pork', emoji: '🥩', unit: '克' }, { name: '酸奶', kbKey: 'yogurt', emoji: '🥤', unit: '杯' },
        { name: '黄瓜', kbKey: 'cucumber', emoji: '🥒', unit: '根' }, { name: '香蕉', kbKey: 'banana', emoji: '🍌', unit: '把' },
        { name: '面包', kbKey: 'bread', emoji: '🍞', unit: '袋' }, { name: '蘑菇', kbKey: 'mushroom', emoji: '🍄', unit: '盒' }
      ]
      const results: IntakeResult[] = imgs.map((img, i) => {
        const p = pool[(i * 3 + img.length) % pool.length]
        if ((img.length + i) % 5 === 4) {
          /* F1.4 无法判类 → 待归类 */
          return { id: nid('r'), emoji: '❔', img, name: '', category: '', qty: '', unit: '个', pos: '', exp: '', expSrc: '', expDays: 0, kbKey: '', price: '', priceSrc: '待补', attention: true }
        }
        const kb = KB.foods[p.kbKey]
        const qty = 1 + ((img.length + i) % 5)
        return {
          id: nid('r'), emoji: p.emoji, img, name: p.name,
          category: kb && kb.days >= 90 ? '干货' : '生鲜', qty: String(qty), unit: p.unit,
          pos: '冷藏区', exp: kb ? kb.days + ' 天' : '7 天', expSrc: '知识库默认', expDays: kb ? kb.days : 7,
          kbKey: p.kbKey, price: (Math.round((3 + ((img.length * 7 + i * 13) % 40)) * 10) / 10).toFixed(1), priceSrc: '拍照识别', attention: false
        }
      })
      aiLog('/api/ai/vision', db.config.visionModel, Date.now() - t0 + 900)
      pushLog('intake', 'AI 识别 ' + imgs.length + ' 张图片（模拟识别）')
      save()
      return results
    })
  },

  /* F1.2/D3 连拍合并：同名数量累加 */
  mergeIntake: (results: IntakeResult[]): IntakeResult[] => {
    const seen: Record<string, IntakeResult> = {}
    const out: IntakeResult[] = []
    results.forEach((r) => {
      const key = (r.name || '').trim()
      if (!key) { out.push(r); return }
      if (seen[key]) {
        seen[key].qty = String((parseFloat(seen[key].qty) || 0) + (parseFloat(r.qty) || 0))
        if (!seen[key].img && r.img) seen[key].img = r.img
      } else {
        seen[key] = r
        out.push(r)
      }
    })
    return out
  },

  addItems: (results: IntakeResult[], libId: string) => sleep().then(() => {
    guard()
    const lib = findLib(libId) || db.libraries[0]
    const correlationId = eventKey('intake')
    let added = 0
    results.forEach((r) => {
      if (!r.name) return
      const item: Item = {
        id: nid('it'), no: nextNo(), name: r.name, emoji: r.emoji || '📦', img: r.img || '', kbKey: r.kbKey || '',
        qty: parseFloat(r.qty) || 1, unit: r.unit || '个', price: parseFloat(r.price) || 0, priceSrc: r.priceSrc || '手动',
        expDays: parseInt(String(r.expDays), 10) || 7, pos: r.pos || '未设置',
        lowAt: (KB.foods[r.kbKey] || {}).lowAt || 0,
        addedAt: new Date().getDate(), private: false
      }
      lib.items.push(item)
      recordDomainEvent('item.created', item.id, null, { item: JSON.parse(JSON.stringify(item)), libId: lib.id }, correlationId)
      added++
    })
    recount(lib)
    pushLog('intake', '拍照入库 ' + added + ' 项到「' + lib.name + '」', { kind: 'intake', n: added, day: todayStr() })
    save()
    return db
  }),

  updateItemQty: (id: string, delta: number) => sleep().then(() => {
    guard()
    const hit = findItem(id)
    if (!hit) throw new Error('物品不存在')
    const before = hit.item.qty
    const r = applyQtyChange(hit, delta, '手动调整')
    recordDomainEvent('item.qty_changed', hit.item.id, { qty: before }, { qty: hit.item.qty })
    save()
    return r
  }),

  undoLast: () => sleep().then(() => {
    guard()
    const logs = db.logs.filter((l) => l.undo)
    if (!logs.length) throw new Error('没有可撤销的操作（保留最近 10 次）')
    const last = logs[0]
    const hit = findItem(last.undo!.id)
    if (!hit) throw new Error('物品已不存在，无法撤销')
    const before = hit.item.qty
    hit.item.qty = last.undo!.qty
    pushLog('undo', '撤销：「' + hit.item.name + '」数量 ' + before + ' → ' + last.undo!.qty)
    save()
    return last
  }),

  /* ===== 库管理（F2.1） ===== */
  createLibrary: (name: string) => sleep().then(() => {
    guard()
    const lib: Library = { id: nid('lib'), name: name || '新库', icon: 'package', tone: 'teal', count: 0, desc: '空库', items: [] }
    db.libraries.push(lib)
    pushLog('library', '新建库「' + lib.name + '」')
    save()
    return lib
  }),

  renameLibrary: (id: string, name: string) => sleep().then(() => {
    guard()
    const lib = findLib(id)
    if (!lib) throw new Error('库不存在')
    lib.name = name
    pushLog('library', '重命名库为「' + name + '」')
    save()
    return db
  }),

  deleteLibrary: (id: string) => sleep().then(() => {
    guard()
    let idx = -1
    for (let i = 0; i < db.libraries.length; i++) if (db.libraries[i].id === id) idx = i
    if (idx < 0) throw new Error('库不存在')
    const snap = { lib: db.libraries[idx], index: idx }
    db.libraries.splice(idx, 1)
    pushLog('library', '删除库「' + snap.lib.name + '」')
    save()
    return snap
  }),

  restoreLibrary: (snap: { lib: Library; index: number }) => sleep().then(() => {
    db.libraries.splice(Math.min(snap.index, db.libraries.length), 0, snap.lib)
    save()
    return db
  }),

  moveLibrary: (id: string, dir: number) => sleep().then(() => {
    guard()
    let idx = -1
    for (let i = 0; i < db.libraries.length; i++) if (db.libraries[i].id === id) idx = i
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= db.libraries.length) throw new Error('无法移动')
    const t = db.libraries[idx]
    db.libraries[idx] = db.libraries[to]
    db.libraries[to] = t
    pushLog('library', '调整库排序')
    save()
    return db
  }),

  /* ===== 物品（F2.2） ===== */
  addItem: (libId: string, data: Record<string, any>) => sleep().then(() => {
    guard()
    const lib = findLib(libId)
    if (!lib) throw new Error('库不存在')
    const expDays = parseInt(data.expDays, 10) || 7
    const kbKey = (Object.keys(KB.foods).filter((k) => (KB.foods as any)[k].name === data.name)[0]) || ''
    const item: Item = {
      id: nid('it'), no: nextNo(), name: data.name, emoji: data.emoji || '📦', img: data.img || '', kbKey,
      qty: parseFloat(data.qty) || 1, unit: data.unit || '个', price: parseFloat(data.price) || 0, priceSrc: data.priceSrc || '手动',
      expDays, pos: data.pos || '未设置', lowAt: (KB.foods[kbKey] || {}).lowAt || 0,
      addedAt: new Date().getDate(), private: !!data.private
    }
    lib.items.push(item)
    recordDomainEvent('item.created', item.id, null, { item: JSON.parse(JSON.stringify(item)), libId: lib.id })
    recount(lib)
    pushLog('item', '添加物品「' + data.name + '」到「' + lib.name + '」', { kind: 'intake', n: 1, day: todayStr() })
    save()
    return db
  }),

  updateItem: (libId: string, itemId: string, patch: Record<string, any>) => sleep().then(() => {
    guard()
    const lib = findLib(libId)
    if (!lib) throw new Error('库不存在')
    if (lib.coopAddOnly) throw new Error('合作复制库只能添加，不能修改')
    const it = lib.items.filter((x) => x.id === itemId)[0]
    if (!it) throw new Error('物品不存在')
    Object.keys(patch).forEach((k) => {
      if (k === 'qty') it.qty = Math.max(0, parseFloat(patch[k]) || 0)
      else if (k === 'price') it.price = parseFloat(patch[k]) || 0
      else if (k === 'expDays') it.expDays = parseInt(patch[k], 10) || 7
      else (it as any)[k] = patch[k]
    })
    pushLog('item', '编辑物品「' + it.name + '」')
    save()
    return db
  }),

  deleteItem: (libId: string, itemId: string) => sleep().then(() => {
    guard()
    const lib = findLib(libId)
    if (!lib) throw new Error('库不存在')
    if (lib.coopAddOnly) throw new Error('合作复制库只能添加，不能删除')
    let idx = -1
    for (let i = 0; i < lib.items.length; i++) if (lib.items[i].id === itemId) idx = i
    if (idx < 0) throw new Error('物品不存在')
    const snap = { lib, item: lib.items[idx], index: idx }
    lib.items.splice(idx, 1)
    recordDomainEvent('item.deleted', itemId, {
      item: JSON.parse(JSON.stringify(snap.item)),
      libId: lib.id,
      index: snap.index
    }, null)
    recount(lib)
    pushLog('item', '删除物品「' + snap.item.name + '」')
    save()
    return snap
  }),

  moveItem: (itemId: string, targetLibId: string) => sleep().then(() => {
    guard()
    const hit = findItem(itemId)
    const target = findLib(targetLibId)
    if (!hit || !target) throw new Error('物品或目标库不存在')
    if (hit.lib.id === target.id) return db
    const sourceLibId = hit.lib.id
    hit.lib.items = hit.lib.items.filter((it) => it.id !== itemId)
    target.items.push(hit.item)
    recordDomainEvent('item.moved', itemId, { libId: sourceLibId }, { libId: target.id })
    recount(hit.lib)
    recount(target)
    pushLog('item', '移动「' + hit.item.name + '」到「' + target.name + '」')
    save()
    return db
  }),

  restoreItem: (snap: { lib: Library; item: Item; index: number }) => sleep().then(() => {
    snap.lib.items.splice(Math.min(snap.index, snap.lib.items.length), 0, snap.item)
    recount(snap.lib)
    save()
    return db
  }),

  /* ===== 方案（F3.1/F3.8） ===== */
  generatePlans: () => {
    const t0 = Date.now()
    return sleep().then(() => {
      const stock: Record<string, Item> = {}
      db.libraries.forEach((l) => (l.items || []).forEach((it) => { if (it.kbKey) stock[it.kbKey] = it; stock[it.name] = it }))
      const dis = profileDislikes()
      const scored = (KB.recipes as any[])
        .filter((rc) => !dis.length || !rc.ing.some((g: string[]) => dis.indexOf(g[0]) > -1 || dis.indexOf(g[2]) > -1))
        .map((rc) => {
          const used: { name: string; qty: string; kbKey: string; item: Item }[] = []
          const missing: { name: string; qty: string }[] = []
          rc.ing.forEach((g: string[]) => {
            const it = stock[g[2]] || stock[g[0]]
            if (it) used.push({ name: g[0], qty: g[1], kbKey: g[2], item: it })
            else missing.push({ name: g[0], qty: g[1] })
          })
          const expN = used.filter((u) => u.item.expiring).length
          const full = missing.length === 0
          const reason = expN > 0 ? '临期优先' : full ? '清库存' : '营养均衡'
          const score = expN * 100 + used.length * 10 - missing.length * 5 + (full ? 20 : 0)
          return { rc, used, missing, expN, full, reason, score }
        })
      scored.sort((a: any, b: any) => b.score - a.score)
      db.meta = db.meta || {}
      const plans: Plan[] = scored.slice(0, 3).map((s: any) => ({
        id: (db.meta!.planSeq = (db.meta!.planSeq || 0) + 1),
        title: s.rc.title, priority: s.expN > 0 ? '高' : '中', reason: s.reason, time: s.rc.time,
        source: '知识库 · recipes', kcal: s.rc.kcal, prot: s.rc.prot,
        used: s.used.map((u: any) => ({ name: u.name, qty: u.qty })),
        missing: s.missing, status: 'pending',
        selected: s.used.map((u: any) => u.name)
      }))
      if (!plans.length) plans.push({ id: ++db.meta.planSeq, title: '库存快速整理', priority: '中', reason: '清点建议', time: '5 分钟', source: '知识库', kcal: 0, prot: 0, used: [], missing: [], status: 'pending', selected: [] })
      db.plans = db.plans.concat(plans)
      if (db.plans.length > 12) db.plans = db.plans.slice(-12)
      aiLog('/api/ai/chat', db.config.model, Date.now() - t0 + 600)
      pushLog('plan', '生成 ' + plans.length + ' 个方案（临期优先 > 清库存 > 营养均衡）')
      save()
      return plans
    })
  },

  /* P0-3 AI 创新菜谱 */
  creativeRecipe: () => {
    const t0 = Date.now()
    return sleep().then(() => {
      db.meta = db.meta || {}
      const dis = profileDislikes()
      const pool: Item[] = []
      db.libraries.forEach((l) => (l.items || []).forEach((it) => {
        if (it.expiring && it.expDays < 9000 && !(dis.length && (dis.indexOf(it.name) > -1 || dis.indexOf(it.kbKey || '') > -1))) pool.push(it)
      }))
      pool.sort((a, b) => a.expDays - b.expDays)
      const picks = pool.slice(0, 2)
      const styles = ['一锅烩', '煎烤拼盘', '能量碗', '快手煲']
      const style = styles[pool.length % styles.length]
      const name = picks.length ? picks.map((p) => p.name).join('') + style : '临期清空碗'
      const used = picks.map((p) => ({ name: p.name, qty: p.qty + ' ' + p.unit }))
      if (!used.length) used.push({ name: '任意库存食材', qty: '适量' })
      const kcal = 150 + used.length * 120, prot = 8 + used.length * 6
      const plan: Plan = {
        id: (db.meta.planSeq = (db.meta.planSeq || 0) + 1), title: name, priority: '高', reason: '临期优先 · AI 创新菜谱',
        time: (10 + used.length * 5) + ' 分钟', source: 'AI 创新菜谱（P0-3）', kcal, prot,
        used, missing: [], status: 'pending', selected: used.map((u) => u.name), creative: true
      }
      db.plans.push(plan)
      aiLog('/api/ai/chat', db.config.model, Date.now() - t0 + 500)
      pushLog('plan', '生成创新菜谱「' + name + '」（优先消耗临期）')
      save()
      return plan
    })
  },

  executePlan: (id: number, selected?: string[]) => sleep().then(() => {
    guard()
    const p = db.plans.filter((x) => x.id === id)[0]
    if (!p || p.status === 'done') throw new Error('方案不可执行')
    const snap: { id: string; name: string; before: number; after: number }[] = []
    p.used.forEach((u) => {
      if (selected && selected.indexOf(u.name) === -1) return
      const hit = findItem(u.name)
      if (!hit) return
      const amount = parseFloat(u.qty) || 1
      const before = hit.item.qty
      applyQtyChange(hit, -amount, '方案执行「' + p.title + '」')
      snap.push({ id: hit.item.id, name: hit.item.name, before, after: hit.item.qty })
    })
    p.status = 'done'
    p.snapshot = snap
    recordDomainEvent('plan.executed', String(p.id), { status: 'pending' }, {
      status: 'done',
      snapshots: JSON.parse(JSON.stringify(snap))
    })
    pushLog('plan', '执行方案「' + p.title + '」，扣减 ' + snap.length + ' 项')
    save()
    return db
  }),

  rollbackPlan: (id: number) => sleep().then(() => {
    guard()
    const p = db.plans.filter((x) => x.id === id)[0]
    if (!p || !p.snapshot) throw new Error('无可撤销记录')
    p.snapshot.forEach((s) => {
      const hit = findItem(s.id)
      if (hit) hit.item.qty = s.before
    })
    p.status = 'pending'
    delete p.snapshot
    recordDomainEvent('plan.reverted', String(p.id), { status: 'done' }, { status: 'pending' })
    pushLog('plan', '撤销方案「' + p.title + '」，库存已回滚')
    save()
    return db
  }),

  /* ===== 预警 ===== */
  resolveAlert: (id: string) => sleep().then(() => {
    const a = db.alerts.filter((x) => x.id === id)[0]
    db.alerts = db.alerts.filter((x) => x.id !== id)
    if (a) pushLog('alert', '处理预警：' + a.text)
    save()
    return db
  }),

  /* ===== 采购清单（F3.6） ===== */
  shoppingList: () => sleep().then(() => {
    const list: ShoppingItem[] = []
    const seen: Record<string, number> = {}
    db.plans.forEach((p) => {
      if (p.status === 'done') return
      ;(p.missing || []).forEach((m) => {
        const key = m.name
        if (seen[key]) return
        seen[key] = 1
        list.push({ name: m.name, qty: m.qty, src: '「' + p.title + '」缺料' })
      })
    })
    db.libraries.forEach((lib) => {
      ;(lib.items || []).forEach((it) => {
        if ((it.lowAt || 0) > 0 && it.qty <= it.lowAt && !seen[it.name]) {
          seen[it.name] = 1
          list.push({ name: it.name, qty: '补到 ' + Math.max(it.lowAt * 2, it.lowAt + 2) + ' ' + it.unit, src: '低库存提醒（D4）' })
        }
      })
    })
    db.shopping = list
    save()
    return db.shopping
  }),

  /* P0-2 shopping_add：AI 对话加入采购清单 */
  shoppingAdd: (name: string, qty: string) => sleep().then(() => {
    guard()
    const hit = db.shopping.find((s) => s.name === name)
    if (hit) {
      const beforeQty = hit.qty
      hit.qty = qty || hit.qty
      recordDomainEvent('shopping.added', name, { qty: beforeQty }, { qty: hit.qty })
      pushLog('shopping', '采购清单已有「' + name + '」，合并数量')
      save()
      return db.shopping
    }
    db.shopping.unshift({ name, qty: qty || '1', src: 'AI 对话添加（shopping_add）' })
    recordDomainEvent('shopping.added', name, null, { qty: qty || '1' })
    pushLog('shopping', '加入采购清单：' + name + ' × ' + qty)
    save()
    return db.shopping
  }),

  /* ===== 同步（本地模拟） ===== */
  _cloud: () => {
    try { return JSON.parse(Taro.getStorageSync(LS_CLOUD)) || { version: 1, updatedAt: null, payload: null } }
    catch (e) { return { version: 1, updatedAt: null, payload: null } }
  },
  /* 活同步 / 跨设备流转：给自建后端用（真实网络），不经过本机云端模拟 */
  snapshotPayload: (): Record<string, any> => ({
    libraries: JSON.parse(JSON.stringify(db.libraries || [])),
    plans: JSON.parse(JSON.stringify(db.plans || [])),
    shopping: JSON.parse(JSON.stringify(db.shopping || [])),
    alerts: JSON.parse(JSON.stringify(db.alerts || [])),
    daily: JSON.parse(JSON.stringify(db.daily || [])),
    logs: JSON.parse(JSON.stringify((db.logs || []).slice(0, 50)))
  }),
  applyPayload: (p: Record<string, any>) => {
    if (!p) return db
    applyingRemote = true
    if (p.libraries) db.libraries = p.libraries
    if (p.plans) db.plans = p.plans
    if (p.shopping) db.shopping = p.shopping
    if (p.daily) db.daily = p.daily
    if (p.logs) db.logs = p.logs
    save()
    applyingRemote = false
    return db
  },
  applyRemoteSnapshot: (p: Record<string, any>, v: number) => {
    if (!p) return db
    applyingRemote = true
    if (p.libraries) db.libraries = p.libraries
    if (p.plans) db.plans = p.plans
    if (p.shopping) db.shopping = p.shopping
    if (p.daily) db.daily = p.daily
    if (p.logs) db.logs = p.logs
    if (p.alerts) db.alerts = p.alerts
    db.syncVersion = Number(v) || db.syncVersion || 1
    db.libraries.forEach(recount)
    computeAlerts()
    computeDaily()
    try { Taro.setStorageSync(LS_KEY, JSON.stringify(db)) } catch (e) { /* ignore */ }
    applyingRemote = false
    return db
  },
  localVersion: (): number => db.syncVersion || 1,
  setLocalVersion: (v: number): number => {
    db.syncVersion = Number(v) || 1
    save()
    return db.syncVersion
  },
  journalTimeline: (limit = 50) => eventTimeline(limit),
  sealJournal: () => sealPendingEvents(),
  undoJournalEvent: (eventId: string) => sleep().then(() => {
    guard()
    const event = eventById(eventId)
    if (!event) throw new Error('审计事件不存在')

    if (event.type === 'item.qty_changed') {
      const before = Number((event.before || {}).qty)
      const hit = findItem(event.targetId)
      if (!hit || !Number.isFinite(before)) throw new Error('无法恢复该数量变更')
      const current = hit.item.qty
      createCompensation(event.id, db.user?.phone || db.user?.name || 'local-user')
      hit.item.qty = before
      pushLog('undo', '撤销审计事件：「' + hit.item.name + '」数量 ' + current + ' → ' + before)
      save()
      return db
    }

    if (event.type === 'item.deleted') {
      const data = event.before || {}
      const lib = findLib(String(data.libId || ''))
      const item = data.item as Item | undefined
      if (!lib || !item) throw new Error('无法恢复已删除物品')
      createCompensation(event.id, db.user?.phone || db.user?.name || 'local-user')
      lib.items.splice(Math.min(Number(data.index) || lib.items.length, lib.items.length), 0, item)
      recount(lib)
      pushLog('undo', '从审计事件恢复物品「' + item.name + '」')
      save()
      return db
    }

    if (event.type === 'plan.executed') {
      const after = event.after || {}
      const snapshots = (after.snapshots || []) as { id: string; before: number }[]
      createCompensation(event.id, db.user?.phone || db.user?.name || 'local-user')
      snapshots.forEach((snapshot) => {
        const hit = findItem(snapshot.id)
        if (hit) hit.item.qty = snapshot.before
      })
      const plan = db.plans.filter((row) => String(row.id) === event.targetId)[0]
      if (plan) {
        plan.status = 'pending'
        delete plan.snapshot
      }
      pushLog('undo', '从审计事件撤销方案执行')
      save()
      return db
    }

    throw new Error('该事件类型暂不支持单条撤销')
  }),
  syncStatus: (): Promise<SyncStatus> => sleep().then(() => {
    const c = api._cloud()
    return { local: db.syncVersion || 1, version: c.version, updatedAt: c.updatedAt }
  }),
  syncUpload: (force?: boolean) => sleep().then(() => {
    guard()
    const c = api._cloud()
    const local = db.syncVersion || 1
    if (c.version > local && !force) {
      const err: any = new Error('云端版本较新')
      err.status = 409
      err.version = c.version
      err.updatedAt = c.updatedAt
      throw err
    }
    c.version = Math.max(c.version, local) + 1
    c.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
    c.payload = JSON.stringify({ libraries: db.libraries, plans: db.plans, shopping: db.shopping })
    db.syncVersion = c.version
    Taro.setStorageSync(LS_CLOUD, JSON.stringify(c))
    pushLog('sync', '上传全量快照 → v' + c.version + (force ? '（强制覆盖）' : ''))
    save()
    return { version: c.version }
  }),
  syncDownload: () => sleep().then(() => {
    const c = api._cloud()
    if (!c.payload || c.version <= (db.syncVersion || 1)) throw new Error('云端无更新')
    const payload = JSON.parse(c.payload)
    if (payload.libraries) db.libraries = payload.libraries
    if (payload.plans) db.plans = payload.plans
    if (payload.shopping) db.shopping = payload.shopping
    db.syncVersion = c.version
    pushLog('sync', '拉取云端快照 v' + c.version + '，本地已覆盖')
    save()
    return { version: c.version }
  }),
  syncSimulateRemote: () => sleep().then(() => {
    const c = api._cloud()
    const payload: any = { libraries: JSON.parse(JSON.stringify(db.libraries)), plans: db.plans, shopping: db.shopping }
    payload.libraries[0].items.push({
      id: nid('it'), no: nextNo(), name: '云上酸奶', emoji: '🥤', kbKey: 'yogurt', qty: 2, unit: '杯', price: 9.9,
      priceSrc: '手动', expDays: 14, pos: '冷藏区上层', lowAt: 1, addedAt: new Date().getDate(), private: false
    })
    recount(payload.libraries[0])
    c.version = (db.syncVersion || 1) + 1
    c.updatedAt = new Date().toLocaleString('zh-CN', { hour12: false })
    c.payload = JSON.stringify(payload)
    Taro.setStorageSync(LS_CLOUD, JSON.stringify(c))
    pushLog('sync', '模拟另一设备上传 → 云端 v' + c.version)
    save()
    return c.version
  }),

  /* ===== 协作（F9） ===== */
  setDeck: (ids: string[]) => sleep().then(() => {
    db.workbench.myDeck = (ids || []).filter((id) => db.libraries.some((l) => l.id === id)).slice(0, 4)
    pushLog('coop', '更换手牌为 ' + db.workbench.myDeck.length + ' 张')
    save()
    return db
  }),
  runWorkbench: () => sleep().then(() => {
    guard()
    const a = findItem('鸡蛋'), b = findItem('番茄')
    const snap: { name: string; before: number; after: number }[] = []
    if (a) { const r1 = applyQtyChange(a, -4, '工作台「番茄蛋包饭」A 家归属'); snap.push({ name: a.item.name, before: r1.before, after: r1.after }) }
    if (b) { const r2 = applyQtyChange(b, -2, '工作台「番茄蛋包饭」B 家归属'); snap.push({ name: b.item.name, before: r2.before, after: r2.after }) }
    pushLog('workbench', '执行「番茄蛋包饭」，按归属扣减（F9.7）')
    save()
    return { snap }
  }),

  /* ===== 邀请码（F9.3） ===== */
  inviteGenerate: (days?: number, max?: number) => sleep().then(() => {
    guard()
    const code = 'TZ-' + String(1000 + Math.floor(Math.random() * 9000))
    db.invite = { code, familyId: db.familyId, expiresInDays: days || 7, used: 0, max: max || 3, revoked: false, createdAt: Date.now() }
    db.workbench.code = code
    pushLog('invite', '生成邀请码 ' + code + '（有效期 ' + (days || 7) + ' 天，限 ' + (max || 3) + ' 人）')
    save()
    return db.invite
  }),
  inviteRevoke: () => sleep().then(() => {
    guard()
    db.invite.revoked = true
    pushLog('invite', '撤销邀请码 ' + db.invite.code)
    save()
    return db.invite
  }),
  setInvite: (code: string, familyId: string) => {
    db.invite = {
      code,
      familyId,
      expiresInDays: 7,
      used: 0,
      max: 3,
      revoked: !code,
      createdAt: Date.now()
    }
    save()
    return db.invite
  },

  /* ===== 成员管理（F9.2） ===== */
  memberRemove: (phone: string) => sleep().then(() => {
    guard()
    if (phone === (db.user && db.user.phone)) throw new Error('不能移除自己')
    const list = db.members[db.familyId] || []
    const m = list.filter((x) => x.phone === phone)[0]
    if (!m) throw new Error('成员不存在')
    if (m.role === '管理员') throw new Error('不能移除家庭管理员')
    db.members[db.familyId] = list.filter((x) => x.phone !== phone)
    if (db.family) db.family.memberCount = db.members[db.familyId].length
    pushLog('member', '移除成员 ' + m.name + '（' + phone + '）')
    save()
    return db.members[db.familyId]
  }),

  /* ===== 对话（P0-5：≤200 条） ===== */
  chatPush: (msg: ChatMsg) => {
    db.chat.push(msg)
    if (db.chat.length > 200) db.chat = db.chat.slice(-200)
    save()
  },
  touchChat: () => save(),
  chatClear: () => sleep().then(() => {
    db.chat = []
    save()
    return db
  }),

  /* ===== 搜索（F2.4） ===== */
  search: (q: string) => {
    const raw = (q || '').trim().toLowerCase()
    // 自然语言位置查询："鸡蛋放哪了" → 提取关键词 "鸡蛋"
    let query = raw
    if (/放哪|在哪里|在哪儿|在哪|哪里|哪儿/.test(query)) {
      const m = query.replace(/[呢了呀，。！？\s]*?(放哪|在哪里|在哪儿|在哪|哪里|哪儿).*$/g, '').trim()
      if (m) query = m
    }
    const items: any[] = []
    db.libraries.forEach((lib) => {
      ;(lib.items || []).forEach((it) => {
        if (query && (it.name.toLowerCase().indexOf(query) > -1 || (it.pos || '').toLowerCase().indexOf(query) > -1)) {
          items.push({ name: it.name, emoji: it.emoji, img: it.img, lib: lib.name, libId: lib.id, pos: it.pos, qty: it.qty, unit: it.unit, expDays: it.expDays, price: it.price, priceSrc: it.priceSrc, kbKey: it.kbKey, id: it.id })
        }
      })
    })
    const libs = query ? db.libraries.filter((l) => l.name.toLowerCase().indexOf(query) > -1) : []
    let ans: any = null
    if (raw && /放哪|哪里|哪儿|在哪/.test(raw) && items.length) {
      const t0 = items[0]
      ans = {
        type: 'loc',
        title: `${t0.name}在「${t0.lib}」· ${t0.pos}`,
        sub: `当前 ${t0.qty} ${t0.unit}` + (t0.expDays && t0.expDays < 9000 ? `，还有 ${t0.expDays} 天到期` : '') + '。数值来自本地库存查询（AI 红线 1）。',
        item: t0
      }
    } else if (raw && items.length) {
      ans = { type: 'found', title: `找到 ${items.length} 条相关物品`, sub: '结果按名称与位置匹配，可继续问「XX 放哪了」获取定位与临期信息。' }
    } else if (raw) {
      ans = { type: 'none', title: `没有找到「${raw}」`, sub: '试试拍照入库，或换个关键词。' }
    }
    return Promise.resolve({ items, libs, ans })
  },

  /* ===== 设置 ===== */
  setTheme: (theme: string) => sleep().then(() => { db.theme = theme; save(); return db }),
  setSetting: (key: keyof DB['settings'], val: any) => sleep().then(() => {
    ;(db.settings as any)[key] = val
    save()
    return db
  }),
  setBudget: (n: number) => sleep().then(() => {
    guard()
    db.budget = Math.max(0, parseFloat(String(n)) || 0)
    pushLog('setting', '月度预算调整为 ¥' + db.budget + '（D6）')
    save()
    return db.budget
  }),
  setProfile: (p: Partial<Profile>) => sleep().then(() => {
    db.profile = Object.assign(db.profile || {}, p)
    save()
    return db.profile
  }),
  toggleDaily: (id: number) => sleep().then(() => {
    const t = db.daily.filter((x) => x.id === id)[0]
    if (t) t.done = !t.done
    save()
    return db
  }),

  /* ===== 管理员端（F10 子集） ===== */
  logAiUsage: (route: string, ms: number, model?: string) => { aiLog(route, model, ms) }
}
