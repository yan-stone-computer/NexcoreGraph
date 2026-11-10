import React from 'react'
import { View, Text } from '@tarojs/components'
import AppIcon, { type IconName } from '@/components/AppIcon'
import styles from './index.module.scss'

interface EmptyStateProps {
  icon?: IconName
  text: string
  sub?: string
}

const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'package', text, sub }) => {
  return (
    <View className={styles.empty}>
      <AppIcon name={icon} size={64} />
      <Text className={styles.text}>{text}</Text>
      {sub ? <Text className={styles.sub}>{sub}</Text> : null}
    </View>
  )
}

export default EmptyState
