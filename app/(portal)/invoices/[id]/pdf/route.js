import { getCurrentMerchant } from '@/lib/data/merchant'
import { getInvoiceWithLines } from '@/lib/data/invoices'
import { renderInvoicePdf } from '@/lib/export/pdf'
import { invoiceFilename } from '@/lib/invoices/model'

export const runtime = 'nodejs'

export async function GET(_request, { params }) {
  // The merchant comes only from the session (redirects to /login without one).
  const merchant = await getCurrentMerchant()
  const { id } = await params
  const inv = await getInvoiceWithLines(merchant.id, id)
  if (!inv) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'private, no-store' } })
  const pdf = await renderInvoicePdf(inv)
  return new Response(pdf, {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${invoiceFilename(inv.period)}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
