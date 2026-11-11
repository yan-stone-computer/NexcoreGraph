import React from 'react'
import { Image, View } from '@tarojs/components'
import AppIcon, { libraryIcon } from '@/components/AppIcon'
import fridge from '@/assets/photos/fridge.jpg'
import pantry from '@/assets/photos/pantry.webp'
import styles from './index.module.scss'
import classnames from 'classnames'

const TONES: Record<string, { fg: string; bg: string }> = {
  teal: { fg: '#0F8C87', bg: '#D7F2F0' },
  indigo: { fg: '#1477A3', bg: '#D8EEF6' },
  red: { fg: '#C24B4B', bg: '#F5E2E0' },
  slate: { fg: '#566873', bg: '#E3E9ED' },
  lime: { fg: '#5B893B', bg: '#EAF4DC' },
  brown: { fg: '#8A5F28', bg: '#F1E6D6' },
  orange: { fg: '#C2701F', bg: '#FAE4CE' },
  violet: { fg: '#5F55A0', bg: '#E8E5F4' },
  amber: { fg: '#A8710F', bg: '#F5E9CE' }
}

interface Props {
  icon: string
  name: string
  tone?: string
  size?: number
  cover?: boolean
  className?: string
}

const LibraryArt: React.FC<Props> = ({ icon, name, tone = 'teal', size = 88, cover, className }) => {
  const colors = TONES[tone] || TONES.teal
  const photo = icon === 'fridge' || /冰箱/.test(name)
    ? fridge
    : cover && /储物|厨房|食品|零食/.test(name)
      ? pantry
      : ''

  return (
    <View
      className={classnames(styles.art, cover && styles.cover, className)}
      style={cover ? undefined : { width: size + 'rpx', height: size + 'rpx', background: colors.bg }}
    >
      {photo ? (
        <>
          <Image className={styles.photo} src={photo} mode="aspectFill" lazyLoad />
          <View className={styles.photoShade} />
        </>
      ) : null}
      {!photo ? (
        <View className={styles.iconTile}>
          <AppIcon name={libraryIcon(icon)} size={Math.round(size * 0.5)} />
        </View>
      ) : null}
      {cover ? (
        <View className={styles.coverBadge} style={{ color: colors.fg, background: colors.bg }}>
          <AppIcon name={libraryIcon(icon)} size={26} />
        </View>
      ) : null}
    </View>
  )
}

export default LibraryArt
