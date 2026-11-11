import { describe, expect, it } from 'vitest'
import { formatSGD } from '@/lib/money'
import { CHANNELS, CHANNEL_LABELS } from '@/lib/channels'

describe('formatSGD', () => {
  it('formats integer cents as dollars with thousands separators', () => {
    expect(formatSGD(421000)).toBe('$4,210.00')
  })
  it('formats zero', () => {
    expect(formatSGD(0)).toBe('$0.00')
  })
  it('formats negatives with the sign before the dollar symbol', () => {
    expect(formatSGD(-4210)).toBe('-$42.10')
  })
})

describe('channels', () => {
  it('lists the five NETS channels in a fixed order', () => {
    expect(CHANNELS).toEqual(['nets_qr', 'nets_click', 'enets', 'card', 'sgqr'])
  })
  it('uses plain display labels', () => {
    expect(CHANNEL_LABELS.enets).toBe('eNETS (online)')
    expect(CHANNEL_LABELS.card).toBe('Cards')
  })
})
