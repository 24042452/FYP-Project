// Offers: status, outlet choices and wording. Pure (no database, no React). Dates are Singapore dates, 'YYYY-MM-DD'.
import { formatDay } from '../transactions/format.js'
import { OFFERS } from './catalogue.js'
import { addDays } from '../dates.js'

/**
 * @typedef {{ id: string, key: string, startsOn: string, endsOn: string, outletIds?: string[] }} Takeup
 * @typedef {{ id: string, name: string, online?: boolean }} Outlet
 * @typedef {{ role: string, readOnly?: boolean, outletId?: string | null }} Access
 */

/**
 * @param {{startsOn: string, endsOn: string}} takeup
 * @param {string} today
 * @returns {'scheduled' | 'active' | 'ended'}
 */
export function offerStatus(takeup, today) {
  if (takeup.startsOn > today) return 'scheduled'
  return today <= takeup.endsOn ? 'active' : 'ended'
}

/**
 * @param {{startsOn: string, endsOn: string}} takeup
 * @param {string} today
 * @returns {{tone: 'ok' | 'info' | 'mute', icon: 'tick' | 'clock', text: string}}
 */
export function offerPill(takeup, today) {
  const status = offerStatus(takeup, today)
  if (status === 'scheduled') return { tone: 'info', icon: 'clock', text: `Starts ${formatDay(takeup.startsOn)}` }
  if (status === 'active') return { tone: 'ok', icon: 'tick', text: `Active until ${formatDay(takeup.endsOn)}` }
  return { tone: 'mute', icon: 'tick', text: `Ended ${formatDay(takeup.endsOn)}` }
}

/**
 * One row per outlet for the Take up panel. Every outlet suits every offer; an outlet is blocked only while the
 * same offer is still active there. Outlet managers get only their own outlet.
 * @param {{ offer: {key: string}, outlets: Outlet[], takeups: Takeup[], today: string, access: Access }} p
 * @returns {{id: string, name: string, can: boolean, ticked: boolean, reason: string | null}[]}
 */
export function offerOutletChoices({ offer, outlets, takeups, today, access }) {
  const live = takeups.filter((t) => t.key === offer.key && offerStatus(t, today) !== 'ended')
  const mine = access.role === 'outlet_manager' ? outlets.filter((o) => o.id === access.outletId) : outlets
  return mine.map((o) => {
    const t = live.find((x) => (x.outletIds || []).includes(o.id))
    const reason = t ? `Already active until ${formatDay(t.endsOn)}` : null
    return { id: o.id, name: o.name, can: !t, ticked: !t, reason }
  })
}

/** "28 Feb" from 'YYYY-MM-DD'. */
const dayMonth = (date) => formatDay(date).split(' ').slice(1).join(' ')

/**
 * The answer sentence at the top of the Offers page; `text` contains "{figure}", shown in blue.
 * @param {{ active: number, first: {name: string, endsOn: string} | null }} p `first` is the active offer that ends first
 * @returns {{text: string, figure: string}}
 */
export function offerSentence({ active, first }) {
  if (active <= 0 || !first) return { text: 'No offers active. Pick one below.', figure: '' }
  if (active === 1) return { text: `You have 1 offer active: {figure} until ${dayMonth(first.endsOn)}.`, figure: first.name }
  return { text: `You have ${active} offers active. The next to end is {figure}, on ${dayMonth(first.endsOn)}.`, figure: first.name }
}

/**
 * Offers picked for a business category.
 * @param {string} category 'F&B' | 'Retail'
 */
export function offersFor(category) {
  return OFFERS.filter((o) => /** @type {string[]} */ (o.categories).includes(category))
}

/**
 * Last active day of an offer taken up today for `months` months: the day before the same date
 * `months` later (24 Nov + 3 months → 23 Feb; 30 Nov + 3 → 27 Feb, as February has no 30th).
 * @param {string} today
 * @param {number} months
 */
export function offerEndsOn(today, months) {
  const [y, m, d] = today.split('-').map(Number)
  const lastDay = new Date(Date.UTC(y, m - 1 + months + 1, 0)).getUTCDate()
  const same = new Date(Date.UTC(y, m - 1 + months, Math.min(d, lastDay))).toISOString().slice(0, 10)
  return addDays(same, -1)
}
