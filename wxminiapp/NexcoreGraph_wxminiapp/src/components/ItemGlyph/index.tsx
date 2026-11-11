import React from 'react'
import { Image, View } from '@tarojs/components'
import AppIcon, { type IconName } from '@/components/AppIcon'
import eggs from '@/assets/photos/eggs.jpg'
import milk from '@/assets/photos/milk.jpg'
import tomato from '@/assets/photos/tomato.jpg'
import bokchoy from '@/assets/photos/bokchoy.jpg'
import pork from '@/assets/photos/pork.jpg'
import styles from './index.module.scss'
import classnames from 'classnames'

const PHOTOS: Record<string, string> = {
  egg: eggs,
  milk: milk,
  tomato: tomato,
  greens: bokchoy,
  bokchoy: bokchoy,
  pork: pork
}

const NAME_PHOTOS: Array<[RegExp, string]> = [
  [/鸡蛋|鸭蛋/, eggs],
  [/牛奶|鲜奶|酸奶/, milk],
  [/番茄|西红柿/, tomato],
  [/青菜|小白菜|生菜|菠菜/, bokchoy],
  [/猪肉|五花肉|排骨/, pork]
]

function fallbackIcon(name: string, kbKey?: string): IconName {
  if (/药|胶囊|片剂/.test(name)) return 'alerts'
  if (/书|册|教材/.test(name)) return 'library'
  if (/工具|螺丝|锤|钳/.test(name)) return 'settings'
  if (/衣|裤|鞋|帽/.test(name)) return 'package'
  if (PHOTOS[String(kbKey || '')]) return 'photo'
  return 'package'
}

interface Props {
  name: string
  img?: string
  kbKey?: string
  size?: number
  className?: string
}

const ItemGlyph: React.FC<Props> = ({ name, img, kbKey, size = 88, className }) => {
  const named = NAME_PHOTOS.filter(([pattern]) => pattern.test(name))[0]
  const source = img || PHOTOS[String(kbKey || '')] || (named && named[1]) || ''
  return (
    <View
      className={classnames(styles.glyph, className)}
      style={{ width: size + 'rpx', height: size + 'rpx' }}
    >
      {source ? (
        <Image className={styles.photo} src={source} mode="aspectFill" lazyLoad />
      ) : (
        <View className={styles.fallback}>
          <AppIcon name={fallbackIcon(name, kbKey)} size={Math.round(size * 0.48)} />
        </View>
      )}
    </View>
  )
}

export default ItemGlyph
