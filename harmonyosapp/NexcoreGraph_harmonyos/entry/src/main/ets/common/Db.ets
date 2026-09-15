/* 启核图策 · 数据模型与演示数据（移植 web-demo/js/data.js 与知识库） */

export class KbEntry {
  name: string = '';
  days: number = 0;
  tip: string = '';
  src: string = '';
  url: string = '';

  constructor(name: string, days: number, tip: string, src: string, url: string) {
    this.name = name;
    this.days = days;
    this.tip = tip;
    this.src = src;
    this.url = url;
  }
}

/* 食材知识库（入库/预警时引用，来源为网络检索到的权威资料） */
export const KNOWLEDGE: Record<string, KbEntry> = {
  'egg': new KbEntry('鸡蛋（冷藏）', 30, '洗净蛋连盒冷藏，勿放冰箱门边', '中国营养保健食品协会', 'https://www.cnhfa.org.cn/kpfx/kpwzqt/show/10565'),
  'milk': new KbEntry('巴氏鲜牛奶（冷藏）', 6, '开封后按包装说明尽快饮用，一般 24 小时内', '中国营养保健食品协会', 'https://www.cnhfa.org.cn/kpfx/kpwzqt/show/10565'),
  'tomato': new KbEntry('番茄（冷藏）', 12, '未完全成熟的番茄冷藏会停止成熟，可室温放置', '中国营养保健食品协会', 'https://www.cnhfa.org.cn/kpfx/kpwzqt/show/10565'),
  'greens': new KbEntry('叶菜（冷藏）', 3, '纸巾包裹加保鲜袋，2-3 天内食用', '营养师公会·中国时报', 'https://www.ctwant.com/article/440686/'),
  'pork': new KbEntry('生肉（冷藏）', 3, '冷藏不超 3-5 天；擦干水分分装冷冻', '黑龙江省人民政府', 'https://www.hlj.gov.cn/hljapp/c116063/202603/c00_31923320.shtml')
};

export class Item {
  id: string = '';
  no: string = '';
  name: string = '';
  emoji: string = '📦';
  img: ResourceStr = '';
  kbKey: string = '';
  qty: number = 1;
  unit: string = '个';
  price: number = 0;
  priceSrc: string = '手动';
  expDays: number = 7;
  pos: string = '未设置';
  isPrivate: boolean = false;
  expiring: boolean = false;

  constructor(id: string, name: string, emoji: string, img: ResourceStr, kbKey: string,
    qty: number, unit: string, price: number, priceSrc: string, expDays: number, pos: string, expiring: boolean) {
    this.id = id;
    this.name = name;
    this.emoji = emoji;
    this.img = img;
    this.kbKey = kbKey;
    this.qty = qty;
    this.unit = unit;
    this.price = price;
    this.priceSrc = priceSrc;
    this.expDays = expDays;
    this.pos = pos;
    this.expiring = expiring;
  }
}

export class Library {
  id: string = '';
  name: string = '';
  icon: string = 'package';
  tone: string = 'teal';
  count: number = 0;
  desc: string = '';
  items: Item[] = [];
  coop: boolean = false;
  coopFrom: string = '';
  coopAddOnly: boolean = false;
  of: string = '';
  tag: string = '';

  constructor(id: string, name: string, icon: string, tone: string, count: number, desc: string, items: Item[]) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.tone = tone;
    this.count = count;
    this.desc = desc;
    this.items = items;
  }
}

export class Consume {
  name: string = '';
  qty: string = '';

  constructor(name: string, qty: string) {
    this.name = name;
    this.qty = qty;
  }
}

export class Snap {
  id: string = '';
  name: string = '';
  before: number = 0;
  after: number = 0;

  constructor(id: string, name: string, before: number, after: number) {
    this.id = id;
    this.name = name;
    this.before = before;
    this.after = after;
  }
}

