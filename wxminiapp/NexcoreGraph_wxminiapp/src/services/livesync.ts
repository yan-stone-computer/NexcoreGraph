// 启核图策 · 活同步 + 跨设备流转 + 语音播报（小程序端）
//
// 活同步（对齐鸿蒙端 common/LiveSync.ets）：
//   · 每 2s 查 /api/sync/status/{familyId}；云端更新则自动下载覆盖本地
//   · 本地内容指纹变化 → 1.5s 防抖后自动上传（带 baseVersion）
// 跨设备流转（对齐 FlowBridge + backend/flow-bridge.js）：
//   · 发送：POST {流转中转}/api/flow/publish；接收：GET /api/flow/latest?since=rev
// 语音播报：走自建后端 /api/ai/tts（未配置 TTS_ENDPOINT 时返回 501），用 InnerAudioContext 播放。
import Taro from '@tarojs/taro'
import { resolveServerBase } from '@/services/agnes'
import { api } from '@/services/api'
import { authHeaders, loadSession } from '@/services/session'

const POLL_MS = 2000
const CFG_KEY = 'nexcore_live_cfg_v1'
const DEV_KEY = 'nexcore_device_id'

let timer: any = null
let running = false
let applying = false
let flowRev = 0
let familyId = ''
let lastState = '待连接'

function cfg(): Record<string, any> {
  try {
    const s = Taro.getStorageSync(CFG_KEY)
    return (typeof s === 'string' ? JSON.parse(s) : s) || {}
  } catch (e) { return {} }
}

export function deviceId(): string {
  let d = ''
  try { d = Taro.getStorageSync(DEV_KEY) || '' } catch (e) { d = '' }
  if (!d) {
    d = 'wx-' + Math.random().toString(36).slice(2, 8)
    try { Taro.setStorageSync(DEV_KEY, d) } catch (e) { /* ignore */ }
  }
  return d
}

function flowBase(mainBase: string): string {
  const c = cfg()
  if (c.flowBase) return String(c.flowBase).replace(/\/+$/, '')
  return String(mainBase || '').replace(/:3000$/, ':3100')
}

function req(url: string, method: 'GET' | 'POST', data?: any, timeout = 10000): Promise<any> {
  return new Promise((resolve, reject) => {
    Taro.request({
      url: url,
      method: method,
      timeout: timeout,
      header: authHeaders(),
      data: data,
      success: (res: Taro.request.SuccessCallbackResult & { data?: any }) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body)
        else {
          const err: any = new Error(body.error || ('HTTP ' + res.statusCode))
          err.status = res.statusCode
          reject(err)
        }
      },
      fail: (e: { errMsg?: string }) => reject(new Error((e && e.errMsg) || '网络不可用'))
    } as Taro.request.Option)
  })
}

export function state(): string { return lastState }
function setState(s: string): void { lastState = s }

export async function status(): Promise<{ version: number; updatedAt?: string }> {
  const base = await resolveServerBase()
  return req(base + '/api/sync/status/' + encodeURIComponent(familyId), 'GET')
}

export async function download(): Promise<any> {
  const base = await resolveServerBase()
  const r = await req(base + '/api/sync/download/' + encodeURIComponent(familyId), 'GET')
  applying = true
  api.applyRemoteSnapshot(r.payload, r.version)
  setTimeout(() => { applying = false }, 400)
  return r
}

export async function upload(force = false): Promise<any> {
  if (loadSession()) {
    const r = await api.persistNow(force)
    setState('已同步 v' + r.version)
    return r
  }
  const base = await resolveServerBase()
  const payload = api.snapshotPayload()
  const ver = Date.now()
  const r = await req(base + '/api/sync/upload', 'POST', {
    familyId: familyId,
    payload: payload,
    baseVersion: api.localVersion(),
    force: force,
    version: ver
  }, 12000)
  api.setLocalVersion(r.version || ver)
  setState('已同步 v' + (r.version || ver))
  return r
}

async function tick(): Promise<void> {
  if (!running) return
  try {
    const r = await status()
    const remote = r.version || 0
    const local = api.localVersion()
    if (remote > local && !applying) {
      setState('云端有更新 v' + remote + '，拉取中…')
      await download()
      setState('已同步 v' + remote)
    }
    if (lastState === '待连接') setState('已连接 · 自动同步中')
  } catch (e: any) {
    setState('未连接自建后端（' + ((e && e.message) || '离线') + '）')
  }
}

export function start(fid: string): void {
  if (running && familyId === String(fid)) return
  if (running) stop()
  if (!fid) return
  familyId = String(fid)
  running = true
  tick()
  timer = setInterval(tick, POLL_MS)
}

export function stop(): void {
  running = false
  if (timer) { clearInterval(timer); timer = null }
  setState('已暂停')
}

/* ---------- 跨设备流转 ---------- */
export async function publishFlow(): Promise<any> {
  const base = await resolveServerBase()
  const fb = flowBase(base)
  const data = api.snapshotPayload()
  const summary = '库 ' + (data.libraries || []).length + ' 个 · 物品 ' +
    (data.libraries || []).reduce((n: number, l: any) => n + (l.items || []).length, 0) + ' 件'
  const r = await req(fb + '/api/flow/publish', 'POST', {
    from: deviceId(), json: summary, data: JSON.stringify(data)
  })
  flowRev = r.rev || flowRev
  return r
}

export async function pullFlow(): Promise<{ found: boolean; from?: string; rev?: number }> {
  const base = await resolveServerBase()
  const r = await req(flowBase(base) + '/api/flow/latest?since=' + flowRev, 'GET')
  if (!r.found) return { found: false }
  let data: any = null
  try { data = JSON.parse(r.data || '{}') } catch (e) { data = null }
  if (!data || !data.libraries) return { found: false }
  applying = true
  api.applyPayload(data)
  flowRev = r.rev || flowRev
  setTimeout(() => { applying = false }, 400)
  return { found: true, from: r.from, rev: r.rev }
}

/* ---------- 语音播报（后端 /api/ai/tts → InnerAudioContext） ---------- */
let audio: any = null

export async function say(text: string): Promise<boolean> {
  const t = String(text || '').trim()
  if (!t) return false
  try {
    const base = await resolveServerBase()
    const r = await req(base + '/api/ai/tts', 'POST', { text: t.slice(0, 500) }, 20000)
    const url: string = r.url || r.audioUrl || ''
    if (!url) return false
    if (audio) { try { audio.stop(); audio.destroy() } catch (e) { /* ignore */ } }
    audio = Taro.createInnerAudioContext()
    audio.src = url
    audio.play()
    return true
  } catch (e) {
    return false
  }
}
