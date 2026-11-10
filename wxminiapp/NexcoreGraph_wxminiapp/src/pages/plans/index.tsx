import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import PlanCard from '@/components/PlanCard'
import EmptyState from '@/components/EmptyState'
import type { Plan } from '@/types'
import AppIcon from '@/components/AppIcon'
import styles from './index.module.scss'

const PlansPage: React.FC = () => {
  const { db, refresh } = useStore()
  const [busyId, setBusyId] = useState<number | null>(null)

  useDidShow(() => refresh())

  const generate = async () => {
    try {
      const plans = await useStore.getState().invoke(() => api.generatePlans())
      Taro.showToast({ title: '已生成 ' + plans.length + ' 个方案', icon: 'success' })
    } catch (e: any) {
      console.error('[Plans] generate error:', e)
      Taro.showToast({ title: e.message || '生成失败', icon: 'none' })
    }
  }

  const creative = async () => {
    try {
      const plan = await useStore.getState().invoke(() => api.creativeRecipe())
      Taro.showToast({ title: '创新菜谱「' + plan.title + '」', icon: 'success' })
    } catch (e: any) {
      console.error('[Plans] creative error:', e)
      Taro.showToast({ title: e.message || '生成失败', icon: 'none' })
    }
  }

  const execute = async (plan: Plan, selected: string[]) => {
    if (busyId != null) return
    setBusyId(plan.id)
    try {
      await useStore.getState().invoke(() => api.executePlan(plan.id, selected.length ? selected : undefined))
      Taro.showToast({ title: '已执行，库存已扣减', icon: 'success' })
    } catch (e: any) {
      console.error('[Plans] execute error:', e)
      Taro.showToast({ title: e.message || '执行失败', icon: 'none' })
    } finally {
      setBusyId(null)
    }
  }

  const rollback = async (plan: Plan) => {
    if (busyId != null) return
    const r = await Taro.showModal({ title: '撤销方案', content: `撤销「${plan.title}」，库存将回滚到执行前。`, confirmColor: '#C53D3D' })
    if (!r.confirm) return
    setBusyId(plan.id)
    try {
      await useStore.getState().invoke(() => api.rollbackPlan(plan.id))
      Taro.showToast({ title: '已回滚', icon: 'success' })
    } catch (e: any) {
      console.error('[Plans] rollback error:', e)
      Taro.showToast({ title: e.message || '回滚失败', icon: 'none' })
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.head}>
        <View>
          <Text className={styles.headTitle}>方案 · {db.plans.length}</Text>
          <Text className={styles.headSub}>优先级：临期优先 &gt; 清库存 &gt; 营养均衡</Text>
        </View>
        <View className={styles.headBtns}>
          <View className={styles.headBtn} onClick={creative} hoverClass={styles.headBtnHover}><AppIcon name="ai" size={24} /><Text>创新菜谱</Text></View>
          <View className={styles.headBtn} onClick={generate} hoverClass={styles.headBtnHover}><AppIcon name="plus" size={24} /><Text>生成新方案</Text></View>
        </View>
      </View>

      <View className={styles.list}>
        {db.plans.length === 0 ? (
          <EmptyState icon="plans" text="还没有方案" sub="点击「生成新方案」，AI 会按临期优先级从库存排菜" />
        ) : (
          db.plans.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              busy={busyId === p.id}
              onExecute={(sel) => execute(p, sel)}
              onRollback={() => rollback(p)}
            />
          ))
        )}
      </View>
      <Text className={styles.tip}>勾选用料后执行将自动扣减库存，可一键撤销回滚（F3.8）</Text>
    </View>
  )
}

export default PlansPage
