import { Item } from './Db';

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
  const due: Item[] = items.filter((item: Item): boolean =>
    !item.isPrivate && item.expDays > 0 && item.expDays <= 3);
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
  candidate.title = `${due.length} 项资源即将临期`;
  candidate.text = due.slice(0, 3).map((item: Item): string =>
    `${item.name}还剩${item.expDays}天`).join(' · ');
  return [candidate];
}
