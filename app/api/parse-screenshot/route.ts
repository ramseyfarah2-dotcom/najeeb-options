import { NextRequest, NextResponse } from 'next/server'
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

const PARSE_PROMPT = `You are an options trading data extractor. Extract ALL visible option positions from this Questrade screenshot.

The Questrade positions table has these columns:
  Symbol | Open qty | Closed qty | Days to Exp | Avg price | Price | Delta | Volatility | Mkt value | % portfolio | Open P&L | Closed P&L

The Symbol column contains the full option description, for example:
  "BABA 15 May 2026 130.00 Call"

CRITICAL RULES:
1. All prices are PER SHARE (not per contract). Report exactly as shown.
2. Numbers in PARENTHESES like (8) mean SHORT (negative quantity). Examples: (8) = -8, 10 = +10
3. "Avg price" = avgCost. "Price" = currentPrice.
4. Convert dates to YYYY-MM-DD format.
5. Extract IV from "Volatility" column as a decimal (45.26 → 0.4526).
6. underlyingPrice is NOT shown — set to null.
7. If any value is unreadable, use null.
8. Read EVERY row carefully. Do not skip any positions.
9. Return ONLY a valid JSON array, no markdown, no explanation.
10. If no positions found, return: []

Each object:
{
  "ticker": string,
  "optionType": "call" or "put",
  "strike": number,
  "expiry": "YYYY-MM-DD",
  "quantity": number (negative if short),
  "avgCost": number (per share),
  "currentPrice": number (per share),
  "iv": number or null (as decimal),
  "contractSize": 100
}`

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Rate limit exceeded. Try again in a minute.' }, { status: 429 })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Server misconfigured: missing API key' }, { status: 500 })
  }

  try {
    const contentLength = request.headers.get('content-length')
    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 413 })
    }

    const body = await request.json()
    const { imageData, mimeType } = body

    if (!imageData || typeof imageData !== 'string') {
      return NextResponse.json({ error: 'Missing imageData' }, { status: 400 })
    }
    if (!mimeType || typeof mimeType !== 'string' || !mimeType.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid mimeType' }, { status: 400 })
    }

    const client = new Anthropic({ apiKey })

    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType as 'image/png', data: imageData },
          },
          { type: 'text', text: PARSE_PROMPT },
        ],
      }],
    })

    const textBlock = message.content.find(b => b.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text : '[]'

    let positions
    try {
      const cleaned = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
      positions = JSON.parse(cleaned)
    } catch {
      return NextResponse.json({ positions: [], error: 'Failed to parse AI response' })
    }

    // Normalize: ensure iv is decimal
    const normalized = (Array.isArray(positions) ? positions : []).map((p: Record<string, unknown>) => ({
      ...p,
      iv: typeof p.iv === 'number' ? (p.iv > 1 ? p.iv / 100 : p.iv) : null,
    }))

    return NextResponse.json({ positions: normalized })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error'
    console.error('Parse screenshot error:', msg)
    return NextResponse.json({ error: 'Failed to parse screenshot' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
