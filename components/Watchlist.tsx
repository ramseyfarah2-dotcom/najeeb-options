'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Plus, Trash2, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react'
import { usePortfolio } from '@/lib/context'
import type { WatchlistItem } from '@/types'

function loadWatchlist(): WatchlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('na-watchlist')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveWatchlist(items: WatchlistItem[]) {
  localStorage.setItem('na-watchlist', JSON.stringify(items))
}

export default function Watchlist() {
  const { positions } = usePortfolio()
  const [items, setItems] = useState<WatchlistItem[]>([])
  const [newTicker, setNewTicker] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Initialize: load from localStorage, merge with position tickers
  useEffect(() => {
    const stored = loadWatchlist()
    const positionTickers = [...new Set(positions.map(p => p.ticker).filter(Boolean))]

    const merged = [...stored]
    for (const ticker of positionTickers) {
      if (!merged.find(i => i.ticker === ticker)) {
        merged.push({
          ticker,
          currentPrice: null,
          previousClose: null,
          priceTarget: null,
          addedAt: new Date().toISOString(),
          isFromPositions: true,
        })
      }
    }
    setItems(merged)
    saveWatchlist(merged)
  }, [positions])

  const fetchPrices = useCallback(async () => {
    if (items.length === 0) return
    setRefreshing(true)
    try {
      const tickers = items.map(i => i.ticker)
      const res = await fetch('/api/stock-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      })
      if (!res.ok) return
      const { prices } = await res.json()

      setItems(prev => {
        const updated = prev.map(item => {
          const data = prices[item.ticker]
          if (!data) return item
          return {
            ...item,
            currentPrice: data.price ?? item.currentPrice,
            previousClose: data.previousClose ?? item.previousClose,
          }
        })
        saveWatchlist(updated)
        return updated
      })
      setLastUpdated(new Date())
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }, [items])

  // Fetch on mount and every 60 seconds
  useEffect(() => {
    fetchPrices()
    intervalRef.current = setInterval(fetchPrices, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [fetchPrices])

  const addTicker = () => {
    const ticker = newTicker.trim().toUpperCase()
    if (!ticker || items.find(i => i.ticker === ticker)) return
    const updated = [...items, {
      ticker,
      currentPrice: null,
      previousClose: null,
      priceTarget: null,
      addedAt: new Date().toISOString(),
      isFromPositions: false,
    }]
    setItems(updated)
    saveWatchlist(updated)
    setNewTicker('')
  }

  const removeTicker = (ticker: string) => {
    const updated = items.filter(i => i.ticker !== ticker)
    setItems(updated)
    saveWatchlist(updated)
  }

  const setPriceTarget = (ticker: string, target: number | null) => {
    const updated = items.map(i => i.ticker === ticker ? { ...i, priceTarget: target } : i)
    setItems(updated)
    saveWatchlist(updated)
  }

  const positionCount = (ticker: string) => positions.filter(p => p.ticker === ticker).length

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">Watchlist</h2>
          <p className="text-[var(--text-muted)] text-xs mt-1">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'Loading prices...'}
            {' · Auto-refreshes every 60s'}
          </p>
        </div>
        <button
          onClick={fetchPrices}
          disabled={refreshing}
          className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Add ticker */}
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
          value={newTicker}
          onChange={e => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && addTicker()}
          placeholder="Add ticker (e.g. TSLA)"
        />
        <button
          onClick={addTicker}
          disabled={!newTicker.trim()}
          className="px-4 py-2.5 bg-[var(--accent)] text-[var(--bg-base)] rounded-lg font-semibold text-sm hover:brightness-110 transition active:scale-95 disabled:opacity-40 flex items-center gap-1"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>

      {/* Watchlist table */}
      {items.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-muted)] text-sm">
          Add tickers above or import positions to populate your watchlist
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map(item => {
            const change = item.currentPrice && item.previousClose
              ? ((item.currentPrice - item.previousClose) / item.previousClose) * 100
              : null
            const changeColor = change === null ? 'var(--text-muted)' : change >= 0 ? 'var(--accent)' : 'var(--danger)'
            const ChangeIcon = change === null ? Minus : change >= 0 ? TrendingUp : TrendingDown
            const hitTarget = item.priceTarget && item.currentPrice && item.currentPrice >= item.priceTarget
            const posCount = positionCount(item.ticker)

            return (
              <div key={item.ticker}
                className={`flex items-center justify-between bg-[var(--bg-surface)] border rounded-xl px-4 py-3 transition ${
                  hitTarget ? 'border-[var(--warning)] bg-[var(--warning)]/5' : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--text-primary)]">{item.ticker}</span>
                      {posCount > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--accent)]/10 text-[var(--accent)]">
                          {posCount} pos
                        </span>
                      )}
                    </div>
                    {item.currentPrice ? (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-lg font-bold font-mono text-[var(--text-primary)]">
                          ${item.currentPrice.toFixed(2)}
                        </span>
                        <span className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: changeColor }}>
                          <ChangeIcon className="w-3 h-3" />
                          {change !== null ? `${change >= 0 ? '+' : ''}${change.toFixed(2)}%` : '—'}
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Loading...</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Price target */}
                  <div className="text-right">
                    <div className="text-[10px] text-[var(--text-muted)]">Target</div>
                    <input
                      className={`w-20 bg-[var(--bg-elevated)] border rounded px-2 py-1 text-xs font-mono text-right focus:outline-none ${
                        hitTarget ? 'border-[var(--warning)] text-[var(--warning)]' : 'border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)]'
                      }`}
                      type="number" step="0.01"
                      value={item.priceTarget ?? ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value)
                        setPriceTarget(item.ticker, isNaN(val) ? null : val)
                      }}
                      placeholder="—"
                    />
                  </div>
                  <button onClick={() => removeTicker(item.ticker)} className="p-1.5 rounded hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
