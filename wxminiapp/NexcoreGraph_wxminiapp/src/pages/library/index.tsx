import React, { useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import EmptyState from '@/components/EmptyState'
import NameInputModal from '@/components/NameInputModal'
import { expColor, expLabel } from '@/utils/format'
import type { Library } from '@/types'
import styles from './index.module.scss'

interface SearchResult {
  items: {
    id: string; name: string; emoji: string; lib: string; libId: string; pos: string;
    qty: number; unit: string; expDays: number
  }[]
  libs: Library[]
  ans?: {
    type: 'loc' | 'found' | 'none'
    title: string
    sub: string
    item?: { name: string; emoji: string; lib: string; libId: string; pos: string; qty: number; unit: string; expDays: number }
  } | null
}

const LibraryPage: React.FC = () => {
  const { db, refresh } = useStore()
  const [keyword, setKeyword] = useState('')
  const [results, setResults] = useState<SearchResult | null>(null)
  const [nameModal, setNameModal] = useState<{ title: string; placeholder: string; initial?: string; onSubmit: (v: string) => void } | null>(null)
  const timer = useRef<any>(null)

  useDidShow(() => refresh())

  const onSearch = (v: string) => {
    setKeyword(v)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      if (!v.trim()) { setResults(null); return }
      try {
        const r = await api.search(v.trim())
        setResults(r)
      } catch (e) {
        console.error('[Library] search error:', e)
      }
    }, 260)
  }

  const clearSearch = () => {
    setKeyword('')
    setResults(null)
    if (timer.current) clearTimeout(timer.current)
  }

  const openLib = (libId: string) => Taro.navigateTo({ url: '/pages/library-detail/index?id=' + libId })

  const createLib = () => {
    setNameModal({
      title: '新建库',
      placeholder: '请输入库名称，如：零食柜',
      onSubmit: async (name) => {
        if (!name) return
        setNameModal(null)
        try {
          await useStore.getState().invoke(() => api.createLibrary(name))
          Taro.showToast({ title: '已创建', icon: 'success' })
          refresh()
        } catch (e: any) {
          Taro.showToast({ title: e.message || '创建失败', icon: 'none' })
        }
      }
    })
  }

  const libMenu = async (lib: Library) => {
    const res = await Taro.showActionSheet({
      itemList: ['重命名', '左移一位', '右移一位', '删除库']
    })
    if (res.cancel) return
    const idx = res.tapIndex
    try {
      const invoke = useStore.getState().invoke
      if (idx === 0) {
        setNameModal({
          title: '重命名库',
          placeholder: '请输入新库名',
          initial: lib.name,
          onSubmit: async (nName) => {
            if (!nName) return
            setNameModal(null)
            try {
              await invoke(() => api.renameLibrary(lib.id, nName))
              refresh()
            } catch (e: any) {
              Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
            }
          }
        })
      } else if (idx === 1) {
        await invoke(() => api.moveLibrary(lib.id, -1))
      } else if (idx === 2) {
        await invoke(() => api.moveLibrary(lib.id, 1))
      } else if (idx === 3) {
        const c = await Taro.showModal({ title: '删除库', content: `确定删除「${lib.name}」吗？可在此后撤销。`, confirmColor: '#C03A2B' })
        if (!c.confirm) return
        const snap = await invoke(() => api.deleteLibrary(lib.id))
        const c2 = await Taro.showModal({ title: '已删除', content: '需要撤销恢复吗？', confirmText: '撤销恢复', cancelText: '不用' })
        if (c2.confirm) await invoke(() => api.restoreLibrary(snap))
      }
      refresh()
    } catch (e: any) {
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.searchBar}>
        <Input
          className={styles.searchInput}
          value={keyword}
          placeholder="🔍 搜索物品 / 位置 / 库"
          placeholderClass={styles.searchPlaceholder}
          onInput={(e) => onSearch(e.detail.value)}
          confirmType="search"
        />
        {keyword ? (
          <Text className={styles.searchClear} onClick={clearSearch}>✕</Text>
        ) : null}
      </View>

      {results ? (
        <View className={styles.results}>
          <View className={styles.resultTitle}>物品 {results.items.length} · 库 {results.libs.length}</View>
          {results.ans ? (
            <View className={styles.ansCard}>
              <View className={styles.ansHead}>
                <Text className={styles.ansIcon}>✨</Text>
                <Text className={styles.ansTitle}>{results.ans.title}</Text>
              </View>
              <Text className={styles.ansSub}>{results.ans.sub}</Text>
              {results.ans.type === 'loc' && results.ans.item ? (
                <Text
                  className={styles.ansBtn}
                  onClick={() => openLib(results.ans!.item!.libId)}
                >去{results.ans.item.lib}看看 ›</Text>
              ) : null}
            </View>
          ) : null}
          {results.items.length === 0 && results.libs.length === 0 ? (
            <EmptyState emoji="🔎" text={`没有找到「${keyword}」`} sub="可先拍照入库，或换个关键词" />
          ) : (
            <>
              {results.items.map((it) => (
                <View key={it.id} className={styles.resultRow} onClick={() => openLib(it.libId)}>
                  <Text className={styles.resultEmoji}>{it.emoji || '📦'}</Text>
                  <View className={styles.resultBody}>
                    <Text className={styles.resultName}>{it.name}</Text>
                    <Text className={styles.resultMeta}>{it.lib} · {it.pos} · {it.qty} {it.unit}</Text>
                  </View>
                  <Text className={styles.resultExp} style={{ color: expColor(it.expDays) }}>{expLabel(it.expDays)}</Text>
                </View>
              ))}
              {results.libs.map((l) => (
                <View key={l.id} className={styles.resultRow} onClick={() => openLib(l.id)}>
                  <Text className={styles.resultEmoji}>🗂️</Text>
                  <View className={styles.resultBody}>
                    <Text className={styles.resultName}>{l.name}</Text>
                    <Text className={styles.resultMeta}>{l.count} 件物品</Text>
                  </View>
                  <Text className={styles.resultExp}>进入 ›</Text>
                </View>
              ))}
            </>
          )}
        </View>
      ) : (
        <>
          <View className={styles.sectionHead}>
            <Text className={styles.sectionTitle}>{db.libraries.length} 个库</Text>
            <Text className={styles.addBtn} onClick={createLib}>＋ 新建库</Text>
          </View>
          <View className={styles.libGrid}>
            {db.libraries.map((lib) => (
              <View key={lib.id} className={styles.libCard} onClick={() => openLib(lib.id)} hoverClass={styles.libHover} onLongPress={() => libMenu(lib)}>
                <View className={styles.libIcon}>
                  <Text className={styles.libEmoji}>{lib.icon === 'fridge' ? '🧊' : lib.icon === 'shirt' ? '👕' : lib.icon === 'pill' ? '💊' : lib.icon === 'wrench' ? '🔧' : lib.icon === 'dumbbell' ? '🏋️' : lib.icon === 'book' ? '📚' : lib.icon === 'paw' ? '🐾' : lib.icon === 'plug' ? '🔌' : '📦'}</Text>
                </View>
                <Text className={styles.libName}>{lib.name}</Text>
                <Text className={styles.libDesc}>{lib.desc}</Text>
                <Text className={styles.libCount}>{lib.count} 件</Text>
              </View>
            ))}
          </View>
          <Text className={styles.tip}>长按库卡片可重命名 / 排序 / 删除</Text>
        </>
      )}

      {nameModal ? (
        <NameInputModal
          visible
          title={nameModal.title}
          placeholder={nameModal.placeholder}
          initial={nameModal.initial}
          onCancel={() => setNameModal(null)}
          onConfirm={nameModal.onSubmit}
        />
      ) : null}
    </View>
  )
}

export default LibraryPage
