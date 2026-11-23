import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/data/merchant', () => ({ requirePage: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSessionUser: vi.fn() }))
vi.mock('@/lib/data/disputes', () => ({ listDisputes: vi.fn(), answerDispute: vi.fn(), getDisputeFile: vi.fn() }))

const { revalidatePath } = await import('next/cache')
const { requirePage } = await import('@/lib/data/merchant')
const { getSessionUser } = await import('@/lib/auth/session')
const { listDisputes, answerDispute, getDisputeFile } = await import('@/lib/data/disputes')
const { acceptDispute, declineDispute } = await import('../../app/(portal)/disputes/actions.js')
const { GET: getFile } = await import('../../app/(portal)/disputes/files/[id]/route.js')

const DISPUTE_ID = '11111111-1111-4111-8111-111111111111'
const OWNER = { id: 'm1', role: 'owner', readOnly: false, tier: 'merchant', outletId: null }
const DISPUTE = { id: DISPUTE_ID, reason: 'not_received', amountCents: 4650, status: 'open' }
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]

/** @param {Record<string, string | string[] | File[]>} fields */
function form(fields) {
  const fd = new FormData()
  for (const [k, v] of Object.entries(fields)) for (const x of Array.isArray(v) ? v : [v]) fd.append(k, x)
  return fd
}

