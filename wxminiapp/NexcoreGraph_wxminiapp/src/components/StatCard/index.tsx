import React from 'react'
import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'
import classnames from 'classnames'

interface StatCardProps {
  label: string
  value: string
  unit?: string
  emoji: string
  color?: string
  onClick?: () => void
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, emoji, color, onClick }) => {
  return (
    <View
      className={classnames(styles.statCard, onClick && styles.clickable)}
      onClick={onClick}
      hoverClass={onClick ? styles.hover : undefined}
    >
      <View className={styles.icon} style={color ? { backgroundColor: color + '1A', color } : undefined}>
        <Text>{emoji}</Text>
      </View>
      <View className={styles.body}>
        <Text className={styles.value}>
          {value}
          {unit ? <Text className={styles.unit}> {unit}</Text> : null}
        </Text>
        <Text className={styles.label}>{label}</Text>
      </View>
    </View>
  )
}

export default StatCard
