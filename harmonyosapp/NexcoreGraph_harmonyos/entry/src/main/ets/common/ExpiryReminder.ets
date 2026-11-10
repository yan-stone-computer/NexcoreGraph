import { common, wantAgent } from '@kit.AbilityKit';
import { notificationManager } from '@kit.NotificationKit';
import { store } from './Store';
import { Item, Library } from './Db';
import { planReminders, ReminderCandidate } from './ReminderPlanner';

const REMINDER_ID: number = 71001;

function dayKey(): number {
  const now = new Date();
  const month: string = String(now.getMonth() + 1).padStart(2, '0');
  const day: string = String(now.getDate()).padStart(2, '0');
  return Number(`${now.getFullYear()}${month}${day}`);
}

function gatherItems(): Item[] {
  const items: Item[] = [];
  store.libraries.forEach((lib: Library): void => {
    lib.items.forEach((item: Item): void => items.push(item));
  });
  return items;
}

async function openAlertsAgent(ctx: common.UIAbilityContext): Promise<wantAgent.WantAgent> {
  const info: wantAgent.WantAgentInfo = {
    wants: [{
      bundleName: ctx.abilityInfo.bundleName,
      abilityName: ctx.abilityInfo.name,
      parameters: {
        'target': 'alerts'
      }
    }],
    actionType: wantAgent.OperationType.START_ABILITY,
    requestCode: REMINDER_ID,
    wantAgentFlags: [wantAgent.WantAgentFlags.UPDATE_PRESENT_FLAG]
  };
  return await wantAgent.getWantAgent(info);
}

/**
 * Ask for notification permission and publish today's single summary notification.
 * Returns a user-readable status message.
 */
export async function publishExpiryReminder(ctx: common.UIAbilityContext,
  requestPermission: boolean = true): Promise<string> {
  if (!store.settings['expiry']) {
    return '系统提醒已关闭，请先开启临期提醒';
  }
  if (requestPermission) {
    await notificationManager.requestEnableNotification(ctx);
  }
  const candidateList: ReminderCandidate[] = planReminders(gatherItems(), dayKey(), true, []);
  if (candidateList.length === 0) {
    return '近 3 天没有需要提醒的临期资源';
  }
  const candidate: ReminderCandidate = candidateList[0];
  const agent = await openAlertsAgent(ctx);
  const request: notificationManager.NotificationRequest = {
    id: REMINDER_ID,
    appMessageId: candidate.dedupeKey,
    notificationSlotType: notificationManager.SlotType.OTHER_TYPES,
    wantAgent: agent,
    content: {
      notificationContentType: notificationManager.ContentType.NOTIFICATION_CONTENT_BASIC_TEXT,
      normal: {
        title: candidate.title,
        text: candidate.text
      }
    }
  };
  await notificationManager.publish(request);
  return `已发送：${candidate.text}`;
}
