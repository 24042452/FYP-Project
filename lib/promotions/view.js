// What the Promotions page shows, worked out from the runs (lib/data/promotions.js), the outlets and the
// catalogue. Pure (no database, no React), so the wording is unit-tested. Dates are Singapore 'YYYY-MM-DD'.
import { CHANNEL_LABELS } from '../channels.js'
import { addDays } from '../dates.js'
import { formatSGD } from '../money.js'
import { formatDay } from '../transactions/format.js'
import { PROMOTIONS, promotionByKey } from './catalogue.js'
import {
  canTakeUp,
  compareResults,
  datesFor,
  outletChoices,
  pageSentence,
  runPill,
  runStatus,
  startable,
  viewOnlyNote,
  weekOf,
} from './rules.js'

/**
 * @typedef {import('./rules.js').Run} Run
 * @typedef {import('./rules.js').Outlet} Outlet
 * @typedef {import('./rules.js').Access} Access
 * @typedef {import('./catalogue.js').Promotion} Promotion
 * @typedef {{day: string, cents: number}[]} DaySales
 * @typedef {{channel: string, outletIds: string[], from: string, to: string, days: number[], hours: [number, number] | null}} SalesQuery
 */

/** Promotions run 4 weeks; the bar shows how far into those 28 days a run is. */
const RUN_DAYS = 28
/** Order of the payment-type filter chips (only types with promotions show). */
export const CHIP_ORDER = /** @type {const} */ (['nets_qr', 'card', 'nets_click', 'sgqr', 'enets'])

/** "NETS QR", "Cards", "eNETS" (without "(online)"). @param {string} channel */
const channelName = (channel) => (CHANNEL_LABELS[/** @type {keyof typeof CHANNEL_LABELS} */ (channel)] ?? channel).replace(' (online)', '')

/** The short name the answer sentence uses for a promotion ("Your last one, weekend Cards, ..."). */
const SHORT_NAMES = {
  qr_tuesday: 'Tuesday NETS QR',
  qr_lunch: 'lunch NETS QR',
  card_weekend: 'weekend Cards',
  click_online: 'online NETS Click',
  sgqr_drink: 'free drink SGQR',
  enets_delivery: 'free delivery eNETS',
}

/** Whole days from a to b (both 'YYYY-MM-DD'). */
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)

/** Weekday names by day number (0 = Sunday), from the calendar rather than typed out. */
const WEEKDAY = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'long' }).format(new Date(Date.UTC(2026, 0, 4 + i))),
)

