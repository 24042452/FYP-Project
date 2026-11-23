import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { getPromotionSales, listPromotionRuns, startPromotion, stopPromotion } from '../../lib/data/promotions.js'
import { listOutlets } from '../../lib/data/outlets.js'
import { query } from '../../lib/db.js'

const M = randomUUID() // the merchant under test
const OTHER = randomUUID() // another merchant
const USER = randomUUID()
const O_BEDOK = randomUUID()
const O_TAMPINES = randomUUID()
const O_ONLINE = randomUUID()
const O_OTHER = randomUUID() // OTHER's outlet
const TODAY = '2026-11-24'

const runCount = async (merchantId = M) =>
  Number((await query('SELECT COUNT(*) AS n FROM promotion_runs WHERE merchant_id = ?', [merchantId]))[0].n)
const outletRowCount = async (merchantId = M) =>
  Number((await query('SELECT COUNT(*) AS n FROM promotion_run_outlets WHERE merchant_id = ?', [merchantId]))[0].n)

/** Insert a run directly (as admin), for states startPromotion cannot make (running, ended). */
async function insertRun({ merchantId = M, key = 'qr_tuesday', channel = 'nets_qr', startsOn, endsOn, stoppedOn = null, outletIds }) {
  const id = randomUUID()
  await adminExecute(
    `INSERT INTO promotion_runs (promotion_run_id, merchant_id, promotion_key, channel, starts_on, ends_on, stopped_on, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '2026-11-01 00:00:00.000')`,
    [id, merchantId, key, channel, startsOn, endsOn, stoppedOn],
  )
  for (const o of outletIds) {
    await adminExecute('INSERT INTO promotion_run_outlets (promotion_run_id, merchant_id, outlet_id) VALUES (?, ?, ?)', [id, merchantId, o])
  }
  return id
}

const clearRuns = () => adminExecute('DELETE FROM promotion_runs')

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({ merchants: [{ id: M }, { id: OTHER }] })
  await adminExecute('INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)', [USER, `${USER}@t.test`, 'x', 'T'])
  await adminExecute(
    `INSERT INTO outlets (outlet_id, merchant_id, name, is_online) VALUES (?, ?, 'Bedok', 0), (?, ?, 'Tampines Mall', 0), (?, ?, 'Online store', 1), (?, ?, 'Elsewhere', 0)`,
    [O_BEDOK, M, O_TAMPINES, M, O_ONLINE, M, O_OTHER, OTHER],
  )
})

describe('listOutlets', () => {
  it('says which outlets are online', async () => {
    expect(await listOutlets(M)).toEqual([
      { id: O_BEDOK, name: 'Bedok', online: false },
      { id: O_ONLINE, name: 'Online store', online: true },
      { id: O_TAMPINES, name: 'Tampines Mall', online: false },
    ])
  })
})

