/* 启核图策 · 全局状态（V2 状态管理）
   首启一律为空：用户数据只来自两种途径 —— ① 用户自己输入/拍照，② 从后端按账号拉回。
   本文件不预置任何样例库存、样例方案或样例家庭成员。 */

import {
  Library, Item, Plan, AlertItem, ShoppingItem, ChatMsg, Todo, Stats, Family,
  IntakeResult, Workbench, Snap, Profile
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
  /** 多端活同步：最近一次同步状态（只在「我的 → 跨设备流转」里显示，不弹 Toast） */
  @Trace lastSyncNote: string = '';
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

  /* 身份与家庭：登录成功后由后端返回真实数据填充（见 Api.login） */
  @Trace userName: string = '';
  @Trace userPhone: string = '';
  @Trace authToken: string = '';
  @Trace userRole: string = '';
  @Trace userInitial: string = '';
  @Trace family: Family = new Family('', '', 0);
  @Trace families: Family[] = [];
  @Trace settings: Record<string, boolean> = {
    'private': true, 'chat': true, 'expiry': true, 'digest': true, 'low': true,
    'tts': false,                // M-9 AI 回复语音播报（默认关，设置页可开）
    'syncChat': true             // 自由流转：AI 对话随其他设备同步（默认开；关闭则仅存本机）
  };
  @Trace logs: LogRow[] = [];
  @Trace stats: Stats = new Stats();
  @Trace libraries: Library[] = [];
  @Trace alerts: AlertItem[] = [];
  @Trace plans: Plan[] = [];
  @Trace shopping: ShoppingItem[] = [];
  @Trace chat: ChatMsg[] = [];
  @Trace daily: Todo[] = [];
  @Trace intake: IntakeResult[] = [];
  @Trace workbench: Workbench = new Workbench([], []);

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

  /** 写操作后手动触发 UI 刷新
      背景：Api 里的写操作大多是「直接改嵌套对象」（item.qty = x、lib.items.push(...)），
      而 V2 只观察 @Trace 属性 —— 不 reassign 顶层数组就不会重绘，
      表现就是「数据确实改了，但界面没变化」。所有写操作收尾统一调这个。 */
  touch(): void {
    this.libraries = this.libraries.slice();
    this.plans = this.plans.slice();
    this.alerts = this.alerts.slice();
    this.shopping = this.shopping.slice();
    this.daily = this.daily.slice();
    this.logs = this.logs.slice();
    this.aiUsage = this.aiUsage.slice();
    // 工作台是普通类（要整块进同步 DTO，不适合被观测）：换实例才重绘
    this.workbench = this.workbench.cloneForRender();
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

  /** 低库存规则（与具体物品无关）：数量被改到 ≤1 且原本更多时提示补货。
   *  旧实现写死了"鸡蛋 < 5"这一条样例规则，已删除。 */
  lowStockAlert(item: Item): void {
    if (item.qty > 1 || item.name === '') {
      return;
    }
    const text = `${item.name} 只剩 ${item.qty}${item.unit}，建议补货`;
    const dup = this.alerts.some((a: AlertItem): boolean => a.type === 'low' && a.text.indexOf(item.name) === 0);
    if (dup) {
      return;
    }
    const arr = this.alerts.slice();
    arr.unshift(new AlertItem(Date.now(), 'low', 'package', 'teal', text, '刚刚 · 规则自动化'));
    this.alerts = arr;
  }

  snapshotItem(lib: Library, item: Item, index: number): Snap {
    return new Snap(item.id, item.name, item.qty, item.qty);
  }

  /* 清空本机全部用户数据（退出登录 / 手动清空本机数据用）。
     注意：这是把状态恢复成"新账号"的样子，不是恢复样例数据。 */
  clearUserData(): void {
    this.libraries = [];
    this.alerts = [];
    this.plans = [];
    this.shopping = [];
    this.chat = [];
    this.daily = [];
    this.intake = [];
    this.workbench = new Workbench([], []);
    this.logs = [];
    this.stats = new Stats();
    this.noSeq = 0;
    this.tabIndex = 0;
    this.libId = '';
    this.overlay = '';
    this.intakeStep = 0;
    this.intakeLoading = false;
    this.userName = '';
    this.userPhone = '';
    this.authToken = '';
    this.userRole = '';
    this.userInitial = '';
    this.family = new Family('', '', 0);
    this.families = [];
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
