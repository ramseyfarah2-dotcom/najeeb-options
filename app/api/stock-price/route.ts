import { NextRequest, NextResponse } from 'next/server'

// In-memory cache: ticker → { price, timestamp }
const priceCache = new Map<string, { price: number; ts: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tickers } = body

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'Provide at least one ticker' }, { status: 400 })
    }

    const prices: Record<string, number | null> = {}
    const now = Date.now()

    await Promise.allSettled(
      tickers.map(async (rawTicker: string) => {
        const ticker = rawTicker.toUpperCase().trim()
        if (!ticker) return

        // Check cache
        const cached = priceCache.get(ticker)
        if (cached && now - cached.ts < CACHE_TTL) {
          prices[ticker] = cached.price
          return
        }

        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
          const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
          })
          if (!res.ok) {
            prices[ticker] = null
            return
          }
          const data = await res.json()
          const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice
          if (typeof price === 'number' && price > 0) {
            prices[ticker] = price
            priceCache.set(ticker, { price, ts: now })
          } else {
            prices[ticker] = null
          }
        } catch {
          prices[ticker] = null
        }
      })
    )

    return NextResponse.json({ prices })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stock prices' }, { status: 500 })
  }
}
