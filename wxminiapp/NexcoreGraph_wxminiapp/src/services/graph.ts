// 启核图策 · 个人资源知识图谱（小程序端，方案第 3/5 章契约落地）
// - 构图全流程 0 次模型调用：实例层（库/物品/方案/采购/预警/日志）+ 概念层（食材/菜谱/规则/类别）
// - 图 JSON 契约 schema 1 与 Web 端一致：{version, builtAt, kbVersion, nodes, edges, communities, summaries, index}
// - 存 Taro Storage（nexcore_graph_v1，压缩预算 ≤400KB）；检索预算：≤3 跳、路径 ≤5、证据行 ≤12
import Taro from '@tarojs/taro'
import { db } from '@/services/api'
import { KB } from '@/data/knowledge'
import type { GraphDoc, GraphNode, GraphEdge, Community, Summary } from '@/services/graphQuery'

const LS_KEY = 'nexcore_graph_v1'
const SCHEMA = 1
const MAX_NODES = 700 // 实例 ≤500 + 概念 ≤200（契约硬约束）
const MAX_EDGES = 3000

let doc: GraphDoc | null = null // 内存缓存

/* ---------- 类别与场景（确定性映射，0 次模型） ---------- */
const FOOD_CAT: Record<string, string> = {
  egg: '蛋奶', milk: '蛋奶', yogurt: '蛋奶',
  tofu: '蔬菜', tomato: '蔬菜', greens: '蔬菜', bokchoy: '蔬菜', cucumber: '蔬菜', mushroom: '蔬菜', leftover: '熟食',
  banana: '水果', apple: '水果',
  pork: '肉禽', chicken: '肉禽', fish: '肉禽', shrimp: '肉禽',
  rice: '主食调味', noodle: '主食调味', oat: '主食调味', bread: '主食调味', soyOil: '主食调味', soySauce: '主食调味'
}
const LIB_SCENE: Record<string, string> = {
  fridge: '食材', medicine: '药品', wardrobe: '衣物', tools: '家电工具',
  fitness: '运动器材', books: '图书', pet: '宠物', appliances: '家电工具'
}
function sceneOfLib(lib: { id: string }): string {
  return LIB_SCENE[lib.id] || '其他'
}
function catOfLib(lib: { id: string }): string {
  return ({ medicine: '药品', wardrobe: '衣物', tools: '工具', fitness: '运动', books: '图书', pet: '宠物', appliances: '家电' } as Record<string, string>)[lib.id] || '杂物'
}

/* 口语别名 → kbKey（与 ai.ts 归一口径一致） */
let NAME_TO_KB: Record<string, string> = {}
const ALIASES: Record<string, string> = { '西红柿': 'tomato', '青菜': 'greens', '牛奶': 'milk', '土豆': 'potato', '酱油': 'soySauce', '小白菜': 'bokchoy', '剩菜': 'leftover', '生抽': 'soySauce' }

function buildNameIndex() {
  NAME_TO_KB = {}
  const foods = KB.foods
  Object.keys(foods).forEach((k) => {
    const base = foods[k].name.replace(/（.*?）/, '').split('（')[0]
    NAME_TO_KB[base] = k
    if (base.length > 2) NAME_TO_KB[base.slice(0, 2)] = NAME_TO_KB[base.slice(0, 2)] || k
  })
  Object.keys(ALIASES).forEach((a) => { NAME_TO_KB[a] = ALIASES[a] })
}

/** 实例名 → 概念（kbKey 精确 → 别名 → 未命中挂「未归类」） */
function resolveFood(item: { kbKey?: string; name: string }): { key: string; confidence: string } | null {
  if (item.kbKey && KB.foods[item.kbKey]) return { key: item.kbKey, confidence: 'exact' }
  const k = NAME_TO_KB[item.name]
  if (k) return { key: k, confidence: 'alias' }
  return null
}

/* ---------- 版本（graphVersion = hash(数据 + kbVersion)） ---------- */
export function hashOf(d: typeof db): string {
  const parts: string[] = []
  d.libraries.forEach((l) => {
    parts.push(l.id + ':' + (l.items || []).map((it) => it.name + ',' + it.qty + ',' + (it.expDays == null ? '' : it.expDays) + ',' + (it.private ? 1 : 0)).join('|'))
  })
  parts.push('plans:' + d.plans.map((p) => p.title + ',' + p.status).join('|'))
  parts.push('shop:' + (d.shopping || []).map((s) => s.name).join('|'))
  parts.push('alerts:' + (d.alerts || []).length)
  parts.push('logs:' + (d.logs || []).length + ':' + ((d.logs || [])[0] || { ts: 0 }).ts)
  parts.push('kb:' + KB.version)
  const s = parts.join(';;')
  let h = 5381
  for (let i = 0; i < s.length; i++) { h = ((h << 5) + h + s.charCodeAt(i)) >>> 0 }
  return 'gv-' + h.toString(36)
}

