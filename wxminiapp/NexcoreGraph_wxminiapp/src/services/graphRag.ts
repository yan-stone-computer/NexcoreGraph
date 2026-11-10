// 启核图策 · GraphRAG 证据装配（小程序端，方案第 4 章）
// - 模式判定（0 次模型）：fast / local / global / multi-hop / tool
// - ragEvidence()：证据行 ≤12、路径 ≤5、≤3 跳；数值 100% 来自图谱属性（红线 1）
// - ask()：Agnes 单次调用（措辞润色，不产出新数字）；失败自动降级本地回答
// - ensureSummaries()：社区摘要离线预计算（每社区 1 次、24h、限流 10 分钟 ≤3 次；stale 不参与回答）
// - MX7 内容安全：本地敏感词兜底（发送前 + 展示前），拦截即提示、绝不调用模型
import Taro from '@tarojs/taro'
import { db } from '@/services/api'
import { KB } from '@/data/knowledge'
import { chat } from '@/services/agnes'
import { resolveServerBase } from '@/services/agnes'
import { ensure, version, putSummary } from '@/services/graph'
import { matchEntity, multiHop, subgraph, aggregate, byId } from '@/services/graphQuery'
import type { GraphDoc, GraphNode, HopPath } from '@/services/graphQuery'
import { finishTrace, makeTrace } from '@/services/retrievalTrace'
import { saveTrace } from '@/services/traceStore'

const MAX_LINES = 12
const MAX_PATHS = 5
const SUMMARY_TTL = 86400000
const SUMMARY_RATE_KEY = 'nexcore_summary_rate_v1'
const SUMMARY_RATE_WINDOW = 600000
const SUMMARY_RATE_MAX = 3

/* ---------- MX7 内容安全：本地敏感词兜底（msgSecCheck 的离线兜底层） ---------- */
const BLOCKED_WORDS = ['赌博', '代开发票', '枪支', '毒品', '色情', '诈骗', '洗钱', '假证']

export function securityCheck(text: string): { ok: boolean; word?: string } {
  const t = text || ''
  for (const w of BLOCKED_WORDS) {
    if (t.indexOf(w) > -1) return { ok: false, word: w }
  }
  return { ok: true }
}

/** 微信内容安全（msgSecCheck）：经自建后端代理；未配置或调用失败时 fail-open，
 *  本地敏感词仍是前置兜底（不让合规配置缺失把正常提问挡死）。 */
export async function securityCheckRemote(text: string): Promise<{ pass: boolean; checked: boolean }> {
  try {
    const base = await resolveServerBase()
    const r: any = await new Promise((resolve, reject) => {
      Taro.request({
        url: base + '/api/security/check',
        method: 'POST',
        timeout: 8000,
        header: { 'Content-Type': 'application/json' },
        data: { text: String(text || '').slice(0, 500) },
        success: (res: Taro.request.SuccessCallbackResult & { data?: any }) => resolve(res.data || {}),
        fail: (e: { errMsg?: string }) => reject(new Error((e && e.errMsg) || 'security check failed'))
      } as Taro.request.Option)
    })
    return { pass: r.pass !== false, checked: r.checked === true }
  } catch (e) {
    return { pass: true, checked: false }
  }
}

/* ---------- 模式判定（代码规则，方案 4.2） ---------- */
export type RagMode = 'fast' | 'local' | 'global' | 'multi-hop' | 'tool'

export function detectMode(text: string): RagMode {
  const t = text || ''
  const d = ensure()
  const ent = matchEntity(d, t)
  const hasEntity = ent.items.length > 0 || ent.foods.length > 0
  const factWord = /放哪|在哪里|在哪|哪儿|还剩|剩多少|有多少|几个|几盒|几瓶|保质期|能放|多久|过期|变质/.test(t)
  const globalWord = /这周|本周|上周|最常|最该|整体|家里|全家|总结|简报|摘要|复盘|浪费|囤/.test(t)
  const multiCond = /临期|快过期|缺什么|一起买|减脂|增肌|控糖|几个人|\d\s*人/.test(t) && /做|吃|安排|晚餐|早餐|午餐|方案/.test(t)
  const writeWord = /只剩|还有|喝完|吃完|用完|没了|买了|加了|放入|补货|减少|吃掉|用了|想买|要买|加入采购/.test(t)

  if (writeWord) return 'tool'
  if (multiCond) return 'multi-hop'
  if (/做什么|吃什么|怎么安排|安排|晚餐|早餐|午餐/.test(t) && !factWord) return 'multi-hop'
  if (!hasEntity && globalWord) return 'global'
  if (hasEntity && !factWord && /能做|怎么吃|做什么|搭配|替代|做法|营养|热量/.test(t)) return 'local'
  if (hasEntity && factWord) return 'fast'
  if (globalWord) return 'global'
  if (hasEntity) return 'local'
  return 'global'
}

