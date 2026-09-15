import React from 'react'
import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface EmptyStateProps {
  emoji?: string
  text: string
  sub?: string
}

const EmptyState: React.FC<EmptyStateProps> = ({ emoji = '📭', text, sub }) => {
  return (
    <View className={styles.empty}>
      <Text className={styles.emoji}>{emoji}</Text>
      <Text className={styles.text}>{text}</Text>
      {sub ? <Text className={styles.sub}>{sub}</Text> : null}
    </View>
  )
}

export default EmptyState
