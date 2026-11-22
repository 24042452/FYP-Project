// "How to fix this": step-by-step help for each kind of check-up problem, filled in with that problem's own
// dates, amounts and the merchant's NETS merchant ID (MID), so the merchant can sort it out or send NETS
// everything it needs in one go. Pure: the Check-up page passes in the stored problem.
import { addDays } from '../dates.js'
import { formatSGD } from '../money.js'
import { CHANNEL_LABELS } from '../channels.js'
import { monthName, shortDay } from './reconcile.js'

/**
 * @typedef {{label: string, value: string}} Detail
 * @typedef {{title: string, text?: string, link?: {href: string, label: string}, details?: Detail[]}} Step
 * @typedef {{why: string, steps: Step[], copyText: string | null}} Guide
 * @typedef {Pick<import('../data/recon.js').StoredException, 'type' | 'day' | 'channel' | 'expectedCents' | 'actualCents' | 'message'>} Problem
 */

const MINUS = '−'

/** @param {string} day YYYY-MM-DD @returns {string} '18 Oct 2026' */
const longDay = (day) => `${shortDay(day)} ${day.slice(0, 4)}`

/** @param {string} month YYYY-MM */
const monthLabel = (month) => `${monthName(month)} ${month.slice(0, 4)}`

/** @param {number} cents */
const signed = (cents) => `${cents < 0 ? MINUS : '+'}${formatSGD(Math.abs(cents))}`

/** The day's payments for one payment type, on Sales & payments. @param {string} day @param {string} channel */
const dayLink = (day, channel) => ({
  href: `/transactions?from=${day}&to=${day}&channel=${channel}`,
  label: `See the ${shortDay(day)} ${CHANNEL_LABELS[/** @type {keyof typeof CHANNEL_LABELS} */ (channel)]} payments`,
})

/**
 * The steps for one problem, or null for a kind with no guide (failed payments are a summary, not a card).
 * @param {Problem} e
 * @param {{mid: string | null, month: string, readOnly?: boolean}} ctx month is the check-up's YYYY-MM
 * @returns {Guide | null}
 */
export function buildGuide(e, { mid, month, readOnly = false }) {
  const channel = e.channel ? CHANNEL_LABELS[e.channel] : 'All payment types'
  const midRow = { label: 'Merchant ID (MID)', value: mid ?? 'On your NETS agreement' }
  const last = readOnly
    ? { title: 'Once it is fixed, the franchisee marks it as sorted.' }
    : { title: 'When it is fixed, mark it as sorted', text: 'Add a note with what NETS said, so you remember next time.' }
  const expected = e.expectedCents ?? 0
  const actual = e.actualCents ?? 0

  /** @type {{why: string, steps: Step[]} | null} */
  let guide = null
  if (e.type === 'amount_mismatch' && e.day && e.channel) {
    const short = actual < expected
    const details = [
      midRow,
      { label: 'Sales date', value: `${longDay(e.day)}, ${channel}` },
      { label: 'We expected', value: formatSGD(expected) },
      { label: 'Arrived in your bank', value: formatSGD(actual) },
      { label: 'Difference', value: signed(actual - expected) },
    ]
    guide = short
      ? {
          why: 'Usually a refund or chargeback was taken out of the payout, or the payout came in two parts.',
          steps: [
            { title: `Look for a refund or chargeback on ${shortDay(e.day)}`, text: 'NETS takes these out of your payout, so the money looks short.', link: dayLink(e.day, e.channel) },
            { title: `Check your bank for ${shortDay(addDays(e.day, 1))} and ${shortDay(addDays(e.day, 2))}`, text: `Part of the money sometimes comes in a second deposit. Look for about ${formatSGD(expected - actual)}.` },
            { title: 'Still short? Contact NETS', text: 'Send them these details:', details },
            last,
          ],
        }
      : {
          why: 'More money came in than your sales for that day. Usually the payout also covers another day.',
          steps: [
            { title: `Check whether the deposit also covers ${shortDay(addDays(e.day, -1))}`, text: 'A late payout is sometimes paid together with the next one.' },
            { title: `Check every ${shortDay(e.day)} sale is listed`, text: 'A payment that is missing from your list would make the bank amount look too big.', link: dayLink(e.day, e.channel) },
            { title: 'Still can’t explain it? Tell NETS', text: 'They may take the extra back from a later payout. Send them these details:', details },
            last,
          ],
        }
  } else if (e.type === 'missing_settlement' && e.day && e.channel) {
    guide = {
      why: 'NETS usually pays a day’s sales into your bank within 1 to 2 working days.',
      steps: [
        { title: `Check your bank from ${shortDay(addDays(e.day, 1))} to ${shortDay(addDays(e.day, 3))}`, text: `Look for a NETS deposit of about ${formatSGD(expected)}. It may have been paid together with another day.` },
        { title: 'Check the payments went through', text: 'Payments that failed or were refunded are not paid out.', link: dayLink(e.day, e.channel) },
        {
          title: 'Still missing? Contact NETS',
          text: 'Send them these details:',
          details: [midRow, { label: 'Sales date', value: `${longDay(e.day)}, ${channel}` }, { label: 'Expected payout', value: formatSGD(expected) }],
        },
        last,
      ],
    }
  } else if (e.type === 'settlement_delay' && e.day && e.channel) {
    guide = {
      why: 'Payouts can be a day or two late after a weekend or a public holiday.',
      steps: [
        { title: 'Check for a weekend or public holiday', text: 'If there was one, the money usually arrives on the next working day.' },
        { title: 'Check your payouts again tomorrow', link: { href: `/settlements?month=${e.day.slice(0, 7)}`, label: `See your ${monthName(e.day.slice(0, 7))} payouts` } },
        {
          title: 'Still late after 2 working days? Contact NETS',
          text: 'Send them these details:',
          details: [midRow, { label: 'Sales date', value: `${longDay(e.day)}, ${channel}` }],
        },
        last,
      ],
    }
  } else if (e.type === 'fee_mismatch') {
    const more = actual > expected
    const details = [
      midRow,
      { label: 'Bill', value: `${monthLabel(month)}, ${channel}` },
      { label: 'Fees from your payments', value: formatSGD(expected) },
      { label: 'Fees on your bill', value: formatSGD(actual) },
      { label: 'Difference', value: signed(actual - expected) },
    ]
    guide = more
      ? {
          why: 'Your bill charges more fees than your payments add up to. A rate may have changed, or some payments were charged at the wrong rate.',
          steps: [
            { title: `Open your ${monthName(month)} bill and find the ${channel} fees`, link: { href: '/invoices', label: 'See your bills' } },
            { title: `Check the rate for ${channel} on your NETS agreement`, text: 'Card payments cost more than NETS QR, so a payment recorded as the wrong type changes the fee.' },
            { title: 'Still wrong? Ask NETS to check the bill', text: 'Send them these details:', details },
            last,
          ],
        }
      : {
          why: 'Your bill charges less than your payments add up to. You have nothing extra to pay, but NETS may correct it on a later bill.',
          steps: [
            { title: `Open your ${monthName(month)} bill and find the ${channel} fees`, link: { href: '/invoices', label: 'See your bills' } },
            { title: 'Watch for a correction on next month’s bill', text: 'Keep these details in case NETS asks:', details },
            last,
          ],
        }
  }
  if (!guide) return null

  const withDetails = guide.steps.find((s) => s.details)
  const copyText = withDetails?.details
    ? [`Check-up problem: ${e.message}`, ...withDetails.details.map((d) => `${d.label}: ${d.value}`)].join('\n')
    : null
  return { ...guide, copyText }
}
