// 启核图策 · AI 调用层（小程序端）
//
// 双通道（红线不变：数值由代码计算、写操作先预览、单请求 ≤2 次模型调用；本层只发 1 次）：
//   ① 自建网关：POST {serverBase}/api/ai/chat | /api/ai/vision（Key 在后端环境变量 AGNES_API_KEY）
//   ② 厂商直连：POST {vendorBase}/chat/completions（Key 来自本机 .env 或 Storage，设置页可改）
//
// prefer='gateway'（默认）时先试自建网关，连不上再回落厂商直连；两条都失败由上层降级本地快答。
// 这样评委机器没起后端也能演示；起了后端就走服务端代理。
//
// 密钥来源（优先级从高到低，仓库里不留真 Key）：
//   ① 设置页填写 → 本机 Storage（nexcore_ai_cfg_v1）
//   ② 本机 .env 的 TARO_APP_AI_KEY（复制 .env.example 而来；已在 .gitignore 内）
//   ③ 都没有 → 只有自建网关通道可用
import Taro from '@tarojs/taro'

const LS_KEY = 'nexcore_ai_cfg_v1'
const LEGACY_KEY = 'nexcore_agnes_cfg_v1'

export interface AiCfg {
  /** 自建后端地址；留空自动探测 127.0.0.1:3000 / localhost:3000 */
  serverBase: string
  /** 厂商直连用（demo Key，可在设置页改成自备 Key） */
  key: string
  model: string
  vendorBase: string
  prefer: 'gateway' | 'direct'
  enabled: boolean
  timeout: number
}

export type AiErrorKind = 'timeout' | 'offline' | 'no-server' | 'no-key' | 'unauthorized' | 'quota' | 'server' | 'network'

export interface AiError {
  kind: AiErrorKind
  message: string
}

export interface ChatResult {
  text: string
  model: string
  ms: number
  tokens?: number
  via: 'gateway' | 'direct'
}

export interface VisionItem {
  name: string
  category: string
  qty: number
  unit: string
  pos: string
  expDays: number
  price: number
}

export interface VisionResult {
  items: VisionItem[]
  model: string
  ms: number
  trail: string[]
  noHouseholdItems: boolean
  via: 'gateway' | 'direct'
}

export const DEFAULTS: AiCfg = {
  serverBase: '',
  key: process.env.TARO_APP_AI_KEY || '',
  model: process.env.TARO_APP_AI_MODEL || 'agnes-2.5-flash',
  vendorBase: process.env.TARO_APP_AI_VENDOR_BASE || 'https://api.agnes-ai.cn/v1',
  prefer: 'gateway',
  enabled: true,
  timeout: 30000
}

const BUILTIN = ['http://127.0.0.1:3000', 'http://localhost:3000']

let resolvedBase = ''
let serverMode = ''
let aiState = ''
let healthMs = 0

export let lastError: AiError | null = null

function read(key: string): any {
  try {
    const raw = Taro.getStorageSync(key)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    return null
  }
}

/* 旧配置迁移：早先 nexcore_agnes_cfg_v1 的 base/baseUrl 指厂商地址，搬到 vendorBase */
;(function migrate(): void {
  if (read(LS_KEY)) return
  const old = read(LEGACY_KEY)
  if (!old) return
  const next: Record<string, any> = {}
  if (old.key) next.key = old.key
  if (old.model) next.model = old.model
  const vendor = old.vendorBase || old.base || old.baseUrl
  if (vendor) next.vendorBase = vendor
  if (old.enabled !== undefined) next.enabled = old.enabled
  try {
    Taro.setStorageSync(LS_KEY, JSON.stringify(next))
  } catch (e) { /* ignore */ }
})()

export function cfg(): AiCfg {
  const saved = read(LS_KEY) || {}
  const out: Record<string, any> = {}
  ;(Object.keys(DEFAULTS) as (keyof AiCfg)[]).forEach((k) => {
    out[k] = saved[k] !== undefined ? saved[k] : DEFAULTS[k]
  })
  return out as AiCfg
}

export function saveCfg(patch: Partial<AiCfg>): AiCfg {
  const next = { ...cfg(), ...patch }
  try {
    Taro.setStorageSync(LS_KEY, JSON.stringify(next))
  } catch (e) { /* ignore */ }
  resolvedBase = ''
  serverMode = ''
  aiState = ''
  return next
}

