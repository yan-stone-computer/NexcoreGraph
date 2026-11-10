import Taro from '@tarojs/taro'
import type { RetrievalTrace } from '@/services/retrievalTrace'

const LS_KEY = 'nexcore_last_retrieval_trace_v1'

export function saveTrace(trace: RetrievalTrace): void {
  try {
    Taro.setStorageSync(LS_KEY, JSON.stringify(trace))
  } catch (e) {
    console.warn('[traceStore] save failed:', e)
  }
}

export function lastTrace(): RetrievalTrace | null {
  try {
    const raw = Taro.getStorageSync(LS_KEY)
    if (!raw) return null
    return typeof raw === 'string' ? JSON.parse(raw) : raw
  } catch (e) {
    return null
  }
}
