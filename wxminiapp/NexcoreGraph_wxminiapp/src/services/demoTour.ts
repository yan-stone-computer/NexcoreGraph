export interface TourStep {
  id: string
  page: string
  title: string
  body: string
  nextLabel: string
}

export const TOUR: TourStep[] = [
  {
    id: 'today',
    page: '/pages/home/index',
    title: '今天先做什么',
    body: '所有建议都由库存、临期和低库存规则计算，模型只负责解释。',
    nextLabel: '看 30 秒建档'
  },
  {
    id: 'intake',
    page: '/pages/intake/index',
    title: '30 秒建档',
    body: '拍照、小票、条码和语音可以交叉验证，只让用户补真正缺失的字段。',
    nextLabel: '看 What-if 推演'
  },
  {
    id: 'simulate',
    page: '/pages/lab/index',
    title: '先推演，再执行',
    body: '在改库存前先看清购买、消耗或删减对预算、临期和健康度的影响。',
    nextLabel: '看权限沙箱'
  },
  {
    id: 'policy',
    page: '/pages/lab/index',
    title: '权限沙箱',
    body: '模型只能提出动作，角色权限、证据和风险策略由代码判断。',
    nextLabel: '看证据与审计'
  },
  {
    id: 'audit',
    page: '/pages/lab/index',
    title: '证据与审计',
    body: '每次回答可展开检索轨迹，每次修改可撤销并保留审计事件。',
    nextLabel: '完成导览'
  }
]

export function nextTourStep(currentId: string): TourStep | null {
  const index = TOUR.findIndex((step) => step.id === currentId)
  return index >= 0 ? TOUR[index + 1] || null : TOUR[0] || null
}
