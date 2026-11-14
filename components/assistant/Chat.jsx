'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * @typedef {{role: 'user' | 'assistant', content: string, source?: {title: string, href: string}, pending?: boolean, signedOut?: boolean}} ChatMessage
 */

const CHIPS = [
  'How much did I take last week?',
  'Which day is my busiest?',
  'Why did a payment fail today?',
  'When will I get paid?',
]

/**
 * What to send: the last 20 messages, never starting with an assistant turn (the API needs a user turn first).
 * @param {{role: 'user' | 'assistant', content: string}[]} history
 */
function toRequestMessages(history) {
  const recent = history.slice(-20).map(({ role, content }) => ({ role, content }))
  while (recent.length && recent[0].role === 'assistant') recent.shift()
  return recent
}

/**
 * The assistant chat. Posts to /api/assistant (the merchant comes from the session on the server).
 * Rules mode answers with JSON; AI mode streams plain text.
 * @param {{mode: 'rules' | 'ai', initialQuestion?: string}} props
 */
export function Chat({ mode, initialQuestion }) {
  const router = useRouter()
  const [messages, setMessages] = useState(/** @type {ChatMessage[]} */ ([]))
  const [chips, setChips] = useState(CHIPS)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const lastQuestion = useRef(/** @type {HTMLParagraphElement | null} */ (null))
  const history = useRef(/** @type {ChatMessage[]} */ ([]))
  const sentInitial = useRef(false)
  const started = messages.length > 0

  const send = useCallback(async (/** @type {string} */ text) => {
    const q = text.trim().slice(0, 1000)
    if (!q || busy) return
    setInput('')
    setBusy(true)
    setInfoOpen(false)
    /** @type {ChatMessage} */
    const mine = { role: 'user', content: q }
    history.current = [...history.current, mine].slice(-20)
    setMessages((m) => [...m, mine, { role: 'assistant', content: '', pending: true }])

    /** @param {Partial<ChatMessage>} patch */
    const patchLast = (patch) =>
      setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, ...patch, pending: false } : x)))

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: toRequestMessages(history.current) }),
        redirect: 'manual',
      })
      const type = res.headers.get('content-type') ?? ''
      if (res.status === 401 || res.type === 'opaqueredirect') {
        patchLast({ content: 'Your session has ended. Please log in again.', signedOut: true })
      } else if (type.startsWith('text/plain') && res.ok && res.body) {
        const reader = res.body.getReader()
        const dec = new TextDecoder()
        let acc = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          acc += dec.decode(value, { stream: true })
          setMessages((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: acc, pending: false } : x)))
        }
        history.current = [...history.current, { role: 'assistant', content: acc }].slice(-20)
        setChips(CHIPS)
      } else if (type.includes('application/json')) {
        const data = await res.json()
        if (!res.ok || typeof data.text !== 'string') {
          patchLast({ content: data.error && data.error !== 'signed_out' ? data.error : 'Sorry, something went wrong. Please try again.' })
        } else {
          patchLast({ content: data.text, source: data.source })
          if (Array.isArray(data.suggestions) && data.suggestions.length) setChips(data.suggestions)
          history.current = [...history.current, { role: 'assistant', content: data.text }].slice(-20)
        }
      } else {
        patchLast({ content: 'Sorry, something went wrong. Please try again.' })
      }
    } catch {
      patchLast({ content: 'Sorry, I could not reach the assistant. Please check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }, [busy])

  // ?q= prefills and sends once; the ref stops React's dev double-run from sending twice, and
  // router.replace drops ?q= so a reload does not ask the question again.
  useEffect(() => {
    if (initialQuestion && !sentInitial.current) {
      sentInitial.current = true
      router.replace('/assistant', { scroll: false })
      send(initialQuestion)
    }
  }, [initialQuestion, send, router])

  // Bring the newest question (and so the start of its answer) into view.
  useEffect(() => {
    if (messages.length) lastQuestion.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [messages.length])

  const lastUserIndex = messages.map((m) => m.role).lastIndexOf('user')
  // On a phone the info box folds away after the first message; "i" opens it again. From sm up it always shows.
  const infoClass = !started || infoOpen ? 'flex' : 'hidden sm:flex'

  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 sm:gap-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[28px] leading-tight font-bold">Ask NETS Assistant</h1>
          <p className="mt-1 text-[15px] text-ink-2">Questions about your sales, money and bills, answered from your own data</p>
        </div>
        {started ? (
          <button
            type="button"
            onClick={() => setInfoOpen((o) => !o)}
            aria-expanded={infoOpen}
            aria-label="About this assistant"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong bg-white text-[16px] font-semibold text-nets-blue sm:hidden"
          >
            i
          </button>
        ) : null}
      </div>

      <div className={`${infoClass} items-start gap-3 rounded-[12px] border border-line bg-white p-4 text-[15px] text-ink-2`}>
        <span aria-hidden="true" className="mt-0.5 text-nets-blue">ⓘ</span>
        <p>
          <b className="text-ink">{mode === 'ai' ? 'AI mode.' : 'Quick answers mode.'}</b>{' '}
          {mode === 'ai'
            ? 'I look up your numbers and explain them in plain words. '
            : 'I match your question to answers I know and look up your numbers. '}
          I can only read your data. I can&apos;t move money or change anything.
        </p>
      </div>

      <div className="flex flex-col gap-4" aria-live="polite">
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <p
              key={i}
              ref={i === lastUserIndex ? lastQuestion : null}
              className="max-w-[92%] scroll-mt-20 self-end rounded-[16px_16px_4px_16px] bg-nets-blue px-4 py-3 text-[16px] break-words text-white sm:max-w-[80%]"
            >
              {m.content}
            </p>
          ) : (
            <div key={i} className="grid grid-cols-1 gap-3 sm:grid-cols-[36px_minmax(0,1fr)]">
              <span aria-hidden="true" className="hidden size-9 place-items-center rounded-[10px] bg-nets-red text-[13px] font-bold text-white sm:grid">N</span>
              <div className="min-w-0 overflow-hidden rounded-[4px_16px_16px_16px] border border-line bg-white shadow-panel">
                <div className="px-4 py-4 sm:px-[18px]">
                  {m.pending ? (
                    <p className="text-[16px] text-ink-3">Looking that up…</p>
                  ) : (
                    <p className="text-[17px] leading-relaxed break-words whitespace-pre-line">{m.content}</p>
                  )}
                </div>
                {m.signedOut ? (
                  <div className="border-t border-line bg-page px-4 py-2 text-[14px] sm:px-[18px]">
                    <Link href="/login" className="inline-flex min-h-11 items-center font-semibold">Log in →</Link>
                  </div>
                ) : m.source && !m.pending ? (
                  <div className="border-t border-line bg-page px-4 py-2 text-[14px] sm:px-[18px]">
                    <Link href={m.source.href} className="inline-flex min-h-11 items-center font-semibold">
                      {m.source.title} →
                    </Link>
                  </div>
                ) : null}
              </div>
            </div>
          ),
        )}
      </div>

      <div className="sticky bottom-[62px] -mx-1 flex flex-col gap-2 bg-gradient-to-t from-page from-[calc(100%-16px)] to-transparent px-1 pt-4 pb-3 sm:pt-8 md:bottom-0">
        <div
          className={`flex gap-2 ${started ? 'flex-nowrap overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible' : 'flex-wrap'}`}
          role="group"
          aria-label="Suggested questions"
        >
          {chips.map((c) => (
            <button
              key={c}
              type="button"
              disabled={busy}
              onClick={() => send(c)}
              className="min-h-11 shrink-0 rounded-full border border-line-strong bg-white px-4 text-[15px] font-medium text-ink hover:border-nets-blue hover:text-nets-blue disabled:opacity-50 sm:shrink"
            >
              <span className={started ? 'whitespace-nowrap sm:whitespace-normal' : ''}>{c}</span>
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            send(input)
          }}
          className="flex items-end gap-2 rounded-[16px] border border-line-strong bg-white p-2 shadow-[0_6px_20px_rgba(26,34,51,0.12)] focus-within:border-nets-blue"
        >
          <label htmlFor="assistant-q" className="sr-only">Your question</label>
          <textarea
            id="assistant-q"
            rows={1}
            value={input}
            maxLength={1000}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send(input)
              }
            }}
            placeholder="Ask a question"
            className="max-h-36 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-[16px] outline-none"
          />
          <span className="group relative">
            <button
              type="button"
              disabled
              aria-label="Speak your question (coming soon)"
              title="Coming soon"
              className="size-11 rounded-lg border border-line text-ink-3 opacity-60"
            >
              🎤
            </button>
            <span role="tooltip" className="pointer-events-none absolute right-0 bottom-full mb-1 hidden rounded-md bg-ink px-2 py-1 text-[12px] whitespace-nowrap text-white group-hover:block">
              Coming soon
            </span>
          </span>
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="min-h-11 rounded-lg bg-nets-red px-5 font-semibold text-white hover:bg-nets-red-hover disabled:opacity-50"
          >
            Send
          </button>
        </form>
        <p className={`text-center text-[13px] text-ink-3 ${started ? 'hidden sm:block' : ''}`}>
          Answers use sample data. Check important numbers in Reports before you act on them.
        </p>
      </div>
    </div>
  )
}
