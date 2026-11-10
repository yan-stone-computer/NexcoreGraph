import { describe, expect, it, beforeEach } from '@ohos/hypium';
import { AgentAction } from '../main/ets/common/AgentTypes';
import { checkPolicy, claimActionOnce, resetActionGuardsForTest } from '../main/ets/common/PolicyEngine';

function action(kind: string, qty: number = 1): AgentAction {
  const value = new AgentAction();
  value.id = 'a1';
  value.kind = kind;
  value.target = '牛奶';
  value.qty = qty;
  return value;
}

export default function policyEngineTest() {
  describe('policyEngine', () => {
    beforeEach(() => {
      resetActionGuardsForTest();
    });

    it('requires confirmation for a valid write action', 0, () => {
      const decision = checkPolicy(action('adjust_inventory'), '管理员', false);
      expect(decision.allowed).assertTrue();
      expect(decision.requiresConfirmation).assertTrue();
      expect(decision.reason.indexOf('确认') >= 0).assertTrue();
    });

    it('blocks writes for readonly users', 0, () => {
      const decision = checkPolicy(action('adjust_inventory'), '只读', true);
      expect(decision.allowed).assertFalse();
      expect(decision.reason.indexOf('只读') >= 0).assertTrue();
    });

    it('blocks unknown tools and negative quantities', 0, () => {
      expect(checkPolicy(action('delete_all'), '管理员', true).allowed).assertFalse();
      expect(checkPolicy(action('adjust_inventory', -1), '管理员', true).allowed).assertFalse();
    });

    it('claims the same action id only once', 0, () => {
      expect(claimActionOnce('trace-a:a1')).assertTrue();
      expect(claimActionOnce('trace-a:a1')).assertFalse();
    });
  });
}
