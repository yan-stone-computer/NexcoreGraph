import Taro from '@tarojs/taro'

const KEY = 'nexcore:ai-pending-context'

export interface AiWorkbenchContext {
  libId?: string
  query?: string
}

/** AI 工作台是 tabBar 页面，不能 navigateTo 携带 query，先暂存上下文再 switchTab。 */
export async function openAiWorkbench(context: AiWorkbenchContext = {}): Promise<void> {
  Taro.setStorageSync(KEY, {
    libId: context.libId || '',
    query: context.query || ''
  })
  await Taro.switchTab({ url: '/pages/workbench/index' })
}

export function consumeAiWorkbenchContext(): AiWorkbenchContext | null {
  try {
    const value = Taro.getStorageSync(KEY)
    Taro.removeStorageSync(KEY)
    return value && typeof value === 'object' ? value : null
  } catch (e) {
    return null
  }
}
