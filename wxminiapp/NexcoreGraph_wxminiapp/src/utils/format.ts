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
    case 'red': return '#C53D3D'
    case 'amber': return '#B87D16'
    case 'teal': return '#5B893B'
    default: return '#6B7C8C'
  }
}

export function expColor(expDays: number): string {
  if (expDays < 9000 && expDays <= 3) return '#C53D3D'
  if (expDays < 9000 && expDays <= 7) return '#B87D16'
  return '#6B7C8C'
}

export function expLabel(expDays: number): string {
  if (expDays >= 9000) return '长期'
  return expDays <= 0 ? '已过期' : expDays + ' 天'
}
