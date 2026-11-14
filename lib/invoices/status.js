/**
 * An unpaid bill whose due date has passed is overdue, even if the database row still says 'unpaid'.
 * The one place this rule lives; every screen, the PDF, the assistant and the alerts use it.
 * @param {string} status as stored: 'unpaid' | 'paid' | 'overdue'
 * @param {string | null | undefined} dueDate YYYY-MM-DD
 * @param {string} today YYYY-MM-DD (Singapore)
 * @returns {'unpaid' | 'paid' | 'overdue'}
 */
export function effectiveInvoiceStatus(status, dueDate, today) {
  if (status === 'paid') return 'paid'
  if (status === 'overdue') return 'overdue'
  return dueDate && dueDate < today ? 'overdue' : 'unpaid'
}
