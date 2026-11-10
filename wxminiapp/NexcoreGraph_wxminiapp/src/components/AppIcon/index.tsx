import React from 'react'
import { Image } from '@tarojs/components'
import ai from '@/assets/ai-avatar-144.png'
import chat from '@/assets/icons/chat.png'
import home from '@/assets/icons/home.png'
import library from '@/assets/icons/library.png'
import mine from '@/assets/icons/mine.png'
import camera from '@/assets/icons/camera.png'
import graph from '@/assets/icons/graph.png'
import plans from '@/assets/icons/plans.png'
import alerts from '@/assets/icons/alerts.png'
import shopping from '@/assets/icons/shopping.png'
import stats from '@/assets/icons/stats.png'
import family from '@/assets/icons/family.png'
import plus from '@/assets/icons/plus.png'
import search from '@/assets/icons/search.png'
import settings from '@/assets/icons/settings.png'
import upload from '@/assets/icons/upload.png'
import download from '@/assets/icons/download.png'
import share from '@/assets/icons/share.png'
import refresh from '@/assets/icons/refresh.png'
import warning from '@/assets/icons/warning.png'
import packageIcon from '@/assets/icons/package.png'
import server from '@/assets/icons/server.png'
import key from '@/assets/icons/key.png'
import check from '@/assets/icons/check.png'
import trash from '@/assets/icons/trash.png'
import back from '@/assets/icons/back.png'
import send from '@/assets/icons/send.png'
import volume from '@/assets/icons/volume.png'
import mail from '@/assets/icons/mail.png'
import qrcode from '@/assets/icons/qrcode.png'
import addUser from '@/assets/icons/addUser.png'
import dashboard from '@/assets/icons/dashboard.png'
import robot from '@/assets/icons/robot.png'
import photo from '@/assets/icons/photo.png'
import database from '@/assets/icons/database.png'
import clock from '@/assets/icons/clock.png'
import flame from '@/assets/icons/flame.png'
import calendar from '@/assets/icons/calendar.png'

export type IconName =
  | 'ai' | 'chat' | 'home' | 'library' | 'mine' | 'camera' | 'graph'
  | 'plans' | 'alerts' | 'shopping' | 'stats' | 'family' | 'plus' | 'search'
  | 'settings' | 'upload' | 'download' | 'share' | 'refresh' | 'warning'
  | 'package' | 'server' | 'key' | 'check' | 'trash' | 'back' | 'send'
  | 'volume' | 'mail' | 'qrcode' | 'addUser' | 'dashboard' | 'robot'
  | 'photo' | 'database'
  | 'clock' | 'flame' | 'calendar'

const ICONS: Record<IconName, string> = {
  ai, chat, home, library, mine, camera, graph, plans, alerts, shopping,
  stats, family, plus, search, settings, upload, download, share, refresh,
  warning, package: packageIcon, server, key, check, trash, back, send,
  volume, mail, qrcode, addUser, dashboard, robot, photo, database,
  clock, flame, calendar
}

export function libraryIcon(name: string): IconName {
  if (name === 'fridge') return 'photo'
  if (name === 'medicine') return 'alerts'
  if (name === 'tools') return 'settings'
  if (name === 'books') return 'library'
  if (name === 'pets' || name === 'pet') return 'family'
  return 'package'
}

interface Props {
  name: IconName
  size?: number
  className?: string
}

const AppIcon: React.FC<Props> = ({ name, size = 36, className }) => (
  <Image
    className={className}
    src={ICONS[name]}
    mode="aspectFit"
    style={{ width: size + 'rpx', height: size + 'rpx', display: 'inline-block', flexShrink: 0 }}
  />
)

export default AppIcon
