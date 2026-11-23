'use client'

import { useEffect, useRef, useState } from 'react'
import { formatSGD } from '@/lib/money'
import { useReducedMotion } from './use-reduced-motion'

const MONEY = /^\$[\d,]+\.\d{2}$/
const DURATION_MS = 600

/** @param {string} text "$1,234.50" @returns {number} cents */
const toCents = (text) => Math.round(Number(text.replace(/[$,]/g, '')) * 100)

/** Ease-out cubic. @param {number} t 0..1 */
const ease = (t) => 1 - (1 - t) ** 3

/**
 * A money figure that counts up (or down) to its new value over about 0.6 seconds when it changes.
 * The first render shows the final value, and so does anyone who asked for less motion. Text that is not
 * a dollar amount (like "Nothing") is shown as it is. With `countOnArrival`, it also counts up from $0.00 once
 * when it first appears (not for anyone who asked for less motion).
 * @param {{text: string, countOnArrival?: boolean}} props
 */
export function AnimatedMoney({ text, countOnArrival = false }) {
  const reduced = useReducedMotion()
  const isMoney = MONEY.test(text)
  const target = isMoney ? toCents(text) : 0
  const [shown, setShown] = useState(target)
  const current = useRef(target)
  const arrived = useRef(false)

  useEffect(() => {
    if (!isMoney) return
    if (!arrived.current) {
      arrived.current = true
      // Read the setting directly: on the first render after hydration `reduced` is still the server value.
      const less = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (countOnArrival && !reduced && !less) current.current = 0
    }
    const from = current.current
    if (reduced || from === target) {
      current.current = target
      setShown(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (/** @type {number} */ now) => {
      const t = Math.min(1, (now - start) / DURATION_MS)
      const v = t >= 1 ? target : Math.round(from + (target - from) * ease(t))
      current.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, isMoney, reduced, countOnArrival])

  if (!isMoney) return text
  // While counting, show the in-between value; once settled it equals the server text exactly.
  return shown === target ? text : formatSGD(shown)
}
