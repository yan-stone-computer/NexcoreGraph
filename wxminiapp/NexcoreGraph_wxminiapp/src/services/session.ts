import Taro from '@tarojs/taro'

export interface FamilySummary {
  id: string
  name: string
  role: string
  member_count?: number
}

export interface AccountSession {
  token: string
  account: string
  nickname: string
  role: string
  families: FamilySummary[]
  familyId: string
  familyName: string
  createdAt: number
}

const KEY = 'nexcore_session_v1'

export function loadSession(): AccountSession | null {
  try {
    const raw = Taro.getStorageSync(KEY)
    if (!raw) return null
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (!data || !data.token || !data.familyId) return null
    return data as AccountSession
  } catch (e) {
    return null
  }
}

export function saveSession(data: Omit<AccountSession, 'createdAt'>): AccountSession {
  const session: AccountSession = { ...data, createdAt: Date.now() }
  try { Taro.setStorageSync(KEY, JSON.stringify(session)) } catch (e) { /* ignore */ }
  return session
}

export function clearSession(): void {
  try { Taro.removeStorageSync(KEY) } catch (e) { /* ignore */ }
}

export function authHeaders(): Record<string, string> {
  const session = loadSession()
  return {
    'Content-Type': 'application/json',
    ...(session?.token ? { 'x-auth-token': session.token } : {})
  }
}
