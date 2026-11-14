/** @typedef {import('./channels.js').Channel} Channel */

/**
 * Merchant discount rates per channel.
 * SYNTHETIC ASSUMPTION for the prototype, not NETS' actual pricing.
 * @type {Record<Channel, number>}
 */
export const MDR_RATES = {
  nets_qr: 0.008,
  sgqr: 0.008,
  nets_click: 0.01,
  enets: 0.015,
  card: 0.022,
}

/**
 * Fee in cents for a payment on a channel.
 * @param {Channel} channel
 * @param {number} amountCents
 * @returns {number}
 */
export function feeFor(channel, amountCents) {
  return Math.round(amountCents * MDR_RATES[channel])
}

/** Monthly terminal rental per terminal, in cents (synthetic). */
export const TERMINAL_RENTAL_CENTS = 1500
