import { describe, expect, it } from 'vitest'
import { buildOffersPage, takeUpLabel } from '@/lib/offers/view'

const TODAY = '2026-11-24'
const owner = { role: 'owner', readOnly: false, tier: 'merchant', outletId: null }
const manager = (outletId) => ({ role: 'outlet_manager', readOnly: false, tier: 'outlet', outletId })
const accountant = { role: 'accountant', readOnly: false, tier: 'merchant', outletId: null }
const hq = { role: 'hq_owner', readOnly: true, tier: 'hq', outletId: null }
const shop = [
  { id: 'a', name: 'Bedok Mall', online: false },
  { id: 'b', name: 'Online store', online: true },
  { id: 'c', name: 'Tampines Mall', online: false },
]
const stall = [{ id: 's', name: 'Maxwell stall', online: false }]
/** The QR fee cut, taken up 10 days ago at every Tan & Sons outlet (like the seed). */
const takeup = (o = {}) => ({
  id: 't1', key: 'qr_fee_cut', startsOn: '2026-11-14', endsOn: '2027-02-13',
  outletIds: ['a', 'b', 'c'], outletNames: ['Bedok Mall', 'Online store', 'Tampines Mall'], ...o,
})

const page = (o = {}) =>
  buildOffersPage({ category: 'Retail', takeups: [], outlets: shop, today: TODAY, access: owner, outletId: null, ...o })

describe('takeUpLabel', () => {
  it('counts the ticked outlets; no count when there is no picker', () => {
    expect(takeUpLabel(null)).toBe('Take up offer')
    expect(takeUpLabel(1)).toBe('Take up at 1 outlet')
    expect(takeUpLabel(2)).toBe('Take up at 2 outlets')
    expect(takeUpLabel(0)).toBe('Take up at 0 outlets')
  })
})

describe('buildOffersPage: sentence and Your offers', () => {
  it('nothing taken up', () => {
    const m = page()
    expect(m.sentence).toEqual({ before: 'No offers active. Pick one below.', figure: '', after: '' })
    expect(m.yours).toEqual([])
  })

  it('one active offer: the name is the blue figure, with its end date', () => {
    const m = page({ takeups: [takeup()] })
    expect(m.sentence).toEqual({ before: 'You have 1 offer active: ', figure: '0.5% off NETS QR fees', after: ' until Sat 13 Feb.' })
    expect(m.yours).toEqual([
      {
        id: 't1', kindLabel: 'Lower fees', name: '0.5% off NETS QR fees', outlets: 'Bedok Mall, Online store, Tampines Mall',
        taken: 'Taken up Sat 14 Nov', pill: { tone: 'ok', icon: 'tick', text: 'Active until Sat 13 Feb' },
      },
    ])
  })

  it('the same offer taken up twice (different outlets) counts as one offer; the earlier end is named', () => {
    const m = page({
      takeups: [
        takeup({ outletIds: ['a'], outletNames: ['Bedok Mall'] }),
        takeup({ id: 't2', startsOn: TODAY, endsOn: '2027-02-23', outletIds: ['c'], outletNames: ['Tampines Mall'] }),
      ],
    })
    expect(m.sentence.before).toBe('You have 1 offer active: ')
    expect(m.sentence.after).toBe(' until Sat 13 Feb.')
    expect(m.yours.map((y) => y.id)).toEqual(['t1', 't2'])
  })

  it('the same offer taken up on the same day at more outlets shows as one card with all its outlets', () => {
    const m = page({
      takeups: [
        takeup({ id: 't2', startsOn: TODAY, endsOn: '2027-02-23', outletIds: ['c'], outletNames: ['Tampines Mall'] }),
        takeup({ id: 't3', startsOn: TODAY, endsOn: '2027-02-23', outletIds: ['a', 'b'], outletNames: ['Bedok Mall', 'Online store'] }),
      ],
    })
    expect(m.yours).toHaveLength(1)
    expect(m.yours[0]).toMatchObject({ id: 't2', outlets: 'Bedok Mall, Online store, Tampines Mall', taken: 'Taken up Tue 24 Nov' })
    const mgr = page({
      takeups: [
        takeup({ id: 't2', startsOn: TODAY, endsOn: '2027-02-23', outletIds: ['c'], outletNames: ['Tampines Mall'] }),
        takeup({ id: 't3', startsOn: TODAY, endsOn: '2027-02-23', outletIds: ['a', 'b'], outletNames: ['Bedok Mall', 'Online store'] }),
      ],
      access: manager('c'),
    })
    // A take-up without their outlet is never shown to an outlet manager, so nothing is merged in from it.
    expect(mgr.yours[0].outlets).toBe('Tampines Mall')
  })

  it('a 12-month offer ending next year shows the year everywhere', () => {
    const far = takeup({ key: 'qr_standee', startsOn: TODAY, endsOn: '2027-11-23' })
    const m = page({ takeups: [far] })
    expect(m.sentence.after).toBe(' until Tue 23 Nov 2027.')
    expect(m.yours[0].pill.text).toBe('Active until Tue 23 Nov 2027')
    const card = m.cards.find((c) => c.key === 'qr_standee')
    expect(card?.dates).toBe('12 months, from today to Tue 23 Nov 2027')
    expect(card?.activeNote).toBe('Active at all your in-store outlets until Tue 23 Nov 2027')
  })

  it('two offers: names the one that ends first; ended take-ups are left out', () => {
    const m = page({
      takeups: [
        takeup(),
        takeup({ id: 't2', key: 'second_terminal', startsOn: '2026-11-20', endsOn: '2027-01-19' }),
        takeup({ id: 'old', key: 'shelf_labels', startsOn: '2026-07-01', endsOn: '2026-09-30' }),
      ],
    })
    expect(m.sentence).toEqual({ before: 'You have 2 offers active. The next to end is ', figure: 'Second terminal free for 2 months', after: ', on Tue 19 Jan.' })
    expect(m.yours.map((y) => y.id)).toEqual(['t2', 't1'])
  })

  it('a take-up that has not started yet shows in Your offers but is not counted as active', () => {
    const m = page({ takeups: [takeup({ startsOn: '2026-11-26' })] })
    expect(m.sentence.before).toBe('No offers active. Pick one below.')
    expect(m.yours[0].pill).toEqual({ tone: 'info', icon: 'clock', text: 'Starts Thu 26 Nov' })
  })

  it('an owner showing one outlet sees only offers at that outlet', () => {
    const m = page({ takeups: [takeup({ outletIds: ['a'], outletNames: ['Bedok Mall'] })], outletId: 'c' })
    expect(m.yours).toEqual([])
    expect(m.sentence.before).toBe('No offers active. Pick one below.')
  })

  it('an outlet manager never sees the names of other outlets', () => {
    const m = page({ takeups: [takeup()], access: manager('c') })
    expect(m.yours[0].outlets).toBe('This outlet and 2 others')
    const own = page({ takeups: [takeup({ outletIds: ['c'], outletNames: ['Tampines Mall'] })], access: manager('c') })
    expect(own.yours[0].outlets).toBe('Tampines Mall')
  })
})

