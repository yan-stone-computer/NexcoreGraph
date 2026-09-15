import React from 'react'
import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'
import { toneColor } from '@/utils/format'
import type { Alert } from '@/types'

interface AlertItemProps {
  alert: Alert
  onResolve: () => void
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve }) => {
  const color = toneColor(alert.tone)
  return (
    <View className={styles.alertItem}>
      <View className={styles.dot} style={{ backgroundColor: color }} />
      <View className={styles.body}>
        <Text className={styles.text}>{alert.text}</Text>
        <Text className={styles.meta}>{alert.meta}</Text>
      </View>
      <View className={styles.resolve} onClick={onResolve} hoverClass={styles.resolveHover}>
        <Text className={styles.resolveText}>处理</Text>
      </View>
    </View>
  )
}

export default AlertItem
