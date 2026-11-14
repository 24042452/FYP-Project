import { addDays, addMonths, monthStart } from '../dates.js'
import { effectiveInvoiceStatus } from '../invoices/status.js'
import { callTool } from './tools.js'
import { formatDay, formatRange, monthName, parseTimePhrase } from './time-phrases.js'

/**
 * Rules mode (the MVP default, no AI, no API key): keyword intents, the same read-only tools as AI mode,
 * and plain-English templates. Every number in an answer comes from a tool result.
 *
 * @typedef {'sales_summary' | 'compare' | 'busiest' | 'channel_mix' | 'failed_payment' | 'settlement_status' | 'invoice' | 'help'} Intent
 * @typedef {{title: string, href: string}} Source
 * @typedef {{text: string, source?: Source, suggestions: string[]}} Answer
 */

/** The four suggestion chips. Each is guaranteed to match its intent (see the unit tests). */
export const SUGGESTIONS = [
  'How much did I take last week?',
  'Which day is my busiest?',
  'Why did a payment fail today?',
  'When will I get paid?',
]

const REFUSAL = "I can only show your own business's figures."
const REQUESTS = { title: 'Send NETS a request', href: '/requests' }

// Changing things (the assistant is read-only).
const ACTION = /\b(change|update|edit|add|remove|close|cancel|reset|delete|switch|set up|order)\b.*\b(bank|account|terminal|address|password|email|rate|fees?|details|name|phone)\b/
// Help-centre topics (how NETS works), which beat the data intents.
const HELP_TOPIC = /\b(mdr|gst|merchant discount|fees?|accountant|export|contact|help ?centre|rate|rates)\b/

