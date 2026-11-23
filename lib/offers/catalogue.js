/**
 * Offers from NETS and its partners for the merchant's business (sample content: NETS has not set real terms
 * yet, and no real partner names are used). `months` is how long an offer stays active once taken up.
 *
 * @typedef {'F&B' | 'Retail'} Category
 * @typedef {{ key: string, kind: 'fees' | 'equipment' | 'partner', name: string, detail: string, months: number,
 *   categories: Category[] }} Offer
 */

/** @type {Offer[]} */
export const OFFERS = [
  {
    key: 'qr_fee_cut', kind: 'fees', name: '0.5% off NETS QR fees',
    detail: 'Pay 0.5% less on every NETS QR payment for 3 months.', months: 3, categories: ['F&B', 'Retail'],
  },
  {
    key: 'qr_standee', kind: 'equipment', name: 'Free NETS QR standee',
    detail: 'A counter stand with your NETS QR code, so customers can scan and pay faster.', months: 12, categories: ['F&B', 'Retail'],
  },
  {
    key: 'second_terminal', kind: 'equipment', name: 'Second terminal free for 2 months',
    detail: 'Add a second NETS terminal for busy hours. No rental for the first 2 months.', months: 2, categories: ['Retail'],
  },
  {
    key: 'packaging_partner', kind: 'partner', name: '8% off packaging from a NETS partner',
    detail: 'Takeaway boxes, cups and bags at 8% off from a NETS partner supplier.', months: 3, categories: ['F&B'],
  },
  {
    key: 'delivery_listing', kind: 'partner', name: 'Free listing on a NETS partner delivery app for 1 month',
    detail: 'List your menu on a NETS partner delivery app with no listing fee for 1 month.', months: 1, categories: ['F&B'],
  },
  {
    key: 'shelf_labels', kind: 'partner', name: '10% off shelf labels from a NETS partner',
    detail: 'Price and shelf labels at 10% off from a NETS partner printer.', months: 3, categories: ['Retail'],
  },
]

/**
 * @param {string} key
 * @returns {Offer | undefined}
 */
export function offerByKey(key) {
  return OFFERS.find((o) => o.key === key)
}
