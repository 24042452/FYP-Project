import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/data/merchant', () => ({ requirePage: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/data/outlets', () => ({ listOutlets: vi.fn() }))
vi.mock('@/lib/data/offers', () => ({ takeUpOffer: vi.fn() }))

const { revalidatePath } = await import('next/cache')
const { requirePage } = await import('@/lib/data/merchant')
const { getSessionUser } = await import('@/lib/auth/session')
const { listOutlets } = await import('@/lib/data/outlets')
const { takeUpOffer } = await import('@/lib/data/offers')
const { takeUpOfferAction } = await import('../../app/(portal)/offers/actions.js')

const OWNER = { id: 'm1', role: 'owner', readOnly: false, tier: 'merchant', outletId: null, category: 'F&B' }
const OUTLETS = [
  { id: 'o1', name: 'Bedok', online: false },
  { id: 'o2', name: 'Tampines', online: false },
]

/** @param {Record<string, string | string[]>} fields */
function form(fields) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x)
  return fd
}
const take = (/** @type {any} */ f) => takeUpOfferAction(null, form(f))
const as = (/** @type {any} */ over) => vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ ({ ...OWNER, ...over }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-24T03:00:00Z'))
  as({})
  vi.mocked(getSessionUser).mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Ah Hock' })
  vi.mocked(listOutlets).mockResolvedValue(/** @type {any} */ (OUTLETS))
  vi.mocked(takeUpOffer).mockResolvedValue({ ok: true, takeupId: 't1', endsOn: '2027-02-23' })
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('takeUpOfferAction', () => {
  it('takes up and says when it ends', async () => {
    expect(await take({ key: 'qr_fee_cut', outletIds: ['o1', 'o2'] })).toEqual({ ok: true, message: 'Taken up. Active until Tue 23 Feb.' })
    expect(requirePage).toHaveBeenCalledWith('/offers')
    expect(takeUpOffer).toHaveBeenCalledWith('m1', { key: 'qr_fee_cut', months: 3, outletIds: ['o1', 'o2'], userId: 'u1', today: '2026-11-24' })
    expect(revalidatePath).toHaveBeenCalledWith('/offers')
  })

  it('refuses an accountant without taking up', async () => {
    as({ role: 'accountant' })
    expect(await take({ key: 'qr_fee_cut', outletIds: ['o1'] })).toEqual({ ok: false, message: 'Only the owner or an outlet manager can do this.' })
    expect(takeUpOffer).not.toHaveBeenCalled()
  })

  it('refuses an unknown key and an offer for the other kind of business', async () => {
    expect(await take({ key: 'nope', outletIds: ['o1'] })).toEqual({ ok: false, message: "We couldn't find that offer." })
    expect((await take({ key: 'shelf_labels', outletIds: ['o1'] })).ok).toBe(false) // Retail only
    expect(takeUpOffer).not.toHaveBeenCalled()
  })

  it('forces an outlet manager to their outlet and refuses another', async () => {
    as({ role: 'outlet_manager', tier: 'outlet', outletId: 'o2' })
    await take({ key: 'qr_fee_cut' })
    expect(takeUpOffer).toHaveBeenCalledWith('m1', expect.objectContaining({ outletIds: ['o2'] }))
    vi.mocked(takeUpOffer).mockClear()
    expect((await take({ key: 'qr_fee_cut', outletIds: ['o1'] })).ok).toBe(false)
    expect(takeUpOffer).not.toHaveBeenCalled()
  })

  it('refuses an outlet that is not the merchant, and asks for one when none is ticked', async () => {
    expect((await take({ key: 'qr_fee_cut', outletIds: ['other'] })).ok).toBe(false)
    expect(await take({ key: 'qr_fee_cut' })).toEqual({ ok: false, message: 'Pick at least one outlet.' })
    expect(takeUpOffer).not.toHaveBeenCalled()
  })

  it('refuses an in-store offer at an online outlet (a forged form), but takes a partner deal there', async () => {
    vi.mocked(listOutlets).mockResolvedValue(/** @type {any} */ ([...OUTLETS, { id: 'o3', name: 'Online store', online: true }]))
    expect(await take({ key: 'qr_fee_cut', outletIds: ['o1', 'o3'] })).toEqual({ ok: false, message: 'Pick an outlet that can take this offer.' })
    expect(await take({ key: 'qr_standee', outletIds: ['o3'] })).toEqual({ ok: false, message: 'Pick an outlet that can take this offer.' })
    expect(takeUpOffer).not.toHaveBeenCalled()
    await take({ key: 'delivery_listing', outletIds: ['o3'] })
    expect(takeUpOffer).toHaveBeenCalledWith('m1', expect.objectContaining({ key: 'delivery_listing', outletIds: ['o3'] }))
  })

  it('refuses an outlet manager of an online outlet an in-store offer', async () => {
    vi.mocked(listOutlets).mockResolvedValue(/** @type {any} */ ([...OUTLETS, { id: 'o3', name: 'Online store', online: true }]))
    as({ role: 'outlet_manager', tier: 'outlet', outletId: 'o3' })
    expect(await take({ key: 'qr_fee_cut' })).toEqual({ ok: false, message: 'Pick an outlet that can take this offer.' })
    expect(takeUpOffer).not.toHaveBeenCalled()
  })

  it('says so when the offer is already active at an outlet', async () => {
    vi.mocked(takeUpOffer).mockResolvedValue({ ok: false, reason: 'busy', outletId: 'o1' })
    expect(await take({ key: 'qr_fee_cut', outletIds: ['o1'] })).toEqual({ ok: false, message: 'That outlet already has this offer. Pick another outlet.' })
  })
})
