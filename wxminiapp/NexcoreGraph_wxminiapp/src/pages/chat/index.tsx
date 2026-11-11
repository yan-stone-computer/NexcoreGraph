import React, { useState } from 'react'
import { View, Text, Input, ScrollView } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api, nowTime } from '@/services/api'
import { reply } from '@/services/ai'
import AppIcon from '@/components/AppIcon'
import type { ChatMsg } from '@/types'
import styles from './index.module.scss'
import classnames from 'classnames'

const SUGGESTIONS = ['今晚吃什么', '牛奶还能放几天', '鸡蛋放哪了', '鸡蛋只剩 5 个', '想买 2 盒牛奶']

const ChatPage: React.FC = () => {
  const { db, refresh } = useStore()
  const [text, setText] = useState('')
  const [typing, setTyping] = useState(false)
  const [scrollAnchor, setScrollAnchor] = useState('')

  useDidShow(() => refresh())

  const scrollToBottom = () => {
    setTimeout(() => {
      setScrollAnchor('chatBottom-' + Date.now())
    }, 60)
  }
  const goPlans = () => Taro.navigateTo({ url: '/pages/plans/index' })
  const goShopping = () => Taro.navigateTo({ url: '/pages/shopping/index' })

  const pushAi = (m: ChatMsg) => {
    api.chatPush(m)
    refresh()
  }

  const send = async (raw?: string) => {
    const t = (raw ?? text).trim()
    if (!t || typing) return
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
      console.error('[Chat] reply error:', e)
      pushAi({ who: 'ai', text: '出错了：' + ((e as any).message || '未知错误'), time: nowTime() })
    } finally {
      setTyping(false)
      scrollToBottom()
    }
  }

  const confirmCard = async (msg: ChatMsg, idx: number) => {
    const c = msg.card
    if (!c || c.done || c.cancelled) return
    const stored = db.chat[idx]
    try {
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
      console.error('[Chat] card confirm error:', e)
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
          <View className={styles.cardTitleLabel}>
            <AppIcon name={c.type === 'adjust' ? 'plans' : 'shopping'} size={24} />
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
          <AppIcon name="plans" size={24} />
          <Text>{'查看 ' + msg.plans.length + ' 个方案 ›'}</Text>
        </View>
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <View className={styles.head}>
        <View className={styles.headTitle}>
          <AppIcon name="ai" size={38} />
          <Text className={styles.headName}>AI 助手</Text>
        </View>
        <View className={styles.headBtns}>
          <View className={styles.headBtn} onClick={goPlans}><Text>方案</Text></View>
          <View className={styles.headBtn} onClick={goShopping}><Text>采购</Text></View>
          <View className={styles.headBtn} onClick={clearChat}><Text>清空</Text></View>
        </View>
      </View>

      <ScrollView
        className={styles.listWrap}
        scrollY
        scrollIntoView={scrollAnchor}
        scrollWithAnimation
      >
        <View className={styles.list}>
          {db.chat.map((m, i) => (
            <View key={i} className={classnames(styles.msg, m.who === 'me' && styles.msgMe)}>
              <View className={classnames(styles.avatar, m.who === 'ai' ? styles.avatarAi : styles.avatarMe)}>
                <Text>{m.who === 'ai' ? '✦' : (db.user?.initial || '我')}</Text>
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
                  {m.who === 'ai' && m.src ? <Text className={styles.srcNote}>{m.src}</Text> : null}
                </View>
              </View>
            </View>
          ))}
          {typing ? (
            <View className={styles.msg}>
              <View className={classnames(styles.avatar, styles.avatarAi)}><Text>✦</Text></View>
              <View className={styles.body}>
                <View className={classnames(styles.bubble, styles.bubbleAi, styles.typingMsg)}>
                  <Text className={styles.typingLabel}>正在查库存组织语言</Text>
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
          <Text>发送</Text>
        </View>
      </View>
    </View>
  )
}

export default ChatPage
