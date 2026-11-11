import { describe, expect, it } from '@ohos/hypium';
import {
  DOMAIN_FITNESS, DOMAIN_FOOD, DOMAIN_MEDICINE, DOMAIN_TOOL, domainIcon, inferResourceDomain
} from '../main/ets/common/ResourceDomain';

export default function resourceDomainTest() {
  describe('resourceDomain', () => {
    it('classifies medicine before food words', 0, () => {
      expect(inferResourceDomain('宠物药', '', '')).assertEqual(DOMAIN_MEDICINE);
    });

    it('classifies dumbbells as fitness equipment', 0, () => {
      expect(inferResourceDomain('哑铃', '健身角', '')).assertEqual(DOMAIN_FITNESS);
    });

    it('classifies screwdrivers as tools', 0, () => {
      expect(inferResourceDomain('十字螺丝刀', '工具箱', '')).assertEqual(DOMAIN_TOOL);
    });

    it('classifies milk as food', 0, () => {
      expect(inferResourceDomain('鲜牛奶', '冰箱', '')).assertEqual(DOMAIN_FOOD);
    });

    it('provides domain-specific default icons', 0, () => {
      expect(domainIcon(DOMAIN_MEDICINE)).assertEqual('pill');
      expect(domainIcon(DOMAIN_FITNESS)).assertEqual('dumbbell');
      expect(domainIcon(DOMAIN_TOOL)).assertEqual('wrench');
    });
  });
}
