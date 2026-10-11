/* 启核图策 · 业务动作层
   数据只来自用户输入 / 拍照识别 / 后端返回；本文件不含任何预置样例数据。
   账号相关动作（取验证码 / 登录 / 退出）直接打后端 /api/auth/*，登录成功后把远端数据拉回本机。 */

import {
  Item, Library, Plan, AlertItem, ShoppingItem, ChatMsg, IntakeResult,
  Consume, Snap, SeatLib, SeatItem, Seat, Todo, WbMsg, WbHistory, KNOWLEDGE, Family
} from './Db';
import { store, nowTime } from './Store';
import { scheduleLivePublish, stopLiveSync } from './LiveSync';
import { saveLedger, saveUserData, clearUserDataSaved, saveSession } from './LocalStore';
import { callJson } from './Backend';
import { pullMyData } from './SyncApi';
import { http } from '@kit.NetworkKit';
import { T } from './Tokens';
import { kcalGuess } from './Knowledge';

const LATENCY = 220;

class PoolItem {
  title: string = '';
  used: Consume[] = [];
  missing: Consume[] = [];
  reason: string = '';
  time: string = '';

  constructor(title: string, used: Consume[], missing: Consume[], reason: string, time: string) {
    this.title = title;
    this.used = used;
    this.missing = missing;
    this.reason = reason;
    this.time = time;
  }
}

function sleep(): Promise<void> {
  return new Promise<void>((resolve: (v: void) => void) => {
    setTimeout(() => resolve(), LATENCY + Math.random() * 180);
  });
}

function nid(prefix: string): string {
  return prefix + Date.now() + Math.floor(Math.random() * 1000);
}

/* ---------- 账号（F9.1/F9.2）：验证码由后端下发并校验，端侧不留任何固定演示码 ---------- */

const AUTH_CONNECT_MS: number = 6000;
const AUTH_READ_MS: number = 15000;

class CodeResp {
  ok: boolean = false;
  error: string = '';
  ttlSec: number = 0;
  channel: string = '';     // sms=已发短信；console=后端未接短信通道，验证码只打在服务端日志
  devCode: string = '';     // 仅后端显式开启 AUTH_SHOW_CODE=1 时才有值
}

class LoginResp {
  ok: boolean = false;
  error: string = '';
  token: string = '';
  phone: string = '';
  nickname: string = '';
  role: string = '';
  families: FamilyDto[] = [];
}

class FamilyDto {
  id: string = '';
  name: string = '';
  memberCount: number = 0;
  role: string = '';
}

/** 取验证码：后端生成随机 6 位码并按账号存 TTL；账号可以是手机号或邮箱 */
export function requestLoginCode(account: string): Promise<string> {
  return callJson('/api/auth/code', http.RequestMethod.POST, JSON.stringify({ account: account }),
    AUTH_CONNECT_MS, AUTH_READ_MS).then((text: string): string => {
    const r = JSON.parse(text) as CodeResp;
    if (!r.ok) {
      throw new Error(r.error === '' ? '验证码下发失败' : r.error);
    }
    const ttl: string = Math.round(r.ttlSec / 60) + ' 分钟内有效';
    if (r.channel === 'email') {
      return '验证码已发送到你的邮箱，' + ttl + '（收不到先看垃圾邮件）';
    }
    if (r.channel === 'sms') {
      return '验证码已通过短信发送，' + ttl;
    }
    return '验证码已生成（后端未配置邮件/短信通道，验证码打印在服务端日志里），' + ttl;
  });
}

/**
 * 验证码登录：后端校验通过后返回 token 与真实家庭列表；
 * 端侧随后用该账号把云端数据拉回本机（后端是账号数据的权威存放处）。
 */
export function loginByCode(account: string, code: string): Promise<string> {
  return callJson('/api/auth/login', http.RequestMethod.POST,
    JSON.stringify({ account: account, code: code }), AUTH_CONNECT_MS, AUTH_READ_MS)
    .then((text: string): Promise<string> => {
      const r = JSON.parse(text) as LoginResp;
      if (!r.ok || r.token === '') {
        throw new Error(r.error === '' ? '登录失败' : r.error);
      }
      store.userPhone = r.phone;
      store.authToken = r.token;
      store.userName = r.nickname === '' ? '用户' + r.phone.slice(-4) : r.nickname;
      store.userInitial = store.userName.slice(0, 1);
      store.userRole = r.role === '' ? '成员' : r.role;
      const list: Family[] = [];
      r.families.forEach((f: FamilyDto): void => {
        list.push(new Family(f.id, f.name, f.memberCount));
      });
      store.families = list;
      store.family = list.length > 0 ? list[0] : new Family('', '', 1);
      store.loggedIn = true;
      // 拉回该家庭在云端的数据；新账号云端没有快照 → 保持空库
      return pullMyData().then((found: boolean): string => {
        saveSession();
        saveUserData();
        return found
          ? `已登录 ${store.userName}，云端数据已同步到本机`
          : `已登录 ${store.userName}，这是新账号，从空库开始`;
      }).catch((_e: Error): string => {
        saveSession();
        saveUserData();
        return `已登录 ${store.userName}（暂时读不到云端数据，本机先按空的开始）`;
      });
    });
}

