import React, { useEffect, useState } from 'react'
import { View, Text, Input, Picker } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import { vision, type VisionItem } from '@/services/agnes'
import { KB } from '@/data/knowledge'
import demoFridge from '@/assets/fridge.jpg'
import AppIcon from '@/components/AppIcon'
import TourTip from '@/components/TourTip'
import { TOUR, type TourStep } from '@/services/demoTour'
import { advanceTour, currentTourStep, stopTour } from '@/services/tourStore'
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
  const [sourceText, setSourceText] = useState('')
  const [tour, setTour] = useState<TourStep | null>(null)

  const libs = db.libraries
  const targetLib = libs[libIndex] || libs[0]

  useEffect(() => {
    const step = currentTourStep()
    if (step?.id === 'intake') setTour(step)
  }, [])

  const readBase64 = (filePath: string): Promise<string> => new Promise((resolve, reject) => {
    Taro.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (r: any) => resolve(String(r.data || '')),
      fail: reject
    })
  })

  const kbFor = (name: string): { key: string; emoji: string; unit: string } => {
    const keys = Object.keys(KB.foods)
    const key = keys.filter((k) => {
      const n = KB.foods[k].name
      return n.indexOf(name) > -1 || name.indexOf(n) > -1
    })[0] || ''
    const fallback: Record<string, string> = {
      鸡蛋: '🥚', 番茄: '🍅', 番茄酱: '🍅', 牛奶: '🥛', 青菜: '🥬',
      猪肉: '🥩', 酸奶: '🥤', 黄瓜: '🥒', 香蕉: '🍌', 面包: '🍞'
    }
    return { key, emoji: fallback[name] || '🧺', unit: '个' }
  }

  const toIntake = (items: VisionItem[], img: string): IntakeResult[] => items.map((it, i) => {
    const meta = kbFor(it.name)
    const days = Math.max(0, Number(it.expDays) || 0)
    return {
      id: 'vision-' + Date.now() + '-' + i,
      emoji: meta.emoji,
      img,
      name: it.name,
      category: it.category || '家庭物品',
      qty: String(it.qty || 1),
      unit: it.unit || meta.unit,
      pos: it.pos || '待确认位置',
      exp: days > 0 ? days + ' 天' : '待确认',
      expSrc: 'AI 视觉识别',
      expDays: days || 7,
      kbKey: meta.key,
      price: it.price ? String(it.price) : '',
      priceSrc: it.price ? 'AI 参考价' : '待补',
      attention: !it.name || !it.pos || !it.expDays
    }
  })

  const recognizeViaAi = async (imgs: string[]): Promise<IntakeResult[]> => {
    const out: IntakeResult[] = []
    let model = ''
    let ms = 0
    for (const img of imgs) {
      const imageBase64 = await readBase64(img)
      const r = await vision({ imageBase64, hints: '识别家庭储物与冰箱内可见物品，返回名称、数量、位置、保质期和参考价' })
      model = r.model
      ms += r.ms || 0
      out.push(...toIntake(r.items, img))
    }
    setSourceText(`在线视觉识别 · ${model} · ${ms}ms · 结果需人工确认`)
    return out
  }

  const chooseAndRecognize = async () => {
    if (loading) return
    try {
      const res = await Taro.chooseMedia({ count: 4, mediaType: ['image'], sizeType: ['compressed'], sourceType: ['camera', 'album'] })
      const imgs = (res.tempFiles || []).map((f) => f.tempFilePath)
      if (!imgs.length) return
      setLoading(true)
      const r = await recognizeViaAi(imgs)
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
      const r = await recognizeViaAi([demoFridge])
      setResults(r)
      Taro.showToast({ title: '已识别 ' + r.length + ' 项', icon: 'none' })
    } catch (e) {
      console.error('[Intake] mock recognize error:', e)
      Taro.showToast({ title: '识别失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const patch = (id: string, key: 'name' | 'qty' | 'unit' | 'pos' | 'expDays', val: string) => {
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

  const nextGuide = () => {
    if (!tour) return
    const next = advanceTour(tour.id)
    setTour(next)
    if (next) Taro.navigateTo({ url: next.page })
  }

  const closeGuide = () => {
    stopTour()
    setTour(null)
  }

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
          <AppIcon name="camera" size={88} />
          <Text className={styles.cameraText}>{loading ? 'AI 正在识别图片…' : '拍摄 / 上传食材照片'}</Text>
          <Text className={styles.cameraSub}>识别后自动补全品名 · 数量 · 保质期（F1，可人工修正）</Text>
          {sourceText ? <Text className={styles.cameraSub}>{sourceText}</Text> : null}
          {loading ? <Text className={styles.loading}>识别中，请稍候…</Text> : null}
          <View className={styles.cameraBtns}>
            <View className={styles.cameraBtn} onClick={chooseAndRecognize}><Text>{loading ? '识别中…' : '拍照 / 选图'}</Text></View>
            <View className={styles.cameraBtnGhost} onClick={mockShoot}>
              <AppIcon name="photo" size={26} /><Text>示例照片识别</Text>
            </View>
          </View>
        </View>
      ) : (
        <>
          <View className={styles.targetRow}>
            <Text className={styles.targetLabel}>入库到：</Text>
            <Picker mode="selector" range={libs.map((l) => l.name)} value={libIndex} onChange={(e) => setLibIndex(parseInt(String(e.detail.value), 10))}>
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
      {tour ? (
        <TourTip
          step={tour}
          index={TOUR.findIndex((step) => step.id === tour.id)}
          total={TOUR.length}
          onNext={nextGuide}
          onClose={closeGuide}
        />
      ) : null}
    </View>
  )
}

export default IntakePage
