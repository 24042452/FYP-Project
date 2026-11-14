import { z } from 'zod'
import { callTool } from './tools.js'
import { buildSystemPrompt } from './system-prompt.js'

/**
 * AI mode (ASSISTANT_MODE=ai + ANTHROPIC_API_KEY): Claude answers using the same read-only tools as rules mode.
 * The model never writes SQL and never chooses the merchant; the tools were built for one merchant by the route.
 * A manual streaming tool loop (not the beta tool runner) so every tool input is validated by our Zod schema.
 */

export const MODEL = 'claude-opus-5-5'
export const BETAS = ['server-side-fallback-2026-07-01']
const MAX_TURNS = 6
const MAX_TOKENS = 4000

/**
 * @param {import('./tools.js').AssistantTool[]} tools
 */
export function toolDefinitions(tools) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: z.toJSONSchema(t.inputSchema, { io: 'input' }),
    eager_input_streaming: true,
  }))
}

/**
 * The request for one model turn.
 * @param {{tradingName: string, today: string, messages: any[], tools: import('./tools.js').AssistantTool[]}} p
 */
export function buildRequest({ tradingName, today, messages, tools }) {
  return {
    model: MODEL,
    max_tokens: MAX_TOKENS,
    betas: BETAS,
    fallbacks: 'default',
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low' },
    system: buildSystemPrompt({ tradingName, today }),
    tools: toolDefinitions(tools),
    messages,
  }
}

/**
 * Stream the answer's text. Runs tools as the model asks and loops until it is done.
 * @param {{client: any, tradingName: string, today: string, messages: {role: 'user' | 'assistant', content: string}[], tools: import('./tools.js').AssistantTool[]}} p
 * @returns {AsyncGenerator<string>}
 */
export async function* streamAiAnswer({ client, tradingName, today, messages, tools }) {
  /** @type {any[]} */
  const convo = messages.map((m) => ({ role: m.role, content: m.content }))
  let spoke = false // text already sent in an earlier turn, so a new turn starts on a new line
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let first = true
    const stream = client.beta.messages.stream(buildRequest({ tradingName, today, messages: convo, tools }))
    for await (const ev of stream) {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
        if (first && spoke) yield '\n'
        first = false
        spoke = true
        yield ev.delta.text
      }
    }
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') {
      yield "\nI can't help with that one. Try one of the suggestions instead."
      return
    }
    if (final.stop_reason === 'max_tokens') {
      yield '\n(The answer was cut short. Try a more specific question.)'
      return
    }
    if (final.stop_reason !== 'tool_use') return

    convo.push({ role: 'assistant', content: final.content })
    const results = []
    for (const block of final.content.filter((/** @type {any} */ b) => b.type === 'tool_use')) {
      try {
        const out = await callTool(tools, block.name, block.input)
        results.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(out) })
      } catch (err) {
        const bad = err instanceof z.ZodError || (err instanceof Error && err.message.startsWith("Unknown tool"))
        // Only input-validation problems go back to the model; anything else (e.g. MySQL) stays server-side.
        if (!bad) console.error("assistant tool failed", block.name, err)
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: bad ? `That tool call was not valid: ${err.message.slice(0, 300)}` : "That lookup failed. Tell the merchant you could not look it up right now.",
        })
      }
    }
    convo.push({ role: 'user', content: results })
  }
  yield '\n(I could not finish that answer. Please try again.)'
}