export interface RagPath {
  nodes: string[]
  edges: string[]
  facts: string[]
  src: string
}

export interface RagEvidence {
  mode: RagMode
  lines: string[]
  paths: RagPath[]
  stale: boolean
  version: string
  usedSummary?: number
  staleCount?: number
  seedLabel?: string
}

function itemFactLine(n: GraphNode): string {
  const p = n.props
  const lib = db.libraries.filter((l) => l.id === p.libId)[0]
  const libName = lib ? lib.name : ''
  return (libName ? libName + '·' : '') + (p.pos ? p.pos + '｜' : '') + n.label + ' ' + p.qty + p.unit +
    (p.expDays != null && p.expDays < 9000 ? '｜' + p.expDays + ' 天到期' : '')
}

function pathOf(doc: GraphDoc, nodeChain: string[], edgeChain: string[]): RagPath {
  const facts: string[] = []
  let src = ''
  nodeChain.forEach((id) => {
    const n = byId(doc, id)
    if (!n) return
    if (n.type === 'ItemInstance') facts.push(itemFactLine(n))
    if (n.type === 'FoodConcept') { facts.push(n.label + '（知识库 · ' + n.props.src + '）'); src = src || n.props.src }
    if (n.type === 'RecipeConcept') facts.push(n.label + ' ' + n.props.time + ' · 约 ' + n.props.kcal + ' kcal/份')
  })
  return { nodes: nodeChain, edges: edgeChain, facts, src: src || '本地图谱' }
}

/* ---------- 三种检索模式的证据装配 ---------- */

function localEvidence(doc: GraphDoc, question: string, ent: { items: GraphNode[]; foods: GraphNode[] }): RagEvidence {
  const seed = ent.items[0] || ent.foods[0]
  if (!seed) return globalEvidence(doc, question)
  const lines: string[] = []
  const paths: RagPath[] = []
  ent.items.forEach((it) => { if (lines.length < MAX_LINES) lines.push(itemFactLine(it)) })
  if (ent.items.length === 0 && ent.foods.length) {
    const f = ent.foods[0]
    lines.push(f.label + '（知识库 · ' + f.props.src + '）冷藏约 ' + f.props.fridgeDays + ' 天' + (f.props.openedDays > 0 ? '，开封后 ' + f.props.openedDays + ' 天' : ''))
  }
  const seedIds = ent.items.length ? ent.items : ent.foods
  const rawPaths: HopPath[] = multiHop(doc, seedIds, ['contains', 'locatedAt', 'instantiates', 'inCategory', 'usedBy'], 2)
  rawPaths.slice(0, MAX_PATHS).forEach((p) => {
    const full = pathOf(doc, [seedIds[0].id].concat(p.nodes), p.edges)
    if (full.facts.length) paths.push(full)
    full.facts.slice(0, 2).forEach((f) => { if (lines.length < MAX_LINES && lines.indexOf(f) < 0) lines.push(f) })
  })
  return { mode: 'local', seedLabel: seed.label, lines: lines.slice(0, MAX_LINES), paths, stale: false, version: version() }
}

function globalEvidence(doc: GraphDoc, question: string): RagEvidence {
  const t = question || ''
  const cands = doc.communities.filter((c) => c.level === 1)
  const hit = cands.filter((c) => t && t.indexOf(c.label) > -1)
  const top = (hit.length ? hit : cands.slice().sort((a, b) => b.stats.expiring - a.stats.expiring || b.stats.items - a.stats.items)).slice(0, 3)
  const lines: string[] = []
  const paths: RagPath[] = []
  let usedSummary = 0
  let staleN = 0
  top.forEach((c) => {
    const agg = aggregate(doc, c.id)
    if (!agg) return
    lines.push('社区「' + agg.label + '」：' + agg.stats.items + ' 件 · 临期 ' + agg.stats.expiring + ' 件 · 价值 ¥' + agg.stats.value + ' · 健康度 ' + agg.stats.health + '%')
    const s = doc.summaries.filter((x) => x.community === c.id)[0]
    if (s && !s.stale) {
      lines.push('社区洞察：' + s.text + '（摘要基于 ' + Math.max(1, Math.round((Date.now() - s.generatedAt) / 60000)) + ' 分钟前图谱）')
      usedSummary++
    } else if (s && s.stale) staleN++
    paths.push({ nodes: [c.id], edges: [], facts: [c.label + ' 社区统计由代码计算'], src: '图谱 aggregate()' })
  })
  const week = (db.logs || []).filter((l) => (l.ts || 0) >= Date.now() - 7 * 86400000)
  const byName: Record<string, number> = {}
  week.forEach((l) => { if (l.kind === 'consume' && l.name) byName[l.name] = (byName[l.name] || 0) + (l.n || 0) })
  const names = Object.keys(byName).sort((a, b) => byName[b] - byName[a])
  if (names.length && lines.length < MAX_LINES) lines.push('近 7 天最常消耗：' + names[0] + ' ×' + byName[names[0]])
  return { mode: 'global', lines: lines.slice(0, MAX_LINES), paths: paths.slice(0, MAX_PATHS), stale: false, usedSummary, staleCount: staleN, version: version() }
}

