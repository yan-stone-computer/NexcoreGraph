// 启核图策 · AI 编排层（对应 webapp js/ai.js 的迁移）
// - P0-1 意图路由：greet/where/qty/expiry 本地快答（0 次模型调用）
// - P0-2 受约束工具协议 v2：[调整] 库存、shopping_add，白名单执行，先预览后生效
// - P0-3 营养标注（约，估算）+ AI 创新菜谱
// - P0-6 看板简报：统计由代码计算，模型仅润色
// AI 行为红线：数量/位置/日期一律本地查询产出；写操作必须预览确认；单请求 ≤2 次模型调用。
import { db, api } from '@/services/api'
import { KB } from '@/data/knowledge'
import { ask } from '@/services/graphRag'
import { securityCheck, securityCheckRemote } from '@/services/graphRag'
import { matchCommand, run } from '@/services/commands'
import { parseScenario, simulate } from '@/services/simulation'
import type { AdjustCard, Item } from '@/types'

export interface AiReply {
  text: string
  model: boolean
  action?: string
  card?: AdjustCard
  plans?: number[]
  src?: string
}

/* 口语别名归一化 */
const ALIASES: Record<string, string> = { '牛奶': '鲜牛奶', '西红柿': '番茄', '青菜': '上海青', '土豆': '土豆', '酱油': '生抽/酱油' }
function normalize(text: string): string {
  Object.keys(ALIASES).forEach((k) => { text = text.split(k).join(ALIASES[k]) })
  return text
}

function findByName(text: string): Item | null {
  const t = normalize(text)
  const names: Item[] = []
  db.libraries.forEach((l) => (l.items || []).forEach((it) => names.push(it)))
  names.sort((a, b) => b.name.length - a.name.length)
  for (let i = 0; i < names.length; i++) {
    if (t.indexOf(names[i].name) > -1) return names[i]
  }
  return null
}

function numAfter(text: string, fallback: number | null): number | null {
  const m = /(\d+(?:\.\d+)?)/.exec(text)
  return m ? parseFloat(m[1]) : fallback
}

function kbEntry(text: string) {
  const t = normalize(text)
  const foods = KB.foods
  const keys = Object.keys(foods).sort((a, b) => foods[b].name.length - foods[a].name.length)
  for (let i = 0; i < keys.length; i++) {
    const base = foods[keys[i]].name.replace(/（.*?）/, '').split('（')[0]
    const short = base.length > 2 ? base.slice(0, 2) : base
    if (t.indexOf(foods[keys[i]].name) > -1 || t.indexOf(base) > -1 || (short.length > 1 && t.indexOf(short) > -1)) {
      return { key: keys[i], food: foods[keys[i]] }
    }
  }
  return null
}

function srcNote(entry: { food: { src: string } }): string {
  return '（知识库 · ' + entry.food.src + '。' + KB.DISCLAIMER + '）'
}

export type Intent = 'greet' | 'where' | 'qty' | 'expiry' | 'creative' | 'nutrition' | 'summary' | 'shopping_add' | 'cook' | 'adjust' | 'fallback'

export function route(text: string): Intent {
  const t = text || ''
  if (/^(hi|hello|你好|您好|在吗|嗨)/i.test(t) || t === '在么') return 'greet'
  if (/放哪|在哪里|在哪|哪儿|找到/.test(t)) return 'where'
  if (/还剩|剩多少|有多少|几个|几盒|几瓶|数量/.test(t) && !/调整|改/.test(t)) return 'qty'
  if (/创新|新菜|独门|新花样|花式|尝鲜/.test(t)) return 'creative'
  if (/保质期|能放|多久|过期|变质|几天/.test(t)) return 'expiry'
  if (/热量|卡路里|营养|减脂|增肌|控糖/.test(t)) return 'nutrition'
  if (/总结|简报|摘要|复盘|本周|上周/.test(t)) return 'summary'
  if (/加入采购|加进采购|加购|采购清单|想买|要买|添加购物/.test(t)) return 'shopping_add'
  if (/做什么|吃什么|安排|菜|晚餐|早餐|午餐/.test(t)) return 'cook'
  if (/还剩|只剩|还有|喝完|吃完|用完|没了|买了|加了|放入|补货|减少|吃掉|用了/.test(t)) return 'adjust'
  return 'fallback'
}

function posOf(it: Item): string {
  let libName = ''
  db.libraries.forEach((l) => { if ((l.items || []).indexOf(it) > -1) libName = '「' + l.name + '」' })
  ;(it as any).libNameHint = libName
  return (it.pos || '未设置位置')
}

