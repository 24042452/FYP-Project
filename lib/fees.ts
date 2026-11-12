import type { Channel } from './channels'

/**
 * Merchant discount rates per channel.
 * SYNTHETIC ASSUMPTION for the prototype — not NETS' actual pricing.
 */
export const MDR_RATES: Record<Channel, number> = {
  nets_qr: 0.008,
  sgqr: 0.008,
  nets_click: 0.01,
  enets: 0.015,
  card: 0.022,
}

export function feeFor(channel: Channel, amountCents: number): number {
  return Math.round(amountCents * MDR_RATES[channel])
}

/** Monthly terminal rental per terminal, in cents (synthetic). */
export const TERMINAL_RENTAL_CENTS = 1500
