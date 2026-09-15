import React, { useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import type { IntakeResult } from '@/types'
import styles from './index.module.scss'
import classnames from 'classnames'

const STEPS = ['拍摄/上传', 'AI 识别', '只补缺', '入库']

const IntakePage: React.FC = () => {
  const { db, refresh } = useStore()
  const [results, setResults] = useState<IntakeResult[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [libIndex, setLibIndex] = useState(0)

  const libs = db.libraries
  const targetLib = libs[libIndex] || libs[0]

  const chooseAndRecognize = async () => {
    if (loading) return
    try {
      const res = await Taro.chooseImage({ count: 4, sizeType: ['compressed'], sourceType: ['camera', 'album'] })
      const imgs = res.tempFilePaths || []
      if (!imgs.length) return
      setLoading(true)
      const r = await api.recognize(imgs)
      setResults(r)
    } catch (e) {
      console.error('[Intake] choose/recognize error:', e)
      Taro.showToast({ title: '识别失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const mockShoot = async () => {
    if (loading) return
    setLoading(true)
    try {
      const path = 'mock://camera-' + Date.now()
      // 模拟连拍 2 张（同名），便于验证 B3 连拍合并的累加逻辑
      const r = await api.recognize([path, path])
      if (r.length >= 2 && r[0].name) {
        r[1] = { ...r[1], name: r[0].name, kbKey: r[0].kbKey, emoji: r[0].emoji, unit: r[0].unit }
      }
      setResults(r)
      Taro.showToast({ title: '已识别 ' + r.length + ' 项', icon: 'none' })
    } catch (e) {
      console.error('[Intake] mock recognize error:', e)
      Taro.showToast({ title: '识别失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const patch = (id: string, key: 'name' | 'qty' | 'pos' | 'expDays', val: string) => {
    setResults((prev) => prev.map((r) => (r.id === id ? { ...r, [key]: val } : r)))
  }

  const merge = () => {
    setResults(api.mergeIntake(results))
    Taro.showToast({ title: '已合并同名', icon: 'success' })
  }

  const confirmIn = async () => {
    if (busy || !results.length) return
    setBusy(true)
    try {
      await useStore.getState().invoke(() => api.addItems(results, targetLib.id))
      Taro.showToast({ title: '入库成功', icon: 'success' })
      setResults([])
      refresh()
    } catch (e: any) {
      console.error('[Intake] addItems error:', e)
      Taro.showToast({ title: e.message || '入库失败', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  const resetAll = () => {
    setResults([])
    Taro.showToast({ title: '已清空', icon: 'none' })
  }

  const currentStep = results.length === 0 ? 0 : loading ? 1 : 2

  return (
    <View className={styles.page}>
      <View className={styles.steps}>
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 ? <Text className={styles.stepArrow}>›</Text> : null}
            <Text className={classnames(styles.stepItem, i <= currentStep && styles.stepOn)}>{i + 1}. {s}</Text>
          </React.Fragment>
        ))}
      </View>

      {results.length === 0 ? (
        <View className={styles.cameraCard}>
          <Text className={styles.cameraIcon}>📷</Text>
          <Text className={styles.cameraText}>{loading ? 'AI 正在识别图片…' : '拍摄 / 上传食材照片'}</Text>
          <Text className={styles.cameraSub}>识别后自动补全品名 · 数量 · 保质期（F1，本地模拟）</Text>
          {loading ? <Text className={styles.loading}>识别中，请稍候…</Text> : null}
          <View className={styles.cameraBtns}>
            <View className={styles.cameraBtn} onClick={chooseAndRecognize}><Text>{loading ? '识别中…' : '拍照 / 选图'}</Text></View>
            <View className={styles.cameraBtnGhost} onClick={mockShoot}><Text>模拟拍摄</Text></View>
          </View>
        </View>
      ) : (
        <>
          <View className={styles.targetRow}>
            <Text className={styles.targetLabel}>入库到：</Text>
            <Picker mode="selector" range={libs.map((l) => l.name)} value={libIndex} onChange={(e) => setLibIndex(parseInt(e.detail.value, 10))}>
              <Text className={styles.targetValue}>{targetLib.name} ▾</Text>
            </Picker>
          </View>

          <View className={styles.results}>
            {results.map((r) => (
              <View key={r.id} className={styles.resultCard}>
                <View className={styles.resultHead}>
                  <View className={styles.resultEmoji}><Text>{r.emoji || '❔'}</Text></View>
                  <View className={styles.resultNameRow}>
                    <Text className={styles.resultName}>{r.name || '待归类'}</Text>
                    <Text className={styles.resultSrc}>{r.price ? '¥' + r.price + '（' + r.priceSrc + '）' : r.priceSrc} · {r.exp}</Text>
                  </View>
                  {r.attention ? <Text className={styles.attentionTag}>待补缺</Text> : null}
                </View>
                <View className={styles.resultField}>
                  <Text className={styles.resultFieldLabel}>数量</Text>
                  <Input className={styles.resultInput} value={r.qty} type="digit" placeholder="数量" placeholderClass={styles.resultPlaceholder} onInput={(e) => patch(r.id, 'qty', e.detail.value)} />
                  <Input className={styles.resultInput} value={r.unit} placeholder="单位" placeholderClass={styles.resultPlaceholder} onInput={(e) => patch(r.id, 'unit', e.detail.value)} />
                </View>
                <View className={styles.resultField}>
                  <Text className={styles.resultFieldLabel}>位置</Text>
                  <Input className={styles.resultInput} value={r.pos} placeholder="如：冷藏区中层" placeholderClass={styles.resultPlaceholder} onInput={(e) => patch(r.id, 'pos', e.detail.value)} />
                </View>
              </View>
            ))}
          </View>

          <View className={styles.ops}>
            <View className={classnames(styles.opBtn, styles.opGhost)} onClick={resetAll}><Text>返回重拍</Text></View>
            <View className={classnames(styles.opBtn, styles.opGhost)} onClick={merge}><Text>连拍合并</Text></View>
            <View className={classnames(styles.opBtn, styles.opPrimary, busy && styles.opBusy)} onClick={confirmIn}><Text>{busy ? '入库中…' : '确认入库 ' + results.length + ' 项'}</Text></View>
          </View>
        </>
      )}
      <Text className={styles.tip}>识别结果可手动修正；连拍合并会累加同名物品数量（F1.2）</Text>
    </View>
  )
}

export default IntakePage
