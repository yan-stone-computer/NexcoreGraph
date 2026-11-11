// 启核图策 · 图谱检索算子（纯函数，可单测；方案第 4 章）
// 与 Web 端 js/graph.js 同口径：≤3 跳、路径 ≤5、证据行 ≤12
// 所有算子第一参数为 GraphDoc，纯读不改，邻接表按 doc 引用缓存。

export interface GraphNode {
  id: string
  type: string
  label: string
  props: Record<string, any>
  community: string[]
}

export interface GraphEdge {
  id: string
  from: string
  to: string
  type: string
  props?: Record<string, any>
}

export interface CommunityStats {
  items: number
  expiring: number
  value: number
  consume7d: number
  health: number
}

export interface Community {
  id: string
  level: number
  label: string
  stats: CommunityStats
}

export interface Summary {
  community: string
  text: string
  generatedAt: number
  basedOnVersion: string
  model?: string
  stale: boolean
}

export interface GraphDoc {
  schema: number
  version: string
  builtAt: number
  kbVersion: string
  nodes: GraphNode[]
  edges: GraphEdge[]
  communities: Community[]
  summaries: Summary[]
  index: { byLabel: Record<string, string[]>; byType: Record<string, string[]> }
}

/* ---------- 邻接表（WeakMap 按 doc 缓存，O(e)） ---------- */
interface AdjLink { to: string; type: string; props?: Record<string, any>; rev?: boolean }
type AdjTable = Record<string, AdjLink[]>
const adjCache = new WeakMap<GraphDoc, { version: string; adj: AdjTable }>()

export function adjacency(doc: GraphDoc): AdjTable {
  const hit = adjCache.get(doc)
  if (hit && hit.version === doc.version) return hit.adj
  const adj: AdjTable = {}
  doc.edges.forEach((e) => {
    ;(adj[e.from] = adj[e.from] || []).push({ to: e.to, type: e.type, props: e.props })
    ;(adj[e.to] = adj[e.to] || []).push({ to: e.from, type: e.type, props: e.props, rev: true })
  })
  adjCache.set(doc, { version: doc.version, adj })
  return adj
}

export function byId(doc: GraphDoc, id: string): GraphNode | null {
  return doc.nodes.filter((n) => n.id === id)[0] || null
}

/* ---------- 算子 ---------- */

/** matchEntity(q)：名称 → 节点（长名优先防「蛋」误命中「蛋糕」；私有物品不匹配） */
export function matchEntity(doc: GraphDoc, q: string): { items: GraphNode[]; foods: GraphNode[] } {
  const hits: { items: GraphNode[]; foods: GraphNode[] } = { items: [], foods: [] }
  const items = (doc.index.byType.ItemInstance || [])
    .map((id) => byId(doc, id))
    .filter((n): n is GraphNode => !!n)
    .sort((a, b) => b.label.length - a.label.length)
  for (let i = 0; i < items.length; i++) {
    if (!items[i].props.isPrivate && q.indexOf(items[i].label) > -1) { hits.items.push(items[i]); break }
  }
  const foods = doc.index.byType.FoodConcept || []
  for (let j = 0; j < foods.length; j++) {
    const f = byId(doc, foods[j])
    if (f && q.indexOf(f.label) > -1) { hits.foods.push(f); break }
  }
  return hits
}

/** neighbors(id, hops=1)：BFS 邻域 */
export function neighbors(doc: GraphDoc, id: string, hops = 1): GraphNode[] {
  const a = adjacency(doc)
  const seen: Record<string, number> = { [id]: 0 }
  let frontier = [id]
  for (let h = 1; h <= hops; h++) {
    const next: string[] = []
    frontier.forEach((cur) => {
      ;(a[cur] || []).forEach((l) => {
        if (seen[l.to] === undefined) { seen[l.to] = h; next.push(l.to) }
      })
    })
    frontier = next
  }
  return Object.keys(seen).map((id2) => byId(doc, id2)).filter((n): n is GraphNode => !!n)
}

export interface HopPath {
  nodes: string[]
  edges: string[]
  from: string
}