/** 退出登录：停同步、清本机缓存；云端数据保留，下次登录还能拉回来 */
export function logout(): Promise<void> {
  stopLiveSync();
  clearUserDataSaved();
  store.clearUserData();
  return Promise.resolve();
}

function touchLib(lib: Library): void {
  lib.count = lib.items.length;
  lib.desc = `${lib.items.length} 件`;
}

/* ---------- 通用运行器 ---------- */
export function runBusy(key: string, fn: () => Promise<void>, onDone?: () => void): void {
  store.busy = key;
  fn().then((): void => {
    store.busy = '';
    // 写操作收尾统一触发一次刷新：Api 内部多为直接改嵌套对象，不 reassign 界面不会重绘
    store.touch();
    // 同时触发一次「活同步」：另一台设备 2 秒内会自动看到这次改动
    scheduleLivePublish();
    if (onDone) {
      onDone();
    }
  }).catch((e: Error): void => {
    store.busy = '';
    store.toast('操作失败：' + (e.message !== undefined && e.message !== null ? e.message : '请重试'));
  });
}

/* ---------- 物品：拍照入库（F1.1/F1.5） ---------- */

/** 连拍合并（F1.2）：同一批多图识别结果按名称去重，数量累加，缺失字段取首个非空值 */
export function mergeIntakeResults(batches: IntakeResult[][]): IntakeResult[] {
  const order: string[] = [];
  const byName: Map<string, IntakeResult> = new Map<string, IntakeResult>();
  batches.forEach((batch: IntakeResult[]) => {
    batch.forEach((r: IntakeResult) => {
      if (r.name === '') {
        return;
      }
      const exist = byName.get(r.name);
      if (exist === undefined) {
        const fresh = new IntakeResult(nid('in'), r.emoji, r.img, r.name, r.category, r.qty, r.unit,
          r.pos, r.exp, r.expDays, r.kbKey, r.price, r.priceSrc, false);
        byName.set(r.name, fresh);
        order.push(r.name);
      } else {
        const nq = (parseFloat(exist.qty) || 0) + (parseFloat(r.qty) || 0);
        exist.qty = String(nq);
        if (exist.pos === '' && r.pos !== '') {
          exist.pos = r.pos;
        }
        if (exist.expDays === 0 && r.expDays > 0) {
          exist.expDays = r.expDays;
          exist.exp = r.exp;
          exist.kbKey = r.kbKey;
        }
        if (exist.price === '' && r.price !== '') {
          exist.price = r.price;
          exist.priceSrc = r.priceSrc;
        }
        if (exist.category === '' && r.category !== '') {
          exist.category = r.category;
        }
        if (exist.unit === '个' && r.unit !== '个') {
          exist.unit = r.unit;
        }
      }
    });
  });
  const out: IntakeResult[] = [];
  order.forEach((k: string) => {
    const v = byName.get(k);
    if (v !== undefined) {
      out.push(v);
    }
  });
  return out;
}

export function addItems(results: IntakeResult[]): Promise<void> {
  return sleep().then((): Promise<void> => {
    const fridge = store.libraries[0];
    const newItems: Item[] = [];
    results.forEach((r: IntakeResult) => {
      if (r.name === '') {
        return;
      }
      const expDays = r.expDays > 0 ? r.expDays : 7;
      const item = new Item(r.id, r.name, r.emoji, r.img, r.kbKey,
        parseFloat(r.qty) || 1, r.unit || '个', parseFloat(r.price) || 0, r.priceSrc || '手动',
        expDays, r.pos || '冷藏区', expDays <= 3);
      fridge.items.push(item);
      newItems.push(item);
    });
    const newAlerts: AlertItem[] = newItems.map((it: Item): AlertItem => {
      return new AlertItem(Date.now() + Math.random(), 'expiring', 'clock', 'amber',
        `${it.name} ${it.expDays} 天后到期`, '刚刚 · 知识库推算');
    });
    store.alerts = newAlerts.concat(store.alerts);
    touchLib(fridge);
    store.pushLog('intake', `拍照入库 ${newItems.length} 项`);
    return Promise.resolve();
  });
}

export function updateItemQty(id: string, delta: number): Promise<void> {
  return sleep().then((): void => {
    const hit = store.findItemHit(id);
    if (hit === null) {
      throw new Error('物品不存在');
    }
    hit[1].qty = Math.max(0, hit[1].qty + delta);
    store.pushLog('qty', `${hit[1].name} 数量 ${delta > 0 ? '+' : ''}${delta}`);
    store.lowStockAlert(hit[1]);
  });
}

