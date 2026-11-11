// 启核图策 · AI 工作台首屏（M-A1：原 chat 页升级，置 tabBar 首位）
// 结构：图谱摘要条 + 今日待确认队列 + 对话 + 快捷指令 + 图谱入口
// MX5：支持 libId/itemId/q 页面参数（从库详情进入时带入 AI 上下文）
import React, { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { say as sayTts } from '@/services/livesync'
import { useGraphStore } from '@/store/useGraphStore'
import { api, nowTime } from '@/services/api'
import { reply } from '@/services/ai'
import { ensureSummaries } from '@/services/graphRag'
import { snapshot } from '@/services/graph'
import { consumeAiWorkbenchContext } from '@/services/aiContext'
import { evaluatePolicy, type AgentProposal } from '@/services/policy'
import { simulate } from '@/services/simulation'
import AppIcon from '@/components/AppIcon'
import BrandHeader from '@/components/BrandHeader'
import type { ChatMsg } from '@/types'
import styles from './index.module.scss'
import classnames from 'classnames'

const SUGGESTIONS = ['今晚吃什么', '这周最该先处理什么', '明天降温怎么穿', '用临期食材做减脂晚餐，缺什么一起去买']

/* 摘要离线预计算只触发一次（10 分钟限流在 graphRag 内部控制） */
let summaryJobStarted = false

const WorkbenchPage: React.FC = () => {
  const { db, refresh } = useStore()
  const { brief, refresh: refreshGraph } = useGraphStore()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [scrollAnchor, setScrollAnchor] = useState('')
  const [ctxLibId, setCtxLibId] = useState('')
  const [, setPendingQ] = useState('')

  useDidShow(() => {
    refresh()
    refreshGraph()
    /* tabBar 页面通过暂存区接收 MX5 页面级上下文与预填问题 */
    const pendingContext = consumeAiWorkbenchContext()
    if (pendingContext?.libId) setCtxLibId(pendingContext.libId)
    if (pendingContext?.query) setPendingQ(pendingContext.query)
    /* 兼容非 tabBar 启动链传来的页面参数 */
    const params = Taro.getCurrentInstance().router?.params || {}
    if (params.libId) setCtxLibId(String(params.libId))
    if (params.q) setPendingQ(String(params.q))
    const initialQuery = pendingContext?.query || (params.q ? String(params.q) : '')
    if (initialQuery) {
      setPendingQ('')
      setTimeout(() => send(initialQuery), 80)
    }
    /* 首开触发社区摘要离线预计算（不阻塞对话，fire-and-forget） */
    if (!summaryJobStarted) {
      summaryJobStarted = true
      ensureSummaries().then(() => refreshGraph()).catch(() => { /* 降级：摘要缺失不影响回答 */ })
    }
    if (db.chat.length) setTimeout(scrollToBottom, 80)
  })

  const ctxLibName = ctxLibId ? (db.libraries.filter((l) => l.id === ctxLibId)[0] || { name: ctxLibId }).name : ''
  const freshSummary = (() => {
    const doc = (() => { try { return snapshot() } catch (e) { return null } })()
    if (!doc) return null
    const l1 = doc.communities.filter((c) => c.level === 1)
    for (let i = 0; i < l1.length; i++) {
      const s = doc.summaries.filter((x) => x.community === l1[i].id && !x.stale)[0]
      if (s) return s
    }
    return null
  })()

  const scrollToBottom = () => {
    setTimeout(() => { setScrollAnchor('chatBottom-' + Date.now()) }, 60)
  }
  const goPlans = () => Taro.navigateTo({ url: '/pages/plans/index' })

  /* 语音播报：走自建后端 /api/ai/tts；后端没配 TTS_ENDPOINT 时给出明确提示 */
  const speak = async (t: string) => {
    const ok = await sayTts(t)
    if (!ok) Taro.showToast({ title: 'TTS 未配置（后端设置 TTS_ENDPOINT）', icon: 'none' })
  }
  const goShopping = () => Taro.navigateTo({ url: '/pages/shopping/index' })
  const goGraph = () => Taro.navigateTo({ url: '/pages/graph/index' })
  const goAlerts = () => Taro.navigateTo({ url: '/pages/alerts/index' })

  const pushAi = (m: ChatMsg) => {
    api.chatPush(m)
    refresh()
  }

  async function send(raw?: string) {
    let t = (raw ?? text).trim()
    if (!t || typing) return
    /* MX5：带库上下文且问题未点名库时，拼接上下文（支撑「这个库还能撑几天」指代解析） */
    if (ctxLibName && db.libraries.some((l) => l.name === ctxLibName) && t.indexOf(ctxLibName) < 0) {
      t = t + '（在「' + ctxLibName + '」里）'
    }
    setText('')
    api.chatPush({ who: 'me', text: t, time: nowTime() })
    refresh()
    setTyping(true)
    scrollToBottom()
    try {
      const r = await reply(t)
      if (r.card) {
        pushAi({ who: 'ai', text: r.text, time: nowTime(), card: r.card, model: r.model, src: r.src })
      } else if (r.action === 'generatePlans') {
        pushAi({ who: 'ai', text: r.text, time: nowTime(), model: r.model, src: r.src })
        const plans = await api.generatePlans()
        pushAi({ who: 'ai', text: '已生成 ' + plans.length + ' 个方案（临期优先 > 清库存 > 营养均衡），点击下方卡片可查看并核销：', time: nowTime(), plans: plans.map((p) => p.id), model: true, src: r.src })
      } else if (r.action === 'creative') {
        pushAi({ who: 'ai', text: r.text, time: nowTime(), model: r.model, src: r.src })
        const plan = await api.creativeRecipe()
        pushAi({ who: 'ai', text: '创新菜谱「' + plan.title + '」已加入方案列表，可去方案页勾选核销：', time: nowTime(), plans: [plan.id], model: true, src: r.src })
      } else {
        pushAi({ who: 'ai', text: r.text, time: nowTime(), model: r.model, src: r.src })
      }
    } catch (e) {
      console.error('[Workbench] reply error:', e)
      pushAi({ who: 'ai', text: '出错了：' + ((e as any).message || '未知错误'), time: nowTime() })
    } finally {
      setTyping(false)
      scrollToBottom()
    }
  }

  const toggleDaily = (id: number) => {
    useStore.getState().invoke(() => api.toggleDaily(id)).catch((e) => console.error('[Workbench] toggleDaily:', e))
  }

  const askAboutLib = () => {
    if (ctxLibId) send('这个库还能撑几天')
  }

  const confirmCard = async (msg: ChatMsg, idx: number) => {
    const c = msg.card
    if (!c || c.done || c.cancelled) return
    const stored = db.chat[idx]
    try {
      const role = (db.user?.role === '家庭管理员' ? '管理员' : db.user?.role) as '管理员' | '成员' | '只读'
      const proposal: AgentProposal = {
        id: 'chat-card-' + idx,
        title: c.type === 'adjust' ? '调整库存' : '加入采购清单',
        summary: c.reason || '对话确认卡',
        steps: c.type === 'adjust'
          ? [{
            id: 'step-1',
            kind: 'adjust_qty',
            targetId: c.itemId || c.name,
            label: c.name,
            qty: c.to,
            evidenceRefs: ['card:' + idx]
          }]
          : [{
            id: 'step-1',
            kind: 'add_shopping',
            targetId: c.name,
            label: c.name,
            evidenceRefs: ['card:' + idx]
          }],
        impact: {
          expiringHandled: 0,
          shoppingAdded: c.type === 'shopping_add' ? 1 : 0,
          inventoryChanged: c.type === 'adjust' ? 1 : 0
        }
      }
      const decision = evaluatePolicy({
        actorRole: role,
        agentProposal: proposal,
        currentState: db,
        simulatedImpact: simulate(db, { kind: 'set_budget', amount: db.budget })
      })
      if (!decision.allow) {
        Taro.showModal({
          title: '策略已拦截',
          content: decision.blocked.join('\n'),
          showCancel: false
        })
        return
      }
      if (decision.approval === 'admin' && role !== '管理员') {
        Taro.showModal({
          title: '需要管理员确认',
          content: decision.reasons.join('\n') || '该动作涉及高风险库存变更。',
          showCancel: false
        })
        return
      }
      const invoke = useStore.getState().invoke
      if (c.type === 'adjust' && c.itemId != null && c.from != null && c.to != null) {
        await invoke(() => api.updateItemQty(c.itemId!, c.to! - c.from!))
      } else if (c.type === 'shopping_add') {
        await invoke(() => api.shoppingAdd(c.name, c.qty || '1'))
      }
      if (stored && stored.card) stored.card.done = true
      api.touchChat()
      refresh()
      Taro.showToast({ title: '已生效', icon: 'success' })
    } catch (e: any) {
      console.error('[Workbench] card confirm error:', e)
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }

  const cancelCard = (_msg: ChatMsg, idx: number) => {
    const stored = db.chat[idx]
    if (stored && stored.card) stored.card.cancelled = true
    api.touchChat()
    refresh()
  }

  const clearChat = async () => {
    const r = await Taro.showModal({ title: '清空对话', content: '仅清除本机对话记录（本地存储，≤200 条）。', confirmColor: '#C53D3D' })
    if (r.confirm) {
      await useStore.getState().invoke(() => api.chatClear())
      Taro.showToast({ title: '已清空', icon: 'success' })
    }
  }

  const renderCard = (msg: ChatMsg, idx: number) => {
    const c = msg.card
    if (!c) return null
    return (
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <View className={styles.inlineIconLabel}>
            <AppIcon name={c.type === 'adjust' ? 'plans' : 'shopping'} size={28} />
            <Text>{c.type === 'adjust' ? '库存调整预览' : '加入采购清单预览'}</Text>
          </View>
          <Text className={styles.cardReason}>{c.type === 'adjust' ? '（F5.5 先预览后生效）' : '（P0-2 shopping_add）'}</Text>
        </View>
        <Text className={styles.cardRow}>
          {c.type === 'adjust'
            ? (<>{c.name}：{c.from} → <Text className={styles.cardNum}>{c.to}</Text> {c.unit}{c.lib ? ' · ' + c.lib : ''}</>)
            : (<>{c.name} · {c.qty}</>)}
        </Text>
        {c.reason ? <Text className={styles.cardReason}>{c.reason}</Text> : null}
        {c.done ? (
          <View className={styles.doneBadge}>
            <AppIcon name="check" size={22} />
            <Text>已生效</Text>
          </View>
        ) : c.cancelled ? (
          <Text className={styles.cancelledBadge}>已取消</Text>
        ) : (
          <View className={styles.cardActions}>
            <View className={styles.confirmBtn} onClick={() => confirmCard(msg, idx)} hoverClass={styles.sugHover}>
              <Text>确认生效</Text>
            </View>
            <View className={styles.cancelBtn} onClick={() => cancelCard(msg, idx)} hoverClass={styles.sugHover}>
              <Text>取消</Text>
            </View>
          </View>
        )}
      </View>
    )
  }

  const renderPlans = (msg: ChatMsg) => {
    if (!msg.plans || !msg.plans.length) return null
    return (
      <View className={styles.planChips}>
        <View className={styles.planChip} onClick={goPlans} hoverClass={styles.planChipHover}>
          <View className={styles.inlineIconLabel}>
            <AppIcon name="plans" size={26} />
            <Text>{'查看 ' + msg.plans.length + ' 个方案 ›'}</Text>
          </View>
        </View>
      </View>
    )
  }

  const undone = (db.daily || []).filter((t) => !t.done)

  return (
    <View className={styles.page}>
      <BrandHeader />
      <View className={styles.head}>
        <View className={styles.headTitle}>
          <AppIcon name="ai" size={54} />
          <Text className={styles.headName}>AI 工作台</Text>
        </View>
        <View className={styles.headBtns}>
          <View className={styles.headBtn} onClick={goGraph}><AppIcon name="graph" size={26} /><Text>图谱</Text></View>
          <View className={styles.headBtn} onClick={goPlans}><AppIcon name="plans" size={26} /><Text>方案</Text></View>
          <View className={styles.headBtn} onClick={goShopping}><AppIcon name="shopping" size={26} /><Text>采购</Text></View>
          <View className={styles.headBtn} onClick={clearChat}><AppIcon name="trash" size={26} /><Text>清空</Text></View>
        </View>
      </View>

      <ScrollView
        className={styles.contentScroll}
        scrollY
        scrollIntoView={scrollAnchor}
        scrollWithAnimation
      >
        {/* 图谱摘要条（数字全部代码计算；摘要仅新鲜可引用） */}
        <View className={styles.summary} onClick={goGraph} hoverClass={styles.sugHover}>
          <View className={styles.summaryKicker}><Text>资源图谱 · 实时摘要</Text></View>
          <Text className={styles.summaryMain}>
            {brief
              ? brief.libs + ' 库 ' + brief.items + ' 件 · 临期 ' + brief.expiringN + ' 项 · 图谱 ' + brief.nodes + ' 节点/' + brief.edges + ' 边'
              : '图谱构建中…'}
          </Text>
          {freshSummary ? (
            <Text className={styles.summarySub}>
              摘要：{freshSummary.text}（{Math.max(1, Math.round((Date.now() - freshSummary.generatedAt) / 60000))} 分钟前图谱 · Agnes 预计算）
            </Text>
          ) : (
            <Text className={styles.summarySub}>社区摘要预计算中（离线生成，不占用对话次数）</Text>
          )}
        </View>

        {/* MX5 上下文标签 */}
        {ctxLibName ? (
          <View className={styles.ctxRow} onClick={askAboutLib} hoverClass={styles.sugHover}>
            <Text className={styles.ctxTag}>上下文：{ctxLibName}</Text>
            <Text className={styles.ctxAsk}>问「这个库还能撑几天」›</Text>
          </View>
        ) : null}

        {/* 今日待确认队列（预警引擎产出，点选完成） */}
        <View className={styles.queue}>
          <View className={styles.queueHead}>
            <Text className={styles.queueTitle}>今日待确认</Text>
            <Text className={styles.queueMore} onClick={goAlerts}>{'预警 ' + (db.alerts || []).length + ' 条 ›'}</Text>
          </View>
          {undone.length ? undone.map((t) => (
            <View key={t.id} className={styles.queueItem} onClick={() => toggleDaily(t.id)} hoverClass={styles.sugHover}>
              <Text className={styles.queueDot}>!</Text>
              <Text className={styles.queueText}>{t.text}</Text>
              <Text className={styles.queueDone}>完成</Text>
            </View>
          )) : (
            <View className={styles.queueItem}><Text className={styles.queueEmpty}>今日预警已处理完毕 ✓</Text></View>
          )}
        </View>
        <View className={styles.list}>
          {db.chat.map((m, i) => (
            <View key={i} className={classnames(styles.msg, m.who === 'me' && styles.msgMe)}>
              <View className={classnames(styles.avatar, m.who === 'ai' ? styles.avatarAi : styles.avatarMe)}>
                {m.who === 'ai' ? <AppIcon name="ai" size={34} /> : <Text>{db.user?.initial || '我'}</Text>}
              </View>
              <View className={classnames(styles.body, m.who === 'me' && styles.bodyMe)}>
                <View className={classnames(styles.bubble, m.who === 'ai' ? styles.bubbleAi : styles.bubbleMe)}>
                  <Text>{m.text}</Text>
                </View>
                {renderCard(m, i)}
                {renderPlans(m)}
                <View className={styles.meta}>
                  <Text className={styles.time}>{m.time}</Text>
                  {m.who === 'ai' ? <Text className={styles.aiTag}>AI 生成</Text> : null}
                  {m.who === 'ai' ? (
                    <Text
                      className={styles.metaLink}
                      onClick={() => speak(m.text)}
                    >
                      <AppIcon name="volume" size={22} />
                      <Text> 播报</Text>
                    </Text>
                  ) : null}
                  {m.who === 'ai' && m.src ? <Text className={styles.srcNote}>{m.src}</Text> : null}
                  {m.who === 'ai' ? (
                    <Text
                      className={styles.metaLink}
                      onClick={() => Taro.navigateTo({ url: '/pages/lab/index' })}
                    >
                      看依据
                    </Text>
                  ) : null}
                </View>
              </View>
            </View>
          ))}
          {typing ? (
            <View className={styles.msg}>
              <View className={classnames(styles.avatar, styles.avatarAi)}><AppIcon name="ai" size={34} /></View>
              <View className={styles.body}>
                <View className={classnames(styles.bubble, styles.bubbleAi, styles.typingMsg)}>
                  <Text className={styles.typingLabel}>正在检索图谱证据</Text>
                  <Text className={styles.typingDot} />
                  <Text className={styles.typingDot} />
                  <Text className={styles.typingDot} />
                </View>
              </View>
            </View>
          ) : null}
          <View id={scrollAnchor || 'chatBottom'} />
        </View>
      </ScrollView>

      <View className={styles.suggestions}>
        {SUGGESTIONS.map((s) => (
          <View key={s} className={styles.sugChip} onClick={() => send(s)} hoverClass={styles.sugHover}>
            <Text>{s}</Text>
          </View>
        ))}
      </View>

      <View className={styles.inputBar}>
        <Input
          className={styles.inputBox}
          value={text}
          placeholder="问点什么，或说「鸡蛋只剩 5 个」"
          placeholderClass={styles.inputPlaceholder}
          confirmType="send"
          onInput={(e) => setText(e.detail.value)}
          onConfirm={() => send()}
        />
        <View className={classnames(styles.sendBtn, !text.trim() && styles.sendDisabled)} onClick={() => send()} hoverClass={styles.sugHover}>
          <AppIcon name="send" size={28} />
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}

export default WorkbenchPage
