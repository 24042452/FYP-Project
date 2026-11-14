import { beforeAll, describe, expect, it } from 'vitest'
import mysql from 'mysql2/promise'
import { loadFaq } from '../../lib/assistant/kb.js'
import { searchKb } from '../../lib/data/kb.js'

// kb_chunks is shared help content (no merchant_id), so the merchant isolation rule does not apply.
beforeAll(async () => {
  const conn = await mysql.createConnection({ uri: process.env.TEST_DATABASE_ADMIN_URL })
  try {
    const faq = loadFaq()
    await conn.query('DELETE FROM kb_chunks')
    await conn.query('INSERT INTO kb_chunks (source, heading, content) VALUES ?', [faq.map((c) => [c.source, c.heading, c.content])])
  } finally {
    await conn.end()
  }
})

describe('searchKb', () => {
  it('loads about twenty answers from content/faq.md', () => {
    expect(loadFaq().length).toBeGreaterThanOrEqual(18)
  })

  it('finds MDR (a 3 letter word)', async () => {
    const hits = await searchKb('MDR')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0].heading).toMatch(/MDR/)
  })

  it('finds GST', async () => {
    const hits = await searchKb('what is GST')
    expect(hits.some((h) => /GST/.test(h.heading))).toBe(true)
  })

  it('finds payout timing for "when will I get paid"', async () => {
    const hits = await searchKb('when will I get paid')
    expect(hits[0].heading).toBe('When will I get paid?')
  })

  it('returns at most 4 and nothing for nonsense', async () => {
    expect((await searchKb('payment')).length).toBeLessThanOrEqual(4)
    expect(await searchKb('zzzqqq')).toEqual([])
    expect(await searchKb('   ')).toEqual([])
  })
})