/** 自然语言调整：按名称直接设置数量（F5.5/F6.2，对话确认后调用） */
export function setItemQtyByName(name: string, qty: number): Promise<void> {
  return sleep().then((): void => {
    const hit = store.findItemHit(name);
    if (hit === null) {
      throw new Error('库存中没有「' + name + '」');
    }
    // M-11 指标①：临期物品被消耗计数（消耗 = 数量下降）
    if (qty < hit[1].qty && hit[1].expDays <= 7) {
      store.ledger.expiringConsumed += 1;
      saveLedger();
    }
    hit[1].qty = Math.max(0, qty);
    store.pushLog('nl', `自然语言调整「${hit[1].name}」数量为 ${hit[1].qty}`);
    store.lowStockAlert(hit[1]);
  });
}

/* ---------- 资源库管理（F2.1） ---------- */
export function createLibrary(name: string, icon: string, tone: string): Promise<Library> {
  return sleep().then((): Library => {
    const lib = new Library(nid('lib'), name || '新库', icon || 'package', tone || 'teal', 0, '0 件 · 空库', []);
    store.libraries = store.libraries.concat([lib]);
    store.pushLog('library', `新建库「${lib.name}」`);
    return lib;
  });
}

export function renameLibrary(id: string, name: string): Promise<void> {
  return sleep().then((): void => {
    const lib = store.findLib(id);
    if (lib === null) {
      throw new Error('库不存在');
    }
    lib.name = name;
    store.pushLog('library', `重命名库为「${name}」`);
  });
}

export function deleteLibrary(id: string): Promise<DelLibResult> {
  return sleep().then((): DelLibResult => {
    let idx = -1;
    for (let i = 0; i < store.libraries.length; i++) {
      if (store.libraries[i].id === id) {
        idx = i;
      }
    }
    if (idx < 0) {
      throw new Error('库不存在');
    }
    const lib = store.libraries[idx];
    store.libraries = store.libraries.filter((l: Library): boolean => l.id !== id);
    store.pushLog('library', `删除库「${lib.name}」`);
    return new DelLibResult(lib, idx);
  });
}

export class DelLibResult {
  lib: Library;
  index: number;

  constructor(lib: Library, index: number) {
    this.lib = lib;
    this.index = index;
  }
}

export function restoreLibrary(lib: Library, index: number): Promise<void> {
  return sleep().then((): void => {
    const arr = store.libraries.slice();
    arr.splice(Math.min(index, arr.length), 0, lib);
    store.libraries = arr;
  });
}

export function moveLibrary(id: string, dir: number): Promise<void> {
  return sleep().then((): void => {
    const arr = store.libraries.slice();
    let idx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === id) {
        idx = i;
      }
    }
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= arr.length) {
      throw new Error('无法移动');
    }
    const t = arr[idx];
    arr[idx] = arr[to];
    arr[to] = t;
    store.libraries = arr;
    store.pushLog('library', '调整库排序');
  });
}

export function setDeck(ids: string[]): Promise<void> {
  return sleep().then((): void => {
    store.workbench.myDeck = ids.filter((id: string): boolean => store.findLib(id) !== null).slice(0, 4);
    syncMyHand();
    store.pushLog('coop', `更换手牌为 ${store.workbench.myDeck.length} 张`);
  });
}

/** 把我的座位手牌与 myDeck 同步（数量取实时库存） */
export function syncMyHand(): void {
  const me = store.workbench.seats[0];
  if (me === undefined || me === null) {
    return;
  }
  const libs: SeatLib[] = [];
  store.workbench.myDeck.forEach((id: string) => {
    const l = store.findLib(id);
    if (l !== null) {
      libs.push(new SeatLib(l.id, l.name, l.icon, l.count, []));
    }
  });
  me.libs = libs;
}

/**
 * 上桌（原本依赖预置的牌桌数据，现在由用户自己决定摆哪些库）：
 * 没有"我的座位"就新建一个，手牌取 myDeck；myDeck 为空则默认摆前 4 个库。
 */
export function takeSeat(): Promise<void> {
  return sleep().then((): void => {
    if (store.workbench.seats.length === 0) {
      const seat = new Seat('me', `${store.userName === '' ? '我' : store.userName} · 我`, 'teal', []);
      store.workbench.seats = [seat];
    }
    if (store.workbench.myDeck.length === 0) {
      store.workbench.myDeck = store.libraries.slice(0, 4).map((l: Library): string => l.id);
    }
    syncMyHand();
    store.touch();
    store.pushLog('coop', '已上桌 · 手牌 ' + store.workbench.myDeck.length + ' 张');
  });
}

