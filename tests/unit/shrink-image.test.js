import { describe, expect, it } from 'vitest'
import { fitWithin } from '@/components/disputes/shrink-image'

describe('fitWithin (photo size before sending dispute evidence)', () => {
  it('shrinks a phone photo so its longest side is 1600 px, keeping the shape', () => {
    expect(fitWithin(4032, 3024)).toEqual({ w: 1600, h: 1200 })
  })

  it('leaves a photo that already fits alone', () => {
    expect(fitWithin(800, 600)).toEqual({ w: 800, h: 600 })
  })

  it('uses the longest side for portrait photos', () => {
    expect(fitWithin(3024, 4032)).toEqual({ w: 1200, h: 1600 })
  })

  it('takes another limit and rounds to whole pixels', () => {
    expect(fitWithin(1000, 333, 500)).toEqual({ w: 500, h: 167 })
  })

  it('keeps a photo exactly at the limit', () => {
    expect(fitWithin(1600, 900)).toEqual({ w: 1600, h: 900 })
  })
})
