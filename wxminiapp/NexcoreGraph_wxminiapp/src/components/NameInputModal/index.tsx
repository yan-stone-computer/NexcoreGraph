import React, { useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import styles from './index.module.scss'

interface Props {
  visible: boolean
  title: string
  placeholder: string
  initial?: string
  onCancel: () => void
  onConfirm: (value: string) => void
}

const NameInputModal: React.FC<Props> = ({ visible, title, placeholder, initial = '', onCancel, onConfirm }) => {
  const [value, setValue] = useState(initial)

  if (!visible) return null

  return (
    <View className={styles.mask} onClick={onCancel}>
      <View className={styles.card} onClick={(e) => e.stopPropagation()}>
        <Text className={styles.title}>{title}</Text>
        <Input
          className={styles.input}
          value={value}
          placeholder={placeholder}
          placeholderClass={styles.placeholder}
          focus
          onInput={(e) => setValue(e.detail.value)}
        />
        <View className={styles.btns}>
          <View className={styles.cancelBtn} onClick={onCancel}><Text>取消</Text></View>
          <View className={styles.confirmBtn} onClick={() => onConfirm(value.trim())}><Text>确定</Text></View>
        </View>
      </View>
    </View>
  )
}

export default NameInputModal
