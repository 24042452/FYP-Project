import { describe, expect, it } from 'vitest'
import { buildPromotionsPage, effectiveEnd, perDayText, resultsPlan } from '@/lib/promotions/view'

const TODAY = '2026-11-24' // a Tuesday
const owner = { role: 'owner', readOnly: false, tier: 'merchant', outletId: null }
const manager = (outletId) => ({ role: 'outlet_manager', readOnly: false, tier: 'outlet', outletId })
const accountant = { role: 'accountant', readOnly: false, tier: 'merchant', outletId: null }
const hq = { role: 'hq_owner', readOnly: true, tier: 'hq', outletId: null }
const shop = [
  { id: 'a', name: 'Bedok Mall', online: false },
  { id: 'b', name: 'Online store', online: true },
  { id: 'c', name: 'Tampines Mall', online: false },
]
const run = (o = {}) => ({
  id: 'r1', key: 'qr_tuesday', channel: 'nets_qr', startsOn: '2026-11-18', endsOn: '2026-12-15', stoppedOn: null,
  outletIds: ['c'], outletNames: ['Tampines Mall'], ...o,
})
const past = (o = {}) =>
  run({ id: 'p1', key: 'card_weekend', channel: 'card', startsOn: '2026-10-03', endsOn: '2026-10-30', outletIds: ['a', 'c'], outletNames: ['Bedok Mall', 'Tampines Mall'], ...o })
const days = (n, cents) => Array.from({ length: n }, (_, i) => ({ day: `d${i}`, cents }))

const page = (o = {}) =>
  buildPromotionsPage({ category: 'Retail', runs: [], outlets: shop, sales: {}, today: TODAY, access: owner, outletId: null, ...o })

describe('effectiveEnd', () => {
  it('is the end date, or the day before it was stopped', () => {
    expect(effectiveEnd(run())).toBe('2026-12-15')
    expect(effectiveEnd(run({ stoppedOn: '2026-11-24' }))).toBe('2026-11-23')
  })
})

describe('perDayText', () => {
  it('names the promotion days without hard-coded dates', () => {
    expect(perDayText({ days: [0, 6] })).toBe('a weekend day')
    expect(perDayText({ days: [0, 1, 2, 3, 4, 5, 6] })).toBe('a day')
    expect(perDayText({ days: [2] })).toBe('a Tuesday')
    expect(perDayText({ days: [1, 2, 3, 4, 5], hours: [11, 14] })).toBe('a weekday, 11am to 2pm')
  })
})

describe('resultsPlan', () => {
  it('asks for promotion days within its dates and the same weekdays in the 4 weeks before', () => {
    const plan = resultsPlan([past(), run()], TODAY, null)
    expect(plan).toHaveLength(1)
    expect(plan[0]).toEqual({
      runId: 'p1',
      ranDays: 28,
      promo: { channel: 'card', outletIds: ['a', 'c'], from: '2026-10-03', to: '2026-10-30', days: [0, 6], hours: null },
      base: { channel: 'card', outletIds: ['a', 'c'], from: '2026-09-05', to: '2026-10-02', days: [0, 6], hours: null },
    })
  })
  it('a stopped run ends the day before; hours are passed on; one outlet when scoped', () => {
    const plan = resultsPlan([past({ key: 'qr_lunch', channel: 'nets_qr', stoppedOn: '2026-10-07' })], TODAY, 'c')
    expect(plan[0].ranDays).toBe(4)
    expect(plan[0].promo).toMatchObject({ outletIds: ['c'], to: '2026-10-06', hours: [11, 14], days: [1, 2, 3, 4, 5] })
  })
  it('skips runs without the scoped outlet', () => {
    expect(resultsPlan([past({ outletIds: ['a'] })], TODAY, 'c')).toEqual([])
  })
})

