import React, { useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import TourTip from '@/components/TourTip'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import { evaluatePolicy, type AgentProposal } from '@/services/policy'
import { simulate, type Scenario } from '@/services/simulation'
import { TOUR } from '@/services/demoTour'
import { advanceTour, currentTourStep, stopTour } from '@/services/tourStore'
import { lastTrace } from '@/services/traceStore'
import { verifyAuditChain } from '@/services/eventStore'
import type { DomainEvent } from '@/domain/eventJournal'
import type { RetrievalTrace } from '@/services/retrievalTrace'
import styles from './index.module.scss'
import classnames from 'classnames'

type ViewMode = 'overview' | 'simulate' | 'events' | 'policy'

const VIEWS: Array<{ id: ViewMode; label: string }> = [
  { id: 'overview', label: '总览' },
  { id: 'simulate', label: 'What-if' },
  { id: 'events', label: '审计链' },
  { id: 'policy', label: '策略' }
]

function metricLabel(key: string): string {
  return ({
    items: '物品',
    stockUnits: '库存单位',
    expiring: '临期',
    lowStock: '低库存',
    budgetUsed: '预算占用',
    health: '健康度'
  } as Record<string, string>)[key] || key
}

const LabPage: React.FC = () => {
  const { db, refresh } = useStore()
  const [mode, setMode] = useState<ViewMode>('overview')
  const [impact, setImpact] = useState<ReturnType<typeof simulate> | null>(null)
  const [events, setEvents] = useState<DomainEvent[]>([])
  const [trace, setTrace] = useState<RetrievalTrace | null>(null)
  const [decision, setDecision] = useState<ReturnType<typeof evaluatePolicy> | null>(null)
  const [tour, setTour] = useState(() => currentTourStep())
  const [syncText, setSyncText] = useState('等待封存')
  const [verifyText, setVerifyText] = useState('尚未校验')

  const loadLocal = () => {
    refresh()
    setEvents(api.journalTimeline(12))
    setTrace(lastTrace())
    setTour(currentTourStep())
  }

  useDidShow(loadLocal)

  const stats = useMemo(() => {
    const sealed = events.filter((event) => event.syncStatus === 'sealed').length
    const pending = events.filter((event) => event.syncStatus === 'pending').length
    const failed = events.filter((event) => event.syncStatus === 'failed').length
    return { sealed, pending, failed }
  }, [events])

  const firstItem = db.libraries.flatMap((library) => library.items || [])[0]
  const firstPlan = db.plans.find((plan) => plan.status === 'pending')

  const runScenario = (scenario: Scenario) => {
    setMode('simulate')
    setImpact(simulate(db, scenario))
  }

  const runPolicy = () => {
    const item = firstItem || { id: 'demo-milk', name: '牛奶', qty: 1 }
    const proposal: AgentProposal = {
      id: 'policy-demo',
      title: '把「' + item.name + '」清零',
      summary: '删除类库存动作的策略演示',
      steps: [{
        id: 'step-1',
        kind: 'adjust_qty',
        targetId: item.id,
        label: item.name + '改为 0',
        qty: 0,
        evidenceRefs: ['item:' + item.id]
      }],
      impact: { expiringHandled: 1, shoppingAdded: 0, inventoryChanged: 1 }
    }
    const neutralImpact = simulate(db, { kind: 'set_budget', amount: db.budget })
    const role = (db.user?.role || '成员') as '管理员' | '成员' | '只读'
    setDecision(evaluatePolicy({
      actorRole: role,
      agentProposal: proposal,
      currentState: db,
      simulatedImpact: neutralImpact
    }))
    setMode('policy')
  }

  const seal = async () => {
    try {
      const result = await api.sealJournal()
      setSyncText(result.failed ? '封存 ' + result.sealed + ' 条，失败 ' + result.failed + ' 条' : '审计链已封存')
      loadLocal()
    } catch (e: any) {
      setSyncText(e.message || '封存失败')
    }
  }

  const verifyChain = async () => {
    try {
      const result = await verifyAuditChain(db.familyId || 'local')
      setVerifyText(result.valid ? '哈希链完整 · ' + result.checked + ' 条' : '哈希链在 ' + result.brokenAt + ' 断开')
    } catch (e: any) {
      setVerifyText(e.message || '校验失败')
    }
  }

  const undoLast = async () => {
    const target = events.find((event) =>
      event.type === 'item.qty_changed' ||
      event.type === 'item.deleted' ||
      event.type === 'plan.executed'
    )
    if (!target) {
      Taro.showToast({ title: '暂无可撤销事件', icon: 'none' })
      return
    }
    try {
      await useStore.getState().invoke(() => api.undoJournalEvent(target.id))
      Taro.showToast({ title: '已生成补偿事件', icon: 'success' })
      loadLocal()
    } catch (e: any) {
      Taro.showToast({ title: e.message || '撤销失败', icon: 'none' })
    }
  }

  const goTourNext = () => {
    if (!tour) return
    const next = advanceTour(tour.id)
    setTour(next)
    if (!next) return
    if (next.page === '/pages/home/index') Taro.switchTab({ url: next.page })
    else Taro.navigateTo({ url: next.page })
  }

  const closeTour = () => {
    stopTour()
    setTour(null)
  }

  const tourIndex = tour ? TOUR.findIndex((step) => step.id === tour.id) : -1

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <View className={styles.heroTop}>
          <View className={styles.heroTitle}>
            <Text>可信 AI 实验台</Text>
          </View>
          <Text className={styles.live}>代码事实 · 可审计</Text>
        </View>
        <Text className={styles.heroLine}>
          模型负责理解，代码负责事实、权限、推演与撤销。
        </Text>
        <View className={styles.facts}>
          <View className={styles.fact}>
            <Text className={styles.factNum}>{events.length}</Text>
            <Text className={styles.factLabel}>事件</Text>
          </View>
          <View className={styles.fact}>
            <Text className={styles.factNum}>{stats.sealed}</Text>
            <Text className={styles.factLabel}>已封存</Text>
          </View>
          <View className={styles.fact}>
            <Text className={styles.factNum}>{trace ? trace.evidenceCount : 0}</Text>
            <Text className={styles.factLabel}>证据</Text>
          </View>
        </View>
      </View>

      <View className={styles.tabs}>
        {VIEWS.map((view) => (
          <View
            key={view.id}
            className={classnames(styles.tab, mode === view.id && styles.tabOn)}
            onClick={() => setMode(view.id)}
          >
            <Text>{view.label}</Text>
          </View>
        ))}
      </View>

      {mode === 'overview' ? (
        <View className={styles.stack}>
          <View className={styles.section}>
            <View className={styles.sectionHead}>
              <Text className={styles.sectionTitle}>最近一次检索</Text>
              <Text className={styles.sectionMeta}>{trace ? trace.mode : '暂无轨迹'}</Text>
            </View>
            {trace ? (
              <>
                <Text className={styles.query}>“{trace.query}”</Text>
                <View className={styles.traceSteps}>
                  {trace.steps.map((step, index) => (
                    <View key={step.id} className={styles.traceStep}>
                      <Text className={styles.traceIndex}>{index + 1}</Text>
                      <Text className={styles.traceLabel}>{step.label}</Text>
                      <Text className={styles.traceCount}>{step.outputCount}</Text>
                    </View>
                  ))}
                </View>
                <Text className={styles.note}>
                  {trace.evidenceCount} 条证据 · {trace.pathIds.length} 条路径 · {trace.totalMs}ms
                  {trace.degraded ? ' · 已降级' : ''}
                </Text>
              </>
            ) : (
              <Text className={styles.empty}>先在 AI 工作台问一个问题，这里会出现答案的依据链。</Text>
            )}
          </View>

          <View className={styles.section}>
            <View className={styles.sectionHead}>
              <Text className={styles.sectionTitle}>5 分钟导览</Text>
              <Text className={styles.action} onClick={() => setTour(TOUR[0])}>开始</Text>
            </View>
            <Text className={styles.note}>
              从今日建议走到多源建档、What-if、权限沙箱和审计证据，不播放伪造演示。
            </Text>
          </View>
        </View>
      ) : null}

      {mode === 'simulate' ? (
        <View className={styles.stack}>
          <View className={styles.section}>
            <Text className={styles.sectionTitle}>在改数据前，先看影响</Text>
            <View className={styles.scenarios}>
              <View className={styles.scenario} onClick={() => runScenario({
                kind: 'buy', itemName: firstItem?.name || '牛奶', qty: 2, totalPrice: 20
              })}>
                <Text>再买 2 份{firstItem?.name || '牛奶'}</Text>
                <Text className={styles.scenarioMeta}>看预算与库存变化</Text>
              </View>
              <View className={styles.scenario} onClick={() => runScenario({
                kind: 'set_budget', amount: Math.max(0, Math.round(db.budget * 0.8))
              })}>
                <Text>预算收缩 20%</Text>
                <Text className={styles.scenarioMeta}>看是否仍可支撑</Text>
              </View>
              {firstPlan ? (
                <View className={styles.scenario} onClick={() => runScenario({ kind: 'consume', planId: firstPlan.id })}>
                  <Text>执行「{firstPlan.title}」</Text>
                  <Text className={styles.scenarioMeta}>看用料与缺口</Text>
                </View>
              ) : null}
            </View>
          </View>

          {impact ? (
            <View className={styles.section}>
              <View className={styles.sectionHead}>
                <Text className={styles.sectionTitle}>推演结果</Text>
                <Text className={styles.simTag}>仅推演</Text>
              </View>
              <View className={styles.compare}>
                {(Object.keys(impact.before) as Array<keyof typeof impact.before>).map((key) => (
                  <View key={key} className={styles.compareRow}>
                    <Text className={styles.compareLabel}>{metricLabel(key)}</Text>
                    <Text className={styles.compareBefore}>{impact.before[key]}</Text>
                    <Text className={styles.compareArrow}>→</Text>
                    <Text className={styles.compareAfter}>{impact.after[key]}</Text>
                    <Text className={classnames(
                      styles.delta,
                      impact.delta[key] > 0 ? styles.deltaUp : impact.delta[key] < 0 ? styles.deltaDown : ''
                    )}>
                      {impact.delta[key] > 0 ? '+' : ''}{impact.delta[key]}
                    </Text>
                  </View>
                ))}
              </View>
              {impact.warnings.length ? (
                <View className={styles.warnings}>
                  {impact.warnings.map((warning) => <Text key={warning}>！{warning}</Text>)}
                </View>
              ) : (
                <Text className={styles.note}>本次推演没有触发预算或库存告警。</Text>
              )}
            </View>
          ) : null}
        </View>
      ) : null}

      {mode === 'events' ? (
        <View className={styles.stack}>
          <View className={styles.section}>
            <View className={styles.sectionHead}>
              <Text className={styles.sectionTitle}>追加式事件日志</Text>
              <Text className={styles.action} onClick={seal}>封存</Text>
            </View>
            <Text className={styles.note}>
              {syncText} · 待同步 {stats.pending} · 失败 {stats.failed} · {verifyText}
            </Text>
            {events.length ? events.map((event) => (
              <View key={event.id} className={styles.eventRow}>
                <View className={classnames(
                  styles.eventDot,
                  event.syncStatus === 'sealed' ? styles.dotSealed : event.syncStatus === 'failed' ? styles.dotFailed : styles.dotPending
                )} />
                <View className={styles.eventBody}>
                  <Text className={styles.eventType}>{event.type}</Text>
                  <Text className={styles.eventId}>{event.id} · {event.actor}</Text>
                </View>
                <Text className={styles.eventTime}>
                  {new Date(event.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            )) : <Text className={styles.empty}>还没有事件。新建物品或调整数量后会自动记录。</Text>}
            <View className={styles.undoBtn} onClick={undoLast}>
              <Text>撤销最近可恢复事件</Text>
            </View>
            <View className={styles.undoBtn} onClick={verifyChain}>
              <Text>校验 SHA-256 哈希链</Text>
            </View>
          </View>
        </View>
      ) : null}

      {mode === 'policy' ? (
        <View className={styles.stack}>
          <View className={styles.section}>
            <View className={styles.sectionHead}>
              <Text className={styles.sectionTitle}>角色权限沙箱</Text>
              <Text className={styles.action} onClick={runPolicy}>运行样例</Text>
            </View>
            <Text className={styles.note}>当前角色：{db.user?.role || '成员'}。样例为库存清零动作，用于验证审批策略。</Text>
            {decision ? (
              <View className={styles.decision}>
                <View className={styles.decisionTop}>
                  <Text className={classnames(
                    styles.decisionState,
                    decision.allow ? styles.allow : styles.deny
                  )}>
                    {decision.allow ? '可进入确认' : '已拦截'}
                  </Text>
                  <Text className={styles.risk}>{decision.riskLevel} risk</Text>
                </View>
                {decision.blocked.map((reason) => <Text key={reason} className={styles.reason}>× {reason}</Text>)}
                {decision.reasons.map((reason) => <Text key={reason} className={styles.reason}>· {reason}</Text>)}
                <Text className={styles.approval}>审批要求：{decision.approval === 'none' ? '本人确认' : decision.approval === 'admin' ? '管理员确认' : '再次确认'}</Text>
              </View>
            ) : (
              <Text className={styles.empty}>点击“运行样例”，检查只读、成员和管理员的策略差异。</Text>
            )}
          </View>
        </View>
      ) : null}

      {tour ? (
        <TourTip
          step={tour}
          index={Math.max(0, tourIndex)}
          total={TOUR.length}
          onNext={goTourNext}
          onClose={closeTour}
        />
      ) : null}
    </View>
  )
}

export default LabPage
