// 全局状态管理（Zustand）
// 以 api（本地模拟后端）为唯一数据源，store 持有快照触发重渲染。
import { create } from 'zustand'
import { api, db as rawDb, isLoggedIn, logout as apiLogout, todayStr } from '@/services/api'
import type { DB, Stats } from '@/types'

interface AppState {
  db: DB
  stats: Stats
  loggedIn: boolean
  today: string
  refresh: () => void
  /** 执行一次异步 API 操作，完成后刷新 db/stats 快照 */
  invoke: <T>(fn: () => Promise<T>) => Promise<T>
  login: (phone: string, code: string) => Promise<void>
  logout: () => void
}

function snapshot(): DB {
  return { ...rawDb }
}

export const useStore = create<AppState>((set, get) => ({
  db: snapshot(),
  stats: api.getStats(),
  loggedIn: isLoggedIn(),
  today: todayStr(),

  refresh: () => {
    set({ db: snapshot(), stats: api.getStats() })
  },

  invoke: async (fn) => {
    const r = await fn()
    set({ db: snapshot(), stats: api.getStats(), today: todayStr() })
    return r
  },

  login: async (phone, code) => {
    await api.login(phone, code)
    set({ db: snapshot(), stats: api.getStats(), loggedIn: true, today: todayStr() })
  },

  logout: () => {
    apiLogout()
    set({ db: snapshot(), loggedIn: false })
  }
}))
