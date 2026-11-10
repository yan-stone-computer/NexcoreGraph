import { describe, expect, it } from '@ohos/hypium';
import {
  estimateDailyUse, itemToTwinInput, simulateTwin, TwinItemInput, TwinRisk, TwinScenario
} from '../main/ets/common/ResourceTwin';
import { Item } from '../main/ets/common/Db';

function milk(qty: number, dailyUse: number): TwinItemInput {
  const item = new TwinItemInput();
  item.id = 'milk';
  item.name = '牛奶';
  item.qty = qty;
  item.unit = '盒';
  item.expDays = 5;
  item.dailyUse = dailyUse;
  item.hasPosition = true;
  return item;
}

function scenario(extraPeople: number = 0): TwinScenario {
  const value = new TwinScenario();
  value.horizonDays = 7;
  value.basePeople = 3;
  value.extraPeople = extraPeople;
  value.mealsPerDay = 3;
  return value;
}

export default function resourceTwinTest() {
  describe('resourceTwin', () => {
    it('finds the first out-of-stock day', 0, () => {
      const result = simulateTwin([milk(2, 1)], scenario());
      const shortage = result.risks.find((risk: TwinRisk): boolean =>
        risk.itemId === 'milk' && risk.type === 'shortage');
      expect(shortage !== undefined).assertTrue();
      expect(shortage === undefined ? -1 : shortage.day).assertEqual(2);
    });

    it('makes stock run out earlier when guests arrive', 0, () => {
      const normal = simulateTwin([milk(3, 1)], scenario(0));
      const guests = simulateTwin([milk(3, 1)], scenario(3));
      const normalDay = normal.risks.find((risk: TwinRisk): boolean =>
        risk.type === 'shortage');
      const guestDay = guests.risks.find((risk: TwinRisk): boolean =>
        risk.type === 'shortage');
      expect(normalDay !== undefined && guestDay !== undefined).assertTrue();
      expect((normalDay === undefined ? 99 : normalDay.day) >
        (guestDay === undefined ? 99 : guestDay.day)).assertTrue();
    });

    it('detects waste risk before expiry', 0, () => {
      const item = milk(1, 0);
      item.expDays = 2;
      const result = simulateTwin([item], scenario());
      expect(result.risks.some((risk: TwinRisk): boolean =>
        risk.type === 'waste')).assertTrue();
    });

    it('returns a zero score for an empty inventory', 0, () => {
      const result = simulateTwin([], scenario());
      expect(result.score).assertEqual(0);
      expect(result.actionHints.length > 0).assertTrue();
    });

    it('maps an inventory item to a deterministic twin input', 0, () => {
      const item = new Item('milk', '牛奶', '🥛', '', 'milk', 2, '盒', 10, '手动', 2, '冷藏区', false);
      const input = itemToTwinInput(item);
      expect(input.dailyUse).assertEqual(estimateDailyUse(item));
      expect(input.hasPosition).assertTrue();
    });
  });
}
