/**
 * Ready-made promotions NETS can show to a merchant's customers (sample content; no real NETS terms yet).
 * Each runs for 4 weeks. `days` are days of the week (0 = Sunday … 6 = Saturday, like Date#getDay);
 * `hours` (optional) is a Singapore-time window [startHour, endHour), end exclusive, so [11, 14] is 11:00–13:59.
 * `liftPct` is the sales lift the demo data gives past promotions on their days (and hours).
 *
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {'F&B' | 'Retail'} Category
 * @typedef {{ key: string, channel: Channel, name: string, when: string, days: number[], hours?: [number, number],
 *   categories: Category[], liftPct: number }} Promotion
 */

const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]

/** @type {Promotion[]} */
export const PROMOTIONS = [
  { key: 'qr_tuesday', channel: 'nets_qr', name: '10% off on Tuesdays', when: 'Every Tuesday', days: [2], categories: ['F&B', 'Retail'], liftPct: 12 },
  {
    key: 'qr_lunch', channel: 'nets_qr', name: 'Lunch deal: $1 off orders over $8', when: '11am to 2pm on weekdays',
    days: [1, 2, 3, 4, 5], hours: [11, 14], categories: ['F&B'], liftPct: 9,
  },
  { key: 'card_weekend', channel: 'card', name: '10% off weekends with Cards', when: 'Saturdays and Sundays', days: [0, 6], categories: ['F&B', 'Retail'], liftPct: 14 },
  { key: 'click_online', channel: 'nets_click', name: '$2 off online orders over $20', when: 'Every day, online store', days: EVERY_DAY, categories: ['Retail'], liftPct: 6 },
  { key: 'sgqr_drink', channel: 'sgqr', name: 'Free drink with orders over $10', when: 'Every day', days: EVERY_DAY, categories: ['F&B'], liftPct: 8 },
  { key: 'enets_delivery', channel: 'enets', name: 'Free delivery over $30 with eNETS', when: 'Every day, online store', days: EVERY_DAY, categories: ['Retail'], liftPct: 7 },
]

/**
 * @param {string} key
 * @returns {Promotion | undefined}
 */
export function promotionByKey(key) {
  return PROMOTIONS.find((p) => p.key === key)
}

/** Payment types that only online outlets take (NETS Click, eNETS). */
export const ONLINE_CHANNELS = new Set(['nets_click', 'enets'])
/** Payment types that only physical outlets take (NETS QR, SGQR). Cards work at any outlet. */
export const COUNTER_CHANNELS = new Set(['nets_qr', 'sgqr'])

/**
 * Whether an outlet can take payments of this type (the payment type ↔ outlet rule):
 * NETS Click and eNETS only online, NETS QR and SGQR only at a physical outlet, Cards anywhere.
 * @param {Channel} channel
 * @param {{ online?: boolean }} outlet
 * @returns {boolean}
 */
export function outletSuits(channel, outlet) {
  if (ONLINE_CHANNELS.has(channel)) return Boolean(outlet.online)
  if (COUNTER_CHANNELS.has(channel)) return !outlet.online
  return true
}
