/**
 * The one "is this settlement late?" rule: delayed, or pending past its expected date.
 * Pending with no expected date, or due today or later, is not late.
 * @param {'pending' | 'paid' | 'delayed'} status
 * @param {string | null} expectedDate YYYY-MM-DD
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {boolean}
 */
export function isSettlementLate(status, expectedDate, today) {
  return status === 'delayed' || (status === 'pending' && expectedDate !== null && expectedDate < today)
}
