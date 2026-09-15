// 启核图策 · AI 编排层（对应 webapp js/ai.js 的迁移）
// - P0-1 意图路由：greet/where/qty/expiry 本地快答（0 次模型调用）
// - P0-2 受约束工具协议 v2：[调整] 库存、shopping_add，白名单执行，先预览后生效
// - P0-3 营养标注（约，估算）+ AI 创新菜谱
// - P0-6 看板简报：统计由代码计算，模型仅润色
// AI 行为红线：数量/位置/日期一律本地查询产出；写操作必须预览确认；单请求 ≤2 次模型调用。
import { db, api } from '@/services/api'
import { KB } from '@/data/knowledge'
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

/* ---------- 模型类回复（本地模拟，正式版为 /api/ai/chat 单次调用） ---------- */
function modelReply(intent: Intent, text: string): Promise<AiReply> {
  const t0 = Date.now()
  return new Promise((resolve) => {
    setTimeout(() => {
      let out: AiReply | null = null
      const M = '已调用模型 · 1 次模型调用'
      if (intent === 'cook') {
        out = { text: '按「临期优先 > 清库存 > 营养均衡」从你的库存排了 3 个方案（营养为每份估算）：', action: 'generatePlans', model: true, src: M }
      } else if (intent === 'creative') {
        out = { text: '我优先挑了快到期的食材，编了一道新菜谱（已加入方案列表，走正常核销链路）：', action: 'creative', model: true, src: 'AI 创新菜谱 · 1 次模型调用' }
      } else if (intent === 'nutrition') {
        const st = api.getStats()
        const prof = db.profile || { goal: '均衡', enabled: true, dislikes: '', people: 3 }
        const goal = prof.goal || '均衡'
        out = {
          text: '按当前方案估算：今天 3 个方案合计约 900 kcal / 蛋白 60g（每份约 300 kcal，估算值）。你的饮食目标是「' + goal +
            '」' + (prof.enabled !== false && prof.dislikes ? '，已避开忌口：' + prof.dislikes : '') + '。建议晚餐选低脂的黄瓜炒虾仁或香煎鸡胸肉。',
          model: true,
          src: M
        }
      } else if (intent === 'summary') {
        out = { text: briefingText(), model: true, src: M }
      } else if (intent === 'shopping_add') {
        const card = parseShoppingAdd(text)
        if (card && db.shopping.some((s) => s.name === card.name)) {
          out = { text: '采购清单里已有「' + card.name + '」，已跳过重复添加（去重）。', model: true, src: M }
        } else {
          out = card ? { text: '确认后我会把该项加入采购清单：', card, model: true, src: M }
                     : { text: '告诉我要买什么，比如「想买 2 盒牛奶」，确认后加入采购清单。', model: true, src: M }
        }
      } else {
        const st2 = api.getStats()
        out = {
          text: '当前库存 ' + st2.totalItems + ' 件，临期 ' + st2.expiringN + ' 件、低库存 ' + st2.lowN +
            ' 件。可以问我物品位置、数量、保质期，也可以说「今晚吃什么」或「鸡蛋只剩 5 个」来改库存。',
          model: true,
          src: M
        }
      }
      api.logAiUsage('/api/ai/chat', Date.now() - t0 + 500)
      resolve(out)
    }, 700 + Math.random() * 500)
  })
}

/* ---------- 统一入口 ---------- */
export function reply(text: string): Promise<AiReply> {
  const intent = route(text)
  const fast = fastReply(intent, text)
  if (fast) {
    api.logAiUsage('/api/ai/chat', 0, '本地快答')
    return Promise.resolve(fast)
  }
  if (intent === 'cook') return modelReply('cook', text)
  if (intent === 'creative') return modelReply('creative', text)
  if (intent === 'nutrition') return modelReply('nutrition', text)
  if (intent === 'summary') return modelReply('summary', text)
  if (intent === 'shopping_add') return modelReply('shopping_add', text)
  if (intent === 'adjust') {
    const card = parseAdjust(text)
    if (card) return Promise.resolve({ text: '检测到库存调整请求，请确认（不直接写库，F5.5）：', card, model: false, src: '本地快答 · 0 次模型调用' })
    return modelReply('fallback', text)
  }
  return modelReply('fallback', text)
}

/* P0-6 简报：数字全部来自 computeStats，文案为固定模板润色 */
export function briefingText(): string {
  const s = api.getStats()
  return '近 7 天简报：消耗 ' + s.trend.consume.reduce((a, b) => a + b, 0) +
    ' 件、入库 ' + s.trend.purchase.reduce((a, b) => a + b, 0) +
    ' 件；当前临期 ' + s.expiringN + ' 件、低库存 ' + s.lowN + ' 件；本月花费 ¥' + s.spent + ' / 预算 ¥' + s.budget +
    '；最常消耗：' + s.topFood + '；库存健康度 ' + s.health + '%。建议优先消耗临期食材，并把低库存项加入采购清单。（统计由代码计算，AI 仅润色；数字以看板为准。）'
}
