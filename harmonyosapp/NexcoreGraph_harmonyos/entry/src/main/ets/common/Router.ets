/* 启核图策 · AI 意图路由与检索式上下文（M2.5 P0-1，F2.4/F5.1/F5.2）
   指南原则：低成本路径高置信快答（0 次模型）；开放问题保守放行给模型，
   且模型只能看到按意图装配的证据（≤30 条、带来源），数值永远由本地查询产出。 */

import { store, nowTime, LogRow } from './Store';
import { Item, Library, Plan } from './Db';
import { lookup, rulesFor, evidenceLine, FoodRow, RuleRow } from './KnowledgeIndex';

/** AI 一次回复的结构化结果（含工具行解析结果与来源标注） */
export class AIReply {
  text: string = '';
  adjName: string = '';
  adjQty: number = -1;
  shopName: string = '';
  shopQty: string = '';
  route: string = '';
  srcNote: string = '';
  srcUrl: string = '';        // 知识库来源链接（M-8）：点击可复制/查看
  /* 创新菜谱 [菜] 行解析结果（P0-3），客户端回查库存后落 Plan */
  dishTitle: string = '';
  dishTime: string = '';
  dishNote: string = '';
  dishIngredients: string[] = [];
  /* 自然语言指令的待确认写操作（删库/删物品/移动/改名）：由对话里的确认按钮落地 */
  opKind: string = '';
  opArg: string = '';
  opLabel: string = '';
}

export type Intent = 'greet' | 'where' | 'qty' | 'expiry' | 'cook' | 'creative'
  | 'adjust' | 'shopping' | 'nutrition' | 'summary' | 'other';

const GREET_WORDS: string[] = ['你好', '您好', '嗨', '哈喽', 'hello', 'hi', '谢谢', '感谢', '在吗', '早上好', '晚上好'];
const WHERE_WORDS: string[] = ['放哪', '在哪', '哪里', '位置', '放在'];
const QTY_WORDS: string[] = ['还剩', '剩多少', '有多少', '还有几个', '还有多少', '几个', '多少'];
const EXPIRY_WORDS: string[] = ['放几天', '能放多久', '还能放', '过几天', '到期', '过期', '还能吃', '新鲜', '坏没'];
const COOK_WORDS: string[] = ['做什么菜', '吃什么', '做点啥', '能做什么', '菜谱', '做什么饭', '晚餐', '午饭', '做什么'];
const CREATIVE_WORDS: string[] = ['创新', '新花样', '创意', '特别点的', '换着花样', '独门'];
const ADJUST_WORDS: string[] = ['剩', '用了', '吃完了', '喝完了', '只剩', '还剩', '买了几', '吃光了'];
const SHOP_WORDS: string[] = ['购物清单', '采购清单', '加购物', '加采购', '要买了', '买什么', '补货'];
const NUTRI_WORDS: string[] = ['营养', '热量', '卡路里', '减脂', '增肌', '控糖', '减肥', '健康餐', '多少卡'];

export function routeIntent(q: string): Intent {
  const s = q.trim().toLowerCase();
  if (s === '') {
    return 'other';
  }
  if (GREET_WORDS.some((w: string): boolean => s === w || (s.length <= 6 && s.includes(w)))) {
    return 'greet';
  }
  if (CREATIVE_WORDS.some((w: string): boolean => s.includes(w))) {
    return 'creative';
  }
  if (NUTRI_WORDS.some((w: string): boolean => s.includes(w))) {
    return 'nutrition';
  }
  if (SHOP_WORDS.some((w: string): boolean => s.includes(w))) {
    return 'shopping';
  }
  if (EXPIRY_WORDS.some((w: string): boolean => s.includes(w))) {
    return 'expiry';
  }
  if (WHERE_WORDS.some((w: string): boolean => s.includes(w))) {
    return 'where';
  }
  if (QTY_WORDS.some((w: string): boolean => s.includes(w))) {
    return 'qty';
  }
  if (COOK_WORDS.some((w: string): boolean => s.includes(w))) {
    return 'cook';
  }
  // 修改库存："鸡蛋剩 5 个""用了 3 个"——需同时出现数量才判 adjust
  if (ADJUST_WORDS.some((w: string): boolean => s.includes(w)) && /\d/.test(s)) {
    return 'adjust';
  }
  return 'other';
}

/* ---------- 名称提及识别（含"鲜牛奶"→"牛奶"去前缀别名） ---------- */
function aliasesOf(name: string): string[] {
  const out: string[] = [name];
  if (name.length >= 3 && (name.startsWith('鲜') || name.startsWith('生') || name.startsWith('土'))) {
    out.push(name.substring(1));
  }
  return out;
}

