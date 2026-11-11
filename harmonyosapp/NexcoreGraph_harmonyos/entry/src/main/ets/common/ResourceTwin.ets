/* 家庭资源数字孪生：按日扣减库存，预测耗尽、临期浪费与资源健康度。
   所有数字由本文件确定性计算，模型不得参与。 */

import { Item } from './Db';
import {
  DOMAIN_FOOD, DOMAIN_MEDICINE, DOMAIN_TOOL, DOMAIN_FITNESS, inferResourceDomain
} from './ResourceDomain';

export class TwinItemInput {
  id: string = '';
  name: string = '';
  qty: number = 0;
  unit: string = '个';
  expDays: number = 0;
  dailyUse: number = 0;
  hasPosition: boolean = false;
  domain: string = 'other';
  dosePerDay: number = 0;
  maintenanceDays: number = 0;
}

export class TwinScenario {
  horizonDays: number = 7;
  basePeople: number = 3;
  extraPeople: number = 0;
  mealsPerDay: number = 3;
  savedMeals: number = 0;
}

export class TwinRisk {
  itemId: string = '';
  itemName: string = '';
  type: string = '';
  day: number = 0;
  qty: number = 0;
  unit: string = '';
  message: string = '';
}

export class TwinPoint {
  day: number = 0;
  qty: number = 0;
}

export class TwinProjection {
  itemId: string = '';
  itemName: string = '';
  points: TwinPoint[] = [];
}

export class TwinScore {
  freshness: number = 0;
  supply: number = 0;
  completeness: number = 0;
  response: number = 0;
  total: number = 0;
}

