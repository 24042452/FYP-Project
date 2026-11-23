import { describe, it, expect } from 'vitest'
import {
  runStatus, runPill, weekOf, outletSuits, outletChoices, startable, datesFor, startLabel,
  compareResults, pageSentence, canTakeUp, viewOnlyNote, pickOutlets,
} from '@/lib/promotions/rules'

const TODAY = '2026-11-24' // a Tuesday
const owner = { role: 'owner', readOnly: false, tier: 'merchant', outletId: null }
const manager = (outletId) => ({ role: 'outlet_manager', readOnly: false, tier: 'merchant', outletId })
const shop = [
  { id: 'a', name: 'Tampines Mall', online: false },
  { id: 'b', name: 'Bedok Mall', online: false },
  { id: 'c', name: 'Online store', online: true },
]
const run = (o = {}) => ({
  id: 'r1', key: 'qr_tuesday', channel: 'nets_qr', startsOn: '2026-11-18', endsOn: '2026-12-15', stoppedOn: null,
  outletIds: ['a'], outletNames: ['Tampines Mall'], ...o,
})

describe('runStatus / runPill / weekOf', () => {
  it('scheduled, running, finished', () => {
    expect(runStatus(run({ startsOn: '2026-11-25', endsOn: '2026-12-22' }), TODAY)).toBe('scheduled')
    expect(runStatus(run(), TODAY)).toBe('running')
    expect(runStatus(run({ endsOn: '2026-11-24' }), TODAY)).toBe('running')
    expect(runStatus(run({ endsOn: '2026-11-23' }), TODAY)).toBe('finished')
    expect(runStatus(run({ stoppedOn: '2026-11-24' }), TODAY)).toBe('finished')
  })
  it('pill wording', () => {
    expect(runPill(run({ startsOn: '2026-11-25', endsOn: '2026-12-22' }), TODAY)).toEqual({ tone: 'info', icon: 'clock', text: 'Starts tomorrow' })
    expect(runPill(run({ startsOn: '2026-11-27' }), TODAY).text).toBe('Starts Fri 27 Nov')
    expect(runPill(run(), TODAY)).toEqual({ tone: 'info', icon: 'clock', text: 'Running · ends Tue 15 Dec' })
    expect(runPill(run({ endsOn: '2026-11-20' }), TODAY)).toEqual({ tone: 'mute', icon: 'tick', text: 'Ended Fri 20 Nov' })
    expect(runPill(run({ stoppedOn: '2026-11-20' }), TODAY)).toEqual({ tone: 'mute', icon: 'stop', text: 'Stopped Fri 20 Nov' })
  })
  it('week 1 to 4', () => {
    expect(weekOf(run({ startsOn: '2026-11-24' }), TODAY)).toBe(1)
    expect(weekOf(run({ startsOn: '2026-11-18' }), TODAY)).toBe(1)
    expect(weekOf(run({ startsOn: '2026-11-17' }), TODAY)).toBe(2)
    expect(weekOf(run({ startsOn: '2026-10-28' }), TODAY)).toBe(4)
    expect(weekOf(run({ startsOn: '2026-01-01' }), TODAY)).toBe(4)
    expect(weekOf(run({ startsOn: '2026-11-25' }), TODAY)).toBe(1)
  })
})

describe('outletSuits', () => {
  it('follows the payment type rule', () => {
    expect(outletSuits('nets_click', { online: true })).toBe(true)
    expect(outletSuits('enets', { online: false })).toBe(false)
    expect(outletSuits('nets_qr', { online: false })).toBe(true)
    expect(outletSuits('sgqr', { online: true })).toBe(false)
    expect(outletSuits('card', { online: true })).toBe(true)
    expect(outletSuits('card', { online: false })).toBe(true)
  })
})