export class Plan {
  id: number = 0;
  title: string = '';
  priority: string = '中';
  reason: string = '';
  time: string = '';
  source: string = '知识库';
  used: Consume[] = [];
  missing: Consume[] = [];
  status: string = 'pending';
  selected: string[] = [];
  snapshot: Snap[] | null = null;
  kcal: number = 0;   // 营养速览：每份估算热量（0=未标注，展示"约 N 千卡"，F3.4/M2.5 P0-3）

  constructor(id: number, title: string, priority: string, reason: string, time: string, source: string,
    used: Consume[], missing: Consume[], status: string) {
    this.id = id;
    this.title = title;
    this.priority = priority;
    this.reason = reason;
    this.time = time;
    this.source = source;
    this.used = used;
    this.missing = missing;
    this.status = status;
    this.selected = used.map((u: Consume): string => u.name);
  }
}

export class AlertItem {
  id: number = 0;
  type: string = 'expiring';
  icon: string = 'clock';
  tone: string = 'amber';
  text: string = '';
  meta: string = '';

  constructor(id: number, type: string, icon: string, tone: string, text: string, meta: string) {
    this.id = id;
    this.type = type;
    this.icon = icon;
    this.tone = tone;
    this.text = text;
    this.meta = meta;
  }
}

export class ShoppingItem {
  name: string = '';
  qty: string = '';
  src: string = '';
  checked: boolean = false;

  constructor(name: string, qty: string, src: string) {
    this.name = name;
    this.qty = qty;
    this.src = src;
  }
}

export class ChatMsg {
  who: string = 'ai';
  text: string = '';
  time: string = '';
  plans: number[] = [];
  img: ResourceStr = '';
  adjName: string = '';
  adjQty: number = -1;
  adjDone: boolean = false;
  shopName: string = '';    // [购物] 工具行：待确认的加购名称（M2.5 P0-2）
  shopQty: string = '';     // 数量文本，如"1 盒"（可为空=适量）
  shopDone: boolean = false;
  srcNote: string = '';     // 来源小字，如"证据：冰箱·冷藏区｜鲜牛奶 1 盒"（P0-1）
  srcUrl: string = '';      // 知识库来源链接（M-8 来源引用）：点击可复制

  constructor(who: string, text: string, time: string, plans: number[]) {
    this.who = who;
    this.text = text;
    this.time = time;
    this.plans = plans;
  }
}

export class Todo {
  id: number = 0;
  text: string = '';
  done: boolean = false;

  constructor(id: number, text: string, done: boolean) {
    this.id = id;
    this.text = text;
    this.done = done;
  }
}

export class Activity {
  name: string = '';
  v: number = 0;

  constructor(name: string, v: number) {
    this.name = name;
    this.v = v;
  }
}

export class Stats {
  mealsLeft: number = 6;
  daysLeft: number = 3;
  spent: number = 328;
  budget: number = 600;
  wasted: number = 0;
  activity: Activity[] = [new Activity('林夏', 12), new Activity('妈妈', 8), new Activity('爸爸', 3)];
}

export class Family {
  id: string = '';
  name: string = '';
  memberCount: number = 0;

  constructor(id: string, name: string, memberCount: number) {
    this.id = id;
    this.name = name;
    this.memberCount = memberCount;
  }
}

/* AI 家庭偏好档案（M2.5 P0-4）：仅用户手填=显式确认，仅本地不 sync，AI 只读 */
@ObservedV2
export class Profile {
  @Trace people: number = 4;
  @Trace dislike: string = '';      // 忌口/过敏，如"不吃香菜"
  @Trace goal: string = '均衡';     // 均衡 | 控糖 | 减脂 | 高蛋白
  @Trace inject: boolean = true;    // 是否注入偏好到菜谱/营养类意图
}

export class IntakeResult {
  id: string = '';
  emoji: string = '❔';
  img: ResourceStr = '';
  name: string = '';
  category: string = '';
  qty: string = '';
  unit: string = '个';
  pos: string = '';
  exp: string = '';
  expSrc: string = '';
  expDays: number = 0;
  kbKey: string = '';
  price: string = '';
  priceSrc: string = '待补';
  attention: boolean = false;

