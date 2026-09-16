/* 启核图策 · 跨设备自由流转（应用接续）
   目标：手机上正在做的步骤（当前页 / 打开的库或物品 / 浮层 / AI 对话状态 / 未确认动作）能在另一台
        同账号同网设备上原样接续，不需要重新点一遍。
   实现：onContinue 把"流程快照"写进 wantParam（纯文本、<4KB、不含图片二进制）；
        target 端 onCreate / onNewWant 读到 launchReason=CONTINUATION 时还原。
   红线与隐私：快照不含聊天正文与偏好（仅状态位），图片一律以 id/uri 引用，不随行传输。 */

import { AbilityConstant, Want } from '@kit.AbilityKit';
import { store } from './Store';

/** 快照键（wantParam 内） */
const FLOW_KEY: string = 'nexcoreFlow';
/** 快照结构版本：字段有增减时 +1，两端不一致则不接续（避免脏状态） */
const FLOW_VERSION: number = 1;

class FlowState {
  v: number = FLOW_VERSION;
  tab: number = 0;
  libId: string = '';
  overlay: string = '';
  overlayArg: string = '';
  overlayArg2: string = '';
  libMenuId: string = '';
  aiOpen: boolean = false;
  aiDraft: string = '';
  itemFilter: string = '';
  trendRange: string = '';
  at: number = 0;
}

/** 采集当前流程（只取"接着做"必需的状态位，越小越稳） */
export function buildFlowState(): string {
  const s = new FlowState();
  s.tab = store.tabIndex;
  s.libId = store.libId;
  s.overlay = store.overlay;
  s.overlayArg = store.overlayArg;
  s.overlayArg2 = store.overlayArg2;
  s.libMenuId = store.libMenuId;
  s.aiOpen = store.aiOpen;
  s.aiDraft = store.aiPrefill;
  s.itemFilter = store.itemFilter;
  s.trendRange = store.trendRange;
  s.at = Date.now();
  return JSON.stringify(s);
}

/** 源端：写入快照并同意接续；失败则拒绝（宁可重来，也不要半截状态） */
export function onContinueSave(wantParam: Record<string, Object>): AbilityConstant.OnContinueResult {
  try {
    const json = buildFlowState();
    if (json.length > 4096) {
      return AbilityConstant.OnContinueResult.MISMATCH;
    }
    wantParam[FLOW_KEY] = json;
    return AbilityConstant.OnContinueResult.AGREE;
  } catch (_e) {
    return AbilityConstant.OnContinueResult.REJECT;
  }
}

/** 目标端：还原流程；返回是否成功接续 */
export function restoreFlow(want: Want): boolean {
  const params = want.parameters;
  if (params === undefined) {
    return false;
  }
  const raw = params[FLOW_KEY];
  if (raw === undefined || raw === null) {
    return false;
  }
  try {
    const s = JSON.parse(String(raw)) as FlowState;
    if (s.v !== FLOW_VERSION) {
      store.toast('设备版本不一致，已打开首页');
      return false;
    }
    store.loggedIn = true;          // 接续意味着已登录态
    store.tabIndex = s.tab;
    store.libId = s.libId === undefined ? '' : s.libId;
    store.overlay = s.overlay === undefined ? '' : s.overlay;
    store.overlayArg = s.overlayArg === undefined ? '' : s.overlayArg;
    store.overlayArg2 = s.overlayArg2 === undefined ? '' : s.overlayArg2;
    store.libMenuId = s.libMenuId === undefined ? '' : s.libMenuId;
    store.aiOpen = s.aiOpen === undefined ? false : s.aiOpen;
    store.aiPrefill = s.aiDraft === undefined ? '' : s.aiDraft;
    store.itemFilter = s.itemFilter === undefined ? 'all' : s.itemFilter;
    store.trendRange = s.trendRange === undefined ? '7' : s.trendRange;
    store.toast('已从其他设备接续当前进度');
    return true;
  } catch (_e) {
    return false;
  }
}

/** 是否由接续启动 */
export function isContinuation(launchParam: AbilityConstant.LaunchParam): boolean {
  return launchParam.launchReason === AbilityConstant.LaunchReason.CONTINUATION;
}

/** 允许/禁止接续（登录页等敏感页禁止） */
export function allowContinue(enable: boolean): void {
  store.continueEnabled = enable;
}
