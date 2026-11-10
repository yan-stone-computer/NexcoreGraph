/* 启核图策 · 端侧 AI 客户端（整改文档 M-7 / 缺陷 D6）
   —— 三端都保留客户端 Key：鸿蒙端通过 Backend.requestJson 的 x-agnes-key 透传给本机自建网关，
   网关负责转发厂商；端侧仍不直连厂商域名，避免证书与跨域问题。
   保留的能力与红线（与改造前一致）：
   P0-1 意图路由：greet/where/qty/expiry 本地直答 0 次模型（断网也可用）；
   P0-2 工具协议 v2：[调整]名称|数量 / [购物]名称|数量，白名单校验 + 预览确认后由 UI 执行；
   P0-3 创新菜谱 [菜]菜名|耗时|亮点|用料；
   P0-6 简报：统计由代码计算，模型仅润色；
   红线：数值由代码计算；写操作先预览；单请求 ≤2 次模型调用（网关侧主模型 + 备用模型各一次）。 */

import { http } from '@kit.NetworkKit';
import { store } from './Store';
import { IntakeResult, ChatMsg } from './Db';
import { routeIntent, directAnswer, evidenceFor, AIReply } from './Router';
import { recordUsage } from './LocalStore';
import { callJson } from './Backend';
import { ragEvidence, modeForIntent } from './GraphQuery';
import { lookup } from './KnowledgeIndex';
import { matchCommand, runCommand, CmdReply } from './Commands';
import { RagEvidence } from './GraphModel';
import { visibleReply } from './ReplyText';
import { hilog } from '@kit.PerformanceAnalysisKit';

const DOMAIN: number = 0x0000;
const TAG: string = 'NexcoreGraph';

const CONNECT_MS: number = 5000;
const READ_MS: number = 30000;      // 文本快答：网关侧超时 30s，端侧留出余量
// 视觉识别：网关侧已改成"模型链 + 25s 硬预算"（429 立刻换模型，不再退避重试），
// 端侧 45s 足够覆盖上传时间；旧值 90s 会让网关挂掉时用户白等一分半。
const READ_VISION_MS: number = 45000;
const REPORT_EVERY: number = 5;     // 快答每累计 5 条上报一次用量（M-10）

let fastSinceReport: number = 0;
/** 最近一次模型调用的可观测信息（M-10 用量看板 / 黑板调试用） */
let lastTraceId: string = '';
let lastEvidencePaths: number = 0;
let lastWarnings: string[] = [];

export function lastAiTraceId(): string {
  return lastTraceId;
}

export function lastEvidencePathCount(): number {
  return lastEvidencePaths;
}

export function lastAiWarnings(): string[] {
  return lastWarnings;
}

/* ---------- 网关响应结构 ---------- */
class GatewayChat {
  ok: boolean = false;
  text: string = '';
  model: string = '';
  ms: number = 0;
  tokens: number = 0;
  error: string = '';
  traceId: string = '';
  evidenceUsed: string[] = [];
  warnings: string[] = [];
}

class GatewayItem {
  name: string = '';
  category: string = '';
  qty: number = 1;
  unit: string = '个';
  pos: string = '';
  /* 0 = 这类物品没有保质期（衣物/工具/厨具等），不是"填错" */
  expDays: number = 0;
  price: number = 0;
}

class GatewayVision {
  ok: boolean = false;
  items: GatewayItem[] = [];
  model: string = '';
  ms: number = 0;
  error: string = '';
  /** 网关判定"这张图里没有家庭物品"（非失败）：端侧据此给明确提示，不回退演示数据 */
  noHouseholdItems: boolean = false;
  /** 网关实际走过的模型链（如 agnes-2.5-flash:485ms:ok），用于复盘"到底慢在哪" */
  trail: string[] = [];
}

/** 用量聚合（M-10：端内与管理员端共用同一口径） */
export class UsageRow {
  route: string = '';
  model: string = '';
  source: string = '';
  calls: number = 0;
  avgMs: number = 0;
  tokens: number = 0;
}

