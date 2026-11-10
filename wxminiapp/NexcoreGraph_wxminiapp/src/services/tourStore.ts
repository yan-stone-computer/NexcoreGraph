import Taro from '@tarojs/taro'
import { TOUR, type TourStep } from '@/services/demoTour'

const LS_KEY = 'nexcore_guided_tour_v1'

function save(id: string | null): void {
  try {
    Taro.setStorageSync(LS_KEY, id || '')
  } catch (e) {
    console.warn('[tourStore] save failed:', e)
  }
}

export function startTour(): TourStep {
  save(TOUR[0].id)
  return TOUR[0]
}

export function currentTourStep(): TourStep | null {
  try {
    const id = String(Taro.getStorageSync(LS_KEY) || '')
    return TOUR.find((step) => step.id === id) || null
  } catch (e) {
    return null
  }
}

export function advanceTour(currentId: string): TourStep | null {
  const index = TOUR.findIndex((step) => step.id === currentId)
  const next = index >= 0 ? TOUR[index + 1] || null : TOUR[0] || null
  save(next ? next.id : '')
  return next
}

export function stopTour(): void {
  save('')
}
