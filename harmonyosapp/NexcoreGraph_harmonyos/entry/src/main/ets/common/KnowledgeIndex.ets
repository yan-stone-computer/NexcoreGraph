/* 启核图策 · 知识库检索索引（整改文档 M-8 知识库 RAG 与来源引用）
   数据源：resources/rawfile/knowledge/{foods,storage-rules}.json（与仓库 knowledge/ 同源）。
   检索：① 名称/别名精确命中；② 2-gram 倒排索引打分兜底；命中行携带 src/url 供回答标注来源。
   降级：rawfile 读取或解析失败时回退 Db.ets 的内嵌子集，保证离线可用。
   红线：天数等数值仍由代码产出（库存实数 + 知识库默认值），模型只做措辞。 */

import { common } from '@kit.AbilityKit';
import { util } from '@kit.ArkTS';
import { KNOWLEDGE } from './Db';

/** 知识库条目（已归一化，数值字段不保留可空） */
export class FoodRow {
  key: string = '';
  name: string = '';
  emoji: string = '';
  category: string = '';
  unit: string = '个';
  fridgeDays: number = -1;     // -1 表示该场景不适用
  pantryDays: number = -1;
  freezerDays: number = -1;
  openedDays: number = -1;
  tip: string = '';
  lowAt: number = 0;
  src: string = '';
  url: string = '';
}

/** 存放/安全通用规则 */
export class RuleRow {
  id: string = '';
  text: string = '';
  src: string = '';
  url: string = '';
}

/** 一次检索命中 */
export class KbHit {
  row: FoodRow = new FoodRow();
  score: number = 0;
  exact: boolean = false;
}

/* ---------- rawfile JSON 的宽松结构（字段可能为 null，故用 Object 承接） ---------- */
class RawShelf {
  pantry: Object | null = null;
  fridge: Object | null = null;
  freezer: Object | null = null;
}

class RawFood {
  key: string = '';
  name: string = '';
  emoji: string = '';
  category: string = '';
  unit: string = '';
  shelf: RawShelf = new RawShelf();
  openedDays: Object | null = null;
  tip: string = '';
  lowAt: Object | null = 0;
  src: string = '';
  url: string = '';
}

class FoodsFile {
  version: string = '';
  items: RawFood[] = [];
}

class RawRule {
  id: string = '';
  text: string = '';
  src: string = '';
  url: string = '';
}

class RulesFile {
  version: string = '';
  rules: RawRule[] = [];
}

/* ---------- 模块状态 ---------- */
let foods: FoodRow[] = [];
let rules: RuleRow[] = [];
let loaded: boolean = false;
let fromRawfile: boolean = false;
/** 2-gram 倒排索引：bigram → 命中的条目下标（空格分隔，避免 Set 序列化问题） */
let gramIndex: Map<string, number[]> = new Map<string, number[]>();
const GRAM_NUM: number = 2;

function numOr(v: Object | null, def: number): number {
  if (v === null || v === undefined) {
    return def;
  }
  const n = Number(v);
  return isNaN(n) ? def : n;
}

function strOr(v: string, def: string): string {
  return v === undefined || v === null || v === '' ? def : v;
}

/** 名称归一化：去括号补充说明、去常见前缀（鲜/生/土）、去空白 */
function normalizeName(name: string): string {
  let s = name;
  const p = s.indexOf('（');
  if (p > 0) {
    s = s.substring(0, p);
  }
  const q = s.indexOf('(');
  if (q > 0) {
    s = s.substring(0, q);
  }
  s = s.trim();
  if (s.length >= 3 && (s.startsWith('鲜') || s.startsWith('生') || s.startsWith('土'))) {
    s = s.substring(1);
  }
  return s;
}

function bigrams(s: string): string[] {
  const out: string[] = [];
  const t = s.replace(/\s/g, '');
  if (t.length <= GRAM_NUM) {
    if (t.length > 0) {
      out.push(t);
    }
    return out;
  }
  for (let i = 0; i + GRAM_NUM <= t.length; i++) {
    out.push(t.substring(i, i + GRAM_NUM));
  }
  return out;
}

