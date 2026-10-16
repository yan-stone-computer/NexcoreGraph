/* 启核图策 · 本地持久化（M2.5 P0-5 对话落盘 F5.4/F9.11 + P0-4 偏好档案 + AI 用量）
   仅本地，不上云：sync payload 不含本模块任何数据。Preferences 同步 API + JSON 序列化。 */

import { preferences } from '@kit.ArkData';
import { common } from '@kit.AbilityKit';
import { store, AiUsageRow, nowTime, ValueLedger, stampLabel } from './Store';
import { ChatMsg, Profile, Item, Library, Family } from './Db';
import { T } from './Tokens';
import { buildDataSnapshot, applyDataSnapshot } from './Continuation';
import { setManualBase } from './Backend';

const MAX_CHAT: number = 200;   // 滚动裁剪上限（验收 I5/K11）

let prefs: preferences.Preferences | null = null;

export function initLocal(ctx: common.UIAbilityContext): void {
  try {
    prefs = preferences.getPreferencesSync(ctx, { name: 'nexcore_local' });
    loadAll();
  } catch (_e) {
    prefs = null;   // 存储不可用时静默降级为纯内存（不阻塞启动）
  }
}

function loadAll(): void {
  if (prefs === null) {
    return;
  }
  // 局域网自建服务器地址（我的 → 服务器连接 里填的），优先于内置候选链
  const srv = prefs.getSync('serverUrl', '') as string;
  if (srv !== '') {
    setManualBase(srv);
  }
  // 用户数据（库/物品/方案/清单/待办/工作台/对话/日志）：本机上次的样子，离线也能打开
  const dataJson = prefs.getSync('userData', '') as string;
  if (dataJson !== '') {
    applyDataSnapshot(dataJson);
  }
  // 对话
  const chatJson = prefs.getSync('chat', '[]') as string;
  const restored = parseChat(chatJson);
  if (restored.length > 0) {
    store.chat = restored;
  }
  // 偏好
  const pJson = prefs.getSync('profile', '') as string;
  if (pJson !== '') {
    try {
      const p = JSON.parse(pJson) as Profile;
      store.profile.people = p.people ?? 4;
      store.profile.dislike = p.dislike ?? '';
      store.profile.goal = p.goal ?? '均衡';
      store.profile.inject = p.inject ?? true;
    } catch (_e) {
      // 坏数据忽略，用默认
    }
  }
  // AI 用量
  const uJson = prefs.getSync('aiUsage', '[]') as string;
  try {
    const rows = JSON.parse(uJson) as AiUsageRow[];
    store.aiUsage = rows.map((r: AiUsageRow): AiUsageRow => new AiUsageRow(r.route, r.model, r.ms, r.at));
  } catch (_e) {
    store.aiUsage = [];
  }
  // 落地价值账本（M-11）
  const vJson = prefs.getSync('valueLedger', '') as string;
  if (vJson !== '') {
    try {
      const v = JSON.parse(vJson) as ValueLedger;
      store.ledger.expiringIds = v.expiringIds ?? [];
      store.ledger.expiringTotal = v.expiringTotal ?? 0;
      store.ledger.expiringConsumed = v.expiringConsumed ?? 0;
      store.ledger.blockedRepurchase = v.blockedRepurchase ?? 0;
      store.ledger.intakeMs = v.intakeMs ?? [];
    } catch (_e) {
      // 坏数据忽略，保留默认
    }
  }
  // 主题偏好（色板 + 明暗）：默认"启核绿青蓝 · 深色"
  const themeJson = prefs.getSync('theme', '') as string;
  if (themeJson !== '') {
    try {
      const t = JSON.parse(themeJson) as Record<string, Object>;
      T.setPalette(String(t['palette'] ?? 'nexcore'));
      // 应用默认是亮色（T.dark 初值 false），这里缺字段时也要跟默认保持一致，
      // 否则老版本存在 theme 但没写 dark 字段时会莫名其妙变深色
      T.setDark(Boolean(t['dark'] ?? false));
    } catch (_e) {
      // 坏数据忽略，保留品牌默认
    }
  }
}

/** 主题偏好落盘（色板 + 明暗）；切换后立即生效并记住 */
export function saveThemePrefs(): void {
  if (prefs === null) {
    return;
  }
  const r: Record<string, Object> = { 'palette': T.palette, 'dark': T.dark };
  prefs.putSync('theme', JSON.stringify(r));
  prefsFlush();
}

/** 局域网服务器地址落盘（换 WiFi/换电脑后在这里改，不用重新打包） */
export function saveServerUrl(url: string): void {
  if (prefs === null) {
    return;
  }
  prefs.putSync('serverUrl', url);
  prefsFlush();
}

