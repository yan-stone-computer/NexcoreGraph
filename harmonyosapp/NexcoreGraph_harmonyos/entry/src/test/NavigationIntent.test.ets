import { describe, expect, it } from '@ohos/hypium';
import { parseEntryTarget } from '../main/ets/common/NavigationIntent';

export default function navigationIntentTest() {
  describe('navigationIntent', () => {
    it('accepts known card and notification targets', 0, () => {
      expect(parseEntryTarget('alerts')).assertEqual('alerts');
      expect(parseEntryTarget('intake')).assertEqual('intake');
      expect(parseEntryTarget('ai')).assertEqual('ai');
    });

    it('rejects unknown and non-string targets', 0, () => {
      expect(parseEntryTarget('unknown')).assertEqual('');
      expect(parseEntryTarget(undefined)).assertEqual('');
      expect(parseEntryTarget(1)).assertEqual('');
    });
  });
}
