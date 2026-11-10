import { describe, expect, it } from '@ohos/hypium';
import { Item } from '../main/ets/common/Db';
import { planReminders, ReminderCandidate } from '../main/ets/common/ReminderPlanner';

function item(name: string, expDays: number, isPrivate: boolean = false): Item {
  const value = new Item(name, name, '📦', '', '', 1, '个', 0, '手动', expDays, '冰箱', expDays <= 3);
  value.isPrivate = isPrivate;
  return value;
}

export default function reminderPlannerTest() {
  describe('reminderPlanner', () => {
    it('plans one reminder for a due item', 0, () => {
      const result = planReminders([item('牛奶', 2)], 20261110, true, []);
      expect(result.length).assertEqual(1);
      expect(result[0].itemId).assertEqual('牛奶');
    });

    it('uses a stable dedupe key for the same item and day', 0, () => {
      const a = planReminders([item('牛奶', 2)], 20261110, true, []);
      const b = planReminders([item('牛奶', 2)], 20261110, true, []);
      expect(a[0].dedupeKey).assertEqual(b[0].dedupeKey);
    });

    it('does not repeat already delivered reminders', 0, () => {
      const first = planReminders([item('牛奶', 2)], 20261110, true, []);
      const second = planReminders([item('牛奶', 2)], 20261110, true, [first[0].dedupeKey]);
      expect(second.length).assertEqual(0);
    });

    it('skips private items and disabled reminders', 0, () => {
      const privateItems = planReminders([item('药盒', 1, true)], 20261110, true, []);
      const disabled = planReminders([item('牛奶', 2)], 20261110, false, []);
      expect(privateItems.length).assertEqual(0);
      expect(disabled.length).assertEqual(0);
    });

    it('produces a readable summary', 0, () => {
      const result: ReminderCandidate[] = planReminders(
        [item('牛奶', 2), item('鸡蛋', 3)], 20261110, true, []);
      expect(result.length).assertEqual(1);
      expect(result[0].text.indexOf('牛奶') >= 0).assertTrue();
      expect(result[0].text.indexOf('鸡蛋') >= 0).assertTrue();
    });
  });
}