/* ---------- 物品管理（F2.2） ---------- */
export function addItem(libId: string, data: ItemForm): Promise<void> {
  return sleep().then((): void => {
    const lib = store.findLib(libId);
    if (lib === null) {
      throw new Error('库不存在');
    }
    const expDays = parseInt(data.expDays, 10) || 7;
    const item = new Item(nid('it'), data.name, data.emoji, data.img, '',
      parseFloat(data.qty) || 1, data.unit || '个', parseFloat(data.price) || 0, data.priceSrc || '手动',
      expDays, data.pos === '' ? '未设置' : data.pos, expDays <= 3);
    item.no = data.no === '' ? store.nextNo() : data.no;
    item.isPrivate = data.isPrivate;
    lib.items.push(item);
    touchLib(lib);
    store.pushLog('item', `添加物品「${item.name}」到${lib.name}`);
  });
}

export class ItemForm {
  name: string = '';
  no: string = '';
  qty: string = '1';
  unit: string = '个';
  price: string = '0';
  expDays: string = '7';
  pos: string = '';
  isPrivate: boolean = false;
  emoji: string = '📦';
  img: ResourceStr = '';
  priceSrc: string = '手动';
}

export function updateItem(libId: string, itemId: string, data: ItemForm): Promise<void> {
  return sleep().then((): void => {
    const lib = store.findLib(libId);
    if (lib === null) {
      throw new Error('库不存在');
    }
    if (lib.coopAddOnly) {
      throw new Error('合作复制库只能添加，不能修改');
    }
    let it: Item | null = null;
    lib.items.forEach((x: Item) => {
      if (x.id === itemId) {
        it = x;
      }
    });
    if (it === null) {
      throw new Error('物品不存在');
    }
    const target = it as Item;
    target.name = data.name;
    target.qty = Math.max(0, parseFloat(data.qty) || 0);
    target.unit = data.unit;
    target.price = parseFloat(data.price) || 0;
    target.expDays = parseInt(data.expDays, 10) || 7;
    target.expiring = target.expDays <= 3;
    target.pos = data.pos;
    target.isPrivate = data.isPrivate;
    store.pushLog('item', `编辑物品「${target.name}」`);
  });
}

export class DelItemResult {
  lib: Library;
  item: Item;
  index: number;

  constructor(lib: Library, item: Item, index: number) {
    this.lib = lib;
    this.item = item;
    this.index = index;
  }
}

export function deleteItem(libId: string, itemId: string): Promise<DelItemResult> {
  return sleep().then((): DelItemResult => {
    const lib = store.findLib(libId);
    if (lib === null) {
      throw new Error('库不存在');
    }
    if (lib.coopAddOnly) {
      throw new Error('合作复制库只能添加，不能删除');
    }
    let idx = -1;
    for (let i = 0; i < lib.items.length; i++) {
      if (lib.items[i].id === itemId) {
        idx = i;
      }
    }
    if (idx < 0) {
      throw new Error('物品不存在');
    }
    const item = lib.items[idx];
    const arr = lib.items.slice();
    arr.splice(idx, 1);
    lib.items = arr;
    touchLib(lib);
    store.pushLog('item', `删除物品「${item.name}」`);
    return new DelItemResult(lib, item, idx);
  });
}

export function restoreItem(lib: Library, item: Item, index: number): Promise<void> {
  return sleep().then((): void => {
    const arr = lib.items.slice();
    arr.splice(Math.min(index, arr.length), 0, item);
    lib.items = arr;
    touchLib(lib);
  });
}

/* ---------- 生成新方案（F3.1） ---------- */
export function generatePlans(): Promise<Plan[]> {
  return sleep().then((): Plan[] => {
    const names: Set<string> = new Set<string>();
    store.libraries.forEach((l: Library) => {
      l.items.forEach((it: Item) => names.add(it.name));
    });
    const pool: PoolItem[] = [];
    if (names.has('鸡蛋')) {
      pool.push(new PoolItem('番茄炒蛋', [new Consume('鸡蛋', '3 个')],
        names.has('番茄') ? [] : [new Consume('番茄', '2 个')], '临期优先', '15 分钟'));
    }
    if (names.has('鲜牛奶')) {
      pool.push(new PoolItem('牛奶燕麦粥', [new Consume('鲜牛奶', '0.5 盒')],
        names.has('燕麦') ? [] : [new Consume('燕麦', '50 克')], '临期优先', '10 分钟'));
    }
    if (names.has('上海青')) {
      pool.push(new PoolItem('清炒上海青', [new Consume('上海青', '1 把')], [], '清库存', '12 分钟'));
    }
    if (names.has('五花肉')) {
      pool.push(new PoolItem('青椒炒肉', [new Consume('五花肉', '200 克')],
        names.has('青椒') ? [] : [new Consume('青椒', '2 个')], '营养均衡', '25 分钟'));
    }
    let nextId = store.plans.length + 1;
    const plans: Plan[] = pool.slice(0, 3).map((p: PoolItem, i: number): Plan => {
      const plan = new Plan(nextId + i, p.title, i === 0 ? '高' : '中', p.reason, p.time, '知识库',
        p.used, p.missing, 'pending');
      plan.kcal = kcalGuess(p.title);   // 营养速览（M2.5 P0-3）
      return plan;
    });
    if (plans.length === 0) {
      plans.push(new Plan(nextId, '库存快速整理', '中', '清点建议', '5 分钟', '知识库', [], [], 'pending'));
    }
    nextId += plans.length;
    store.plans = store.plans.concat(plans);
    store.pushLog('plan', `生成新方案 ${plans.length} 个`);
    return plans;
  });
}