export interface BuildStat {
  nodes: number
  edges: number
  communities: number
  ms: number
  version: string
}

/* ---------- 全量构图（幂等，0 次模型） ---------- */
export function build(): BuildStat {
  const t0 = Date.now()
  const d = db
  buildNameIndex()
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const byIdMap: Record<string, GraphNode> = {}
  function addNode(n: GraphNode) {
    if (nodes.length < MAX_NODES && !byIdMap[n.id]) { byIdMap[n.id] = n; nodes.push(n) }
  }
  function addEdge(from: string, to: string, type: string, props?: Record<string, any>) {
    if (edges.length >= MAX_EDGES || !byIdMap[from] || !byIdMap[to]) return
    edges.push({ id: 'e' + edges.length, from, to, type, props })
  }

  /* ① 组织层 */
  const fid = 'family:' + (d.familyId || 'home')
  addNode({ id: fid, type: 'Family', label: d.family ? d.family.name : '我的家', props: { memberCount: d.family ? d.family.memberCount : 1 }, community: [] })
  d.libraries.forEach((l) => {
    addNode({ id: 'lib:' + l.id, type: 'Library', label: l.name, props: { icon: l.icon, tone: l.tone, count: (l.items || []).length }, community: ['lib:' + l.id, 'scene:' + sceneOfLib(l)] })
  })

  /* ② 概念层：食材 / 菜谱 / 规则 / 类别 */
  const foods = KB.foods
  Object.keys(foods).forEach((k) => {
    const f = foods[k]
    addNode({
      id: 'food:' + k, type: 'FoodConcept', label: f.name.replace(/（.*?）/, '').split('（')[0],
      props: { key: k, category: FOOD_CAT[k] || '其他', fridgeDays: f.days, openedDays: f.open || -1, lowAt: f.lowAt, tip: f.tip, src: f.src, url: f.url || '' },
      community: ['cat:' + (FOOD_CAT[k] || '其他'), 'scene:食材']
    })
  })
  const recipes = KB.recipes || []
  recipes.forEach((r) => {
    addNode({ id: 'recipe:' + r.title, type: 'RecipeConcept', label: r.title, props: { time: r.time, kcal: r.kcal, tags: (r.tags || []).join('/') }, community: ['scene:食材'] })
    ;(r.ing || []).forEach((g, gi) => {
      if (g[2] && foods[g[2]]) addEdge('food:' + g[2], 'recipe:' + r.title, 'usedBy', { qty: g[1], primary: gi === 0 })
    })
  })
  ;(KB.rules || []).forEach((r) => {
    addNode({ id: 'rule:' + r.id, type: 'RuleConcept', label: '规则·' + r.tag, props: { text: r.text, src: '食品安全通用规则' }, community: ['scene:食材'] })
    const text = r.text
    Object.keys(foods).forEach((k) => {
      const base = foods[k].name.replace(/（.*?）/, '').split('（')[0]
      if (base.length >= 2 && text.indexOf(base) > -1) addEdge('rule:' + r.id, 'food:' + k, 'protects', { keyword: base })
    })
    if (/药|眼药水/.test(text)) addEdge('rule:' + r.id, 'cat:药品', 'protects', { keyword: '药' })
  })
  const cats: Record<string, number> = {}
  nodes.forEach((n) => { if (n.type === 'FoodConcept') cats[n.props.category] = 1 })
  d.libraries.forEach((l) => { cats[catOfLib(l)] = 1 })
  cats['未归类'] = 1
  Object.keys(cats).forEach((c) => {
    addNode({ id: 'cat:' + c, type: 'CategoryConcept', label: c, props: {}, community: ['scene:食材'] })
  })

  /* ③ 实例层：物品 */
  d.libraries.forEach((l) => {
    ;(l.items || []).forEach((it) => {
      const food = resolveFood(it)
      const cat = food ? (FOOD_CAT[food.key] || '其他') : catOfLib(l)
      const nid = 'item:' + it.id
      addNode({
        id: nid, type: 'ItemInstance', label: it.name,
        props: {
          libId: l.id, no: it.no || '', qty: it.qty, unit: it.unit, expDays: it.expDays,
          pos: it.pos || '', price: it.price || 0, priceSrc: it.priceSrc || '', isPrivate: !!it.private,
          med: !!it.med, lowAt: it.lowAt || 0, updatedAt: (it as any).updatedAt || null
        },
        community: ['lib:' + l.id, 'cat:' + cat, 'scene:' + sceneOfLib(l)]
      })
      addEdge('lib:' + l.id, nid, 'contains', {})
      if (it.pos) addEdge(nid, 'lib:' + l.id, 'locatedAt', { pos: it.pos })
      addEdge(nid, fid, 'belongsTo', {})
      if (food) {
        addEdge(nid, 'food:' + food.key, 'instantiates', { confidence: food.confidence })
        addEdge('food:' + food.key, 'cat:' + cat, 'inCategory', {})
      } else {
        addEdge(nid, 'cat:' + cat, 'inCategory', {})
      }
    })
  })

  /* ④ 方案 / 采购 / 预警 / 日志 */
  d.plans.forEach((p) => {
    const nid = 'plan:' + p.id
    addNode({ id: nid, type: 'Plan', label: p.title, props: { id: p.id, time: p.time || '', status: p.status || 'pending', kcal: p.kcal || 0, source: p.source || '' }, community: ['scene:食材'] })
    const rec = recipes.filter((r) => r.title === p.title)[0]
    if (rec) {
      addEdge(nid, 'recipe:' + rec.title, 'cooksTo', { aiGenerated: /AI/.test(p.source || '') })
      ;(rec.ing || []).forEach((g) => {
        if (!g[2]) return
        let hit: { it: typeof d.libraries[0]['items'][0] } | null = null
        d.libraries.forEach((l) => (l.items || []).forEach((it) => {
          if (!hit && (it.kbKey === g[2] || (resolveFood(it) || { key: '' }).key === g[2])) hit = { it }
        }))
        const h = hit as { it: { id: string; expDays: number } } | null
        if (h) addEdge(nid, 'item:' + h.it.id, 'consumes', { qty: g[1], wasExpiring: h.it.expDays != null && h.it.expDays <= 7 && h.it.expDays < 9000 })
        else addEdge(nid, 'food:' + g[2], 'needs', { qty: g[1] })
      })
    }
  })
  ;(d.shopping || []).forEach((s, i) => {
    const nid = 'shop:' + ((s as any).id || i)
    addNode({ id: nid, type: 'ShoppingItem', label: s.name, props: { qty: s.qty, source: s.src || '手动' }, community: ['scene:食材'] })
    const k = NAME_TO_KB[s.name]
    if (k) addEdge(nid, 'food:' + k, 'needs', { qty: s.qty })
  })
  ;(d.alerts || []).forEach((a) => {
    const m = /^(.*)-(exp0|med|c|s|w|low)$/.exec(a.id)
    const nid = 'alert:' + a.id
    addNode({ id: nid, type: 'Alert', label: a.text.slice(0, 12) + '…', props: { kind: a.type, tone: a.tone, text: a.text, at: a.meta || '' }, community: [] })
    if (m && byIdMap['item:' + m[1]]) addEdge('item:' + m[1], nid, 'triggers', { rule: a.type })
  })
  ;(d.logs || []).slice(0, 20).forEach((l, i) => {
    const nid = 'log:' + i
    addNode({ id: nid, type: 'LogEvent', label: (l.action || '').slice(0, 8), props: { action: l.action, detail: l.detail, at: l.at, day: l.day || '' }, community: [] })
    const k = NAME_TO_KB[l.name || '']
    if (k && byIdMap['food:' + k]) addEdge(nid, 'food:' + k, 'consumedBy', { delta: l.n || 0 })
  })

  /* ⑤ 社区（确定性三级：库 / 类别 / 场景）+ 统计（全部代码计算） */
  const communities = computeCommunities(nodes)

  /* ⑥ 摘要：版本一致且 24h 内的沿用，否则标 stale（不参与回答） */
  const version = hashOf(d)
  const oldSummaries: Summary[] = (doc && doc.summaries) || []
  const now = Date.now()
  const summaries: Summary[] = oldSummaries.map((s) => ({
    community: s.community, text: s.text, generatedAt: s.generatedAt,
    basedOnVersion: s.basedOnVersion, model: s.model,
    stale: s.basedOnVersion !== version || now - s.generatedAt > 86400000
  }))

  /* ⑦ 索引 */
  const index: GraphDoc['index'] = { byLabel: {}, byType: {} }
  nodes.forEach((n) => {
    ;(index.byLabel[n.label] = index.byLabel[n.label] || []).push(n.id)
    ;(index.byType[n.type] = index.byType[n.type] || []).push(n.id)
  })

  doc = {
    schema: SCHEMA, version, builtAt: now, kbVersion: String(KB.version),
    nodes, edges, communities, summaries, index
  }
  try { Taro.setStorageSync(LS_KEY, JSON.stringify(doc)) } catch (e) { /* 超容量时仅内存使用 */ }
  return { nodes: nodes.length, edges: edges.length, communities: communities.length, ms: Date.now() - t0, version }
}

