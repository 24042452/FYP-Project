'use client'

import { useRef } from 'react'
import { XIcon } from 'lucide-react'
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ChannelTag } from './RunningCard'

/**
 * The take-up panel shell: slides in from the right (like the payment panel on Refunds & disputes) with a
 * small tag, a heading and one line under it. Clicking outside, Esc or × closes it; the slide is off with
 * reduced motion. Focus goes to its heading when it opens. Used by the Promotions and Offers pages.
 * @param {{open: boolean, onOpenChange: (open: boolean) => void, id: string, tag: string, title: string,
 *   description: string, children: React.ReactNode}} props `id` names the description for screen readers
 */
export function SidePanel({ open, onOpenChange, id, tag, title, description, children }) {
  const headingRef = useRef(/** @type {HTMLHeadingElement | null} */ (null))
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {title ? (
        <SheetContent
          side="right"
          showCloseButton={false}
          aria-describedby={`takeup-when-${id}`}
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            headingRef.current?.focus()
          }}
          className="gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-md data-[side=right]:data-open:slide-in-from-right-full data-[side=right]:data-closed:slide-out-to-right-full data-open:duration-300 data-closed:duration-300 motion-reduce:data-open:animate-none motion-reduce:data-closed:animate-none"
        >
          <SheetHeader className="gap-1 border-b border-line p-5 pr-16">
            <ChannelTag>{tag}</ChannelTag>
            <SheetTitle ref={headingRef} tabIndex={-1} className="text-[18px] leading-snug font-[650] text-ink outline-none">
              {title}
            </SheetTitle>
            <SheetDescription id={`takeup-when-${id}`} className="text-[14px] text-ink-2">
              {description}
            </SheetDescription>
          </SheetHeader>
          <SheetClose
            aria-label="Close"
            className="absolute top-3 right-3 inline-flex size-11 cursor-pointer items-center justify-center rounded-lg text-ink-2 hover:bg-nets-blue-soft hover:text-ink focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-nets-blue"
          >
            <XIcon className="size-5" aria-hidden="true" />
          </SheetClose>
          {children}
        </SheetContent>
      ) : null}
    </Sheet>
  )
}