/* ---------- 方案：执行（扣减）与撤销（F6.1/F6.3） ---------- */
export function executePlan(id: number, selected: string[]): Promise<void> {
  return sleep().then((): void => {
    let plan: Plan | null = null;
    store.plans.forEach((p: Plan) => {
      if (p.id === id) {
        plan = p;
      }
    });
    if (plan === null || (plan as Plan).status === 'done') {
      throw new Error('方案不可执行');
    }
    const p = plan as Plan;
    const snap: Snap[] = [];
    p.used.forEach((u: Consume) => {
      if (selected.indexOf(u.name) === -1) {
        return;
      }
      const hit = store.findItemHit(u.name);
      if (hit === null) {
        return;
      }
      const amount = parseFloat(u.qty) || 0;
      const after = Math.max(0, hit[1].qty - amount);
      snap.push(new Snap(hit[1].id, hit[1].name, hit[1].qty, after));
      hit[1].qty = after;
      // M-11 指标①：临期消耗率分子（临期期间被消耗的物品数）
      if (hit[1].expDays <= 7) {
        store.ledger.expiringConsumed += 1;
      }
      store.lowStockAlert(hit[1]);
    });
    p.status = 'done';
    p.snapshot = snap;
    saveLedger();
    store.pushLog('plan', `执行方案「${p.title}」`);
  });
}

export function rollbackPlan(id: number): Promise<void> {
  return sleep().then((): void => {
    let plan: Plan | null = null;
    store.plans.forEach((p: Plan) => {
      if (p.id === id) {
        plan = p;
      }
    });
    if (plan === null || (plan as Plan).snapshot === null) {
      throw new Error('无可撤销记录');
    }
    const p = plan as Plan;
    (p.snapshot as Snap[]).forEach((s: Snap) => {
      const hit = store.findItemHit(s.id);
      if (hit !== null) {
        hit[1].qty = s.before;
      }
    });
    p.status = 'pending';
    p.snapshot = null;
    store.pushLog('plan', `撤销方案「${p.title}」`);
  });
}

/* ---------- 预警（F3.9-F3.14） ---------- */
export function resolveAlert(id: number): Promise<void> {
  return sleep().then((): void => {
    store.alerts = store.alerts.filter((a: AlertItem): boolean => a.id !== id);
    store.pushLog('alert', `处理预警 #${id}`);
  });
}

/* ---------- 采购清单（F3.6） ---------- */
export function shoppingList(): Promise<ShoppingItem[]> {
  return sleep().then((): ShoppingItem[] => {
    const list: ShoppingItem[] = [];
    store.plans.forEach((p: Plan) => {
      if (p.status === 'done') {
        return;
      }
      p.missing.forEach((m: Consume) => {
        list.push(new ShoppingItem(m.name, m.qty, `「${p.title}」缺料`));
      });
    });
    store.libraries.forEach((lib: Library) => {
      lib.items.forEach((it: Item) => {
        if (it.name === '鸡蛋' && it.qty < 5) {
          list.push(new ShoppingItem(it.name, '补到 12 个', '低库存提醒'));
        }
      });
    });
    store.shopping = list.slice(0, 6);
    return store.shopping;
  });
}

/* ---------- 协作工作台（F9.6-F9.9） ---------- */
export function runWorkbench(): Promise<Snap[]> {
  return sleep().then((): Snap[] => {
    const snap: Snap[] = [];
    const pairs: number[] = [4, 2];
    const names: string[] = ['鸡蛋', '番茄'];
    for (let i = 0; i < names.length; i++) {
      const hit = store.findItemHit(names[i]);
      if (hit !== null) {
        const after = Math.max(0, hit[1].qty - pairs[i]);
        snap.push(new Snap(hit[1].id, hit[1].name, hit[1].qty, after));
        hit[1].qty = after;
      }
    }
    store.pushLog('workbench', '执行「番茄蛋包饭」，按归属扣减 A 家鸡蛋 4、B 家番茄 2');
    return snap;
  });
}

