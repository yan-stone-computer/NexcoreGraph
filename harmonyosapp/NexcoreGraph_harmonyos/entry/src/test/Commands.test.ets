import { beforeEach, describe, expect, it } from '@ohos/hypium';
import { Item, Library } from '../main/ets/common/Db';
import { store } from '../main/ets/common/Store';
import { applyCmdOp, matchCommand, runCommand, CmdMatch, CmdReply } from '../main/ets/common/Commands';
import { resetActionGuardsForTest } from '../main/ets/common/PolicyEngine';

function resetInventory(): Item {
  const carrot = new Item('carrot', '胡萝卜', '🥕', '', '', 4, '个', 0, '手动', 0, '冷藏区', false);
  const fridge = new Library('fridge', '冰箱', 'fridge', 'teal', 1, '1 件', [carrot]);
  store.libraries = [fridge];
  store.userRole = '管理员';
  resetActionGuardsForTest();
  return carrot;
}

export default function commandsTest() {
  describe('commands', () => {
    beforeEach(() => {
      resetInventory();
    });

    it('previews a quantity change before writing inventory', 0, async () => {
      const carrot = resetInventory();
      const match: CmdMatch | null = matchCommand('胡萝卜只剩2个');
      expect(match !== null).assertTrue();
      const reply: CmdReply = await runCommand(match as CmdMatch);
      expect(reply.opKind).assertEqual('qty');
      expect(reply.opLabel.indexOf('胡萝卜') >= 0).assertTrue();
      expect(carrot.qty).assertEqual(4);
    });

    it('applies the confirmed quantity change', 0, async () => {
      const carrot = resetInventory();
      const match: CmdMatch | null = matchCommand('胡萝卜只剩2个');
      const preview: CmdReply = await runCommand(match as CmdMatch);
      await applyCmdOp(preview.opKind, preview.opArg, 'test:qty');
      expect(carrot.qty).assertEqual(2);
    });
  });
}