describe('outletChoices', () => {
  const promo = { key: 'qr_tuesday', channel: 'nets_qr' }
  const r = run({ outletIds: ['a'] })
  it('busy, unsuitable and free outlets, with reasons', () => {
    const c = outletChoices({ promotion: promo, outlets: shop, runs: [r], today: TODAY, access: owner })
    expect(c).toEqual([
      { id: 'a', name: 'Tampines Mall', can: false, ticked: false, reason: 'Already running "10% off on Tuesdays" (NETS QR) until Tue 15 Dec' },
      { id: 'b', name: 'Bedok Mall', can: true, ticked: true, reason: null },
      { id: 'c', name: 'Online store', can: false, ticked: false, reason: 'Online only' },
    ])
  })
  it('physical outlet for an online promotion', () => {
    const c = outletChoices({ promotion: { key: 'click_online', channel: 'nets_click' }, outlets: shop, runs: [], today: TODAY, access: owner })
    expect(c.map((x) => [x.id, x.can, x.reason])).toEqual([['a', false, 'Not an online outlet'], ['b', false, 'Not an online outlet'], ['c', true, null]])
  })
  it('finished runs and other payment types do not make an outlet busy; scheduled ones do', () => {
    const finished = run({ endsOn: '2026-11-20' })
    const stopped = run({ stoppedOn: '2026-11-21' })
    const card = run({ channel: 'card', key: 'card_weekend' })
    const sched = run({ startsOn: '2026-11-25', endsOn: '2026-12-22', outletIds: ['b'] })
    const c = outletChoices({ promotion: promo, outlets: shop, runs: [finished, stopped, card, sched], today: TODAY, access: owner })
    expect(c.find((x) => x.id === 'a').can).toBe(true)
    expect(c.find((x) => x.id === 'b').can).toBe(false)
    expect(c.find((x) => x.id === 'b').reason).toBe('Already running "10% off on Tuesdays" (NETS QR) until Tue 22 Dec')
  })
  it('outlet manager gets only their outlet', () => {
    const c = outletChoices({ promotion: promo, outlets: shop, runs: [r], today: TODAY, access: manager('b') })
    expect(c.map((x) => x.id)).toEqual(['b'])
    expect(c[0].can).toBe(true)
  })
})

describe('startable', () => {
  const promo = { key: 'qr_tuesday', channel: 'nets_qr' }
  it('free at some outlets: still startable with a note', () => {
    const three = [...shop.slice(0, 2), { id: 'd', name: 'Pasir Ris', online: false }]
    const s = startable({ promotion: promo, outlets: three, runs: [run({ outletIds: ['a', 'b'] })], today: TODAY, access: owner })
    expect(s).toEqual({ can: true, note: 'Already running a NETS QR promotion at 2 of your 3 outlets' })
  })
  it('free everywhere: no note', () => {
    expect(startable({ promotion: promo, outlets: shop, runs: [], today: TODAY, access: owner })).toEqual({ can: true, note: null })
  })
  it('busy everywhere: names the end date', () => {
    const s = startable({ promotion: promo, outlets: shop, runs: [run({ outletIds: ['a', 'b'] })], today: TODAY, access: owner })
    expect(s).toEqual({ can: false, note: 'NETS QR already has a promotion running until Tue 15 Dec' })
  })
  it('one outlet that is busy', () => {
    const s = startable({ promotion: promo, outlets: [shop[0]], runs: [run()], today: TODAY, access: owner })
    expect(s).toEqual({ can: false, note: 'NETS QR already has a promotion running until Tue 15 Dec' })
  })
  it('no suitable outlet (one physical outlet, online promotion): not offered', () => {
    const s = startable({ promotion: { key: 'click_online', channel: 'nets_click' }, outlets: [shop[0]], runs: [], today: TODAY, access: owner })
    expect(s).toEqual({ can: false, note: 'Not offered for your payment types' })
    const s2 = startable({ promotion: promo, outlets: [shop[2]], runs: [], today: TODAY, access: owner })
    expect(s2).toEqual({ can: false, note: 'Not offered for your payment types' })
  })
  it('one outlet, no online outlet, no runs: startable, no list needed', () => {
    expect(startable({ promotion: promo, outlets: [shop[0]], runs: [], today: TODAY, access: owner })).toEqual({ can: true, note: null })
  })
  it('view-only users cannot start', () => {
    const s = startable({ promotion: promo, outlets: shop, runs: [], today: TODAY, access: { ...owner, role: 'accountant' } })
    expect(s.can).toBe(false)
  })
  it('outlet manager is judged on their outlet only', () => {
    const s = startable({ promotion: promo, outlets: shop, runs: [run({ outletIds: ['a'] })], today: TODAY, access: manager('b') })
    expect(s).toEqual({ can: true, note: null })
    const s2 = startable({ promotion: promo, outlets: shop, runs: [run({ outletIds: ['a'] })], today: TODAY, access: manager('a') })
    expect(s2.can).toBe(false)
  })
})

