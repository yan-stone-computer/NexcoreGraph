import { describe, expect, it } from 'vitest'
import { finishTrace, makeTrace } from '../src/services/retrievalTrace'

describe('retrieval trace', () => {
  it('records bounded steps, paths and evidence count', () => {
    const trace = makeTrace('牛奶还能放几天', 'fast', 100)
    const done = finishTrace(trace, {
      mode: 'fast',
      lines: ['冰箱 · 冷藏区 | 牛奶 2 盒 | 3 天到期'],
      paths: [{
        nodes: ['item:milk', 'food:milk'],
        edges: ['instantiates'],
        facts: ['牛奶'],
        src: '本地图谱'
      }],
      stale: false,
      version: 'gv-1'
    }, 124)

    expect(done.steps.length).toBeLessThanOrEqual(8)
    expect(done.pathIds).toEqual(['item:milk>food:milk'])
    expect(done.evidenceCount).toBe(2)
    expect(done.totalMs).toBe(24)
  })

  it('marks a degraded empty-evidence answer', () => {
    const trace = makeTrace('完全不存在的物品在哪里', 'global', 10)
    const done = finishTrace(trace, {
      mode: 'global',
      lines: [],
      paths: [],
      stale: true,
      version: 'gv-1'
    }, 30)

    expect(done.degraded).toBe(true)
    expect(done.staleCount).toBe(1)
  })
})
