// 启核图策 · 资源图谱页（M-A2：canvas 2d 轻量图谱，独立分包加载）
// - 总览：家庭中心 + 库社区环形布局（≤60 节点约束，当前 9 节点）
// - 视图：总览 / 仅临期；低端机降级为社区列表视图（9.3 对策）
// - 交互：点库节点 → 详情面板（社区统计 + 新鲜摘要 + 物品 + 问 AI）
import React, { useState, useRef, useCallback } from 'react'
import { View, Text, ScrollView, Canvas } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { snapshot } from '@/services/graph'
import { aggregate } from '@/services/graphQuery'
import { openAiWorkbench } from '@/services/aiContext'
import ItemGlyph from '@/components/ItemGlyph'
import type { GraphDoc, GraphNode } from '@/services/graphQuery'
import styles from './index.module.scss'
import classnames from 'classnames'

type ViewMode = 'overview' | 'expiring'
type PanelMode = 'canvas' | 'list'

interface DrawNode {
  id: string
  label: string
  x: number
  y: number
  r: number
  libId: string
  items: number
  expiring: number
  health: number
}

const GraphPage: React.FC = () => {
  const { db, refresh } = useStore()
  const [mode, setMode] = useState<ViewMode>('overview')
  const [panel, setPanel] = useState<PanelMode>('canvas')
  const [selected, setSelected] = useState<string>('')
  const [brief, setBrief] = useState({ nodes: 0, edges: 0, communities: 0 })
  const canvasRef = useRef<{ ctx: CanvasRenderingContext2D | null; w: number; h: number }>({ ctx: null, w: 0, h: 0 })
  const nodesRef = useRef<DrawNode[]>([])

  useDidShow(() => {
    refresh()
    try {
      const doc: GraphDoc = snapshot()
      setBrief({ nodes: doc.nodes.length, edges: doc.edges.length, communities: doc.communities.length })
      initCanvas(doc)
    } catch (e) {
      console.error('[Graph] snapshot error:', e)
    }
  })

  /* ---------- 布局：家庭中心 + 库社区环形（确定性，0 次模型） ---------- */
  const layout = useCallback((doc: GraphDoc, viewMode: ViewMode): DrawNode[] => {
    const libs = doc.nodes.filter((n) => n.type === 'Library')
    const out: DrawNode[] = []
    const cx = canvasRef.current.w / 2
    const cy = canvasRef.current.h / 2
    const R = Math.min(canvasRef.current.w, canvasRef.current.h) * 0.34
    libs.forEach((lib: GraphNode, i: number) => {
      const stats = aggregate(doc, 'lib:' + lib.props.libId || 'lib:' + lib.id) || aggregate(doc, 'lib:' + lib.id.replace('lib:', ''))
      const items = stats ? stats.stats.items : lib.props.count || 0
      const expiring = stats ? stats.stats.expiring : 0
      if (viewMode === 'expiring' && expiring === 0) return
      const angle = (Math.PI * 2 * i) / Math.max(1, libs.length) - Math.PI / 2
      out.push({
        id: lib.id,
        label: lib.label,
        x: cx + R * Math.cos(angle),
        y: cy + R * Math.sin(angle),
        r: 22 + Math.min(14, items),
        libId: lib.id.replace('lib:', ''),
        items,
        expiring,
        health: stats ? stats.stats.health : 100
      })
    })
    return out
  }, [])

  const draw = useCallback((_doc: GraphDoc, ns: DrawNode[]) => {
    const { ctx, w, h } = canvasRef.current
    if (!ctx) return
    ctx.clearRect(0, 0, w, h)
    const cx = w / 2
    const cy = h / 2
    /* 边：中心 → 库 */
    ctx.strokeStyle = '#E4EDF3'
    ctx.lineWidth = 1.2
    ns.forEach((n) => {
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(n.x, n.y)
      ctx.stroke()
    })
    /* 中心家庭节点 */
    ctx.beginPath()
    ctx.fillStyle = '#0E1424'
    ctx.arc(cx, cy, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#FEFEFE'
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(db.family ? db.family.name : '我的家', cx, cy)
    /* 库节点 */
    ns.forEach((n) => {
      const hot = n.expiring > 0
      ctx.beginPath()
      ctx.fillStyle = selected === n.id ? '#57D794' : '#FEFEFE'
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.fill()
      if (hot) { /* 临期红虚线圈 */
        ctx.setLineDash([4, 3])
        ctx.strokeStyle = '#C53D3D'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(n.x, n.y, n.r + 5, 0, Math.PI * 2)
        ctx.stroke()
        ctx.setLineDash([])
      }
      ctx.strokeStyle = selected === n.id ? '#3DD0AE' : '#CBD8E4'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2)
      ctx.stroke()
      /* 标签 */
      ctx.fillStyle = '#0E1424'
      ctx.font = 'bold 12px sans-serif'
      ctx.fillText(n.label, n.x, n.y - n.r - 10)
      ctx.fillStyle = hot ? '#C53D3D' : '#6B7C8C'
      ctx.font = '10px sans-serif'
      ctx.fillText(n.items + ' 件' + (hot ? ' · 临期 ' + n.expiring : ''), n.x, n.y + n.r + 12)
      ctx.fillStyle = '#0E1424'
      ctx.font = '16px sans-serif'
      ctx.fillText(String(n.items), n.x, n.y)
    })
    nodesRef.current = ns
  }, [db.family, selected])

  const initCanvas = useCallback((doc: GraphDoc) => {
    const query = Taro.createSelectorQuery()
    query.select('#graphCanvas').fields({ node: true, size: true }).exec((res) => {
      const item = res && res[0]
      if (!item || !item.node) return
      const canvas = item.node
      const dpr = Taro.getWindowInfo().pixelRatio || 2
      canvas.width = item.width * dpr
      canvas.height = item.height * dpr
      const ctx = canvas.getContext('2d')
      ctx.scale(dpr, dpr)
      canvasRef.current = { ctx, w: item.width, h: item.height }
      draw(doc, layout(doc, mode))
    })
  }, [draw, layout, mode])

  const redraw = useCallback((nextMode: ViewMode) => {
    try {
      const doc = snapshot()
      draw(doc, layout(doc, nextMode))
    } catch (e) { /* ignore */ }
  }, [draw, layout])

  const switchMode = (m: ViewMode) => {
    setMode(m)
    redraw(m)
  }

  /* ---------- 触摸命中 → 选中库 ---------- */
  const onTouch = (e: any) => {
    const t = (e.changedTouches || e.touches || [])[0] || {}
    const x = t.x != null ? t.x : t.clientX
    const y = t.y != null ? t.y : t.clientY
    let hit: DrawNode | null = null
    nodesRef.current.forEach((n) => {
      const d = Math.sqrt((n.x - x) * (n.x - x) + (n.y - y) * (n.y - y))
      if (d <= n.r + 8) hit = n
    })
    if (hit) {
      const h = hit as DrawNode
      setSelected(h.id)
      try {
        const doc = snapshot()
        draw(doc, nodesRef.current)
      } catch (err) { /* ignore */ }
    }
  }

  /* ---------- 详情面板数据 ---------- */
  const doc = (() => { try { return snapshot() } catch (e) { return null } })()
  const selLib = selected ? (db.libraries.filter((l) => 'lib:' + l.id === selected)[0] || null) : null
  const selAgg = selected && doc ? aggregate(doc, selected) : null
  const selSummary = selected && doc
    ? doc.summaries.filter((s) => s.community === selected && !s.stale)[0]
    : null
  const l1Communities = doc ? doc.communities.filter((c) => c.level === 1) : []

  const askAi = (q?: string) => {
    const libId = selected ? selected.replace('lib:', '') : ''
    openAiWorkbench({ libId, query: q || '' })
  }

  return (
    <View className={styles.page}>
      <View className={styles.toolbar}>
        <View className={classnames(styles.tab, mode === 'overview' && styles.tabOn)} onClick={() => switchMode('overview')}>
          <Text>总览</Text>
        </View>
        <View className={classnames(styles.tab, mode === 'expiring' && styles.tabOn)} onClick={() => switchMode('expiring')}>
          <Text>仅临期</Text>
        </View>
        <View className={styles.toolRight}>
          <Text className={styles.brief}>{brief.nodes} 节点 · {brief.edges} 边 · {brief.communities} 社区</Text>
          <View
            className={classnames(styles.tab, panel === 'list' && styles.tabOn)}
            onClick={() => setPanel(panel === 'list' ? 'canvas' : 'list')}
          >
            <Text>{panel === 'list' ? '图谱视图' : '列表降级'}</Text>
          </View>
        </View>
      </View>

      {panel === 'canvas' ? (
        <Canvas
          type="2d"
          id="graphCanvas"
          className={styles.canvas}
          onTouchStart={onTouch}
        />
      ) : (
        <ScrollView className={styles.listView} scrollY>
          {l1Communities.map((c) => {
            const s = doc ? doc.summaries.filter((x) => x.community === c.id && !x.stale)[0] : null
            return (
              <View key={c.id} className={styles.commRow} onClick={() => { setSelected(c.id) }}>
                <View className={styles.commHead}>
                  <Text className={styles.commName}>{c.label}</Text>
                  <Text className={classnames(styles.commStat, c.stats.expiring > 0 && styles.commHot)}>
                    {c.stats.items} 件 · 临期 {c.stats.expiring} · 健康 {c.stats.health}%
                  </Text>
                </View>
                {s ? <Text className={styles.commSummary}>{s.text}</Text> : <Text className={styles.commSummary}>摘要预计算中（离线生成）</Text>}
              </View>
            )
          })}
        </ScrollView>
      )}

      {/* 选中库详情：社区统计 + 摘要 + 物品 + 问 AI（MX4：点节点问 AI） */}
      <ScrollView className={styles.detail} scrollY>
        {selLib ? (
          <View className={styles.detailCard}>
            <View className={styles.detailHead}>
              <Text className={styles.detailTitle}>{selLib.icon} {selLib.name}</Text>
              {selAgg ? (
                <Text className={styles.detailStat}>
                  {selAgg.stats.items} 件 · 临期 {selAgg.stats.expiring} · 价值 ¥{selAgg.stats.value} · 健康 {selAgg.stats.health}%
                </Text>
              ) : null}
            </View>
            {selSummary ? (
              <Text className={styles.detailSummary}>{selSummary.text}（Agnes 预计算 · {Math.max(1, Math.round((Date.now() - selSummary.generatedAt) / 60000))} 分钟前）</Text>
            ) : null}
            {(selLib.items || []).slice(0, 6).map((it) => (
              <View
                key={it.id}
                className={styles.itemRow}
                onClick={() => askAi(it.name + ' 还能放几天')}
              >
                <View className={styles.itemIdentity}>
                  <ItemGlyph name={it.name} img={it.img} kbKey={it.kbKey} size={56} />
                  <Text className={styles.itemName}>{it.name}</Text>
                </View>
                <Text className={styles.itemMeta}>
                  {it.qty}{it.unit}
                  {it.expDays != null && it.expDays < 9000 ? ' · ' + it.expDays + ' 天' : ''}
                </Text>
              </View>
            ))}
            <View className={styles.detailActions}>
              <View className={styles.askBtn} onClick={() => askAi('这个库还能撑几天')} hoverClass={styles.btnHover}>
                <Text>问 AI：这个库还能撑几天</Text>
              </View>
            </View>
          </View>
        ) : (
          <View className={styles.detailTip}>
            <Text>点击图谱中的库节点查看详情，点物品可直接问 AI（私有物品不参与展示，F2.5）</Text>
          </View>
        )}
      </ScrollView>
    </View>
  )
}

export default GraphPage