  constructor(id: string, emoji: string, img: ResourceStr, name: string, category: string, qty: string, unit: string,
    pos: string, exp: string, expDays: number, kbKey: string, price: string, priceSrc: string, attention: boolean) {
    this.id = id;
    this.emoji = emoji;
    this.img = img;
    this.name = name;
    this.category = category;
    this.qty = qty;
    this.unit = unit;
    this.pos = pos;
    this.exp = exp;
    this.expDays = expDays;
    this.kbKey = kbKey;
    this.price = price;
    this.priceSrc = priceSrc;
    this.attention = attention;
  }
}

export class SeatItem {
  name: string = '';
  qty: number = 0;
  unit: string = '';
  no: string = '';

  constructor(name: string, qty: number, unit: string, no: string) {
    this.name = name;
    this.qty = qty;
    this.unit = unit;
    this.no = no;
  }
}

export class SeatLib {
  id: string = '';
  name: string = '';
  icon: string = 'package';
  count: number = 0;
  items: SeatItem[] = [];
  tag: string = '';
  of: string = '';

  constructor(id: string, name: string, icon: string, count: number, items: SeatItem[]) {
    this.id = id;
    this.name = name;
    this.icon = icon;
    this.count = count;
    this.items = items;
  }
}

export class Seat {
  id: string = '';
  name: string = '';
  color: string = 'teal';
  libs: SeatLib[] = [];

  constructor(id: string, name: string, color: string, libs: SeatLib[]) {
    this.id = id;
    this.name = name;
    this.color = color;
    this.libs = libs;
  }
}

export class WbMsg {
  sys: boolean = false;
  from: string = '';
  text: string = '';
  time: string = '';

  constructor(sys: boolean, from: string, text: string, time: string) {
    this.sys = sys;
    this.from = from;
    this.text = text;
    this.time = time;
  }
}

export class WbMember {
  name: string = '';
  color: string = 'teal';
  count: number = 0;
  items: string[] = [];

  constructor(name: string, color: string, count: number, items: string[]) {
    this.name = name;
    this.color = color;
    this.count = count;
    this.items = items;
  }
}

export class WbHistory {
  from: string = '';
  to: string = '';
  lib: string = '';
  time: string = '';

  constructor(from: string, to: string, lib: string, time: string) {
    this.from = from;
    this.to = to;
    this.lib = lib;
    this.time = time;
  }
}

export class WorkbenchPlan {
  title: string = '番茄蛋包饭';
  consume: string = 'A 家鸡蛋 4 个 · A 家大米 300 克 · B 家番茄 2 个';
  note: string = '执行后按归属自动扣减到各自库存';
}

export class Workbench {
  name: string = '周末聚餐 · 云工作台';
  expires: string = '7 天后到期';
  code: string = 'TZ-4821';
  myDeck: string[] = [];
  seats: Seat[] = [];
  chat: WbMsg[] = [];
  members: WbMember[] = [];
  plan: WorkbenchPlan = new WorkbenchPlan();
  history: WbHistory[] = [];

  constructor(seats: Seat[], chat: WbMsg[]) {
    this.seats = seats;
    this.chat = chat;
  }
}

/* ---------- 演示数据（data.js 原样移植） ---------- */