function trimUrl(u: string): string {
  return String(u || '').trim().replace(/\/+$/, '')
}

function candidates(): string[] {
  const out: string[] = []
  const manual = trimUrl(cfg().serverBase)
  if (manual) out.push(manual)
  BUILTIN.forEach((u) => {
    if (out.indexOf(u) < 0) out.push(u)
  })
  return out
}

function boom(kind: AiErrorKind, message: string): Error {
  lastError = { kind: kind, message: message }
  const e = new Error(message)
  ;(e as any).aiKind = kind
  return e
}

interface RawRes {
  statusCode: number
  data: any
}

function request(url: string, method: 'GET' | 'POST', data: any, timeout: number, extraHeaders?: Record<string, string>): Promise<RawRes> {
  return new Promise<RawRes>((resolve, reject) => {
    Taro.request({
      url: url,
      method: method,
      timeout: timeout,
      header: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
      data: data === undefined ? undefined : data,
      success: (res: Taro.request.SuccessCallbackResult & { data?: any }) => {
        resolve({ statusCode: res.statusCode, data: res.data })
      },
      fail: (err: { errMsg?: string }) => {
        const msg = (err && err.errMsg) || ''
        if (/timeout|abort/i.test(msg)) {
          reject(boom('timeout', '请求超时（' + Math.round(timeout / 1000) + 's）'))
        } else if (/domain|not in domain list|合法域名/i.test(msg)) {
          reject(boom('network', '域名未放行：真机请在微信后台配置合法域名，开发工具里勾选「不校验合法域名」'))
        } else {
          reject(boom('network', msg || '网络不可用'))
        }
      }
    } as Taro.request.Option)
  })
}

function probe(base: string): Promise<string> {
  const t0 = Date.now()
  return request(base + '/api/health', 'GET', undefined, 5000).then((res) => {
    if (res.statusCode !== 200) throw new Error('HTTP ' + res.statusCode)
    healthMs = Date.now() - t0
    const info = (res.data || {}) as Record<string, any>
    serverMode = String(info.mode || '')
    aiState = String(info.ai || '')
    return base
  })
}

function responseJson(raw: any): any {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      return {}
    }
  }
  return raw || {}
}

/** 自建后端地址解析：手动 → 内置候选；健康探测通过后缓存 */
export function resolveServerBase(): Promise<string> {
  if (resolvedBase !== '') return Promise.resolve(resolvedBase)
  const list = candidates()
  const tryAt = (i: number): Promise<string> => {
    if (i >= list.length) {
      return Promise.reject(boom('no-server', '未发现自建后端服务'))
    }
    return probe(list[i]).then((base) => {
      resolvedBase = base
      return base
    }, () => tryAt(i + 1))
  }
  return tryAt(0)
}

function gatewayJson(path: string, payload: Record<string, any>, timeout: number, extraHeaders?: Record<string, string>): Promise<any> {
  return resolveServerBase().then((base) => {
    return request(base + path, 'POST', payload, timeout, extraHeaders).then((res) => {
      const data = res.data
      if (res.statusCode >= 200 && res.statusCode < 300 && data) return data
      const msg = (data && data.error) || ('网关请求失败（' + res.statusCode + '）')
      if (res.statusCode === 503) throw boom('no-key', 'AI 网关未配置 Key：' + msg)
      if (res.statusCode === 429) throw boom('quota', msg)
      if (res.statusCode >= 500) throw boom('server', msg)
      throw boom('server', msg)
    })
  })
}

