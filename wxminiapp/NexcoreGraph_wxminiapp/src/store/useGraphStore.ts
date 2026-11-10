// 启核图策 · 图谱状态（zustand 只读快照 + stale 标记，方案 9.2）
import { create } from 'zustand'
import { ensure, graphBrief } from '@/services/graph'

export interface GraphBrief {
  libs: number
  items: number
  expiringN: number
  nodes: number
  edges: number
  communities: number
}

interface GraphState {
  version: string
  brief: GraphBrief | null
  summaries: { total: number; fresh: number }
  refresh: () => void
}

export const useGraphStore = create<GraphState>((set) => ({
  version: '',
  brief: null,
  summaries: { total: 0, fresh: 0 },

  refresh: () => {
    try {
      const doc = ensure()
      set({
        version: doc.version,
        brief: graphBrief(),
        summaries: {
          total: doc.summaries.length,
          fresh: doc.summaries.filter((s) => !s.stale).length
        }
      })
    } catch (e) {
      // 图谱构建失败不阻塞页面（降级为空快照）
    }
  }
}))
