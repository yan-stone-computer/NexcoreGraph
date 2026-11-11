/* 启核图策 · 自然语言指令层
   一份命令表，两个用途：
   ① 对话里直接执行：确定性解析，0 次模型调用（断网也能建库、加物品、换主题）；
   ② AI 面板里「指令手册」的内容源：手册列的句子就是一定会命中的句子，实现改了手册跟着改，
      不会出现"帮助里写着能说、实际听不懂"。
   开放式提问（今晚吃什么、营养、为什么…）仍然走模型路，见 AiGateway.askAI。
   所有会改变业务数据的操作都不直接执行：返回 opKind + opLabel，由对话里的确认按钮落地。 */

import { hilog } from '@kit.PerformanceAnalysisKit';
import { store } from './Store';
import { Library, Item, Plan, AlertItem, Consume } from './Db';
import { T } from './Tokens';
import {
  createLibrary, renameLibrary, deleteLibrary, addItem, deleteItem, moveItemToLib, ItemForm,
  setItemQtyByName, addShoppingByAI, generatePlans, executePlan, resolveAlert, createCoop, joinCoop,
  search, SearchHit, setMedicineDoseByName
} from './Api';
import { forceUploadSync, downloadSync } from './SyncApi';
import { saveThemePrefs } from './LocalStore';
import { routeIntent } from './Router';
import { AgentAction, PolicyDecision } from './AgentTypes';
import { checkPolicy, claimActionOnce } from './PolicyEngine';

const DOMAIN: number = 0x0000;
const TAG: string = 'NexcoreGraph';

/* ---------- 手册条目（帮助页的数据源） ---------- */
export class CmdSpec {
  group: string = '';
  example: string = '';
  note: string = '';

  constructor(group: string, example: string, note: string) {
    this.group = group;
    this.example = example;
    this.note = note;
  }
}

export const CMD_GROUPS: string[] = ['看一眼库存', '建库与改名', '物品增减与移动', '采购与方案', '多端与设置'];

export const CMD_HELP: CmdSpec[] = [
  new CmdSpec('看一眼库存', '库存里都有什么', '列出每个库和件数，本地算，不调模型'),
  new CmdSpec('看一眼库存', '牛奶还剩多少', '原样回库存里的数量'),
  new CmdSpec('看一眼库存', '牛奶放在哪', '回库位（库 · 位置）'),
  new CmdSpec('看一眼库存', '牛奶还能放几天', '有保质期的回天数，衣物工具这类回"没有保质期"'),
  new CmdSpec('看一眼库存', '搜一下螺丝刀', '跨库搜名称与库位'),
  new CmdSpec('看一眼库存', '打开资源库', '也能说：打开首页 / 工作台 / 我的 / 数据分析 / 知识图谱 / 采购清单'),

  new CmdSpec('建库与改名', '帮我建一个工具箱库', '库名随你定，冰箱、衣柜、厨具柜一样建'),
  new CmdSpec('建库与改名', '把药盒改名叫急救箱', '改名后会问一次确认'),
  new CmdSpec('建库与改名', '删掉零食柜', '删库前先确认，删完还有撤销'),

  new CmdSpec('物品增减与移动', '往工具箱加一把螺丝刀', '数量单位都能带：两瓶、三袋、五盒'),
  new CmdSpec('物品增减与移动', '鸡蛋还剩 5 个', '直接改数量（消耗、补货都这么说）'),
  new CmdSpec('物品增减与移动', '退烧药每天吃 2 片', '药品每日用量由用户明确填写'),
  new CmdSpec('物品增减与移动', '把炒锅移到厨具柜', '跨库搬家，数量位置一起带走'),
  new CmdSpec('物品增减与移动', '删掉炒锅', '删物品前先确认，删完还有撤销'),

  new CmdSpec('采购与方案', '把牛奶加进采购清单', '缺什么一句话写进清单'),
  new CmdSpec('采购与方案', '生成方案', '按库存和临期重新排方案'),
  new CmdSpec('采购与方案', '执行清蒸鲈鱼', '按方案里的用料扣库存，可撤销'),
  new CmdSpec('采购与方案', '鸡蛋的提醒处理掉', '把这条临期提醒核销掉'),

  new CmdSpec('多端与设置', '创建协作池', '拿到 6 位邀请码，家人用码加入'),
  new CmdSpec('多端与设置', '加入协作池 ABC123', '换成实际邀请码'),
  new CmdSpec('多端与设置', '换成深色主题', '也能说：换回浅色主题 / 换成经典橙色板'),
  new CmdSpec('多端与设置', '备份到本机后端', '把本机数据推到自建后端'),
  new CmdSpec('多端与设置', '从本机后端拉取', '用后端快照覆盖本机'),
];

/* ---------- 命中结果与回复 ---------- */
export class CmdMatch {
  id: string = '';
  a: string = '';
  b: string = '';
  n: number = 0;
  raw: string = '';