export class UsageSummary {
  total: number = 0;
  fastCalls: number = 0;
  fastShare: number = 0;
  avgMs: number = 0;
  byRoute: UsageRow[] = [];
}

/* ---------- 用量上报（本地快答也计入，用于统计"省下的模型调用"） ---------- */

function uploadUsage(): void {
  const rows: Record<string, Object>[] = [];
  store.aiUsage.slice(0, 20).forEach((u) => {
    const o: Record<string, Object> = { 'route': u.route, 'model': u.model, 'ms': u.ms };
    rows.push(o);
  });
  if (rows.length === 0) {
    return;
  }
  const body: Record<string, Object> = {
    'familyId': store.family.id,
    'user': store.userName,
    'rows': rows
  };
  // 尽力而为：上报失败不影响对话
  callJson('/api/ai/usage', http.RequestMethod.POST, JSON.stringify(body), CONNECT_MS, 8000)
    .then((): void => {
      fastSinceReport = 0;
    })
    .catch((_e: Error): void => {
      fastSinceReport = 0;
    });
}

/** 拉取后端用量聚合；失败时抛出，由设置页回退到本地记录 */
export function gatewayUsage(): Promise<UsageSummary> {
  const path = '/api/ai/usage?familyId=' + store.family.id + '&range=7';
  return callJson(path, http.RequestMethod.GET, '', CONNECT_MS, 12000).then((text: string): UsageSummary => {
    const raw = JSON.parse(text) as UsageSummary;
    const out = new UsageSummary();
    out.total = raw.total === undefined ? 0 : raw.total;
    out.fastCalls = raw.fastCalls === undefined ? 0 : raw.fastCalls;
    out.fastShare = raw.fastShare === undefined ? 0 : raw.fastShare;
    out.avgMs = raw.avgMs === undefined ? 0 : raw.avgMs;
    const list: UsageRow[] = [];
    if (raw.byRoute !== undefined) {
      raw.byRoute.forEach((r: UsageRow) => {
        list.push(r);
      });
    }
    out.byRoute = list;
    return out;
  });
}

/* ---------- 工具行解析（P0-2：白名单 + 防幻觉写库，逻辑与改造前一致） ---------- */
function parseToolLines(content: string, reply: AIReply): string {
  const kept: string[] = [];
  content.split('\n').forEach((l: string) => {
    const t = l.trim();
    if (t.startsWith('[调整]')) {
      const parts = t.substring(4).split('|');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const q = parseFloat(parts[1]);
        const hit = store.findItemHit(name);   // 校验：物品必须在库存中
        if (hit !== null && !isNaN(q) && q >= 0) {
          reply.adjName = hit[1].name;
          reply.adjQty = q;
        }
      }
    } else if (t.startsWith('[购物]')) {
      const parts = t.substring(4).split('|');
      if (parts.length >= 2) {
        const name = parts[0].trim();
        const qty = parts[1].trim();
        if (name !== '' && name.length <= 12) {
          reply.shopName = name;
          reply.shopQty = qty;
        }
      }
    } else if (t.startsWith('[菜]')) {
      const parts = t.substring(3).split('|');
      if (parts.length >= 4) {
        reply.dishTitle = parts[0].trim();
        reply.dishTime = parts[1].trim();
        reply.dishNote = parts[2].trim();
        reply.dishIngredients = parts[3].split(/[,，、]/)
          .map((s: string): string => s.trim())
          .filter((s: string): boolean => s !== '');
      }
    } else {
      kept.push(l);
    }
  });
  return kept.join('\n').trim();
}