const declineForm = (extra = {}) =>
  form({ disputeId: DISPUTE_ID, declineReason: 'received', evidence: ['receipt', 'photo'], note: 'Collected at 1 pm.', ...extra })

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-23T03:00:00Z'))
  vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ (OWNER))
  vi.mocked(getSessionUser).mockResolvedValue({ id: 'u1', email: 'a@b.c', name: 'Ah Hock' })
  vi.mocked(listDisputes).mockResolvedValue(/** @type {any} */ ([DISPUTE]))
  vi.mocked(answerDispute).mockResolvedValue({ ok: true })
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('acceptDispute', () => {
  it('accepts for the owner and says how much goes back', async () => {
    const r = await acceptDispute(null, form({ disputeId: DISPUTE_ID }))
    expect(r).toEqual({ ok: true, message: 'Accepted. $46.50 goes back to the customer.' })
    expect(requirePage).toHaveBeenCalledWith('/disputes')
    expect(answerDispute).toHaveBeenCalledWith('m1', DISPUTE_ID, { action: 'accept', userId: 'u1', outletId: null, today: '2026-11-23' })
    expect(revalidatePath).toHaveBeenCalledWith('/disputes')
  })

  it('refuses a view-only login (accountant) without answering', async () => {
    vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ ({ ...OWNER, role: 'accountant' }))
    const r = await acceptDispute(null, form({ disputeId: DISPUTE_ID }))
    expect(r).toEqual({ ok: false, message: 'Only the owner can answer disputes.' })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it('refuses head office (read-only)', async () => {
    vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ ({ ...OWNER, role: 'hq_owner', readOnly: true, tier: 'hq' }))
    expect(await acceptDispute(null, form({ disputeId: DISPUTE_ID }))).toMatchObject({ ok: false, message: 'Only the owner can answer disputes.' })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it("passes an outlet manager's outlet to the lookup and the answer", async () => {
    vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ ({ ...OWNER, role: 'outlet_manager', tier: 'outlet', outletId: 'o2' }))
    await acceptDispute(null, form({ disputeId: DISPUTE_ID }))
    expect(listDisputes).toHaveBeenCalledWith('m1', { outletId: 'o2' })
    expect(answerDispute).toHaveBeenCalledWith('m1', DISPUTE_ID, expect.objectContaining({ outletId: 'o2' }))
  })

  it('says it cannot find a dispute that is not in the list', async () => {
    vi.mocked(listDisputes).mockResolvedValue([])
    expect(await acceptDispute(null, form({ disputeId: DISPUTE_ID }))).toEqual({ ok: false, message: "We couldn't find that dispute." })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it.each([
    ['already_answered', 'This dispute was already answered.'],
    ['too_late', 'The time to answer has passed.'],
    ['not_found', "We couldn't find that dispute."],
  ])('maps %s to its message', async (reason, message) => {
    vi.mocked(answerDispute).mockResolvedValue(/** @type {any} */ ({ ok: false, reason }))
    expect(await acceptDispute(null, form({ disputeId: DISPUTE_ID }))).toEqual({ ok: false, message })
  })
})

describe('declineDispute', () => {
  it('sends the answer with the files and confirms the day', async () => {
    const file = new File([new Uint8Array([...PDF, 1, 2, 3])], 'receipt.pdf', { type: 'application/pdf' })
    const r = await declineDispute(null, declineForm({ files: [file] }))
    expect(r).toEqual({ ok: true, message: 'Sent to NETS on Mon 23 Nov. NETS usually decides within 30 days.' })
    const [mid, id, answer] = vi.mocked(answerDispute).mock.calls[0]
    expect([mid, id]).toEqual(['m1', DISPUTE_ID])
    expect(answer).toMatchObject({
      action: 'decline', userId: 'u1', outletId: null, today: '2026-11-23',
      declineReason: 'received', evidence: ['receipt', 'photo'], note: 'Collected at 1 pm.',
    })
    expect(answer.files).toHaveLength(1)
    expect(answer.files[0].name).toBe('receipt.pdf')
    expect(answer.files[0].mime).toBe('application/pdf')
    expect(Buffer.isBuffer(answer.files[0].bytes)).toBe(true)
    expect(answer.files[0].bytes.length).toBe(11)
    expect(revalidatePath).toHaveBeenCalledWith('/disputes')
  })

  it('ignores the empty file a form sends when nothing was picked', async () => {
    const r = await declineDispute(null, declineForm({ files: [new File([], '')] }))
    expect(r.ok).toBe(true)
    expect(vi.mocked(answerDispute).mock.calls[0][2].files).toEqual([])
  })

  it('refuses an accountant without answering', async () => {
    vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ ({ ...OWNER, role: 'accountant' }))
    const r = await declineDispute(null, declineForm())
    expect(r).toMatchObject({ ok: false, message: 'Only the owner can answer disputes.' })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it('keeps what was typed when a file is not allowed', async () => {
    const file = new File([new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0])], 'cat.gif')
    const r = await declineDispute(null, declineForm({ files: [file] }))
    expect(r).toEqual({
      ok: false,
      message: 'Only photos (JPG, PNG) or PDFs.',
      values: { declineReason: 'received', evidence: ['receipt', 'photo'], note: 'Collected at 1 pm.' },
    })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it('refuses a file over 2 MB', async () => {
    const big = new Uint8Array(2_097_153)
    big.set(PDF)
    const r = await declineDispute(null, declineForm({ files: [new File([big], 'big.pdf')] }))
    expect(r).toMatchObject({ ok: false, message: 'That file is 2.0 MB. Files can be up to 2 MB.' })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it('shows field errors and keeps the values', async () => {
    const r = await declineDispute(null, form({ disputeId: DISPUTE_ID, declineReason: 'something_else', note: '' }))
    expect(r).toEqual({
      ok: false,
      errors: { evidence: 'Tick at least one kind of proof.', note: 'Tell NETS what happened (up to 500 characters).' },
      values: { declineReason: 'something_else', evidence: [], note: '' },
    })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it('refuses a reason that is not offered for this dispute', async () => {
    // "paid_once" belongs to "Charged twice"; this dispute is "Not received".
    const r = await declineDispute(null, declineForm({ declineReason: 'paid_once' }))
    expect(r).toMatchObject({ ok: false, errors: { declineReason: 'Choose why you disagree.' } })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it('says it cannot find a dispute of another merchant or outlet', async () => {
    vi.mocked(listDisputes).mockResolvedValue([])
    expect(await declineDispute(null, declineForm())).toMatchObject({ ok: false, message: "We couldn't find that dispute." })
    expect(answerDispute).not.toHaveBeenCalled()
  })

  it('maps already_answered to its message and keeps the values', async () => {
    vi.mocked(answerDispute).mockResolvedValue({ ok: false, reason: 'already_answered' })
    expect(await declineDispute(null, declineForm())).toMatchObject({
      ok: false,
      message: 'This dispute was already answered.',
      values: { declineReason: 'received', evidence: ['receipt', 'photo'], note: 'Collected at 1 pm.' },
    })
  })
})

describe('evidence file download', () => {
  const FILE_ID = '22222222-2222-4222-8222-222222222222'
  const call = () => getFile(new Request(`http://x/disputes/files/${FILE_ID}`), { params: Promise.resolve({ id: FILE_ID }) })

  it("serves the file with its stored type, for the signed-in merchant's outlet only", async () => {
    vi.mocked(requirePage).mockResolvedValue(/** @type {any} */ ({ ...OWNER, tier: 'outlet', outletId: 'o2' }))
    vi.mocked(getDisputeFile).mockResolvedValue({ name: 'my "receipt"\r\n.pdf', mime: 'application/pdf', data: Buffer.from(PDF) })
    const res = await call()
    expect(requirePage).toHaveBeenCalledWith('/disputes')
    expect(getDisputeFile).toHaveBeenCalledWith('m1', FILE_ID, { outletId: 'o2' })
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/pdf')
    expect(res.headers.get('Content-Disposition')).toBe('inline; filename="my receipt.pdf"')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array(PDF))
  })

  it('answers 404 for a file that is not theirs', async () => {
    vi.mocked(getDisputeFile).mockResolvedValue(null)
    const res = await call()
    expect(res.status).toBe(404)
    expect(res.headers.get('Cache-Control')).toBe('private, no-store')
  })
})
