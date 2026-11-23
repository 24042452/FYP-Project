import { describe, expect, it } from 'vitest'
import { MAX_FILE_BYTES, MAX_FILES, MAX_TOTAL_BYTES, checkFiles, sniffMime } from '../../lib/disputes/files.js'

const MB = 1_048_576
const jpg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47])
const pdf = Uint8Array.from([0x25, 0x50, 0x44, 0x46])
const text = new TextEncoder().encode('hello world')

describe('sniffMime', () => {
  it('recognises JPEG, PNG and PDF by their first bytes', () => {
    expect(sniffMime(jpg)).toBe('image/jpeg')
    expect(sniffMime(png)).toBe('image/png')
    expect(sniffMime(pdf)).toBe('application/pdf')
  })
  it('rejects a text file (whatever its name) and short input', () => {
    expect(sniffMime(text)).toBeNull()
    expect(sniffMime(new Uint8Array(0))).toBeNull()
    expect(sniffMime(Uint8Array.from([0xff, 0xd8]))).toBeNull()
  })
})

describe('limits', () => {
  it('are 3 files, 2 MB each, 4 MB together', () => {
    expect([MAX_FILES, MAX_FILE_BYTES, MAX_TOTAL_BYTES]).toEqual([3, 2 * MB, 4 * MB])
  })
})

describe('checkFiles', () => {
  it('accepts no files, and returns the real type of each', () => {
    expect(checkFiles([])).toEqual({ ok: true, mimes: [] })
    const r = checkFiles([
      { name: 'a.jpg', size: 100, head: jpg },
      { name: 'b.pdf', size: 200, head: pdf },
    ])
    expect(r).toEqual({ ok: true, mimes: ['image/jpeg', 'application/pdf'] })
  })
  it('refuses more than 3 files', () => {
    const f = { name: 'a.jpg', size: 10, head: jpg }
    expect(checkFiles([f, f, f, f])).toEqual({ ok: false, message: 'You can add up to 3 files.' })
  })
  it('refuses a file over 2 MB, with one decimal', () => {
    const r = checkFiles([{ name: 'big.jpg', size: Math.round(3.4 * MB), head: jpg }])
    expect(r).toEqual({ ok: false, message: 'That file is 3.4 MB. Files can be up to 2 MB.' })
  })
  it('accepts exactly 2 MB', () => {
    expect(checkFiles([{ name: 'a.jpg', size: 2 * MB, head: jpg }]).ok).toBe(true)
  })
  it('refuses when the files add up to over 4 MB', () => {
    const f = { name: 'a.jpg', size: Math.round(1.9 * MB), head: jpg }
    expect(checkFiles([f, f, f])).toEqual({ ok: false, message: 'Your files add up to 5.7 MB. Together they can be up to 4 MB.' })
  })
  it('refuses a text file named .jpg', () => {
    expect(checkFiles([{ name: 'fake.jpg', size: 11, head: text }])).toEqual({ ok: false, message: 'Only photos (JPG, PNG) or PDFs.' })
  })
})