/* ---------- 快答（0 次模型调用） ---------- */
function fastReply(intent: Intent, text: string): AiReply | null {
  const it = findByName(text)
  if (intent === 'greet') {
    return { text: '你好，我是启核图策助手。可以问我「鸡蛋放哪了」「牛奶还能放几天」，或让我安排今晚吃什么。', model: false, src: '本地快答 · 0 次模型调用' }
  }
  if (intent === 'where') {
    if (!it) return { text: '没有在库存里找到这件物品。你可以先拍照入库，或换个名字试试。', model: false, src: '本地快答 · 0 次模型调用' }
    const posW = posOf(it)
    return {
      text: it.name + '在' + (it as any).libNameHint + ' · ' + posW +
        '，当前 ' + it.qty + ' ' + it.unit +
        (it.expDays && it.expDays < 9000 ? '，还有 ' + it.expDays + ' 天到期' : '') +
        (it.price ? '。价格 ¥' + it.price + '（' + it.priceSrc + '）' : '') + '。',
      model: false,
      src: '本地快答 · 0 次模型调用'
    }
  }
  if (intent === 'qty') {
    if (!it) return { text: '库存里没有查到这件物品，数量以资源库页面为准。', model: false, src: '本地快答 · 0 次模型调用' }
    const pos = posOf(it)
    return { text: it.name + '当前 ' + it.qty + ' ' + it.unit + '（' + (it as any).libNameHint + pos + '），与资源库一致。', model: false, src: '本地快答 · 0 次模型调用' }
  }
  if (intent === 'expiry') {
    const entry = kbEntry(text)
    if (entry) {
      const f = entry.food
      return { text: f.name + '冷藏约 ' + f.days + ' 天' + (f.open ? '，开封后 ' + f.open + ' 天内用完' : '') + '。' + f.tip + srcNote(entry), model: false, src: '知识库（' + f.src + '）· 0 次模型调用' }
    }
    if (it && it.expDays < 9000) return { text: it.name + '还有 ' + it.expDays + ' 天到期，存放于' + posOf(it) + '。' + KB.DISCLAIMER, model: false, src: '本地快答 · 0 次模型调用' }
    return { text: '没有找到对应物品或知识库条目。常见食材我都能答，比如「鸡蛋能放多久」。', model: false, src: '本地快答 · 0 次模型调用' }
  }
  return null
}

/* ---------- 写操作解析：只产出预览卡，不直接写库（红线 2 / F5.5） ---------- */
function parseAdjust(text: string): AdjustCard | null {
  const it = findByName(text)
  if (!it) return null
  let to: number | null = null
  let delta: number | null = null
  let reason = '自然语言修改'
  if (/喝完|吃完|用完|没了|清空/.test(text)) { to = 0 }
  else if (/只剩|仅剩|还有|剩下|现在有/.test(text)) { to = numAfter(text, null) }
  else if (/买了|加了|放入|进货|补货/.test(text)) { delta = numAfter(text, null); reason = '自然语言修改（补充）' }
  else if (/减少|吃掉|用了/.test(text)) { delta = numAfter(text, null) ? -numAfter(text, null)! : null }
  else if (/调整|改成|设为/.test(text)) { to = numAfter(text, null) }
  if (to == null && delta == null) return null
  const from = it.qty
  const target = delta != null ? Math.max(0, from + delta) : Math.max(0, to!)
  if (target === from) return null
  return { type: 'adjust', itemId: it.id, name: it.name, unit: it.unit, from, to: target, reason, lib: (it as any).libNameHint || '' }
}

function parseShoppingAdd(text: string): AdjustCard | null {
  const it = findByName(text)
  const m = /(?:想买|要买|加入采购|买)([^，。,\s]*)/.exec(text)
  let name = it ? it.name : (m && m[1] ? m[1].replace(/(一|两|三|四|五|六|七|八|九|十|\d)+(个|盒|瓶|袋|把|罐|份|包)$/g, '') || m[1] : '')
  if (!name) return null
  const unitMatch = (text.match(/(个|盒|瓶|袋|把|罐|份|包)/) || ['单位'])[0]
  return { type: 'shopping_add', name, qty: numAfter(text, 1) + ' ' + unitMatch }
}

/* ---------- 模型类回复：Agnes + GraphRAG（单次真实调用） -----
   红线 3：单请求 ≤2 次模型调用（本链路仅 1 次；社区摘要为离线预计算，不在对话请求内） */