const RESOLVE_MAP: Record<string, string> = { '西红柿': 'tomato', '青菜': 'greens', '牛奶': 'milk', '土豆': 'potato', '酱油': 'soySauce' }

function multiHopEvidence(doc: GraphDoc, question: string): RagEvidence {
  const lines: string[] = []
  const paths: RagPath[] = []
  const sg = subgraph(doc, { expiringOnly: true })
  const expItems = sg.nodes.filter((n) => n.type === 'ItemInstance')
  const lowFat = /减脂|低卡|清淡/.test(question || '')
  expItems.slice(0, 4).forEach((it) => { if (lines.length < MAX_LINES) lines.push(itemFactLine(it)) })
  const seenRecipe: Record<string, number> = {}
  expItems.forEach((it) => {
    const p = multiHop(doc, [it], ['instantiates', 'usedBy'], 2)
    p.forEach((path) => {
      const recId = path.nodes[path.nodes.length - 1]
      const rec = byId(doc, recId)
      if (!rec || rec.type !== 'RecipeConcept' || seenRecipe[recId]) return
      if (lowFat && !/低脂|清淡|早餐/.test(rec.props.tags || '')) return
      seenRecipe[recId] = 1
      if (lines.length < MAX_LINES) lines.push(rec.label + '（' + rec.props.time + ' · ' + rec.props.kcal + ' kcal/份 · ' + (rec.props.tags || '') + '）')
      if (paths.length < MAX_PATHS) paths.push(pathOf(doc, [it.id].concat(path.nodes), path.edges))
    })
  })
  const stockKeys: Record<string, number> = {}
  db.libraries.forEach((l) => (l.items || []).forEach((it) => {
    if (it.kbKey) stockKeys[it.kbKey] = it.qty
    else { const r = RESOLVE_MAP[it.name]; if (r) stockKeys[r] = it.qty }
  }))
  Object.keys(seenRecipe).slice(0, 5).forEach((rid) => {
    const rec = (KB.recipes || []).filter((r) => 'recipe:' + r.title === rid)[0]
    if (!rec) return
    ;(rec.ing || []).forEach((g) => {
      if (g[2] && !stockKeys[g[2]] && lines.length < MAX_LINES) {
        const fname = (KB.foods[g[2]] || { name: g[0] }).name
        lines.push('缺 ' + fname + '（' + g[1] + '）→ 建议加入采购清单')
      }
    })
  })
  return { mode: 'multi-hop', lines: lines.slice(0, MAX_LINES), paths: paths.slice(0, MAX_PATHS), stale: false, version: version() }
}

export function ragEvidence(question: string): RagEvidence {
  const d = ensure()
  const mode = detectMode(question)
  if (mode === 'local') return localEvidence(d, question, matchEntity(d, question))
  if (mode === 'multi-hop') return multiHopEvidence(d, question)
  return globalEvidence(d, question)
}

/* ---------- Agnes 编排（单次调用 + 降级 + 展示前内容安全） ---------- */
export function systemPrompt(ev: RagEvidence): string {
  return [
    '你是「启核图策」家庭资源管家助手。请严格基于下面的图谱证据回答用户问题。',
    '硬性规则：1) 只能引用证据中出现过的数字与事实，禁止编造、估算或新增任何数字；',
    '2) 回答 ≤120 字，先给结论，再给 1 条可执行建议；',
    '3) 证据不足以回答时直说「图谱里暂无这部分信息」，并建议用户拍照入库；',
    '4) 涉及写操作（改数量/加采购）时提醒用户到对话里确认，不要声称已执行。'
  ].join('\n') + '\n\n图谱证据（mode=' + ev.mode + '，graphVersion=' + ev.version + '）：\n' +
    ev.lines.map((l, i) => i + 1 + '. ' + l).join('\n')
}

export interface AskResult {
  ok: boolean
  text: string
  mode: RagMode
  evidence: RagEvidence
  model: string
  ms: number
  degraded: boolean
  error?: string
  src: string
}