/* ---------- AI 对话（F5.1/F5.2/F5.5） ---------- */
export function askAI(question: string): Promise<AIReply> {
  /* 先过自然语言指令层：能确定性命中的操作不花模型调用（断网也能建库、加物品、换主题）。
     开放式提问（今晚吃什么、营养、为什么）命中不到，照常走模型路。 */
  const cmd = matchCommand(question);
  if (cmd !== null) {
    recordUsage('cmd:' + cmd.id, '本地指令', 0);
    fastSinceReport += 1;
    return runCommand(cmd).then((r: CmdReply): AIReply => {
      const out = new AIReply();
      out.text = r.text;
      out.route = r.route;
      out.srcNote = r.srcNote;
      out.opKind = r.opKind;
      out.opArg = r.opArg;
      out.opLabel = r.opLabel;
      return out;
    }).catch((e: Error): AIReply => {
      const out = new AIReply();
      out.route = 'cmd:error';
      out.srcNote = '本地指令 · 0 次模型调用';
      out.text = '这条没做成：' + (e.message !== undefined && e.message !== '' ? e.message : '换个说法再试一次');
      return out;
    });
  }
  const route = routeIntent(question);

  // 快路：greet / where / qty / expiry —— 代码直答，0 次模型调用（断网可用）
  const direct = directAnswer(route, question);
  if (direct !== null) {
    recordUsage(direct.route, '本地快答', 0);
    fastSinceReport += 1;
    if (fastSinceReport >= REPORT_EVERY) {
      uploadUsage();
    }
    return Promise.resolve(direct);
  }

  // 模型路：证据由端侧装配（红线 1），客户端 Key 随网关请求透传
  // GraphRAG：按意图选检索模式，附带"路径证据"（节点链 + 事实 + 来源），图谱不可用时回退证据行
  const mode = modeForIntent(route);
  const graphEv: RagEvidence = ragEvidence(mode, question);
  hilog.info(DOMAIN, TAG,
    'ai ask: intent=%{public}s mode=%{public}s graphVersion=%{public}s lines=%{public}d paths=%{public}d',
    route, mode, graphEv.version, graphEv.lines.length, graphEv.paths.length);
  const history: Record<string, Object>[] = [];
  store.chat.slice(-8).forEach((m: ChatMsg) => {
    const r: Record<string, Object> = { 'who': m.who, 'text': m.text };
    history.push(r);
  });
  const body: Record<string, Object> = {
    'familyId': store.family.id,
    'user': store.userName,
    'intent': route,
    'evidence': evidenceFor(route, question),
    'graphEvidence': graphEv,
    'question': question,
    'history': history,
    'maxTokens': 600
  };

  const start = Date.now();
  return callJson('/api/ai/chat', http.RequestMethod.POST, JSON.stringify(body), CONNECT_MS, READ_MS)
    .then((text: string): AIReply => {
      const res = JSON.parse(text) as GatewayChat;
      const r = new AIReply();
      r.route = route;
      lastTraceId = res.traceId === undefined ? '' : res.traceId;
      lastEvidencePaths = res.evidenceUsed === undefined ? 0 : res.evidenceUsed.length;
      lastWarnings = res.warnings === undefined ? [] : res.warnings;
      hilog.info(DOMAIN, TAG,
        'ai reply: model=%{public}s trace=%{public}s evidenceUsed=%{public}d warnings=%{public}d',
        res.model, lastTraceId, lastEvidencePaths, lastWarnings.length);
      const prefNote = store.profile.inject && store.profile.dislike !== '' ? ' + 家庭偏好' : '';
      const baseNote = (route === 'cook' || route === 'nutrition' || route === 'creative')
        ? '证据：库存图谱（' + mode + '）' + prefNote : '证据：库存图谱';
      const pathNote = lastEvidencePaths > 0 ? `｜已引用 ${lastEvidencePaths} 条路径` : '';
      const warnNote = lastWarnings.length > 0 ? `｜${lastWarnings.join('、')}` : '';
      r.srcNote = baseNote + pathNote + warnNote;
      if (graphEv.paths.length > 0 && graphEv.paths[0].src !== '') {
        r.srcUrl = '';   // 路径来源在 srcNote 中展示，链接由知识库快答路径提供
      }
      const kept = parseToolLines(visibleReply(res.text === undefined ? '' : res.text), r);
      r.text = kept === '' ? '（AI 未返回内容，请重试）' : kept;
      recordUsage(route, res.model === undefined || res.model === '' ? 'gateway' : res.model, Date.now() - start);
      uploadUsage();
      return r;
    });
}