/** multiHop(seeds, edgeTypes, maxHops=3)：受限边类型 DFS 路径（≤5 条） */
export function multiHop(doc: GraphDoc, seeds: GraphNode[], edgeTypes: string[] | null, maxHops = 3): HopPath[] {
  const a = adjacency(doc)
  const allow = edgeTypes ? (t: string) => edgeTypes.indexOf(t) > -1 : () => true
  const paths: HopPath[] = []
  function dfs(cur: GraphNode, nodeChain: string[], edgeChain: string[], depth: number) {
    if (paths.length >= 5 || depth > maxHops) return
    ;(a[cur.id] || []).forEach((l) => {
      if (!allow(l.type)) return
      const nxt = byId(doc, l.to)
      if (!nxt || nodeChain.indexOf(l.to) > -1) return
      const chain = nodeChain.concat([l.to])
      const echain = edgeChain.concat([l.type])
      paths.push({ nodes: chain, edges: echain, from: cur.id })
      if (depth < maxHops) dfs(nxt, chain, echain, depth + 1)
    })
  }
  ;(seeds || []).slice(0, 3).forEach((s) => dfs(s, [s.id], [], 1))
  return paths.slice(0, 5)
}

export interface SubgraphFilter {
  libId?: string
  cat?: string
  expiringOnly?: boolean
  includePrivate?: boolean
}

/** subgraph(filter)：{libId, cat, expiringOnly, includePrivate}；私有默认隐藏（F2.5） */
export function subgraph(doc: GraphDoc, filter: SubgraphFilter = {}): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const ns = doc.nodes.filter((n) => {
    if (n.type === 'ItemInstance') {
      if (n.props.isPrivate && !filter.includePrivate) return false
      if (filter.libId && n.props.libId !== filter.libId) return false
      if (filter.expiringOnly && !(n.props.expDays != null && n.props.expDays <= 7 && n.props.expDays < 9000)) return false
      if (filter.cat && n.community.indexOf('cat:' + filter.cat) < 0) return false
      return true
    }
    if (n.type === 'Library') return !filter.libId || n.id === 'lib:' + filter.libId
    if (n.type === 'FoodConcept' || n.type === 'RecipeConcept') return !filter.libId
    return false
  })
  if (filter.libId) {
    const keep: Record<string, number> = {}
    doc.edges.forEach((e) => {
      const f = byId(doc, e.from)
      if (e.type === 'instantiates' && f && f.props.libId === filter.libId) keep[e.to] = 1
      if (e.type === 'usedBy' && keep[e.from]) keep[e.to] = 1
    })
    Object.keys(keep).forEach((id) => {
      const n = byId(doc, id)
      if (n && ns.indexOf(n) < 0) ns.push(n)
    })
  }
  const ids: Record<string, number> = {}
  ns.forEach((n) => { ids[n.id] = 1 })
  const es = doc.edges.filter((e) => ids[e.from] && ids[e.to])
  return { nodes: ns, edges: es }
}

/** aggregate(communityId)：社区实时统计（数值 100% 代码计算，红线 1） */
export function aggregate(doc: GraphDoc, cid: string): Community | null {
  const c = doc.communities.filter((x) => x.id === cid)[0]
  if (!c) return null
  const members = doc.nodes.filter((n) => (n.community || []).indexOf(cid) > -1)
  let items = 0
  let expiring = 0
  let value = 0
  members.forEach((n) => {
    if (n.type !== 'ItemInstance' || n.props.isPrivate) return
    items++
    if (n.props.expDays != null && n.props.expDays <= 7 && n.props.expDays < 9000) expiring++
    value += n.props.price || 0
  })
  return {
    id: c.id,
    level: c.level,
    label: c.label,
    stats: {
      items,
      expiring,
      value: Math.round(value * 10) / 10,
      consume7d: c.stats.consume7d,
      health: c.stats.health
    }
  }
}

/** communityOf(id)：节点社区链（L1 库 / L2 类别 / L3 场景） */
export function communityOf(doc: GraphDoc, id: string): Array<{ id: string; label: string; level: number; stats: CommunityStats }> {
  const n = byId(doc, id)
  if (!n) return []
  return (n.community || []).map((cid) => {
    const c = doc.communities.filter((x) => x.id === cid)[0]
    return c ? { id: c.id, label: c.label, level: c.level, stats: c.stats } : { id: cid, label: cid.split(':')[1] || cid, level: 0, stats: { items: 0, expiring: 0, value: 0, consume7d: 0, health: 100 } }
  })
}
