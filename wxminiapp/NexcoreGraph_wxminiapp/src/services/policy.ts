import type { DB } from '@/types'
import type { Impact } from '@/services/simulation'

export type AgentStepKind = 'adjust_qty' | 'add_shopping' | 'execute_plan'

export interface AgentStep {
  id: string
  kind: AgentStepKind
  targetId: string
  label: string
  qty?: number
  evidenceRefs: string[]
}

export interface AgentProposal {
  id: string
  title: string
  summary: string
  steps: AgentStep[]
  impact: {
    expiringHandled: number
    shoppingAdded: number
    inventoryChanged: number
  }
}

export interface PolicyContext {
  actorRole: '管理员' | '成员' | '只读'
  agentProposal: AgentProposal
  currentState: DB
  simulatedImpact: Impact
}

export interface PolicyDecision {
  allow: boolean
  approval: 'none' | 'admin' | 'user'
  reasons: string[]
  blocked: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

export function evaluatePolicy(ctx: PolicyContext): PolicyDecision {
  const reasons: string[] = []
  const blocked: string[] = []
  let approval: PolicyDecision['approval'] = 'none'
  let riskLevel: PolicyDecision['riskLevel'] = 'low'
  const proposal = ctx.agentProposal

  if (ctx.actorRole === '只读') {
    blocked.push('只读成员不能执行写操作')
  }
  if (!proposal.steps.length) {
    blocked.push('Agent 方案没有可执行步骤')
  }
  if (proposal.steps.length > 3) {
    blocked.push('单次最多执行 3 个 Agent 动作')
  }
  if (proposal.steps.some((step) => !step.evidenceRefs.length)) {
    blocked.push('Agent 动作缺少依据')
  }

  const destructive = proposal.steps.some((step) => step.kind === 'adjust_qty' && step.qty === 0)
  if (destructive) {
    riskLevel = 'high'
    if (ctx.actorRole === '成员') approval = 'admin'
    reasons.push('库存清零或删除类动作需要管理员确认')
  }
  if (ctx.actorRole === '成员' && proposal.steps.length > 2) {
    riskLevel = riskLevel === 'high' ? riskLevel : 'medium'
    approval = 'admin'
    reasons.push('成员一次发起超过 2 个写动作，需要管理员确认')
  }
  if (ctx.simulatedImpact.warnings.length) {
    approval = approval === 'admin' ? approval : 'user'
    riskLevel = riskLevel === 'low' ? 'medium' : riskLevel
    reasons.push(...ctx.simulatedImpact.warnings)
  }
  if (!blocked.length && approval === 'none') {
    reasons.push('动作在角色权限和证据约束内，可由本人确认执行')
  }

  return {
    allow: blocked.length === 0,
    approval,
    reasons,
    blocked,
    riskLevel
  }
}
