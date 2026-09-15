import React, { useState } from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useStore } from '@/store/useStore'
import { db } from '@/services/api'
import styles from './index.module.scss'
import classnames from 'classnames'
import logo from '@/assets/logo.png'

const LoginPage: React.FC = () => {
  const [phone, setPhone] = useState('13800138000')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)

  const doLogin = async () => {
    if (busy) return
    if (!phone.trim()) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    setBusy(true)
    try {
      await useStore.getState().login(phone.trim(), code.trim())
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
      <View className={styles.logo}>
        <Image className={styles.logoImg} src={logo} mode="aspectFit" />
      </View>
      <Text className={styles.title}>启核图策</Text>
      <Text className={styles.enName}>NexcoreGraph</Text>
      <Text className={styles.slogan}>家庭资源智能管家 · 记录 · 预警 · 方案</Text>

      <View className={styles.formCard}>
        <View className={styles.field}>
          <Text className={styles.label}>手机号</Text>
          <Input
            className={styles.input}
            value={phone}
            type="number"
            maxlength={11}
            placeholder="请输入手机号"
            placeholderClass={styles.inputPlaceholder}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className={styles.field}>
          <Text className={styles.label}>验证码（演示码 123456）</Text>
          <Input
            className={styles.input}
            value={code}
            type="number"
            maxlength={6}
            password={false}
            placeholder="请输入验证码"
            placeholderClass={styles.inputPlaceholder}
            onInput={(e) => setCode(e.detail.value)}
            onConfirm={doLogin}
          />
        </View>
        <View
          className={classnames(styles.loginBtn, busy && styles.loginDisabled)}
          onClick={doLogin}
          hoverClass={styles.loginBtn}
        >
          <Text>{busy ? '登录中…' : '登录'}</Text>
        </View>
      </View>

      <View className={styles.hintCard}>
        <Text className={styles.hintTitle}>演示账号（验证码 123456）</Text>
        {db.users.map((u) => (
          <Text key={u.phone} className={styles.hintLine}>
            {u.name}（{u.role}）：{u.phone}{u.disabled ? ' · 已禁用' : ''}
          </Text>
        ))}
      </View>

      <Text className={styles.footer}>登录后数据默认保存在本机，支持与家庭空间同步</Text>
    </View>
  )
}

export default LoginPage
