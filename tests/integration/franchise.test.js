import { beforeAll, describe, expect, it } from 'vitest'
import { randomUUID } from 'node:crypto'
import { adminExecute, insertFixture, resetTestDb } from './helpers.js'
import { findMerchantForUser } from '../../lib/data/merchant.js'
import { transactionsResponse, settlementsResponse, summaryResponse } from '../../lib/api/v1.js'

// Three tiers: group (HQ) -> merchant (franchisee) -> outlet. Two groups, so we can prove HQ of one
// group never reaches a franchisee of the other.
const GROUP = randomUUID()
const OTHER_GROUP = randomUUID()
const EAST = randomUUID()
const WEST = randomUUID()
const RIVAL = randomUUID() // a franchisee of the other group
const SOLO = randomUUID() // an independent merchant
const OUT_1 = randomUUID()
const OUT_2 = randomUUID()
const HQ = randomUUID()
const OWNER = randomUUID()
const MANAGER = randomUUID()
const NOBODY = randomUUID()
const idOf = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const TODAY = '2026-11-05'

async function user(id) {
  await adminExecute('INSERT INTO users (user_id, email, password_hash, name) VALUES (?, ?, ?, ?)', [id, `${id}@t.test`, 'x', 'T'])
}

beforeAll(async () => {
  await resetTestDb()
  await adminExecute('INSERT INTO merchant_groups (group_id, name) VALUES (?, ?), (?, ?)', [GROUP, 'Kopi', OTHER_GROUP, 'Rival'])
  await insertFixture({
    merchants: [
      { id: EAST, tradingName: 'Kopi East' }, { id: WEST, tradingName: 'Kopi West' },
      { id: RIVAL, tradingName: 'Rival One' }, { id: SOLO, tradingName: 'Solo Stall' },
    ],
    transactions: [
      { id: idOf(1), merchantId: EAST, amountCents: 1000, createdAt: '2026-11-04T04:00:00.000Z' },
      { id: idOf(2), merchantId: EAST, amountCents: 2000, createdAt: '2026-11-04T05:00:00.000Z' },
    ],
  })
  await adminExecute('UPDATE merchants SET group_id = ? WHERE merchant_id IN (?, ?)', [GROUP, EAST, WEST])
  await adminExecute('UPDATE merchants SET group_id = ? WHERE merchant_id = ?', [OTHER_GROUP, RIVAL])
  await adminExecute("INSERT INTO outlets (outlet_id, merchant_id, name) VALUES (?, ?, 'Tampines'), (?, ?, 'Bedok')", [OUT_1, EAST, OUT_2, EAST])
  await adminExecute('UPDATE transactions SET outlet_id = ? WHERE transaction_id = ?', [OUT_1, idOf(1)])
  await adminExecute('UPDATE transactions SET outlet_id = ? WHERE transaction_id = ?', [OUT_2, idOf(2)])
  for (const u of [HQ, OWNER, MANAGER, NOBODY]) await user(u)
  await adminExecute("INSERT INTO group_users (group_id, user_id, role) VALUES (?, ?, 'hq_owner')", [GROUP, HQ])
  await adminExecute("INSERT INTO merchant_users (merchant_id, user_id, role) VALUES (?, ?, 'owner')", [EAST, OWNER])
  await adminExecute("INSERT INTO merchant_users (merchant_id, user_id, role, outlet_id) VALUES (?, ?, 'outlet_manager', ?)", [EAST, MANAGER, OUT_2])
})

describe('findMerchantForUser: the three tiers', () => {
  it('head office sees its own franchisees only, view only', async () => {
    const a = await findMerchantForUser(HQ)
    expect(a).toMatchObject({ tier: 'hq', readOnly: true, id: EAST, chosen: false })
    expect(a?.group?.franchisees.map((f) => f.id)).toEqual([EAST, WEST])
  })

  it('head office can pick a franchisee of its group, but not one of another group or an independent merchant', async () => {
    expect(await findMerchantForUser(HQ, WEST)).toMatchObject({ id: WEST, chosen: true })
    expect(await findMerchantForUser(HQ, RIVAL)).toMatchObject({ id: EAST, chosen: false })
    expect(await findMerchantForUser(HQ, SOLO)).toMatchObject({ id: EAST, chosen: false })
  })

  it('a franchisee owner sees their own merchant, whatever the cookie says', async () => {
    expect(await findMerchantForUser(OWNER, WEST)).toMatchObject({ id: EAST, tier: 'merchant', readOnly: false, group: null })
  })

  it('an outlet manager is locked to their outlet', async () => {
    expect(await findMerchantForUser(MANAGER)).toMatchObject({ id: EAST, tier: 'outlet', outletId: OUT_2 })
  })

  it('a user with no merchant and no group gets nothing', async () => {
    expect(await findMerchantForUser(NOBODY)).toBeNull()
  })

  it('rejects an outlet manager whose outlet belongs to another merchant', async () => {
    await expect(
      adminExecute("INSERT INTO merchant_users (merchant_id, user_id, role, outlet_id) VALUES (?, ?, 'outlet_manager', ?)", [WEST, NOBODY, OUT_1]),
    ).rejects.toThrow(/foreign key/i)
  })
})

describe('the API follows the outlet lock', () => {
  const body = async (/** @type {Response} */ r) => ({ status: r.status, json: await r.json() })
  const scope = { tier: /** @type {const} */ ('outlet'), outletId: OUT_2 }

  it('an outlet manager only gets their outlet\'s payments', async () => {
    const r = await body(await transactionsResponse(EAST, { from: '2026-11-01', to: '2026-11-05' }, TODAY, scope))
    expect(r.json.data.map((t) => t.id)).toEqual([idOf(2)])
  })

  it('an outlet manager cannot ask for another outlet', async () => {
    const r = await body(await transactionsResponse(EAST, { outlet: OUT_1 }, TODAY, scope))
    expect(r.status).toBe(403)
  })

  it('an outlet manager cannot see whole-business payouts', async () => {
    expect((await settlementsResponse(EAST, {}, TODAY, scope)).status).toBe(403)
  })

  it('an outlet manager\'s summary covers their outlet only', async () => {
    const r = await body(await summaryResponse(EAST, { period: 'week' }, TODAY, scope))
    expect(r.json.gross_cents).toBe(2000)
    const all = await body(await summaryResponse(EAST, { period: 'week' }, TODAY))
    expect(all.json.gross_cents).toBe(3000)
  })
})
