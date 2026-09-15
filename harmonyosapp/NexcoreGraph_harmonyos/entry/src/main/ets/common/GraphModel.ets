/* 启核图策 · 图谱数据模型（补充方案第 5.1 节契约，鸿蒙端实现）
   节点/边/社区字段与后端 graphBuild.js 完全对齐，保证 CT-2（跨端同构）可对拍。 */

export class GraphNode {
  id: string = '';
  type: string = '';
  label: string = '';
  props: Record<string, Object> = {};
  community: string[] = [];
}

export class GraphEdge {
  id: string = '';
  from: string = '';
  to: string = '';
  type: string = '';
  props: Record<string, Object> = {};
}

export class GraphCommunity {
  id: string = '';
  level: number = 1;
  label: string = '';
  stats: Record<string, Object> = {};
}

export class GraphDoc {
  schema: number = 1;
  version: string = '';
  builtAt: number = 0;
  kbVersion: string = '1.0';
  /** 新鲜度指纹：由库存/方案/采购/预警/日志的轻量摘要算出；与当前不一致即需重建 */
  freshness: string = '';
  nodes: GraphNode[] = [];
  edges: GraphEdge[] = [];
  communities: GraphCommunity[] = [];
}

export class GraphBuildStat {
  nodes: number = 0;
  edges: number = 0;
  communities: number = 0;
  unlinked: number = 0;
  ms: number = 0;
}

/** GraphRAG 路径证据（可解释性：节点链 + 边类型 + 事实 + 来源） */
export class RagPath {
  nodes: string[] = [];
  edges: string[] = [];
  facts: string[] = [];
  src: string = '';
  score: number = 0;
}

export class RagEvidence {
  mode: string = 'local';
  version: string = '';
  lines: string[] = [];
  paths: RagPath[] = [];
  stale: boolean = false;
}

/* ---------- props 读写（Record<string, Object> 取值需显式转换） ---------- */

export function strOf(props: Record<string, Object>, key: string, def: string): string {
  const v = props[key];
  if (v === undefined || v === null) {
    return def;
  }
  return String(v);
}

export function numOf(props: Record<string, Object>, key: string, def: number): number {
  const v = props[key];
  if (v === undefined || v === null) {
    return def;
  }
  const n = Number(v);
  return isNaN(n) ? def : n;
}

export function boolOf(props: Record<string, Object>, key: string, def: boolean): boolean {
  const v = props[key];
  if (v === undefined || v === null) {
    return def;
  }
  return String(v) === 'true';
}

/** 稳定性哈希（FNV-1a）→ 12 位十六进制，用于 graphVersion */
export function hash12(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h = h ^ text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = (h >>> 0).toString(16);
  while (out.length < 12) {
    out = '0' + out;
  }
  return out.substring(0, 12);
}
