import React, { useRef, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import ItemGlyph from '@/components/ItemGlyph'
import EmptyState from '@/components/EmptyState'
import NameInputModal from '@/components/NameInputModal'
import AppIcon from '@/components/AppIcon'
import BrandHeader from '@/components/BrandHeader'
import LibraryArt from '@/components/LibraryArt'
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

  const librarySubtitle = (icon: string) => {
    const labels: Record<string, string> = {
      fridge: '低温食材与日常储备',
      medicine: '药品与健康用品',
      tools: '工具与维修备件',
      wardrobe: '衣物与季节收纳',
      books: '图书与学习资料',
      pet: '宠物食品与用品',
      fitness: '运动与健身器材',
      appliances: '家电与保修档案'
    }
    return labels[icon] || '家庭资源集合'
  }

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
    if ((res as any).cancel) return
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
        const c = await Taro.showModal({ title: '删除库', content: `确定删除「${lib.name}」吗？可在此后撤销。`, confirmColor: '#C53D3D' })
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
      <View className={styles.brandBar}><BrandHeader /></View>
      <View className={styles.searchBar}>
        <AppIcon name="search" size={30} />
        <Input
          className={styles.searchInput}
          value={keyword}
          placeholder="搜索物品 / 位置 / 库"
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
                <AppIcon name="ai" size={32} />
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
            <EmptyState icon="search" text={`没有找到「${keyword}」`} sub="可先拍照入库，或换个关键词" />
          ) : (
            <>
              {results.items.map((it) => (
                <View key={it.id} className={styles.resultRow} onClick={() => openLib(it.libId)}>
                  <ItemGlyph name={it.name} size={68} />
                  <View className={styles.resultBody}>
                    <Text className={styles.resultName}>{it.name}</Text>
                    <Text className={styles.resultMeta}>{it.lib} · {it.pos} · {it.qty} {it.unit}</Text>
                  </View>
                  <Text className={styles.resultExp} style={{ color: expColor(it.expDays) }}>{expLabel(it.expDays)}</Text>
                </View>
              ))}
              {results.libs.map((l) => (
                <View key={l.id} className={styles.resultRow} onClick={() => openLib(l.id)}>
                  <AppIcon name="library" size={38} />
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
            <View className={styles.addBtn} onClick={createLib}><AppIcon name="plus" size={22} /><Text>新建库</Text></View>
          </View>
          <View className={styles.libGrid}>
            {db.libraries.map((lib) => (
              <View key={lib.id} className={styles.libCard} onClick={() => openLib(lib.id)} hoverClass={styles.libHover} onLongPress={() => libMenu(lib)}>
                <LibraryArt cover icon={lib.icon} name={lib.name} tone={lib.tone} />
                <View className={styles.libContent}>
                  <Text className={styles.libName}>{lib.name}</Text>
                  <Text className={styles.libDesc}>{librarySubtitle(lib.icon)}</Text>
                  <Text className={styles.libCount}>{lib.count} 件资源</Text>
                </View>
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
