import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'
import classnames from 'classnames'
import AppIcon from '@/components/AppIcon'
import type { Plan } from '@/types'

interface PlanCardProps {
  plan: Plan
  onExecute: (selected: string[]) => void
  onRollback: () => void
  busy?: boolean
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onExecute, onRollback, busy }) => {
  const [selected, setSelected] = useState<string[]>(plan.selected || [])
  const done = plan.status === 'done'

  const toggle = (name: string) => {
    setSelected((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]))
  }

  return (
    <View className={classnames(styles.planCard, done && styles.done)}>
      <View className={styles.head}>
        <View className={styles.titleLine}>
          <Text className={styles.title}>{plan.title}</Text>
          <Text className={classnames(styles.priority, plan.priority === '高' ? styles.priHigh : styles.priMid)}>
            {plan.priority}优先级
          </Text>
          {plan.creative ? <Text className={styles.aiTag}>AI 创新</Text> : null}
        </View>
        <Text className={styles.reason}>{plan.reason}</Text>
      </View>
      <View className={styles.meta}>
        <View className={styles.metaItem}><AppIcon name="clock" size={22} /><Text>{plan.time}</Text></View>
        <View className={styles.metaItem}><AppIcon name="flame" size={22} /><Text>约 {plan.kcal} kcal</Text></View>
        <Text className={styles.metaItem}>蛋白 {plan.prot}g</Text>
      </View>
      {plan.used.length > 0 ? (
        <View className={styles.ingWrap}>
          <Text className={styles.ingLabel}>用料（勾选参与核销）</Text>
          <View className={styles.chips}>
            {plan.used.map((u) => {
              const active = selected.includes(u.name)
              return (
                <View
                  key={u.name}
                  className={classnames(styles.chip, active && styles.chipActive, done && styles.chipDisabled)}
                  onClick={() => !done && toggle(u.name)}
                >
                  <Text>{active ? '☑' : '☐'} {u.name} × {u.qty}</Text>
                </View>
              )
            })}
          </View>
        </View>
      ) : null}
      {plan.missing.length > 0 ? (
        <View className={styles.ingWrap}>
          <Text className={styles.ingLabel}>缺料（建议加入采购清单）</Text>
          <View className={styles.chips}>
            {plan.missing.map((m) => (
              <View key={m.name} className={styles.chipMissing}>
                <Text>{m.name} × {m.qty}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <View className={styles.footer}>
        {!done ? (
          <View className={styles.execBtn} onClick={() => onExecute(selected)} hoverClass={styles.btnHover}>
            <Text>{busy ? '执行中…' : '确认执行'}</Text>
          </View>
        ) : (
          <View className={styles.doneTag}><AppIcon name="check" size={22} /><Text>已执行</Text></View>
        )}
        {done && plan.snapshot ? (
          <View className={styles.rollbackBtn} onClick={onRollback} hoverClass={styles.btnHover}>
            <AppIcon name="refresh" size={22} /><Text>撤销回滚</Text>
          </View>
        ) : null}
      </View>
    </View>
  )
}

export default PlanCard
