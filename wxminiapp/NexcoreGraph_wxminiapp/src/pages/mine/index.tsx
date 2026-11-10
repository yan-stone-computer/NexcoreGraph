import React, { useState } from 'react'
import { View, Text, Input, Picker, Switch } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { api } from '@/services/api'
import { cfg as aiCfg, saveCfg as saveAiCfg, test as testAi } from '@/services/agnes'
import { download as liveDownload, pullFlow, publishFlow, state as liveState, upload as liveUpload } from '@/services/livesync'
import { remoteStatus } from '@/services/workspace'
import { createCoop, createInvite, getCurrentFamily, getMembers, joinCoop, removeFamilyMember, type CoopRecord, type FamilyMember } from '@/services/family'
import { loadSession } from '@/services/session'
import { exportCsv, importCsv, requestSubscribe } from '@/services/exportcsv'
import type { SyncStatus } from '@/types'
import AppIcon from '@/components/AppIcon'
import styles from './index.module.scss'
import classnames from 'classnames'

const GOALS = ['均衡', '减脂', '增肌', '控糖']
const PEOPLE = ['1', '2', '3', '4', '5', '6', '7', '8']
const AI_PREFS = ['自建网关优先（连不上自动回落厂商直连）', '只用厂商直连']

const MinePage: React.FC = () => {
  const { db, refresh } = useStore()
  const [dislikes, setDislikes] = useState(db.profile?.dislikes || '')
  const [sync, setSync] = useState<SyncStatus>({ local: db.syncVersion || 1, version: 1, updatedAt: null })
  const [aiConf, setAiConf] = useState(() => aiCfg())
  const [aiBusy, setAiBusy] = useState(false)
  const [conn, setConn] = useState<{ ok: boolean; text: string } | null>(null)
  const [serverBase, setServerBase] = useState(() => aiCfg().serverBase)
  const [apiKey, setApiKey] = useState(() => aiCfg().key)
  const [live, setLive] = useState(liveState())
  const [members, setMembers] = useState<FamilyMember[]>([])
  const [coop, setCoop] = useState<CoopRecord | null>(null)
  const [coopCode, setCoopCode] = useState('')

  useDidShow(() => {
    refresh()
    const session = loadSession()
    if (!session) return
    remoteStatus().then((r) => setSync({ local: db.syncVersion || 1, version: r.version, updatedAt: r.updatedAt || null }))
      .catch((e) => console.error('[Mine] syncStatus:', e))
    getMembers(db.familyId).then(setMembers).catch((e) => console.error('[Mine] members:', e))
    if (session) {
      getCurrentFamily(session.account, session.familyId)
        .then((f) => { if (f?.invite_code) api.setInvite(f.invite_code, f.id) })
        .catch((e) => console.error('[Mine] family:', e))
    }
  })

  const profile = db.profile || { people: 3, dislikes: '', goal: '均衡', enabled: true }
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

  /* ---------- 服务器连接 · AI 通道（对齐鸿蒙端「我的 → 服务器连接」） ---------- */
  const saveServerBase = () => {
    setAiConf(saveAiCfg({ serverBase: serverBase.trim().replace(/\/+$/, '') }))
    setConn(null)
    Taro.showToast({ title: '后端地址已保存', icon: 'success' })
  }

  /* 活同步 / 跨设备流转（对齐鸿蒙端 LiveSync / FlowBridge） */
  const doLiveSync = async () => {
    Taro.showLoading({ title: '同步中…' })
    try {
      await liveUpload(false)
      setLive(liveState())
      const remote = await remoteStatus()
      setSync({ local: db.syncVersion || 1, version: remote.version, updatedAt: remote.updatedAt || null })
      Taro.hideLoading()
      Taro.showToast({ title: '已同步到自建后端', icon: 'success' })
    } catch (e: any) {
      Taro.hideLoading()
      Taro.showToast({ title: e.message || '同步失败', icon: 'none' })
    }
  }

  const doFlowPublish = async () => {
    try {
      const r = await publishFlow()
      Taro.showToast({ title: '已发送流转（rev ' + (r.rev || '-') + '）', icon: 'none' })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '发送失败', icon: 'none' })
    }
  }

  const doFlowPull = async () => {
    try {
      const r = await pullFlow()
      Taro.showToast({ title: r.found ? ('已接收 ' + (r.from || '另一台设备') + ' 的流转') : '暂无新流转', icon: 'none' })
      if (r.found) refresh()
    } catch (e: any) {
      Taro.showToast({ title: e.message || '接收失败', icon: 'none' })
    }
  }

  /* 导出 CSV（小程序没有系统打印 API，口径是导出后微信发送/打开） */
  const doExport = async () => {
    try {
      const path = exportCsv()
      await Taro.shareFileMessage({ filePath: path, fileName: '启核图策-库存清单.csv' })
    } catch (e: any) {
      Taro.showToast({ title: (e && e.errMsg) || '导出失败', icon: 'none' })
    }
  }

  const doImport = async () => {
    try {
      let libId = db.libraries[0]?.id || ''
      if (!libId) {
        const next = await useStore.getState().invoke(() => api.createLibrary('导入资源'))
        libId = next.id
      }
      const count = await importCsv(libId)
      refresh()
      Taro.showToast({ title: '已导入 ' + count + ' 项', icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '导入失败', icon: 'none' })
    }
  }

  const doSubscribe = async () => {
    const r = await requestSubscribe()
    Taro.showModal({ title: r.ok ? '订阅已开启' : '订阅未开启', content: r.msg, showCancel: false })
  }

  const saveApiKey = () => {
    setAiConf(saveAiCfg({ key: apiKey.trim() }))
    setConn(null)
    Taro.showToast({ title: 'Key 已保存（仅存本机）', icon: 'success' })
  }

  const setPrefer = (idx: number) => {
    setAiConf(saveAiCfg({ prefer: idx === 1 ? 'direct' : 'gateway' }))
    setConn(null)
  }

  const testConn = async () => {
    if (aiBusy) return
    setAiBusy(true)
    Taro.showLoading({ title: '测试中…' })
    try {
      const r = await testAi()
      const text = r.gateway.ok
        ? '已连接 ' + r.gateway.base + (r.gateway.mode === 'lan-self-hosted' ? ' · 局域网自建服务器' : '') +
          (r.gateway.ai === 'ready' ? ' · 网关就绪' : r.gateway.ai === 'no-key' ? ' · 网关未配 Key' : '')
        : '未发现自建后端' + (r.direct.ok ? ' · 厂商直连可用（' + r.direct.model + '）' : ' · 直连也不可用');
      setConn({
        ok: r.gateway.ok || r.direct.ok,
        text: aiConf.prefer === 'direct' && r.direct.ok
          ? '已连接厂商直连 · ' + r.direct.model + ' · ' + r.direct.ms + 'ms'
          : text
      })
      Taro.hideLoading()
      Taro.showToast({ title: r.gateway.ok ? '自建网关正常' : (r.direct.ok ? '厂商直连可用' : '都连不上'), icon: 'none' })
    } catch (e: any) {
      Taro.hideLoading()
      setConn({ ok: false, text: e.message || '测试失败' })
      Taro.showToast({ title: e.message || '测试失败', icon: 'none' })
    } finally {
      setAiBusy(false)
    }
  }

  const editBudget = async () => {
    const r: any = await Taro.showModal({
      title: '月度预算',
      editable: true,
      placeholderText: String(db.budget),
      content: String(db.budget)
    } as any)
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

  const refreshSync = () => remoteStatus().then((r) => setSync({
    local: db.syncVersion || 1,
    version: r.version,
    updatedAt: r.updatedAt || null
  })).catch((e) => console.error('[Mine] refreshSync:', e))

  const doSync = async (kind: 'upload' | 'download') => {
    try {
      if (kind === 'upload') await liveUpload(false)
      else {
        await liveDownload()
        refresh()
      }
      Taro.showToast({ title: '同步完成', icon: 'success' })
      refreshSync()
    } catch (e: any) {
      console.error('[Mine] sync error:', e)
      const msg = e.status === 409 ? '后端版本较新，请先拉取再修改' : (e.message || '同步失败')
      const r = await Taro.showModal({ title: '同步冲突', content: msg + '\n是否用本机版本强制覆盖？', confirmText: '强制覆盖', cancelText: '取消', confirmColor: '#C53D3D' })
      if (r.confirm) {
        try {
          await liveUpload(true)
          Taro.showToast({ title: '已强制覆盖', icon: 'success' })
          refreshSync()
        } catch (e2: any) {
          Taro.showToast({ title: e2.message || '同步失败', icon: 'none' })
        }
      }
    }
  }

  const genInvite = async () => {
    const r = await Taro.showModal({ title: '刷新邀请码', content: '旧邀请码会立即失效，是否继续？' })
    if (!r.confirm) return
    try {
      const code = await createInvite(db.familyId)
      await useStore.getState().invoke(() => Promise.resolve(api.setInvite(code, db.familyId)))
      Taro.showToast({ title: '邀请码已刷新', icon: 'success' })
    } catch (e: any) {
      console.error('[Mine] invite error:', e)
      Taro.showToast({ title: e.message || '生成失败', icon: 'none' })
    }
  }

  const removeMember = async (phone: string, name: string) => {
    const r = await Taro.showModal({ title: '移除成员', content: `确定将「${name}」移出家庭空间吗？`, confirmColor: '#C53D3D' })
    if (!r.confirm) return
    try {
      await removeFamilyMember(db.familyId, phone)
      setMembers(await getMembers(db.familyId))
      Taro.showToast({ title: '已移除', icon: 'success' })
    } catch (e: any) {
      console.error('[Mine] memberRemove error:', e)
      Taro.showToast({ title: e.message || '移除失败', icon: 'none' })
    }
  }

  const makeCoop = async () => {
    try {
      const r = await createCoop('家庭协作牌桌')
      setCoop(r)
      setCoopCode(r.code)
      Taro.showToast({ title: '协作池已创建', icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '创建失败', icon: 'none' })
    }
  }

  const enterCoop = async () => {
    const code = coopCode.trim().toUpperCase()
    if (!code) return Taro.showToast({ title: '请输入邀请码', icon: 'none' })
    try {
      const r = await joinCoop(code)
      setCoop(r)
      Taro.showToast({ title: '已加入协作池', icon: 'success' })
    } catch (e: any) {
      Taro.showToast({ title: e.message || '加入失败', icon: 'none' })
    }
  }

  const clearChat = async () => {
    const r = await Taro.showModal({ title: '清空对话', content: '仅清除本机 AI 对话记录。', confirmColor: '#C53D3D' })
    if (r.confirm) {
      await useStore.getState().invoke(() => api.chatClear())
      Taro.showToast({ title: '已清空', icon: 'success' })
    }
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

      <View className={styles.card} onClick={() => Taro.navigateTo({ url: '/pages/lab/index' })}>
        <View className={styles.cardTitle}>
          <View className={styles.labTitleRow}>
            <AppIcon name="ai" size={34} />
            <Text className={styles.cardTitleText}>可信 AI 实验台</Text>
          </View>
          <Text className={styles.cardHint}>推演 · 轨迹 · 审计 ›</Text>
        </View>
        <Text className={styles.inviteMeta}>
          查看 AI 为什么这样建议，并在修改库存前推演影响。
        </Text>
      </View>

      {/* 偏好档案（P0-4，仅本地存储） */}
      {/* 服务器连接 · AI 通道（对齐鸿蒙端「我的 → 服务器连接」） */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>服务器连接 · AI 通道</Text>
          <Text className={styles.cardHint} onClick={testConn}>测试连接 ›</Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>当前通道</Text>
          <Text className={styles.pickerValue}>
            {conn ? conn.text : (aiConf.prefer === 'direct' ? '厂商直连（本机 Key）' : '自建网关优先')}
          </Text>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>后端地址</Text>
          <Input
            className={styles.input}
            value={serverBase}
            placeholder="留空自动探测 127.0.0.1:3000"
            placeholderClass={styles.inputPlaceholder}
            onInput={(e) => setServerBase(e.detail.value)}
            onBlur={saveServerBase}
            onConfirm={saveServerBase}
          />
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>通道策略</Text>
          <Picker mode="selector" range={AI_PREFS} value={aiConf.prefer === 'direct' ? 1 : 0} onChange={(e) => setPrefer(parseInt(String(e.detail.value), 10))}>
            <Text className={styles.pickerValue}>{aiConf.prefer === 'direct' ? '厂商直连' : '自建网关优先'} ▾</Text>
          </Picker>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>厂商 Key</Text>
          <Input
            className={styles.input}
            value={apiKey}
            password
            placeholder="sk-…"
            placeholderClass={styles.inputPlaceholder}
            onInput={(e) => setApiKey(e.detail.value)}
            onBlur={saveApiKey}
            onConfirm={saveApiKey}
          />
        </View>
        <Text className={styles.inviteMeta}>
          快答与构图 0 次模型调用；仅模型类问题与社区摘要走大模型（单请求 ≤2 次）。优先走自建后端 /api/ai/*，
          连不上自动回落厂商直连，都失败则降级本地回答；Key 仅存本机。
        </Text>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>活同步</Text>
          <Text className={styles.pickerValue}>{live || '待连接'}</Text>
          <Text className={styles.cardHint} onClick={doLiveSync}>立即同步 ›</Text>
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnPrimary)} onClick={doFlowPublish}><Text>发送流转</Text></View>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={doFlowPull}><Text>接收流转</Text></View>
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={doExport}><Text>导出 CSV</Text></View>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={doImport}><Text>导入 CSV</Text></View>
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={doSubscribe}><Text>开启提醒</Text></View>
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
          <Picker mode="selector" range={PEOPLE} value={peopleIndex} onChange={(e) => saveProfile({ people: parseInt(PEOPLE[parseInt(String(e.detail.value), 10)], 10) })}>
            <Text className={styles.pickerValue}>{profile.people} 人 ▾</Text>
          </Picker>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>饮食目标</Text>
          <Picker mode="selector" range={GOALS} value={goalIndex} onChange={(e) => saveProfile({ goal: GOALS[parseInt(String(e.detail.value), 10)] })}>
            <Text className={styles.pickerValue}>{profile.goal} ▾</Text>
          </Picker>
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>忌口</Text>
          <Input className={styles.input} value={dislikes} placeholder="如：香菜、苦瓜" placeholderClass={styles.inputPlaceholder} onInput={(e) => setDislikes(e.detail.value)} onBlur={saveDislikes} onConfirm={saveDislikes} />
        </View>
        <View className={styles.row}>
          <Text className={styles.rowLabel}>注入 AI 规划</Text>
          <Switch checked={profile.enabled !== false} color="#57D794" onChange={(e) => saveProfile({ enabled: e.detail.value })} />
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

      {/* MySQL 工作区同步 */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>云端同步</Text>
          <Text className={styles.cardHint}>本地 v{sync.local} · 云端 v{sync.version}{sync.updatedAt ? ' · ' + sync.updatedAt : ''}</Text>
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={() => doSync('upload')}><AppIcon name="upload" size={26} /><Text>上传快照</Text></View>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={() => doSync('download')}><AppIcon name="download" size={26} /><Text>拉取后端</Text></View>
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnPrimary)} onClick={refreshSync}><Text>刷新后端版本</Text></View>
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
          <View className={classnames(styles.btn, styles.btnPrimary)} onClick={genInvite}><Text>刷新邀请码</Text></View>
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

      {/* 家庭协作池：与 Web/鸿蒙共用后端 */}
      <View className={styles.card}>
        <View className={styles.cardTitle}>
          <Text className={styles.cardTitleText}>家庭协作池</Text>
          <Text className={styles.cardHint}>{coop ? coop.code : '跨设备实时协作'}</Text>
        </View>
        {coop ? (
          <Text className={styles.inviteMeta}>{coop.name} · {coop.members.length} 人 · 点击下方可刷新成员</Text>
        ) : (
          <Text className={styles.inviteMeta}>创建协作池，家人输入邀请码即可加入。</Text>
        )}
        <View className={styles.row}>
          <Text className={styles.rowLabel}>协作邀请码</Text>
          <Input className={styles.input} value={coopCode} placeholder="输入 6 位邀请码"
            placeholderClass={styles.inputPlaceholder} onInput={(e) => setCoopCode(e.detail.value)} />
        </View>
        <View className={styles.btnRow}>
          <View className={classnames(styles.btn, styles.btnPrimary)} onClick={makeCoop}><Text>创建协作池</Text></View>
          <View className={classnames(styles.btn, styles.btnGhost)} onClick={enterCoop}><Text>加入协作池</Text></View>
        </View>
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
      </View>

      <View className={styles.logoutBtn} onClick={logout}><Text>退出登录</Text></View>
    </View>
  )
}

export default MinePage