/* 社区统计：节点数 / 临期数 / 金额 / 近 7 天消耗 / 健康度（0 次模型） */
function computeCommunities(nodes: GraphNode[]): Community[] {
  const out: Community[] = []
  const groups: Record<string, GraphNode[]> = {}
  nodes.forEach((n) => {
    ;(n.community || []).forEach((cid) => { (groups[cid] = groups[cid] || []).push(n) })
  })
  Object.keys(groups).forEach((cid) => {
    const members = groups[cid]
    const level = cid.indexOf('lib:') === 0 ? 1 : cid.indexOf('cat:') === 0 ? 2 : 3
    let items = 0
    let expiring = 0
    let value = 0
    let consume7d = 0
    members.forEach((n) => {
      if (n.type !== 'ItemInstance') return
      items++
      const p = n.props
      if (p.expDays != null && p.expDays <= 7 && p.expDays < 9000) expiring++
      value += p.price || 0
    })
    const libName = level === 1 ? members.filter((m) => m.type === 'Library').map((m) => m.label)[0] : null
    if (libName) {
      ;(db.logs || []).forEach((l) => {
        if (l.kind === 'consume' && Date.now() - (l.ts || 0) < 7 * 86400000 && (l.detail || '').indexOf(libName) > -1) consume7d += l.n || 0
      })
    }
    const health = items ? Math.max(40, 100 - Math.round((expiring / items) * 100)) : 100
    out.push({ id: cid, level, label: cid.split(':')[1] || cid, stats: { items, expiring, value: Math.round(value * 10) / 10, consume7d, health } })
  })
  out.sort((a, b) => a.level - b.level || a.id.localeCompare(b.id))
  return out
}

