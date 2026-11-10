import Taro from '@tarojs/taro'
import {
  appendJournalEvent,
  compensateJournalEvent,
  findJournalEvent,
  hydrateJournal,
  journalTimeline,
  markJournalEventFailed,
  markJournalEventSynced,
  type DomainEvent,
  type NewDomainEvent
} from '@/domain/eventJournal'
import { resolveServerBase } from '@/services/agnes'

const LS_KEY = 'nexcore_event_journal_v1'
const DEVICE_KEY = 'nexcore_device_id'
let initialized = false

function ensureLoaded(): void {
  if (initialized) return
  initialized = true
  try {
    const raw = Taro.getStorageSync(LS_KEY)
    if (raw) hydrateJournal(typeof raw === 'string' ? JSON.parse(raw) : raw)
  } catch (e) {
    console.warn('[eventStore] load failed:', e)
  }
}

function persist(): DomainEvent[] {
  const rows = journalTimeline(500)
  try {
    Taro.setStorageSync(LS_KEY, JSON.stringify(rows))
  } catch (e) {
    console.warn('[eventStore] persist failed:', e)
  }
  return rows
}

export function deviceId(): string {
  try {
    const saved = String(Taro.getStorageSync(DEVICE_KEY) || '')
    if (saved) return saved
    const next = 'wx-' + Math.random().toString(36).slice(2, 10)
    Taro.setStorageSync(DEVICE_KEY, next)
    return next
  } catch (e) {
    return 'wx-local'
  }
}

export function recordEvent(input: Omit<NewDomainEvent, 'deviceId'> & { deviceId?: string }): DomainEvent {
  ensureLoaded()
  const event = appendJournalEvent({ ...input, deviceId: input.deviceId || deviceId() })
  persist()
  return event
}

export function timeline(limit = 50): DomainEvent[] {
  ensureLoaded()
  return journalTimeline(limit)
}

export function eventById(id: string): DomainEvent | null {
  ensureLoaded()
  return findJournalEvent(id)
}

export function createCompensation(eventId: string, actor: string): DomainEvent {
  ensureLoaded()
  const event = compensateJournalEvent(eventId, actor)
  persist()
  return event
}

export function pendingEvents(): DomainEvent[] {
  ensureLoaded()
  return journalTimeline(500).filter((event) => event.syncStatus !== 'sealed')
}

export async function sealPendingEvents(): Promise<{ sealed: number; failed: number }> {
  const rows = pendingEvents()
  if (!rows.length) return { sealed: 0, failed: 0 }
  let sealed = 0
  let failed = 0
  try {
    const base = await resolveServerBase()
    for (const event of rows.slice().reverse()) {
      try {
        const response: any = await new Promise((resolve, reject) => {
          Taro.request({
            url: base + '/api/events/append',
            method: 'POST',
            timeout: 10000,
            header: { 'Content-Type': 'application/json' },
            data: event,
            success: (res: any) => {
              if (res.statusCode >= 200 && res.statusCode < 300) resolve(res.data || {})
              else reject(new Error((res.data && res.data.error) || ('HTTP ' + res.statusCode)))
            },
            fail: (err: any) => reject(new Error((err && err.errMsg) || '网络不可用'))
          } as Taro.request.Option)
        })
        markJournalEventSynced(event.id, String(response.hash || ''), response.prevHash ? String(response.prevHash) : undefined)
        sealed++
      } catch (e) {
        markJournalEventFailed(event.id)
        failed++
      }
    }
  } catch (e) {
    for (const event of rows) markJournalEventFailed(event.id)
    failed = rows.length
  }
  persist()
  return { sealed, failed }
}

export async function verifyAuditChain(familyId: string): Promise<{
  valid: boolean
  checked: number
  brokenAt?: string
  head?: string
}> {
  const base = await resolveServerBase()
  return new Promise((resolve, reject) => {
    Taro.request({
      url: base + '/api/events/verify/' + encodeURIComponent(familyId),
      method: 'GET',
      timeout: 10000,
      success: (res: any) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body)
        else reject(new Error(body.brokenAt ? ('哈希链在 ' + body.brokenAt + ' 断开') : (body.error || ('HTTP ' + res.statusCode))))
      },
      fail: (err: any) => reject(new Error((err && err.errMsg) || '网络不可用'))
    } as Taro.request.Option)
  })
}
