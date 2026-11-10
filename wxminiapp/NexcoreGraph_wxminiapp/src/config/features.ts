export interface FeatureFlags {
  eventJournal: boolean
  simulation: boolean
  policySandbox: boolean
  temporalGraph: boolean
  observationFusion: boolean
  spaceMap: boolean
  automationRules: boolean
  familyTasks: boolean
  evaluationConsole: boolean
  guidedTour: boolean
}

/**
 * Wave 1 的功能开关。高级能力失败时关闭对应项，
 * 不让实验性模块影响拍照入库、同步和 AI 问答主流程。
 */
export const FEATURES: FeatureFlags = {
  eventJournal: true,
  simulation: true,
  policySandbox: true,
  temporalGraph: true,
  observationFusion: false,
  spaceMap: false,
  automationRules: false,
  familyTasks: false,
  evaluationConsole: false,
  guidedTour: true
}

export function enabled(flag: keyof FeatureFlags): boolean {
  return FEATURES[flag]
}