  constructor(id: string, a: string, b: string, n: number, raw: string) {
    this.id = id;
    this.a = a;
    this.b = b;
    this.n = n;
    this.raw = raw;
  }
}

export class CmdReply {
  text: string = '';
  route: string = '';
  opKind: string = '';      // 非空 = 需要用户点确认的写操作
  opArg: string = '';
  opLabel: string = '';
  srcNote: string = '';

  constructor(text: string, route: string, srcNote: string) {
    this.text = text;
    this.route = route;
    this.srcNote = srcNote;
  }
}

/* ---------- 小工具 ---------- */
function norm(q: string): string {
  return q.replace(/[\s，。！？、,.!?]/g, '').trim();
}

/** 库名匹配：先精确（含"X库/X柜"），再互相包含；找不到返回 null */
function findLibByName(name: string): Library | null {
  const n = name.trim();
  if (n === '') {
    return null;
  }
  let exact: Library | null = null;
  let loose: Library | null = null;
  store.libraries.forEach((l: Library) => {
    if (l.id === n || l.name === n || l.name === n + '库' || l.name === n + '柜') {
      exact = l;
    } else if (loose === null && (l.name.indexOf(n) > -1 || n.indexOf(l.name) > -1)) {
      loose = l;
    }
  });
  return exact !== null ? exact : loose;
}

/** 物品匹配：先精确名，再互相包含；找不到返回 null */
function findItemLoose(name: string): Item | null {
  const n = name.trim();
  if (n === '') {
    return null;
  }
  const exact = store.findItemHit(n);
  if (exact !== null) {
    return exact[1];
  }
  let loose: Item | null = null;
  store.libraries.forEach((l: Library) => {
    l.items.forEach((it: Item) => {
      if (loose === null && (it.name.indexOf(n) > -1 || n.indexOf(it.name) > -1)) {
        loose = it;
      }
    });
  });
  return loose;
}

const UNITS: string[] = ['个', '只', '把', '瓶', '袋', '盒', '包', '箱', '件', '根', '条', '张', '块', '斤',
  '桶', '罐', '套', '双', '台', '支', '卷', '副', '枚', '片', '杯', '捆', '升', '箱'];
