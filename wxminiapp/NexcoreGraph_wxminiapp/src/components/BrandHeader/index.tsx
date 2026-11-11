import React from 'react'
import { Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import AppIcon, { type IconName } from '@/components/AppIcon'
import { useStore } from '@/store/useStore'
import logo from '@/assets/logo.png'
import styles from './index.module.scss'

interface Props {
  onSearch?: () => void
}

const BrandHeader: React.FC<Props> = ({ onSearch }) => {
  const { db } = useStore()
  const info = Taro.getWindowInfo()
  const menu = Taro.getMenuButtonBoundingClientRect()
  const hasCapsule = Boolean(menu && menu.left > 0 && menu.width > 0)
  const top = Math.max(0, hasCapsule ? menu.top : (info.statusBarHeight || 20))
  const height = Math.max(32, hasCapsule ? menu.height : 36)
  const right = hasCapsule ? Math.max(16, info.windowWidth - menu.left + 8) : 16

  const go = (url: string) => Taro.navigateTo({ url })
  const actions: Array<{ icon: IconName; label: string; run: () => void }> = [
    { icon: 'alerts', label: '预警', run: () => go('/pages/alerts/index') },
    { icon: 'shopping', label: '采购', run: () => go('/pages/shopping/index') },
    { icon: 'search', label: '搜索', run: onSearch || (() => Taro.switchTab({ url: '/pages/library/index' })) }
  ]

  return (
    <View
      className={styles.header}
      style={{ paddingTop: top + 'px', paddingRight: right + 'px' }}
    >
      <View className={styles.row} style={{ height: height + 'px' }}>
        <View className={styles.brand}>
          <Image className={styles.logo} src={logo} mode="aspectFit" />
          <View className={styles.brandText}>
            <Text className={styles.brandName}>启核图策</Text>
            <Text className={styles.family}>{db.family?.name || '家庭资源空间'}</Text>
          </View>
        </View>
        <View className={styles.actions}>
          {actions.map((action) => (
            <View
              key={action.icon}
              className={styles.action}
              onClick={action.run}
              hoverClass={styles.actionHover}
            >
              <AppIcon name={action.icon} size={28} />
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

export default BrandHeader
