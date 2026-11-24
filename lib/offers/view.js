// What the Offers page shows, worked out from the take-ups (lib/data/offers.js), the outlets and the catalogue.
// Pure (no database, no React), so the wording is unit-tested. Dates are Singapore 'YYYY-MM-DD'.
import { formatDay } from '../transactions/format.js'
import { canTakeUp, viewOnlyNote } from '../promotions/rules.js'
import { outletsText } from '../promotions/view.js'
import { IN_STORE_ONLY, offerByKey, offerSuits } from './catalogue.js'
import { offerDay, offerEndsOn, offerOutletChoices, offerPill, offerSentence, offerStatus, offersFor } from './rules.js'

/**
 * @typedef {import('./rules.js').Takeup & {outletNames?: string[]}} Takeup
 * @typedef {import('./rules.js').Outlet} Outlet
 * @typedef {import('./rules.js').Access & {tier?: string}} Access
 */

/** Filter chips and card tags, in this order (only kinds with offers show). */
export const KIND_LABELS = /** @type {const} */ ({ fees: 'Lower fees', equipment: 'Equipment', partner: 'Partner deals' })

export const SAMPLE_NOTE = 'Sample offer: NETS has not set real terms yet.'

/** "1 month", "3 months". @param {number} n */
const monthsText = (n) => `${n} ${n === 1 ? 'month' : 'months'}`

/**
 * Label of the panel's main button. Pass null when the outlet picker is hidden (one outlet, or an outlet manager).
 * @param {number | null | undefined} n number of ticked outlets
 */
export function takeUpLabel(n) {
  if (n === null || n === undefined) return 'Take up offer'
  return n === 1 ? 'Take up at 1 outlet' : `Take up at ${n} outlets`
}

/**
 * Take-ups of the same offer with the same dates (taken up the same day, outlet by outlet) as one, with all
 * their outlets (by name). The first take-up's id is kept.
 * @param {Takeup[]} takeups
 * @returns {Takeup[]}
 */
function mergeSameDates(takeups) {
  /** @type {Map<string, Takeup>} */
  const byKey = new Map()
  for (const t of takeups) {
    const k = `${t.key}|${t.startsOn}|${t.endsOn}`
    const seen = byKey.get(k)
    if (!seen) {
      byKey.set(k, { ...t, outletIds: [...(t.outletIds || [])], outletNames: [...(t.outletNames || [])] })
      continue
    }
    const pairs = [...(seen.outletIds || []).map((id, i) => [id, seen.outletNames?.[i] ?? '']), ...(t.outletIds || []).map((id, i) => [id, t.outletNames?.[i] ?? ''])]
    const unique = [...new Map(pairs.map(([id, name]) => [id, name])).entries()].sort((a, b) => a[1].localeCompare(b[1]))
    seen.outletIds = unique.map(([id]) => id)
    seen.outletNames = unique.map(([, name]) => name)
  }
  return [...byKey.values()]
}

/**
 * Everything the Offers page shows.
 * @param {{category: string, takeups: Takeup[], outlets: Outlet[], today: string, access: Access, outletId: string | null}} input
 *   `takeups` = every take-up this person may see (for an outlet manager, those at their outlet); `outletId` = the
 *   outlet picked in the "Showing" menu (owners), or null.
 */
export function buildOffersPage({ category, takeups, outlets, today, access, outletId }) {
  const scope = outletId ?? access.outletId ?? null
  const canAct = canTakeUp(access)
  const known = takeups.filter((t) => offerByKey(t.key))
  const shown = scope ? known.filter((t) => (t.outletIds || []).includes(scope)) : known

  // Your offers: active and not yet started, the soonest to end first.
  const live = mergeSameDates(shown.filter((t) => offerStatus(t, today) !== 'ended')).sort((a, b) => a.endsOn.localeCompare(b.endsOn))
  const yours = live.map((t) => {
    const o = /** @type {import('./catalogue.js').Offer} */ (offerByKey(t.key))
    return {
      id: t.id,
      kindLabel: KIND_LABELS[o.kind],
      name: o.name,
      outlets: outletsText(t, outlets, access),
      taken: `Taken up ${formatDay(t.startsOn)}`,
      pill: offerPill(t, today),
    }
  })

  // The answer sentence counts offers (not take-ups) that are active today, and names the one that ends first.
  const active = live.filter((t) => offerStatus(t, today) === 'active')
  const first = active[0] ? { name: /** @type {any} */ (offerByKey(active[0].key)).name, endsOn: active[0].endsOn } : null
  const s = offerSentence({ active: new Set(active.map((t) => t.key)).size, first, today })
  const [before, after = ''] = s.text.split('{figure}')

  // Offers for you. Outlet choices cover every outlet this person may act on, whatever outlet the page shows.
  const mine = access.role === 'outlet_manager' ? outlets.filter((o) => o.id === access.outletId) : outlets
  const picker = access.role !== 'outlet_manager' && outlets.length > 1
  const cards = offersFor(category).map((o) => {
    const choices = offerOutletChoices({ offer: o, outlets, takeups: known, today, access })
    // Only outlets that suit the offer count (an in-store offer leaves the online store out).
    const suitable = mine.filter((m) => offerSuits(o, m))
    const fits = choices.filter((c) => c.reason !== IN_STORE_ONLY)
    const busy = fits.filter((c) => !c.can)
    const everywhere = fits.length > 0 && busy.length === fits.length
    const unsuited = suitable.length === 0
    const some = suitable.length < mine.length ? 'in-store outlets' : 'outlets'
    let activeNote = null
    if (everywhere) {
      const ends = known
        .filter((t) => t.key === o.key && offerStatus(t, today) !== 'ended' && (t.outletIds || []).some((id) => suitable.some((m) => m.id === id)))
        .map((t) => t.endsOn)
        .sort()
      activeNote = `Active at ${mine.length === 1 ? 'your outlet' : `all your ${some}`} until ${offerDay(ends[0], today)}`
    }
    return {
      key: o.key,
      kind: o.kind,
      kindLabel: KIND_LABELS[o.kind],
      name: o.name,
      detail: o.detail,
      length: monthsText(o.months),
      sample: true,
      can: canAct && !everywhere && !unsuited,
      activeNote,
      note: unsuited ? IN_STORE_ONLY : !everywhere && busy.length > 0 ? `Active at ${busy.length} of your ${fits.length} ${some}` : null,
      dates: `${monthsText(o.months)}, from today to ${offerDay(offerEndsOn(today, o.months), today)}`,
      sampleNote: SAMPLE_NOTE,
      choices: picker ? choices : [],
    }
  })
  const chips = [
    { value: 'all', label: 'All' },
    ...Object.entries(KIND_LABELS)
      .filter(([kind]) => cards.some((c) => c.kind === kind))
      .map(([value, label]) => ({ value, label })),
  ]

  return {
    sentence: { before, figure: s.figure, after },
    note: viewOnlyNote(access, 'take up offers'),
    canAct,
    picker,
    yours,
    chips,
    cards,
  }
}