/** 11 -> "11am", 14 -> "2pm". @param {number} h */
const hourText = (h) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`

/** "$1,240" (whole dollars). @param {number} cents */
const dollars = (cents) => formatSGD(Math.round(cents / 100) * 100).replace(/\.00$/, '')

/**
 * The last day a run counted for its results: its end date, or the day before it was stopped (the stop day
 * itself was only partly a promotion day).
 * @param {{endsOn: string, stoppedOn?: string | null}} run
 */
export function effectiveEnd(run) {
  if (!run.stoppedOn) return run.endsOn
  const before = addDays(run.stoppedOn, -1)
  return before < run.endsOn ? before : run.endsOn
}

/**
 * "a weekend day", "a day", "a Tuesday", "a weekday, 11am to 2pm": what one promotion day is.
 * @param {{days: number[], hours?: [number, number]}} promotion
 */
export function perDayText(promotion) {
  const d = [...promotion.days].sort()
  const key = d.join(',')
  let text = 'a promotion day'
  if (d.length === 7) text = 'a day'
  else if (key === '0,6') text = 'a weekend day'
  else if (key === '1,2,3,4,5') text = 'a weekday'
  else if (d.length === 1) text = `a ${WEEKDAY[d[0]]}`
  return promotion.hours ? `${text}, ${hourText(promotion.hours[0])} to ${hourText(promotion.hours[1])}` : text
}

/** A window that starts at 11am or later and ends by 3pm is lunchtime. @param {[number, number]} h */
const isLunch = (h) => h[0] >= 11 && h[1] <= 15

/**
 * "on Tuesdays", "on weekends", "on weekday lunchtimes", "every day": when a promotion's days (and hours) are,
 * in words, worked out from the catalogue's days and hours.
 * @param {{days: number[], hours?: [number, number]}} promotion
 */
export function daysWords(promotion) {
  const d = [...promotion.days].sort()
  const key = d.join(',')
  const h = promotion.hours
  const lunch = h && isLunch(h)
  let text
  if (d.length === 7) text = lunch ? 'every day at lunchtime' : 'every day'
  else if (key === '0,6') text = lunch ? 'on weekend lunchtimes' : 'on weekends'
  else if (key === '1,2,3,4,5') text = lunch ? 'on weekday lunchtimes' : 'on weekdays'
  else if (d.length === 1) text = lunch ? `on ${WEEKDAY[d[0]]} lunchtimes` : `on ${WEEKDAY[d[0]]}s`
  else text = lunch ? 'at lunchtime on its days' : 'on its days'
  return h && !lunch ? `${text}, ${hourText(h[0])} to ${hourText(h[1])}` : text
}

/**
 * Only runs that include this outlet (when an outlet is picked, or for an outlet manager).
 * @param {Run[]} runs
 * @param {string | null} outletId
 */
const atOutlet = (runs, outletId) => (outletId ? runs.filter((r) => (r.outletIds || []).includes(outletId)) : runs)

/**
 * The sales the page needs for each finished run: its promotion days (and hours) from its start to its
 * effective end, and the same weekdays in the 28 days before it started, at its outlets (or just the one
 * outlet in scope) and for its payment type. `ranDays` = calendar days it ran.
 * @param {Run[]} runs
 * @param {string} today
 * @param {string | null} outletId the outlet in scope (picked outlet, or the outlet manager's), or null
 * @returns {{runId: string, ranDays: number, promo: SalesQuery, base: SalesQuery}[]}
 */
export function resultsPlan(runs, today, outletId) {
  return atOutlet(runs, outletId)
    .filter((r) => runStatus(r, today) === 'finished' && promotionByKey(r.key))
    .map((r) => {
      const p = /** @type {Promotion} */ (promotionByKey(r.key))
      const end = effectiveEnd(r)
      const common = { channel: r.channel, outletIds: outletId ? [outletId] : [...(r.outletIds || [])], days: [...p.days], hours: p.hours ?? null }
      return {
        runId: r.id,
        ranDays: Math.max(0, daysBetween(r.startsOn, end) + 1),
        promo: { ...common, from: r.startsOn, to: end },
        base: { ...common, from: addDays(r.startsOn, -RUN_DAYS), to: addDays(r.startsOn, -1) },
      }
    })
}

/**
 * Where a running promotion runs (or an offer is active). An outlet manager never sees other outlets' names.
 * @param {{outletIds?: string[], outletNames?: string[]}} run
 * @param {Outlet[]} outlets
 * @param {Access} access
 */
export function outletsText(run, outlets, access) {
  if (access.role !== 'outlet_manager') return (run.outletNames || []).join(', ')
  const own = outlets.find((o) => o.id === access.outletId)?.name ?? 'This outlet'
  const others = (run.outletIds || []).filter((id) => id !== access.outletId).length
  if (others === 0) return own
  return `This outlet and ${others} ${others === 1 ? 'other' : 'others'}`
}

/**
 * Everything the Promotions page shows.
 * @param {{
 *   category: string, runs: Run[], outlets: Outlet[], today: string, access: Access, outletId: string | null,
 *   sales: Record<string, {promoDays: DaySales, baseDays: DaySales}>,
 * }} input `runs` = every run this person may see (for an outlet manager, those at their outlet); `outletId` = the
 *   outlet picked in the "Showing" menu (owners), or null. `sales` = results of resultsPlan, by run id.
 */
export function buildPromotionsPage({ category, runs, outlets, sales, today, access, outletId }) {
  const scope = outletId ?? access.outletId ?? null
  const canAct = canTakeUp(access)
  const shown = atOutlet(runs, scope).filter((r) => promotionByKey(r.key))

  // Running now: scheduled and running, the soonest started first.
  const live = shown.filter((r) => runStatus(r, today) !== 'finished').sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const running = live.map((r) => {
    const p = /** @type {Promotion} */ (promotionByKey(r.key))
    const scheduled = runStatus(r, today) === 'scheduled'
    const shared = access.role === 'outlet_manager' && (r.outletIds || []).length > 1
    return {
      id: r.id,
      channel: channelName(r.channel),
      name: p.name,
      outlets: outletsText(r, outlets, access),
      started: scheduled ? `starts ${formatDay(r.startsOn)}` : `started ${formatDay(r.startsOn)}`,
      pill: runPill(r, today),
      scheduled,
      progress: scheduled ? 0 : Math.min(100, Math.round(((daysBetween(r.startsOn, today) + 1) / RUN_DAYS) * 100)),
      progressText: scheduled ? 'Runs 4 weeks · results when it ends' : `Week ${weekOf(r, today)} of 4 · results when it ends`,
      canStop: canAct && !shared,
      stopNote: canAct && shared ? 'It runs at other outlets too, so the owner stops it.' : null,
    }
  })

  // Results: finished runs, the latest to end first.
  const results = resultsPlan(shown, today, scope)
    .map((plan) => {
      const r = /** @type {Run} */ (shown.find((x) => x.id === plan.runId))
      const p = /** @type {Promotion} */ (promotionByKey(r.key))
      const s = sales[r.id] ?? { promoDays: [], baseDays: [] }
      const cmp = compareResults({ promoDays: s.promoDays, baseDays: s.baseDays, ranDays: plan.ranDays })
      return {
        end: plan.promo.to,
        key: r.key,
        changePct: cmp.changePct,
        row: {
          id: r.id,
          name: p.name,
          sub: `${channelName(r.channel)} · ${formatDay(r.startsOn)} to ${formatDay(plan.promo.to)}`,
          sales: s.promoDays.length ? `${dollars(cmp.avgCents)} ${perDayText(p)}` : '',
          before: s.promoDays.length && cmp.baseAvgCents > 0 ? `${dollars(cmp.baseAvgCents)} ${perDayText(p)} before` : '',
          label: cmp.label,
          tone: cmp.tone,
        },
      }
    })
    .sort((a, b) => b.end.localeCompare(a.end))

  // The answer sentence names what the last result measured: its payment type's sales on its days (and hours).
  const lastP = results[0] ? promotionByKey(results[0].key) : undefined
  const last = results[0] && lastP
    ? {
        shortName: SHORT_NAMES[/** @type {keyof typeof SHORT_NAMES} */ (results[0].key)] ?? lastP.name,
        changePct: results[0].changePct,
        measured: `in ${channelName(lastP.channel)} sales ${daysWords(lastP)}`,
      }
    : null
  const scheduledRuns = live.filter((r) => runStatus(r, today) === 'scheduled')
  const starts = [...new Set(scheduledRuns.map((r) => r.startsOn))]
  const startsWhen = starts.length !== 1 ? 'soon' : starts[0] === addDays(today, 1) ? 'tomorrow' : `on ${formatDay(starts[0])}`
  const s = pageSentence({ running: live.length - scheduledRuns.length, scheduled: scheduledRuns.length, startsWhen, last })
  const [before, after = ''] = s.text.split('{figure}')

  // Promotions you can start: the catalogue for this kind of business. Choices cover every outlet this person
  // may act on, whatever outlet the page is showing, so busy outlets are always greyed out.
  const picker = access.role !== 'outlet_manager' && outlets.length > 1
  const { startsOn, endsOn } = datesFor(today)
  const cards = PROMOTIONS.filter((p) => p.categories.includes(/** @type {any} */ (category))).map((p) => {
    const promotion = { key: p.key, channel: p.channel }
    const st = startable({ promotion, outlets, runs, today, access })
    const name = channelName(p.channel)
    return {
      key: p.key,
      channel: p.channel,
      channelLabel: name,
      name: p.name,
      when: `${p.when} · 4 weeks`,
      can: st.can,
      note: st.note,
      dates: `${p.when} · 4 weeks, from tomorrow (${formatDay(startsOn)}) to ${formatDay(endsOn)}`,
      info: `NETS shows this deal to your customers when they pay by ${name} at ${picker ? 'the outlets you pick' : 'your outlet'}. The discount comes off the price they pay; you see the results when it ends.`,
      choices: picker ? outletChoices({ promotion, outlets, runs, today, access }) : [],
    }
  })
  const chips = [
    { value: 'all', label: 'All' },
    ...CHIP_ORDER.filter((ch) => cards.some((c) => c.channel === ch)).map((ch) => ({ value: ch, label: channelName(ch) })),
  ]

  return {
    sentence: { before, figure: s.figure, after },
    sub: 'Take up a promotion and NETS shows it to your customers when they pay. Each one runs for 4 weeks.',
    note: viewOnlyNote(access),
    canAct,
    picker,
    running,
    chips,
    cards,
    results: results.map((x) => x.row),
  }
}
