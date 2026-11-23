// Promotions: status, outlet choices, results maths and wording. Pure (no database, no React).
// Dates are Singapore business dates, 'YYYY-MM-DD'. Money is integer cents.
import { addDays } from '../dates.js'
import { CHANNEL_LABELS } from '../channels.js'
import { canRespond } from '../disputes/rules.js'
import { formatDay } from '../transactions/format.js'
import { promotionByKey, outletSuits } from './catalogue.js'

// One source for the payment type <-> outlet rule (the catalogue owns it; the generator imports it from there).
export { outletSuits }

/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {{ id: string, key: string, channel: Channel, startsOn: string, endsOn: string, stoppedOn: string | null,
 *   outletIds?: string[], outletNames?: string[] }} Run
 * @typedef {{ id: string, name: string, online?: boolean }} Outlet
 * @typedef {{ role: string, readOnly?: boolean, tier?: string, outletId?: string | null }} Access
 */

const MINUS = '−'
export const TOO_SHORT = 'Too short to compare'
/** A promotion needs at least this many days to be compared with the weeks before. */
export const MIN_DAYS = 7

/** "NETS QR", "Cards", "eNETS" (without the "(online)" tag, for use in sentences). @param {Channel} channel */
const channelName = (channel) => CHANNEL_LABELS[channel].replace(' (online)', '')

/** Whole days from a to b (both 'YYYY-MM-DD'). */
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000)

/**
 * A stopped run is finished at once (even if stopped today); otherwise it is scheduled until it starts,
 * running up to and including its end date, and finished after that.
 * @param {{startsOn: string, endsOn: string, stoppedOn?: string | null}} run
 * @param {string} today
 * @returns {'scheduled' | 'running' | 'finished'}
 */
export function runStatus(run, today) {
  if (run.stoppedOn) return 'finished'
  if (run.startsOn > today) return 'scheduled'
  if (today <= run.endsOn) return 'running'
  return 'finished'
}

/**
 * @param {Run} run
 * @param {string} today
 * @returns {{tone: 'info' | 'mute', icon: 'clock' | 'tick' | 'stop', text: string}}
 */
export function runPill(run, today) {
  if (run.stoppedOn) return { tone: 'mute', icon: 'stop', text: `Stopped ${formatDay(run.stoppedOn)}` }
  const status = runStatus(run, today)
  if (status === 'scheduled') {
    const text = run.startsOn === addDays(today, 1) ? 'Starts tomorrow' : `Starts ${formatDay(run.startsOn)}`
    return { tone: 'info', icon: 'clock', text }
  }
  if (status === 'running') return { tone: 'info', icon: 'clock', text: `Running · ends ${formatDay(run.endsOn)}` }
  return { tone: 'mute', icon: 'tick', text: `Ended ${formatDay(run.endsOn)}` }
}

/**
 * Which of the 4 weeks the run is in (1 to 4; 1 before it starts).
 * @param {{startsOn: string}} run
 * @param {string} today
 * @returns {1 | 2 | 3 | 4}
 */
export function weekOf(run, today) {
  const week = Math.floor(daysBetween(run.startsOn, today) / 7) + 1
  return /** @type {1 | 2 | 3 | 4} */ (Math.min(4, Math.max(1, week)))
}

/** Outlets this person may act on: an outlet manager only has their own. */
function scoped(outlets, access) {
  return access.role === 'outlet_manager' ? outlets.filter((o) => o.id === access.outletId) : outlets
}

/** Runs that occupy their payment type: scheduled or running (not finished). */
function busyRunsFor(channel, runs, today) {
  return runs.filter((r) => r.channel === channel && runStatus(r, today) !== 'finished')
}

/**
 * One row per outlet for the Take up panel.
 * @param {{ promotion: {key: string, channel: Channel}, outlets: Outlet[], runs: Run[], today: string, access: Access }} p
 * @returns {{id: string, name: string, can: boolean, ticked: boolean, reason: string | null}[]}
 */
export function outletChoices({ promotion, outlets, runs, today, access }) {
  const busyRuns = busyRunsFor(promotion.channel, runs, today)
  return scoped(outlets, access).map((o) => {
    let reason = null
    if (!outletSuits(promotion.channel, o)) {
      reason = o.online ? 'Online only' : 'Not an online outlet'
    } else {
      const run = busyRuns.find((r) => (r.outletIds || []).includes(o.id))
      if (run) {
        const name = promotionByKey(run.key)?.name ?? 'a promotion'
        reason = `Already running "${name}" (${channelName(promotion.channel)}) until ${formatDay(run.endsOn)}`
      }
    }
    return { id: o.id, name: o.name, can: reason === null, ticked: reason === null, reason }
  })
}

/**
 * Whether the Take up button shows for a promotion card, and the grey note under it.
 * @param {{ promotion: {key: string, channel: Channel}, outlets: Outlet[], runs: Run[], today: string, access: Access }} p
 * @returns {{can: boolean, note: string | null}}
 */