/* 大牌桌：传库给其他座位；收库方本地复制一份，仅合作期间有效 */
export function sendLibrary(fromSeat: string, toSeat: string, libId: string): Promise<SendResult> {
  return sleep().then((): SendResult => {
    const seats = store.workbench.seats;
    let from: Seat | null = null;
    let card: SeatLib | null = null;
    let to: Seat | null = null;
    seats.forEach((s: Seat) => {
      if (s.id === fromSeat) {
        from = s;
        s.libs.forEach((l: SeatLib) => {
          if (l.id === libId) {
            card = l;
          }
        });
      }
      if (s.id === toSeat) {
        to = s;
      }
    });
    if (from === null || card === null || to === null) {
      throw new Error('手牌不存在');
    }
    const f = from as Seat;
    const c = card as SeatLib;
    const t = to as Seat;

    const srcItems: SeatItem[] = [];
    if (fromSeat === 'me') {
      const orig = store.findLib(libId);
      if (orig !== null) {
        orig.items.forEach((it: Item) => {
          srcItems.push(new SeatItem(it.name, it.qty, it.unit, it.no === '' ? store.nextNo() : it.no));
        });
      }
    } else {
      c.items.forEach((it: SeatItem) => {
        srcItems.push(new SeatItem(it.name, it.qty, it.unit, it.no));
      });
    }
    let merged = 0;
    let coopCreated = false;
    if (toSeat === 'me') {
      if (c.of !== '') {
        const origLib = store.findLib(c.of);
        if (origLib !== null) {
          const known: Set<string> = new Set<string>();
          origLib.items.forEach((it: Item) => known.add(it.no));
          srcItems.forEach((it: SeatItem) => {
            if (it.no !== '' && !known.has(it.no)) {
              const item = new Item(nid('it'), it.name, '📦', '', '', it.qty, it.unit, 0, '手动', 7, '未设置', false);
              item.no = it.no;
              origLib.items.push(item);
              known.add(it.no);
              merged += 1;
            }
          });
          touchLib(origLib);
        }
        f.libs = f.libs.filter((x: SeatLib): boolean => x.id !== c.id);
        store.pushLog('coop', `${f.name} 返回「${c.name}」，按编号合并新增 ${merged} 项`);
      } else {
        const lib = new Library(nid('lc'), c.name, c.icon || 'package', 'teal', srcItems.length,
          `来自 ${f.name} · 合作复制（只可添加）`, []);
        srcItems.forEach((it: SeatItem) => {
          const item = new Item(nid('it'), it.name, '📦', '', '', it.qty, it.unit, 0, '手动', 7, '未设置', false);
          item.no = it.no;
          lib.items.push(item);
        });
        lib.coop = true;
        lib.coopFrom = f.name;
        lib.coopAddOnly = true;
        store.libraries = store.libraries.concat([lib]);
        coopCreated = true;
        store.pushLog('coop', `${f.name} 传给 我：「${c.name}」，本地已复制（可添加）`);
      }
    } else {
      const copy = new SeatLib(nid('lc'), c.name, c.icon, c.count, srcItems);
      copy.tag = f.name;
      copy.of = fromSeat === 'me' ? libId : (c.of === '' ? '' : c.of);
      t.libs.push(copy);
      store.pushLog('coop', `${f.name} 传给 ${t.name}：「${c.name}」`);
    }
    const hist = store.workbench.history.slice();
    hist.push(new WbHistory(f.name, t.name, c.name, nowTime().substring(0, 5)));
    if (hist.length > 40) {
      store.workbench.history = hist.slice(-40);
    } else {
      store.workbench.history = hist;
    }
    const chat = store.workbench.chat.slice();
    chat.push(new WbMsg(true, '', `${f.name} 把「${c.name}」发给了 ${t.name}${merged > 0 ? `，合并新增 ${merged} 项` : ''}${coopCreated ? '（本地已复制）' : ''}`, ''));
    store.workbench.chat = chat.slice(-80);
    return new SendResult(coopCreated, merged, c.name, t.name);
  });
}

export class SendResult {
  coopCreated: boolean = false;
  merged: number = 0;
  libName: string = '';
  toName: string = '';

  constructor(coopCreated: boolean, merged: number, libName: string, toName: string) {
    this.coopCreated = coopCreated;
    this.merged = merged;
    this.libName = libName;
    this.toName = toName;
  }
}

export function sendChat(fromName: string, text: string): Promise<void> {
  return sleep().then((): void => {
    const chat = store.workbench.chat.slice();
    chat.push(new WbMsg(false, fromName, text, nowTime().substring(0, 5)));
    store.workbench.chat = chat.slice(-80);
  });
}

export function endCoop(): Promise<WbHistory[]> {
  return sleep().then((): WbHistory[] => {
    const summary = store.workbench.history.slice();
    store.libraries = store.libraries.filter((l: Library): boolean => !l.coop);
    store.workbench.seats.forEach((s: Seat) => {
      if (s.id !== 'me') {
        s.libs = [];
      }
    });
    store.workbench.history = [];
    store.workbench.chat = [];
    store.pushLog('coop', '合作结束，聚合数据与协作复制库已清理');
    return summary;
  });
}

export function revokeInvite(): Promise<void> {
  return sleep().then((): void => {
    store.pushLog('invite', `撤销邀请码 ${store.workbench.code}`);
  });
}

