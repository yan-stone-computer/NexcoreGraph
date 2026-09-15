// 通用工具函数
import type { AlertTone } from '@/types'

export function esc(s: string | number | null | undefined): string {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function greetWord(): string {
  const h = new Date().getHours()
  if (h < 6) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
}

/* 预警色调 → 色值 */
export function toneColor(tone: AlertTone): string {
  switch (tone) {
    case 'red': return '#C03A2B'
    case 'amber': return '#B9791F'
    case 'teal': return '#2F7D4F'
    default: return '#7C776C'
  }
}

export function expColor(expDays: number): string {
  if (expDays < 9000 && expDays <= 3) return '#C03A2B'
  if (expDays < 9000 && expDays <= 7) return '#B9791F'
  return '#7C776C'
}

export function expLabel(expDays: number): string {
  if (expDays >= 9000) return '长期'
  return expDays <= 0 ? '已过期' : expDays + ' 天'
}
