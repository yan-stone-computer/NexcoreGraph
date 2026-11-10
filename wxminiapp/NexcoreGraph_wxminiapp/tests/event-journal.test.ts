import { beforeEach, describe, expect, it } from 'vitest'
import {
  appendJournalEvent,
  clearJournalForTest,
  compensateJournalEvent,
  journalTimeline
} from '../src/domain/eventJournal'

describe('event journal', () => {
  beforeEach(() => clearJournalForTest())

  it('deduplicates retries by idempotency key', () => {
    const input = {
      familyId: 'fam-1',
      type: 'item.qty_changed' as const,
      targetId: 'item-1',
      before: { qty: 5 },
      after: { qty: 3 },
      actor: 'member@example.com',
      deviceId: 'wx-device-1',
      idempotencyKey: 'retry-1',
      correlationId: 'agent-run-1'
    }

    expect(appendJournalEvent(input).id).toBe(appendJournalEvent(input).id)
    expect(journalTimeline(10)).toHaveLength(1)
  })

  it('uses a compensating event instead of deleting history', () => {
    const event = appendJournalEvent({
      familyId: 'fam-1',
      type: 'item.qty_changed',
      targetId: 'item-1',
      before: { qty: 5 },
      after: { qty: 3 },
      actor: 'member@example.com',
      deviceId: 'wx-device-1',
      idempotencyKey: 'change-1'
    })
    const undo = compensateJournalEvent(event.id, 'member@example.com')

    expect(undo.type).toBe('item.qty_changed')
    expect(undo.before).toEqual({ qty: 3 })
    expect(undo.after).toEqual({ qty: 5 })
    expect(journalTimeline(10)).toHaveLength(2)
  })

  it('groups a batch by correlation id', () => {
    for (const key of ['a', 'b']) {
      appendJournalEvent({
        familyId: 'fam-1',
        type: 'shopping.added',
        targetId: key,
        before: null,
        after: { qty: 1 },
        actor: 'admin',
        deviceId: 'wx-1',
        idempotencyKey: key,
        correlationId: 'run-1'
      })
    }

    expect(journalTimeline(10).every((event) => event.correlationId === 'run-1')).toBe(true)
  })
})
