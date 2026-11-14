/**
 * @typedef {'nets_qr' | 'nets_click' | 'enets' | 'card' | 'sgqr'} Channel
 */

/** @type {Channel[]} */
export const CHANNELS = ['nets_qr', 'nets_click', 'enets', 'card', 'sgqr']

/** @type {Record<Channel, string>} */
export const CHANNEL_LABELS = {
  nets_qr: 'NETS QR',
  nets_click: 'NETS Click',
  enets: 'eNETS (online)',
  card: 'Cards',
  sgqr: 'SGQR',
}