export function startable({ promotion, outlets, runs, today, access }) {
  const choices = outletChoices({ promotion, outlets, runs, today, access })
  const mine = scoped(outlets, access)
  const suitable = mine.filter((o) => outletSuits(promotion.channel, o))
  if (suitable.length === 0) return { can: false, note: 'Not offered for your payment types' }
  const free = choices.filter((c) => c.can)
  const name = channelName(promotion.channel)
  if (free.length === 0) {
    const ends = busyRunsFor(promotion.channel, runs, today)
      .filter((r) => (r.outletIds || []).some((id) => suitable.some((o) => o.id === id)))
      .map((r) => r.endsOn)
      .sort()
    return { can: false, note: `${name} already has a promotion running until ${formatDay(ends[0])}` }
  }
  const busy = suitable.length - free.length
  const note = busy > 0 ? `Already running a ${name} promotion at ${busy} of your ${suitable.length} outlets` : null
  return { can: canRespond(access), note }
}

/**
 * Every promotion runs 4 weeks from tomorrow.
 * @param {string} today
 * @returns {{startsOn: string, endsOn: string}}
 */
export function datesFor(today) {
  const startsOn = addDays(today, 1)
  return { startsOn, endsOn: addDays(startsOn, 27) }
}

/**
 * Label of the panel's main button. Pass null when the outlet picker is hidden (one outlet, or an outlet manager).
 * @param {number | null | undefined} n number of ticked outlets
 */
export function startLabel(n) {
  if (n === null || n === undefined) return 'Start promotion'
  return n === 1 ? 'Start at 1 outlet' : `Start at ${n} outlets`
}

/** @param {{cents: number}[]} days */
const average = (days) => (days.length ? Math.round(days.reduce((s, d) => s + d.cents, 0) / days.length) : 0)

/**
 * Average sales per promotion day against the same weekdays in the 4 weeks before.
 * @param {{ promoDays: {day: string, cents: number}[], baseDays: {day: string, cents: number}[], ranDays: number }} p
 * @returns {{avgCents: number, changePct: number | null, label: string, tone: 'ok' | 'mute' | 'bad'}}
 */
export function compareResults({ promoDays, baseDays, ranDays }) {
  const avgCents = average(promoDays)
  const baseCents = average(baseDays)
  if (ranDays < MIN_DAYS || promoDays.length === 0 || !(baseCents > 0)) {
    return { avgCents, changePct: null, label: TOO_SHORT, tone: 'mute' }
  }
  const changePct = Math.round(((avgCents - baseCents) / baseCents) * 100)
  if (Math.abs(changePct) <= 2) return { avgCents, changePct, label: 'About the same', tone: 'mute' }
  if (changePct > 0) return { avgCents, changePct, label: `+${changePct}%`, tone: 'ok' }
  return { avgCents, changePct, label: `${MINUS}${Math.abs(changePct)}%`, tone: 'bad' }
}

/**
 * The answer sentence at the top of the page. `text` contains "{figure}", which the page shows in blue.
 * @param {{ running: number, last: {shortName: string, changePct: number | null} | null }} p
 * @returns {{text: string, figure: string}}
 */
export function pageSentence({ running, last }) {
  const lead = running > 0 ? `${running} ${running === 1 ? 'promotion is' : 'promotions are'} running.` : 'No promotions running.'
  if (!last) {
    return running > 0
      ? { text: lead, figure: '' }
      : { text: `${lead} Take one up and NETS shows it to your customers when they pay.`, figure: '' }
  }
  let result
  if (last.changePct === null) result = 'ran too short to compare.'
  else if (Math.abs(last.changePct) <= 2) result = 'did about the same as before.'
  else if (last.changePct > 0) result = `brought in about ${last.changePct}% more.`
  else result = 'was lower than before.'
  return { text: `${lead} Your last one, {figure}, ${result}`, figure: last.shortName }
}

/** Taking up and stopping use the respond rule (owner or outlet manager, not read-only). */
export { canRespond as canTakeUp }

/**
 * The note for people who can look but not start promotions (or take up offers), or null if they can.
 * @param {Access} access
 * @param {string} [doing] what they cannot do: "start promotions" (default) or "take up offers"
 * @returns {string | null}
 */
export function viewOnlyNote(access, doing = 'start promotions') {
  if (canRespond(access)) return null
  const who = access.tier === 'hq' || access.role === 'hq_owner' ? 'The franchisee does that.' : 'The owner or outlet manager does that.'
  return `You can look but not ${doing}. ${who}`
}

/**
 * Which outlets an action applies to. An outlet manager always gets their own outlet (naming another is refused);
 * anyone else gets the ids asked for, de-duplicated, or the only outlet of a one-outlet business when none are
 * asked for. Every id must be one of `outlets` (the merchant's own).
 * @param {{outletId?: string | null}} access
 * @param {{id: string}[]} outlets the merchant's outlets
 * @param {string[]} asked outlet ids from the form
 * @returns {{ok: true, outletIds: string[]} | {ok: false, reason: 'bad_outlet' | 'none'}}
 */
export function pickOutlets(access, outlets, asked) {
  const ids = [...new Set(asked)]
  if (access.outletId) {
    if (ids.some((id) => id !== access.outletId)) return { ok: false, reason: 'bad_outlet' }
    return { ok: true, outletIds: [access.outletId] }
  }
  const picked = ids.length === 0 && outlets.length === 1 ? [outlets[0].id] : ids
  if (picked.length === 0) return { ok: false, reason: 'none' }
  if (picked.some((id) => !outlets.some((o) => o.id === id))) return { ok: false, reason: 'bad_outlet' }
  return { ok: true, outletIds: picked }
}
