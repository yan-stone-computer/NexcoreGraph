/* 启核图策 · 全局状态（对应 web-demo app.js 的 S + DB；V2 状态管理） */

import {
  Library, Item, Plan, AlertItem, ShoppingItem, ChatMsg, Todo, Stats, Family,
  IntakeResult, Workbench, seedLibraries, seedAlerts, seedPlans, seedShopping,
  seedChat, seedDaily, seedIntake, seedWorkbench, Snap, Profile
} from './Db';
import { T } from './Tokens';

export class ToastMsg {
  id: number = 0;
  msg: string = '';
  actionLabel: string = '';
  action: string = '';

  constructor(id: number, msg: string, actionLabel: string, action: string) {
    this.id = id;
    this.msg = msg;
    this.actionLabel = actionLabel;
    this.action = action;
  }
}

/* AI 用量记录（M2.5 P0-1：route/model/耗时，仅本地展示，不上报） */
export class AiUsageRow {
  route: string = '';
  model: string = '';
  ms: number = 0;
  at: string = '';

  constructor(route: string, model: string, ms: number, at: string) {
    this.route = route;
    this.model = model;
    this.ms = ms;
    this.at = at;
  }
}

export class DelLibSnap {
  lib: Library | null = null;
  index: number = 0;
}

export class DelItemSnap {
  lib: Library | null = null;
  item: Item | null = null;
  index: number = 0;
}

/* 落地价值指标账本（M-11，仅本地不上云）：
   expiringIds    已计入"临期总数"的物品 id（去重，避免同一物品重复计数）
   expiringTotal  累计进入临期的物品数
   expiringConsumed  临期期间被消耗的物品数（方案核销 / 自然语言改数量）
   blockedRepurchase 命中已有库存被拦截的重复采购次数
   intakeMs       最近盘点（拍照入库）批次耗时，用于中位数 */
@ObservedV2
export class ValueLedger {
  @Trace expiringIds: string[] = [];
  @Trace expiringTotal: number = 0;
  @Trace expiringConsumed: number = 0;
  @Trace blockedRepurchase: number = 0;
  @Trace intakeMs: number[] = [];
}

@ObservedV2
export class Store {
  /* 登录与框架 */
  @Trace loggedIn: boolean = false;
  @Trace tabIndex: number = 0;          // 0 首页看板 1 资源库 2 协作工作台 3 我的
  @Trace isWide: boolean = false;       // 平板/折叠屏展开档
  @Trace isCompact: boolean = false;    // 手表档（<400vp）：单列精简界面
  @Trace toasts: ToastMsg[] = [];

  /* UI 状态（对应 web-demo S） */
  @Trace libId: string = '';
  @Trace overlay: string = '';          // search|alerts|shopping|plans|intake|newlib|editlib|itemadd|itemedit|deckpick|groupchat
  @Trace overlayArg: string = '';       // 库 id / 物品 id
  @Trace overlayArg2: string = '';
  @Trace aiOpen: boolean = false;
  /** AI 面板预填提问（工作台/图谱点选后注入，AiPanel 打开时消费并清空） */
  @Trace aiPrefill: string = '';
  /** 是否允许跨设备接续（登录页等敏感页置 false） */
  @Trace continueEnabled: boolean = true;
  @Trace chatTyping: boolean = false;
  @Trace busy: string = '';
  @Trace itemFilter: string = 'all';
  @Trace trendRange: string = '7';
  @Trace libMenuId: string = '';
  @Trace familyOpen: boolean = false;
  @Trace intakeLoading: boolean = false;
  @Trace intakeStep: number = 0;
  @Trace deckDraft: string[] = [];
  @Trace searchQ: string = '';

  /* 数据（对应 web-demo DB） */
  @Trace userName: string = '林夏';
  @Trace userRole: string = '家庭管理员';
  @Trace userInitial: string = '林';
  @Trace family: Family = new Family('home', '幸福小家', 4);
  @Trace families: Family[] = [new Family('home', '幸福小家', 4), new Family('personal', '林夏 · 个人', 1)];
  @Trace settings: Record<string, boolean> = {
    'private': true, 'chat': true, 'expiry': true, 'digest': true, 'low': true,
    'tts': false                 // M-9 AI 回复语音播报（默认关，设置页可开）
  };
  @Trace logs: LogRow[] = [];
  @Trace stats: Stats = new Stats();
  @Trace libraries: Library[] = seedLibraries();
  @Trace alerts: AlertItem[] = seedAlerts();
  @Trace plans: Plan[] = seedPlans();
  @Trace shopping: ShoppingItem[] = seedShopping();
  @Trace chat: ChatMsg[] = seedChat();
  @Trace daily: Todo[] = seedDaily();
  @Trace intake: IntakeResult[] = seedIntake();
  @Trace workbench: Workbench = seedWorkbench();

