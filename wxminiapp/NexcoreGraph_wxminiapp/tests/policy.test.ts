import { describe, expect, it } from 'vitest'
import { evaluatePolicy } from '../src/services/policy'
import type { AgentProposal, PolicyContext } from '../src/services/policy'

function proposal(overrides: Partial<AgentProposal> = {}): AgentProposal {
  return {
    id: 'proposal-1',
    title: '处理临期牛奶',
    summary: '先排入计划，再补采购',
    steps: [{
      id: 'step-1',
      kind: 'add_shopping',
      targetId: 'milk',
      label: '补充牛奶',
      evidenceRefs: ['item:milk']
    }],
    impact: { expiringHandled: 1, shoppingAdded: 1, inventoryChanged: 0 },
    ...overrides
  }
}

function context(role: PolicyContext['actorRole'], value = proposal()): PolicyContext {
  return {
    actorRole: role,
    agentProposal: value,
    currentState: { user: { role }, libraries: [], shopping: [], plans: [] } as any,
    simulatedImpact: {
      before: { items: 0, expiring: 0, lowStock: 0, budgetUsed: 0, health: 100 },
      after: { items: 0, expiring: 0, lowStock: 0, budgetUsed: 0, health: 100 },
      delta: {},
      warnings: []
    }
  }
}

describe('agent policy', () => {
  it('blocks read-only users', () => {
    const decision = evaluatePolicy(context('只读'))
    expect(decision.allow).toBe(false)
    expect(decision.blocked).toContain('只读成员不能执行写操作')
  })

  it('requires evidence for every write action', () => {
    const decision = evaluatePolicy(context('成员', proposal({
      steps: [{ id: 's1', kind: 'add_shopping', targetId: 'milk', label: '牛奶', evidenceRefs: [] }]
    })))
    expect(decision.allow).toBe(false)
    expect(decision.blocked).toContain('Agent 动作缺少依据')
  })

  it('requires admin approval for delete-like adjustments', () => {
    const decision = evaluatePolicy(context('成员', proposal({
      steps: [{ id: 's1', kind: 'adjust_qty', targetId: 'milk', label: '牛奶改为 0', qty: 0, evidenceRefs: ['p1'] }]
    })))
    expect(decision.approval).toBe('admin')
    expect(decision.riskLevel).toBe('high')
  })
})
