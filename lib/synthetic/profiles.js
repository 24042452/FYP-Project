/**
 * @typedef {import('../channels.js').Channel} Channel
 * @typedef {'hawker' | 'retail'} ProfileKey
 */

/**
 * @typedef {object} Profile
 * @property {{ name: string, address: string }[]} outlets
 * @property {number} terminalsPerOutlet
 * @property {number} txnsPerDay
 * @property {number} medianCents Median ticket size in cents (log-normal around it).
 * @property {number[]} dowFactor Monday..Sunday multipliers.
 * @property {[number, number][]} hourWeights [hour, weight] in Singapore time.
 * @property {[Channel, number][]} channelWeights
 * @property {number} failureRate
 */

/** @type {Record<ProfileKey, Profile>} */
export const PROFILES = {
  hawker: {
    outlets: [{ name: 'Tampines Round Market #01-23', address: '137 Tampines St 11, Singapore 521137' }],
    terminalsPerOutlet: 2,
    txnsPerDay: 90,
    medianCents: 650,
    dowFactor: [0.9, 0.85, 0.95, 1.0, 1.25, 1.2, 0.85],
    hourWeights: [
      [7, 3], [8, 4], [9, 3], [10, 3], [11, 8], [12, 14], [13, 10], [14, 3],
      [15, 2], [16, 2], [17, 5], [18, 10], [19, 9], [20, 4], [21, 1],
    ],
    channelWeights: [['nets_qr', 46], ['card', 24], ['sgqr', 14], ['nets_click', 10], ['enets', 6]],
    failureRate: 0.015,
  },
  retail: {
    outlets: [
      { name: 'Tampines Mall #02-15', address: '4 Tampines Central 5, Singapore 529510' },
      { name: 'Bedok Mall #B1-30', address: '311 New Upper Changi Rd, Singapore 467360' },
      { name: 'Online store', address: 'tansons.example.sg' },
    ],
    terminalsPerOutlet: 2,
    txnsPerDay: 140,
    medianCents: 3200,
    dowFactor: [0.8, 0.8, 0.85, 0.9, 1.1, 1.45, 1.35],
    hourWeights: [
      [10, 3], [11, 5], [12, 8], [13, 8], [14, 7], [15, 7], [16, 7],
      [17, 8], [18, 9], [19, 9], [20, 7], [21, 4],
    ],
    channelWeights: [['card', 38], ['nets_qr', 25], ['enets', 15], ['nets_click', 12], ['sgqr', 10]],
    failureRate: 0.015,
  },
}
