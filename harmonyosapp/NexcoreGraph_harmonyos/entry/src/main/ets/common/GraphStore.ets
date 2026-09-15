/* 启核图策 · 图谱存储与版本（补充方案第 3.6 / 5.1 节）
   持久化走 LocalStore 的 Preferences（键 nexcore_local.graphDoc），
   内存索引由 GraphQuery 按需构建；dirty 标记用于"写操作后按需重建"。 */

import { GraphDoc, GraphNode, GraphEdge, GraphCommunity } from './GraphModel';
import { loadGraphJson, saveGraphJson } from './LocalStore';

let doc: GraphDoc | null = null;
let dirty: boolean = true;
let loadedOnce: boolean = false;

/** 首次访问时从本地读取（rawfile/偏好都不可用时保持 null，由 GraphBuild 重建） */
function ensureLoaded(): void {
  if (loadedOnce) {
    return;
  }
  loadedOnce = true;
  const json = loadGraphJson();
  if (json === '') {
    return;
  }
  try {
    const raw = JSON.parse(json) as GraphDoc;
    const d = new GraphDoc();
    d.schema = raw.schema === undefined ? 1 : raw.schema;
    d.version = raw.version === undefined ? '' : raw.version;
    d.builtAt = raw.builtAt === undefined ? 0 : raw.builtAt;
    d.kbVersion = raw.kbVersion === undefined ? '1.0' : raw.kbVersion;
    d.freshness = raw.freshness === undefined ? '' : raw.freshness;
    const nodes: GraphNode[] = [];
    (raw.nodes === undefined ? [] : raw.nodes).forEach((n: GraphNode) => {
      const node = new GraphNode();
      node.id = n.id;
      node.type = n.type;
      node.label = n.label;
      node.props = n.props === undefined ? {} : n.props;
      node.community = n.community === undefined ? [] : n.community;
      nodes.push(node);
    });
    const edges: GraphEdge[] = [];
    (raw.edges === undefined ? [] : raw.edges).forEach((e: GraphEdge) => {
      const edge = new GraphEdge();
      edge.id = e.id;
      edge.from = e.from;
      edge.to = e.to;
      edge.type = e.type;
      edge.props = e.props === undefined ? {} : e.props;
      edges.push(edge);
    });
    const communities: GraphCommunity[] = [];
    (raw.communities === undefined ? [] : raw.communities).forEach((c: GraphCommunity) => {
      const cm = new GraphCommunity();
      cm.id = c.id;
      cm.level = c.level;
      cm.label = c.label;
      cm.stats = c.stats === undefined ? {} : c.stats;
      communities.push(cm);
    });
    d.nodes = nodes;
    d.edges = edges;
    d.communities = communities;
    doc = d;
    dirty = false;
  } catch (_e) {
    doc = null;
  }
}

export function graphDoc(): GraphDoc | null {
  ensureLoaded();
  return doc;
}

export function setGraphDoc(d: GraphDoc): void {
  ensureLoaded();
  doc = d;
  dirty = false;
  const json: Record<string, Object> = {
    'schema': d.schema, 'version': d.version, 'builtAt': d.builtAt, 'kbVersion': d.kbVersion,
    'freshness': d.freshness,
    'nodes': d.nodes, 'edges': d.edges, 'communities': d.communities
  };
  saveGraphJson(JSON.stringify(json));
}

/** 写操作后标记图谱需重建（下次问答/看图时按需重建，避免每次写都全量构图） */
export function markGraphDirty(): void {
  dirty = true;
}

export function isGraphDirty(): boolean {
  ensureLoaded();
  return dirty;
}

export function graphVersion(): string {
  ensureLoaded();
  return doc === null ? '' : doc.version;
}

export function graphSize(): string {
  ensureLoaded();
  if (doc === null) {
    return '未构建';
  }
  return `${doc.nodes.length} 节点 · ${doc.edges.length} 边 · ${doc.communities.length} 社区`;
}
