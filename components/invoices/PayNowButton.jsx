'use client'
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'

const primary =
  'inline-flex min-h-11 items-center justify-center rounded-lg bg-nets-red px-4 text-[14px] font-semibold text-white hover:opacity-90'
const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-lg border border-line-strong bg-white px-4 text-[14px] font-semibold text-ink-2 hover:bg-page'

/** "Pay now" opens a mock dialog: payments are not live in the prototype. */
export function PayNowButton({ month }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={primary} aria-label={`Pay ${month} bill now`}>
          Pay now
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Payments aren&apos;t live in this prototype</DialogTitle>
          <DialogDescription>In the real portal, this is where you would pay your {month} bill.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <button type="button" className={secondary}>
              Close
            </button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
