import { describe, expect, it } from 'vitest'
import { buildDisputesPage, fileSize, paymentHref, toRefundView } from '@/lib/disputes/view'

const TODAY = '2026-11-23'
/** @param {Partial<import('@/lib/data/disputes').DisputeRow>} over */
const dispute = (over) => ({
  id: 'd1', transactionId: 't1', amountCents: 4650, reason: 'charged_twice', status: 'open',
  openedAt: '2026-11-20', respondBy: '2026-11-30', answeredAt: null, declineReason: null, evidence: [], note: null,
  decideBy: null, decidedAt: null, channel: 'card', paidAt: '2026-11-14T04:41:00.000Z', tid: '70012345', stan: '004512',
  outletId: null, sameAmountCount: 1, fileCount: 0, files: [], ...over,
})
/** @param {Partial<import('@/lib/data/refunds').RefundRow>} over */
const refund = (over) => ({
  id: 'r1', transactionId: 't9', amountCents: 1280, reason: 'wrong_order', refundedAt: '2026-11-21T03:00:00.000Z',
  paidAt: '2026-11-15T03:00:00.000Z', channel: 'nets_qr',
  payout: { id: 's1', businessDate: '2026-11-21', status: 'paid', expectedDate: '2026-11-23', paidDate: '2026-11-23' }, ...over,
})

describe('buildDisputesPage', () => {
  it('leads with the open dispute: sentence, red tile, case with meta, hint and decline reasons', () => {
    const m = buildDisputesPage({ disputes: [dispute({})], refunds: [], today: TODAY })
    expect(`${m.sentence.before}${m.sentence.figure}${m.sentence.after}`).toBe('1 dispute needs your answer by Mon 30 Nov. $46.50 is at stake.')
    expect(m.tiles[0]).toEqual({ label: 'Needs your answer', value: '1 dispute', hint: 'Answer by Mon 30 Nov · 7 days left', tone: 'attention' })
    const c = m.cases[0]
    expect(c.meta).toBe('Cards · paid Sat 14 Nov, 12:41 pm · TID 70012345 · STAN 004512')
    expect(c.hint).toMatch(/^We found only one payment of \$46.50 that day/)
    expect(c.reasons.map((r) => r.value)).toEqual(['paid_once', 'something_else'])
    expect(c.paymentHref).toBe('/transactions?id=t1&from=2026-11-14&to=2026-11-14')
  })

  it('puts waiting cases after open ones and closed ones in the list, latest decision first, with files', () => {
    const m = buildDisputesPage({
      disputes: [
        dispute({ id: 'w', status: 'declined', reason: 'not_recognised', amountCents: 1820, channel: 'nets_click', answeredAt: '2026-11-09', decideBy: '2026-12-09', fileCount: 2, files: [{ id: 'f1', name: 'a.jpg', sizeBytes: 655360 }, { id: 'f2', name: 'b.pdf', sizeBytes: 1572864 }] }),
        dispute({ id: 'won', status: 'won', reason: 'not_received', answeredAt: '2026-10-05', decidedAt: '2026-10-28', openedAt: '2026-10-02', fileCount: 1 }),
        dispute({ id: 'acc', status: 'accepted', reason: 'wrong_amount', answeredAt: '2026-09-12', openedAt: '2026-09-10' }),
        dispute({ id: 'o' }),
      ],
      refunds: [],
      today: TODAY,
    })
    expect(m.cases.map((c) => c.id)).toEqual(['o', 'w'])
    expect(m.cases[1].meta).toBe('NETS Click · paid Sat 14 Nov, 12:41 pm · you declined it on Mon 9 Nov')
    expect(m.cases[1].filesSent).toBe('2 files sent')
    expect(m.cases[1].files.map((f) => [f.size, f.href])).toEqual([['640 KB', '/disputes/files/f1'], ['1.5 MB', '/disputes/files/f2']])
    expect(m.tiles[1]).toEqual({ label: 'Waiting for NETS', value: '$18.20', hint: '1 dispute you declined on 9 Nov' })
    expect(m.closed.map((c) => [c.short, c.closedSub, c.pill.text])).toEqual([
      ['Not received · $46.50', 'Cards · Oct · you declined with 1 file', 'Won, money kept'],
      ['Charged the wrong amount · $46.50', 'Cards · Sep · you accepted', 'Accepted, refunded'],
    ])
  })

  it('with nothing at all, says so without a blue figure', () => {
    const m = buildDisputesPage({ disputes: [], refunds: [], today: TODAY })
    expect(m.sentence).toEqual({ before: 'Nothing to answer, and no refunds this month.', figure: '', after: '' })
  })

  it('with nothing open or waiting, talks about this month’s refunds', () => {
    const m = buildDisputesPage({
      disputes: [],
      refunds: [refund({}), refund({ id: 'r2', amountCents: 600 }), refund({ id: 'old', refundedAt: '2026-10-20T03:00:00.000Z' })],
      today: TODAY,
    })
    expect(`${m.sentence.before}${m.sentence.figure}${m.sentence.after}`).toBe('Nothing to answer. You had 2 refunds ($18.80) this month.')
    expect(m.tiles[0]).toEqual({ label: 'Needs your answer', value: 'None', hint: 'Nothing to answer' })
    expect(m.tiles[2]).toEqual({ label: 'Refunds this month', value: '$18.80', hint: '2 refunds · taken from your payouts' })
    expect(m.refunds).toHaveLength(3)
  })
})

describe('toRefundView', () => {
  it('says which payout the refund came from, or "Next payout" when it is not paid yet', () => {
    expect(toRefundView(refund({}))).toMatchObject({ refundedOn: 'Sat 21 Nov', boughtOn: 'Sun 15 Nov', channel: 'NETS QR', reason: 'Wrong order', amount: '$12.80', payout: { tone: 'ok', text: 'Taken from payout Mon 23 Nov' } })
    expect(toRefundView(refund({ payout: { id: 's', businessDate: '2026-11-23', status: 'pending', expectedDate: '2026-11-24', paidDate: null } })).payout).toEqual({ tone: 'info', text: 'Next payout' })
    expect(toRefundView(refund({ payout: null })).payout).toEqual({ tone: 'info', text: 'Next payout' })
  })
})

describe('small helpers', () => {
  it('formats file sizes and payment links', () => {
    expect(fileSize(500)).toBe('1 KB')
    expect(fileSize(3_565_158)).toBe('3.4 MB')
    expect(paymentHref('abc', '2026-11-14T17:30:00.000Z')).toBe('/transactions?id=abc&from=2026-11-15&to=2026-11-15')
  })
})