/** 返回问题中提到的第一个物品（0 次模型调用用的定位） */
export function findMentionedItem(q: string): Item | null {
  for (let i = 0; i < store.libraries.length; i++) {
    const lib = store.libraries[i];
    for (let j = 0; j < lib.items.length; j++) {
      const it = lib.items[j];
      const als = aliasesOf(it.name);
      for (let k = 0; k < als.length; k++) {
        if (q.includes(als[k])) {
          return it;
        }
      }
    }
  }
  return null;
}

function libOfItem(it: Item): Library | null {
  for (let i = 0; i < store.libraries.length; i++) {
    if (store.libraries[i].items.indexOf(it) > -1) {
      return store.libraries[i];
    }
  }
  return null;
}

/* ---------- 证据行（带来源，模型只可见这些） ---------- */
function itemLine(lib: Library, it: Item): string {
  // expDays = 0 表示这类物品没有保质期（衣物/工具/厨具等），证据里如实写，不让模型看到"0 天后到期"
  const exp = it.expDays > 0 ? `约${it.expDays}天后到期` : '无保质期';
  return `${lib.name}·${it.pos}｜${it.name} ${it.qty}${it.unit}｜${exp}｜¥${it.price}（${it.priceSrc}）`;
}

function inventoryLines(limit: number, expiringFirst: boolean): string[] {
  const all: string[] = [];
  const exp: string[] = [];
  store.libraries.forEach((lib: Library) => {
    lib.items.forEach((it: Item) => {
      const line = itemLine(lib, it);
      if (expiringFirst && it.expDays > 0 && it.expDays <= 7) {
        exp.push(line);
      } else {
        all.push(line);
      }
    });
  });
  const merged = exp.concat(all);
  return merged.slice(0, limit);
}

function profileBlock(): string {
  const p = store.profile;
  if (!p.inject) {
    return '';
  }
  let s = `\n家庭偏好（用户填写，必须遵守）：${p.people} 人用餐；饮食目标 ${p.goal}`;
  if (p.dislike !== '') {
    s += `；忌口/过敏：${p.dislike}（方案不得包含）`;
  }
  return s;
}

/* 知识库证据（M-8）：命中行带 src/url，模型回答据此标注来源 */
function kbBlock(names: string[]): string {
  const lines: string[] = [];
  names.forEach((n: string) => {
    const hit = lookup(n);
    if (hit !== null) {
      lines.push(evidenceLine(hit));
    }
  });
  return lines.length > 0 ? '\n知识库参考（回答如引用须保留来源）：\n' + lines.join('\n') : '';
}

/** 知识库条目 → 天数/开封/建议文案（数值来自知识库，不由模型编造） */
function kbAdvice(row: FoodRow): string {
  let s = '';
  if (row.fridgeDays > 0) {
    s += `冷藏约 ${row.fridgeDays} 天`;
  } else if (row.pantryDays > 0) {
    s += `常温约 ${row.pantryDays} 天`;
  } else if (row.freezerDays > 0) {
    s += `冷冻约 ${row.freezerDays} 天`;
  }
  if (row.openedDays > 0) {
    s += s === '' ? `开封后 ${row.openedDays} 天内用完` : `，开封后 ${row.openedDays} 天内用完`;
  }
  if (row.tip !== '') {
    s += s === '' ? row.tip : `。${row.tip}`;
  }
  return s;
}

/** 按意图装配证据块；greet/where/qty/expiry 不需要（走快答） */
export function evidenceFor(intent: Intent, q: string): string {
  if (intent === 'cook') {
    return '当前库存（第一行为临期，优先消耗）：\n' + inventoryLines(30, true).join('\n')
      + kbBlock(['鸡蛋', '牛奶']) + profileBlock();
  }
  if (intent === 'creative') {
    return '当前库存（重点用临期食材做新花样）：\n' + inventoryLines(30, true).join('\n') + profileBlock();
  }
  if (intent === 'nutrition') {
    return '当前库存：\n' + inventoryLines(30, false).join('\n')
      + '\n热量规则：每份热量标"约"，主菜 200-550 千卡、汤类 90-180 千卡。'
      + profileBlock();
  }
  if (intent === 'summary') {
    return '近 7 天统计（代码计算，直接引用数字）：\n' + statsEvidence() ;
  }
  if (intent === 'adjust' || intent === 'shopping' || intent === 'other') {
    return '当前库存摘要：\n' + inventoryLines(20, false).join('\n');
  }
  return '';
}