describe('startPromotion', () => {
  beforeEach(clearRuns)
  const start = (outletIds, channel = 'nets_qr', merchantId = M) =>
    startPromotion(merchantId, { key: channel === 'nets_qr' ? 'qr_tuesday' : 'card_weekend', channel, outletIds, userId: USER, today: TODAY })

  it('starts tomorrow and runs 4 weeks, at the chosen outlets', async () => {
    const res = await start([O_BEDOK, O_TAMPINES])
    expect(res).toEqual({ ok: true, runId: expect.any(String) })
    const runs = await listPromotionRuns(M)
    expect(runs).toEqual([{
      id: res.ok && res.runId, key: 'qr_tuesday', channel: 'nets_qr', startsOn: '2026-11-25', endsOn: '2026-12-22', stoppedOn: null,
      outletIds: expect.arrayContaining([O_BEDOK, O_TAMPINES]), outletNames: ['Bedok', 'Tampines Mall'],
    }])
    expect(runs[0].outletIds).toHaveLength(2)
    const [row] = await query('SELECT started_by AS startedBy, created_at AS createdAt FROM promotion_runs WHERE promotion_run_id = ?', [runs[0].id])
    expect(row.startedBy).toBe(USER)
    expect(Math.abs(new Date(row.createdAt).getTime() - Date.now())).toBeLessThan(5 * 60 * 1000) // UTC "now"
  })

  it('refuses an outlet that already has a promotion of that payment type, and writes nothing', async () => {
    expect((await start([O_TAMPINES])).ok).toBe(true)
    expect(await start([O_BEDOK, O_TAMPINES])).toEqual({ ok: false, reason: 'busy', outletId: O_TAMPINES })
    expect(await runCount()).toBe(1)
    expect(await outletRowCount()).toBe(1)
  })

  it('refuses while a running promotion holds the outlet', async () => {
    await insertRun({ startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_BEDOK] })
    expect(await start([O_BEDOK])).toEqual({ ok: false, reason: 'busy', outletId: O_BEDOK })
  })

  it('accepts the same outlet for a different payment type', async () => {
    expect((await start([O_BEDOK])).ok).toBe(true)
    expect((await start([O_BEDOK], 'card')).ok).toBe(true)
    expect(await runCount()).toBe(2)
  })

  it('finished promotions (ended or stopped) do not block', async () => {
    await insertRun({ startsOn: '2026-10-01', endsOn: '2026-10-28', outletIds: [O_BEDOK] })
    await insertRun({ startsOn: '2026-11-10', endsOn: '2026-12-07', stoppedOn: '2026-11-20', outletIds: [O_BEDOK] })
    await insertRun({ startsOn: '2026-10-28', endsOn: TODAY, stoppedOn: TODAY, outletIds: [O_TAMPINES] })
    expect((await start([O_BEDOK, O_TAMPINES])).ok).toBe(true)
  })

  it('a run ending today still holds the outlet', async () => {
    await insertRun({ startsOn: '2026-10-28', endsOn: TODAY, outletIds: [O_BEDOK] })
    expect(await start([O_BEDOK])).toEqual({ ok: false, reason: 'busy', outletId: O_BEDOK })
  })

  it("another merchant's busy outlet never blocks this merchant", async () => {
    await insertRun({ merchantId: OTHER, startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_OTHER] })
    expect((await start([O_BEDOK])).ok).toBe(true)
  })

  it('refuses a forged or unknown outlet id and writes nothing (Review Focus 2)', async () => {
    for (const ids of [[O_OTHER], [O_BEDOK, O_OTHER], [randomUUID()], ['not-a-uuid'], []]) {
      expect(await start(ids)).toEqual({ ok: false, reason: 'bad_outlet' })
    }
    expect(await runCount()).toBe(0)
    expect(await runCount(OTHER)).toBe(0)
    expect(await outletRowCount()).toBe(0)
  })

  it('two requests racing for the same outlet and payment type: exactly one wins (Review Focus 1)', async () => {
    for (let i = 0; i < 5; i++) {
      await clearRuns()
      const results = await Promise.all([start([O_BEDOK]), start([O_BEDOK]), start([O_TAMPINES, O_BEDOK])])
      expect(results.filter((r) => r.ok)).toHaveLength(1)
      for (const r of results.filter((x) => !x.ok)) expect(r).toEqual({ ok: false, reason: 'busy', outletId: O_BEDOK })
      expect(await runCount()).toBe(1)
    }
  })
})