/** 落地价值指标落盘（M-11；与聊天/偏好同为仅本地） */
export function saveLedger(): void {
  if (prefs === null) {
    return;
  }
  const v = store.ledger;
  const r: Record<string, Object> = {
    'expiringIds': v.expiringIds,
    'expiringTotal': v.expiringTotal,
    'expiringConsumed': v.expiringConsumed,
    'blockedRepurchase': v.blockedRepurchase,
    'intakeMs': v.intakeMs
  };
  prefs.putSync('valueLedger', JSON.stringify(r));
  prefsFlush();
}

/** 服务卡片数据快照（M-5）：卡片进程读不到内存 store，故由端侧把快照写到 Preferences；
    杀进程 / 断网 / 卡片单独刷新时都能显示真实数据（不再退回种子数据）。 */
export function saveFormSnapshot(): void {
  if (prefs === null) {
    return;
  }
  let total = 0;
  let expiring = 0;
  const exp: Item[] = [];
  const libNames: string[] = [];
  store.libraries.forEach((lib: Library) => {
    libNames.push(lib.name);
    total += lib.items.length;
    lib.items.forEach((it: Item) => {
      if (it.expDays > 0 && it.expDays <= 7) {
        expiring += 1;
        exp.push(it);
      }
    });
  });
  exp.sort((a: Item, b: Item): number => a.expDays - b.expDays);
  const r: Record<string, Object> = {
    'total': total,
    'libs': store.libraries.length,
    'expiring': expiring,
    'exp1': exp.length > 0 ? `${exp[0].name} · ${exp[0].expDays} 天后到期` : '',
    'exp2': exp.length > 1 ? `${exp[1].name} · ${exp[1].expDays} 天后到期` : '',
    'libNames': libNames,
    'updatedAt': nowTime()
  };
  prefs.putSync('formSnapshot', JSON.stringify(r));
  prefsFlush();
}

/* ---------- 知识图谱（补充方案第 5.1 节；仅本地，可确定性重建，不上云） ---------- */

/** 读取本地图谱 JSON（无则返回空串，由 GraphBuild 重建） */
export function loadGraphJson(): string {
  if (prefs === null) {
    return '';
  }
  try {
    return prefs.getSync('graphDoc', '') as string;
  } catch (_e) {
    return '';
  }
}

export function saveGraphJson(json: string): void {
  if (prefs === null) {
    return;
  }
  try {
    prefs.putSync('graphDoc', json);
    prefsFlush();
  } catch (_e) {
    // 存储不可用时静默降级为纯内存图谱
  }
}

/* ---------- 对话 ---------- */

function chatToJson(): string {
  const arr: Record<string, Object>[] = [];
  store.chat.forEach((m: ChatMsg) => {
    const r: Record<string, Object> = {
      'who': m.who, 'text': m.text, 'time': m.time,
      'ts': m.ts,
      'adjName': m.adjName, 'adjQty': m.adjQty, 'adjDone': m.adjDone,
      'shopName': m.shopName, 'shopQty': m.shopQty, 'shopDone': m.shopDone,
      'srcNote': m.srcNote, 'srcUrl': m.srcUrl
    };
    arr.push(r);
  });
  return JSON.stringify(arr);
}

function parseChat(json: string): ChatMsg[] {
  try {
    const arr = JSON.parse(json) as Record<string, Object>[];
    const out: ChatMsg[] = [];
    arr.forEach((r: Record<string, Object>) => {
      const m = new ChatMsg(String(r['who'] ?? 'ai'), String(r['text'] ?? ''), String(r['time'] ?? ''), []);
      // 老数据可能只存了 '刚刚' 这种写死标签：有 ts 就按时间戳重算，把它纠正过来
      m.ts = Number(r['ts'] ?? 0);
      if (m.ts > 0) {
        m.time = stampLabel(m.ts, m.time);
      } else {
        // 连 ts 都没有的历史消息：真实时间已不可知，留空（不再显示假的"刚刚"）
        m.time = '';
      }
      m.adjName = String(r['adjName'] ?? '');
      m.adjQty = Number(r['adjQty'] ?? -1);
      m.adjDone = Boolean(r['adjDone'] ?? false);
      m.shopName = String(r['shopName'] ?? '');
      m.shopQty = String(r['shopQty'] ?? '');
      m.shopDone = Boolean(r['shopDone'] ?? false);
      m.srcNote = String(r['srcNote'] ?? '');
      m.srcUrl = String(r['srcUrl'] ?? '');
      out.push(m);
    });
    return out;
  } catch (_e) {
    return [];
  }
}

