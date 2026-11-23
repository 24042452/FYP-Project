import { requirePage } from '@/lib/data/merchant'
import { getDisputeFile } from '@/lib/data/disputes'

export const runtime = 'nodejs'

/**
 * A file name safe inside `filename="..."`: no quotes, backslashes, line breaks or other characters a
 * header cannot carry (non-ASCII would make the Response throw).
 * @param {string} name
 */
const safeName = (name) => name.replace(/["\\]|[^\x20-\x7e]/g, '').trim() || 'evidence'

/** One evidence file of a dispute, shown in the browser. Only for its own merchant (and outlet). */
export async function GET(_request, { params }) {
  // The merchant comes only from the session (redirects to /login without one).
  const merchant = await requirePage('/disputes')
  const { id } = await params
  const file = await getDisputeFile(merchant.id, id, { outletId: merchant.outletId })
  if (!file) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  return new Response(new Uint8Array(file.data), {
    status: 200,
    headers: {
      'Content-Type': file.mime,
      'Content-Disposition': `inline; filename="${safeName(file.name)}"`,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'private, no-store',
    },
  })
}
