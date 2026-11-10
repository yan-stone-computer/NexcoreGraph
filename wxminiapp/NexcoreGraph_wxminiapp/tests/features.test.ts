import { describe, expect, it } from 'vitest'
import { FEATURES, enabled } from '../src/config/features'

describe('advanced feature flags', () => {
  it('keeps Wave 1 features enabled', () => {
    expect(FEATURES.eventJournal).toBe(true)
    expect(FEATURES.simulation).toBe(true)
    expect(FEATURES.policySandbox).toBe(true)
    expect(FEATURES.temporalGraph).toBe(true)
    expect(FEATURES.guidedTour).toBe(true)
  })

  it('returns the declared switch', () => {
    expect(enabled('evaluationConsole')).toBe(FEATURES.evaluationConsole)
  })
})