/* ---------- 搜索（F2.4，同步） ---------- */
export interface SearchHit {
  name: string;
  emoji: string;
  img: ResourceStr;
  libName: string;
  libId: string;
  pos: string;
  qty: number;
  unit: string;
}

export function search(q: string): [SearchHit[], Library[]] {
  const query = q.trim().toLowerCase();
  const items: SearchHit[] = [];
  store.libraries.forEach((lib: Library) => {
    lib.items.forEach((it: Item) => {
      if (query === '' || it.name.toLowerCase().indexOf(query) > -1) {
        const hit: SearchHit = {
          name: it.name, emoji: it.emoji, img: it.img, libName: lib.name,
          libId: lib.id, pos: it.pos, qty: it.qty, unit: it.unit
        };
        items.push(hit);
      }
    });
  });
  const libs = query === '' ? [] : store.libraries.filter((l: Library): boolean => l.name.toLowerCase().indexOf(query) > -1);
  return [items, libs];
}

/* ---------- 对话（F5） ---------- */
export class ChatReply {
  text: string = '';
  plans: number[] = [];

  constructor(text: string, plans: number[]) {
    this.text = text;
    this.plans = plans;
  }
}

/**
 * 纯本地兜底回答（网关不可用时用）：
 * 只复述**用户自己库里**的真实事实，查不到就说查不到，绝不编造物品/数量/方案。
 * 旧实现返回的是写死的示例话术（"番茄炒蛋""采购清单：皮蛋 1 个…"），已删除。
 */
export function chatReply(text: string): Promise<ChatReply> {
  return sleep().then((): ChatReply => {
    const q = text || '';
    const it = findItemByName(q);
    if (it !== null) {
      const lib = libOfItem(it);
      const where = lib === null ? it.pos : `${lib.name} · ${it.pos}`;
      return new ChatReply(
        `（本地兜底·未联网）${it.name} 现有 ${it.qty}${it.unit}，放在 ${where}` +
        (it.expDays > 0 ? `，约 ${it.expDays} 天后到期。` : '。'), []);
    }
    if (store.libraries.length === 0) {
      return new ChatReply('（本地兜底·未联网）你的库还是空的，先拍照入库或手动添加，我才能按你的东西回答。', []);
    }
    const exp = expiringSoon();
    if (exp.length > 0) {
      return new ChatReply('（本地兜底·未联网）我现在只能查到你库里的原始事实：' +
        exp.slice(0, 3).map((i: Item): string => `${i.name} ${i.qty}${i.unit}（${i.expDays} 天后到期）`).join('、') +
        '。要更完整的建议，等联网后我再问一次。', []);
    }
    return new ChatReply('（本地兜底·未联网）我这边暂时连不上模型，只能确认：你的库里有 ' +
      `${store.libraries.length} 个库、共 ${countItems()} 件物品。联网后再问一次就能给你分析建议。`, []);
  });
}

/** 在用户自己的库里按名称找物品（本地兜底用） */
function findItemByName(q: string): Item | null {
  const s = q.trim();
  if (s === '') {
    return null;
  }
  let hit: Item | null = null;
  store.libraries.forEach((l: Library) => {
    l.items.forEach((it: Item) => {
      if (hit === null && it.name !== '' && s.indexOf(it.name) > -1) {
        hit = it;
      }
    });
  });
  return hit;
}

function libOfItem(it: Item): Library | null {
  let hit: Library | null = null;
  store.libraries.forEach((l: Library) => {
    if (hit === null && l.items.some((x: Item): boolean => x.id === it.id)) {
      hit = l;
    }
  });
  return hit;
}

function expiringSoon(): Item[] {
  const out: Item[] = [];
  store.libraries.forEach((l: Library) => {
    l.items.forEach((it: Item) => {
      if (it.expDays > 0 && it.expDays <= 7) {
        out.push(it);
      }
    });
  });
  out.sort((a: Item, b: Item): number => a.expDays - b.expDays);
  return out;
}

function countItems(): number {
  let n = 0;
  store.libraries.forEach((l: Library) => n += l.items.length);
  return n;
}

/* ---------- 设置 ---------- */
export function setSetting(key: string, on: boolean): Promise<void> {
  return sleep().then((): void => {
    store.settings[key] = on;
    store.pushLog('setting', `${key} = ${on}`);
  });
}

export function toggleDaily(id: number): Promise<void> {
  return sleep().then((): void => {
    store.daily.forEach((t: Todo) => {
      if (t.id === id) {
        t.done = !t.done;
      }
    });
  });
}

/* ---------- 重新识别（清空本次识别草稿，回到拍摄/上传） ---------- */
export function resetIntake(): void {
  store.intake = [];
  store.intakeStep = 0;
  store.intakeLoading = false;
}

export function kbSrc(kbKey: string): string {
  const kb = KNOWLEDGE[kbKey];
  return kb !== undefined ? kb.src : '';
}

/* ---------- AI 工具执行（M2.5 P0-2：预览确认后的写操作，A2 可逆） ---------- */