export class TwinResult {
  score: number = 0;
  breakdown: TwinScore = new TwinScore();
  risks: TwinRisk[] = [];
  projections: TwinProjection[] = [];
  shortageCount: number = 0;
  wasteRiskCount: number = 0;
  actionHints: string[] = [];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function familyFactor(s: TwinScenario): number {
  const base: number = s.basePeople > 0 ? s.basePeople : 1;
  return Math.max(0.1, (base + Math.max(0, s.extraPeople)) / base);
}

function mealFactor(s: TwinScenario): number {
  const meals: number = s.mealsPerDay > 0 ? s.mealsPerDay : 1;
  return Math.max(0, (meals - Math.max(0, s.savedMeals)) / meals);
}

function addHint(result: TwinResult, hint: string): void {
  if (result.actionHints.length < 4 && result.actionHints.indexOf(hint) < 0) {
    result.actionHints.push(hint);
  }
}

/** 无逐物品消耗日志时，按保质期给出保守的参考日耗。 */
export function estimateDailyUse(item: Item): number {
  const domain: string = item.domain !== '' ? item.domain : inferResourceDomain(item.name);
  if (domain === DOMAIN_MEDICINE) {
    return Math.max(0, item.dosePerDay);
  }
  if (domain !== DOMAIN_FOOD) {
    return 0;
  }
  if (item.qty <= 0) {
    return 0;
  }
  if (item.expDays > 0 && item.expDays <= 3) {
    return 0.8;
  }
  if (item.expDays > 3 && item.expDays <= 7) {
    return 0.5;
  }
  if (item.expDays > 7 && item.expDays <= 30) {
    return 0.2;
  }
  if (item.expDays > 30) {
    return 0.1;
  }
  return 0.05;
}

export function itemToTwinInput(item: Item, libraryName: string = ''): TwinItemInput {
  const input = new TwinItemInput();
  input.id = item.id;
  input.name = item.name;
  input.qty = item.qty;
  input.unit = item.unit;
  input.expDays = item.expDays;
  input.dailyUse = estimateDailyUse(item);
  input.hasPosition = item.pos !== '' && item.pos !== '未设置';
  input.domain = item.domain !== '' ? item.domain :
    inferResourceDomain(item.name, libraryName);
  input.dosePerDay = Math.max(0, item.dosePerDay);
  input.maintenanceDays = Math.max(0, item.maintenanceDays);
  return input;
}

/**
 * Simulate a household inventory for a fixed horizon.
 * dailyUse is the baseline use per day; household size and meal count scale it.
 */
export function simulateTwin(items: TwinItemInput[], scenario: TwinScenario): TwinResult {
  const result = new TwinResult();
  if (items.length === 0) {
    result.actionHints.push('先扫码或拍照建立资源库，再进行未来风险推演');
    return result;
  }

  const horizon: number = Math.max(1, Math.min(90, Math.round(scenario.horizonDays)));
  const foodUseFactor: number = familyFactor(scenario) * mealFactor(scenario);
  let incomplete: number = 0;

  items.forEach((item: TwinItemInput): void => {
    if (!item.hasPosition) {
      incomplete += 1;
    }

    const startQty: number = Math.max(0, item.qty);
    const domain: string = item.domain === '' ? inferResourceDomain(item.name) : item.domain;
    const useFactor: number = domain === DOMAIN_FOOD ? foodUseFactor : 1;
    const baseDaily: number = domain === DOMAIN_MEDICINE ? item.dosePerDay : item.dailyUse;
    const daily: number = Math.max(0, baseDaily) * useFactor;
    const projection = new TwinProjection();
    projection.itemId = item.id;
    projection.itemName = item.name;
    for (let day: number = 0; day <= horizon; day++) {
      const point = new TwinPoint();
      point.day = day;
      point.qty = Math.max(0, startQty - daily * day);
      projection.points.push(point);
    }
    result.projections.push(projection);

    if (daily > 0 && startQty > 0) {
      const shortageDay: number = Math.ceil(startQty / daily);
      if (shortageDay <= horizon) {
        const risk = new TwinRisk();
        risk.itemId = item.id;
        risk.itemName = item.name;
        risk.type = domain === DOMAIN_MEDICINE ? 'refill' : 'shortage';
        risk.day = shortageDay;
        risk.qty = Math.ceil(daily * shortageDay - startQty);
        risk.unit = item.unit;
        risk.message = `第 ${shortageDay} 天「${item.name}」预计耗尽`;
        result.risks.push(risk);
        result.shortageCount += 1;
        addHint(result, `建议第 ${Math.max(1, shortageDay - 1)} 天前补货「${item.name}」`);
      }
    } else if (startQty <= 0 && domain !== DOMAIN_TOOL && domain !== DOMAIN_FITNESS) {
      const risk = new TwinRisk();
      risk.itemId = item.id;
      risk.itemName = item.name;
      risk.type = domain === DOMAIN_MEDICINE ? 'refill' : 'shortage';
      risk.day = 0;
      risk.unit = item.unit;
      risk.message = `「${item.name}」当前已无库存`;
      result.risks.push(risk);
      result.shortageCount += 1;
      addHint(result, `优先补充「${item.name}」`);
    }

    if (domain === DOMAIN_FOOD && item.expDays > 0 && item.expDays <= horizon) {
      const remaining: number = Math.max(0, startQty - daily * item.expDays);
      if (remaining > 0) {
        const risk = new TwinRisk();
        risk.itemId = item.id;
        risk.itemName = item.name;
        risk.type = 'waste';
        risk.day = Math.max(1, Math.round(item.expDays));
        risk.qty = Math.ceil(remaining);
        risk.unit = item.unit;
        risk.message = `「${item.name}」到期时预计仍剩 ${risk.qty}${item.unit}`;
        result.risks.push(risk);
        result.wasteRiskCount += 1;
        addHint(result, `把「${item.name}」安排进 ${risk.day} 天内的优先消耗计划`);
      }
    }

    if ((domain === DOMAIN_TOOL || domain === DOMAIN_FITNESS) && item.maintenanceDays > 0 &&
      item.maintenanceDays <= horizon) {
      const risk = new TwinRisk();
      risk.itemId = item.id;
      risk.itemName = item.name;
      risk.type = 'maintenance';
      risk.day = Math.round(item.maintenanceDays);
      risk.qty = 1;
      risk.unit = item.unit;
      risk.message = `第 ${risk.day} 天「${item.name}」需要检查或维护`;
      result.risks.push(risk);
      addHint(result, `安排「${item.name}」维护检查`);
    }

    if ((domain === DOMAIN_TOOL || domain === DOMAIN_FITNESS) && startQty <= 0) {
      const risk = new TwinRisk();
      risk.itemId = item.id;
      risk.itemName = item.name;
      risk.type = 'unavailable';
      risk.day = 0;
      risk.unit = item.unit;
      risk.message = `「${item.name}」当前不可用`;
      result.risks.push(risk);
      addHint(result, `确认「${item.name}」是否借用、维修或补购`);
    }
  });

  if (incomplete > 0) {
    addHint(result, `补全 ${incomplete} 项物品的位置信息，可提高预测可信度`);
  }

  const urgent: number = result.risks.filter((risk: TwinRisk): boolean => risk.day <= 3).length;
  const score = new TwinScore();
  score.freshness = clamp(40 - result.wasteRiskCount * 10, 0, 40);
  score.supply = clamp(25 - result.shortageCount * 5, 0, 25);
  score.completeness = clamp(20 - incomplete * 2, 0, 20);
  score.response = clamp(15 - urgent * 3, 0, 15);
  score.total = clamp(score.freshness + score.supply + score.completeness + score.response, 0, 100);
  result.breakdown = score;
  result.score = score.total;
  return result;
}
