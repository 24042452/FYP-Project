import { describe, expect, it } from 'vitest'
import { PROMOTIONS, promotionByKey, outletSuits } from '@/lib/promotions/catalogue'
import { OFFERS, offerByKey } from '@/lib/offers/catalogue'
import { CHANNELS } from '@/lib/channels'

describe('promotion and offer catalogues', () => {
  it('has the six promotions and six offers with unique keys and valid channels', () => {
    expect(PROMOTIONS.map((p) => p.key)).toEqual(['qr_tuesday', 'qr_lunch', 'card_weekend', 'click_online', 'sgqr_drink', 'enets_delivery'])
    expect(OFFERS.map((o) => o.key)).toEqual(['qr_fee_cut', 'qr_standee', 'second_terminal', 'packaging_partner', 'delivery_listing', 'shelf_labels'])
    expect(new Set(PROMOTIONS.map((p) => p.key)).size).toBe(6)
    expect(new Set(OFFERS.map((o) => o.key)).size).toBe(6)
    for (const p of PROMOTIONS) {
      expect(CHANNELS).toContain(p.channel)
      expect(p.name).toBeTruthy()
      expect(p.when).toBeTruthy()
      expect(p.days.length).toBeGreaterThan(0)
      expect(p.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6)).toBe(true)
      if (p.hours) expect(p.hours[0]).toBeLessThan(p.hours[1])
      expect(p.categories.length).toBeGreaterThan(0)
      expect(p.categories.every((c) => c === 'F&B' || c === 'Retail')).toBe(true)
      expect(p.liftPct).toBeGreaterThan(0)
      expect(promotionByKey(p.key)).toBe(p)
    }
    for (const o of OFFERS) {
      expect(['fees', 'equipment', 'partner']).toContain(o.kind)
      expect(o.name).toBeTruthy()
      expect(o.detail).toBeTruthy()
      expect(Number.isInteger(o.months) && o.months > 0).toBe(true)
      expect(o.categories.every((c) => c === 'F&B' || c === 'Retail')).toBe(true)
      expect(offerByKey(o.key)).toBe(o)
    }
    expect(promotionByKey('nope')).toBeUndefined()
    expect(offerByKey('nope')).toBeUndefined()
  })

  it('uses the exact catalogue values from the spec', () => {
    expect(promotionByKey('qr_tuesday')).toEqual({
      key: 'qr_tuesday', channel: 'nets_qr', name: '10% off on Tuesdays', when: 'Every Tuesday', days: [2], categories: ['F&B', 'Retail'], liftPct: 12,
    })
    expect(promotionByKey('qr_lunch')).toEqual({
      key: 'qr_lunch', channel: 'nets_qr', name: 'Lunch deal: $1 off orders over $8', when: '11am to 2pm on weekdays',
      days: [1, 2, 3, 4, 5], hours: [11, 14], categories: ['F&B'], liftPct: 9,
    })
    expect(promotionByKey('card_weekend')).toMatchObject({ channel: 'card', name: '10% off weekends with Cards', when: 'Saturdays and Sundays', days: [0, 6], categories: ['F&B', 'Retail'], liftPct: 14 })
    expect(promotionByKey('click_online')).toMatchObject({ channel: 'nets_click', name: '$2 off online orders over $20', when: 'Every day, online store', days: [0, 1, 2, 3, 4, 5, 6], categories: ['Retail'], liftPct: 6 })
    expect(promotionByKey('sgqr_drink')).toMatchObject({ channel: 'sgqr', name: 'Free drink with orders over $10', when: 'Every day', days: [0, 1, 2, 3, 4, 5, 6], categories: ['F&B'], liftPct: 8 })
    expect(promotionByKey('enets_delivery')).toMatchObject({ channel: 'enets', name: 'Free delivery over $30 with eNETS', when: 'Every day, online store', days: [0, 1, 2, 3, 4, 5, 6], categories: ['Retail'], liftPct: 7 })
    expect(offerByKey('qr_fee_cut')).toMatchObject({ kind: 'fees', name: '0.5% off NETS QR fees', months: 3, categories: ['F&B', 'Retail'] })
    expect(offerByKey('qr_standee')).toMatchObject({ kind: 'equipment', name: 'Free NETS QR standee', categories: ['F&B', 'Retail'] })
    expect(offerByKey('second_terminal')).toMatchObject({ kind: 'equipment', name: 'Second terminal free for 2 months', months: 2, categories: ['Retail'] })
    expect(offerByKey('packaging_partner')).toMatchObject({ kind: 'partner', name: '8% off packaging from a NETS partner', categories: ['F&B'] })
    expect(offerByKey('delivery_listing')).toMatchObject({ kind: 'partner', name: 'Free listing on a NETS partner delivery app for 1 month', months: 1, categories: ['F&B'] })
    expect(offerByKey('shelf_labels')).toMatchObject({ kind: 'partner', name: '10% off shelf labels from a NETS partner', categories: ['Retail'] })
  })

  it('matches payment types to outlets: online-only, counter-only, cards anywhere', () => {
    const shop = { online: false }
    const web = { online: true }
    expect(outletSuits('nets_click', web)).toBe(true)
    expect(outletSuits('nets_click', shop)).toBe(false)
    expect(outletSuits('enets', web)).toBe(true)
    expect(outletSuits('enets', shop)).toBe(false)
    expect(outletSuits('nets_qr', shop)).toBe(true)
    expect(outletSuits('nets_qr', web)).toBe(false)
    expect(outletSuits('sgqr', shop)).toBe(true)
    expect(outletSuits('sgqr', web)).toBe(false)
    expect(outletSuits('card', shop)).toBe(true)
    expect(outletSuits('card', web)).toBe(true)
  })
})
