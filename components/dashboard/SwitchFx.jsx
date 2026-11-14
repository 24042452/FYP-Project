'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Plays a short entrance (fade and slide, or a blue ring pulse) each time `fxKey` changes, for example when
 * the outlet or period is switched. Nothing plays on the first render, and nothing plays for people who asked
 * for less motion (the CSS is switched off in globals.css). It never remounts its children, so numbers inside
 * can still count up from their old values.
 * @param {{fxKey: string, variant: 'panels' | 'ring', className?: string, children: React.ReactNode}} props
 */
export function SwitchFx({ fxKey, variant, className = '', children }) {
  const [playing, setPlaying] = useState(false)
  const first = useRef(true)
  const last = useRef(fxKey)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (last.current === fxKey) return
    last.current = fxKey
    // Drop the class for a frame first so a switch during a running animation restarts it.
    setPlaying(false)
    let end = 0
    const raf = requestAnimationFrame(() => {
      setPlaying(true)
      end = window.setTimeout(() => setPlaying(false), variant === 'ring' ? 900 : 350)
    })
    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(end)
    }
  }, [fxKey, variant])

  return <div className={`${className} ${playing ? (variant === 'ring' ? 'fx-ring' : 'fx-in') : ''}`}>{children}</div>
}
