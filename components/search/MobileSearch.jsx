'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { liveMessage, rowHref, searchHref, shouldSearch } from '@/lib/search/nav'
import { SearchResults } from './SearchResults'
import { useTxnSearch } from './useTxnSearch'

/**
 * Phones: the search icon opens a full-screen search sheet with live results.
 * The Back button closes it (it adds one history entry while open); picking a result replaces that
 * entry, so Back afterwards does not land on a closed sheet.
 * @param {{outletId: string | null, showOutlet?: boolean, triggerClassName: string}} props
 */
export function MobileSearch({ outletId, showOutlet = true, triggerClassName }) {
  const router = useRouter()
  const id = useId()
  const input = useRef(/** @type {HTMLInputElement | null} */ (null))
  const pushed = useRef(false)
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const { state, rows } = useTxnSearch(open ? text : '', outletId)

  function openSheet() {
    setText('')
    window.history.pushState({ ...window.history.state, searchSheet: true }, '', window.location.href)
    pushed.current = true
    setOpen(true)
  }

  /** Close by Cancel, Escape or tapping outside: also take back the history entry we added. */
  function closeSheet() {
    setOpen(false)
    if (pushed.current) {
      pushed.current = false
      window.history.back()
    }
  }

  useEffect(() => {
    if (!open) return
    const onPop = () => {
      pushed.current = false
      setOpen(false)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [open])

  /** @param {string} href */
  function go(href) {
    setOpen(false)
    pushed.current = false
    router.replace(href)
  }

  return (
    <>
    <Sheet
      open={open}
      onOpenChange={(o) => {
        if (o) openSheet()
        else closeSheet()
      }}
    >
      <SheetTrigger asChild>
        <button type="button" aria-label="Search payments" className={triggerClassName}>
          <Search className="size-5" aria-hidden="true" />
        </button>
      </SheetTrigger>
      <SheetContent
        side="top"
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          input.current?.focus()
        }}
        className="h-dvh gap-0 bg-white p-0 data-[side=top]:h-dvh motion-reduce:animate-none motion-reduce:transition-none motion-reduce:duration-0"
      >
        <SheetTitle className="sr-only">Search payments</SheetTitle>
        <SheetDescription className="sr-only">Type an amount like 12.50 or the start of a payment reference.</SheetDescription>

        <form
          role="search"
          action="/transactions"
          method="get"
          onSubmit={(e) => {
            e.preventDefault()
            if (text.trim()) go(searchHref(text))
          }}
          className="flex items-center gap-2 border-b border-line p-3"
        >
          <label htmlFor={`${id}-input`} className="sr-only">
            Search payments
          </label>
          <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-line-strong bg-white px-3 focus-within:border-nets-blue focus-within:ring-3 focus-within:ring-nets-blue-soft">
            <Search className="size-4 flex-none text-ink-3" aria-hidden="true" />
            <input
              ref={input}
              id={`${id}-input`}
              name="q"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              maxLength={40}
              value={text}
              placeholder="Amount like 12.50, or a reference"
              onChange={(e) => setText(e.target.value)}
              className="min-w-0 flex-1 border-0 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-3"
            />
          </div>
          <button
            type="button"
            onClick={closeSheet}
            className="inline-flex min-h-11 flex-none items-center rounded-lg px-3 text-[15px] font-semibold text-nets-blue hover:bg-page"
          >
            Cancel
          </button>
        </form>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {shouldSearch(text) ? (
            <SearchResults
              q={text}
              state={state}
              rows={rows}
              highlight={-1}
              idPrefix={id}
              large
              showOutlet={showOutlet}
              onPick={(rid) => go(rowHref(rid))}
              onSeeAll={() => go(searchHref(text))}
            />
          ) : (
            <p className="px-4 py-6 text-[15px] text-ink-2">Type an amount like 12.50, or the start of a payment reference.</p>
          )}
        </div>
      </SheetContent>
    </Sheet>
    <div role="status" aria-live="polite" className="sr-only">
      {open && shouldSearch(text) ? liveMessage(state, rows.length, text) : ''}
    </div>
    </>
  )
}
