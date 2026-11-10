export type DomainEventType =
  | 'item.created'
  | 'item.qty_changed'
  | 'item.moved'
  | 'item.deleted'
  | 'shopping.added'
  | 'plan.executed'
  | 'plan.reverted'
  | 'rule.changed'
  | 'task.completed'
  | 'agent.policy_evaluated'

export interface DomainEvent {
  id: string
  familyId: string
  type: DomainEventType
  targetId: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  actor: string
  deviceId: string
  createdAt: number
  idempotencyKey: string
  correlationId?: string
  causationId?: string
  prevHash?: string
  hash?: string
  syncStatus: 'pending' | 'sealed' | 'failed'
}

export type NewDomainEvent = Omit<DomainEvent, 'id' | 'createdAt' | 'syncStatus'>

let sequence = 0
let events: DomainEvent[] = []
const byIdempotency = new Map<string, DomainEvent>()

function keyOf(input: Pick<NewDomainEvent, 'familyId' | 'idempotencyKey'>): string {
  return input.familyId + ':' + input.idempotencyKey
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value))
}

export function appendJournalEvent(input: NewDomainEvent): DomainEvent {
  const existing = byIdempotency.get(keyOf(input))
  if (existing) return existing

  const event: DomainEvent = {
    ...clone(input),
    id: 'evt-' + Date.now().toString(36) + '-' + (++sequence).toString(36),
    createdAt: Date.now(),
    syncStatus: 'pending'
  }
  events = [event].concat(events).slice(0, 500)
  byIdempotency.set(keyOf(event), event)
  return event
}

export function compensateJournalEvent(eventId: string, actor: string): DomainEvent {
  const source = events.find((event) => event.id === eventId)
  if (!source) throw new Error('事件不存在，无法撤销')
  if (!source.before && !source.after) throw new Error('该事件没有可补偿状态')

  return appendJournalEvent({
    familyId: source.familyId,
    type: source.type,
    targetId: source.targetId,
    before: clone(source.after),
    after: clone(source.before),
    actor,
    deviceId: source.deviceId,
    idempotencyKey: 'undo:' + source.id + ':' + actor,
    correlationId: source.correlationId ? 'undo:' + source.correlationId : 'undo:' + source.id,
    causationId: source.id
  })
}

export function journalTimeline(limit = 50): DomainEvent[] {
  return events.slice(0, Math.max(0, limit)).map(clone)
}

export function findJournalEvent(id: string): DomainEvent | null {
  const event = events.find((row) => row.id === id)
  return event ? clone(event) : null
}

export function hydrateJournal(value: unknown): DomainEvent[] {
  const rows = Array.isArray(value) ? value : []
  events = []
  byIdempotency.clear()
  rows.slice(0, 500).forEach((row) => {
    if (!row || typeof row !== 'object') return
    const event = clone(row as DomainEvent)
    events.push(event)
    byIdempotency.set(keyOf(event), event)
  })
  events.sort((a, b) => b.createdAt - a.createdAt)
  return journalTimeline(500)
}

export function markJournalEventSynced(id: string, hash: string, prevHash?: string): DomainEvent | null {
  const event = events.find((row) => row.id === id)
  if (!event) return null
  event.syncStatus = 'sealed'
  event.hash = hash
  event.prevHash = prevHash
  return clone(event)
}

export function markJournalEventFailed(id: string): void {
  const event = events.find((row) => row.id === id)
  if (event) event.syncStatus = 'failed'
}

export function clearJournalForTest(): void {
  sequence = 0
  events = []
  byIdempotency.clear()
}
