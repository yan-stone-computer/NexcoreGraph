import React from 'react'
import { View, Text } from '@tarojs/components'
import AppIcon, { type IconName } from '@/components/AppIcon'
import styles from './index.module.scss'
import classnames from 'classnames'

interface StatCardProps {
  label: string
  value: string
  unit?: string
  icon: IconName
  color?: string
  onClick?: () => void
  wide?: boolean
}

const StatCard: React.FC<StatCardProps> = ({ label, value, unit, icon, color, onClick, wide }) => {
  return (
    <View
      className={classnames(styles.statCard, wide && styles.wide, onClick && styles.clickable)}
      onClick={onClick}
      hoverClass={onClick ? styles.hover : undefined}
    >
      <View className={styles.icon} style={color ? { backgroundColor: color + '1A', color } : undefined}>
        <AppIcon name={icon} size={38} />
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
