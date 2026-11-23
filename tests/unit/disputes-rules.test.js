import { describe, expect, it } from 'vitest'
import {
  EVIDENCE, REASON_SHORT, REASON_TEXT, REFUND_REASON_TEXT, canRespond, daysLeft, declineReasons, effectiveStatus, hint,
  pageSentence, parseDecline, statusPill, trackSteps, viewOnlyNote,
} from '../../lib/disputes/rules.js'

const TODAY = '2026-11-23'

describe('wording tables', () => {
  it('has the exact reason texts', () => {
    expect(REASON_TEXT.charged_twice).toBe('Customer says they were charged twice')
    expect(REASON_TEXT.not_received).toBe("Customer says they didn't get their food or goods")
    expect(REASON_TEXT.not_recognised).toBe("Customer doesn't recognise this payment")
    expect(REASON_TEXT.wrong_amount).toBe('Customer says they were charged the wrong amount')
    expect(Object.values(REASON_SHORT)).toEqual(['Charged twice', 'Food or goods not received', "Doesn't recognise the payment", 'Charged the wrong amount'])
    expect(REFUND_REASON_TEXT).toEqual({
      wrong_order: 'Wrong order', charged_twice: 'Charged twice', sold_out: 'Item sold out',
      changed_mind: 'Customer changed their mind', other: 'Other',
    })
    expect(EVIDENCE.map((e) => e.value)).toEqual(['receipt', 'printout', 'photo', 'messages'])
    expect(EVIDENCE.map((e) => e.label)).toEqual(['Receipt or order slip', 'Terminal printout', 'Photo of the order', 'Messages with the customer'])
  })
})

describe('declineReasons', () => {
  it('gives the matching reason first and "Something else" last', () => {
    expect(declineReasons('charged_twice')).toEqual([
      { value: 'paid_once', label: 'The customer paid only once. I can show the one payment.' },
      { value: 'something_else', label: 'Something else' },
    ])
    expect(declineReasons('not_received')[0]).toEqual({ value: 'received', label: 'The customer got their food or goods.' })
    expect(declineReasons('not_recognised')[0]).toEqual({ value: 'made_payment', label: 'The customer made this payment.' })
    expect(declineReasons('wrong_amount')[0]).toEqual({ value: 'right_amount', label: 'The amount charged was right.' })
  })
})

describe('effectiveStatus and daysLeft', () => {
  it('works out missed and waiting on read', () => {
    expect(effectiveStatus({ status: 'open', respondBy: '2026-11-22' }, TODAY)).toBe('missed')
    expect(effectiveStatus({ status: 'open', respondBy: TODAY }, TODAY)).toBe('open')
    expect(effectiveStatus({ status: 'declined', respondBy: '2026-11-01' }, TODAY)).toBe('waiting')
    for (const s of ['won', 'lost', 'accepted']) expect(effectiveStatus({ status: s, respondBy: '2026-11-01' }, TODAY)).toBe(s)
  })
  it('counts calendar days', () => {
    expect(daysLeft('2026-11-30', TODAY)).toBe(7)
    expect(daysLeft(TODAY, TODAY)).toBe(0)
    expect(daysLeft('2026-11-22', TODAY)).toBe(-1)
  })
})

describe('statusPill', () => {
  const d = (status) => ({ status, respondBy: '2026-11-30' })
  it('gives each status its tone, icon and text', () => {
    expect(statusPill(d('open'), TODAY)).toEqual({ tone: 'bad', icon: 'alert', text: 'Answer by Mon 30 Nov' })
    expect(statusPill(d('declined'), TODAY)).toEqual({ tone: 'info', icon: 'clock', text: 'Waiting for NETS' })
    expect(statusPill(d('won'), TODAY)).toEqual({ tone: 'ok', icon: 'tick', text: 'Won, money kept' })
    expect(statusPill(d('lost'), TODAY)).toEqual({ tone: 'bad', icon: 'refund', text: 'Lost, money refunded' })
    expect(statusPill(d('accepted'), TODAY)).toEqual({ tone: 'mute', icon: 'refund', text: 'Accepted, refunded' })
    expect(statusPill({ status: 'open', respondBy: '2026-11-20' }, TODAY)).toEqual({ tone: 'bad', icon: 'refund', text: 'Missed, money refunded' })
  })
})