describe('stopPromotion', () => {
  beforeEach(clearRuns)
  const stop = (runId, opts = {}, merchantId = M) => stopPromotion(merchantId, runId, { userId: USER, today: TODAY, ...opts })

  it('removes a promotion that has not started, and the payment type is free at once (Review Focus 3)', async () => {
    const res = await startPromotion(M, { key: 'qr_tuesday', channel: 'nets_qr', outletIds: [O_BEDOK], userId: USER, today: TODAY })
    if (!res.ok) throw new Error('setup')
    expect(await stop(res.runId)).toEqual({ ok: true, deleted: true })
    expect(await runCount()).toBe(0)
    expect(await outletRowCount()).toBe(0)
    expect((await startPromotion(M, { key: 'qr_tuesday', channel: 'nets_qr', outletIds: [O_BEDOK], userId: USER, today: TODAY })).ok).toBe(true)
  })

  it('stops a running promotion today and keeps it for results', async () => {
    const id = await insertRun({ startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_BEDOK, O_TAMPINES] })
    expect(await stop(id)).toEqual({ ok: true, deleted: false })
    const [run] = await listPromotionRuns(M)
    expect(run).toMatchObject({ id, stoppedOn: TODAY, endsOn: '2026-12-15' })
    const [row] = await query('SELECT stopped_by AS stoppedBy FROM promotion_runs WHERE promotion_run_id = ?', [id])
    expect(row.stoppedBy).toBe(USER)
    // and the outlets are free again
    expect((await startPromotion(M, { key: 'qr_tuesday', channel: 'nets_qr', outletIds: [O_BEDOK], userId: USER, today: TODAY })).ok).toBe(true)
  })

  it('a promotion that has ended or was stopped cannot be stopped again', async () => {
    const ended = await insertRun({ startsOn: '2026-10-01', endsOn: '2026-10-28', outletIds: [O_BEDOK] })
    const stopped = await insertRun({ startsOn: '2026-11-10', endsOn: '2026-12-07', stoppedOn: '2026-11-20', outletIds: [O_BEDOK] })
    expect(await stop(ended)).toEqual({ ok: false, reason: 'already_finished' })
    expect(await stop(stopped)).toEqual({ ok: false, reason: 'already_finished' })
    expect((await listPromotionRuns(M)).find((r) => r.id === stopped).stoppedOn).toBe('2026-11-20')
  })

  it("another merchant's run, an unknown id or a bad id is not found, and nothing changes", async () => {
    const theirs = await insertRun({ merchantId: OTHER, startsOn: '2026-11-25', endsOn: '2026-12-22', outletIds: [O_OTHER] })
    expect(await stop(theirs)).toEqual({ ok: false, reason: 'not_found' })
    expect(await stop(randomUUID())).toEqual({ ok: false, reason: 'not_found' })
    expect(await stop('nope')).toEqual({ ok: false, reason: 'not_found' })
    expect(await runCount(OTHER)).toBe(1)
  })

  it('an outlet manager can stop a run only when it is at their outlet alone', async () => {
    const shared = await insertRun({ startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_BEDOK, O_TAMPINES] })
    const theirOwn = await insertRun({ channel: 'card', key: 'card_weekend', startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_BEDOK] })
    const elsewhere = await insertRun({ channel: 'sgqr', key: 'sgqr_drink', startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_TAMPINES] })
    expect(await stop(shared, { outletId: O_BEDOK })).toEqual({ ok: false, reason: 'not_yours' })
    expect(await stop(elsewhere, { outletId: O_BEDOK })).toEqual({ ok: false, reason: 'not_found' })
    expect(await stop(theirOwn, { outletId: O_BEDOK })).toEqual({ ok: true, deleted: false })
    const byId = Object.fromEntries((await listPromotionRuns(M)).map((r) => [r.id, r]))
    expect(byId[shared].stoppedOn).toBeNull()
    expect(byId[elsewhere].stoppedOn).toBeNull()
    expect(byId[theirOwn].stoppedOn).toBe(TODAY)
  })
})

describe('listPromotionRuns', () => {
  beforeEach(clearRuns)
  it('lists this merchants runs, newest first, and with an outlet only the runs that include it', async () => {
    const old = await insertRun({ startsOn: '2026-09-01', endsOn: '2026-09-28', outletIds: [O_TAMPINES] })
    const both = await insertRun({ startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_BEDOK, O_TAMPINES] })
    await insertRun({ merchantId: OTHER, startsOn: '2026-11-18', endsOn: '2026-12-15', outletIds: [O_OTHER] })
    expect((await listPromotionRuns(M)).map((r) => r.id)).toEqual([both, old])
    const bedok = await listPromotionRuns(M, { outletId: O_BEDOK })
    expect(bedok.map((r) => r.id)).toEqual([both])
    expect(bedok[0].outletNames).toEqual(['Bedok', 'Tampines Mall']) // the whole run, so the page can tell it is shared
    expect(await listPromotionRuns(M, { outletId: O_OTHER })).toEqual([])
    expect(await listPromotionRuns(randomUUID())).toEqual([])
  })
})

