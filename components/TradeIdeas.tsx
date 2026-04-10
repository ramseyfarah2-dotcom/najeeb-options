'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { Lightbulb, Loader2, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { usePortfolio } from '@/lib/context'
import { portfolioGreeks } from '@/lib/greeks'
import { generateScenarioGrid } from '@/lib/scenarios'
import type { OptionPosition } from '@/types'

function serializePortfolio(positions: OptionPosition[], prices: Record<string, number>): string {
  if (positions.length === 0) return 'No positions loaded.'
  const greeks = portfolioGreeks(positions, prices)
  const lines: string[] = []
  let totalPnl = 0
  for (const p of positions) {
    const pnl = (p.currentPrice - p.avgCost) * p.quantity * p.contractSize
    totalPnl += pnl
    const dte = Math.max(0, Math.round((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    lines.push(`${p.quantity > 0 ? 'Long' : 'Short'} ${Math.abs(p.quantity)} ${p.ticker} ${p.strike} ${p.optionType} exp ${p.expiry} (${dte}d) | avg $${p.avgCost} | now $${p.currentPrice} | stock $${p.underlyingPrice ?? '?'} | IV ${p.iv ? (p.iv * 100).toFixed(1) + '%' : '?'}`)
  }
  lines.push(`\nTotal P&L: $${totalPnl.toFixed(2)} | $ Delta: $${greeks.dollarDelta.toFixed(2)} | $ Theta: $${greeks.dollarTheta.toFixed(2)}/day`)
  return lines.join('\n')
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n >= 0 ? `$${str}` : `-$${str}`
}

export default function TradeIdeas() {
  const { positions, underlyingPrices } = usePortfolio()

  // AI Suggestions state
  const [aiContent, setAiContent] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)

  // What-If state
  const [hypotheticals, setHypotheticals] = useState<OptionPosition[]>([])
  const [showHypotheticals, setShowHypotheticals] = useState(true)
  const [selectedTicker, setSelectedTicker] = useState('')

  const tickers = [...new Set(positions.map(p => p.ticker))]

  // Set default selected ticker
  useMemo(() => {
    if (!selectedTicker && tickers.length > 0) setSelectedTicker(tickers[0])
  }, [tickers, selectedTicker])

  const runAiSuggestions = useCallback(async () => {
    setAiLoading(true)
    setAiError(null)
    setAiContent('')
    try {
      const res = await fetch('/api/trade-ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioContext: serializePortfolio(positions, underlyingPrices) }),
      })
      if (!res.ok) throw new Error('Failed to get trade ideas')
      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setAiContent(prev => prev + decoder.decode(value))
      }
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed')
    } finally {
      setAiLoading(false)
    }
  }, [positions, underlyingPrices])

  const addHypothetical = () => {
    setHypotheticals(prev => [...prev, {
      id: crypto.randomUUID(),
      ticker: selectedTicker || tickers[0] || '',
      optionType: 'call',
      strike: 0,
      expiry: '',
      quantity: -1,
      avgCost: 0,
      currentPrice: 0,
      iv: 0.30,
      underlyingPrice: underlyingPrices[selectedTicker || tickers[0]] || null,
      contractSize: 100,
    }])
  }

  const updateHypo = (id: string, field: keyof OptionPosition, value: unknown) => {
    setHypotheticals(prev => prev.map(h => h.id === id ? { ...h, [field]: value } : h))
  }

  const removeHypo = (id: string) => {
    setHypotheticals(prev => prev.filter(h => h.id !== id))
  }

  // Chart data: current vs current+hypothetical
  const currentPrice = underlyingPrices[selectedTicker] || 0
  const tickerPositions = positions.filter(p => p.ticker === selectedTicker)
  const tickerHypotheticals = hypotheticals.filter(h => h.ticker === selectedTicker)

  const stockMoves = useMemo(() => {
    const moves: number[] = []
    for (let i = -30; i <= 30; i += 2) moves.push(i / 100)
    return moves
  }, [])

  const daysRange = [0, 7, 14, 30]

  const currentScenario = useMemo(() => {
    if (!currentPrice || tickerPositions.length === 0) return null
    return generateScenarioGrid(tickerPositions, currentPrice, stockMoves, daysRange, 0)
  }, [tickerPositions, currentPrice, stockMoves])

  const combinedScenario = useMemo(() => {
    if (!currentPrice || !showHypotheticals || tickerHypotheticals.length === 0) return null
    const all = [...tickerPositions, ...tickerHypotheticals]
    if (all.length === 0) return null
    return generateScenarioGrid(all, currentPrice, stockMoves, daysRange, 0)
  }, [tickerPositions, tickerHypotheticals, currentPrice, stockMoves, showHypotheticals])

  const chartData = useMemo(() => {
    if (!currentScenario) return []
    return currentScenario.map((s, i) => {
      const point: Record<string, number> = {
        stockPrice: s.stockPrice,
        'Current P&L': s.pnl_expiry,
      }
      if (combinedScenario) {
        point['With What-If'] = combinedScenario[i].pnl_expiry
      }
      return point
    })
  }, [currentScenario, combinedScenario])

  return (
    <div className="flex flex-col gap-6 animate-fadeIn">
      {/* AI Suggestions */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-lg font-bold text-[var(--text-primary)]">AI Trade Ideas</h3>
          </div>
          <button
            onClick={runAiSuggestions}
            disabled={aiLoading || positions.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-[var(--bg-base)] font-semibold text-sm rounded-lg hover:brightness-110 transition active:scale-95 disabled:opacity-40"
          >
            {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lightbulb className="w-4 h-4" />}
            {aiLoading ? 'Analyzing...' : 'Get Ideas'}
          </button>
        </div>

        {positions.length === 0 && (
          <p className="text-sm text-[var(--text-muted)]">Import positions first to get trade ideas.</p>
        )}

        {aiError && <p className="text-sm text-[var(--danger)]">{aiError}</p>}

        {aiLoading && !aiContent && (
          <div className="text-center py-8">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--accent)] mb-2" />
            <p className="text-sm text-[var(--text-muted)]">Analyzing your portfolio and searching the market...</p>
          </div>
        )}

        {aiContent && (
          <pre className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed font-[Inter,sans-serif]">
            {aiContent}
          </pre>
        )}
      </div>

      {/* What-If Simulator */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[var(--text-primary)]">What-If Simulator</h3>
          <div className="flex items-center gap-2">
            {hypotheticals.length > 0 && (
              <button
                onClick={() => setShowHypotheticals(!showHypotheticals)}
                className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition"
              >
                {showHypotheticals ? <ToggleRight className="w-5 h-5 text-[var(--accent)]" /> : <ToggleLeft className="w-5 h-5" />}
                Show on chart
              </button>
            )}
            <button
              onClick={addHypothetical}
              className="flex items-center gap-1 px-3 py-1.5 border border-[var(--border)] text-[var(--text-muted)] rounded-lg text-sm hover:bg-[var(--bg-elevated)] transition"
            >
              <Plus className="w-4 h-4" /> Add Trade
            </button>
          </div>
        </div>

        {/* Hypothetical positions */}
        {hypotheticals.length > 0 && (
          <div className="flex flex-col gap-2 mb-4">
            {hypotheticals.map(h => (
              <div key={h.id} className="flex items-center gap-2 p-2 border border-dashed border-[var(--accent)]/30 rounded-lg bg-[var(--accent)]/5">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)]">WHAT-IF</span>
                <select className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                  value={h.quantity > 0 ? 'buy' : 'sell'} onChange={e => updateHypo(h.id, 'quantity', e.target.value === 'buy' ? Math.abs(h.quantity) : -Math.abs(h.quantity))}>
                  <option value="sell">Sell</option>
                  <option value="buy">Buy</option>
                </select>
                <input className="w-12 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)]"
                  type="number" value={Math.abs(h.quantity)} onChange={e => updateHypo(h.id, 'quantity', (h.quantity < 0 ? -1 : 1) * (parseInt(e.target.value) || 1))} />
                <input className="w-16 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)]"
                  value={h.ticker} onChange={e => updateHypo(h.id, 'ticker', e.target.value.toUpperCase())} placeholder="TICK" />
                <input className="w-16 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)]"
                  type="number" step="0.5" value={h.strike || ''} onChange={e => updateHypo(h.id, 'strike', parseFloat(e.target.value) || 0)} placeholder="Strike" />
                <select className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                  value={h.optionType} onChange={e => updateHypo(h.id, 'optionType', e.target.value)}>
                  <option value="call">Call</option>
                  <option value="put">Put</option>
                </select>
                <input className="w-28 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs text-[var(--text-primary)]"
                  type="date" value={h.expiry} onChange={e => updateHypo(h.id, 'expiry', e.target.value)} />
                <input className="w-16 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1 text-xs font-mono text-[var(--text-primary)]"
                  type="number" step="0.01" value={h.avgCost || ''} onChange={e => updateHypo(h.id, 'avgCost', parseFloat(e.target.value) || 0)} placeholder="Premium" />
                <button onClick={() => removeHypo(h.id)} className="p-1 rounded hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)]">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Ticker selector for chart */}
        {tickers.length > 1 && (
          <div className="flex gap-2 mb-3">
            {tickers.map(t => (
              <button key={t} onClick={() => setSelectedTicker(t)}
                className={`px-3 py-1 rounded text-xs font-semibold transition ${
                  t === selectedTicker ? 'bg-[var(--accent)] text-[var(--bg-base)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]'
                }`}
              >{t}</button>
            ))}
          </div>
        )}

        {/* Comparison chart */}
        {chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
              <XAxis dataKey="stockPrice" stroke="var(--text-muted)" fontSize={11} fontFamily="IBM Plex Mono" tickFormatter={v => `$${v}`} />
              <YAxis stroke="var(--text-muted)" fontSize={11} fontFamily="IBM Plex Mono" tickFormatter={v => Math.abs(v) >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`} />
              <Tooltip
                contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                formatter={(value) => [fmt(Number(value))]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine y={0} stroke="var(--text-muted)" strokeDasharray="4 4" />
              {currentPrice > 0 && <ReferenceLine x={currentPrice} stroke="var(--accent)" strokeDasharray="5 5" />}
              <Line type="monotone" dataKey="Current P&L" stroke="var(--text-muted)" strokeWidth={2} dot={false} />
              {combinedScenario && (
                <Line type="monotone" dataKey="With What-If" stroke="var(--accent)" strokeWidth={2.5} strokeDasharray="8 4" dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-[var(--text-muted)] text-center py-8">
            {positions.length === 0 ? 'Import positions to use the what-if simulator' : 'Select a ticker to see the P&L comparison chart'}
          </p>
        )}
      </div>
    </div>
  )
}
