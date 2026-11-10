import Taro from '@tarojs/taro'
import { resolveServerBase } from '@/services/agnes'
import { authHeaders, loadSession } from '@/services/session'

export interface FamilyMember {
  phone: string
  name: string
  role: string
}

export interface FamilyRecord {
  id: string
  name: string
  invite_code: string
  role: string
  member_count: number
}

export interface CoopRecord {
  code: string
  name: string
  expiresAt: number
  members: { account: string; nickname: string; joined_at: string }[]
}

function request<T>(path: string, method: 'GET' | 'POST' | 'DELETE', data?: any): Promise<T> {
  return resolveServerBase().then((base) => new Promise<T>((resolve, reject) => {
    Taro.request({
      url: base + path,
      method,
      data,
      timeout: 15000,
      header: authHeaders(),
      success: (res: Taro.request.SuccessCallbackResult & { data?: any }) => {
        const body = res.data || {}
        if (res.statusCode >= 200 && res.statusCode < 300 && body.error == null) resolve(body as T)
        else reject(new Error(body.error || ('HTTP ' + res.statusCode)))
      },
      fail: (e: { errMsg?: string }) => reject(new Error((e && e.errMsg) || '网络不可用'))
    } as Taro.request.Option)
  }))
}

export async function getMembers(familyId: string): Promise<FamilyMember[]> {
  const r = await request<{ members: any[] }>('/api/families/' + encodeURIComponent(familyId) + '/members', 'GET')
  return (r.members || []).map((m) => ({
    phone: String(m.phone || ''),
    name: String(m.nickname || m.name || String(m.phone || '').split('@')[0]),
    role: String(m.role || '成员')
  }))
}

export async function getCurrentFamily(account: string, familyId: string): Promise<FamilyRecord | null> {
  const r = await request<{ families: FamilyRecord[] }>('/api/families?phone=' + encodeURIComponent(account), 'GET')
  return (r.families || []).find((f) => f.id === familyId) || null
}

export async function createInvite(familyId: string): Promise<string> {
  const r = await request<{ invite_code: string }>('/api/families/' + encodeURIComponent(familyId) + '/invite', 'POST', {})
  return String(r.invite_code || '')
}

export async function removeFamilyMember(familyId: string, phone: string): Promise<void> {
  await request('/api/families/' + encodeURIComponent(familyId) + '/members/' + encodeURIComponent(phone), 'DELETE')
}

export async function createCoop(name: string): Promise<CoopRecord> {
  const session = loadSession()
  if (!session) throw new Error('尚未登录')
  return request<CoopRecord>('/api/coop/create', 'POST', {
    account: session.account,
    familyId: session.familyId,
    name
  })
}

export async function joinCoop(code: string): Promise<CoopRecord> {
  const session = loadSession()
  if (!session) throw new Error('尚未登录')
  return request<CoopRecord>('/api/coop/join', 'POST', {
    account: session.account,
    code
  })
}

export async function getCoop(code: string): Promise<CoopRecord> {
  return request<CoopRecord>('/api/coop/' + encodeURIComponent(code), 'GET')
}
