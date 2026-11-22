import { describe, expect, it } from 'vitest'
import { buildGuide } from '../../lib/recon/guide.js'

const MID = '110000000123456'
const ctx = { mid: MID, month: '2026-10' }

const short = {
  type: /** @type {const} */ ('amount_mismatch'), day: '2026-10-18', channel: /** @type {const} */ ('card'),
  expectedCents: 228067, actualCents: 223857, message: 'Short by $42.10 · Cards sales on 18 Oct',
}

describe('buildGuide', () => {
  it('walks through money that is short, with its own dates, link and amounts', () => {
    const g = buildGuide(short, ctx)
    expect(g?.why).toMatch(/refund or chargeback/)
    expect(g?.steps.map((s) => s.title)).toEqual([
      'Look for a refund or chargeback on 18 Oct',
      'Check your bank for 19 Oct and 20 Oct',
      'Still short? Contact NETS',
      'When it is fixed, mark it as sorted',
    ])
    expect(g?.steps[0].link).toEqual({ href: '/transactions?from=2026-10-18&to=2026-10-18&channel=card', label: 'See the 18 Oct Cards payments' })
    expect(g?.steps[1].text).toContain('$42.10')
    expect(g?.steps[2].details).toEqual([
      { label: 'Merchant ID (MID)', value: MID },
      { label: 'Sales date', value: '18 Oct 2026, Cards' },
      { label: 'We expected', value: '$2,280.67' },
      { label: 'Arrived in your bank', value: '$2,238.57' },
      { label: 'Difference', value: '−$42.10' },
    ])
  })

  it('gives NETS everything in one block of text to copy', () => {
    expect(buildGuide(short, ctx)?.copyText).toBe(
      [
        'Check-up problem: Short by $42.10 · Cards sales on 18 Oct',
        `Merchant ID (MID): ${MID}`,
        'Sales date: 18 Oct 2026, Cards',
        'We expected: $2,280.67',
        'Arrived in your bank: $2,238.57',
        'Difference: −$42.10',
      ].join('\n'),
    )
  })

  it('has different steps when more money arrived than expected', () => {
    const g = buildGuide({ ...short, actualCents: 230000, message: 'Over by $19.33' }, ctx)
    expect(g?.why).toMatch(/More money came in/)
    expect(g?.steps[0].title).toBe('Check whether the deposit also covers 17 Oct')
    expect(g?.steps[2].details?.at(-1)).toEqual({ label: 'Difference', value: '+$19.33' })
  })

  it('guides money that has not arrived', () => {
    const g = buildGuide({ type: 'missing_settlement', day: '2026-10-30', channel: 'nets_qr', expectedCents: 15000, actualCents: 0, message: 'x' }, ctx)
    expect(g?.steps[0].title).toBe('Check your bank from 31 Oct to 2 Nov')
    expect(g?.steps[0].text).toContain('$150.00')
    expect(g?.steps[2].details).toContainEqual({ label: 'Expected payout', value: '$150.00' })
  })

  it('guides late money, linking to that month’s payouts', () => {
    const g = buildGuide({ type: 'settlement_delay', day: '2026-10-29', channel: 'nets_qr', expectedCents: null, actualCents: null, message: 'late' }, ctx)
    expect(g?.why).toMatch(/public holiday/)
    expect(g?.steps[1].link).toEqual({ href: '/settlements?month=2026-10', label: 'See your October payouts' })
    expect(g?.steps[2].details).toEqual([{ label: 'Merchant ID (MID)', value: MID }, { label: 'Sales date', value: '29 Oct 2026, NETS QR' }])
  })

  it('guides fees that look wrong, by the bill month', () => {
    const g = buildGuide({ type: 'fee_mismatch', day: null, channel: 'card', expectedCents: 134222, actualCents: 134582, message: 'fees' }, ctx)
    expect(g?.steps[0]).toMatchObject({ title: 'Open your October bill and find the Cards fees', link: { href: '/invoices' } })
    expect(g?.steps[2].details).toContainEqual({ label: 'Bill', value: 'October 2026, Cards' })
    expect(g?.steps[2].details).toContainEqual({ label: 'Difference', value: '+$3.60' })
    const less = buildGuide({ type: 'fee_mismatch', day: null, channel: 'card', expectedCents: 134582, actualCents: 134222, message: 'fees' }, ctx)
    expect(less?.why).toMatch(/nothing extra to pay/)
    expect(less?.steps).toHaveLength(3)
  })

  it('tells head office the franchisee marks it as sorted', () => {
    const g = buildGuide(short, { ...ctx, readOnly: true })
    expect(g?.steps.at(-1)).toEqual({ title: 'Once it is fixed, the franchisee marks it as sorted.' })
  })

  it('still works when the merchant has no MID on file', () => {
    expect(buildGuide(short, { mid: null, month: '2026-10' })?.steps[2].details?.[0]).toEqual({ label: 'Merchant ID (MID)', value: 'On your NETS agreement' })
  })

  it('has no guide for failed payments', () => {
    expect(buildGuide({ type: 'failed_payment', day: '2026-10-18', channel: 'card', expectedCents: 500, actualCents: null, message: 'x' }, ctx)).toBeNull()
  })
})