describe('datesFor / startLabel', () => {
  it('tomorrow to +27 days', () => {
    expect(datesFor('2026-11-24')).toEqual({ startsOn: '2026-11-25', endsOn: '2026-12-22' })
    expect(datesFor('2026-12-31')).toEqual({ startsOn: '2027-01-01', endsOn: '2027-01-28' })
  })
  it('button label', () => {
    expect(startLabel(null)).toBe('Start promotion')
    expect(startLabel(1)).toBe('Start at 1 outlet')
    expect(startLabel(2)).toBe('Start at 2 outlets')
  })
})

describe('compareResults', () => {
  const days = (n, cents) => Array.from({ length: n }, (_, i) => ({ day: `2026-11-${10 + i}`, cents }))
  it('plus, minus and about the same', () => {
    expect(compareResults({ promoDays: days(8, 114000), baseDays: days(8, 100000), ranDays: 28 }))
      .toEqual({ avgCents: 114000, changePct: 14, label: '+14%', tone: 'ok' })
    expect(compareResults({ promoDays: days(8, 95000), baseDays: days(8, 100000), ranDays: 28 }))
      .toEqual({ avgCents: 95000, changePct: -5, label: '−5%', tone: 'bad' })
    expect(compareResults({ promoDays: days(8, 102000), baseDays: days(8, 100000), ranDays: 28 }))
      .toEqual({ avgCents: 102000, changePct: 2, label: 'About the same', tone: 'mute' })
    expect(compareResults({ promoDays: days(8, 98000), baseDays: days(8, 100000), ranDays: 28 }).label).toBe('About the same')
    expect(compareResults({ promoDays: days(8, 103000), baseDays: days(8, 100000), ranDays: 28 }).label).toBe('+3%')
  })
  it('averages across days', () => {
    const r = compareResults({
      promoDays: [{ day: 'a', cents: 100000 }, { day: 'b', cents: 150000 }],
      baseDays: [{ day: 'c', cents: 100000 }], ranDays: 28,
    })
    expect(r.avgCents).toBe(125000)
    expect(r.changePct).toBe(25)
  })
  it('stopped after fewer than 7 days: too short', () => {
    const r = compareResults({ promoDays: days(2, 114000), baseDays: days(8, 100000), ranDays: 3 })
    expect(r).toMatchObject({ changePct: null, label: 'Too short to compare', tone: 'mute' })
    expect(r.avgCents).toBe(114000)
  })
  it('exactly 7 days is long enough', () => {
    expect(compareResults({ promoDays: days(2, 120000), baseDays: days(2, 100000), ranDays: 7 }).label).toBe('+20%')
  })
  it('zero or missing baseline never gives NaN or Infinity', () => {
    for (const baseDays of [[], days(4, 0)]) {
      const r = compareResults({ promoDays: days(4, 50000), baseDays, ranDays: 28 })
      expect(r).toMatchObject({ changePct: null, label: 'Too short to compare', tone: 'mute' })
      expect(Number.isFinite(r.avgCents)).toBe(true)
    }
  })
  it('no promotion days at all', () => {
    const r = compareResults({ promoDays: [], baseDays: [], ranDays: 28 })
    expect(r).toEqual({ avgCents: 0, changePct: null, label: 'Too short to compare', tone: 'mute' })
  })
})

