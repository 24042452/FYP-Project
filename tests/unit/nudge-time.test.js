import { describe, expect, it } from 'vitest'
import { timeAgo } from '../../lib/nudges/time.js'

const NOW = '2026-11-14T10:00:00.000Z'
const ago = (/** @type {number} */ secs) => timeAgo(new Date(new Date(NOW).getTime() - secs * 1000).toISOString(), NOW)

describe('timeAgo', () => {
  it('formats minutes, hours and days in plain words', () => {
    expect(ago(30)).toBe('Just now')
    expect(ago(60)).toBe('1 minute ago')
    expect(ago(59 * 60)).toBe('59 minutes ago')
    expect(ago(2 * 3600)).toBe('2 hours ago')
    expect(ago(3 * 86400)).toBe('3 days ago')
  })
  it('shows the Singapore date after a week', () => {
    expect(timeAgo('2026-11-01T17:00:00.000Z', NOW)).toBe('2 Nov')
  })
})
