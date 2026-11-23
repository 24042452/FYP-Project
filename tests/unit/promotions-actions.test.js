import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/data/merchant', () => ({ requirePage: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/data/outlets', () => ({ listOutlets: vi.fn() }))
vi.mock('@/lib/data/promotions', () => ({ startPromotion: vi.fn(), stopPromotion: vi.fn() }))

const { revalidatePath } = await import('next/cache')
const { requirePage } = await import('@/lib/data/merchant')
const { getSessionUser } = await import('@/lib/auth/session')
const { listOutlets } = await import('@/lib/data/outlets')
const { startPromotion, stopPromotion } = await import('@/lib/data/promotions')
const { startPromotionAction, stopPromotionAction } = await import('../../app/(portal)/campaigns/actions.js')

const OWNER = { id: 'm1', role: 'owner', readOnly: false, tier: 'merchant', outletId: null, category: 'Retail' }
const OUTLETS = [
  { id: 'o1', name: 'Bedok', online: false },
  { id: 'o2', name: 'Tampines', online: false },
  { id: 'o3', name: 'Online store', online: true },
]

/** @param {Record<string, string | string[]>} fields */
function form(fields) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x)
  return fd
}
const start = (/** @type {any} */ f) => startPromotionAction(null, form(f))
const as = (/** @type {any} */ over) => vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ ({ ...OWNER, ...over }))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-24T03:00:00Z'))
  as({})
  vi.mocked(getSessionUser).mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Tan' })
  vi.mocked(listOutlets).mockResolvedValue(/** @type {any} */ (OUTLETS))
  vi.mocked(startPromotion).mockResolvedValue({ ok: true, runId: 'r1' })
  vi.mocked(stopPromotion).mockResolvedValue({ ok: true, deleted: false })
})
afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('startPromotionAction', () => {
  it('starts for the picked outlets and says when it ends', async () => {
    const r = await start({ key: 'qr_tuesday', outletIds: ['o1', 'o2'] })
    expect(r).toEqual({ ok: true, message: 'Started. It runs until Tue 22 Dec.' })
    expect(requirePage).toHaveBeenCalledWith('/campaigns')
    expect(startPromotion).toHaveBeenCalledWith('m1', { key: 'qr_tuesday', channel: 'nets_qr', outletIds: ['o1', 'o2'], userId: 'u1', today: '2026-11-24' })
    expect(revalidatePath).toHaveBeenCalledWith('/campaigns')
  })

  it.each([
    ['accountant', { role: 'accountant' }],
    ['head office', { role: 'hq_owner', readOnly: true, tier: 'hq' }],
  ])('refuses %s without starting', async (_n, over) => {
    as(over)
    expect(await start({ key: 'qr_tuesday', outletIds: ['o1'] })).toEqual({ ok: false, message: 'Only the owner or an outlet manager can do this.' })
    expect(startPromotion).not.toHaveBeenCalled()
  })

  it('forces an outlet manager to their own outlet', async () => {
    as({ role: 'outlet_manager', tier: 'outlet', outletId: 'o2' })
    await start({ key: 'qr_tuesday' })
    expect(startPromotion).toHaveBeenCalledWith('m1', expect.objectContaining({ outletIds: ['o2'] }))
  })

  it('refuses an outlet manager naming another outlet', async () => {
    as({ role: 'outlet_manager', tier: 'outlet', outletId: 'o2' })
    const r = await start({ key: 'qr_tuesday', outletIds: ['o1'] })
    expect(r.ok).toBe(false)
    expect(startPromotion).not.toHaveBeenCalled()
  })

  it('refuses an unknown key, and one for the other kind of business', async () => {
    expect(await start({ key: 'nope', outletIds: ['o1'] })).toEqual({ ok: false, message: "We couldn't find that promotion." })
    // qr_lunch is F&B only; this merchant is Retail
    expect((await start({ key: 'qr_lunch', outletIds: ['o1'] })).ok).toBe(false)
    expect(startPromotion).not.toHaveBeenCalled()
  })

  it('refuses an online-only promotion at a physical outlet, and a counter one at the online store', async () => {
    expect((await start({ key: 'click_online', outletIds: ['o1'] })).ok).toBe(false)
    expect((await start({ key: 'qr_tuesday', outletIds: ['o3'] })).ok).toBe(false)
    expect(startPromotion).not.toHaveBeenCalled()
  })

  it('refuses an outlet that is not the merchant', async () => {
    expect((await start({ key: 'qr_tuesday', outletIds: ['other'] })).ok).toBe(false)
    expect(startPromotion).not.toHaveBeenCalled()
  })

  it('asks for an outlet when none is ticked', async () => {
    expect(await start({ key: 'qr_tuesday' })).toEqual({ ok: false, message: 'Pick at least one outlet.' })
  })

  it('uses the only outlet of a one-outlet business', async () => {
    vi.mocked(listOutlets).mockResolvedValue(/** @type {any} */ ([OUTLETS[0]]))
    await start({ key: 'qr_tuesday' })
    expect(startPromotion).toHaveBeenCalledWith('m1', expect.objectContaining({ outletIds: ['o1'] }))
  })

  it('names the payment type when an outlet is busy', async () => {
    vi.mocked(startPromotion).mockResolvedValue({ ok: false, reason: 'busy', outletId: 'o1' })
    expect(await start({ key: 'qr_tuesday', outletIds: ['o1'] })).toEqual({
      ok: false,
      message: 'That outlet already has a NETS QR promotion. Pick another outlet.',
    })
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('stopPromotionAction', () => {
  const stop = () => stopPromotionAction(null, form({ runId: 'r1' }))

  it('stops a running promotion', async () => {
    expect(await stop()).toEqual({ ok: true, message: 'Stopped. Results show below.' })
    expect(stopPromotion).toHaveBeenCalledWith('m1', 'r1', { userId: 'u1', today: '2026-11-24', outletId: null })
    expect(revalidatePath).toHaveBeenCalledWith('/campaigns')
  })

  it('removes one that had not started', async () => {
    vi.mocked(stopPromotion).mockResolvedValue({ ok: true, deleted: true })
    expect(await stop()).toEqual({ ok: true, message: 'Removed. It had not started yet.' })
  })

  it('refuses an accountant without stopping', async () => {
    as({ role: 'accountant' })
    expect(await stop()).toEqual({ ok: false, message: 'Only the owner or an outlet manager can do this.' })
    expect(stopPromotion).not.toHaveBeenCalled()
  })

  it('passes the outlet manager outlet, and shows the view-only message for not_yours', async () => {
    as({ role: 'outlet_manager', tier: 'outlet', outletId: 'o2' })
    vi.mocked(stopPromotion).mockResolvedValue({ ok: false, reason: 'not_yours' })
    expect(await stop()).toEqual({ ok: false, message: 'Only the owner or an outlet manager can do this.' })
    expect(stopPromotion).toHaveBeenCalledWith('m1', 'r1', expect.objectContaining({ outletId: 'o2' }))
  })

  it.each([
    ['not_found', "We couldn't find that promotion."],
    ['already_finished', 'That promotion has already finished.'],
  ])('maps %s', async (reason, message) => {
    vi.mocked(stopPromotion).mockResolvedValue(/** @type {any} */ ({ ok: false, reason }))
    expect(await stop()).toEqual({ ok: false, message })
  })
})