describe('pageSentence', () => {
  it('last one higher, same, lower, too short', () => {
    expect(pageSentence({ running: 1, last: { shortName: 'weekend Cards', changePct: 14 } }))
      .toEqual({ text: '1 promotion is running. Your last one, {figure}, brought in about 14% more.', figure: 'weekend Cards' })
    expect(pageSentence({ running: 2, last: { shortName: 'weekend Cards', changePct: 1 } }))
      .toEqual({ text: '2 promotions are running. Your last one, {figure}, did about the same as before.', figure: 'weekend Cards' })
    expect(pageSentence({ running: 1, last: { shortName: 'Tuesday QR', changePct: -5 } }).text)
      .toBe('1 promotion is running. Your last one, {figure}, was lower than before.')
    expect(pageSentence({ running: 1, last: { shortName: 'Tuesday QR', changePct: null } }).text)
      .toBe('1 promotion is running. Your last one, {figure}, ran too short to compare.')
  })
  it('running without results, none running with or without results', () => {
    expect(pageSentence({ running: 1, last: null })).toEqual({ text: '1 promotion is running.', figure: '' })
    expect(pageSentence({ running: 0, last: null }))
      .toEqual({ text: 'No promotions running. Take one up and NETS shows it to your customers when they pay.', figure: '' })
    expect(pageSentence({ running: 0, last: { shortName: 'weekend Cards', changePct: 14 } }).text)
      .toBe('No promotions running. Your last one, {figure}, brought in about 14% more.')
  })
})

describe('permissions wording', () => {
  it('canTakeUp is the respond rule', () => {
    expect(canTakeUp(owner)).toBe(true)
    expect(canTakeUp(manager('a'))).toBe(true)
    expect(canTakeUp({ role: 'owner', readOnly: true })).toBe(false)
    expect(canTakeUp({ role: 'accountant', readOnly: false })).toBe(false)
  })
  it('view-only note', () => {
    expect(viewOnlyNote(owner)).toBeNull()
    expect(viewOnlyNote({ role: 'accountant', readOnly: false, tier: 'merchant' }))
      .toBe('You can look but not start promotions. The owner or outlet manager does that.')
    expect(viewOnlyNote({ role: 'owner', readOnly: true, tier: 'hq' }))
      .toBe('You can look but not start promotions. The franchisee does that.')
  })
})

describe('pickOutlets', () => {
  const two = [{ id: 'a' }, { id: 'b' }]
  it('gives an outlet manager their own outlet, even when none is named', () => {
    expect(pickOutlets({ outletId: 'b' }, two, [])).toEqual({ ok: true, outletIds: ['b'] })
    expect(pickOutlets({ outletId: 'b' }, two, ['b', 'b'])).toEqual({ ok: true, outletIds: ['b'] })
  })
  it('refuses an outlet manager naming another outlet', () => {
    expect(pickOutlets({ outletId: 'b' }, two, ['a'])).toEqual({ ok: false, reason: 'bad_outlet' })
    expect(pickOutlets({ outletId: 'b' }, two, ['b', 'a'])).toEqual({ ok: false, reason: 'bad_outlet' })
  })
  it('defaults to the only outlet of a one-outlet business', () => {
    expect(pickOutlets({ outletId: null }, [{ id: 'a' }], [])).toEqual({ ok: true, outletIds: ['a'] })
  })
  it('says none for a multi-outlet owner who ticked nothing', () => {
    expect(pickOutlets({ outletId: null }, two, [])).toEqual({ ok: false, reason: 'none' })
  })
  it('removes duplicates and keeps the order', () => {
    expect(pickOutlets({ outletId: null }, two, ['b', 'a', 'b'])).toEqual({ ok: true, outletIds: ['b', 'a'] })
  })
  it('refuses an id that is not one of the outlets', () => {
    expect(pickOutlets({ outletId: null }, two, ['a', 'zzz'])).toEqual({ ok: false, reason: 'bad_outlet' })
    expect(pickOutlets({ outletId: null }, [{ id: 'a' }], ['zzz'])).toEqual({ ok: false, reason: 'bad_outlet' })
  })
})
