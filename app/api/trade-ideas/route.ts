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

const SYSTEM_PROMPT = `You are a conservative options trading strategist advising a retail trader on Questrade (Canadian brokerage). You analyze their current portfolio and suggest specific, actionable trade ideas.

CRITICAL RULES:
1. RISK FIRST: For every suggestion, state the MAX LOSS in dollars before anything else
2. Focus on: hedging existing risk, rolling near-expiry positions, reducing concentration, and income strategies
3. Never suggest naked short puts/calls without explicitly warning about unlimited/large loss potential and stating the max dollar risk
4. Use probability language: "approximately X% chance" not certainties
5. Each suggestion must include: What to do, Why, Max loss in $, What could go wrong
6. Consider the user's existing positions — don't suggest trades that conflict or double-up risk
7. Always suggest the most conservative approach first
8. If the portfolio is well-hedged, say so — don't manufacture unnecessary trades
9. Format each idea as a clear, numbered suggestion with a bold title
10. Use web search to check current market conditions, earnings dates, and IV levels before suggesting

The user's current portfolio:
{PORTFOLIO}

Analyze this portfolio and provide 3-5 specific trade ideas. Start with the most important/urgent ones (e.g., positions near expiry that need attention).`

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
    const { portfolioContext, question } = body

    if (!portfolioContext) {
      return new Response(JSON.stringify({ error: 'No portfolio data' }), { status: 400 })
    }

    const client = new Anthropic({ apiKey })
    const systemPrompt = SYSTEM_PROMPT.replace('{PORTFOLIO}', portfolioContext)
    const userMessage = question
      ? `${question}\n\nUse the portfolio data in your system prompt.`
      : 'Analyze my portfolio and suggest trade ideas. Focus on risk management and the most urgent actions first.'

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: systemPrompt,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 8 }],
      messages: [{ role: 'user', content: userMessage }],
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
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-cache' },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Failed'
    console.error('Trade ideas error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
