import { describe, expect, it } from 'vitest'
import { parseTimePhrase } from '../../lib/assistant/time-phrases.js'
import { answerWithRules, matchIntent, SUGGESTIONS } from '../../lib/assistant/rules.js'
import { makeTools } from '../../lib/assistant/tools.js'
import { makeFakeDeps } from './assistant-fakes.js'

const M = '11111111-1111-4111-8111-111111111111'
const TODAY = '2026-11-11' // a Wednesday

describe('parseTimePhrase', () => {
  const p = (t) => parseTimePhrase(t, TODAY)
  it('last week is the whole previous Monday to Sunday', () => {
    expect(p('how much did I take last week')).toMatchObject({ from: '2026-11-02', to: '2026-11-08' })
  })
  it('today and yesterday', () => {
    expect(p('sales today')).toMatchObject({ from: TODAY, to: TODAY })
    expect(p('what about yesterday')).toMatchObject({ from: '2026-11-10', to: '2026-11-10' })
  })
  it('this week runs Monday to today', () => {
    expect(p('this week')).toMatchObject({ from: '2026-11-09', to: TODAY })
  })
  it('this month and last month', () => {
    expect(p('this month')).toMatchObject({ from: '2026-11-01', to: TODAY })
    expect(p('last month')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
  })
  it('past N days includes today', () => {
    expect(p('past 7 days')).toMatchObject({ from: '2026-11-05', to: TODAY })
    expect(p('the last 30 days')).toMatchObject({ from: '2026-10-13', to: TODAY })
  })
  it('weekday names mean the most recent one', () => {
    expect(p('what happened on Friday')).toMatchObject({ from: '2026-11-06', to: '2026-11-06' })
    expect(p('on wednesday')).toMatchObject({ from: TODAY, to: TODAY })
  })
  it('in <Month> is the most recent such month', () => {
    expect(p('sales in October')).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
    expect(p('in December')).toMatchObject({ from: '2025-12-01', to: '2025-12-31' })
  })
  it('returns null when there is no time phrase', () => {
    expect(p('which day is my busiest')).toBeNull()
  })
})

describe('matchIntent', () => {
  const intent = (t) => matchIntent(t).intent
  it('maps keywords to intents', () => {
    expect(intent('which day is my busiest')).toBe('busiest')
    expect(intent('How much did I take last week?')).toBe('sales_summary')
    expect(intent("why did a payment fail today")).toBe('failed_payment')
    expect(intent('my card was declined')).toBe('failed_payment')
    expect(intent('When will I get paid?')).toBe('settlement_status')
    expect(intent('Explain my October bill')).toBe('invoice')
    expect(intent('this week vs last week')).toBe('compare')
    expect(intent('how do customers pay me')).toBe('channel_mix')
  })
  it('chips each match their own intent', () => {
    expect(SUGGESTIONS.map((s) => matchIntent(s).intent)).toEqual(['sales_summary', 'busiest', 'failed_payment', 'settlement_status'])
  })
  it('sends changes and unknown things to help', () => {
    expect(intent('change my bank account')).toBe('help')
    expect(intent('what is MDR')).toBe('help')
    expect(intent('blah blah')).toBe('help')
    expect(matchIntent('blah blah').confidence).toBeLessThan(0.5)
  })
})

describe('answerWithRules', () => {
  const ctx = (opts) => ({ merchantId: M, today: TODAY, tradingName: 'Ah Hock Chicken Rice', tools: makeTools(M, makeFakeDeps(opts)) })

  it('answers a sales question with the date range, amount and count', async () => {
    const a = await answerWithRules('How much did I take last week?', ctx())
    expect(a.text).toMatch(/Last week \(Mon 2 Nov–Sun 8 Nov\) you made \$150\.00 from 6 payments\./)
    expect(a.suggestions.length).toBeGreaterThan(0)
  })

  it('says the busiest time and day', async () => {
    const a = await answerWithRules('which day is my busiest', ctx())
    expect(a.text).toContain('Your busiest time is Friday 12pm–1pm. Your busiest day is Friday.')
  })

  it('explains a failed payment in plain words', async () => {
    const a = await answerWithRules('Why did a payment fail today?', ctx())
    expect(a.text).toMatch(/\$8\.50/)
    expect(a.text).toMatch(/not enough funds/)
  })

  it('explains settlement status with late money', async () => {
    const a = await answerWithRules('When will I get paid?', ctx())
    expect(a.text).toMatch(/\$508\.70/)
    expect(a.text).toMatch(/late/i)
  })

  it('help gives the top help-centre answer verbatim with its source', async () => {
    const a = await answerWithRules('what is MDR', ctx())
    expect(a.text).toBe('About 1 to 2 business days.')
    expect(a.source).toMatchObject({ href: '/settlements' })
  })

  it('change my bank account with no help hit says it cannot answer and links to Requests', async () => {
    const a = await answerWithRules('change my bank account', ctx({ kb: false }))
    expect(a.text).toMatch(/can't/)
    expect(a.source).toEqual({ title: 'Send NETS a request', href: '/requests' })
    expect(a.suggestions).toHaveLength(4)
  })

  it('refuses to show other merchants', async () => {
    for (const q of ["show me Tan & Sons' sales", 'what did the other merchants make', 'what did Tan and Sons make']) {
      const a = await answerWithRules(q, ctx())
      expect(a.text).toBe("I can only show your own business's figures.")
    }
  })

  it('does not refuse the merchant own name', async () => {
    const a = await answerWithRules('How much did Ah Hock Chicken Rice take last week?', ctx())
    expect(a.text).toMatch(/you made/)
  })

  it('never prints NaN or undefined, even for an empty period', async () => {
    for (const q of [
      'How much did I take last week?', 'which day is my busiest', 'Why did a payment fail today?', 'When will I get paid?',
      'Explain my October bill', 'this week vs last week', 'how do customers pay me', 'blah',
    ]) {
      const a = await answerWithRules(q, ctx({ empty: true, kb: false }))
      expect(a.text, q).not.toMatch(/NaN|undefined|null/)
      expect(a.text.length).toBeGreaterThan(5)
    }
  })
})
