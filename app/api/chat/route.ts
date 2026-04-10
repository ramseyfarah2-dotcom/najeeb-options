import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const timestamps = rateLimitMap.get(ip)?.filter(t => now - t < 60_000) ?? []
  if (timestamps.length >= 10) return false
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return true
}

const SYSTEM_PROMPT = `You are a conservative financial advisor assistant for an options trader on Questrade (Canadian brokerage). You have access to the user's real portfolio data provided below.

CRITICAL RULES — follow these exactly:
1. ALWAYS evaluate MAX LOSS first before discussing any position or trade idea. State the dollar amount.
2. Use probability-based language: "approximately a 30% chance" not "this will probably happen"
3. NEVER say "guaranteed profit", "can't lose", "sure thing", "easy money", or similar
4. When discussing risk, be specific with dollar amounts from the portfolio data
5. If a position is risky, say so directly — do not sugarcoat
6. Explain concepts simply — the user is not a professional trader (think: explain to your dad)
7. Ground every answer in the user's actual positions and numbers
8. When you don't know something, say so. Use web search to verify current prices and news.
9. Always consider time decay (theta) when evaluating positions near expiry
10. For any suggested action, state: what to do, why, the max you could lose, and what could go wrong
11. Keep answers concise — 2-3 paragraphs max unless the user asks for detail
12. Use dollar amounts the user can relate to, not abstract Greeks values

You are helpful, honest, and cautious. Better to warn about a risk than miss it.`

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500 })
  }

  try {
    const body = await request.json()
    const { message, portfolioContext, history } = body

    if (!message || typeof message !== 'string') {
      return new Response(JSON.stringify({ error: 'Missing message' }), { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const systemWithContext = `${SYSTEM_PROMPT}\n\nThe user's current portfolio data:\n${portfolioContext || 'No portfolio loaded yet.'}`

    // Build message history
    const messages: { role: 'user' | 'assistant'; content: string }[] = []
    if (Array.isArray(history)) {
      for (const h of history.slice(-10)) { // Keep last 10 messages for context
        if (h.role === 'user' || h.role === 'assistant') {
          messages.push({ role: h.role, content: h.content })
        }
      }
    }
    messages.push({ role: 'user', content: message })

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemWithContext,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }],
      messages,
    })

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === 'content_block_delta' && 'delta' in event) {
              const delta = event.delta
              if ('text' in delta) {
                controller.enqueue(encoder.encode(delta.text))
              }
            }
          }
          controller.close()
        } catch (err) {
          controller.error(err)
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Chat failed'
    console.error('Chat error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
