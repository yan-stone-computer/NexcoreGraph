import React from 'react'
import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'
import { expColor, expLabel } from '@/utils/format'
import ItemGlyph from '@/components/ItemGlyph'
import type { Item } from '@/types'

interface ItemRowProps {
  item: Item
  onMinus: () => void
  onPlus: () => void
  onEdit: () => void
  onDelete: () => void
}

const ItemRow: React.FC<ItemRowProps> = ({ item, onMinus, onPlus, onEdit, onDelete }) => {
  const low = (item.lowAt || 0) > 0 && item.qty <= item.lowAt
  return (
    <View className={styles.itemRow}>
      <ItemGlyph
        className={styles.avatar}
        name={item.name}
        img={item.img}
        kbKey={item.kbKey}
        size={96}
      />
      <View className={styles.body} onClick={onEdit}>
        <View className={styles.nameLine}>
          <Text className={styles.name}>{item.name}</Text>
          {item.private ? <Text className={styles.privateTag}>仅自己</Text> : null}
        </View>
        <Text className={styles.pos}>{item.pos || '未设置位置'}</Text>
        <View className={styles.tags}>
          <Text className={styles.expTag} style={{ color: expColor(item.expDays) }}>{expLabel(item.expDays)}</Text>
          {low ? <Text className={styles.lowTag}>低库存</Text> : null}
          {item.price ? <Text className={styles.price}>¥{item.price}</Text> : null}
        </View>
      </View>
      <View className={styles.ops}>
        <View className={styles.stepper}>
          <View className={styles.stepBtn} onClick={onMinus} hoverClass={styles.stepHover}><Text>−</Text></View>
          <Text className={styles.qty}>{item.qty}</Text>
          <View className={styles.stepBtn} onClick={onPlus} hoverClass={styles.stepHover}><Text>+</Text></View>
        </View>
        <Text className={styles.unitText}>{item.unit}</Text>
        <View className={styles.miniOps}>
          <Text className={styles.miniBtn} onClick={onEdit}>编辑</Text>
          <Text className={styles.miniBtnDanger} onClick={onDelete}>删除</Text>
        </View>
      </View>
    </View>
  )
}

export default ItemRow
