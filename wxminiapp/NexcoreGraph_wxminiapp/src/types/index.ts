// 启核图策 · 小程序全局类型定义

export interface Item {
  id: string
  no: string
  name: string
  emoji: string
  img?: string
  kbKey?: string
  qty: number
  unit: string
  price: number
  priceSrc: string
  expDays: number
  pos: string
  lowAt: number
  addedAt: number
  private?: boolean
  med?: boolean
  warrantyDays?: number
  expiring?: boolean
}

export interface Library {
  id: string
  name: string
  icon: string
  tone: string
  desc: string
  count: number
  items: Item[]
  coop?: boolean
  coopAddOnly?: boolean
  coopFrom?: string
}

export type AlertTone = 'red' | 'amber' | 'teal' | 'muted'

export interface Alert {
  id: string
  type: string
  icon: string
  tone: AlertTone
  text: string
  meta: string
}

export interface PlanIngredient {
  name: string
  qty: string
}

export interface PlanSnapshot {
  id: string
  name: string
  before: number
  after: number
}

export interface Plan {
  id: number
  title: string
  priority: '高' | '中'
  reason: string
  time: string
  source: string
  kcal: number
  prot: number
  used: PlanIngredient[]
  missing: PlanIngredient[]
  selected: string[]
  status: 'pending' | 'done'
  creative?: boolean
  snapshot?: PlanSnapshot[]
}

export interface ShoppingItem {
  name: string
  qty: string
  src: string
}

export interface AdjustCard {
  type: 'adjust' | 'shopping_add'
  itemId?: string
  name: string
  unit?: string
  from?: number
  to?: number
  reason?: string
  lib?: string
  qty?: string
  /** 卡片是否已确认生效 / 已取消（F5.5：先预览后生效） */
  done?: boolean
  cancelled?: boolean
}

export interface ChatMsg {
  who: 'me' | 'ai'
  text: string
  time?: string
  card?: AdjustCard
  model?: boolean
  action?: string
  plans?: number[]
  src?: string
}

export interface Profile {
  people: number
  dislikes: string
  goal: string
  enabled: boolean
}

export interface DailyTask {
  id: number
  text: string
  done: boolean
}

export interface TrendData {
  consume: number[]
  purchase: number[]
  labels: string[]
}

export interface Stats {
  totalItems: number
  expiringN: number
  lowN: number
  spent: number
  budget: number
  planPct: number
  planDone: number
  planTotal: number
  trend: TrendData
  topFood: string
  mealsLeft: number
  daysLeft: number
  wasteN: number
  health: number
}

export interface User {
  name: string
  phone: string
  role: string
  initial: string
}

export interface FamilyMember {
  phone: string
  name: string
  role: string
}

export interface Family {
  id: string
  name: string
  memberCount: number
}

export interface UserRow {
  phone: string
  name: string
  role: string
  familyId: string
  disabled: boolean
  createdAt: string
}

export interface Invite {
  code: string
  familyId: string
  expiresInDays: number
  used: number
  max: number
  revoked: boolean
  createdAt?: number
}

export interface LogEntry {
  action: string
  detail: string
  at: string
  ts: number
  kind?: string
  name?: string
  n?: number
  day?: string
  undo?: { id: string; qty: number }
}

export interface AiUsage {
  route: string
  model: string
  ms: number
  cost: number
  at: string
  day: string
}

export interface AppConfig {
  model: string
  visionModel: string
  webSearch: boolean
  searchCacheMin: number
  rateLimitPerDay: number
  unitPrice: number
  visionPrice: number
  identifyThreshold: number
  pushTemplate: string
  knowledgeVersion: number
}

export interface Settings {
  private: boolean
  chat: boolean
  expiry: boolean
  digest: boolean
  low: boolean
  alertSoon: number
  alertCritical: number
}

export interface HistoryRow {
  d: number
  consume: number
  purchase: number
}

export interface Workbench {
  name: string
  expires: string
  code: string
  myDeck: string[]
  seats: Record<string, any>[]
  chat: Record<string, any>[]
  members: Record<string, any>[]
  plan: Record<string, any>
}

export interface DB {
  user?: User
  family?: Family
  familyId: string
  families: Family[]
  users: UserRow[]
  members: Record<string, FamilyMember[]>
  invite: Invite
  theme: string
  settings: Settings
  profile: Profile
  budget: number
  logs: LogEntry[]
  aiUsage: AiUsage[]
  config: AppConfig
  libraries: Library[]
  alerts: Alert[]
  plans: Plan[]
  shopping: ShoppingItem[]
  workbench: Workbench
  chat: ChatMsg[]
  daily: DailyTask[]
  intake: Record<string, any>
  history7: HistoryRow[]
  meta?: Record<string, any>
  syncVersion?: number
  knowledge?: Record<string, any>
}

export interface SyncStatus {
  local: number
  version: number
  updatedAt: string | null
}

export interface IntakeResult {
  id: string
  emoji: string
  img: string
  name: string
  category: string
  qty: string
  unit: string
  pos: string
  exp: string
  expSrc: string
  expDays: number
  kbKey: string
  price: string
  priceSrc: string
  attention: boolean
}
