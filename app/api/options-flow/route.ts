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

const SYSTEM_PROMPT = `You are an institutional-grade options flow analyst. You search the web for the latest unusual options activity, large block trades, and smart money positioning for the given tickers.

For each ticker, search for and report:

1. **Unusual Options Activity** — Large volume trades relative to open interest, sweep orders, block trades. Include specific strike prices, expiry dates, premiums paid, and whether they were calls or puts.

2. **Smart Money Signals** — Institutional positioning, dark pool activity, any notable hedge fund moves or 13F filings related to these tickers.

3. **Volume & Open Interest Anomalies** — Strikes with unusually high call/put volume today, significant changes in open interest, put/call ratio shifts.

4. **Sentiment Signal** — Rate each ticker: 🟢 BULLISH FLOW / 🟡 NEUTRAL / 🔴 BEARISH FLOW based on the overall options activity pattern.

5. **What It Means** — In plain English, explain what this flow suggests. "Big money is betting X will move above $Y by Z date" type analysis.

RULES:
- Be specific: cite strike prices, expiry dates, contract counts, and premium amounts where available
- Search multiple sources for each ticker to cross-reference
- If you can't find recent flow data for a ticker, say so honestly
- Always note that unusual flow is informational, not predictive — smart money is wrong too
- Today's date for context: ${new Date().toISOString().split('T')[0]}`

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
    const { tickers } = body

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({ error: 'No tickers provided' }), { status: 400 })
    }

    const tickerList = tickers.map((t: string) => t.toUpperCase().trim()).join(', ')
    const client = new Anthropic({ apiKey })

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 15 }],
      messages: [{
        role: 'user',
        content: `Scan for unusual options activity and smart money flow for: ${tickerList}. Search multiple financial sources. Give me the full institutional-grade flow analysis.`,
      }],
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
    console.error('Options flow error:', msg)
    return new Response(JSON.stringify({ error: msg }), { status: 500 })
  }
}
