import { describe, expect, it } from '@ohos/hypium';
import { applyDataSnapshot, buildDataSnapshot } from '../main/ets/common/Continuation';
import { store } from '../main/ets/common/Store';
import { Item, Library } from '../main/ets/common/Db';

class ChatFixture {
  who: string = 'me';
  text: string = '历史对话';
  time: string = '';
  plans: number[] = [];
  ts: number = 1;
}

class SnapshotFixture {
  v: number = 1;
  libraries: Object[] = [];
  plans: Object[] = [];
  alerts: Object[] = [];
  shopping: Object[] = [];
  logs: Object[] = [];
  settings: Record<string, boolean> = {};
  daily: Object[] = [];
  chat: ChatFixture[] = [new ChatFixture()];
  at: number = 1;
}

const snapshot: string = JSON.stringify(new SnapshotFixture());

export default function localRestoreTest() {
  describe('localRestore', () => {
    it('does not open the AI sheet when restoring local history', 0, () => {
      store.chat = [];
      store.aiOpen = false;
      applyDataSnapshot(snapshot, false);
      expect(store.aiOpen).assertFalse();
    });

    it('opens the AI sheet for a newly received remote chat', 0, () => {
      store.chat = [];
      store.aiOpen = false;
      applyDataSnapshot(snapshot, true);
      expect(store.aiOpen).assertTrue();
    });

    it('preserves resource domain and medicine fields across snapshots', 0, () => {
      const lib = new Library('med-lib', '药盒', 'package', 'teal', 1, '1 件', [], 'medicine');
      const item = new Item('med', '退烧药', '💊', '', '', 8, '片', 0, '手动', 90, '药盒',
        false, 'medicine', 2, 30);
      lib.items = [item];
      store.libraries = [lib];
      const raw = buildDataSnapshot();
      store.libraries = [];
      applyDataSnapshot(raw, false);
      expect(store.libraries[0].domain).assertEqual('medicine');
      expect(store.libraries[0].items[0].domain).assertEqual('medicine');
      expect(store.libraries[0].items[0].dosePerDay).assertEqual(2);
      expect(store.libraries[0].items[0].maintenanceDays).assertEqual(30);
    });

    it('upgrades legacy package icons from restored resource domains', 0, () => {
      store.libraries = [new Library('med-icon', '药盒', 'package', 'teal', 0, '0 件', [], 'medicine')];
      store.repairResourceDomains();
      expect(store.libraries[0].icon).assertEqual('pill');
    });
  });
}
