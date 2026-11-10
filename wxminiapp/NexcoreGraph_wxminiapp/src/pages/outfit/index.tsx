import { useCallback, useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { useRouter } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { ask } from '@/services/graphRag'
import type { Item } from '@/types'
import styles from './index.module.scss'

interface OutfitResult {
  text: string
  src: string
  model: string
  ms: number
}

export default function OutfitPage() {
  const router = useRouter()
  const db = useStore((state) => state.db)
  const wardrobe = db.libraries.find((lib) => lib.id === router.params.id)
    || db.libraries.find((lib) => lib.name.includes('衣柜'))
  const items = wardrobe?.items || []
  const [phase, setPhase] = useState<'loading' | 'done' | 'error'>('loading')
  const [result, setResult] = useState<OutfitResult | null>(null)

  const recommend = useCallback(async () => {
    if (!items.length) {
      setPhase('error')
      setResult({
        text: '衣柜里还没有可搭配的单品，请先入库几件衣服和鞋包。',
        src: '本地资源检查',
        model: 'local',
        ms: 0
      })
      return
    }

    setPhase('loading')
    const list = items
      .slice(0, 18)
      .map((item: Item) => `${item.name}${item.qty > 1 ? `×${item.qty}` : ''}（${item.pos || '衣柜'}）`)
      .join('、')
    const question = `明天降温到12度，有通勤会议。请优先从我的衣柜里搭配一套保暖、正式但不过度拘谨的穿搭，鞋子也要从衣柜里选。可选单品：${list}`
    const answer = await ask(question, 'AI 暂时没有返回搭配建议，请检查自建网关。')
    const cleanAnswer = answer.text
      .replace(/\*\*/g, '')
      .replace(/\n?\s*[（(]依据证据[\s\S]*$/, '')
      .trim()
    setResult({
      text: cleanAnswer,
      src: answer.src || 'GraphRAG',
      model: answer.model,
      ms: answer.ms
    })
    setPhase(answer.ok ? 'done' : 'error')
  }, [items])

  useEffect(() => {
    recommend()
  }, [recommend])

  return (
    <View className={styles.page}>
      <View className={styles.hero}>
        <Text className={styles.eyebrow}>AI WARDROBE · 场景搭配</Text>
        <Text className={styles.title}>12°C 通勤怎么穿</Text>
        <Text className={styles.subtitle}>读取衣柜里的真实单品，结合天气与场合给出一套可直接执行的搭配。</Text>
        <View className={styles.conditions}>
          <Text className={styles.condition}>12°C</Text>
          <Text className={styles.condition}>通勤会议</Text>
          <Text className={styles.condition}>{items.length} 件可选</Text>
        </View>
      </View>

      <View className={styles.card}>
        <View className={styles.cardHead}>
          <Text className={styles.cardTitle}>搭配建议</Text>
          <Text className={styles.status}>
            {phase === 'loading' ? 'GraphRAG 检索中' : phase === 'done' ? '可执行方案' : '需要补全'}
          </Text>
        </View>
        {phase === 'loading' ? (
          <Text className={styles.loading}>正在读取衣柜节点与场景条件…</Text>
        ) : (
          <>
            <Text className={styles.answer}>{result?.text}</Text>
            <Text className={styles.source}>{result?.src}{result?.ms ? ` · ${(result.ms / 1000).toFixed(1)} 秒` : ''}</Text>
            {phase === 'error' ? <View className={styles.retry} onClick={recommend}><Text>重新推荐</Text></View> : null}
          </>
        )}
      </View>

      <View className={styles.card}>
        <View className={styles.cardHead}>
          <Text className={styles.cardTitle}>本次读取的衣柜</Text>
          <Text className={styles.status}>{wardrobe?.name || '衣柜'}</Text>
        </View>
        <View className={styles.wardrobe}>
          {items.slice(0, 10).map((item) => (
            <Text className={styles.piece} key={item.id}>{item.name}</Text>
          ))}
        </View>
        <Text className={styles.hint}>推荐只从现有衣柜中选择；缺失的单品不会被写成已拥有。</Text>
      </View>
    </View>
  )
}