export function seedLibraries(): Library[] {
  const fridgeItems: Item[] = [
    new Item('egg', '鸡蛋', '🥚', $r('app.media.eggs'), 'egg', 8, '个', 15.9, '拍照识别', 3, '冷藏区中层', true),
    new Item('milk', '鲜牛奶', '🥛', $r('app.media.milk'), 'milk', 1, '盒', 12.5, '联网参考', 2, '冷藏区上层', true),
    new Item('tomato', '番茄', '🍅', $r('app.media.tomato'), 'tomato', 3, '个', 6.8, '手动', 6, '冷藏区底层', false),
    new Item('greens', '上海青', '🥬', $r('app.media.bokchoy'), 'greens', 2, '把', 4.2, '拍照识别', 4, '冷藏区底层', false),
    new Item('pork', '五花肉', '🥩', $r('app.media.pork'), 'pork', 500, '克', 18.5, '联网参考', 90, '冷冻区', false)
  ];
  const fridge = new Library('fridge', '冰箱', 'fridge', 'teal', 24, '冷藏 16 · 冷冻 8', fridgeItems);
  const wardrobe = new Library('wardrobe', '衣柜', 'shirt', 'indigo', 42, '上衣 18 · 下装 12 · 鞋 8', []);
  const medicine = new Library('medicine', '药盒', 'pill', 'red', 7, '含 1 项临期提醒', []);
  const tools = new Library('tools', '工具箱', 'wrench', 'slate', 15, '常用工具齐全', []);
  const fitness = new Library('fitness', '健身器材', 'dumbbell', 'lime', 6, '哑铃 · 瑜伽垫 · 弹力带', []);
  const books = new Library('books', '书架', 'book', 'brown', 38, '在读 4 本', []);
  const pet = new Library('pet', '宠物食品', 'paw', 'orange', 4, '猫粮 · 罐头 · 冻干', []);
  const appliances = new Library('appliances', '家电', 'plug', 'violet', 8, '含 1 项保修期提醒', []);
  return [fridge, wardrobe, medicine, tools, fitness, books, pet, appliances];
}

export function seedAlerts(): AlertItem[] {
  return [
    new AlertItem(1, 'expiring', 'clock', 'amber', '鲜牛奶 2 天后到期，建议优先饮用', '今天 08:00 · 冰箱'),
    new AlertItem(2, 'expiring', 'clock', 'amber', '鸡蛋 3 天后到期，可做番茄炒蛋或蒸蛋', '今天 08:00 · 冰箱'),
    new AlertItem(3, 'low', 'package', 'teal', '鸡蛋低于阈值提醒（阈值 5 个，当前 8 个）', '昨天 · 规则自动化'),
    new AlertItem(4, 'medicine', 'pill', 'red', '降压药 9 天后到期，请确认库存', '昨天 · 药盒'),
    new AlertItem(5, 'warranty', 'shield', 'muted', '空气炸锅 23 天后过保修期', '周一 · 家电')
  ];
}

export function seedPlans(): Plan[] {
  const p1 = new Plan(1, '番茄炒蛋', '高', '临期优先', '15 分钟', '知识库',
    [new Consume('鸡蛋', '3 个'), new Consume('番茄', '2 个')], [], 'pending');
  const p2 = new Plan(2, '上汤上海青', '中', '清库存', '20 分钟', '联网 · 小红书',
    [new Consume('上海青', '1 把')], [new Consume('皮蛋', '1 个')], 'pending');
  const p3 = new Plan(3, '牛奶燕麦粥', '高', '临期优先', '10 分钟', '知识库',
    [new Consume('鲜牛奶', '0.5 盒')], [new Consume('燕麦', '50 克')], 'pending');
  const p4 = new Plan(4, '清炒上海青', '中', '清库存', '12 分钟', '知识库',
    [new Consume('上海青', '1 把')], [], 'done');
  return [p1, p2, p3, p4];
}

export function seedShopping(): ShoppingItem[] {
  return [
    new ShoppingItem('皮蛋', '1 个', '上汤上海青 · 缺料'),
    new ShoppingItem('鸡蛋', '补到 12 个', '低库存提醒'),
    new ShoppingItem('燕麦', '50 克', '牛奶燕麦粥 · 缺料'),
    new ShoppingItem('生抽', '1 瓶', '低库存提醒')
  ];
}

