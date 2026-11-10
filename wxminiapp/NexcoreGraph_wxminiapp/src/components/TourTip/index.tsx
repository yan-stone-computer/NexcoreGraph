import React from 'react'
import { Text, View } from '@tarojs/components'
import type { TourStep } from '@/services/demoTour'
import styles from './index.module.scss'

interface Props {
  step: TourStep
  index: number
  total: number
  onNext: () => void
  onClose: () => void
}

const TourTip: React.FC<Props> = ({ step, index, total, onNext, onClose }) => (
  <View className={styles.mask}>
    <View className={styles.sheet}>
      <View className={styles.top}>
        <Text className={styles.count}>{index + 1} / {total}</Text>
        <Text className={styles.close} onClick={onClose}>退出导览</Text>
      </View>
      <Text className={styles.title}>{step.title}</Text>
      <Text className={styles.body}>{step.body}</Text>
      <View className={styles.next} onClick={onNext}>
        <Text>{step.nextLabel}</Text>
      </View>
    </View>
  </View>
)

export default TourTip
