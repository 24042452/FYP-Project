import { describe, expect, it } from 'vitest'
import { buildRequest, streamAiAnswer, MODEL } from '../../lib/assistant/ai.js'
import { buildSystemPrompt } from '../../lib/assistant/system-prompt.js'
import { makeTools } from '../../lib/assistant/tools.js'
import { makeFakeDeps } from './assistant-fakes.js'

const M = '11111111-1111-4111-8111-111111111111'
const tools = makeTools(M, makeFakeDeps())

/** A fake stream: async-iterable events plus finalMessage(). */
function fakeStream(text, final) {
  return {
    async *[Symbol.asyncIterator]() {
      if (text) yield { type: 'content_block_delta', delta: { type: 'text_delta', text } }
    },
    finalMessage: async () => final,
  }
}

describe('AI mode request', () => {
  const req = buildRequest({ tradingName: 'Ah Hock Chicken Rice', today: '2026-11-11', messages: [{ role: 'user', content: 'hi' }], tools })

  it('uses the right model, fallbacks, adaptive thinking and low effort', () => {
    expect(req.model).toBe('claude-opus-5-5')
    expect(MODEL).toBe('claude-opus-5-5')
    expect(req.fallbacks).toBe('default')
    expect(req.betas).toContain('server-side-fallback-2026-07-01')
    expect(req.thinking).toEqual({ type: 'adaptive' })
    expect(req.output_config).toEqual({ effort: 'low' })
  })

  it('offers exactly the nine tools, with no merchant field in any schema', () => {
    expect(req.tools).toHaveLength(9)
    for (const t of req.tools) {
      expect(JSON.stringify(t.input_schema)).not.toMatch(/merchant/i)
      expect(t.input_schema.additionalProperties).toBe(false)
    }
  })

  it('system prompt names the merchant, date and the guardrails', () => {
    const s = buildSystemPrompt({ tradingName: 'Ah Hock Chicken Rice', today: '2026-11-11' })
    expect(s).toContain('NETS Assistant for Ah Hock Chicken Rice')
    expect(s).toContain('2026-11-11 SGT')
    expect(s).toMatch(/Answer only from tool results/)
    expect(s).toMatch(/other merchant/)
    expect(s).toMatch(/3 short sentences/)
    expect(req.system).toBe(s)
  })
})

describe('streamAiAnswer', () => {
  it('runs a tool the model asks for, then streams the answer', async () => {
    const calls = []
    const client = {
      beta: {
        messages: {
          stream(params) {
            calls.push(params)
            return calls.length === 1
              ? fakeStream('', { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_sales_summary', input: { from: '2026-11-02', to: '2026-11-08' } }] })
              : fakeStream('You made $150.00.', { stop_reason: 'end_turn', content: [] })
          },
        },
      },
    }
    let out = ''
    for await (const t of streamAiAnswer({ client, tradingName: 'X', today: '2026-11-11', messages: [{ role: 'user', content: 'sales?' }], tools })) out += t
    expect(out).toBe('You made $150.00.')
    expect(calls).toHaveLength(2)
    const result = calls[1].messages.at(-1).content[0]
    expect(result.type).toBe('tool_result')
    expect(JSON.parse(result.content).grossCents).toBe(15000)
  })

  it('returns an error result (not a crash) for a bad tool call, including a merchantId', async () => {
    const calls = []
    const client = {
      beta: {
        messages: {
          stream(params) {
            calls.push(params)
            return calls.length === 1
              ? fakeStream('', { stop_reason: 'tool_use', content: [{ type: 'tool_use', id: 't1', name: 'get_sales_summary', input: { from: '2026-11-02', to: '2026-11-08', merchantId: 'other' } }] })
              : fakeStream('Sorry.', { stop_reason: 'end_turn', content: [] })
          },
        },
      },
    }
    for await (const _ of streamAiAnswer({ client, tradingName: 'X', today: '2026-11-11', messages: [], tools })) void _
    expect(calls[1].messages.at(-1).content[0].is_error).toBe(true)
  })

  it('says something friendly on a refusal', async () => {
    const client = { beta: { messages: { stream: () => fakeStream('', { stop_reason: 'refusal', content: [] }) } } }
    let out = ''
    for await (const t of streamAiAnswer({ client, tradingName: 'X', today: '2026-11-11', messages: [], tools })) out += t
    expect(out).toMatch(/can't help/)
  })
})
