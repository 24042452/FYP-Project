import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { listOfferTakeups, takeUpOffer } from '../../lib/data/offers.js'
import { query } from '../../lib/db.js'

const M = randomUUID()
const OTHER = randomUUID()
const USER = randomUUID()
const O_1 = randomUUID()
const O_2 = randomUUID()
const O_OTHER = randomUUID()
const TODAY = '2026-11-24'

const takeupCount = async (merchantId = M) =>
  Number((await query('SELECT COUNT(*) AS n FROM offer_takeups WHERE merchant_id = ?', [merchantId]))[0].n)

async function insertTakeup({ merchantId = M, key = 'qr_fee_cut', startsOn, endsOn, outletIds }) {
  const id = randomUUID()
  await adminExecute(
    `INSERT INTO offer_takeups (offer_takeup_id, merchant_id, offer_key, starts_on, ends_on, created_at) VALUES (?, ?, ?, ?, ?, '2026-11-01 00:00:00.000')`,
    [id, merchantId, key, startsOn, endsOn],
  )
  for (const o of outletIds) {
    await adminExecute('INSERT INTO offer_takeup_outlets (offer_takeup_id, merchant_id, outlet_id) VALUES (?, ?, ?)', [id, merchantId, o])
  }
  return id
}

const take = (outletIds, key = 'qr_fee_cut', merchantId = M) =>
  takeUpOffer(merchantId, { key, months: 3, outletIds, userId: USER, today: TODAY })

beforeAll(async () => {
  await resetTestDb()
  await insertFixture({ merchants: [{ id: M }, { id: OTHER }] })
  await adminExecute('INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)', [USER, `${USER}@t.test`, 'x', 'T'])
  await adminExecute(`INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'One'), (?, ?, 'Two'), (?, ?, 'Else')`, [O_1, M, O_2, M, O_OTHER, OTHER])
})

beforeEach(() => adminExecute('DELETE FROM offer_takeups'))

describe('takeUpOffer', () => {
  it('is active from today for the offer length (the last day is the day before the same date N months on)', async () => {
    const res = await take([O_1, O_2])
    expect(res).toEqual({ ok: true, takeupId: expect.any(String), endsOn: '2027-02-23' })
    const list = await listOfferTakeups(M)
    expect(list).toEqual([{
      id: res.ok && res.takeupId, key: 'qr_fee_cut', startsOn: TODAY, endsOn: '2027-02-23',
      outletIds: expect.arrayContaining([O_1, O_2]), outletNames: ['One', 'Two'],
    }])
    const [row] = await query('SELECT taken_by AS takenBy FROM offer_takeups WHERE offer_takeup_id = ?', [list[0].id])
    expect(row.takenBy).toBe(USER)
  })

  it('refuses an outlet where the same offer is still active, and writes nothing', async () => {
    await insertTakeup({ startsOn: '2026-11-01', endsOn: TODAY, outletIds: [O_2] })
    expect(await take([O_1, O_2])).toEqual({ ok: false, reason: 'busy', outletId: O_2 })
    expect(await takeupCount()).toBe(1)
  })

  it('allows a different offer at the same outlet, and the same offer once it has ended', async () => {
    await insertTakeup({ startsOn: '2026-11-01', endsOn: '2027-01-31', outletIds: [O_1] })
    await insertTakeup({ key: 'qr_standee', startsOn: '2026-08-01', endsOn: '2026-10-31', outletIds: [O_2] })
    expect((await take([O_1], 'qr_standee')).ok).toBe(true) // O_1 has a different offer active
    expect((await take([O_2], 'qr_standee')).ok).toBe(true) // O_2's standee offer has ended
    expect(await take([O_1], 'qr_standee')).toEqual({ ok: false, reason: 'busy', outletId: O_1 })
  })

  it('refuses a forged or unknown outlet id and writes nothing', async () => {
    for (const ids of [[O_OTHER], [O_1, O_OTHER], [randomUUID()], ['bad'], []]) {
      expect(await take(ids)).toEqual({ ok: false, reason: 'bad_outlet' })
    }
    expect(await takeupCount()).toBe(0)
    expect(await takeupCount(OTHER)).toBe(0)
  })

  it("another merchant's take-up of the same offer never blocks this merchant", async () => {
    await insertTakeup({ merchantId: OTHER, startsOn: '2026-11-01', endsOn: '2027-01-31', outletIds: [O_OTHER] })
    expect((await take([O_1])).ok).toBe(true)
  })

  it('two requests racing for the same offer and outlet: exactly one wins', async () => {
    for (let i = 0; i < 5; i++) {
      await adminExecute('DELETE FROM offer_takeups')
      const results = await Promise.all([take([O_1]), take([O_1]), take([O_2, O_1])])
      expect(results.filter((r) => r.ok)).toHaveLength(1)
      expect(await takeupCount()).toBe(1)
    }
  })
})

describe('listOfferTakeups', () => {
  it('lists this merchants take-ups, newest first; with an outlet only those that include it', async () => {
    const old = await insertTakeup({ startsOn: '2026-06-01', endsOn: '2026-08-31', outletIds: [O_2] })
    const both = await insertTakeup({ key: 'qr_standee', startsOn: '2026-11-01', endsOn: '2027-10-31', outletIds: [O_1, O_2] })
    await insertTakeup({ merchantId: OTHER, startsOn: '2026-11-01', endsOn: '2027-01-31', outletIds: [O_OTHER] })
    expect((await listOfferTakeups(M)).map((t) => t.id)).toEqual([both, old])
    expect((await listOfferTakeups(M, { outletId: O_1 })).map((t) => t.id)).toEqual([both])
    expect(await listOfferTakeups(M, { outletId: O_OTHER })).toEqual([])
    expect(await listOfferTakeups(randomUUID())).toEqual([])
  })
})