/** Keyword rules, strongest intents first. @type {[Intent, RegExp][]} */
const RULES = [
  ['failed_payment', /\b(fail|failed|fails|failing|declin\w*|rejected|unsuccessful)\b|didn'?t go through|did not go through|not go through/],
  ['settlement_status', /paid out|pay ?outs?|\bbank\b|settle\w*|when will i get|when (do|will) i (get|receive)|get paid|my money|money (come|comes|arrive|arrives)|\blate\b/],
  ['invoice', /\b(bill|bills|invoice|invoices|charges|statement)\b/],
  ['compare', /\bvs\.?\b|versus|compar\w*|than last|explain my sales|better than|worse than|more than|less than/],
  ['busiest', /busiest|\bpeak\b|popular|\brush\b|quietest|slowest|best (day|time|hour)|(make|made|take|took|earn|earned) the most/],
  ['channel_mix', /payment (type|types|method|methods|mix)|\bchannels?\b|how (do|did) (my )?(customers|people) pay|\bnets qr\b|\bcards?\b|\bsplit\b|\bmix\b/],
  ['sales_summary', /\b(take|took|taken|made|make|sales|revenue|earn\w*|takings|income|sold|turnover)\b/],
]

/**
 * @param {string} text
 * @returns {{intent: Intent, confidence: number}}
 */
export function matchIntent(text) {
  const t = String(text ?? '').toLowerCase()
  if (ACTION.test(t) || HELP_TOPIC.test(t)) return { intent: 'help', confidence: 0.9 }
  for (const [intent, re] of RULES) {
    if (re.test(t)) return { intent, confidence: 0.9 }
  }
  if (/\bhow much\b/.test(t)) return { intent: 'sales_summary', confidence: 0.6 }
  return { intent: 'help', confidence: 0.2 }
}

/** Intent of each chip, so a follow-up list can leave out the one just asked. @type {Intent[]} */
const CHIP_INTENTS = ['sales_summary', 'busiest', 'failed_payment', 'settlement_status']

/**
 * @param {Intent} intent
 * @returns {string[]}
 */
function followUps(intent) {
  const rest = SUGGESTIONS.filter((_, i) => CHIP_INTENTS[i] !== intent)
  return rest.length === SUGGESTIONS.length ? SUGGESTIONS : rest
}

/** @param {string} s */
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
/** @param {number} n @param {string} one @param {string} many */
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

/**
 * Names of other merchants and "everyone else" wording. The real guarantee that nobody sees another
 * merchant's data is that the tools have no merchant input; this just gives a polite answer.
 * @param {string} text
 * @param {string | undefined} ownName
 */
function asksAboutOthers(text, ownName) {
  const t = text.toLowerCase()
  if (/\bother (merchants?|businesses|shops|stalls|stores|customers)\b|\banother (merchant|business|shop|stall|store)\b|someone else'?s|\bcompetitors?\b/.test(t)) return true
  const own = (ownName ?? '').toLowerCase()
  const names = [/tan\s*(&|and)\s*sons/, /ah\s*hock/]
  return names.some((re) => re.test(t) && !re.test(own))
}

/**
 * Answer a question with rules and the read-only tools.
 * @param {string} text
 * @param {{merchantId: string, today: string, tools: import('./tools.js').AssistantTool[], tradingName?: string}} ctx
 * @returns {Promise<Answer>}
 */
export async function answerWithRules(text, ctx) {
  const q = String(text ?? '').trim()
  if (asksAboutOthers(q, ctx.tradingName)) return { text: REFUSAL, suggestions: SUGGESTIONS }

  const { intent, confidence } = matchIntent(q)
  const use = confidence >= 0.5 ? intent : 'help'
  const run = (/** @type {string} */ name, /** @type {any} */ input) => callTool(ctx.tools, name, input)
  const phrase = parseTimePhrase(q, ctx.today)
  /** @param {string} label @param {string} from @param {string} to */
  const when = (label, from, to) => `${cap(label)} (${formatRange(from, to)})`
  const suggestions = followUps(use)

  if (use === 'sales_summary') {
    const r = phrase ?? { from: addDays(ctx.today, -6), to: ctx.today, label: 'in the last 7 days' }
    const s = await run('get_sales_summary', { from: r.from, to: r.to })
    const link = { title: 'See these payments', href: `/transactions?from=${r.from}&to=${r.to}` }
    const failed = s.failedCount > 0 ? ` ${plural(s.failedCount, 'payment', 'payments')} did not go through.` : ''
    if (s.txnCount === 0) {
      const none = s.failedCount > 0 ? 'none of your payments went through.' : 'you had no payments.'
      return { text: `${when(r.label, r.from, r.to)} ${none}${failed}`, source: link, suggestions }
    }
    return {
      text: `${when(r.label, r.from, r.to)} you made ${s.gross} from ${plural(s.txnCount, 'payment', 'payments')}.${failed}`,
      source: link,
      suggestions,
    }
  }

  if (use === 'compare') {
    const period = phrase && /month/.test(phrase.label) ? 'month' : 'week'
    const c = await run('compare_periods', { period })
    const cur = `${cap(c.label)} so far (${formatRange(c.current.from, c.current.to)})`
    const link = { title: 'See these payments', href: `/transactions?from=${c.current.from}&to=${c.current.to}` }
    const prevName = period === 'month' ? 'month' : 'week'
    if (c.current.grossCents === 0 && c.previous.grossCents === 0) {
      return { text: `${cur} there are no sales yet, and none in the same days last ${prevName} either.`, source: link, suggestions }
    }
    let tail
    if (c.previous.grossCents === 0) tail = `Last ${prevName} had no sales on the same days (${formatRange(c.previous.from, c.previous.to)}), so there is nothing to compare with.`
    else if (c.direction === 'same') tail = `That is the same as the same days last ${prevName} (${formatRange(c.previous.from, c.previous.to)}).`
    else tail = `That is ${c.delta} ${c.direction} than the same days last ${prevName} (${formatRange(c.previous.from, c.previous.to)}: ${c.previous.gross}).`
    return { text: `${cur} you made ${c.current.gross}. ${tail}`, source: link, suggestions }
  }

  if (use === 'busiest') {
    const r = phrase ?? { from: addDays(ctx.today, -27), to: ctx.today, label: 'in the last 4 weeks' }
    const b = await run('get_busiest_times', { from: r.from, to: r.to })
    const range = when(r.label, r.from, r.to)
    if (!b.busiestSlot || !b.busiestDay) {
      return { text: `${range} there were no sales, so I can't tell which time is busiest.`, suggestions }
    }
    return {
      text: `Your busiest time is ${b.busiestSlot}. Your busiest day is ${b.busiestDay}. (${formatRange(r.from, r.to)})`,
      source: { title: 'See your payments', href: '/transactions' },
      suggestions,
    }
  }

  if (use === 'channel_mix') {
    const r = phrase ?? { from: addDays(ctx.today, -27), to: ctx.today, label: 'in the last 4 weeks' }
    const m = await run('get_channel_mix', { from: r.from, to: r.to })
    const range = when(r.label, r.from, r.to)
    if (m.mix.length === 0) return { text: `${range} there were no sales, so there is no split by payment type.`, suggestions }
    const list = m.mix.map((x) => `${x.label} ${x.sharePercent}%`).join(', ')
    return { text: `${range} your sales by payment type: ${list}.`, source: { title: 'See your payments', href: '/transactions' }, suggestions }
  }

  if (use === 'failed_payment') {
    const link = { title: 'See your payments', href: '/transactions?status=failed' }
    const idMatch = q.match(/\b((?=[0-9a-f]*\d)[0-9a-f]{8})\b/i)
    if (idMatch) {
      const e = await run('explain_failed_payment', { transaction_id: idMatch[1] })
      if (e.found) return { text: failedText(e, `${e.time} on ${formatDay(e.date)}`), source: { title: 'Open this payment', href: `/transactions?q=${e.shortId}` }, suggestions }
      return { text: "I can't find a payment with that ID in your business.", source: link, suggestions }
    }
    const day = phrase && phrase.from === phrase.to ? phrase.from : ctx.today
    const dayWord = day === ctx.today ? 'today' : `on ${formatDay(day)}`
    let f = await run('find_transactions', { date: day, status: 'failed' })
    let lead = ''
    if (f.count === 0) {
      f = await run('find_transactions', { status: 'failed' })
      if (f.count === 0) return { text: "I can't see any failed payments in your records.", source: link, suggestions }
      lead = `No payments failed ${dayWord}. Your most recent failed payment: `
    } else if (f.count > 1) {
      lead = `${plural(f.count, 'payment', 'payments')} failed ${dayWord}. The latest one: `
    }
    const t = f.transactions[0]
    return { text: lead + failedText(t, `${t.time} on ${formatDay(t.date)}`, lead === ''), source: { title: 'Open this payment', href: `/transactions?q=${t.shortId}` }, suggestions }
  }

  if (use === 'settlement_status') {
    const s = await run('get_settlement_status', {})
    const link = { title: 'See money to my bank', href: '/settlements' }
    const parts = []
    if (s.lateCount > 0) {
      parts.push(`${s.late} from ${plural(s.lateCount, 'day', 'days')} is late. It was due in your bank and has not arrived yet.`)
      if (s.onTheWayCents > 0 && s.nextExpectedDate) parts.push(`Your other money, ${s.onTheWay}, is on time. The next payout is due ${formatDay(s.nextExpectedDate)}.`)
    } else if (s.onTheWayCents > 0) {
      parts.push(`You have ${s.onTheWay} on its way to your bank.${s.nextExpectedDate ? ` The next payout is due ${formatDay(s.nextExpectedDate)}.` : ''}`)
    } else {
      parts.push('Nothing is on its way right now, and nothing is late.')
    }
    const paid = s.payouts.find((/** @type {any} */ p) => p.status === 'paid')
    if (s.lateCount === 0 && s.onTheWayCents === 0 && paid) parts.push(`Your latest payout was ${paid.net}, paid on ${formatDay(paid.paidDate ?? paid.businessDate)}.`)
    return { text: parts.join(' '), source: link, suggestions }
  }

  if (use === 'invoice') {
    const month = phrase && /^in /.test(phrase.label) ? phrase.from.slice(0, 7) : addMonths(monthStart(ctx.today), -1).slice(0, 7)
    const inv = await run('get_invoice', { month })
    const name = monthName(`${month}-01`)
    const link = { title: 'See bills & charges', href: '/invoices' }
    if (!inv.found) return { text: `I can't find a ${name} bill yet.`, source: link, suggestions }
    const lines = inv.lines.slice(0, 6).map((/** @type {any} */ l) => `${l.description} ${l.amount}`).join(', ')
    const eff = effectiveInvoiceStatus(inv.status, inv.dueDate, ctx.today)
    const status = eff === 'paid' ? 'paid' : eff === 'overdue' ? 'overdue' : 'not paid yet'
    return {
      text: `Your ${name} bill is ${inv.total} and is ${status}. It is due ${formatDay(inv.dueDate)}.${lines ? ` It includes: ${lines}.` : ''}`,
      source: link,
      suggestions,
    }
  }

  // help: the top help-centre answer, verbatim, with its source.
  if (/^\s*(hi|hello|hey|good (morning|afternoon|evening))(\s+there)?[\s!.?]*$/i.test(q)) {
    return { text: 'Hello! I can answer questions about your sales, payouts, payment problems and bills. Try one of these:', suggestions: SUGGESTIONS }
  }
  const prefix = ACTION.test(q.toLowerCase()) ? "I can't change anything in your account from here. " : ''
  const kb = await run('search_help_centre', { query: q.slice(0, 200) || 'help' })
  const top = kb.results[0]
  if (top) {
    return { text: prefix + top.content, source: { title: `Help centre: ${top.heading}`, href: top.href }, suggestions: SUGGESTIONS }
  }
  return { text: `${prefix}I can't answer that yet. Try one of these:`, source: REQUESTS, suggestions: SUGGESTIONS }
}

/**
 * Plain-English sentence for one failed payment (from find_transactions / explain_failed_payment output).
 * @param {any} t
 * @param {string} when e.g. '1:02pm on Wed 11 Nov'
 * @param {boolean} [first] true when nothing precedes it, so it starts the answer
 */
function failedText(t, when, first = true) {
  if (!t.failed && t.failed !== undefined) return t.note
  const subject = `${first ? 'The' : 'the'} ${t.amount} ${t.channel} payment at ${when}`
  const what = t.whatToDo ? ` What to do: ${t.whatToDo}` : ''
  return `${subject} did not go through. ${t.reason} The customer was not charged.${what}`
}
