import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { backendReady, loginByCode, requestCode } from '@/services/auth'
import logoPng from '@/assets/ai-avatar-512.png'
import styles from './index.module.scss'
import classnames from 'classnames'

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [serverText, setServerText] = useState('正在连接自建后端…')
  const [hint, setHint] = useState('')
  const timer = useRef<any>(-1)

  /* 标明连接目标：登录走的是你自己电脑上的局域网服务器，不是云端（与鸿蒙端登录页同口径） */
  useEffect(() => {
    backendReady().then((base) => {
      setServerText(base ? '已连接 ' + base + '（局域网自建服务器）'
        : '未连接后端：请启动服务，或在「我的 → 服务器连接」填写地址')
    })
    return () => { if (timer.current !== -1) clearInterval(timer.current) }
  }, [])

  const phoneOk = () => /^1\d{10}$/.test(phone.trim()) || /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(phone.trim())

  const sendCode = async () => {
    if (sending || cooldown > 0) return
    if (!phoneOk()) {
      Taro.showToast({ title: '请输入手机号或邮箱', icon: 'none' })
      return
    }
    setSending(true)
    try {
      const r = await requestCode(phone.trim())
      if (!r.ok) throw new Error(r.error || '验证码下发失败')
      setHint(r.hint || '')
      Taro.showToast({ title: '验证码已下发', icon: 'none' })
      setCooldown(60)
      timer.current = setInterval(() => {
        setCooldown((c) => {
          if (c <= 1) { clearInterval(timer.current); timer.current = -1; return 0 }
          return c - 1
        })
      }, 1000)
    } catch (e: any) {
      Taro.showToast({ title: e.message || '验证码下发失败', icon: 'none' })
    } finally {
      setSending(false)
    }
  }

  const doLogin = async () => {
    if (busy) return
    if (!phoneOk()) {
      Taro.showToast({ title: '请输入手机号或邮箱', icon: 'none' })
      return
    }
    if (code.trim().length !== 6) {
      Taro.showToast({ title: '请输入 6 位验证码', icon: 'none' })
      return
    }
    setBusy(true)
    try {
      const r = await loginByCode(phone.trim(), code.trim())
      if (!r.ok) throw new Error(r.error || '登录失败')
      const family = (r.families || [])[0]
      if (!r.token || !family) throw new Error('后端登录成功，但没有返回服务令牌或家庭空间')
      await useStore.getState().enterVerifiedWorkspace({
        token: r.token,
        account: phone.trim(),
        nickname: r.nickname || phone.trim(),
        role: r.role || family.role || '成员',
        families: r.families || [],
        familyId: family.id,
        familyName: family.name,
        createdAt: Date.now()
      })
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => Taro.reLaunch({ url: '/pages/home/index' }), 400)
    } catch (e: any) {
      console.error('[Login] login error:', e)
      Taro.showToast({ title: e.message || '登录失败', icon: 'none' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className={styles.page}>
      <View className={styles.logoBox}>
        <Image className={styles.logoImg} src={logoPng} mode="aspectFit" />
      </View>
      <Text className={styles.title}>启核图策</Text>
      <Text className={styles.subEn}>NexcoreGraph · 家庭资源智能管家</Text>
      <Text className={styles.slogan}>拍照建库 · 智能规划 · 家庭协作</Text>
      <Text className={styles.slogan}>{serverText}</Text>

      <View className={styles.formCard}>
        <View className={styles.field}>
          <Text className={styles.label}>手机号 / 邮箱</Text>
          <Input
            className={styles.input}
            value={phone}
            placeholder="输入邮箱地址，如 you@example.com"
            placeholderClass={styles.inputPlaceholder}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className={styles.field}>
          <Text className={styles.label}>验证码</Text>
          <Input
            className={styles.input}
            value={code}
            type="number"
            maxlength={6}
            password={false}
            placeholder="6 位验证码"
            placeholderClass={styles.inputPlaceholder}
            onInput={(e) => setCode(e.detail.value)}
            onConfirm={doLogin}
          />
          <View className={styles.loginBtn} onClick={sendCode} hoverClass={styles.loginBtn}>
            <Text>{sending ? '下发中…' : cooldown > 0 ? cooldown + 's 后重发' : '获取验证码'}</Text>
          </View>
        </View>
        {hint ? <Text className={styles.slogan}>{hint}</Text> : null}
        <View
          className={classnames(styles.loginBtn, busy && styles.loginDisabled)}
          onClick={doLogin}
          hoverClass={styles.loginBtn}
        >
          <Text>{busy ? '登录中…' : '登录'}</Text>
        </View>
      </View>

      <View className={styles.hintCard}>
        <Text className={styles.hintTitle}>真实账号登录</Text>
        <Text className={styles.hintLine}>首次登录自动创建家庭空间，数据保存到自建后端 MySQL。</Text>
        <Text className={styles.hintLine}>邮箱验证码 5 分钟内有效；手机号需后端配置短信通道。</Text>
      </View>

      <Text className={styles.footer}>账号由后端校验 · 工作区保存到 MySQL</Text>
    </View>
  )
}

export default LoginPage
