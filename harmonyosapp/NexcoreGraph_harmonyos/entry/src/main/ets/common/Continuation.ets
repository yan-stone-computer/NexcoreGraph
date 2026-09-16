/* 启核图策 · 跨设备自由流转（应用接续）
   目标：手机上正在做的步骤（当前页 / 打开的库或物品 / 浮层 / AI 对话状态 / 未确认动作）能在另一台
        同账号同网设备上原样接续，不需要重新点一遍。
   实现：onContinue 把"流程快照"写进 wantParam（纯文本、<4KB、不含图片二进制）；
        target 端 onCreate / onNewWant 读到 launchReason=CONTINUATION 时还原。
   红线与隐私：快照不含聊天正文与偏好（仅状态位），图片一律以 id/uri 引用，不随行传输。 */

import { AbilityConstant, Want } from '@kit.AbilityKit';
import { store, LogRow } from './Store';
import { Library, Item, Plan, AlertItem, ShoppingItem } from './Db';

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

/* 数据快照：自由流转不只是"页面"，库里的数据也要跟着走（演示/兜底通道用）。
   注意：@ObservedV2 实例直接 JSON.stringify 出来是 __ob_xxx 前缀字段、且 Resource 会被展开，
   所以必须走显式 DTO（下面这几个结构体），两端都按同一份字段读写。 */

class ItemDto {
  id: string = '';
  no: string = '';
  name: string = '';
  emoji: string = '';
  kbKey: string = '';
  qty: number = 1;
  unit: string = '个';
  price: number = 0;
  priceSrc: string = '手动';
  expDays: number = 7;
  pos: string = '未设置';
  isPrivate: boolean = false;
  expiring: boolean = false;
}

class LibDto {
  id: string = '';
  name: string = '';
  icon: string = 'package';
  tone: string = 'teal';
  count: number = 0;
  desc: string = '';
  coop: boolean = false;
  coopFrom: string = '';
  coopAddOnly: boolean = false;
  of: string = '';
  tag: string = '';
  items: ItemDto[] = [];
}

class PlanDto {
  id: number = 0;
  title: string = '';
  priority: string = '中';
  reason: string = '';
  time: string = '';
  source: string = '知识库';
  status: string = 'pending';
  selected: string[] = [];
  kcal: number = 0;
}

class DataPayload {
  v: number = FLOW_VERSION;
  libraries: LibDto[] = [];
  plans: PlanDto[] = [];
  at: number = 0;
}

/** 采集数据快照（库 / 物品 / 方案 / 预警 / 采购清单 / 最近日志） */
export function buildDataSnapshot(): string {
  const p = new DataPayload();
  p.libraries = store.libraries.map((l: Library): LibDto => {
    const d = new LibDto();
    d.id = l.id;
    d.name = l.name;
    d.icon = l.icon;
    d.tone = l.tone;
    d.count = l.count;
    d.desc = l.desc;
    d.coop = l.coop;
    d.coopFrom = l.coopFrom;
    d.coopAddOnly = l.coopAddOnly;
    d.of = l.of;
    d.tag = l.tag;
    d.items = l.items.map((it: Item): ItemDto => {
      const i = new ItemDto();
      i.id = it.id;
      i.no = it.no;
      i.name = it.name;
      i.emoji = it.emoji;
      i.kbKey = it.kbKey;
      i.qty = it.qty;
      i.unit = it.unit;
      i.price = it.price;
      i.priceSrc = it.priceSrc;
      i.expDays = it.expDays;
      i.pos = it.pos;
      i.isPrivate = it.isPrivate;
      i.expiring = it.expiring;
      return i;
    });
    return d;
  });
  p.plans = store.plans.map((pl: Plan): PlanDto => {
    const d = new PlanDto();
    d.id = pl.id;
    d.title = pl.title;
    d.priority = pl.priority;
    d.reason = pl.reason;
    d.time = pl.time;
    d.source = pl.source;
    d.status = pl.status;
    d.selected = pl.selected === undefined ? [] : pl.selected;
    d.kcal = pl.kcal;
    return d;
  });
  p.at = Date.now();
  return JSON.stringify(p);
}

/** 落地数据快照；返回导入的物品件数，失败返回 -1 */
export function applyDataSnapshot(raw: string): number {
  try {
    const p = JSON.parse(raw) as DataPayload;
    if (p.v !== FLOW_VERSION || p.libraries === undefined) {
      return -1;
    }
    /* 必须重建真实实例：@ObservedV2 数组里塞 JSON 纯对象会在渲染时 TypeError 崩溃
       （图片不入流转快照，物品回落 emoji 显示） */
    const libs: Library[] = [];
    p.libraries.forEach((l: LibDto): void => {
      const items: Item[] = [];
      if (l.items !== undefined) {
        l.items.forEach((it: ItemDto): void => {
          const ni = new Item(it.id, it.name, it.emoji, '', it.kbKey, it.qty, it.unit,
            it.price, it.priceSrc, it.expDays, it.pos, it.expiring);
          ni.no = it.no;
          ni.isPrivate = it.isPrivate;
          items.push(ni);
        });
      }
      const lib = new Library(l.id, l.name, l.icon, l.tone, l.count, l.desc, items);
      lib.coop = l.coop;
      lib.coopFrom = l.coopFrom;
      lib.coopAddOnly = l.coopAddOnly;
      lib.of = l.of;
      lib.tag = l.tag;
      libs.push(lib);
    });
    store.libraries = libs;

    const plans: Plan[] = [];
    if (p.plans !== undefined) {
      p.plans.forEach((pl: PlanDto): void => {
        const np = new Plan(pl.id, pl.title, pl.priority, pl.reason, pl.time, pl.source,
          [], [], pl.status);
        np.selected = pl.selected === undefined ? [] : pl.selected;
        np.kcal = pl.kcal;
        plans.push(np);
      });
      store.plans = plans;
    }
    store.touch();
    let n = 0;
    store.libraries.forEach((l: Library): void => {
      n += l.items.length;
    });
    return n;
  } catch (_e) {
    return -1;
  }
}

/** 采集当前流程（只取"接着做"必需的状态位，越小越稳） */
export function buildFlowState(): string {
  const s = new FlowState();
  s.tab = store.tabIndex;
  s.libId = store.libId;
  // 「流转」面板本身不算流程状态：否则对端接续后又弹出面板，还要再关一次
  s.overlay = store.overlay === 'flow' ? '' : store.overlay;
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
  return applyFlowState(String(raw));
}

/** 还原流程快照（系统接续与「流转中转」共用同一份实现，口径不会走偏） */
export function applyFlowState(raw: string): boolean {
  try {
    const s = JSON.parse(raw) as FlowState;
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
