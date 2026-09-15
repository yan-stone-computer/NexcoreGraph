import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import EmptyState from '@/components/EmptyState'
import styles from './index.module.scss'

const ShoppingPage: React.FC = () => {
  const { db, refresh } = useStore()

  useDidShow(() => refresh())

  const regenerate = async () => {
    try {
      const list = await useStore.getState().invoke(() => api.shoppingList())
      Taro.showToast({ title: '已按缺料 / 低库存刷新', icon: 'success' })
      if (!list.length) Taro.showToast({ title: '暂无缺料，很健康', icon: 'none' })
    } catch (e: any) {
      console.error('[Shopping] list error:', e)
      Taro.showToast({ title: e.message || '刷新失败', icon: 'none' })
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.head}>
        <View>
          <Text className={styles.headTitle}>采购清单 · {db.shopping.length}</Text>
          <Text className={styles.headSub}>由方案缺料 + 低库存自动汇总，AI 对话也可添加</Text>
        </View>
        <View className={styles.refreshBtn} onClick={regenerate} hoverClass={styles.refreshBtnHover}><Text>↻ 刷新汇总</Text></View>
      </View>

      <View className={styles.list}>
        {db.shopping.length === 0 ? (
          <EmptyState emoji="🛒" text="采购清单是空的" sub="生成方案后缺料会自动汇总到这里" />
        ) : (
          db.shopping.map((s, i) => (
            <View key={i} className={styles.row}>
              <View className={styles.rowEmoji}><Text>🛒</Text></View>
              <View className={styles.rowBody}>
                <Text className={styles.rowName}>{s.name}</Text>
                <Text className={styles.rowSrc}>{s.src}</Text>
              </View>
              <Text className={styles.rowQty}>{s.qty}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

export default ShoppingPage