function addToIndex(idx: number): void {
  const row = foods[idx];
  const grams = bigrams(row.name + ' ' + row.tip + ' ' + row.category);
  grams.forEach((g: string) => {
    const cur = gramIndex.get(g);
    if (cur === undefined) {
      gramIndex.set(g, [idx]);
    } else if (cur.indexOf(idx) < 0) {
      cur.push(idx);
    }
  });
}

/* ---------- 载入 ---------- */

function readRaw(ctx: common.UIAbilityContext, path: string): string {
  const bytes: Uint8Array = ctx.resourceManager.getRawFileContentSync(path);
  const decoder = util.TextDecoder.create('utf-8');
  return decoder.decodeToString(bytes);
}

function loadFromRawfile(ctx: common.UIAbilityContext): boolean {
  try {
    const foodsFile = JSON.parse(readRaw(ctx, 'knowledge/foods.json')) as FoodsFile;
    const rows: FoodRow[] = [];
    foodsFile.items.forEach((r: RawFood) => {
      const f = new FoodRow();
      f.key = r.key;
      f.name = r.name;
      f.emoji = r.emoji === undefined ? '' : r.emoji;
      f.category = r.category === undefined ? '' : r.category;
      f.unit = strOr(r.unit, '个');
      f.fridgeDays = numOr(r.shelf === undefined ? null : r.shelf.fridge, -1);
      f.pantryDays = numOr(r.shelf === undefined ? null : r.shelf.pantry, -1);
      f.freezerDays = numOr(r.shelf === undefined ? null : r.shelf.freezer, -1);
      f.openedDays = numOr(r.openedDays, -1);
      f.tip = r.tip === undefined ? '' : r.tip;
      f.lowAt = numOr(r.lowAt, 0);
      f.src = r.src === undefined ? '' : r.src;
      f.url = r.url === undefined ? '' : r.url;
      rows.push(f);
    });
    if (rows.length === 0) {
      return false;
    }
    foods = rows;
    const rulesFile = JSON.parse(readRaw(ctx, 'knowledge/storage-rules.json')) as RulesFile;
    const rl: RuleRow[] = [];
    rulesFile.rules.forEach((r: RawRule) => {
      const o = new RuleRow();
      o.id = r.id;
      o.text = r.text;
      o.src = r.src === undefined ? '' : r.src;
      o.url = r.url === undefined ? '' : r.url;
      rl.push(o);
    });
    rules = rl;
    return true;
  } catch (_e) {
    return false;
  }
}

/** 降级：用 Db.ets 内嵌子集构造最小索引 */
function loadFromDbFallback(): void {
  const keys = Object.keys(KNOWLEDGE);
  const rows: FoodRow[] = [];
  keys.forEach((k: string) => {
    const e = KNOWLEDGE[k];
    const f = new FoodRow();
    f.key = k;
    f.name = e.name;
    f.fridgeDays = e.days;
    f.tip = e.tip;
    f.src = e.src;
    f.url = e.url;
    rows.push(f);
  });
  foods = rows;
  rules = [];
}

function buildIndex(): void {
  gramIndex = new Map<string, number[]>();
  for (let i = 0; i < foods.length; i++) {
    addToIndex(i);
  }
}

/** 启动时调用一次（EntryAbility.onCreate / onWindowStageCreate） */
export function initKnowledge(ctx: common.UIAbilityContext): void {
  if (loaded) {
    return;
  }
  fromRawfile = loadFromRawfile(ctx);
  if (!fromRawfile) {
    loadFromDbFallback();
  }
  buildIndex();
  loaded = true;
}

export function knowledgeReady(): boolean {
  return loaded;
}

/** 索引来源提示：用于设置页/关于页展示"离线知识库可用性" */
export function knowledgeSource(): string {
  if (!loaded) {
    return '未初始化';
  }
  return fromRawfile ? `rawfile 知识库（${foods.length} 项食材 · ${rules.length} 条规则）`
    : `内嵌子集（${foods.length} 项）`;
}

export function foodCount(): number {
  return foods.length;
}

/** 全部概念条目（图谱构图用：FoodConcept 节点） */
export function allFoods(): FoodRow[] {
  return foods;
}

