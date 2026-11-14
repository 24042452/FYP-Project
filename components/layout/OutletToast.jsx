'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/** Event the outlet menu sends after a successful switch; its detail is the message. */
export const OUTLET_SWITCHED = 'outlet:switched'

/**
 * A small message that says what the portal is now showing, for about 2 seconds. It sits in a polite live
 * region (so screen readers announce it) and is drawn on the page body, so the sidebar and phone menu cannot
 * clip it or take it away when they close. Mount it once, in the portal frame.
 */
export function OutletToast() {
  const [mounted, setMounted] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    setMounted(true)
    let timer = 0
    const onSwitched = (/** @type {Event} */ e) => {
      setMessage(String(/** @type {CustomEvent} */ (e).detail ?? ''))
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setMessage(''), 2200)
    }
    window.addEventListener(OUTLET_SWITCHED, onSwitched)
    return () => {
      window.removeEventListener(OUTLET_SWITCHED, onSwitched)
      window.clearTimeout(timer)
    }
  }, [])

  if (!mounted) return null
  return createPortal(
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[100] flex justify-center px-4 md:bottom-6">
      <div
        role="status"
        aria-live="polite"
        data-testid="outlet-toast"
        className={
          'rounded-full bg-ink px-4 py-2 text-[14px] font-medium text-white shadow-lg transition-opacity duration-200 motion-reduce:transition-none ' +
          (message ? 'opacity-100' : 'opacity-0')
        }
      >
        {message}
      </div>
    </div>,
    document.body,
  )
}
