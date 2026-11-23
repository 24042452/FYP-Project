import { refundsResponse, withMerchant } from '@/lib/api/v1'

export const runtime = 'nodejs'

/** @param {Request} request */
export function GET(request) {
  return withMerchant(request, refundsResponse)
}
