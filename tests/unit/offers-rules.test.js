import { describe, it, expect } from 'vitest'
import { offerStatus, offerPill, offerOutletChoices, offerSentence, offersFor, offerDay } from '@/lib/offers/rules'

const TODAY = '2026-11-24'
const owner = { role: 'owner', readOnly: false, tier: 'merchant', outletId: null }
const outlets = [
  { id: 'a', name: 'Tampines Mall', online: false },
  { id: 'b', name: 'Bedok Mall', online: false },
  { id: 'c', name: 'Online store', online: true },
]
const takeup = (o = {}) => ({ id: 't1', key: 'qr_fee_cut', startsOn: '2026-11-18', endsOn: '2027-02-28', outletIds: ['a'], ...o })

describe('offerStatus / offerPill', () => {
  it('active, scheduled, ended', () => {
    expect(offerStatus(takeup(), TODAY)).toBe('active')
    expect(offerStatus(takeup({ endsOn: '2026-11-24' }), TODAY)).toBe('active')
    expect(offerStatus(takeup({ endsOn: '2026-11-23' }), TODAY)).toBe('ended')
    expect(offerStatus(takeup({ startsOn: '2026-11-25' }), TODAY)).toBe('scheduled')
  })
  it('pill wording', () => {
    expect(offerPill(takeup(), TODAY)).toEqual({ tone: 'ok', icon: 'tick', text: 'Active until Sun 28 Feb' })
    expect(offerPill(takeup({ endsOn: '2026-11-20' }), TODAY)).toEqual({ tone: 'mute', icon: 'tick', text: 'Ended Fri 20 Nov' })
  })
})

describe('offerOutletChoices', () => {
  const offer = { key: 'qr_fee_cut' }
  it('every outlet suits; an active take-up at the outlet blocks it', () => {
    const c = offerOutletChoices({ offer, outlets, takeups: [takeup()], today: TODAY, access: owner })
    expect(c).toEqual([
      { id: 'a', name: 'Tampines Mall', can: false, ticked: false, reason: 'Already active until Sun 28 Feb' },
      { id: 'b', name: 'Bedok Mall', can: true, ticked: true, reason: null },
      { id: 'c', name: 'Online store', can: true, ticked: true, reason: null },
    ])
  })
  it('ended take-ups and other offers do not block', () => {
    const c = offerOutletChoices({
      offer, outlets, today: TODAY, access: owner,
      takeups: [takeup({ endsOn: '2026-11-01' }), takeup({ key: 'qr_standee' })],
    })
    expect(c.every((x) => x.can)).toBe(true)
  })
  it('outlet manager gets only their outlet', () => {
    const c = offerOutletChoices({ offer, outlets, takeups: [], today: TODAY, access: { role: 'outlet_manager', readOnly: false, outletId: 'b' } })
    expect(c.map((x) => x.id)).toEqual(['b'])
  })
})

describe('offerSentence', () => {
  it('variants', () => {
    expect(offerSentence({ active: 1, first: { name: '0.5% off NETS QR fees', endsOn: '2027-02-28' } }))
      .toEqual({ text: 'You have 1 offer active: {figure} until 28 Feb.', figure: '0.5% off NETS QR fees' })
    expect(offerSentence({ active: 2, first: { name: 'Free NETS QR standee', endsOn: '2027-02-28' } }))
      .toEqual({ text: 'You have 2 offers active. The next to end is {figure}, on 28 Feb.', figure: 'Free NETS QR standee' })
    expect(offerSentence({ active: 0, first: null })).toEqual({ text: 'No offers active. Pick one below.', figure: '' })
  })
})

describe('offersFor', () => {
  it('lists by business category', () => {
    expect(offersFor('F&B').map((o) => o.key)).toEqual(['qr_fee_cut', 'qr_standee', 'packaging_partner', 'delivery_listing'])
    expect(offersFor('Retail').map((o) => o.key)).toEqual(['qr_fee_cut', 'qr_standee', 'second_terminal', 'shelf_labels'])
    expect(offersFor('Other')).toEqual([])
  })
})

describe('dates far ahead carry the year', () => {
  // A 12-month offer taken up today ends on 23 Nov next year: without the year it reads like yesterday.
  it('offerDay adds the year when the date is more than 6 months away', () => {
    expect(offerDay('2027-02-23', TODAY)).toBe('Tue 23 Feb')
    expect(offerDay('2027-11-23', TODAY)).toBe('Tue 23 Nov 2027')
  })
  it('pill, outlet reason and sentence use it', () => {
    const far = takeup({ key: 'qr_standee', startsOn: TODAY, endsOn: '2027-11-23' })
    expect(offerPill(far, TODAY).text).toBe('Active until Tue 23 Nov 2027')
    const [a] = offerOutletChoices({ offer: { key: 'qr_standee' }, outlets, takeups: [far], today: TODAY, access: owner })
    expect(a.reason).toBe('Already active until Tue 23 Nov 2027')
    expect(offerSentence({ active: 1, first: { name: 'Free NETS QR standee', endsOn: '2027-11-23' }, today: TODAY }).text)
      .toBe('You have 1 offer active: {figure} until 23 Nov 2027.')
  })
})
