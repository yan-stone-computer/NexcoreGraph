import React, { useEffect, useState } from 'react'
import { View, Text, Input } from '@tarojs/components'
import Taro, { useRouter, useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import ItemRow from '@/components/ItemRow'
import EmptyState from '@/components/EmptyState'
import type { Item, Library } from '@/types'
import styles from './index.module.scss'

interface FormState {
  name: string
  emoji: string
  qty: string
  unit: string
  price: string
  expDays: string
  pos: string
}

const EMPTY_FORM: FormState = { name: '', emoji: '📦', qty: '1', unit: '个', price: '', expDays: '7', pos: '未设置' }

const LibraryDetailPage: React.FC = () => {
  const router = useRouter()
  const { db, refresh } = useStore()
  const [lib, setLib] = useState<Library | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Item | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)

  useEffect(() => {
    const l = db.libraries.filter((x) => x.id === router.params.id)[0] || null
    setLib(l)
    if (!l) Taro.showToast({ title: '库不存在', icon: 'none' })
  }, [router.params.id, db.libraries])

  useDidShow(() => refresh())

  const setF = (k: keyof FormState, v: string) => setForm((prev) => ({ ...prev, [k]: v }))

  const openAdd = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (item: Item) => {
    setEditing(item)
    setForm({
      name: item.name, emoji: item.emoji || '📦', qty: String(item.qty), unit: item.unit,
      price: item.price ? String(item.price) : '', expDays: String(item.expDays), pos: item.pos || ''
    })
    setFormOpen(true)
  }

  const submitForm = async () => {
    if (!form.name.trim()) {
      Taro.showToast({ title: '请填写物品名称', icon: 'none' })
      return
    }
    try {
      const invoke = useStore.getState().invoke
      const data = {
        name: form.name.trim(), emoji: form.emoji || '📦', qty: parseFloat(form.qty) || 1,
        unit: form.unit || '个', price: parseFloat(form.price) || 0,
        expDays: parseInt(form.expDays, 10) || 7, pos: form.pos || '未设置'
      }
      if (editing) {
        await invoke(() => api.updateItem(lib!.id, editing.id, data))
      } else {
        await invoke(() => api.addItem(lib!.id, data))
      }
      setFormOpen(false)
      setEditing(null)
      Taro.showToast({ title: editing ? '已保存' : '已添加', icon: 'success' })
    } catch (e: any) {
      console.error('[LibraryDetail] save item error:', e)
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    }
  }

  const changeQty = async (item: Item, delta: number) => {
    try {
      await useStore.getState().invoke(() => api.updateItemQty(item.id, delta))
    } catch (e: any) {
      console.error('[LibraryDetail] qty change error:', e)
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }

  const deleteItem = async (item: Item) => {
    const r = await Taro.showModal({ title: '删除物品', content: `确定删除「${item.name}」吗？可在此后撤销。`, confirmColor: '#C03A2B' })
    if (!r.confirm) return
    try {
      const snap = await useStore.getState().invoke(() => api.deleteItem(lib!.id, item.id))
      const r2 = await Taro.showModal({ title: '已删除', content: '需要撤销恢复吗？', confirmText: '撤销恢复', cancelText: '不用' })
      if (r2.confirm) await useStore.getState().invoke(() => api.restoreItem(snap))
    } catch (e: any) {
      console.error('[LibraryDetail] delete error:', e)
      Taro.showToast({ title: e.message || '删除失败', icon: 'none' })
    }
  }

  if (!lib) return <View className={styles.page} />

  const libEmoji = lib.icon === 'fridge' ? '🧊' : lib.icon === 'shirt' ? '👕' : lib.icon === 'pill' ? '💊' : lib.icon === 'wrench' ? '🔧' : lib.icon === 'dumbbell' ? '🏋️' : lib.icon === 'book' ? '📚' : lib.icon === 'paw' ? '🐾' : lib.icon === 'plug' ? '🔌' : '📦'

  return (
    <View className={styles.page}>
      <View className={styles.libHead}>
        <View className={styles.libIcon}><Text>{libEmoji}</Text></View>
        <View className={styles.libBody}>
          <Text className={styles.libName}>{lib.name}</Text>
          <Text className={styles.libMeta}>{lib.desc} · {lib.count} 件</Text>
        </View>
        <View className={styles.headActions}>
          <View className={styles.headBtn} onClick={() => Taro.navigateTo({ url: '/pages/intake/index?libId=' + lib.id })} hoverClass={styles.headBtnHover}>
            <Text>📷 入库</Text>
          </View>
        </View>
      </View>

      {formOpen ? (
        <View className={styles.formCard}>
          <Text className={styles.formTitle}>{editing ? '编辑物品' : '添加物品'}</Text>
          <View className={styles.formRow}>
            <Text className={styles.formLabel}>名称</Text>
            <Input className={styles.formInput} value={form.name} placeholder="如：酸奶" placeholderClass={styles.formPlaceholder} onInput={(e) => setF('name', e.detail.value)} />
          </View>
          <View className={styles.formRow}>
            <Text className={styles.formLabel}>图标</Text>
            <Input className={styles.formInput} value={form.emoji} placeholder="如：🥤" placeholderClass={styles.formPlaceholder} onInput={(e) => setF('emoji', e.detail.value)} />
          </View>
          <View className={styles.formRow}>
            <Text className={styles.formLabel}>数量</Text>
            <Input className={styles.formInput} value={form.qty} type="digit" placeholder="数量" placeholderClass={styles.formPlaceholder} onInput={(e) => setF('qty', e.detail.value)} />
            <Input className={styles.formInput} value={form.unit} placeholder="单位" placeholderClass={styles.formPlaceholder} onInput={(e) => setF('unit', e.detail.value)} />
          </View>
          <View className={styles.formRow}>
            <Text className={styles.formLabel}>单价 ¥</Text>
            <Input className={styles.formInput} value={form.price} type="digit" placeholder="0" placeholderClass={styles.formPlaceholder} onInput={(e) => setF('price', e.detail.value)} />
          </View>
          <View className={styles.formRow}>
            <Text className={styles.formLabel}>保质期/天</Text>
            <Input className={styles.formInput} value={form.expDays} type="number" placeholder="7（9999 为长期）" placeholderClass={styles.formPlaceholder} onInput={(e) => setF('expDays', e.detail.value)} />
          </View>
          <View className={styles.formRow}>
            <Text className={styles.formLabel}>位置</Text>
            <Input className={styles.formInput} value={form.pos} placeholder="如：冷藏区中层" placeholderClass={styles.formPlaceholder} onInput={(e) => setF('pos', e.detail.value)} />
          </View>
          <View className={styles.formActions}>
            <View className={styles.formSubmit} onClick={submitForm}><Text>{editing ? '保存修改' : '添加'}</Text></View>
            <View className={styles.formCancel} onClick={() => setFormOpen(false)}><Text>取消</Text></View>
          </View>
        </View>
      ) : null}

      <View className={styles.itemTitle}>
        <Text className={styles.itemTitleText}>物品清单</Text>
        <View className={styles.addItemBtn} onClick={openAdd}><Text>＋ 添加物品</Text></View>
      </View>

      <View className={styles.list}>
        {lib.items.length === 0 ? (
          <EmptyState emoji="📭" text="这个库还是空的" sub="点右上角「添加物品」或拍照入库" />
        ) : (
          lib.items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              onMinus={() => changeQty(item, -1)}
              onPlus={() => changeQty(item, 1)}
              onEdit={() => openEdit(item)}
              onDelete={() => deleteItem(item)}
            />
          ))
        )}
      </View>
      <Text className={styles.tip}>＋ / − 直接调整数量，编辑可修改单价、保质期等</Text>
    </View>
  )
}

export default LibraryDetailPage
