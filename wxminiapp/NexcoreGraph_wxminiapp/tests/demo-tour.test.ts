import { describe, expect, it } from 'vitest'
import { nextTourStep, TOUR } from '../src/services/demoTour'

describe('guided tour', () => {
  it('walks through the five flagship moments in order', () => {
    expect(TOUR.map((step) => step.id)).toEqual([
      'today',
      'intake',
      'simulate',
      'policy',
      'audit'
    ])
    expect(nextTourStep('simulate')?.id).toBe('policy')
  })

  it('ends cleanly after the final step', () => {
    expect(nextTourStep('audit')).toBeNull()
  })
})