/* ---------- 读写入口 ---------- */
export function ensure(): GraphDoc {
  if (doc && doc.version === hashOf(db)) return doc
  try {
    const raw = Taro.getStorageSync(LS_KEY)
    if (raw) {
      const d: GraphDoc = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (d && d.version === hashOf(db)) { doc = d; return doc }
    }
  } catch (e) { /* 解析失败重建 */ }
  build()
  return doc!
}

export function version(): string {
  return ensure().version
}
export function snapshot(): GraphDoc {
  return ensure()
}
/** 增量事件（阶段 1 直接幂等重建） */
export function apply(): BuildStat {
  return build()
}

/** 社区摘要写回（由 graphRag 离线预计算后调用） */
export function putSummary(communityId: string, text: string, model: string) {
  ensure()
  if (!doc) return
  const s = doc.summaries.filter((x) => x.community === communityId)[0]
  if (s) {
    s.text = text; s.generatedAt = Date.now(); s.basedOnVersion = doc.version; s.model = model; s.stale = false
  } else {
    doc.summaries.push({ community: communityId, text, generatedAt: Date.now(), basedOnVersion: doc.version, model, stale: false })
  }
  try { Taro.setStorageSync(LS_KEY, JSON.stringify(doc)) } catch (e) { /* ignore */ }
}

/** 图谱统计快照（MX6 分享卡片 / 工作台摘要条用，数字全部代码计算） */
export function graphBrief(): { libs: number; items: number; expiringN: number; nodes: number; edges: number; communities: number } {
  const d = ensure()
  const items = d.nodes.filter((n) => n.type === 'ItemInstance')
  const exp = items.filter((n) => n.props.expDays != null && n.props.expDays <= 7 && n.props.expDays < 9000)
  return {
    libs: (d.index.byType.Library || []).length,
    items: items.length,
    expiringN: exp.length,
    nodes: d.nodes.length,
    edges: d.edges.length,
    communities: d.communities.length
  }
}

export const SCENES = LIB_SCENE
