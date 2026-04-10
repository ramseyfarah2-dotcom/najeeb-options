import { NextRequest, NextResponse } from 'next/server'

interface CacheEntry {
  price: number
  previousClose: number | null
  ts: number
}

const priceCache = new Map<string, CacheEntry>()
const CACHE_TTL = 60 * 1000 // 1 minute for watchlist freshness

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { tickers } = body

    if (!tickers || !Array.isArray(tickers) || tickers.length === 0) {
      return NextResponse.json({ error: 'Provide at least one ticker' }, { status: 400 })
    }

    const prices: Record<string, { price: number | null; previousClose: number | null }> = {}
    const now = Date.now()

    await Promise.allSettled(
      tickers.map(async (rawTicker: string) => {
        const ticker = rawTicker.toUpperCase().trim()
        if (!ticker) return

        const cached = priceCache.get(ticker)
        if (cached && now - cached.ts < CACHE_TTL) {
          prices[ticker] = { price: cached.price, previousClose: cached.previousClose }
          return
        }

        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
          const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
          if (!res.ok) {
            prices[ticker] = { price: null, previousClose: null }
            return
          }
          const data = await res.json()
          const meta = data?.chart?.result?.[0]?.meta
          const price = meta?.regularMarketPrice
          const previousClose = meta?.chartPreviousClose ?? meta?.previousClose ?? null

          if (typeof price === 'number' && price > 0) {
            prices[ticker] = { price, previousClose }
            priceCache.set(ticker, { price, previousClose, ts: now })
          } else {
            prices[ticker] = { price: null, previousClose: null }
          }
        } catch {
          prices[ticker] = { price: null, previousClose: null }
        }
      })
    )

    return NextResponse.json({ prices })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch stock prices' }, { status: 500 })
  }
}
