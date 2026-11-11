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
  item.domain = 'food';
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

    it('does not scale medicine by guest meals', 0, () => {
      const med = new TwinItemInput();
      med.id = 'med';
      med.name = '退烧药';
      med.domain = 'medicine';
      med.qty = 4;
      med.unit = '片';
      med.dosePerDay = 1;
      med.hasPosition = true;
      const normal = simulateTwin([med], scenario(0));
      const guests = simulateTwin([med], scenario(3));
      expect(normal.risks[0].day).assertEqual(guests.risks[0].day);
    });

    it('does not create daily shortage risk for a screwdriver', 0, () => {
      const tool = new TwinItemInput();
      tool.id = 'tool';
      tool.name = '十字螺丝刀';
      tool.domain = 'tool';
      tool.qty = 1;
      tool.unit = '把';
      tool.hasPosition = true;
      const result = simulateTwin([tool], scenario());
      expect(result.shortageCount).assertEqual(0);
    });

    it('surfaces tool maintenance within the horizon', 0, () => {
      const tool = new TwinItemInput();
      tool.id = 'tool-maintenance';
      tool.name = '电钻';
      tool.domain = 'tool';
      tool.qty = 1;
      tool.unit = '台';
      tool.maintenanceDays = 3;
      tool.hasPosition = true;
      const result = simulateTwin([tool], scenario());
      expect(result.risks.some((risk: TwinRisk): boolean => risk.type === 'maintenance')).assertTrue();
    });
  });
}
