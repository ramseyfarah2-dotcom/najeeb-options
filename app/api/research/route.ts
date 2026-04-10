import { NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const rateLimitMap = new Map<string, number[]>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60_000
  const maxRequests = 10
  const timestamps = rateLimitMap.get(ip)?.filter(t => now - t < windowMs) ?? []
  if (timestamps.length >= maxRequests) return false
  timestamps.push(now)
  rateLimitMap.set(ip, timestamps)
  return true
}

const SYSTEM_PROMPT = `You are a financial research assistant helping an options trader on Questrade. The user wants a briefing on a stock they may be trading options on. Use web search to find the most current information available. Structure your response with these sections:

## Latest News
Summarize the 3-5 most relevant recent news items with dates.

## Recent Price Action
Current price, recent % move (1d, 1w, 1mo), key support/resistance levels if notable.

## Earnings & Upcoming Events
Next earnings date (confirm with search), any upcoming ex-dividend dates, product launches, FDA dates, or other catalysts.

## Analyst Sentiment
Recent upgrades/downgrades, consensus rating, average price target.

## Unusual Options Activity
Any notable recent options flow, large block trades, unusual volume if available.

## Key Risks
2-3 specific risks relevant to holding options on this stock right now.

Be direct and specific. Use numbers wherever possible. Do not add generic disclaimers.
If the user asked a specific question, answer it first before the structured briefing.`

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return new Response('Rate limit exceeded', { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return new Response('Server misconfigured', { status: 500 })
  }

  try {
    const body = await request.json()
    const { ticker, question } = body

    if (!ticker || typeof ticker !== 'string' || !/^[A-Z]{1,6}$/i.test(ticker.trim())) {
      return new Response(JSON.stringify({ error: 'Invalid ticker symbol' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const cleanTicker = ticker.trim().toUpperCase()
    const today = new Date().toISOString().split('T')[0]
    const userMessage = question
      ? `Research ${cleanTicker} and answer this: ${question}. Today is ${today}.`
      : `Give me a full research briefing on ${cleanTicker}. Today is ${today}.`

    const client = new Anthropic({ apiKey })

    const stream = await client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 10 }],
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
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Research failed'
    console.error('Research error:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