/* ---------- AI 简报（F7.7 / P0-6）：统计已由代码算好，模型仅润色 ---------- */
export function askSummary(statsText: string): Promise<string> {
  // 简报同时附带"社区统计"图谱证据（global 模式，代码计算，无摘要时不伪造洞察）
  const graphEv: RagEvidence = ragEvidence('global', statsText);
  const body: Record<string, Object> = {
    'familyId': store.family.id,
    'user': store.userName,
    'intent': 'summary',
    'evidence': statsText,
    'graphEvidence': graphEv,
    'question': '请总结本周库存情况。',
    'maxTokens': 300
  };
  const start = Date.now();
  return callJson('/api/ai/chat', http.RequestMethod.POST, JSON.stringify(body), CONNECT_MS, READ_MS)
    .then((text: string): string => {
      const res = JSON.parse(text) as GatewayChat;
      recordUsage('summary', res.model === undefined || res.model === '' ? 'gateway' : res.model,
        Date.now() - start);
      uploadUsage();
      return visibleReply(String(res.text).trim());
    });
}

/* ---------- 视觉识别（F1.1/F1.5 拍照入库，识别逻辑与改造前一致，改为网关调用） ---------- */
export function recognizeImage(base64Jpeg: string): Promise<IntakeResult[]> {
  const body: Record<string, Object> = {
    'familyId': store.family.id,
    'user': store.userName,
    'imageBase64': base64Jpeg
  };
  const start = Date.now();
  return callJson('/api/ai/vision', http.RequestMethod.POST, JSON.stringify(body), CONNECT_MS, READ_VISION_MS)
    .then((text: string): IntakeResult[] => {
      const res = JSON.parse(text) as GatewayVision;
      recordUsage('vision', res.model === undefined || res.model === '' ? 'gateway' : res.model,
        Date.now() - start);
      const results: IntakeResult[] = [];
      const items: GatewayItem[] = res.items === undefined ? [] : res.items;
      items.forEach((it: GatewayItem, i: number) => {
        if (it.name === undefined || it.name === '') {
          return;
        }
        const q = it.qty === undefined || isNaN(it.qty) ? 1 : it.qty;
        // 保质期：模型没给（或明确给 0）时，先查内置知识库；查不到就按"不适用"处理。
        // 旧代码在这里硬塞 7 天，于是衣柜里的毛衣、工具箱里的螺丝刀全变成"7 天后到期"。
        let days = it.expDays === undefined || isNaN(it.expDays) || it.expDays <= 0 ? 0 : it.expDays;
        if (days <= 0) {
          const kb = lookup(it.name);
          if (kb !== null) {
            const r = kb.row;
            days = r.fridgeDays > 0 ? r.fridgeDays : (r.pantryDays > 0 ? r.pantryDays : (r.freezerDays > 0 ? r.freezerDays : 0));
          }
        }
        const p = it.price === undefined || isNaN(it.price) ? 0 : it.price;
        results.push(new IntakeResult('ai-' + i, '📦', '', it.name,
          it.category === undefined ? '' : it.category,
          String(q),
          it.unit === undefined || it.unit === '' ? '个' : it.unit,
          it.pos === undefined ? '' : it.pos,
          days > 0 ? `${days} 天` : '不适用', days, '',
          p === 0 ? '' : String(p),
          '拍照识别（AI 生成）', false));
      });
      uploadUsage();
      // 注意：空结果是**正常结果**（网关判定这张图里没有家庭物品），不是失败。
      // 旧代码在这里 throw，调用方一律走"载入演示数据"，于是拍一张不相干的图会冒出
      // 鸡蛋/西红柿等假数据 —— 看起来像 AI 在乱认。现在把空结果交回调用方区分处理。
      return results;
    });
}
