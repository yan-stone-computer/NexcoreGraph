import React, { useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import { briefingText } from '@/services/ai'
import { greetWord, toneColor } from '@/utils/format'
import StatCard from '@/components/StatCard'
import EmptyState from '@/components/EmptyState'
import styles from './index.module.scss'

const HomePage: React.FC = () => {
  const { db, stats, refresh } = useStore()

  useDidShow(() => {
    refresh()
    if (!useStore.getState().loggedIn) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  const trendMax = useMemo(() => {
    const all = [...stats.trend.consume, ...stats.trend.purchase]
    return Math.max(1, ...all)
  }, [stats])

  const go = (url: string) => Taro.navigateTo({ url })

  const showBriefing = () => {
    Taro.showModal({
      title: 'AI 简报',
      content: briefingText(),
      showCancel: false,
      confirmText: '知道了'
    })
  }

  const toggleDaily = (id: number) => {
    useStore.getState().invoke(() => api.toggleDaily(id)).catch((e) => console.error('[Home] toggleDaily:', e))
  }

  const quickEntries = [
    { emoji: '📷', label: '拍照入库', url: '/pages/intake/index' },
    { emoji: '📋', label: '方案', url: '/pages/plans/index' },
    { emoji: '🔔', label: '预警', url: '/pages/alerts/index' },
    { emoji: '🛒', label: '采购', url: '/pages/shopping/index' }
  ]

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <Text className={styles.greet}>{greetWord()}，{db.user?.name || '家人'}</Text>
        <Text className={styles.sub}>{new Date().getMonth() + 1} 月 {new Date().getDate()} 日 · 家庭空间：{db.family?.name || '—'}</Text>
      </View>

      <View className={styles.statsGrid}>
        <StatCard label="物品总数" value={String(stats.totalItems)} unit="件" emoji="📦" color="#A5803C" onClick={() => Taro.switchTab({ url: '/pages/library/index' })} />
        <StatCard label="临期提醒" value={String(stats.expiringN)} unit="件" emoji="⏰" color="#C03A2B" onClick={() => go('/pages/alerts/index')} />
        <StatCard label="低库存" value={String(stats.lowN)} unit="件" emoji="⚠️" color="#B9791F" onClick={() => go('/pages/alerts/index')} />
        <StatCard label="本月花费" value={'¥' + stats.spent} unit={'/ ¥' + stats.budget} emoji="💰" color="#2F7D4F" />
      </View>

      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>库存健康度</Text>
          <Text className={styles.healthValue}>{stats.health}%</Text>
        </View>
        <View className={styles.healthTrack}>
          <View className={styles.healthFill} style={{ width: stats.health + '%', backgroundColor: stats.health >= 80 ? '#2F7D4F' : stats.health >= 60 ? '#B9791F' : '#C03A2B' }} />
        </View>
        <View className={styles.healthMeta}>
          <Text className={styles.healthMetaItem}>方案完成 {stats.planPct}%（{stats.planDone}/{stats.planTotal}）</Text>
          <Text className={styles.healthMetaItem}>约可支撑 {stats.daysLeft} 天</Text>
          <Text className={styles.healthMetaItem}>最常消耗：{stats.topFood}</Text>
        </View>
      </View>

      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>近 7 天消耗 / 入库</Text>
        </View>
        <View className={styles.trendBars}>
          {stats.trend.labels.map((label, i) => (
            <View key={label + i} className={styles.trendCol}>
              <View className={styles.bars}>
                <View className={styles.barPurchase} style={{ height: Math.round((stats.trend.purchase[i] / trendMax) * 88) + 'rpx' }} />
                <View className={styles.barConsume} style={{ height: Math.round((stats.trend.consume[i] / trendMax) * 88) + 'rpx' }} />
              </View>
              <Text className={styles.trendLabel}>{label.replace('/', '')}</Text>
            </View>
          ))}
        </View>
        <View className={styles.legend}>
          <Text className={styles.legendItem}><Text className={styles.dotConsume} />消耗</Text>
          <Text className={styles.legendItem}><Text className={styles.dotPurchase} />入库</Text>
        </View>
      </View>

      <View className={styles.card} onClick={() => go('/pages/alerts/index')}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>预警摘要</Text>
          {db.alerts.length > 0 ? <Text className={styles.cardMore}>全部 {db.alerts.length} 条 ›</Text> : null}
        </View>
        {db.alerts.length === 0 ? (
          <EmptyState emoji="🎉" text="暂无预警，库存状态良好" />
        ) : (
          db.alerts.slice(0, 3).map((a) => (
            <View key={a.id} className={styles.alertRow}>
              <View className={styles.alertDot} style={{ backgroundColor: toneColor(a.tone) }} />
              <Text className={styles.alertText}>{a.text}</Text>
            </View>
          ))
        )}
      </View>

      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>今日待办</Text>
          <Text className={styles.briefBtn} onClick={showBriefing}>🤖 AI 简报</Text>
        </View>
        {db.daily.length === 0 ? (
          <EmptyState emoji="✅" text="今日暂无待办" />
        ) : (
          db.daily.map((t) => (
            <View key={t.id} className={styles.dailyRow} onClick={() => toggleDaily(t.id)}>
              <Text className={styles.checkbox}>{t.done ? '☑' : '☐'}</Text>
              <Text className={styles.dailyText}>{t.text}</Text>
            </View>
          ))
        )}
      </View>

      <View className={styles.quickGrid}>
        {quickEntries.map((q) => (
          <View key={q.url} className={styles.quickItem} onClick={() => go(q.url)} hoverClass={styles.quickHover}>
            <Text className={styles.quickEmoji}>{q.emoji}</Text>
            <Text className={styles.quickLabel}>{q.label}</Text>
          </View>
        ))}
      </View>
    </View>
  )
}

export default HomePage