describe('trackSteps', () => {
  const base = { respondBy: '2026-11-30', openedAt: '2026-11-23', answeredAt: null, decideBy: null, decidedAt: null, fileCount: 0 }
  it('open: my turn, 7 days left', () => {
    expect(trackSteps({ ...base, status: 'open' }, TODAY)).toEqual([
      { label: 'Customer disputed', sub: 'Mon 23 Nov', state: 'done' },
      { label: 'Your answer', sub: '7 days left', state: 'now' },
      { label: 'NETS decides', sub: 'About 30 days after', state: 'todo' },
    ])
  })
  it('waiting: declined with files, NETS decides by a date', () => {
    const steps = trackSteps({ ...base, status: 'declined', answeredAt: '2026-11-23', decideBy: '2026-12-09', fileCount: 2 }, TODAY)
    expect(steps[1]).toEqual({ label: 'Your answer', sub: 'You declined Mon 23 Nov · 2 files sent', state: 'done' })
    expect(steps[2]).toEqual({ label: 'NETS decides', sub: 'By Wed 9 Dec', state: 'wait' })
  })
  it('accepted, won and lost are all done', () => {
    const acc = trackSteps({ ...base, status: 'accepted', answeredAt: '2026-11-24' }, TODAY)
    expect(acc[1].sub).toBe('You accepted Tue 24 Nov')
    const won = trackSteps({ ...base, status: 'won', answeredAt: '2026-11-24', decidedAt: '2026-12-01', fileCount: 1 }, TODAY)
    expect(won[1].sub).toBe('You declined Tue 24 Nov · 1 file sent')
    expect(won[2]).toEqual({ label: 'NETS decides', sub: 'Won Tue 1 Dec', state: 'done' })
    expect(trackSteps({ ...base, status: 'lost', answeredAt: '2026-11-24', decidedAt: '2026-12-01' }, TODAY).map((s) => s.state)).toEqual(['done', 'done', 'done'])
  })
})

describe('hint', () => {
  const loss = 'If you lose, $46.50 is taken back from a future payout.'
  it('charged twice, one payment found', () => {
    expect(hint({ reason: 'charged_twice', amountCents: 4650 }, 1)).toBe(`We found only one payment of $46.50 that day, so declining may win this. ${loss}`)
  })
  it('charged twice, two or more found', () => {
    expect(hint({ reason: 'charged_twice', amountCents: 4650 }, 2)).toBe(`We found 2 payments of $46.50 that day. If one was a mistake, accepting may be right. ${loss}`)
  })
  it('other reasons get the general line', () => {
    expect(hint({ reason: 'not_received', amountCents: 4650 }, 0)).toBe(`Photos of the receipt or the order help NETS decide. ${loss}`)
  })
})