/** 把 AI 对话中的物品加入采购清单（同名去重，来源标注 AI 对话） */
export function addShoppingByAI(name: string, qty: string): Promise<void> {
  return sleep().then((): void => {
    const dup = store.shopping.some((s: ShoppingItem): boolean => s.name === name);
    if (dup) {
      throw new Error(`采购清单里已有「${name}」`);
    }
    // M-11 指标②：命中已有库存则拦截，避免重复购买
    const hit = store.findItemHit(name);
    if (hit !== null && hit[1].qty > 0) {
      store.ledger.blockedRepurchase += 1;
      saveLedger();
      throw new Error(`库存里还有「${hit[1].name}」${hit[1].qty}${hit[1].unit}，已拦截重复购买`);
    }
    const arr = store.shopping.slice();
    arr.unshift(new ShoppingItem(name, qty === '' ? '适量' : qty, 'AI 对话'));
    store.shopping = arr;
    store.pushLog('shopping', `AI 对话加入采购清单：${name}`);
  });
}

/** AI 创新菜谱落方案（P0-3）：用料逐项回查库存，存在入 used、缺失入 missing */
export function addAIPlan(title: string, time: string, note: string, ingredients: string[]): Promise<number> {
  return sleep().then((): number => {
    const used: Consume[] = [];
    const missing: Consume[] = [];
    ingredients.forEach((part: string) => {
      let matched = false;
      for (let i = 0; i < store.libraries.length && !matched; i++) {
        const lib = store.libraries[i];
        for (let j = 0; j < lib.items.length; j++) {
          const it = lib.items[j];
          if (part.includes(it.name)) {
            used.push(new Consume(it.name, part.replace(it.name, '').trim() === '' ? '适量' : part.replace(it.name, '').trim()));
            matched = true;
            break;
          }
        }
      }
      if (!matched) {
        missing.push(new Consume(part, ''));
      }
    });
    let nextId = 1;
    store.plans.forEach((p: Plan): void => {
      if (p.id >= nextId) {
        nextId = p.id + 1;
      }
    });
    // M-13 合规：AI 生成内容标识（方案卡来源标注"AI 生成"）
    const plan = new Plan(nextId, title, '高', note === '' ? 'AI 创新 · 消耗临期' : note, time, 'AI 创新菜谱（AI 生成）',
      used, missing, 'pending');
    plan.kcal = kcalGuess(title);
    store.plans = store.plans.concat([plan]);
    store.pushLog('plan', `AI 创新菜谱「${title}」已生成方案`);
    return nextId;
  });
}

/* ==========================================================================
   落地价值指标（整改文档 M-11）：① 临期消耗率 ② 拦截重复购买 ③ 盘点耗时
   口径全部来自本地账本（ValueLedger）+ 库存/日志实算，不经过模型（红线）。
   ========================================================================== */

export class ValueMetrics {
  expiringTotal: number = 0;
  expiringConsumed: number = 0;
  expiringRate: number = 0;       // 百分比（临期前被消耗数 / 临期总数）
  blockedRepurchase: number = 0;
  intakeMedianMs: number = 0;
  intakeRuns: number = 0;
}

/** 扫描当前临期物品并计入"临期总数"（同一物品只计一次，重启后仍去重） */
export function syncExpiring(): void {
  let changed = false;
  store.libraries.forEach((lib: Library) => {
    lib.items.forEach((it: Item) => {
      if (it.expDays <= 7 && store.ledger.expiringIds.indexOf(it.id) < 0) {
        store.ledger.expiringIds = store.ledger.expiringIds.concat([it.id]);
        store.ledger.expiringTotal += 1;
        changed = true;
      }
    });
  });
  if (changed) {
    saveLedger();
  }
}

/** 记录一次盘点（拍照入库批次）耗时，保留最近 50 次用于中位数 */
export function recordIntakeMs(ms: number): void {
  const arr = store.ledger.intakeMs.slice();
  arr.push(Math.max(0, Math.round(ms)));
  while (arr.length > 50) {
    arr.shift();
  }
  store.ledger.intakeMs = arr;
  saveLedger();
}

function medianOf(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.slice();
  sorted.sort((a: number, b: number): number => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[mid];
  }
  return Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** 看板卡片数据源：先同步一次临期账本，再算三项指标 */
export function valueMetrics(): ValueMetrics {
  syncExpiring();
  const v = new ValueMetrics();
  v.expiringTotal = store.ledger.expiringTotal;
  v.expiringConsumed = store.ledger.expiringConsumed;
  v.expiringRate = v.expiringTotal === 0 ? 0
    : Math.round(v.expiringConsumed * 1000 / v.expiringTotal) / 10;
  v.blockedRepurchase = store.ledger.blockedRepurchase;
  v.intakeMedianMs = medianOf(store.ledger.intakeMs);
  v.intakeRuns = store.ledger.intakeMs.length;
  return v;
}
