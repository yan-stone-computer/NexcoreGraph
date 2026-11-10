import { describe, expect, it } from '@ohos/hypium';
import { applyDataSnapshot } from '../main/ets/common/Continuation';
import { store } from '../main/ets/common/Store';

const snapshot: string = JSON.stringify({
  v: 1,
  libraries: [],
  plans: [],
  alerts: [],
  shopping: [],
  logs: [],
  settings: {},
  daily: [],
  chat: [{ who: 'me', text: '历史对话', time: '', plans: [], ts: 1 }],
  at: 1
});

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
  });
}