describe('getPromotionSales', () => {
  // Tue 2026-11-03 and Tue 2026-11-10 are promotion days; Mon 2026-11-02 and Mon 2026-11-09 are not (days [2]).
  beforeAll(async () => {
    await insertFixture({
      transactions: [
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 1000, createdAt: '2026-11-03T04:00:00.000Z' }, // Tue 12:00 SGT
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 500, createdAt: '2026-11-03T02:30:00.000Z' }, // 10:30, before lunch
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 200, createdAt: '2026-11-03T05:59:00.000Z' }, // 13:59, inside
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 300, createdAt: '2026-11-03T06:00:00.000Z' }, // 14:00, end is exclusive
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', status: 'failed', amountCents: 9000, createdAt: '2026-11-03T04:00:00.000Z' },
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', status: 'refunded', amountCents: 7700, createdAt: '2026-11-03T04:00:00.000Z' },
        { id: randomUUID(), merchantId: M, channel: 'card', amountCents: 7000, createdAt: '2026-11-03T04:00:00.000Z' },
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 800, createdAt: '2026-11-02T04:00:00.000Z' }, // Monday
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 600, createdAt: '2026-11-09T16:30:00.000Z' }, // Mon UTC = Tue 00:30 SGT
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 50, createdAt: '2026-11-17T04:00:00.000Z' }, // after `to`
      ],
    })
    await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE merchant_id = ?`, [O_BEDOK, M])
    await insertFixture({
      transactions: [
        { id: randomUUID(), merchantId: M, channel: 'nets_qr', amountCents: 4000, createdAt: '2026-11-03T04:00:00.000Z' },
        { id: randomUUID(), merchantId: OTHER, channel: 'nets_qr', amountCents: 99999, createdAt: '2026-11-03T04:00:00.000Z' },
      ],
    })
    await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE merchant_id = ? AND outlet_id IS NULL`, [O_TAMPINES, M])
    await adminExecute(`UPDATE transactions SET outlet_id = ? WHERE merchant_id = ?`, [O_OTHER, OTHER])
  })

  const sales = (opts, merchantId = M) =>
    getPromotionSales(merchantId, { channel: 'nets_qr', outletIds: [O_BEDOK], from: '2026-11-01', to: '2026-11-14', days: [2], ...opts })

  it('gives every promotion day in the range, Singapore days, successful payments of that type only', async () => {
    expect(await sales({})).toEqual([
      { day: '2026-11-03', cents: 2000 },
      { day: '2026-11-10', cents: 600 },
    ])
  })

  it('honours the hours, end exclusive, and keeps days with no sales as 0', async () => {
    expect(await sales({ hours: [11, 14] })).toEqual([
      { day: '2026-11-03', cents: 1200 },
      { day: '2026-11-10', cents: 0 },
    ])
  })

  it('honours several weekdays', async () => {
    expect(await sales({ days: [1, 2] })).toEqual([
      { day: '2026-11-02', cents: 800 },
      { day: '2026-11-03', cents: 2000 },
      { day: '2026-11-09', cents: 0 },
      { day: '2026-11-10', cents: 600 },
    ])
  })

  it('counts only the given outlets', async () => {
    expect((await sales({ outletIds: [O_BEDOK, O_TAMPINES] }))[0]).toEqual({ day: '2026-11-03', cents: 6000 })
    expect((await sales({ outletIds: [O_TAMPINES] }))[0]).toEqual({ day: '2026-11-03', cents: 4000 })
    expect(await sales({ outletIds: [] })).toEqual([])
  })

  it("never counts another merchant's payments, even with their outlet id", async () => {
    expect((await sales({ outletIds: [O_OTHER] })).every((d) => d.cents === 0)).toBe(true)
    expect((await sales({ outletIds: [O_BEDOK] }, OTHER)).every((d) => d.cents === 0)).toBe(true)
  })
})