describe('buildPromotionsPage', () => {
  it('sentence with the last result as the blue figure', () => {
    const m = page({ runs: [run(), past()], sales: { p1: { promoDays: days(8, 114000), baseDays: days(8, 100000) } } })
    expect(m.sentence).toEqual({ before: '1 promotion is running. Your last one, ', figure: 'weekend Cards', after: ', brought in about 14% more.' })
    expect(m.sub).toBe('Take up a promotion and NETS shows it to your customers when they pay. Each one runs for 4 weeks.')
  })

  it('no runs and no results', () => {
    const m = page()
    expect(m.sentence).toEqual({ before: 'No promotions running. Take one up and NETS shows it to your customers when they pay.', figure: '', after: '' })
    expect(m.running).toEqual([])
    expect(m.results).toEqual([])
  })

  it('running card: outlets, start, pill, progress and Stop for the owner', () => {
    const [c] = page({ runs: [run({ outletIds: ['a', 'c'], outletNames: ['Bedok Mall', 'Tampines Mall'] })] }).running
    expect(c).toMatchObject({
      id: 'r1', channel: 'NETS QR', name: '10% off on Tuesdays', outlets: 'Bedok Mall, Tampines Mall', started: 'started Wed 18 Nov',
      pill: { tone: 'info', icon: 'clock', text: 'Running · ends Tue 15 Dec' }, progress: 25, progressText: 'Week 1 of 4 · results when it ends',
      canStop: true, stopNote: null,
    })
  })

  it('a scheduled run starts tomorrow with an empty bar', () => {
    const [c] = page({ runs: [run({ startsOn: '2026-11-25', endsOn: '2026-12-22' })] }).running
    expect(c).toMatchObject({ started: 'starts Wed 25 Nov', pill: { text: 'Starts tomorrow' }, progress: 0, progressText: 'Runs 4 weeks · results when it ends' })
  })

  it('an outlet manager never sees other outlets of a shared run, and cannot stop it', () => {
    const m = page({ runs: [run({ outletIds: ['a', 'c'], outletNames: ['Bedok Mall', 'Tampines Mall'] })], access: manager('a') })
    expect(m.running[0]).toMatchObject({ outlets: 'This outlet and 1 other', canStop: false, stopNote: 'It runs at other outlets too, so the owner stops it.' })
    expect(JSON.stringify(m)).not.toContain('Tampines Mall')
    const solo = page({ runs: [run({ outletIds: ['a'], outletNames: ['Bedok Mall'] })], access: manager('a') })
    expect(solo.running[0]).toMatchObject({ outlets: 'Bedok Mall', canStop: true })
    expect(solo.picker).toBe(false)
  })

  it('cards for the business category, with notes and outlet choices', () => {
    const m = page({ runs: [run()] })
    expect(m.cards.map((c) => c.key)).toEqual(['qr_tuesday', 'card_weekend', 'click_online', 'enets_delivery'])
    expect(m.chips).toEqual([
      { value: 'all', label: 'All' }, { value: 'nets_qr', label: 'NETS QR' }, { value: 'card', label: 'Cards' },
      { value: 'nets_click', label: 'NETS Click' }, { value: 'enets', label: 'eNETS' },
    ])
    const qr = m.cards[0]
    expect(qr).toMatchObject({
      channel: 'nets_qr', channelLabel: 'NETS QR', when: 'Every Tuesday · 4 weeks', can: true,
      note: 'Already running a NETS QR promotion at 1 of your 2 outlets',
      dates: 'Every Tuesday · 4 weeks, from tomorrow (Wed 25 Nov) to Tue 22 Dec',
      info: 'NETS shows this deal to your customers when they pay by NETS QR at the outlets you pick. The discount comes off the price they pay; you see the results when it ends.',
    })
    expect(qr.choices).toEqual([
      { id: 'a', name: 'Bedok Mall', can: true, ticked: true, reason: null },
      { id: 'b', name: 'Online store', can: false, ticked: false, reason: 'Online only' },
      { id: 'c', name: 'Tampines Mall', can: false, ticked: false, reason: 'Already running "10% off on Tuesdays" (NETS QR) until Tue 15 Dec' },
    ])
    expect(m.picker).toBe(true)
  })

  it('one outlet: no picker, online-only promotions are not startable, F&B list', () => {
    const m = page({ category: 'F&B', outlets: [{ id: 'h', name: 'Stall #01-23', online: false }] })
    expect(m.picker).toBe(false)
    expect(m.cards.map((c) => c.key)).toEqual(['qr_tuesday', 'qr_lunch', 'card_weekend', 'sgqr_drink'])
    expect(m.cards.every((c) => c.can)).toBe(true)
    expect(m.cards[0].info).toContain('at your outlet.')
    const retail = page({ outlets: [{ id: 'h', name: 'Shop', online: false }] })
    expect(retail.cards.find((c) => c.key === 'click_online')).toMatchObject({ can: false, note: 'Not offered for your payment types' })
  })

  it('a payment type busy everywhere replaces the button with a note', () => {
    const m = page({ runs: [run({ outletIds: ['a', 'c'] })] })
    expect(m.cards[0]).toMatchObject({ can: false, note: 'NETS QR already has a promotion running until Tue 15 Dec' })
  })

  it('view-only: no Take up or Stop, plus the note', () => {
    const m = page({ runs: [run()], access: accountant })
    expect(m.canAct).toBe(false)
    expect(m.note).toBe('You can look but not start promotions. The owner or outlet manager does that.')
    expect(m.cards.every((c) => !c.can)).toBe(true)
    expect(m.running[0].canStop).toBe(false)
    expect(m.running[0].stopNote).toBeNull()
    expect(page({ access: hq }).note).toBe('You can look but not start promotions. The franchisee does that.')
  })

  it('results: newest first, per-day sales, comparison and too short', () => {
    const m = page({
      runs: [
        past(),
        past({ id: 'p2', key: 'click_online', channel: 'nets_click', startsOn: '2026-11-02', endsOn: '2026-11-29', stoppedOn: '2026-11-05', outletIds: ['b'], outletNames: ['Online store'] }),
        past({ id: 'p3', key: 'qr_tuesday', channel: 'nets_qr', startsOn: '2026-08-04', endsOn: '2026-08-31' }),
      ],
      sales: {
        p1: { promoDays: days(8, 124000), baseDays: days(8, 108800) },
        p2: { promoDays: days(3, 5000), baseDays: days(28, 5000) },
        p3: { promoDays: days(4, 10100), baseDays: days(4, 10000) },
      },
    })
    expect(m.results).toEqual([
      { id: 'p2', name: '$2 off online orders over $20', sub: 'NETS Click · Mon 2 Nov to Wed 4 Nov', sales: '$50 a day', label: 'Too short to compare', tone: 'mute' },
      { id: 'p1', name: '10% off weekends with Cards', sub: 'Cards · Sat 3 Oct to Fri 30 Oct', sales: '$1,240 a weekend day', label: '+14%', tone: 'ok' },
      { id: 'p3', name: '10% off on Tuesdays', sub: 'NETS QR · Tue 4 Aug to Mon 31 Aug', sales: '$101 a Tuesday', label: 'About the same', tone: 'mute' },
    ])
    expect(m.sentence.after).toBe(', ran too short to compare.')
  })

  it('an owner looking at one outlet sees only runs at that outlet', () => {
    const m = page({ runs: [run({ outletIds: ['c'] }), past({ outletIds: ['a'] })], outletId: 'a', sales: { p1: { promoDays: days(8, 100), baseDays: days(8, 100) } } })
    expect(m.running).toEqual([])
    expect(m.results.map((r) => r.id)).toEqual(['p1'])
    // Choices still cover the whole business (the Tampines run keeps that outlet busy).
    expect(m.cards[0].choices.find((c) => c.id === 'c').can).toBe(false)
  })
})
