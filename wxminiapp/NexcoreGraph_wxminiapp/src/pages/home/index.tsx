import React, { useMemo, useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import { briefingText } from '@/services/ai'
import { graphBrief } from '@/services/graph'
import { greetWord, toneColor } from '@/utils/format'
import EmptyState from '@/components/EmptyState'
import AppIcon, { type IconName } from '@/components/AppIcon'
import pantry from '@/assets/photos/pantry.webp'
import TourTip from '@/components/TourTip'
import { TOUR, type TourStep } from '@/services/demoTour'
import { advanceTour, currentTourStep, startTour, stopTour } from '@/services/tourStore'
import styles from './index.module.scss'

const HomePage: React.FC = () => {
  const { db, stats, refresh } = useStore()
  const [tour, setTour] = useState<TourStep | null>(() => currentTourStep())

  useDidShow(() => {
    refresh()
    setTour(currentTourStep())
    if (!useStore.getState().loggedIn) {
      Taro.reLaunch({ url: '/pages/login/index' })
    }
  })

  /* MX6：分享卡片带图谱快照统计（数字全部代码计算），落地页直达工作台 */
  useShareAppMessage(() => {
    let title = '启核图策 · 家庭资源管家'
    try {
      const b = graphBrief()
      title = '启核图策 · ' + b.libs + ' 库 ' + b.items + ' 件 · 本周 ' + b.expiringN + ' 项临期'
    } catch (e) { /* 图谱未就绪时用默认标题 */ }
    return {
      title,
      path: '/pages/workbench/index'
    }
  })

  const trendMax = useMemo(() => {
    const all = [...stats.trend.consume, ...stats.trend.purchase]
    return Math.max(1, ...all)
  }, [stats])

  const go = (url: string) => Taro.navigateTo({ url })

  const beginGuide = () => setTour(startTour())

  const nextGuide = () => {
    if (!tour) return
    const next = advanceTour(tour.id)
    setTour(next)
    if (next) Taro.navigateTo({ url: next.page })
  }

  const closeGuide = () => {
    stopTour()
    setTour(null)
  }

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

  const quickEntries: { icon: IconName; label: string; url: string }[] = [
    { icon: 'camera', label: '拍照入库', url: '/pages/intake/index' },
    { icon: 'plans', label: '方案', url: '/pages/plans/index' },
    { icon: 'alerts', label: '预警', url: '/pages/alerts/index' },
    { icon: 'shopping', label: '采购', url: '/pages/shopping/index' }
  ]

  return (
    <View className={styles.page}>
      <View className={styles.header}>
        <View className={styles.headerTop}>
          <View className={styles.headerText}>
            <Text className={styles.greet}>{greetWord()}，{db.user?.name || '家人'}</Text>
            <Text className={styles.sub}>{new Date().getMonth() + 1} 月 {new Date().getDate()} 日 · 家庭空间：{db.family?.name || '—'}</Text>
          </View>
          <View className={styles.tourBtn} onClick={beginGuide}>
            <AppIcon name="ai" size={24} />
            <Text>3 分钟导览</Text>
          </View>
        </View>
      </View>

      <View className={styles.heroCard}>
        <Image className={styles.heroImage} src={pantry} mode="aspectFill" />
        <View className={styles.heroOverlay} />
        <View className={styles.heroContent}>
          <View className={styles.heroBrand}>
            <View className={styles.heroMark}><AppIcon name="ai" size={28} /></View>
            <Text>家庭资源实时视图</Text>
          </View>
          <Text className={styles.heroTitle}>
            {stats.totalItems} 件资源，{stats.expiringN} 件临期
          </Text>
          <Text className={styles.heroSub}>
            {db.libraries.length} 个资源库 · 健康度 {stats.health}% · 本月已用 ¥{stats.spent}
          </Text>
          <View className={styles.heroMetrics}>
            <View className={styles.heroMetric} onClick={() => go('/pages/alerts/index')}>
              <Text className={styles.heroMetricValue}>{stats.lowN}</Text>
              <Text className={styles.heroMetricLabel}>低库存</Text>
            </View>
            <View className={styles.heroMetric} onClick={() => go('/pages/plans/index')}>
              <Text className={styles.heroMetricValue}>{stats.planPct}%</Text>
              <Text className={styles.heroMetricLabel}>方案完成</Text>
            </View>
            <View className={styles.heroMetric}>
              <Text className={styles.heroMetricValue}>{stats.daysLeft}</Text>
              <Text className={styles.heroMetricLabel}>预计可用天数</Text>
            </View>
          </View>
          <View className={styles.heroAction} onClick={() => Taro.switchTab({ url: '/pages/workbench/index' })}>
            <Text>问问 AI 今天怎么安排</Text>
            <AppIcon name="send" size={24} />
          </View>
        </View>
      </View>

      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>库存健康度</Text>
          <Text className={styles.healthValue}>{stats.health}%</Text>
        </View>
        <View className={styles.healthTrack}>
          <View className={styles.healthFill} style={{ width: stats.health + '%', backgroundColor: stats.health >= 80 ? '#5B893B' : stats.health >= 60 ? '#B87D16' : '#C53D3D' }} />
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

      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>库存构成</Text>
          <Text className={styles.cardMore}>共 {db.libraries.length} 个库</Text>
        </View>
        {db.libraries.length === 0 ? (
          <EmptyState icon="package" text="还没有资源库，先拍照入库或新建一个" />
        ) : (
          db.libraries.map((l) => (
            <View key={l.id} className={styles.alertRow}>
              <View className={styles.alertDot} style={{ backgroundColor: '#57D794' }} />
              <Text className={styles.alertText}>{l.name}</Text>
              <Text className={styles.cardMore}>{(l.items || []).length} 件</Text>
            </View>
          ))
        )}
      </View>

      <View className={styles.card} onClick={() => go('/pages/alerts/index')}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>预警摘要</Text>
          {db.alerts.length > 0 ? <Text className={styles.cardMore}>全部 {db.alerts.length} 条 ›</Text> : null}
        </View>
        {db.alerts.length === 0 ? (
          <EmptyState icon="check" text="暂无预警，库存状态良好" />
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
          <View className={styles.briefBtn} onClick={showBriefing}>
            <AppIcon name="ai" size={24} /><Text>AI 简报</Text>
          </View>
        </View>
        {db.daily.length === 0 ? (
          <EmptyState icon="check" text="今日暂无待办" />
        ) : (
          db.daily.map((t) => (
            <View key={t.id} className={styles.dailyRow} onClick={() => toggleDaily(t.id)}>
              <View className={styles.checkbox}>{t.done ? <AppIcon name="check" size={24} /> : null}</View>
              <Text className={styles.dailyText}>{t.text}</Text>
            </View>
          ))
        )}
      </View>

      <View className={styles.quickGrid}>
        {quickEntries.map((q) => (
          <View key={q.url} className={styles.quickItem} onClick={() => go(q.url)} hoverClass={styles.quickHover}>
            <AppIcon name={q.icon} size={46} />
            <Text className={styles.quickLabel}>{q.label}</Text>
          </View>
        ))}
      </View>
      {tour?.id === 'today' ? (
        <TourTip
          step={tour}
          index={TOUR.findIndex((step) => step.id === tour.id)}
          total={TOUR.length}
          onNext={nextGuide}
          onClose={closeGuide}
        />
      ) : null}
    </View>
  )
}

export default HomePage
