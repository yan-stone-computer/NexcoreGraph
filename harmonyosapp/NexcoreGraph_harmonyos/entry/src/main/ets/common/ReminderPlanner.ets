import { Item } from './Db';
import { DOMAIN_FITNESS, DOMAIN_MEDICINE, DOMAIN_TOOL, inferResourceDomain } from './ResourceDomain';

export class ReminderCandidate {
  dedupeKey: string = '';
  itemId: string = '';
  title: string = '';
  text: string = '';
  dayKey: number = 0;
}

/**
 * Build at most one local summary notification per day.
 * Private items stay out of system surfaces.
 */
export function planReminders(items: Item[], dayKey: number, enabled: boolean,
  deliveredKeys: string[]): ReminderCandidate[] {
  if (!enabled) {
    return [];
  }
  const due: Item[] = items.filter((item: Item): boolean => {
    if (item.isPrivate) {
      return false;
    }
    const domain: string = item.domain === '' ? inferResourceDomain(item.name) : item.domain;
    if (domain === DOMAIN_MEDICINE && item.dosePerDay > 0) {
      return Math.ceil(item.qty / item.dosePerDay) <= 3;
    }
    if (domain === DOMAIN_TOOL || domain === DOMAIN_FITNESS) {
      return item.maintenanceDays > 0 && item.maintenanceDays <= 3;
    }
    return item.expDays > 0 && item.expDays <= 3;
  });
  if (due.length === 0) {
    return [];
  }
  due.sort((a: Item, b: Item): number => a.expDays - b.expDays);
  const ids: string[] = due.map((item: Item): string => item.id);
  const dedupeKey: string = `${dayKey}:${ids.join(',')}`;
  if (deliveredKeys.indexOf(dedupeKey) >= 0) {
    return [];
  }

  const candidate = new ReminderCandidate();
  candidate.dedupeKey = dedupeKey;
  candidate.itemId = due[0].id;
  candidate.dayKey = dayKey;
  candidate.title = `${due.length} 项资源需要处理`;
  candidate.text = due.slice(0, 3).map((item: Item): string => {
    const domain: string = item.domain === '' ? inferResourceDomain(item.name) : item.domain;
    if (domain === DOMAIN_MEDICINE && item.dosePerDay > 0) {
      return `${item.name}约${Math.ceil(item.qty / item.dosePerDay)}天用完`;
    }
    if (domain === DOMAIN_TOOL || domain === DOMAIN_FITNESS) {
      return `${item.name}${item.maintenanceDays}天后维护`;
    }
    return `${item.name}还剩${item.expDays}天`;
  }).join(' · ');
  return [candidate];
}
