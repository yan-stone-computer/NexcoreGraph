/* 启核图策 · 图谱服务（补充方案第 6 章）
   职责：图持久化（事务重建）、内存索引缓存（按版本）、社区摘要读写、运营聚合。
   说明：不引入图数据库——规模 ≤500 节点 / ≤3000 边，邻接表 + 内存索引足够。 */

const { buildIndex } = require('./graphQuery');

const IDX_CACHE = new Map();      // familyId → { version, index }
const IDX_TTL_MS = 5 * 60 * 1000; // 5 分钟后强制回源（防多实例/外改）

class GraphService {
  constructor(pool) {
    this.pool = pool;
  }

  /** 事务重建：先删该家庭旧图，再分批插入（避免读到中间态） */
  async save(familyId, graph) {
    const conn = await this.pool.getConnection();
    try {
      await conn.beginTransaction();
      await conn.query('DELETE FROM graph_nodes WHERE family_id = ?', [familyId]);
      await conn.query('DELETE FROM graph_edges WHERE family_id = ?', [familyId]);
      await conn.query('DELETE FROM graph_communities WHERE family_id = ?', [familyId]);

      const chunk = 200;
      for (let i = 0; i < graph.nodes.length; i += chunk) {
        const rows = graph.nodes.slice(i, i + chunk).map((n) => [
          n.id, familyId, n.type, String(n.label).substring(0, 128),
          JSON.stringify(n.props || {}),
          (n.community || []).join('|').substring(0, 255)
        ]);
        await conn.query(
          'INSERT INTO graph_nodes (id, family_id, type, label, props, community) VALUES ?', [rows]);
      }
      for (let i = 0; i < graph.edges.length; i += chunk) {
        const rows = graph.edges.slice(i, i + chunk).map((e) => [
          familyId, e.from, e.to, e.type, JSON.stringify(e.props || {})
        ]);
        await conn.query(
          'INSERT INTO graph_edges (family_id, from_id, to_id, type, props) VALUES ?', [rows]);
      }
      if (graph.communities.length > 0) {
        const crows = graph.communities.map((c) => [
          familyId, c.id, c.level, String(c.label).substring(0, 128), JSON.stringify(c.stats || {})
        ]);
        await conn.query(
          'INSERT INTO graph_communities (family_id, id, level, label, stats) VALUES ?', [crows]);
      }
      await conn.query(
        'INSERT INTO graph_versions (family_id, version, nodes, edges) VALUES (?, ?, ?, ?) ' +
        'ON DUPLICATE KEY UPDATE version = VALUES(version), nodes = VALUES(nodes), edges = VALUES(edges), built_at = NOW()',
        [familyId, graph.version, graph.nodes.length, graph.edges.length]);
      await conn.commit();
      IDX_CACHE.delete(familyId);
      return { version: graph.version, nodes: graph.nodes.length, edges: graph.edges.length, communities: graph.communities.length };
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  }

  /** 读取图谱（无图返回 null） */
  async load(familyId) {
    const [verRows] = await this.pool.query(
      'SELECT version, built_at FROM graph_versions WHERE family_id = ?', [familyId]);
    if (verRows.length === 0) {
      return null;
    }
    const [nodes] = await this.pool.query(
      'SELECT id, type, label, props, community FROM graph_nodes WHERE family_id = ?', [familyId]);
    const [edges] = await this.pool.query(
      'SELECT from_id, to_id, type, props FROM graph_edges WHERE family_id = ?', [familyId]);
    const [communities] = await this.pool.query(
      'SELECT id, level, label, stats FROM graph_communities WHERE family_id = ?', [familyId]);
    return {
      version: verRows[0].version,
      builtAt: verRows[0].built_at,
      nodes: nodes.map((n) => ({
        id: n.id, type: n.type, label: n.label,
        props: parseJson(n.props), community: n.community ? String(n.community).split('|') : []
      })),
      edges: edges.map((e) => ({ from: e.from_id, to: e.to_id, type: e.type, props: parseJson(e.props) })),
      communities: communities.map((c) => ({
        id: c.id, level: c.level, label: c.label, stats: parseJson(c.stats)
      }))
    };
  }

  /** 取内存索引（命中缓存且版本一致则复用） */
  async index(familyId) {
    const cached = IDX_CACHE.get(familyId);
    if (cached && Date.now() - cached.at < IDX_TTL_MS) {
      return cached.index;
    }
    const graph = await this.load(familyId);
    if (graph === null) {
      return null;
    }
    const index = buildIndex(graph);
    IDX_CACHE.set(familyId, { at: Date.now(), index });
    return index;
  }

  invalidate(familyId) {
    IDX_CACHE.delete(familyId);
  }

  /** 社区摘要读写（离线预计算产物） */
  async summaries(familyId) {
    const [rows] = await this.pool.query(
      'SELECT community, text, model, based_on, generated_at FROM graph_summaries WHERE family_id = ?', [familyId]);
    return rows.map((r) => ({
      community: r.community, text: r.text, model: r.model,
      basedOn: r.based_on, generatedAt: r.generated_at
    }));
  }

  async saveSummary(familyId, community, text, model, basedOn) {
    await this.pool.query(
      'INSERT INTO graph_summaries (family_id, community, text, model, based_on) VALUES (?, ?, ?, ?, ?) ' +
      'ON DUPLICATE KEY UPDATE text = VALUES(text), model = VALUES(model), based_on = VALUES(based_on), generated_at = NOW()',
      [familyId, community, String(text).substring(0, 512), model || '', basedOn || '']);
  }

  /** 需要生成摘要的社区：一级/二级社区中节点数 ≥3 且（无摘要或摘要基于旧版本） */
  async pendingSummaries(familyId) {
    const index = await this.index(familyId);
    if (index === null) {
      return { version: '', stale: [] };
    }
    const current = await this.summaries(familyId);
    const byCommunity = new Map(current.map((s) => [s.community, s]));
    const stale = [];
    index.communities.forEach((c) => {
      if (c.level !== 1) return;
      const items = (c.stats && c.stats.items) || 0;
      if (items < 3) return;
      const s = byCommunity.get(c.id);
      if (!s || s.basedOn !== index.graph.version) {
        stale.push({ id: c.id, level: c.level, label: c.label, stats: c.stats || {} });
      }
    });
    return { version: index.graph.version, stale };
  }

  /** 管理员端运营指标（匿名聚合，不含物品明细） */
  async statsAll() {
    const [rows] = await this.pool.query(
      'SELECT family_id, version, nodes, edges, built_at FROM graph_versions ORDER BY built_at DESC LIMIT 200');
    const [sumRows] = await this.pool.query(
      'SELECT COUNT(*) AS total, SUM(based_on IS NOT NULL) AS withVersion FROM graph_summaries');
    const total = rows.length;
    const avgNodes = total === 0 ? 0 : Math.round(rows.reduce((a, r) => a + (r.nodes || 0), 0) / total);
    const avgEdges = total === 0 ? 0 : Math.round(rows.reduce((a, r) => a + (r.edges || 0), 0) / total);
    return {
      families: total,
      avgNodes, avgEdges,
      summaries: sumRows[0] ? Number(sumRows[0].total || 0) : 0,
      lastBuiltAt: rows.length ? rows[0].built_at : null
    };
  }
}

function parseJson(v) {
  if (v === null || v === undefined) return {};
  if (typeof v === 'object') return v;
  try {
    return JSON.parse(String(v));
  } catch (e) {
    return {};
  }
}

module.exports = { GraphService };