export function ask(question: string, fallbackText = ''): Promise<AskResult> {
  /* 发送前内容安全（MX7）：拦截即返回，绝不调用模型 */
  const guard = securityCheck(question)
  if (!guard.ok) {
    return Promise.resolve({
      ok: false, text: '', mode: 'tool', evidence: { mode: 'tool', lines: [], paths: [], stale: false, version: version() },
      model: '内容安全拦截', ms: 0, degraded: true,
      error: '包含敏感词「' + guard.word + '」，已拦截（MX7）',
      src: '本地拦截 · 0 次模型调用'
    })
  }
  const ev = ragEvidence(question)
  const trace = makeTrace(question, ev.mode)
  /* 双通道共用同一份「代码算好的证据」：自建网关按 intent+evidence 拼系统提示，厂商直连通道用 system。
     红线 1 不变——数字全部来自本地图谱查询。 */
  return chat({
    intent: 'graph-ask',
    question: question,
    evidence: '',
    system: systemPrompt(ev),
    graphEvidence: {
      mode: ev.mode,
      version: (ev as any).version || '',
      lines: ev.lines,
      paths: ev.paths || []
    },
    temperature: 0.3, maxTokens: 400
  }).then((r) => {
    /* 展示前内容安全：模型输出兜底校验一次 */
    const out = securityCheck(r.text)
    if (!out.ok) {
      saveTrace(finishTrace(trace, ev))
      return {
        ok: false, text: '模型输出未通过内容安全检查，已屏蔽（MX7）', mode: ev.mode, evidence: ev,
        model: '内容安全拦截', ms: r.ms, degraded: true,
        error: '输出含敏感词「' + out.word + '」', src: '本地拦截'
      }
    }
    saveTrace(finishTrace(trace, ev))
    return {
      ok: true, text: r.text, mode: ev.mode, evidence: ev,
      model: r.model, ms: r.ms, degraded: false,
      src: 'Agnes · ' + r.model + '（' + (r.via === 'direct' ? '厂商直连' : '自建网关') +
        '）+ GraphRAG（' + ev.mode + '）'
    }
  }).catch((err: Error) => {
    saveTrace(finishTrace(trace, ev))
    return {
      ok: false, text: fallbackText, mode: ev.mode, evidence: ev,
      model: '本地降级', ms: 0, degraded: true, error: err && err.message,
      src: '本地图谱事实（Agnes 不可用，已降级）· ' + ev.mode
    }
  })
}

/* ---------- 社区摘要离线预计算（方案 4.6，红线 3） ---------- */
function rateOK(): { ok: boolean; ts: number[] } {
  let ts: number[] = []
  try {
    const raw = Taro.getStorageSync(SUMMARY_RATE_KEY)
    if (raw) ts = (typeof raw === 'string' ? JSON.parse(raw) : raw) || []
  } catch (e) { /* ignore */ }
  const now = Date.now()
  ts = ts.filter((t) => now - t < SUMMARY_RATE_WINDOW)
  return { ok: ts.length < SUMMARY_RATE_MAX, ts }
}

export function ensureSummaries(force = false): Promise<Array<{ community: string; ok: boolean }>> {
  const d = ensure()
  const now = Date.now()
  const rate = rateOK()
  const jobs: Promise<{ community: string; ok: boolean }>[] = []
  d.communities.forEach((c) => {
    if (c.level !== 1) return
    const s = d.summaries.filter((x) => x.community === c.id)[0]
    const need = force || !s || s.stale || s.basedOnVersion !== d.version || now - s.generatedAt > SUMMARY_TTL
    if (!need) return
    if (!rate.ok) return // 限流：10 分钟 ≤3 次（全局串行）
    const agg = aggregate(d, c.id)
    if (!agg) return
    const prompt = '用不超过 80 字总结这个家庭资源社区的情况。只能使用以下数字，不得新增任何数字：' +
      agg.label + '社区共 ' + agg.stats.items + ' 件物品，其中临期 ' + agg.stats.expiring + ' 件，总价值 ¥' + agg.stats.value +
      '，健康度 ' + agg.stats.health + '%。请给出库存主题判断和 1 条建议。'
    rate.ts.push(now)
    rate.ok = rate.ts.length < SUMMARY_RATE_MAX
    jobs.push(
      chat({
        intent: 'community-summary',
        question: '',
        evidence: prompt,
        system: '你是「启核图策」家庭资源分析师。根据下面给出的社区统计写 1 句洞察（≤80 字），' +
          '数字必须原样引用，不得新增或修改数字，不要输出标题、列表符号或建议清单。\n' + prompt,
        temperature: 0.2, maxTokens: 120
      })
        .then((r) => { putSummary(c.id, r.text, r.model); return { community: c.id, ok: true } })
        .catch(() => { return { community: c.id, ok: false } })
    )
  })
  if (rate.ts.length) {
    try { Taro.setStorageSync(SUMMARY_RATE_KEY, JSON.stringify(rate.ts)) } catch (e) { /* ignore */ }
  }
  return Promise.all(jobs)
}
