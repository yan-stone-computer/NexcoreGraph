import { describe, expect, it } from 'vitest'
import { parseScenario, simulate } from '../src/services/simulation'
import type { DB } from '../src/types'

function state(): DB {
  return {
    familyId: 'fam-1',
    families: [],
    users: [],
    members: {},
    invite: { code: '', familyId: 'fam-1', expiresInDays: 7, used: 0, max: 1, revoked: false },
    theme: 'light',
    settings: { private: false, chat: true, expiry: true, digest: true, low: true, alertSoon: 7, alertCritical: 3 },
    profile: { people: 3, dislikes: '', goal: '均衡', enabled: true },
    budget: 100,
    logs: [],
    aiUsage: [],
    config: {
      model: 'test', visionModel: 'test', webSearch: false, searchCacheMin: 0, rateLimitPerDay: 10,
      unitPrice: 0, visionPrice: 0, identifyThreshold: 0, pushTemplate: '', knowledgeVersion: 1
    },
    libraries: [{
      id: 'fridge', name: '冰箱', icon: 'fridge', tone: 'teal', desc: '2 件', count: 2,
      items: [
        { id: 'milk', no: 'NO-1', name: '牛奶', emoji: 'm', qty: 2, unit: '盒', price: 6, priceSrc: '手动', expDays: 3, pos: '冷藏区', lowAt: 1, addedAt: 1 },
        { id: 'egg', no: 'NO-2', name: '鸡蛋', emoji: 'e', qty: 6, unit: '个', price: 4, priceSrc: '手动', expDays: 10, pos: '冷藏区', lowAt: 2, addedAt: 1 }
      ]
    }],
    alerts: [],
    plans: [],
    shopping: [],
    workbench: { name: '', expires: '', code: '', myDeck: [], seats: [], chat: [], members: [], plan: {} },
    chat: [],
    daily: [],
    intake: {},
    history7: []
  }
}

describe('what-if simulation', () => {
  it('does not mutate the source state', () => {
    const source = state()
    const before = JSON.stringify(source)
    const result = simulate(source, { kind: 'buy', itemName: '牛奶', qty: 2, totalPrice: 12 })

    expect(JSON.stringify(source)).toBe(before)
    expect(result.after.items).toBe(2)
    expect(result.after.stockUnits).toBe(10)
  })

  it('warns when a scenario exceeds the budget', () => {
    const source = state()
    source.budget = 10
    const result = simulate(source, { kind: 'buy', itemName: '牛奶', qty: 2, totalPrice: 20 })

    expect(result.warnings[0]).toMatch(/^本次购买将超出月度预算 ¥\d+/)
    expect(result.after.budgetUsed).toBe(48)
  })
})

describe('what-if natural language parser', () => {
  it('parses a Chinese purchase quantity', () => {
    expect(parseScenario('如果这周再买两盒牛奶会怎样', state())).toEqual({
      kind: 'buy',
      itemName: '牛奶',
      qty: 2,
      totalPrice: 12
    })
  })

  it('parses a budget reduction', () => {
    expect(parseScenario('如果把预算降到 80 会怎样', state())).toEqual({
      kind: 'set_budget',
      amount: 80
    })
  })
})