/* ---------- 厂商直连（自建网关不可用时的回落通道，Key 在本机配置里） ---------- */
function vendorChat(messages: { role: string; content: any }[], opt: {
  system?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}): Promise<ChatResult> {
  const c = cfg()
  if (!c.key) return Promise.reject(boom('no-key', '未配置 API Key'))
  const t0 = Date.now()
  const body = {
    model: c.model,
    messages: (opt.system ? [{ role: 'system', content: opt.system }] : []).concat(messages),
    temperature: opt.temperature != null ? opt.temperature : 0.4,
    max_tokens: opt.maxTokens || 600
  }
  return request(trimUrl(c.vendorBase) + '/chat/completions', 'POST', body, opt.timeout || c.timeout, {
    Authorization: 'Bearer ' + c.key
  })
    .then((res) => {
      if (res.statusCode === 401 || res.statusCode === 403) {
        throw boom('unauthorized', 'API Key 无效或无权限')
      }
      if (res.statusCode === 402 || res.statusCode === 429) {
        throw boom('quota', '额度不足或被限流')
      }
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw boom('server', '模型服务错误 ' + res.statusCode)
      }
      const data = responseJson(res.data)
      const choice = (data.choices || [])[0] || {}
      const text = (choice.message && choice.message.content) || ''
      if (!text) throw boom('server', '模型返回为空')
      lastError = null
      return {
        text: String(text).trim(),
        model: data.model || c.model,
        ms: Date.now() - t0,
        tokens: data.usage && data.usage.total_tokens,
        via: 'direct' as const
      }
    })
}

export interface ChatOpt {
  intent?: string
  question?: string
  /** 给自建网关用：代码算好的证据文本 */
  evidence?: string
  /** 图谱证据（mode/lines/paths），网关会按 intent 拼进系统提示 */
  graphEvidence?: Record<string, any>
  history?: any[]
  /** 给厂商直连通道用 */
  system?: string
  temperature?: number
  maxTokens?: number
  timeout?: number
}

/**
 * 对话（双通道）。调用方同时给出 evidence/graphEvidence（网关用）与 system（直连用）。
 */
export function chat(opt: ChatOpt = {}): Promise<ChatResult> {
  const c = cfg()
  if (c.enabled === false) {
    return Promise.reject(boom('no-key', 'AI 已在设置中停用'))
  }
  const direct = (): Promise<ChatResult> => vendorChat(
    [{ role: 'user', content: opt.question || '' }],
    { system: opt.system, maxTokens: opt.maxTokens, temperature: opt.temperature, timeout: opt.timeout }
  )
  const gateway = (): Promise<ChatResult> => gatewayJson('/api/ai/chat', {
    familyId: '',
    user: '',
    intent: opt.intent || 'other',
    evidence: opt.evidence || '',
    question: opt.question || '',
    history: opt.history || [],
    graphEvidence: opt.graphEvidence || null,
    maxTokens: opt.maxTokens || 600
  }, opt.timeout || c.timeout, c.key ? { 'x-agnes-key': c.key } : undefined).then((data) => {
    lastError = null
    return {
      text: String(data.text || '').trim(),
      model: String(data.model || 'gateway'),
      ms: data.ms || 0,
      tokens: data.tokens || 0,
      via: 'gateway' as const
    }
  })
  if (c.prefer === 'direct') return direct().catch(() => gateway())
  return gateway().catch((err: Error) => {
    if (!c.key) throw err
    return direct()
  })
}

/* ---------- 视觉识别（拍照入库）：网关优先，没有网关就直连厂商 ---------- */
const VISION_RULES = '你是家庭物品识别引擎。识别图中的家庭物品（食材/衣物/药品/工具/书籍/宠物食品/家电等），' +
  '只输出 JSON 数组，没有家庭物品时输出 []。每项字段：name 名称、category 类别、qty 数量（数字）、' +
  'unit 单位、pos 建议存放位置、expDays 保质期天数（不适用填 0）、price 参考价（元，未知填 0）。只输出 JSON，不要解释。'

function parseVisionItems(text: string): any[] {
  const t = String(text || '').replace(/```json/gi, '').replace(/```/g, '').trim()
  const s = t.indexOf('[')
  const e = t.lastIndexOf(']')
  if (s >= 0 && e > s) {
    try {
      const arr = JSON.parse(t.substring(s, e + 1))
      return Array.isArray(arr) ? arr : []
    } catch (err) { /* 落到空数组 */ }
  }
  return []
}

function normalizeItems(raw: any[]): VisionItem[] {
  const out: VisionItem[] = []
  ;(raw || []).forEach((it) => {
    if (!it || !it.name) return
    const qty = Number(it.qty)
    const days = Number(it.expDays)
    out.push({
      name: String(it.name),
      category: String(it.category || '其他'),
      qty: isNaN(qty) || qty <= 0 ? 1 : qty,
      unit: String(it.unit || '个'),
      pos: String(it.pos || ''),
      expDays: isNaN(days) || days < 0 ? 0 : days,
      price: Number(it.price) || 0
    })
  })
  return out
}

