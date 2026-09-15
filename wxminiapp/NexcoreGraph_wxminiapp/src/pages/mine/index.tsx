import React, { useState } from 'react'
import { View, Text, Input, Picker, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import type { SyncStatus } from '@/types'
import styles from './index.module.scss'
import classnames from 'classnames'

const GOALS = ['均衡', '减脂', '增肌', '控糖']
const PEOPLE = ['1', '2', '3', '4', '5', '6', '7', '8']

const MinePage: React.FC = () => {
  const { db, refresh } = useStore()
  const [dislikes, setDislikes] = useState(db.profile?.dislikes || '')
  const [sync, setSync] = useState<SyncStatus>({ local: db.syncVersion || 1, version: 1, updatedAt: null })

  useDidShow(() => {
    refresh()
    api.syncStatus().then(setSync).catch((e) => console.error('[Mine] syncStatus:', e))
  })

  const profile = db.profile || { people: 3, dislikes: '', goal: '均衡', enabled: true }
  const members = db.members[db.familyId] || []
  const goalIndex = Math.max(0, GOALS.indexOf(profile.goal))
  const peopleIndex = Math.max(0, PEOPLE.indexOf(String(profile.people)))

  const saveProfile = async (patch: Record<string, any>) => {
    try {
      await useStore.getState().invoke(() => api.setProfile(patch))
      Taro.showToast({ title: '已保存', icon: 'success' })
    } catch (e: any) {
      console.error('[Mine] saveProfile error:', e)
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    }
  }

  const saveDislikes = async () => {
    await saveProfile({ dislikes: dislikes.trim() })
  }

  const editBudget = async () => {
    const r = await Taro.showModal({
      title: '月度预算',
      editable: true,
      placeholderText: String(db.budget),
      content: String(db.budget)
    })
    if (r.confirm && r.content != null) {
      try {
        await useStore.getState().invoke(() => api.setBudget(parseFloat(r.content!) || 0))
        Taro.showToast({ title: '已更新', icon: 'success' })
      } catch (e: any) {
        console.error('[Mine] setBudget error:', e)
        Taro.showToast({ title: e.message || '更新失败', icon: 'none' })
      }
    }
  }

  const refreshSync = () => api.syncStatus().then(setSync).catch((e) => console.error('[Mine] refreshSync:', e))

  const doSync = async (kind: 'upload' | 'download' | 'simulate') => {
    try {
      const invoke = useStore.getState().invoke
      if (kind === 'upload') await invoke(() => api.syncUpload())
      else if (kind === 'download') await invoke(() => api.syncDownload())
      else await invoke(() => api.syncSimulateRemote())
      Taro.showToast({ title: '同步完成', icon: 'success' })
      refreshSync()
    } catch (e: any) {
      console.error('[Mine] sync error:', e)
      const msg = e.status === 409 ? '云端版本较新，请先拉取或强制覆盖' : (e.message || '同步失败')
      const r = await Taro.showModal({ title: '同步冲突', content: msg + '\n是否强制覆盖上传？', confirmText: '强制覆盖', cancelText: '取消', confirmColor: '#C03A2B' })
      if (r.confirm) {
        try {
          await useStore.getState().invoke(() => api.syncUpload(true))
          Taro.showToast({ title: '已强制覆盖', icon: 'success' })
          refreshSync()
        } catch (e2: any) {
          Taro.showToast({ title: e2.message || '同步失败', icon: 'none' })
        }
      }
    }
  }

  const genInvite = async () => {
    const r = await Taro.showModal({ title: '生成邀请码', content: '有效期天数：', editable: true, placeholderText: '7' })
    if (!r.confirm) return
    try {
      await useStore.getState().invoke(() => api.inviteGenerate(parseInt(r.content!, 10) || 7, 3))
      Taro.showToast({ title: '已生成', icon: 'success' })
    } catch (e: any) {
      console.error('[Mine] invite error:', e)
      Taro.showToast({ title: e.message || '生成失败', icon: 'none' })
    }
  }

  const revokeInvite = async () => {
    const r = await Taro.showModal({ title: '撤销邀请码', content: '确定撤销当前邀请码吗？', confirmColor: '#C03A2B' })
    if (!r.confirm) return
    try {
      await useStore.getState().invoke(() => api.inviteRevoke())
      Taro.showToast({ title: '已撤销', icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '操作失败', icon: 'none' })
    }
  }

  const removeMember = async (phone: string, name: string) => {
    const r = await Taro.showModal({ title: '移除成员', content: `确定将「${name}」移出家庭空间吗？`, confirmColor: '#C03A2B' })
    if (!r.confirm) return
    try {
      await useStore.getState().invoke(() => api.memberRemove(phone))
      Taro.showToast({ title: '已移除', icon: 'success' })
    } catch (e: any) {
      console.error('[Mine] memberRemove error:', e)
      Taro.showToast({ title: e.message || '移除失败', icon: 'none' })
    }
  }

  const clearChat = async () => {
    const r = await Taro.showModal({ title: '清空对话', content: '仅清除本机 AI 对话记录。', confirmColor: '#C03A2B' })
    if (r.confirm) {
      await useStore.getState().invoke(() => api.chatClear())
      Taro.showToast({ title: '已清空', icon: 'success' })
    }
  }

  const resetData = async () => {
    const r = await Taro.showModal({ title: '重置演示数据', content: '将清空所有本地数据并恢复初始状态，确定吗？', confirmColor: '#C03A2B' })
    if (!r.confirm) return
    useStore.getState().invoke(() => Promise.resolve(api.reset()))
    Taro.showToast({ title: '已重置', icon: 'success' })
    setTimeout(() => Taro.reLaunch({ url: '/pages/login/index' }), 500)
  }

  const logout = async () => {
    const r = await Taro.showModal({ title: '退出登录', content: '确定退出当前账号吗？' })
    if (!r.confirm) return
    useStore.getState().logout()
    Taro.reLaunch({ url: '/pages/login/index' })
  }

  const invite = db.invite

  return (
    <View className={styles.page}>
      <View className={styles.userCard}>
        <View className={styles.avatar}><Text>{db.user?.initial || '我'}</Text></View>
        <View className={styles.userBody}>
          <Text className={styles.userName}>{db.user?.name || '未登录'}</Text>
          <Text className={styles.userMeta}>{db.family?.name || '—'} · {db.family?.memberCount ?? 0} 人</Text>
          <Text className={styles.roleTag}>{db.user?.role || '游客'}</Text>
        </View>
      </View>

      {/* 偏好档案（P0-4，仅本地存储） */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>偏好档案</Text>
          <Text className={styles.cardHint}>仅本地 · 用于 AI 规划</Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>用餐人数</Text>
          <Picker mode="selector" range={PEOPLE} value={peopleIndex} onChange={(e) => saveProfile({ people: parseInt(PEOPLE[parseInt(e.detail.value, 10)], 10) })}>
            <Text className={styles.pickerValue}>{profile.people} 人 ▾</Text>
          </Picker>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>饮食目标</Text>
          <Picker mode="selector" range={GOALS} value={goalIndex} onChange={(e) => saveProfile({ goal: GOALS[parseInt(e.detail.value, 10)] })}>
            <Text className={styles.pickerValue}>{profile.goal} ▾</Text>
          </Picker>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>忌口</Text>
          <Input className={styles.input} value={dislikes} placeholder="如：香菜、苦瓜" placeholderClass={styles.inputPlaceholder} onInput={(e) => setDislikes(e.detail.value)} onBlur={saveDislikes} onConfirm={saveDislikes} />
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>注入 AI 规划</Text>
          <Switch checked={profile.enabled !== false} color="#C9A86A" onChange={(e) => saveProfile({ enabled: e.detail.value })} />
        </View>
      </View>

      {/* 预算 */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>月度预算</Text>
          <Text className={styles.cardHint} onClick={editBudget}>点击修改 ›</Text>
        </View>
        <Text className={styles.inviteCode}>¥{db.budget}</Text>
        <Text className={styles.inviteMeta}>本月已花费 ¥{useStore.getState().stats.spent}</Text>
      </View>

      {/* 同步（本地模拟） */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>云端同步</Text>
          <Text className={styles.cardHint}>本地 v{sync.local} · 云端 v{sync.version}{sync.updatedAt ? ' · ' + sync.updatedAt : ''}</Text>
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={() => doSync('upload')}><Text>↑ 上传快照</Text></View>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={() => doSync('download')}><Text>↓ 拉取云端</Text></View>
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnPrimary)} onClick={() => doSync('simulate')}><Text>📱 模拟另一设备</Text></View>
        </View>
      </View>

      {/* 邀请码 */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>邀请码</Text>
          <Text className={styles.cardHint}>{invite.revoked ? '已撤销' : '已用 ' + invite.used + '/' + invite.max}</Text>
        </View>
        <Text className={styles.inviteCode}>{invite.code}</Text>
        <Text className={styles.inviteMeta}>{invite.revoked ? '当前邀请码已失效' : '有效期 ' + invite.expiresInDays + ' 天，家人凭码加入家庭空间（F9.3）'}</Text>
        <View className={styles.btnRow}>
          {invite.revoked ? (
            <View className={classnames(styles.btn, styles.btnPrimary)} onClick={genInvite}><Text>重新生成</Text></View>
          ) : (
            <>
              <View className={classnames(styles.btn, styles.btnGhost)} onClick={genInvite}><Text>重新生成</Text></View>
              <View className={classnames(styles.btn, styles.btnDanger)} onClick={revokeInvite}><Text>撤销</Text></View>
            </>
          )}
        </View>
      </View>

      {/* 成员 */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>家庭成员 · {members.length}</Text>
          <Text className={styles.cardHint}>仅管理员可移除</Text>
        </View>
        {members.map((m) => (
          <View key={m.phone} className={styles.memberRow}>
            <View className={styles.memberAvatar}><Text>{m.name.charAt(0)}</Text></View>
            <View className={styles.memberBody}>
              <Text className={styles.memberName}>{m.name}</Text>
              <Text className={styles.memberRole}>{m.role}</Text>
            </View>
            {m.role !== '管理员' && db.user?.phone !== m.phone ? (
              <Text className={styles.memberRemove} onClick={() => removeMember(m.phone, m.name)}>移除</Text>
            ) : null}
          </View>
        ))}
      </View>

      {/* AI 用量 */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>AI 用量 · 最近 {Math.min(5, db.aiUsage.length)} 次</Text>
        </View>
        {db.aiUsage.length === 0 ? (
          <Text className={styles.cardHint}>还没有 AI 调用记录，去 AI 助手聊两句吧</Text>
        ) : (
          db.aiUsage.slice(0, 5).map((u, i) => (
            <View key={i} className={styles.usageRow}>
              <Text className={styles.usageRoute}>{u.model === '本地快答' ? '⚡ ' + u.model : u.route}</Text>
              <View className={styles.usageMeta}>
                <Text>{u.model === '本地快答' ? '' : u.model + ' · '}</Text>
                <Text>{u.model === '本地快答' ? '直答' : u.ms + 'ms'}</Text>
              </View>
              <Text className={styles.usageCost}>{u.cost ? '¥' + u.cost.toFixed(3) : '免费'}</Text>
            </View>
          ))
        )}
      </View>

      {/* 其他 */}
      <View className={styles.card}>
        <View className={styles.row} onClick={clearChat}>
          <Text className={styles.rowLabel}>清空对话</Text>
          <Text className={styles.rowValue}>仅本机</Text>
          <Text className={styles.cardHint}>›</Text>
        </View>
        <View className={styles.row} onClick={resetData}>
          <Text className={styles.rowLabel}>重置演示数据</Text>
          <Text className={styles.rowValue}>恢复初始状态</Text>
          <Text className={styles.cardHint}>›</Text>
        </View>
      </View>

      <View className={styles.logoutBtn} onClick={logout}><Text>退出登录</Text></View>
    </View>
  )
}

export default MinePage
