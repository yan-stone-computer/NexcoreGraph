/* 启核图策 · 数据模型（+ 食材知识库）
   本文件只放"类型定义"和产品自带的知识库内容：
   - 用户数据（库/物品/方案/清单/待办/工作台/对话/预警）一律来自用户输入与后端，
     这里不再有任何预置样例数据（seed* 已全部删除）。
   - KNOWLEDGE 是产品内置的食材保质期知识（有公开来源），属于内容而非用户数据。 */

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

/* 数据类必须 @ObservedV2 + @Trace：写操作大量是「直接改对象字段」（item.qty = x），
   不深度观察的话界面不会重绘 —— 表现就是"数据确实改了但界面没变"。 */
@ObservedV2
export class Item {
  @Trace id: string = '';
  @Trace no: string = '';
  @Trace name: string = '';
  @Trace emoji: string = '📦';
  @Trace img: ResourceStr = '';
  @Trace kbKey: string = '';
  @Trace qty: number = 1;
  @Trace unit: string = '个';
  @Trace price: number = 0;
  @Trace priceSrc: string = '手动';
  @Trace expDays: number = 7;
  @Trace pos: string = '未设置';
  @Trace barcode: string = '';
  @Trace isPrivate: boolean = false;
  @Trace expiring: boolean = false;

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

@ObservedV2
export class Library {
  @Trace id: string = '';
  @Trace name: string = '';
  @Trace icon: string = 'package';
  @Trace tone: string = 'teal';
  @Trace count: number = 0;
  @Trace desc: string = '';
  @Trace items: Item[] = [];
  @Trace coop: boolean = false;
  @Trace coopFrom: string = '';
  @Trace coopAddOnly: boolean = false;
  @Trace of: string = '';
  @Trace tag: string = '';

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

@ObservedV2
export class Plan {
  @Trace id: number = 0;
  @Trace title: string = '';
  @Trace priority: string = '中';
  @Trace reason: string = '';
  @Trace time: string = '';
  @Trace source: string = '知识库';
  @Trace used: Consume[] = [];
  @Trace missing: Consume[] = [];
  @Trace status: string = 'pending';
  @Trace selected: string[] = [];
  @Trace snapshot: Snap[] | null = null;
  @Trace kcal: number = 0;   // 营养速览：每份估算热量（0=未标注，展示"约 N 千卡"，F3.4/M2.5 P0-3）

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

@ObservedV2
export class AlertItem {
  @Trace id: number = 0;
  @Trace type: string = 'expiring';
  @Trace icon: string = 'clock';
  @Trace tone: string = 'amber';
  @Trace text: string = '';
  @Trace meta: string = '';

  constructor(id: number, type: string, icon: string, tone: string, text: string, meta: string) {
    this.id = id;
    this.type = type;
    this.icon = icon;
    this.tone = tone;
    this.text = text;
    this.meta = meta;
  }
}

@ObservedV2
export class ShoppingItem {
  @Trace name: string = '';
  @Trace qty: string = '';
  @Trace src: string = '';
  @Trace checked: boolean = false;

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
  /* 自然语言指令的待确认写操作（删库 / 删物品 / 移动 / 改名） */
  opKind: string = '';
  opArg: string = '';
  opLabel: string = '';
  opDone: boolean = false;
  /* 消息版本号：改完一条消息（按钮点过、追加结果）后 +1，界面靠它判断要不要重绘 */
  ver: number = 0;
  srcNote: string = '';     // 来源小字，如"证据：冰箱·冷藏区｜鲜牛奶 1 盒"（P0-1）
  srcUrl: string = '';      // 知识库来源链接（M-8 来源引用）：点击可复制
  /* 真实时间戳（毫秒）。time 只是"给人看的标签"，由 stampLabel(ts) 算出来；
     以前直接把 '刚刚' 写进 time，跨天后看起来永远是"刚刚"，是错的。 */
  ts: number = 0;

  constructor(who: string, text: string, time: string, plans: number[]) {
    this.who = who;
    this.text = text;
    this.time = time;
    this.plans = plans;
  }
}

@ObservedV2
export class Todo {
  @Trace id: number = 0;
  @Trace text: string = '';
  @Trace done: boolean = false;

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

/* 统计口径全部为 0：真实数字由用户数据算出（见 Api.valueMetrics / 各页面的计算函数），
   不再预置任何样例数值与成员活跃度。 */
export class Stats {
  mealsLeft: number = 0;
  daysLeft: number = 0;
  spent: number = 0;
  budget: number = 0;
  wasted: number = 0;
  activity: Activity[] = [];
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
  barcode: string = '';
  barcodeSource: string = '';
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

/* 协作方案：标题/用料由"开饭"流程按真实手牌算出，这里不再预置示例菜与示例用量 */
export class WorkbenchPlan {
  title: string = '';
  consume: string = '';
  note: string = '执行后按归属自动扣减到各自库存';
}

export class Workbench {
  name: string = '家庭协作牌桌';
  expires: string = '';
  code: string = '';         // 邀请码由后端/上桌流程生成，不再写死示例码
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

  /**
   * 浅拷贝一份用于"整体替换"触发重绘。
   * 为什么不做成 @ObservedV2：Workbench 会整块进同步/落盘 DTO，被观测的实例 stringify
   * 会带上内部前缀字段，污染协议；所以这里用换实例的办法让 ArkUI 感知变化。
   */
  cloneForRender(): Workbench {
    const w = new Workbench(this.seats.slice(), this.chat.slice());
    w.name = this.name;
    w.expires = this.expires;
    w.code = this.code;
    w.myDeck = this.myDeck.slice();
    w.members = this.members.slice();
    w.plan = this.plan;
    w.history = this.history.slice();
    return w;
  }
}