export function seedWorkbench(): Workbench {
  const seats: Seat[] = [
    new Seat('me', '林夏 · 我', 'teal', [
      new SeatLib('fridge', '冰箱', 'fridge', 24, []),
      new SeatLib('wardrobe', '衣柜', 'shirt', 42, []),
      new SeatLib('medicine', '药盒', 'pill', 7, []),
      new SeatLib('tools', '工具箱', 'wrench', 15, [])
    ]),
    new Seat('A', 'A 家', 'amber', [
      new SeatLib('a1', '冰箱', 'fridge', 2, [new SeatItem('腊肉', 2, '块', 'NO-0001'), new SeatItem('火腿', 1, '根', 'NO-0002')]),
      new SeatLib('a2', '零食柜', 'package', 1, [new SeatItem('坚果', 1, '罐', 'NO-0003')])
    ]),
    new Seat('B', 'B 家', 'violet', [
      new SeatLib('b1', '冰箱', 'fridge', 1, [new SeatItem('海鲜丸', 1, '袋', 'NO-0004')]),
      new SeatLib('b2', '茶柜', 'package', 1, [new SeatItem('龙井', 1, '罐', 'NO-0005')])
    ])
  ];
  const chat: WbMsg[] = [
    new WbMsg(true, '', 'A 家 加入了牌桌', ''),
    new WbMsg(false, 'A 家', '今晚一起把冰箱清一清？', '19:02'),
    new WbMsg(false, '林夏', '好，我这边鸡蛋和番茄要先用掉', '19:03'),
    new WbMsg(false, 'B 家', '我冰箱还有海鲜丸，做汤刚好', '19:03')
  ];
  const wb = new Workbench(seats, chat);
  wb.myDeck = ['fridge', 'wardrobe', 'medicine', 'tools'];
  wb.members = [
    new WbMember('A 家', 'teal', 12, ['鸡蛋 ×8', '番茄 ×4', '大米 2 千克', '五花肉 500 克']),
    new WbMember('B 家', 'amber', 8, ['面粉 1 千克', '洋葱 ×3', '土豆 ×6', '牛奶 2 盒'])
  ];
  return wb;
}

export function seedChat(): ChatMsg[] {
  const m1 = new ChatMsg('me', '今晚用现有食材能做什么？', '19:02', []);
  const m2 = new ChatMsg('ai', '按临期优先级给你排了 3 个方案，都是现有食材能做的：', '19:02', [1, 2, 3]);
  const m3 = new ChatMsg('me', '牛奶还能放几天？', '19:03', []);
  const m4 = new ChatMsg('ai', '鲜牛奶开封后建议 3 天内喝完，按今天算还有 2 天。已加入今天的临期提醒，优先安排到晚餐或早餐里。', '19:03', []);
  const m5 = new ChatMsg('ai', '鸡蛋也快到期了，上面方案里的番茄炒蛋正好能消耗 3 个鸡蛋 + 2 个番茄。需要我帮你把采购清单一起生成吗？', '19:03', []);
  return [m1, m2, m3, m4, m5];
}

export function seedDaily(): Todo[] {
  return [
    new Todo(1, '优先饮用鲜牛奶（2 天后到期）', false),
    new Todo(2, '晚餐做番茄炒蛋，消耗临期鸡蛋', false),
    new Todo(3, '确认降压药库存（9 天后到期）', false)
  ];
}

export function seedIntake(): IntakeResult[] {
  return [
    new IntakeResult('egg', '🥚', $r('app.media.eggs'), '鸡蛋', '蛋类', '8', '个', '冷藏区中层', '30 天', 30, 'egg', '15.9', '拍照识别', false),
    new IntakeResult('tomato', '🍅', $r('app.media.tomato'), '番茄', '蔬菜', '3', '个', '冷藏区底层', '12 天', 12, 'tomato', '6.8', '拍照识别', false),
    new IntakeResult('milk', '🥛', $r('app.media.milk'), '鲜牛奶', '乳制品', '1', '盒', '冷藏区上层', '6 天（开封后 24 小时）', 6, 'milk', '12.5', '联网参考', false),
    new IntakeResult('unknown', '❔', '', '', '', '', '个', '', '', 0, '', '', '待补', true)
  ];
}