/* ---------- 快答（0 次模型调用） ---------- */
export function directAnswer(intent: Intent, q: string): AIReply | null {
  if (intent === 'greet') {
    const r = new AIReply();
    r.route = 'greet';
    r.srcNote = '本地快答 · 0 次模型调用';
    const h = new Date().getHours();
    r.text = h < 11 ? '早上好！今天先看看临期提醒吧。' : (h < 14 ? '中午好！需要我安排午餐吗？' : '你好！我在，随时问库存、菜谱或让我记数量。');
    return r;
  }
  if (intent === 'where' || intent === 'qty' || intent === 'expiry') {
    const it = findMentionedItem(q);
    const r = new AIReply();
    r.route = intent;
    const hit = intent === 'expiry' ? lookup(q) : null;
    if (it === null) {
      // 库存没有、但知识库有该食材：直接给保质期与存放建议并标注来源（M-8 / X8）
      if (hit !== null) {
        r.text = `${hit.row.name}：${kbAdvice(hit.row)}。`;
        r.srcNote = `知识库 · ${hit.row.src}`;
        r.srcUrl = hit.row.url;
        return r;
      }
      r.text = intent === 'where'
        ? '库存里没有找到这件物品。可以在资源库手动添加，或拍照入库。'
        : '库存里没找到这件物品，先拍照或手动入库后我就能帮你盯数量了。';
      r.srcNote = '本地快答 · 库存实查';
      return r;
    }
    const lib = libOfItem(it);
    const where = `${lib === null ? '' : lib.name} · ${it.pos}`;
    if (intent === 'where') {
      r.text = `「${it.name}」在 ${where}，还有 ${it.qty}${it.unit}。`;
      r.srcNote = `证据：${where}｜${it.name} ${it.qty}${it.unit}`;
    } else if (intent === 'qty') {
      r.text = `「${it.name}」还剩 ${it.qty}${it.unit}（${where}）。`;
      r.srcNote = `证据：${where}｜${it.name} ${it.qty}${it.unit}`;
    } else if (it.expDays > 0) {
      r.text = `「${it.name}」约 ${it.expDays} 天后到期（${where}）。`;
      if (it.expDays <= 3) {
        r.text += '建议这两天优先用掉，我可以排进今日方案。';
      }
      if (hit !== null) {
        r.text += `知识库（${hit.row.name}）：${kbAdvice(hit.row)}。`;
        r.srcNote = `证据：库存实查 + 知识库（${hit.row.src}）`;
        r.srcUrl = hit.row.url;
      } else {
        r.srcNote = '证据：库存实查';
        const rules: RuleRow[] = rulesFor(q, 1);
        if (rules.length > 0) {
          r.text += `通用规则：${rules[0].text}`;
          r.srcUrl = rules[0].url;
        }
      }
    } else {
      // 衣物、工具、厨具这类库本来就没有保质期：如实说明，不拿 0 天糊弄
      r.text = `「${it.name}」这类物品没有保质期，当前 ${it.qty}${it.unit}，放在 ${where}。`;
      r.srcNote = `证据：${where}｜${it.name} ${it.qty}${it.unit}`;
    }
    return r;
  }
  return null;
}

/** 看板/对话简报用的统计证据（数字全部代码计算，F7.7/P0-6） */
export function statsEvidence(): string {
  const now = nowTime();
  const dayKeys: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    dayKeys.push(`${d.getFullYear()}-${mo}-${da}`);
  }
  let consume = 0;
  let intake = 0;
  store.logs.forEach((l: LogRow) => {
    if (dayKeys.indexOf(l.day) > -1) {
      if (l.action === 'plan' || l.action === 'workbench') {
        consume += 1;
      } else if (l.action === 'intake') {
        intake += 1;
      }
    }
  });
  let expiring = 0;
  const lowNames: string[] = [];
  const expNames: string[] = [];
  store.libraries.forEach((lib: Library) => {
    lib.items.forEach((it: Item) => {
      if (it.expDays > 0 && it.expDays <= 7) {
        expiring += 1;
        expNames.push(`${it.name}（${it.expDays}天）`);
      }
    });
  });
  const eggHit = store.findItemHit('鸡蛋');
  if (eggHit !== null && eggHit[1].qty < 5) {
    lowNames.push(`鸡蛋（${eggHit[1].qty}${eggHit[1].unit}）`);
  }
  let s = `近 7 天：消耗动作 ${consume} 次，入库 ${intake} 次；`;
  s += `当前临期 ${expiring} 项${expNames.length > 0 ? '：' + expNames.slice(0, 5).join('、') : ''}；`;
  s += `低库存：${lowNames.length > 0 ? lowNames.join('、') : '无'}。`;
  const done = store.plans.filter((p: Plan): boolean => p.status === 'done').length;
  s += `方案执行 ${done}/${store.plans.length}。`;
  return s;
}
