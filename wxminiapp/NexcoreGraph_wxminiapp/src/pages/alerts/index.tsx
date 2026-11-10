import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import AlertItem from '@/components/AlertItem'
import EmptyState from '@/components/EmptyState'
import AppIcon from '@/components/AppIcon'
import styles from './index.module.scss'
import classnames from 'classnames'

const AlertsPage: React.FC = () => {
  const { db, refresh } = useStore()

  useDidShow(() => refresh())

  const danger = db.alerts.some((a) => a.tone === 'red')
  const warn = db.alerts.some((a) => a.tone === 'amber')
  const statusCls = danger ? styles.statusDanger : warn ? styles.statusWarn : styles.statusOk
  const statusTitle = danger ? '有紧急情况' : warn ? '有临期 / 待处理' : '库存健康'
  const statusDesc = danger ? '红色预警请立即处理' : warn ? '优先消耗临期食材' : '一切正常，继续保持'

  const resolve = async (id: string) => {
    try {
      await useStore.getState().invoke(() => api.resolveAlert(id))
      Taro.showToast({ title: '已处理', icon: 'success' })
    } catch (e: any) {
      console.error('[Alerts] resolve error:', e)
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }

  return (
    <View className={styles.page}>
      <View className={classnames(styles.statusCard, statusCls)}>
        <View className={styles.statusTitle}>
          <AppIcon name={danger ? 'warning' : 'check'} size={38} />
          <Text>{statusTitle}</Text>
        </View>
        <Text className={styles.statusDesc}>{statusDesc} · 共 {db.alerts.length} 条预警</Text>
      </View>

      <View className={styles.list}>
        {db.alerts.length === 0 ? (
          <EmptyState icon="check" text="暂无预警" sub="过期 / 临期 / 低库存 / 保修提醒会自动汇总到这里" />
        ) : (
          db.alerts.map((a) => (
            <AlertItem key={a.id} alert={a} onResolve={() => resolve(a.id)} />
          ))
        )}
      </View>
    </View>
  )
}

export default AlertsPage
