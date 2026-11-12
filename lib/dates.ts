/** Date helpers. Business dates are 'YYYY-MM-DD' strings in Singapore time (UTC+8, no DST). */

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000

/** The Singapore calendar date of a UTC instant. */
export function sgtDate(iso: string): string {
  return new Date(new Date(iso).getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10)
}

/** The Singapore hour (0–23) of a UTC instant. */
export function sgtHour(iso: string): number {
  return new Date(new Date(iso).getTime() + SGT_OFFSET_MS).getUTCHours()
}

/** UTC ISO string for a Singapore local date + time. */
export function sgtToIso(date: string, hour: number, minute: number, second = 0): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d, hour, minute, second) - SGT_OFFSET_MS).toISOString()
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Inclusive list of dates from start to end. */
export function eachDay(start: string, end: string): string[] {
  const out: string[] = []
  for (let d = start; d <= end; d = addDays(d, 1)) out.push(d)
  return out
}

/** 0 = Monday … 6 = Sunday. */
export function dayOfWeek(date: string): number {
  return (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7
}

export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`
}

export function addMonths(date: string, n: number): string {
  const [y, m] = date.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1 + n, 1))
  return d.toISOString().slice(0, 10)
}

export function monthEnd(date: string): string {
  return addDays(addMonths(monthStart(date), 1), -1)
}
