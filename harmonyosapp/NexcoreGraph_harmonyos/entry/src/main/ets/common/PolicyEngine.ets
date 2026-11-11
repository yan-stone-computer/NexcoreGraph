import { AgentAction, PolicyDecision } from './AgentTypes';

const ALLOWED_KINDS: string[] = [
  'adjust_inventory',
  'set_medicine_dose',
  'add_shopping',
  'create_meal_plan',
  'execute_meal_plan',
  'resolve_alert',
  'create_library',
  'add_inventory',
  'create_coop',
  'join_coop',
  'dellib',
  'delitem',
  'moveitem',
  'renamelib'
];

let claimedActions: string[] = [];

export function checkPolicy(action: AgentAction, role: string, confirmed: boolean): PolicyDecision {
  const decision = new PolicyDecision();
  if (ALLOWED_KINDS.indexOf(action.kind) < 0) {
    decision.allowed = false;
    decision.reason = '工具不在白名单';
    return decision;
  }
  if (role === '只读' || role === 'readonly') {
    decision.allowed = false;
    decision.reason = '只读成员不能执行写操作';
    return decision;
  }
  if (action.target.trim() === '') {
    decision.allowed = false;
    decision.reason = '动作缺少目标对象';
    return decision;
  }
  if (action.qty < 0 || !isFinite(action.qty)) {
    decision.allowed = false;
    decision.reason = '数量必须是非负有限值';
    return decision;
  }
  decision.allowed = true;
  decision.requiresConfirmation = true;
  decision.reason = confirmed ? '用户已确认，允许执行' : '等待用户确认';
  return decision;
}

/** In-memory idempotency guard for the current process. */
export function claimActionOnce(executionKey: string): boolean {
  if (executionKey === '' || claimedActions.indexOf(executionKey) >= 0) {
    return false;
  }
  claimedActions.push(executionKey);
  return true;
}

export function resetActionGuardsForTest(): void {
  claimedActions = [];
}