function agnesReply(intent: Intent, text: string): Promise<AiReply> {
  return ask(text).then((r) => {
    if (r.ok) {
      api.logAiUsage('/api/ai/chat', r.ms, r.model)
      const out: AiReply = { text: r.text, model: true, src: r.src }
      if (intent === 'cook') out.action = 'generatePlans'
      if (intent === 'creative') out.action = 'creative'
      if (intent === 'shopping_add') {
        const card = parseShoppingAdd(text)
        if (card) { out.card = card; out.text = '确认后我会把该项加入采购清单（预览如下，Agnes 已理解需求）：' }
      }
      return out
    }
    const evidence = r.evidence.lines.length
      ? '。图谱可查到：' + r.evidence.lines.slice(0, 3).join('；')
      : ''
    return {
      text: 'AI 服务暂时不可用（' + (r.error || '网络异常') + '）' + evidence,
      model: false,
      src: '后端 AI 未响应 · GraphRAG ' + r.mode
    }
  }).catch(() => {
    return Promise.resolve({
      text: 'AI 服务暂时不可用，请确认后端 /api/ai/chat 与模型凭据正常。',
      model: false,
      src: '后端 AI 未响应'
    })
  })
}

/* ---------- 统一入口 ---------- */
export async function reply(text: string): Promise<AiReply> {
  /* 0) 自然语言指令层（与鸿蒙端 Commands.ets / Web 端 commands.js 同规则）：
        命中即本地执行，写操作先弹确认，不再走意图路由与模型 */
  const cmd = matchCommand(text)
  if (cmd) {
    api.logAiUsage('/api/ai/chat', 0, '本地指令')
    return run(cmd)
  }
  /* MX7 内容安全：发送前本地敏感词兜底，拦截即提示、不调用模型 */
  const guard = securityCheck(text || '')
  if (!guard.ok) {
    api.logAiUsage('/api/ai/chat', 0, '内容安全拦截')
    return Promise.resolve({
      text: '你的输入包含敏感词「' + guard.word + '」，已拦截不会发送给模型（MX7 内容安全）。换个说法试试，比如「今晚吃什么」。',
      model: false,
      src: '本地拦截 · 0 次模型调用'
    })
  }
  /* 服务端微信 msgSecCheck（配置 WX_APPID/WX_SECRET 后生效；未配置自动跳过） */
  const remote = await securityCheckRemote(text || '')
  if (!remote.pass) {
    api.logAiUsage('/api/ai/chat', 0, '内容安全拦截')
    return {
      text: '这条内容未通过微信内容安全检查，已拦截（MX7）。换个说法试试。',
      model: false,
      src: '微信 msgSecCheck · 0 次模型调用'
    }
  }
  const scenario = parseScenario(text || '', db)
  if (scenario) {
    const impact = simulate(db, scenario)
    api.logAiUsage('/api/ai/what-if', 0, '本地推演')
    return {
      text: '这是推演，不会修改真实数据：物品 ' + impact.before.items + ' → ' + impact.after.items +
        '，库存单位 ' + impact.before.stockUnits + ' → ' + impact.after.stockUnits +
        '，临期 ' + impact.before.expiring + ' → ' + impact.after.expiring +
        '，预算占用 ¥' + impact.before.budgetUsed + ' → ¥' + impact.after.budgetUsed +
        (impact.warnings.length ? '。注意：' + impact.warnings.join('；') : '。没有触发预算或库存告警。'),
      model: false,
      src: 'What-if 沙箱 · 本地计算 · 0 次模型调用'
    }
  }
  const intent = route(text)
  const fast = fastReply(intent, text)
  if (fast) {
    api.logAiUsage('/api/ai/chat', 0, '本地快答')
    return Promise.resolve(fast)
  }
  if (intent === 'adjust') {
    const card = parseAdjust(text)
    if (card) return Promise.resolve({ text: '检测到库存调整请求，请确认（不直接写库，F5.5）：', card, model: false, src: '本地快答 · 0 次模型调用' })
  }
  return agnesReply(intent, text)
}

/* P0-6 简报：数字全部来自 computeStats，文案为固定模板润色 */
export function briefingText(): string {
  const s = api.getStats()
  return '近 7 天简报：消耗 ' + s.trend.consume.reduce((a, b) => a + b, 0) +
    ' 件、入库 ' + s.trend.purchase.reduce((a, b) => a + b, 0) +
    ' 件；当前临期 ' + s.expiringN + ' 件、低库存 ' + s.lowN + ' 件；本月花费 ¥' + s.spent + ' / 预算 ¥' + s.budget +
    '；最常消耗：' + s.topFood + '；库存健康度 ' + s.health + '%。建议优先消耗临期食材，并把低库存项加入采购清单。（统计由代码计算，AI 仅润色；数字以看板为准。）'
}
