import { describe, expect, it } from '@ohos/hypium';
import { applyDataSnapshot } from '../main/ets/common/Continuation';
import { store } from '../main/ets/common/Store';

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
  });
}