describe('pageSentence', () => {
  const none = { openCount: 0, earliestRespondBy: null, openCents: 0, waitingCount: 0, waitingCents: 0, refundsMonthCount: 3, refundsMonthCents: 3160 }
  it('one open dispute', () => {
    expect(pageSentence({ ...none, openCount: 1, earliestRespondBy: '2026-11-30', openCents: 4650 }, TODAY)).toEqual({
      text: '1 dispute needs your answer by Mon 30 Nov. {figure} is at stake.', figure: '$46.50',
    })
  })
  it('several open disputes', () => {
    expect(pageSentence({ ...none, openCount: 2, earliestRespondBy: '2026-11-30', openCents: 9000 }, TODAY).text).toBe(
      '2 disputes need your answer by Mon 30 Nov. {figure} is at stake.',
    )
  })
  it('none open but waiting', () => {
    expect(pageSentence({ ...none, waitingCount: 1, waitingCents: 1820 }, TODAY)).toEqual({
      text: 'Nothing to answer. {figure} is waiting for NETS to decide.', figure: '$18.20',
    })
  })
  it('nothing open or waiting', () => {
    expect(pageSentence(none, TODAY)).toEqual({ text: 'Nothing to answer. You had {figure} ($31.60) this month.', figure: '3 refunds' })
    expect(pageSentence({ ...none, refundsMonthCount: 1 }, TODAY).figure).toBe('1 refund')
    expect(pageSentence({ ...none, refundsMonthCount: 1, refundsMonthCents: 1280 }, TODAY)).toEqual({ text: 'Nothing to answer. You had {figure} ($12.80) this month.', figure: '1 refund' })
    expect(pageSentence({ ...none, refundsMonthCount: 0, refundsMonthCents: 0 }, TODAY)).toEqual({ text: 'Nothing to answer, and no refunds this month.', figure: '' })
  })
})

describe('permissions', () => {
  it('canRespond: owners and outlet managers, unless read-only', () => {
    expect(canRespond({ role: 'owner', readOnly: false })).toBe(true)
    expect(canRespond({ role: 'outlet_manager', readOnly: false })).toBe(true)
    expect(canRespond({ role: 'accountant', readOnly: false })).toBe(false)
    expect(canRespond({ role: 'manager', readOnly: false })).toBe(false)
    expect(canRespond({ role: 'cashier', readOnly: false })).toBe(false)
    expect(canRespond({ role: 'hq_owner', readOnly: true })).toBe(false)
    expect(canRespond({ role: 'owner', readOnly: true })).toBe(false)
  })
  it('viewOnlyNote', () => {
    expect(viewOnlyNote({ role: 'owner', readOnly: false })).toBeNull()
    expect(viewOnlyNote({ role: 'accountant', readOnly: false })).toBe('You can look but not answer. The owner answers disputes.')
    expect(viewOnlyNote({ role: 'hq_owner', readOnly: true, tier: 'hq' })).toBe('You can look but not answer. The franchisee answers disputes.')
  })
})

describe('parseDecline', () => {
  it('accepts a good answer (plain object) and turns an empty note into null', () => {
    expect(parseDecline({ declineReason: 'paid_once', evidence: ['receipt', 'photo'], note: '  ' })).toEqual({
      ok: true, value: { declineReason: 'paid_once', evidence: ['receipt', 'photo'], note: null },
    })
  })
  it('accepts FormData with repeated evidence fields', () => {
    const fd = new FormData()
    fd.append('declineReason', 'received')
    fd.append('evidence', 'receipt')
    fd.append('evidence', 'messages')
    fd.append('note', 'Customer took the food.')
    expect(parseDecline(fd)).toEqual({
      ok: true, value: { declineReason: 'received', evidence: ['receipt', 'messages'], note: 'Customer took the food.' },
    })
  })
  it('names each problem in plain words', () => {
    expect(parseDecline({})).toEqual({
      ok: false, errors: { declineReason: 'Choose why you disagree.', evidence: 'Tick at least one kind of proof.' },
    })
  })
  it('needs a note for "Something else"', () => {
    const r = parseDecline({ declineReason: 'something_else', evidence: ['receipt'], note: '' })
    expect(r).toEqual({ ok: false, errors: { note: 'Tell NETS what happened (up to 500 characters).' } })
  })
  it('limits the note to 500 characters', () => {
    expect(parseDecline({ declineReason: 'paid_once', evidence: ['receipt'], note: 'x'.repeat(501) })).toEqual({
      ok: false, errors: { note: 'Keep the note under 500 characters.' },
    })
    expect(parseDecline({ declineReason: 'paid_once', evidence: ['receipt'], note: 'x'.repeat(500) }).ok).toBe(true)
  })
})