const CN_NUM: string[] = ['零', '一', '两', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

class Amount {
  name: string = '';
  qty: number = 1;
  unit: string = '个';
}

function unitAt(s: string, i: number): string {
  if (i < 0 || i >= s.length) {
    return '';
  }
  const two = s.substring(i, i + 2);
  if (two === '公斤') {
    return two;
  }
  const one = s.substring(i, i + 1);
  return UNITS.indexOf(one) > -1 ? one : '';
}

/** "一把螺丝刀" / "螺丝刀2把" / "两瓶牛奶" → 名称 + 数量 + 单位 */
export function parseAmount(phrase: string): Amount {
  const out = new Amount();
  let s = phrase.trim();
  // 前缀噪声："多了/还有/新增/补/了/的"
  s = s.replace(/^(多了|多|还有|又|再|新增|补了|补|新|了|的)+/, '');

  // 形式一：数量在前（一把螺丝刀、2 瓶牛奶）
  let qty = 0;
  let used = 0;
  const m1 = /^(\d+)([^0-9]{0,2})/.exec(s);
  if (m1 !== null) {
    qty = parseInt(m1[1], 10);
    const u = unitAt(s, m1[1].length);
    if (u !== '') {
      out.unit = u;
      used = m1[1].length + u.length;
    } else {
      used = m1[1].length;
    }
  } else {
    const head = s.substring(0, 1);
    const idx = CN_NUM.indexOf(head);
    if (idx > 0) {
      qty = idx === 2 ? 2 : idx;      // "两" = 2
      const u = unitAt(s, 1);
      if (u !== '') {
        out.unit = u;
        used = 1 + u.length;
      } else {
        used = 1;
      }
    }
  }
  let rest = used > 0 ? s.substring(used) : s;

  // 形式二：数量在后（螺丝刀 2 把）
  const m2 = /(\d+)([^0-9]{0,2})$/.exec(rest);
  if (qty === 0 && m2 !== null) {
    const tail = m2[0];
    const u = unitAt(rest, rest.length - tail.length + m2[1].length);
    qty = parseInt(m2[1], 10);
    if (u !== '') {
      out.unit = u;
      rest = rest.substring(0, rest.length - tail.length);
    } else {
      rest = rest.substring(0, rest.length - m2[1].length);
    }
  }

  out.qty = qty > 0 ? qty : 1;
  out.name = rest.replace(/^(的|了|一个|几个|个)+/, '').replace(/(的)+$/, '').trim();
  return out;
}

function pageTarget(word: string): string {
  if (word === '首页') { return 'home'; }
  if (word === '资源库') { return 'libs'; }
  if (word === '工作台') { return 'work'; }
  if (word === '我的' || word === '设置') { return 'mine'; }
  if (word === '数据分析' || word === '看板') { return 'analytics'; }
  if (word === '知识图谱' || word === '图谱') { return 'graph'; }
  if (word === '采购清单' || word === '购物清单') { return 'shopping'; }
  if (word === '提醒' || word === '预警') { return 'alerts'; }
  if (word === '方案') { return 'plans'; }
  if (word === '搜索') { return 'search'; }
  if (word === '流转') { return 'flow'; }
  return '';
}

/* ---------- 命中（确定性解析，按"具体在前、宽泛在后"排） ---------- */
export function matchCommand(q: string): CmdMatch | null {
  const s = norm(q);
  if (s === '') {
    return null;
  }
  let m: RegExpExecArray | null = null;

  if (/^(指令|指令手册|帮助|手册|怎么用|能做什么|能说什么|能干什么|help)$/.test(s)) {
    return new CmdMatch('help', '', '', 0, q);
  }
  if (/^(库存|家里|柜子|库).{0,2}(都)?有(什么|啥|哪些)/.test(s) || /^(看看|查看)?(我的)?(全部)?库存$/.test(s)) {
    return new CmdMatch('list', '', '', 0, q);
  }
  // 打开某个页面
  m = /^(?:打开|进入|切到|去|看看)(首页|资源库|工作台|我的|设置|数据分析|看板|知识图谱|图谱|采购清单|购物清单|提醒|预警|方案|搜索|流转)$/.exec(s);
  if (m !== null && pageTarget(m[1]) !== '') {
    return new CmdMatch('open', pageTarget(m[1]), m[1], 0, q);
  }
  // 搜索
  m = /^(?:搜|搜索|搜一下|找|找一下|找找|查|查一下)(.+)$/.exec(s);
  if (m !== null) {
    return new CmdMatch('search', m[1], '', 0, q);
  }
  // 建库
  m = /^(?:帮我|请|给我)?(?:新建|创建|建|加)(?:一个|个)?(.{1,10}?)(?:库|柜)$/.exec(s);
  if (m !== null) {
    return new CmdMatch('newlib', m[1], '', 0, q);
  }
  // 改名（写操作，要确认）
  m = /^(?:把|帮我把)?(.{1,10}?)(?:库|柜)?(?:改名|重命名|改叫|改称|改为|改成)(.{1,10})$/.exec(s);
  if (m !== null) {
    return new CmdMatch('renamelib', m[1], m[2], 0, q);
  }
  // 删库
  m = /^(?:把|帮我把)?(.{1,10}?)(?:库|柜)(?:删掉|删除|移除了?|去掉|不要了)$/.exec(s);
  if (m !== null) {
    return new CmdMatch('dellib', m[1], '', 0, q);
  }
  m = /^(?:删掉|删除|移除|去掉)(.{1,10}?)(?:库|柜)$/.exec(s);
  if (m !== null) {
    return new CmdMatch('dellib', m[1], '', 0, q);
  }
  // 加入物品（往 X 库加 Y）
  m = /^(?:把|给|往|向|在)(.{1,10}?)(?:库|柜)?(?:里|中)?(?:加|添加|新增|放|记)(?:上|一下)?(.{1,16})$/.exec(s);
  if (m !== null) {
    return new CmdMatch('additem', m[1], m[2], 0, q);
  }
  m = /^新增(.{1,16})到(.{1,10}?)(?:库|柜)?$/.exec(s);
  if (m !== null) {
    return new CmdMatch('additem', m[2], m[1], 0, q);
  }
  // 移动（写操作，要确认）
  m = /^(?:把|帮我把)?(.{1,12}?)(?:移|挪|搬|换|放)(?:到|去)(.{1,10}?)(?:库|柜)?$/.exec(s);
  if (m !== null) {
    return new CmdMatch('moveitem', m[1], m[2], 0, q);
  }
  // 改数量："鸡蛋还剩 5 个"
  m = /^(.{1,12}?)(?:还剩|只剩|还有|剩|现有|改成|设为)(\d+)(.{0,3})$/.exec(s);
  if (m !== null) {
    return new CmdMatch('qty', m[1], m[3], parseInt(m[2], 10), q);
  }
  // 药品每日用量：“退烧药每天吃 2 片”
  m = /^(.{1,12}?)(?:每天|每日|一天)(?:吃|用|服用|需要)?(\d+(?:\.\d+)?)(.{0,3})$/.exec(s);
  if (m !== null) {
    return new CmdMatch('dose', m[1], m[3], parseFloat(m[2]), q);
  }
  // 加进采购清单
  m = /^(?:把|给)?(.{1,12}?)(?:加|写|放)(?:进|到|入)(?:采购|购物|购买)?清单$/.exec(s);
  if (m !== null) {
    return new CmdMatch('shopadd', m[1], '', 0, q);
  }
  // 方案
  if (/^(重新)?生成(新)?方案$/.test(s)) {
    return new CmdMatch('plangen', '', '', 0, q);
  }
  m = /^执行(?:方案)?(.{1,14})$/.exec(s);
  if (m !== null) {
    return new CmdMatch('planrun', m[1], '', 0, q);
  }
  // 提醒核销
  m = /^(.{1,12}?)(?:的)?(?:提醒|预警|临期提醒)(?:我)?(?:处理|解决|核销|清)(?:掉|了)?$/.exec(s);
  if (m !== null) {
    return new CmdMatch('alertdone', m[1], '', 0, q);
  }
  // 协作池
  if (/^(?:创建|新建|开|建)(?:一个)?(?:协作池|协作|拼菜池|拼菜|牌桌)$/.test(s)) {
    return new CmdMatch('coopcreate', '', '', 0, q);
  }
  m = /^加入(?:协作池|拼菜池)?([A-Za-z0-9]{4,8})$/.exec(s);
  if (m !== null) {
    return new CmdMatch('coopjoin', m[1].toUpperCase(), '', 0, q);
  }
  m = /^用([A-Za-z0-9]{4,8})加入(?:协作池|拼菜池)?$/.exec(s);
  if (m !== null) {
    return new CmdMatch('coopjoin', m[1].toUpperCase(), '', 0, q);
  }
  // 主题
  m = /^(?:切换|换|改|调)(?:成|为|到|回|至)?(深色|暗色|夜间|深色模式|浅色|亮色|白天|浅色模式|日间)(?:主题|模式|色)?$/.exec(s);
  if (m !== null) {
    const dark = m[1] === '深色' || m[1] === '暗色' || m[1] === '夜间' || m[1] === '深色模式';
    return new CmdMatch('theme', dark ? 'dark' : 'light', m[1], 0, q);
  }
  m = /^(?:切换|换|改|调)(?:主题|色板)?(?:成|为|到|回|至)?(经典橙|启核绿青蓝|启核|绿青蓝|青蓝)(?:色板|主题)?$/.exec(s);
  if (m !== null) {
    const classic = m[1] === '经典橙';
    return new CmdMatch('palette', classic ? 'classic' : 'nexcore', m[1], 0, q);
  }
  // 备份
  if (/^(?:备份|上传)(?:到本机后端|到后端|数据|一下)?$/.test(s) || /^保存到后端$/.test(s)) {
    return new CmdMatch('backupup', '', '', 0, q);
  }
  if (/^(?:从本机后端)?(?:拉取|恢复|下载)(?:备份|数据|快照|一下)?$/.test(s)) {
    return new CmdMatch('backupdown', '', '', 0, q);
  }
  // 删物品（兜底：不带"库/柜"后缀时按物品找）
  m = /^(?:把|帮我把)?(.{1,12}?)(?:删掉|删除|移除了?|去掉|不要了)$/.exec(s);
  if (m !== null) {
    return new CmdMatch('delitem', m[1], '', 0, q);
  }
  m = /^(?:删掉|删除|移除|去掉)(.{1,12})$/.exec(s);
  if (m !== null) {
    return new CmdMatch('delitem', m[1], '', 0, q);
  }
  return null;
}

/* ---------- 执行 ---------- */
function libLine(l: Library): string {
  const names: string[] = [];
  l.items.slice(0, 6).forEach((it: Item) => names.push(`${it.name} ${it.qty}${it.unit}`));
  const more = l.items.length > 6 ? ` 等 ${l.items.length} 件` : '';
  return names.length === 0 ? `${l.name}：空` : `${l.name}（${l.items.length} 件）：${names.join('、')}${more}`;
}

function listInventory(): string {
  if (store.libraries.length === 0) {
    return '还没有库。说一句「帮我建一个冰箱库」就能开始，或者直接拍照入库。';
  }
  let total = 0;
  let expiring = 0;
  store.libraries.forEach((l: Library) => {
    total += l.items.length;
    l.items.forEach((it: Item) => {
      if (it.expDays > 0 && it.expDays <= 7) {
        expiring += 1;
      }
    });
  });
  const lines: string[] = [];
  store.libraries.forEach((l: Library) => lines.push('· ' + libLine(l)));
  let head = `现在有 ${store.libraries.length} 个库、共 ${total} 件物品`;
  head += expiring > 0 ? `，其中 ${expiring} 件临期。` : '，没有临期物品。';
  return head + '\n' + lines.join('\n');
}

function doOpen(target: string, word: string): string {
  store.overlayArg = '';
  if (target === 'home') {
    store.tabIndex = 0;
    store.overlay = '';
    return '回到首页了。临期与待办都在「今天要处理」那张卡上。';
  }
  if (target === 'libs') {
    store.tabIndex = 1;
    store.overlay = '';
    return '打开资源库了。库卡片点进去看清单，右上角可以直接拍照入库。';
  }
  if (target === 'work') {
    store.tabIndex = 2;
    store.overlay = '';
    return '打开工作台了。摆上手牌就能和家人一起拼菜。';
  }
  if (target === 'mine') {
    store.tabIndex = 3;
    store.overlay = '';
    return '打开「我的」了。服务器连接、账号与数据、外观都在这一页。';
  }
  store.overlay = target;
  return `打开${word}了。`;
}

function planByArg(arg: string): Plan | null {
  const pending: Plan[] = store.plans.filter((p: Plan): boolean => p.status !== 'done');
  if (pending.length === 0) {
    return null;
  }
  if (/^(第)?一(个)?(方案)?$/.test(arg) || arg === '第一个') {
    return pending[0];
  }
  let hit: Plan | null = null;
  pending.forEach((p: Plan) => {
    if (hit === null && (p.title === arg || p.title.indexOf(arg) > -1 || arg.indexOf(p.title) > -1)) {
      hit = p;
    }
  });
  return hit;
}

function alertByArg(arg: string): AlertItem | null {
  let hit: AlertItem | null = null;
  store.alerts.forEach((a: AlertItem) => {
    if (hit === null && (a.text.indexOf(arg) > -1 || arg.indexOf(a.text) > -1)) {
      hit = a;
    }
  });
  return hit;
}

function previewReply(text: string, kind: string, arg: string, label: string, note: string): CmdReply {
  const reply = new CmdReply(text, 'cmd:' + kind, note);
  reply.opKind = kind;
  reply.opArg = arg;
  reply.opLabel = label;
  return reply;
}

class AddItemPayload {
  libId: string = '';
  name: string = '';
  qty: number = 1;
  unit: string = '个';
}

function policyForCommand(kind: string, arg: string): AgentAction {
  const action = new AgentAction();
  action.id = kind + ':' + arg;
  action.target = arg === '' ? '当前家庭' : arg;
  if (kind === 'qty') {
    action.kind = 'adjust_inventory';
    const parts = arg.split('|');
    action.target = parts.length > 0 ? parts[0] : '';
    action.qty = parts.length > 1 ? Number(parts[1]) : -1;
  } else if (kind === 'dose') {
    action.kind = 'set_medicine_dose';
    const parts = arg.split('|');
    action.target = parts.length > 0 ? parts[0] : '';
    action.qty = parts.length > 1 ? Number(parts[1]) : -1;
  } else if (kind === 'shopadd') {
    action.kind = 'add_shopping';
    const parts = arg.split('|');
    action.target = parts.length > 0 ? parts[0] : '';
    action.qty = 1;
  } else if (kind === 'additem') {
    action.kind = 'add_inventory';
    try {
      const payload = JSON.parse(arg) as AddItemPayload;
      action.target = payload.name;
      action.qty = payload.qty;
    } catch (_e) {
      action.target = '';
    }
  } else if (kind === 'newlib') {
    action.kind = 'create_library';
    action.target = arg;
  } else if (kind === 'plangen') {
    action.kind = 'create_meal_plan';
    action.target = '今日餐食方案';
  } else if (kind === 'planrun') {
    action.kind = 'execute_meal_plan';
    action.target = '方案' + arg;
  } else if (kind === 'alertdone') {
    action.kind = 'resolve_alert';
    action.target = '预警' + arg;
  } else if (kind === 'coopcreate') {
    action.kind = 'create_coop';
    action.target = '协作池';
  } else if (kind === 'coopjoin') {
    action.kind = 'join_coop';
    action.target = arg;
  } else if (kind === 'dellib' || kind === 'renamelib') {
    action.kind = kind;
  } else if (kind === 'delitem' || kind === 'moveitem') {
    action.kind = kind;
  }
  return action;
}

/** 执行一条指令；破坏性操作只返回确认卡，不落库 */
export async function runCommand(m: CmdMatch): Promise<CmdReply> {
  const note = '本地指令 · 0 次模型调用';

  if (m.id === 'list') {
    return new CmdReply(listInventory(), 'cmd:list', note);
  }
  if (m.id === 'open') {
    return new CmdReply(doOpen(m.a, m.b), 'cmd:open', note);
  }
  if (m.id === 'search') {
    const hits: SearchHit[] = search(m.a)[0];
    if (hits.length === 0) {
      return new CmdReply(`没搜到「${m.a}」。换个词试试，或者先拍照入库。`, 'cmd:search', note);
    }
    const lines: string[] = [];
    hits.slice(0, 8).forEach((h: SearchHit) => lines.push(`· ${h.name} ${h.qty}${h.unit}｜${h.libName} · ${h.pos}`));
    return new CmdReply(`找到 ${hits.length} 条：\n` + lines.join('\n'), 'cmd:search', note);
  }
  if (m.id === 'newlib') {
    const name = m.a.trim();
    if (name === '') {
      return new CmdReply('要新建什么库？可以说「帮我建一个书房库」。', 'cmd:newlib', note);
    }
    return previewReply(`要新建资源库「${name}」？`, 'newlib', name, `新建库「${name}」`, note);
  }
  if (m.id === 'additem') {
    const lib = findLibByName(m.a);
    if (lib === null) {
      return new CmdReply(`没找到叫「${m.a}」的库。先说「帮我建一个${m.a}库」，再往里放东西。`, 'cmd:additem', note);
    }
    const am = parseAmount(m.b);
    if (am.name === '') {
      return new CmdReply(`要往${lib.name}加什么？可以说「往${lib.name}加一把螺丝刀」。`, 'cmd:additem', note);
    }
    const payload = new AddItemPayload();
    payload.libId = lib.id;
    payload.name = am.name;
    payload.qty = am.qty;
    payload.unit = am.unit;
    return previewReply(`要把「${am.name}」${am.qty}${am.unit}加入「${lib.name}」？`,
      'additem', JSON.stringify(payload), `加入「${lib.name}」`, note);
  }
  if (m.id === 'qty') {
    const it = findItemLoose(m.a);
    if (it === null) {
      return new CmdReply(`库存里没有「${m.a}」。可以说「往某个库加${m.a}」，或者换个名称试试。`, 'cmd:qty', note);
    }
    const name = it.name;
    const unit = it.unit;
    return previewReply(`要把「${name}」从 ${it.qty}${unit} 调整为 ${m.n}${unit}？`,
      'qty', `${it.id}|${m.n}`, `调整「${name}」到 ${m.n}${unit}`, note);
  }
  if (m.id === 'dose') {
    const it = findItemLoose(m.a);
    if (it === null) {
      return new CmdReply(`库存里没有「${m.a}」。先入库，再设置每日用量。`, 'cmd:dose', note);
    }
    return previewReply(`要把「${it.name}」的每日用量设为 ${m.n}${it.unit}？`,
      'dose', `${it.id}|${m.n}`, `设置「${it.name}」每日 ${m.n}${it.unit}`, note);
  }
  if (m.id === 'shopadd') {
    const it = findItemLoose(m.a);
    const name = it !== null ? it.name : m.a.trim();
    if (name === '') {
      return new CmdReply('要买什么？可以说「把牛奶加进采购清单」。', 'cmd:shopadd', note);
    }
    return previewReply(`要把「${name}」加入采购清单？`, 'shopadd', `${name}|1 份`,
      `加入采购清单「${name}」`, note);
  }
  if (m.id === 'plangen') {
    return previewReply('要根据当前库存生成新的餐食方案？', 'plangen', '', '生成餐食方案', note);
  }
  if (m.id === 'planrun') {
    const p = planByArg(m.a.trim());
    if (p === null) {
      return new CmdReply(`没找到叫「${m.a}」的待执行方案。可以说「生成方案」先排一批。`, 'cmd:planrun', note);
    }
    const target: Plan = p;
    const names: string[] = [];
    target.used.forEach((u: Consume) => names.push(u.name));
    if (names.length === 0) {
      return new CmdReply(`方案「${target.title}」没有需要扣减的用料。`, 'cmd:planrun', note);
    }
    return previewReply(`要执行「${target.title}」并按用料扣减 ${names.length} 项库存？`,
      'planrun', String(target.id), `执行「${target.title}」`, note);
  }
  if (m.id === 'alertdone') {
    const a = alertByArg(m.a.trim());
    if (a === null) {
      return new CmdReply(`没找到和「${m.a}」相关的提醒。首页「今天要处理」里能看到当前所有提醒。`,
        'cmd:alertdone', note);
    }
    return previewReply(`要把「${a.text}」标记为已处理？`, 'alertdone', String(a.id), '处理预警', note);
  }
  if (m.id === 'coopcreate') {
    return previewReply('要创建一个新的家庭协作池？', 'coopcreate', '', '创建协作池', note);
  }
  if (m.id === 'coopjoin') {
    return previewReply(`要加入协作池「${m.a}」？`, 'coopjoin', m.a, '加入协作池', note);
  }
  if (m.id === 'theme') {
    const dark = m.a === 'dark';
    T.setDark(dark);
    saveThemePrefs();
    return new CmdReply(dark ? '换成深色了，晚上看着不刺眼。' : '换回浅色了。', 'cmd:theme', note);
  }
  if (m.id === 'palette') {
    const classic = m.a === 'classic';
    T.setPalette(classic ? 'classic' : 'nexcore');
    saveThemePrefs();
    return new CmdReply(classic ? '换成经典橙色板了。' : '换回启核绿青蓝色板了。', 'cmd:palette', note);
  }
  if (m.id === 'backupup') {
    const c = await forceUploadSync();
    return new CmdReply(c.error === '' ? '已把本机数据备份到后端，换设备登录后能拉到同一份。'
      : `备份没成功：${c.error}`, 'cmd:backupup', note);
  }
  if (m.id === 'backupdown') {
    try {
      await downloadSync();
      return new CmdReply('已从后端拉取并覆盖本机数据。', 'cmd:backupdown', note);
    } catch (e) {
      return new CmdReply('拉取失败：后端没有可用的快照，或者网络不通。', 'cmd:backupdown', note);
    }
  }
  // 破坏性操作：只出确认卡，等用户点确认
  if (m.id === 'dellib') {
    const lib = findLibByName(m.a);
    if (lib === null) {
      return new CmdReply(`没找到叫「${m.a}」的库。`, 'cmd:dellib', note);
    }
    const r = new CmdReply(`要删掉库「${lib.name}」？里面还有 ${lib.items.length} 件物品，删完还能撤销。`,
      'cmd:dellib', note);
    r.opKind = 'dellib';
    r.opArg = lib.id;
    r.opLabel = `删除库「${lib.name}」`;
    return r;
  }
  if (m.id === 'delitem') {
    const it = findItemLoose(m.a);
    if (it === null) {
      return new CmdReply(`库存里没有「${m.a}」。`, 'cmd:delitem', note);
    }
    const lib = store.findItem(it.id);
    const where = lib === null ? '' : lib.name + ' · ';
    const r = new CmdReply(`要删掉「${it.name}」（${where}${it.qty}${it.unit}）？`, 'cmd:delitem', note);
    r.opKind = 'delitem';
    r.opArg = it.id;
    r.opLabel = `删除物品「${it.name}」`;
    return r;
  }
  if (m.id === 'moveitem') {
    const it = findItemLoose(m.a);
    const lib = findLibByName(m.b);
    if (it === null) {
      return new CmdReply(`库存里没有「${m.a}」。`, 'cmd:moveitem', note);
    }
    if (lib === null) {
      return new CmdReply(`没找到叫「${m.b}」的库。`, 'cmd:moveitem', note);
    }
    const r = new CmdReply(`要把「${it.name}」移到「${lib.name}」？`, 'cmd:moveitem', note);
    r.opKind = 'moveitem';
    r.opArg = `${it.id}|${lib.id}`;
    r.opLabel = `移到「${lib.name}」`;
    return r;
  }
  if (m.id === 'renamelib') {
    const lib = findLibByName(m.a);
    const name = m.b.trim();
    if (lib === null) {
      return new CmdReply(`没找到叫「${m.a}」的库。`, 'cmd:renamelib', note);
    }
    if (name === '') {
      return new CmdReply('要改成什么名字？可以说「把药盒改名叫急救箱」。', 'cmd:renamelib', note);
    }
    const r = new CmdReply(`要把「${lib.name}」改名成「${name}」？`, 'cmd:renamelib', note);
    r.opKind = 'renamelib';
    r.opArg = `${lib.id}|${name}`;
    r.opLabel = `改名成「${name}」`;
    return r;
  }
  return new CmdReply('这条我还没学会。点右上角问号，看看能说什么。', 'cmd:unknown', note);
}

/** 确认卡落地：策略校验和幂等守卫通过后，才执行写操作。 */
export function applyCmdOp(kind: string, arg: string, executionKey: string = ''): Promise<string> {
  const action = policyForCommand(kind, arg);
  const decision: PolicyDecision = checkPolicy(action, store.userRole, true);
  if (!decision.allowed) {
    return Promise.resolve(decision.reason);
  }
  const key: string = executionKey === '' ? `${kind}:${arg}:${Date.now()}` : executionKey;
  if (!claimActionOnce(key)) {
    return Promise.resolve('这个动作已经处理过，不会重复执行。');
  }
  if (kind === 'qty') {
    const parts = arg.split('|');
    if (parts.length < 2) {
      return Promise.resolve('这条数量指令我读错了，换个说法再试一次。');
    }
    const hit = store.findItemHit(parts[0]);
    if (hit === null) {
      return Promise.resolve('这件物品已经不在了。');
    }
    const n = Number(parts[1]);
    return setItemQtyByName(hit[1].name, n).then((): string =>
      `已把「${hit[1].name}」调整为 ${n}${hit[1].unit}。`);
  }
  if (kind === 'dose') {
    const parts = arg.split('|');
    if (parts.length < 2) {
      return Promise.resolve('这条每日用量指令我读错了，换个说法再试一次。');
    }
    const hit = store.findItemHit(parts[0]);
    if (hit === null) {
      return Promise.resolve('这件药品已经不在了。');
    }
    const n = Number(parts[1]);
    return setMedicineDoseByName(hit[1].name, n).then((): string =>
      `已把「${hit[1].name}」每日用量设为 ${n}${hit[1].unit}。`);
  }
  if (kind === 'shopadd') {
    const parts = arg.split('|');
    const name = parts.length > 0 ? parts[0] : '';
    const qty = parts.length > 1 ? parts[1] : '1 份';
    return addShoppingByAI(name, qty).then((): string => `已把「${name}」加入采购清单。`);
  }
  if (kind === 'additem') {
    let payload = new AddItemPayload();
    try {
      payload = JSON.parse(arg) as AddItemPayload;
    } catch (_e) {
      return Promise.resolve('这条入库指令我读错了，换个说法再试一次。');
    }
    const lib = store.findLib(payload.libId);
    if (lib === null) {
      return Promise.resolve('目标库已经不在了，请重新选择。');
    }
    const form = new ItemForm();
    form.name = payload.name;
    form.qty = String(payload.qty);
    form.unit = payload.unit;
    form.pos = '未设置';
    form.priceSrc = '手动';
    return addItem(lib.id, form).then((): string =>
      `已把「${payload.name}」${payload.qty}${payload.unit}加入「${lib.name}」。`);
  }
  if (kind === 'newlib') {
    return createLibrary(arg, 'package', 'teal').then((lib: Library): string => {
      store.tabIndex = 1;
      store.overlay = '';
      return `已新建资源库「${lib.name}」。`;
    });
  }
  if (kind === 'plangen') {
    return generatePlans().then((plans: Plan[]): string => {
      const titles: string[] = [];
      plans.forEach((p: Plan) => titles.push(p.title));
      return `已生成 ${plans.length} 个方案：${titles.join('、')}。`;
    });
  }
  if (kind === 'planrun') {
    const id = Number(arg);
    const target = store.plans.find((p: Plan): boolean => p.id === id);
    if (target === undefined) {
      return Promise.resolve('方案已经不在了。');
    }
    const names: string[] = [];
    target.used.forEach((u: Consume) => names.push(u.name));
    return executePlan(target.id, names).then((): string =>
      `已执行「${target.title}」，按用料扣减 ${names.length} 项库存。`);
  }
  if (kind === 'alertdone') {
    const id = Number(arg);
    return resolveAlert(id).then((): string => '已把这条预警标记为处理。');
  }
  if (kind === 'coopcreate') {
    return createCoop().then((code: string): string => {
      store.tabIndex = 2;
      store.overlay = '';
      return `协作池已创建，邀请码 ${code}（24 小时内有效）。`;
    });
  }
  if (kind === 'coopjoin') {
    return joinCoop(arg).then((n: number): string => {
      store.tabIndex = 2;
      store.overlay = '';
      return `已加入协作池，当前 ${n} 位成员。`;
    }).catch((): string => `邀请码「${arg}」无效或已过期。`);
  }
  if (kind === 'dellib') {
    return deleteLibrary(arg).then((d): string => {
      store.lastDeletedLib.lib = d.lib;
      store.lastDeletedLib.index = d.index;
      store.toast(`已删掉库「${d.lib.name}」`, '撤销', 'lib:restore');
      return `已删掉库「${d.lib.name}」（${d.lib.items.length} 件物品一起移除）。提示里点「撤销」可以恢复。`;
    });
  }
  if (kind === 'delitem') {
    const lib = store.findItem(arg);
    if (lib === null) {
      return Promise.resolve('这件物品已经不在了。');
    }
    return deleteItem(lib.id, arg).then((d): string => {
      store.lastDeletedItem.lib = d.lib;
      store.lastDeletedItem.item = d.item;
      store.lastDeletedItem.index = d.index;
      store.toast(`已删掉「${d.item.name}」`, '撤销', 'item:restore');
      return `已删掉「${d.item.name}」。提示里点「撤销」可以放回去。`;
    });
  }
  if (kind === 'moveitem') {
    const parts = arg.split('|');
    if (parts.length < 2) {
      return Promise.resolve('这条指令我读错了，换个说法再试一次。');
    }
    return moveItemToLib(parts[0], parts[1]);
  }
  if (kind === 'renamelib') {
    const parts = arg.split('|');
    if (parts.length < 2) {
      return Promise.resolve('这条指令我读错了，换个说法再试一次。');
    }
    return renameLibrary(parts[0], parts[1]).then((): string => `已改名成「${parts[1]}」。`);
  }
  return Promise.resolve('这条指令我读错了，换个说法再试一次。');
}

/** 手册自检：手册里的句子必须都能被接住 —— 指令层命中，或走意图快答（问数量/位置/保质期那几条） */
export function cmdSelfCheck(): string {
  const miss: string[] = [];
  CMD_HELP.forEach((c: CmdSpec) => {
    if (matchCommand(c.example) === null && routeIntent(c.example) === 'other') {
      miss.push(c.example);
    }
  });
  const ok = CMD_HELP.length - miss.length;
  return miss.length === 0 ? `手册自检 ${ok}/${CMD_HELP.length} 可命中`
    : `手册自检 ${ok}/${CMD_HELP.length} 可命中，未命中：${miss.join('；')}`;
}

/** 启动时打一条日志（hilog），便于用 hdc 复看自检结果 */
export function cmdSelfCheckLog(): void {
  hilog.info(DOMAIN, TAG, 'cmd selfcheck: %{public}s', cmdSelfCheck());
}