describe('buildOffersPage: Offers for you', () => {
  it('Retail and F&B each get their own list, tagged as sample offers with their length', () => {
    const retail = page()
    expect(retail.cards.map((c) => c.key)).toEqual(['qr_fee_cut', 'qr_standee', 'second_terminal', 'shelf_labels'])
    expect(retail.cards[0]).toMatchObject({
      kind: 'fees', kindLabel: 'Lower fees', name: '0.5% off NETS QR fees',
      detail: 'Pay 0.5% less on every NETS QR payment for 3 months.', length: '3 months', sample: true, can: true, note: null, activeNote: null,
    })
    expect(retail.cards.find((c) => c.key === 'qr_standee')?.length).toBe('12 months')
    const fnb = page({ category: 'F&B', outlets: stall })
    expect(fnb.cards.map((c) => c.key)).toEqual(['qr_fee_cut', 'qr_standee', 'packaging_partner', 'delivery_listing'])
    expect(fnb.cards.find((c) => c.key === 'delivery_listing')?.length).toBe('1 month')
  })

  it('chips: All, then the kinds on the list, in order', () => {
    expect(page().chips).toEqual([
      { value: 'all', label: 'All' },
      { value: 'fees', label: 'Lower fees' },
      { value: 'equipment', label: 'Equipment' },
      { value: 'partner', label: 'Partner deals' },
    ])
  })

  it('panel wording: how long from today, and the sample note', () => {
    const c = page().cards[0]
    expect(c.dates).toBe('3 months, from today to Tue 23 Feb')
    expect(c.sampleNote).toBe('Sample offer: NETS has not set real terms yet.')
  })

  it('active at every outlet: no Take up, the real end date instead (same date format as the Your offers pill)', () => {
    const m = page({ takeups: [takeup()] })
    expect(m.cards[0]).toMatchObject({ can: false, activeNote: 'Active at all your in-store outlets until Sat 13 Feb', note: null })
    expect(m.yours[0].pill.text).toBe('Active until Sat 13 Feb')
    // A partner deal suits the online store too, so "all your outlets" means all of them.
    const labels = takeup({ key: 'shelf_labels' })
    expect(page({ takeups: [labels] }).cards.find((c) => c.key === 'shelf_labels')?.activeNote).toBe('Active at all your outlets until Sat 13 Feb')
  })

  it('in-store offers grey out the online store ("In-store only"); partner deals do not', () => {
    const m = page()
    for (const key of ['qr_fee_cut', 'qr_standee', 'second_terminal']) {
      expect(m.cards.find((c) => c.key === key)?.choices.find((x) => x.id === 'b')).toEqual({ id: 'b', name: 'Online store', can: false, ticked: false, reason: 'In-store only' })
    }
    expect(m.cards.find((c) => c.key === 'shelf_labels')?.choices.find((x) => x.id === 'b')).toMatchObject({ can: true, reason: null })
    // Active at both physical outlets: nothing left to take up (the online store does not count).
    const both = page({ takeups: [takeup({ outletIds: ['a', 'c'], outletNames: ['Bedok Mall', 'Tampines Mall'] })] }).cards[0]
    expect(both).toMatchObject({ can: false, activeNote: 'Active at all your in-store outlets until Sat 13 Feb' })
    // An outlet manager of an online outlet cannot take up an in-store offer.
    const online = page({ access: manager('b') }).cards[0]
    expect(online).toMatchObject({ can: false, note: 'In-store only', activeNote: null })
  })

  it('active at some outlets: Take up stays, the panel greys those outlets out', () => {
    const c = page({ takeups: [takeup({ outletIds: ['a'], outletNames: ['Bedok Mall'] })] }).cards[0]
    expect(c).toMatchObject({ can: true, activeNote: null, note: 'Active at 1 of your 2 in-store outlets' })
    expect(c.choices).toEqual([
      { id: 'a', name: 'Bedok Mall', can: false, ticked: false, reason: 'Already active until Sat 13 Feb' },
      { id: 'b', name: 'Online store', can: false, ticked: false, reason: 'In-store only' },
      { id: 'c', name: 'Tampines Mall', can: true, ticked: true, reason: null },
    ])
  })

  it('the end that frees an outlet first is named when several take-ups cover every outlet', () => {
    const c = page({
      takeups: [
        takeup({ outletIds: ['a', 'b'], outletNames: ['Bedok Mall', 'Online store'], endsOn: '2027-02-20' }),
        takeup({ id: 't2', outletIds: ['c'], outletNames: ['Tampines Mall'], endsOn: '2027-02-13' }),
      ],
    }).cards[0]
    expect(c.activeNote).toBe('Active at all your in-store outlets until Sat 13 Feb')
  })

  it('a one-outlet business: no picker, "your outlet" wording', () => {
    const m = page({ category: 'F&B', outlets: stall, takeups: [takeup({ outletIds: ['s'], outletNames: ['Maxwell stall'] })] })
    expect(m.picker).toBe(false)
    expect(m.cards[0]).toMatchObject({ can: false, activeNote: 'Active at your outlet until Sat 13 Feb', choices: [] })
    expect(m.cards[1]).toMatchObject({ can: true, note: null, choices: [] })
  })

  it('an outlet manager: no picker, only their own outlet counts', () => {
    const m = page({ takeups: [takeup({ outletIds: ['a'], outletNames: ['Bedok Mall'] })], access: manager('c') })
    expect(m.picker).toBe(false)
    expect(m.cards[0]).toMatchObject({ can: true, note: null, activeNote: null, choices: [] })
    const busy = page({ takeups: [takeup({ outletIds: ['c'], outletNames: ['Tampines Mall'] })], access: manager('c') })
    expect(busy.cards[0]).toMatchObject({ can: false, activeNote: 'Active at your outlet until Sat 13 Feb' })
  })

  it('people who can only look: no Take up and a note saying who does it', () => {
    const m = page({ access: accountant, takeups: [takeup()] })
    expect(m.canAct).toBe(false)
    expect(m.note).toBe('You can look but not take up offers. The owner or outlet manager does that.')
    expect(m.cards.every((c) => c.can === false)).toBe(true)
    expect(m.cards[0].activeNote).toBe('Active at all your in-store outlets until Sat 13 Feb')
    expect(m.cards[1].note).toBe(null)
    expect(page({ access: hq }).note).toBe('You can look but not take up offers. The franchisee does that.')
    expect(page().note).toBe(null)
  })
})