  /* M2.5 AI 增强：偏好档案（仅本地）与 AI 用量 */
  @Trace profile: Profile = new Profile();
  @Trace aiUsage: AiUsageRow[] = [];
  /* M-11 落地价值指标（仅本地） */
  @Trace ledger: ValueLedger = new ValueLedger();

  /* 撤销快照 */
  lastDeletedLib: DelLibSnap = new DelLibSnap();
  lastDeletedItem: DelItemSnap = new DelItemSnap();
  noSeq: number = 0;

  toast(msg: string, actionLabel: string = '', action: string = ''): void {
    const t = new ToastMsg(Date.now() + Math.floor(Math.random() * 1000), msg, actionLabel, action);
    const arr = this.toasts.slice();
    arr.push(t);
    this.toasts = arr;
    setTimeout(() => {
      this.removeToast(t.id);
    }, 3400);
  }

  removeToast(id: number): void {
    this.toasts = this.toasts.filter((x: ToastMsg): boolean => x.id !== id);
  }

  pushLog(action: string, detail: string): void {
    const arr = this.logs.slice();
    arr.unshift(new LogRow(action, detail, nowTime(), todayKey()));
    if (arr.length > 50) {
      arr.length = 50;
    }
    this.logs = arr;
  }

  findItem(idOrName: string): Library | null {
    const hit = this.findItemHit(idOrName);
    return hit === null ? null : hit[0];
  }

  /** 返回 [库, 物品]，未找到返回 null */
  findItemHit(idOrName: string): [Library, Item] | null {
    for (let i = 0; i < this.libraries.length; i++) {
      const lib = this.libraries[i];
      for (let j = 0; j < lib.items.length; j++) {
        const it = lib.items[j];
        if (it.id === idOrName || it.name === idOrName) {
          return [lib, it];
        }
      }
    }
    return null;
  }

  findLib(id: string): Library | null {
    for (let i = 0; i < this.libraries.length; i++) {
      if (this.libraries[i].id === id) {
        return this.libraries[i];
      }
    }
    return null;
  }

  nextNo(): string {
    this.noSeq += 1;
    let s = String(this.noSeq);
    while (s.length < 4) {
      s = '0' + s;
    }
    return 'NO-' + s;
  }

  lowStockAlert(item: Item): void {
    if (item.name === '鸡蛋' && item.qty < 5) {
      const arr = this.alerts.slice();
      arr.unshift(new AlertItem(Date.now(), 'low', 'package', 'teal',
        `鸡蛋低于阈值（当前 ${item.qty} 个），建议补货`, '刚刚 · 规则自动化'));
      this.alerts = arr;
    }
  }

  snapshotItem(lib: Library, item: Item, index: number): Snap {
    return new Snap(item.id, item.name, item.qty, item.qty);
  }

  /* 演示数据重置 */
  reset(): void {
    this.libraries = seedLibraries();
    this.alerts = seedAlerts();
    this.plans = seedPlans();
    this.shopping = seedShopping();
    this.chat = seedChat();
    this.daily = seedDaily();
    this.intake = seedIntake();
    this.workbench = seedWorkbench();
    this.logs = [];
    this.noSeq = 0;
    this.tabIndex = 0;
    this.libId = '';
    this.overlay = '';
  }

  initNoSeq(): void {
    let max = 0;
    this.libraries.forEach((l: Library) => {
      l.items.forEach((it: Item) => {
        if (it.no.startsWith('NO-')) {
          const n = parseInt(it.no.substring(3), 10);
          if (!isNaN(n) && n > max) {
            max = n;
          }
        }
      });
    });
    this.noSeq = max;
  }
}

export class LogRow {
  action: string = '';
  detail: string = '';
  at: string = '';
  day: string = '';

  constructor(action: string, detail: string, at: string, day: string = '') {
    this.action = action;
    this.detail = detail;
    this.at = at;
    this.day = day;
  }
}

export function nowTime(): string {
  const d = new Date();
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/** 本地日期键 yyyy-mm-dd（用于趋势按天聚合） */
export function todayKey(offsetDays: number = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const store: Store = new Store();
export { T };
