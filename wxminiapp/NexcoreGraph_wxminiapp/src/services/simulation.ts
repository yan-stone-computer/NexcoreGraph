import type { DB, Item } from '@/types'

export type Scenario =
  | { kind: 'buy'; itemName: string; qty: number; totalPrice: number }
  | { kind: 'consume'; planId: number }
  | { kind: 'remove'; itemId: string }
  | { kind: 'set_budget'; amount: number }

export interface ImpactSnapshot {
  items: number
  stockUnits: number
  expiring: number
  lowStock: number
  budgetUsed: number
  health: number
}

export interface Impact {
  before: ImpactSnapshot
  after: ImpactSnapshot
  delta: Record<string, number>
  warnings: string[]
}

const CHINESE_NUM: Record<string, number> = {
  一: 1,
  两: 2,
  二: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10
}

function numberToken(value: string): number {
  if (/^\d+$/.test(value)) return parseInt(value, 10)
  return CHINESE_NUM[value] || 0
}

export function parseScenario(text: string, current: DB): Scenario | null {
  const source = String(text || '').trim()
  if (!/如果|假如|假设|会怎样|会怎么样/.test(source)) return null

  const budget = /预算.{0,4}?(?:降到|减少到|改成|调整为|调到)\s*(\d+(?:\.\d+)?)/.exec(source)
  if (budget) return { kind: 'set_budget', amount: parseFloat(budget[1]) }

  const buy = /买(?:入)?\s*(\d+|[一二两三四五六七八九十])\s*(?:盒|瓶|个|袋|把|包|件)?\s*([^，。,\s]+?)(?:会怎样|会怎么样|会如何|怎么样)/.exec(source)
  if (buy) {
    const qty = numberToken(buy[1])
    const itemName = buy[2].replace(/^(再|还|又)/, '')
    if (qty > 0 && itemName) {
      const item = current.libraries.flatMap((library) => library.items || [])
        .find((row) => row.name === itemName || row.name.indexOf(itemName) > -1 || itemName.indexOf(row.name) > -1)
      return {
        kind: 'buy',
        itemName,
        qty,
        totalPrice: item ? Math.max(0, Number(item.price) || 0) * qty : 0
      }
    }
  }

  const plan = /执行\s*(?:方案)?(.+?)(?:会怎样|会怎么样|会缺什么|怎么样)/.exec(source)
  if (plan) {
    const value = plan[1].trim()
    const hit = current.plans.find((row) => row.title === value || row.title.indexOf(value) > -1 || value.indexOf(row.title) > -1)
    if (hit) return { kind: 'consume', planId: hit.id }
  }

  const remove = /(?:删掉|删除|移除)\s*(.+?)(?:会怎样|会怎么样|怎么样)/.exec(source)
  if (remove) {
    const value = remove[1].trim()
    const hit = current.libraries.flatMap((library) => library.items || [])
      .find((row) => row.name === value || row.name.indexOf(value) > -1 || value.indexOf(row.name) > -1)
    if (hit) return { kind: 'remove', itemId: hit.id }
  }
  return null
}

function snapshot(db: DB): ImpactSnapshot {
  const items = db.libraries.flatMap((library) => library.items || [])
  const stockUnits = items.reduce((sum, item) => sum + Math.max(0, Number(item.qty) || 0), 0)
  const expiring = items.filter((item) => item.expDays > 0 && item.expDays <= 7 && item.expDays < 9000).length
  const lowStock = items.filter((item) => (item.lowAt || 0) > 0 && item.qty <= (item.lowAt || 0)).length
  const budgetUsed = items.reduce((sum, item) => sum + Math.max(0, Number(item.price) || 0) * Math.max(0, Number(item.qty) || 0), 0)
  const health = Math.max(40, 100 - Math.round((expiring / Math.max(1, items.length)) * 100) - lowStock * 2)
  return {
    items: items.length,
    stockUnits,
    expiring,
    lowStock,
    budgetUsed: Math.round(budgetUsed * 100) / 100,
    health
  }
}

function cloneDb(db: DB): DB {
  return JSON.parse(JSON.stringify(db)) as DB
}

function makeItem(name: string, qty: number, price: number): Item {
  return {
    id: 'sim-' + name,
    no: 'SIM',
    name,
    emoji: '📦',
    qty,
    unit: '个',
    price,
    priceSrc: '推演输入',
    expDays: 0,
    pos: '待确认',
    lowAt: 0,
    addedAt: new Date().getDate()
  }
}

export function simulate(current: DB, scenario: Scenario): Impact {
  const next = cloneDb(current)
  const before = snapshot(current)
  const warnings: string[] = []

  if (scenario.kind === 'buy') {
    const existing = next.libraries.flatMap((library) => library.items || [])
      .find((item) => item.name === scenario.itemName)
    if (existing) {
      existing.qty += scenario.qty
    } else {
      const target = next.libraries[0]
      if (target) target.items.push(makeItem(scenario.itemName, scenario.qty, scenario.totalPrice / Math.max(1, scenario.qty)))
    }
    if (scenario.totalPrice > 0 && snapshot(next).budgetUsed > current.budget) {
      warnings.push('本次购买将超出月度预算 ¥' + Math.max(0, snapshot(next).budgetUsed - current.budget))
    }
  } else if (scenario.kind === 'consume') {
    const plan = next.plans.find((row) => row.id === scenario.planId)
    if (!plan) {
      warnings.push('没有找到要推演的执行方案')
    } else {
      plan.used.forEach((ingredient) => {
        const item = next.libraries.flatMap((library) => library.items || [])
          .find((row) => row.name === ingredient.name)
        if (!item) {
          warnings.push('库存中没有「' + ingredient.name + '」')
          return
        }
        const amount = parseFloat(ingredient.qty) || 1
        if (item.qty < amount) warnings.push('「' + item.name + '」执行后将不足')
        item.qty = Math.max(0, item.qty - amount)
      })
      plan.status = 'done'
    }
  } else if (scenario.kind === 'remove') {
    const library = next.libraries.find((row) => (row.items || []).some((item) => item.id === scenario.itemId))
    if (!library) {
      warnings.push('没有找到要推演的物品')
    } else {
      library.items = library.items.filter((item) => item.id !== scenario.itemId)
      library.count = library.items.length
    }
  } else {
    if (scenario.amount < 0) warnings.push('预算不能为负数')
    next.budget = Math.max(0, scenario.amount)
    if (snapshot(next).budgetUsed > next.budget) warnings.push('当前库存价值已超过新预算')
  }

  const after = snapshot(next)
  const delta: Record<string, number> = {}
  ;(Object.keys(before) as Array<keyof ImpactSnapshot>).forEach((key) => {
    delta[key] = Math.round((after[key] - before[key]) * 100) / 100
  })
  return { before, after, delta, warnings }
}