export function vision(opts: { imageBase64: string; hints?: string; timeout?: number }): Promise<VisionResult> {
  const c = cfg()
  if (!opts || !opts.imageBase64) {
    return Promise.reject(boom('server', '缺少图片数据'))
  }
  const direct = (): Promise<VisionResult> => {
    if (!c.key) return Promise.reject(boom('no-key', '未配置 API Key'))
    const t0 = Date.now()
    return request(trimUrl(c.vendorBase) + '/chat/completions', 'POST', {
      model: c.model,
      temperature: 0.1,
      max_tokens: 900,
      messages: [
        { role: 'system', content: '你是家庭物品识别引擎，只输出 JSON 数组，没有家庭物品时输出 []。' },
        {
          role: 'user',
          content: [
            { type: 'text', text: VISION_RULES + (opts.hints ? '\n已知线索：' + String(opts.hints).slice(0, 200) : '') },
            { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,' + opts.imageBase64 } }
          ]
        }
      ]
    }, opts.timeout || c.timeout, {
      Authorization: 'Bearer ' + c.key
    }).then((res) => {
      if (res.statusCode < 200 || res.statusCode >= 300) {
        throw boom('server', '视觉识别失败（' + res.statusCode + '）')
      }
      const data = responseJson(res.data)
      const choice = (data.choices || [])[0] || {}
      const txt = (choice.message && choice.message.content) || ''
      const items = normalizeItems(parseVisionItems(txt))
      lastError = null
      return {
        items: items,
        model: data.model || c.model,
        ms: Date.now() - t0,
        trail: [],
        noHouseholdItems: items.length === 0,
        via: 'direct' as const
      }
    })
  }
  const gateway = (): Promise<VisionResult> => gatewayJson('/api/ai/vision', {
    familyId: '',
    user: '',
    imageBase64: opts.imageBase64,
    hints: opts.hints || ''
  }, opts.timeout || c.timeout, c.key ? { 'x-agnes-key': c.key } : undefined).then((data) => {
    lastError = null
    return {
      items: normalizeItems(data.items || []),
      model: String(data.model || 'gateway'),
      ms: data.ms || 0,
      trail: data.trail || [],
      noHouseholdItems: data.noHouseholdItems === true,
      via: 'gateway' as const
    }
  })
  if (c.prefer === 'direct') return direct().catch(() => gateway())
  return gateway().catch((err: Error) => {
    if (!c.key) throw err
    return direct()
  })
}

export interface ConnStatus {
  gateway: { ok: boolean; base?: string; mode?: string; ai?: string; ms?: number; error?: string }
  direct: { ok: boolean; model?: string; ms?: number; error?: string }
}

/** 设置页「测试连接」：两条通道分别报状态 */
export function test(): Promise<ConnStatus> {
  const c = cfg()
  const out: ConnStatus = {
    gateway: { ok: false },
    direct: { ok: false }
  }
  resolvedBase = ''
  serverMode = ''
  aiState = ''
  return resolveServerBase().then((base) => {
    out.gateway = { ok: true, base: base, mode: serverMode, ai: aiState, ms: healthMs }
  }, (err: Error) => {
    out.gateway = { ok: false, error: (err && err.message) || '未发现自建后端' }
  }).then(() => {
    if (!c.key) {
      out.direct = { ok: false, error: '未配置 API Key' }
      return out
    }
    const t0 = Date.now()
    return vendorChat([{ role: 'user', content: '回复「ok」两个字母即可。' }], { maxTokens: 16, temperature: 0, timeout: 8000 })
      .then((r) => {
        out.direct = { ok: true, model: r.model, ms: Date.now() - t0 }
        return out
      }, (err: Error) => {
        out.direct = { ok: false, error: (err && err.message) || '直连失败' }
        return out
      })
  })
}

export function status(): { base: string; mode: string; ai: string; ms: number } {
  return { base: resolvedBase, mode: serverMode, ai: aiState, ms: healthMs }
}
