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
    setPlaying(true)
    const t = setTimeout(() => setPlaying(false), variant === 'ring' ? 900 : 350)
    return () => clearTimeout(t)
  }, [fxKey, variant])

  return <div className={`${className} ${playing ? (variant === 'ring' ? 'fx-ring' : 'fx-in') : ''}`}>{children}</div>
}
