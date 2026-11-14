'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { moveHighlight, rowHref, searchHref, shouldSearch } from '@/lib/search/nav'
import { SearchResults } from './SearchResults'
import { useTxnSearch } from './useTxnSearch'

/**
 * The top-bar search box on tablets and desktops: a combobox with live payment suggestions.
 * A real GET form, so Enter still works before JavaScript loads.
 * @param {{outletId: string | null}} props
 */
export function DesktopSearch({ outletId }) {
  const router = useRouter()
  const pathname = usePathname()
  const id = useId()
  const box = useRef(/** @type {HTMLDivElement | null} */ (null))
  const input = useRef(/** @type {HTMLInputElement | null} */ (null))
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(-1)
  const { state, rows } = useTxnSearch(text, outletId)

  const panelOpen = open && shouldSearch(text)
  const stops = state === 'ok' ? rows.length + 1 : 0
  const active = panelOpen && highlight >= 0 && highlight < stops ? `${id}-opt-${highlight}` : undefined

  const close = useCallback(() => {
    setOpen(false)
    setHighlight(-1)
  }, [])

  // Close when the page changes, and when clicking anywhere else.
  useEffect(() => {
    close()
  }, [pathname, close])
  useEffect(() => {
    /** @param {MouseEvent} e */
    const onDown = (e) => {
      if (box.current && !box.current.contains(/** @type {Node} */ (e.target))) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [close])

  // Ctrl/Cmd+K, or "/" when not typing somewhere else, jumps to the box.
  useEffect(() => {
    /** @param {KeyboardEvent} e */
    const onKey = (e) => {
      const el = /** @type {HTMLElement | null} */ (document.activeElement)
      const typing = el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
      const k = e.key.toLowerCase()
      if (((e.ctrlKey || e.metaKey) && k === 'k') || (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey)) {
        if (!input.current || input.current.offsetParent === null) return // hidden on phones
        e.preventDefault()
        input.current.focus()
        input.current.select()
        if (shouldSearch(input.current.value)) setOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  /** @param {string} href */
  const go = (href) => {
    close()
    router.push(href)
  }

  /** @param {import('react').KeyboardEvent<HTMLInputElement>} e */
  function onKeyDown(e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!shouldSearch(text)) return
      e.preventDefault()
      if (!panelOpen) {
        setOpen(true)
        return
      }
      setHighlight((h) => moveHighlight(h, e.key === 'ArrowDown' ? 'down' : 'up', rows.length, state === 'ok'))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (panelOpen && state === 'ok' && highlight >= 0 && highlight < rows.length) go(rowHref(rows[highlight].id))
      else if (text.trim()) go(searchHref(text))
    } else if (e.key === 'Escape') {
      if (panelOpen) {
        e.preventDefault()
        close()
      } else if (text) {
        e.preventDefault()
        setText('')
      }
    } else if (e.key === 'Tab') {
      close()
    }
  }

  return (
    <div ref={box} className="relative hidden max-w-[460px] min-w-0 flex-1 md:block">
      <form
        role="search"
        action="/transactions"
        method="get"
        onSubmit={(e) => {
          e.preventDefault()
          if (text.trim()) go(searchHref(text))
        }}
        className="flex min-h-11 items-center gap-2 rounded-lg border border-line bg-white px-3 text-ink-3 focus-within:border-nets-blue focus-within:ring-3 focus-within:ring-nets-blue-soft md:min-h-[42px]"
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Search payments
        </label>
        <Search className="size-4 flex-none" aria-hidden="true" />
        <input
          ref={input}
          id={`${id}-input`}
          name="q"
          type="search"
          role="combobox"
          autoComplete="off"
          maxLength={40}
          value={text}
          placeholder="Search payments, amounts, references"
          aria-expanded={panelOpen}
          aria-controls={panelOpen && state === 'ok' ? `${id}-list` : undefined}
          aria-activedescendant={active}
          aria-autocomplete="list"
          onChange={(e) => {
            setText(e.target.value)
            setHighlight(-1)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:appearance-none"
        />
        <kbd aria-hidden="true" className="hidden rounded border border-line-strong px-1.5 text-[12px] font-medium text-ink-3 lg:inline">
          /
        </kbd>
      </form>

      {panelOpen ? (
        <div className="absolute top-full left-0 z-30 mt-2 w-full min-w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-[12px] border border-line bg-white shadow-lg">
          <SearchResults
            q={text}
            state={state}
            rows={rows}
            highlight={highlight}
            idPrefix={id}
            onPick={(rid) => go(rowHref(rid))}
            onSeeAll={() => go(searchHref(text))}
            onHover={setHighlight}
          />
        </div>
      ) : null}
    </div>
  )
}
