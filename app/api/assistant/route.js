import { z } from 'zod'
import { getCurrentMerchant } from '@/lib/data/merchant'
import { makeTools } from '@/lib/assistant/tools'
import { answerWithRules, SUGGESTIONS } from '@/lib/assistant/rules'
import { streamAiAnswer } from '@/lib/assistant/ai'
import { sgtDate } from '@/lib/dates'

export const runtime = 'nodejs'

const noStore = { 'Cache-Control': 'private, no-store' }
const NOT_SET_UP = "The AI assistant isn't set up yet — try the suggestions below."

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().max(1000) }))
    .min(1)
    .max(20),
})

const json = (/** @type {unknown} */ body, status = 200) =>
  Response.json(body, { status, headers: noStore })

/**
 * The assistant. The merchant comes ONLY from the session (getCurrentMerchant), never from the request, and the
 * tools are built for that one merchant. Rules mode (default) needs no AI key; AI mode streams plain text.
 * @param {Request} request
 */
export async function POST(request) {
  const merchant = await getCurrentMerchant()

  let parsed
  try {
    parsed = Body.safeParse(await request.json())
  } catch {
    return json({ error: 'Please send your question as JSON.' }, 400)
  }
  if (!parsed.success || parsed.data.messages.at(-1)?.role !== 'user') {
    return json({ error: 'Please send between 1 and 20 messages (up to 1000 characters each), ending with your question.' }, 400)
  }
  const { messages } = parsed.data
  const question = /** @type {string} */ (messages.at(-1)?.content).trim()
  if (!question) return json({ error: 'Please type a question.' }, 400)

  const today = sgtDate(new Date().toISOString())
  const tools = makeTools(merchant.id)
  const rules = () => answerWithRules(question, { merchantId: merchant.id, today, tools, tradingName: merchant.tradingName })

  const wantsAi = process.env.ASSISTANT_MODE === 'ai'
  const key = process.env.ANTHROPIC_API_KEY

  try {
    if (!wantsAi) return json(await rules())
    if (!key) {
      const a = await rules()
      return json({ ...a, text: `${NOT_SET_UP}\n\n${a.text}`, suggestions: a.suggestions.length ? a.suggestions : SUGGESTIONS })
    }

    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: key })
    const gen = streamAiAnswer({ client, tradingName: merchant.tradingName, today, messages, tools })
    const enc = new TextEncoder()
    const body = new ReadableStream({
      async start(controller) {
        try {
          for await (const t of gen) controller.enqueue(enc.encode(t))
        } catch {
          controller.enqueue(enc.encode('\nSorry, something went wrong. Please try again.'))
        }
        controller.close()
      },
    })
    return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8', ...noStore } })
  } catch {
    return json({ text: 'Sorry, I could not answer that just now. Please try again.', suggestions: SUGGESTIONS }, 200)
  }
}