/** 对话变化后调用（发送/清空/确认操作）；超上限滚动裁剪 */
export function saveChat(): void {
  if (prefs === null) {
    return;
  }
  if (store.chat.length > MAX_CHAT) {
    store.chat = store.chat.slice(store.chat.length - MAX_CHAT);
  }
  prefs.putSync('chat', chatToJson());
  prefsFlush();
}

export function clearChatSaved(): void {
  if (prefs === null) {
    return;
  }
  prefs.putSync('chat', '[]');
  prefsFlush();
}

/** 用户数据落盘（库/物品/方案/清单/待办/工作台/对话/日志）：
    与云端快照同一份 DTO（Continuation），保证"本机恢复"和"换设备拉取"走同一条路。 */
export function saveUserData(): void {
  if (prefs === null) {
    return;
  }
  prefs.putSync('userData', buildDataSnapshot());
  prefsFlush();
}

/** 退出登录：抹掉本机缓存（不含主题等纯外观偏好） */
export function clearUserDataSaved(): void {
  if (prefs === null) {
    return;
  }
  prefs.putSync('userData', '');
  prefs.putSync('chat', '[]');
  prefs.putSync('session', '');
  prefsFlush();
}

/* ---------- 登录会话（token 只存本机，用来免重复登录） ---------- */

class SessionDto {
  account: string = '';
  token: string = '';
  name: string = '';
  role: string = '';
  familyId: string = '';
  familyName: string = '';
  members: number = 0;
  families: FamilyDto[] = [];
}

class FamilyDto {
  id: string = '';
  name: string = '';
  memberCount: number = 0;
}

/** 登录成功后落盘会话：下次打开 App 不用再收一次验证码 */
export function saveSession(): void {
  if (prefs === null) {
    return;
  }
  const s = new SessionDto();
  s.account = store.userPhone;
  s.token = store.authToken;
  s.name = store.userName;
  s.role = store.userRole;
  s.familyId = store.family.id;
  s.familyName = store.family.name;
  s.members = store.family.memberCount;
  s.families = store.families.map((f: Family): FamilyDto => {
    const d = new FamilyDto();
    d.id = f.id;
    d.name = f.name;
    d.memberCount = f.memberCount;
    return d;
  });
  prefs.putSync('session', JSON.stringify(s));
  prefsFlush();
}

/** 启动时恢复会话；返回是否已登录（true 时调用方应接着拉一次云端数据） */
export function restoreSession(): boolean {
  if (prefs === null) {
    return false;
  }
  const raw = prefs.getSync('session', '') as string;
  if (raw === '') {
    return false;
  }
  try {
    const s = JSON.parse(raw) as SessionDto;
    if (s.token === '' || s.account === '') {
      return false;
    }
    store.userPhone = s.account;
    store.authToken = s.token;
    store.userName = s.name;
    store.userInitial = s.name === '' ? '' : s.name.slice(0, 1);
    store.userRole = s.role;
    // 老版本存下来的会话里可能没有成员数字段（JSON 会丢掉 undefined），这里兜个 1，
    // 否则界面会显示 "undefined 位成员"
    const members: number = s.members !== undefined && s.members > 0 ? s.members : 1;
    store.family = new Family(s.familyId, s.familyName, members);
    store.families = s.families.map((d: FamilyDto): Family =>
      new Family(d.id, d.name, d.memberCount !== undefined && d.memberCount > 0 ? d.memberCount : 1));
    store.loggedIn = true;
    return true;
  } catch (_e) {
    return false;
  }
}

/* ---------- 偏好档案 ---------- */

export function saveProfile(): void {
  if (prefs === null) {
    return;
  }
  const p = store.profile;
  const r: Record<string, Object> = { 'people': p.people, 'dislike': p.dislike, 'goal': p.goal, 'inject': p.inject };
  prefs.putSync('profile', JSON.stringify(r));
  prefsFlush();
}

/* ---------- AI 用量 ---------- */

export function recordUsage(route: string, model: string, ms: number): void {
  const arr = store.aiUsage.slice();
  arr.unshift(new AiUsageRow(route, model, ms, nowTime()));
  if (arr.length > 30) {
    arr.length = 30;
  }
  store.aiUsage = arr;
  if (prefs !== null) {
    const rows: Record<string, Object>[] = arr.map((r: AiUsageRow): Record<string, Object> => {
      const o: Record<string, Object> = { 'route': r.route, 'model': r.model, 'ms': r.ms, 'at': r.at };
      return o;
    });
    prefs.putSync('aiUsage', JSON.stringify(rows));
    prefsFlush();
  }
}

function prefsFlush(): void {
  if (prefs !== null) {
    prefs.flush();
  }
}