/** 按知识库 key 取概念（物品 kbKey 优先连接） */
export function foodByKey(key: string): FoodRow | null {
  for (let i = 0; i < foods.length; i++) {
    if (foods[i].key === key) {
      return foods[i];
    }
  }
  return null;
}

/** 归一名称（图谱实例↔概念归并使用，与后端 normName 同口径） */
export function normName(name: string): string {
  return normalizeName(name);
}

/* ---------- 检索 ---------- */

/** 精确/别名命中：查询串包含条目名或条目名包含查询串（如"牛奶"→"鲜牛奶"） */
function exactHit(q: string): KbHit | null {
  const query = normalizeName(q);
  if (query === '') {
    return null;
  }
  let best: KbHit | null = null;
  for (let i = 0; i < foods.length; i++) {
    const base = normalizeName(foods[i].name);
    if (base === '') {
      continue;
    }
    let score = 0;
    if (q.includes(foods[i].name) || query === base) {
      score = 3;
    } else if (query.includes(base) || base.includes(query)) {
      score = 2;
    }
    if (score > 0 && (best === null || score > best.score || base.length > normalizeName(best.row.name).length)) {
      const hit = new KbHit();
      hit.row = foods[i];
      hit.score = score;
      hit.exact = true;
      best = hit;
    }
  }
  return best;
}

/** 2-gram 倒排打分（精确未命中时兜底） */
function gramHits(q: string, limit: number): KbHit[] {
  const grams = bigrams(q);
  if (grams.length === 0) {
    return [];
  }
  const scoreMap = new Map<number, number>();
  grams.forEach((g: string) => {
    const list = gramIndex.get(g);
    if (list === undefined) {
      return;
    }
    list.forEach((idx: number) => {
      const cur = scoreMap.get(idx);
      scoreMap.set(idx, (cur === undefined ? 0 : cur) + 1);
    });
  });
  const hits: KbHit[] = [];
  scoreMap.forEach((v: number, idx: number) => {
    const hit = new KbHit();
    hit.row = foods[idx];
    hit.score = v / grams.length;
    hit.exact = false;
    hits.push(hit);
  });
  hits.sort((a: KbHit, b: KbHit): number => b.score - a.score);
  return hits.slice(0, limit);
}

/** 主入口：先精确后 2-gram；返回 null 表示知识库无对应条目 */
export function lookup(q: string): KbHit | null {
  if (!loaded) {
    return null;
  }
  const e = exactHit(q);
  if (e !== null) {
    return e;
  }
  const g = gramHits(q, 1);
  if (g.length > 0 && g[0].score >= 0.5) {
    return g[0];
  }
  return null;
}

export function search(q: string, limit: number): KbHit[] {
  if (!loaded) {
    return [];
  }
  const e = exactHit(q);
  if (e !== null) {
    return [e];
  }
  return gramHits(q, limit);
}

/** 与"存放/变质"相关的通用规则（按关键词粗筛，作为对话证据） */
export function rulesFor(q: string, limit: number): RuleRow[] {
  if (!loaded || rules.length === 0) {
    return [];
  }
  const out: RuleRow[] = [];
  for (let i = 0; i < rules.length && out.length < limit; i++) {
    const t = rules[i].text;
    const grams = bigrams(q);
    for (let j = 0; j < grams.length; j++) {
      if (t.includes(grams[j])) {
        out.push(rules[i]);
        break;
      }
    }
  }
  return out;
}

/** 给模型看的证据行（带来源，M-8 要求模型回答可标注出处） */
export function evidenceLine(hit: KbHit): string {
  const r = hit.row;
  let days = '';
  if (r.fridgeDays > 0) {
    days = `冷藏约 ${r.fridgeDays} 天`;
  } else if (r.pantryDays > 0) {
    days = `常温约 ${r.pantryDays} 天`;
  } else if (r.freezerDays > 0) {
    days = `冷冻约 ${r.freezerDays} 天`;
  }
  let line = `${r.name}：${days}`;
  if (r.openedDays > 0) {
    line += `，开封后 ${r.openedDays} 天内用完`;
  }
  if (r.tip !== '') {
    line += `；${r.tip}`;
  }
  return line + `（来源：${r.src}）`;
}
