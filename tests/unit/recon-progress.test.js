import { describe, it, expect } from 'vitest'
import {
  CHECKUP_STEPS,
  MIN_DISPLAY_MS,
  canFinish,
  DEFAULT_ESTIMATE_MS,
  describeDuration,
  estimateFromStored,
  progressAt,
} from '../../lib/recon/progress.js'

describe('estimateFromStored', () => {
  it('uses the default for anything unusable', () => {
    for (const v of [null, undefined, '', 'abc', NaN, -5, 0, Infinity, {}]) {
      expect(estimateFromStored(v)).toBe(DEFAULT_ESTIMATE_MS)
    }
    expect(DEFAULT_ESTIMATE_MS).toBe(6000)
  })
  it('uses the last real duration, as a number or text', () => {
    expect(estimateFromStored('4200')).toBe(4200)
    expect(estimateFromStored(3000)).toBe(3000)
  })
  it('clamps very short and very long runs', () => {
    expect(estimateFromStored(50)).toBe(1500)
    expect(estimateFromStored(10 * 60 * 1000)).toBe(60000)
  })
})

describe('progressAt', () => {
  it('starts at 0 on the first step', () => {
    const p = progressAt(0, 6000)
    expect(p.percent).toBe(0)
    expect(p.stepIndex).toBe(0)
    expect(p.secondsLeft).toBe(6)
    expect(p.almostDone).toBe(false)
  })
  it('only ever moves forward and never passes 90%', () => {
    let last = -1
    for (let t = 0; t <= 120000; t += 250) {
      const p = progressAt(t, 6000)
      expect(p.percent).toBeGreaterThanOrEqual(last)
      expect(p.percent).toBeLessThanOrEqual(90)
      last = p.percent
    }
    expect(progressAt(10 * 60 * 1000, 6000).percent).toBeLessThanOrEqual(90)
  })
  it('eases out: the first second moves further than the fifth', () => {
    const early = progressAt(1000, 6000).percent - progressAt(0, 6000).percent
    const late = progressAt(5000, 6000).percent - progressAt(4000, 6000).percent
    expect(early).toBeGreaterThan(late)
  })
  it('ticks through every step in order', () => {
    const seen = []
    for (let t = 0; t <= 60000; t += 100) {
      const i = progressAt(t, 6000).stepIndex
      if (seen[seen.length - 1] !== i) seen.push(i)
    }
    expect(seen).toEqual([0, 1, 2, 3, 4])
    expect(CHECKUP_STEPS).toHaveLength(5)
    expect(CHECKUP_STEPS[0]).toBe('Adding up your sales')
    expect(CHECKUP_STEPS[4]).toBe('Saving your results')
  })
  it('counts the seconds left down, rounded up, never below 1', () => {
    expect(progressAt(1000, 6000).secondsLeft).toBe(5)
    expect(progressAt(1001, 6000).secondsLeft).toBe(5)
    expect(progressAt(5900, 6000).secondsLeft).toBe(1)
  })
  it('says almost done near the end and when it runs over', () => {
    expect(progressAt(5200, 6000).almostDone).toBe(true)
    expect(progressAt(9000, 6000).almostDone).toBe(true)
    expect(progressAt(9000, 6000).secondsLeft).toBe(0)
  })
  it('is safe with bad input', () => {
    for (const [e, est] of [[NaN, 6000], [-100, 6000], [Infinity, 6000], [1000, NaN], [1000, 0], [1000, -3], [undefined, undefined]]) {
      const p = progressAt(/** @type {any} */ (e), /** @type {any} */ (est))
      expect(Number.isFinite(p.percent)).toBe(true)
      expect(Number.isFinite(p.secondsLeft)).toBe(true)
      expect(p.percent).toBeGreaterThanOrEqual(0)
      expect(p.percent).toBeLessThanOrEqual(90)
      expect(p.secondsLeft).toBeGreaterThanOrEqual(0)
      expect(p.stepIndex).toBeGreaterThanOrEqual(0)
      expect(p.stepIndex).toBeLessThan(CHECKUP_STEPS.length)
    }
  })
})

describe('describeDuration', () => {
  it('says it in plain words', () => {
    expect(describeDuration(3000)).toBe('Checked in 3 seconds')
    expect(describeDuration(1000)).toBe('Checked in 1 second')
    expect(describeDuration(3400)).toBe('Checked in 3 seconds')
    expect(describeDuration(200)).toBe('Checked in less than a second')
    expect(describeDuration(75000)).toBe('Checked in 1 minute 15 seconds')
  })
  it('returns nothing for a bad duration', () => {
    expect(describeDuration(NaN)).toBe('')
    expect(describeDuration(-4)).toBe('')
    expect(describeDuration(null)).toBe('')
  })
})

describe('canFinish', () => {
  it('waits for both the answer and the minimum showing time', () => {
    expect(canFinish(1000, true)).toBe(false)
    expect(canFinish(MIN_DISPLAY_MS - 1, true)).toBe(false)
    expect(canFinish(MIN_DISPLAY_MS, false)).toBe(false)
    expect(canFinish(MIN_DISPLAY_MS, true)).toBe(true)
    expect(canFinish(NaN, true)).toBe(false)
    expect(MIN_DISPLAY_MS).toBe(2500)
  })
})
