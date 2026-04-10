'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { calculateGreeks, portfolioGreeks } from '@/lib/greeks'
import { generateScenarioGrid, generateHeatmap, findBreakevens } from '@/lib/scenarios'
import type { OptionPosition } from '@/types'

interface Step3AnalysisProps {
  positions: OptionPosition[]
  onBack: () => void
  onNext: (ticker: string) => void
}

function fmt(n: number): string {
  return n >= 0
    ? `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `-$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function pctFmt(n: number): string {
  return `${n >= 0 ? '+' : ''}${(n * 100).toFixed(1)}%`
}

const LINE_COLORS = ['#00c896', '#38bdf8', '#a78bfa', '#f59e0b', '#f43f5e']
const LINE_DASHES = ['', '8 4', '4 4', '2 2', '6 3']

export default function Step3Analysis({ positions, onBack, onNext }: Step3AnalysisProps) {
  const [ivShift, setIvShift] = useState(0)

  const tickers = [...new Set(positions.map(p => p.ticker))]
  const [selectedTicker, setSelectedTicker] = useState(tickers[0] || '')

  const underlyingPrices: Record<string, number> = {}
  for (const p of positions) {
    if (p.underlyingPrice && !underlyingPrices[p.ticker]) {
      underlyingPrices[p.ticker] = p.underlyingPrice
    }
  }

  const portGreeks = useMemo(() => portfolioGreeks(positions, underlyingPrices), [positions, underlyingPrices])

  const nearestExpiry = useMemo(() => {
    const now = Date.now()
    let min = Infinity
    for (const p of positions) {
      const days = Math.round((new Date(p.expiry).getTime() - now) / (1000 * 60 * 60 * 24))
      if (days > 0 && days < min) min = days
    }
    return min === Infinity ? 0 : min
  }, [positions])

  // Scenario data for selected ticker
  const tickerPositions = positions.filter(p => p.ticker === selectedTicker)
  const currentPrice = underlyingPrices[selectedTicker] || 0

  const stockMoves = useMemo(() => {
    const moves: number[] = []
    for (let i = -30; i <= 30; i++) moves.push(i / 100)
    return moves
  }, [])

  const heatmapMoves = useMemo(() => {
    const moves: number[] = []
    for (let i = -30; i <= 30; i += 5) moves.push(i / 100)
    return moves
  }, [])

  const maxExpDays = useMemo(() => {
    let max = 30
    for (const p of tickerPositions) {
      const days = Math.round((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      if (days > max) max = days
    }
    return max
  }, [tickerPositions])

  const daysRange = useMemo(() => [0, 7, 14, 30, maxExpDays], [maxExpDays])
  const timeLabels = ['Today', '+7d', '+14d', '+30d', 'Expiry']

  const scenarioData = useMemo(() =>
    generateScenarioGrid(tickerPositions, currentPrice, stockMoves, daysRange, ivShift / 100),
    [tickerPositions, currentPrice, stockMoves, daysRange, ivShift]
  )

  const heatmapData = useMemo(() =>
    generateHeatmap(tickerPositions, currentPrice, heatmapMoves, daysRange, ivShift / 100),
    [tickerPositions, currentPrice, heatmapMoves, daysRange, ivShift]
  )

  const breakevens = useMemo(() => findBreakevens(scenarioData), [scenarioData])
  const maxGain = useMemo(() => Math.max(...scenarioData.map(s => s.pnl_expiry)), [scenarioData])
  const maxLoss = useMemo(() => Math.min(...scenarioData.map(s => s.pnl_expiry)), [scenarioData])

  // Per-position Greeks
  const positionGreeks = useMemo(() =>
    tickerPositions.map(p => ({
      pos: p,
      greeks: calculateGreeks(p, currentPrice),
    })),
    [tickerPositions, currentPrice]
  )

  const chartData = scenarioData.map(s => ({
    stockPrice: s.stockPrice,
    [timeLabels[0]]: s.pnl_today,
    [timeLabels[1]]: s.pnl_7d,
    [timeLabels[2]]: s.pnl_14d,
    [timeLabels[3]]: s.pnl_30d,
    [timeLabels[4]]: s.pnl_expiry,
  }))

  // Heatmap rendering helpers
  const heatmapMaxAbs = Math.max(1, ...heatmapData.map(c => Math.abs(c.pnl)))

  function cellColor(pnl: number): string {
    const intensity = Math.min(1, Math.abs(pnl) / heatmapMaxAbs)
    const alpha = Math.round((0.1 + intensity * 0.6) * 255).toString(16).padStart(2, '0')
    if (pnl > 0) return `#00c896${alpha}`
    if (pnl < 0) return `#f43f5e${alpha}`
    return 'transparent'
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Dollar Delta" value={fmt(portGreeks.dollarDelta)} sub="per $1 stock move" color={portGreeks.dollarDelta >= 0 ? 'var(--accent)' : 'var(--danger)'} />
        <MetricCard label="Daily Theta" value={fmt(portGreeks.dollarTheta)} sub="per day" color={portGreeks.dollarTheta >= 0 ? 'var(--accent)' : 'var(--danger)'} />
        <MetricCard label="Nearest Expiry" value={`${nearestExpiry}d`} sub="days to expiry" color="var(--warning)" />
        <MetricCard label="Positions" value={`${positions.length}`} sub={`across ${tickers.length} ticker${tickers.length !== 1 ? 's' : ''}`} color="var(--text-muted)" />
      </div>

      {/* IV Slider */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-6 py-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--text-muted)]">Volatility Shift</span>
          <span className="font-mono text-sm font-semibold text-[var(--text-primary)]">
            IV {ivShift >= 0 ? '+' : ''}{ivShift}%
          </span>
        </div>
        <input
          type="range" min={-50} max={50} step={1} value={ivShift}
          onChange={e => setIvShift(parseInt(e.target.value))}
          className="w-full accent-[var(--accent)]"
        />
      </div>

      {/* Ticker selector */}
      {tickers.length > 1 && (
        <div className="flex gap-2">
          {tickers.map(t => (
            <button key={t}
              onClick={() => setSelectedTicker(t)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                t === selectedTicker ? 'bg-[var(--accent)] text-[var(--bg-base)]' : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
            >{t}</button>
          ))}
        </div>
      )}

      {/* P&L Chart */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">
          {selectedTicker} — P&L by Stock Price
        </h3>
        <ResponsiveContainer width="100%" height={380}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="stockPrice" stroke="var(--text-muted)" fontSize={11} fontFamily="IBM Plex Mono" tickFormatter={v => `$${v}`} />
            <YAxis stroke="var(--text-muted)" fontSize={11} fontFamily="IBM Plex Mono" tickFormatter={v => Math.abs(v) >= 1000 ? `$${(v/1000).toFixed(1)}k` : `$${v}`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'IBM Plex Mono' }}
              labelFormatter={l => `Stock: $${l}`}
              formatter={(value, name) => [fmt(Number(value)), String(name)]}
            />
            <Legend wrapperStyle={{ fontSize: 12, fontFamily: 'Inter', color: 'var(--text-muted)', paddingTop: 8 }} />
            {timeLabels.map((label, i) => (
              <Line key={label} type="monotone" dataKey={label}
                stroke={LINE_COLORS[i]} strokeWidth={i === timeLabels.length - 1 ? 2.5 : 1.5}
                strokeDasharray={LINE_DASHES[i]} dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
              />
            ))}
            <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 4" />
            <ReferenceLine x={currentPrice} stroke="var(--accent)" strokeDasharray="5 5"
              label={{ value: `$${currentPrice}`, position: 'top', fill: 'var(--accent)', fontSize: 11, fontWeight: 600 }}
            />
            {breakevens.map((be, i) => (
              <ReferenceLine key={i} x={be} stroke="var(--warning)" strokeDasharray="4 4"
                label={{ value: `BE $${be}`, position: 'insideTopRight', fill: 'var(--warning)', fontSize: 10 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Heatmap */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4 overflow-x-auto">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">P&L Heatmap</h3>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr>
              <th className="text-left px-2 py-2 text-[var(--text-muted)] font-medium">Price</th>
              {timeLabels.map(t => <th key={t} className="text-center px-2 py-2 text-[var(--text-muted)] font-medium">{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {heatmapMoves.map(move => {
              const price = Math.round(currentPrice * (1 + move) * 100) / 100
              return (
                <tr key={move}>
                  <td className="px-2 py-1.5 text-[var(--text-muted)] whitespace-nowrap">
                    ${price.toFixed(0)} <span className="text-[10px]">({pctFmt(move)})</span>
                  </td>
                  {daysRange.map((days, di) => {
                    const cell = heatmapData.find(c => c.stockPricePct === move && c.daysForward === days)
                    const pnl = cell?.pnl ?? 0
                    return (
                      <td key={di} className="text-center px-2 py-1.5 font-semibold" style={{
                        backgroundColor: cellColor(pnl),
                        color: pnl >= 0 ? 'var(--accent)' : 'var(--danger)',
                      }}>
                        {fmt(pnl)}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Greeks */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Greeks — {selectedTicker}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-3 py-2 text-xs text-[var(--text-muted)]">Position</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Delta</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">$ Delta</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Theta</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">$ Theta/day</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Vega</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">$ Vega</th>
              </tr>
            </thead>
            <tbody>
              {positionGreeks.map(({ pos, greeks: g }) => (
                <tr key={pos.id} className="border-b border-[var(--border)]/50">
                  <td className="px-3 py-2 text-[var(--text-primary)]">
                    {pos.quantity > 0 ? 'Long' : 'Short'} {Math.abs(pos.quantity)} {pos.strike} {pos.optionType}
                  </td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.delta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{g.delta.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.dollarDelta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmt(g.dollarDelta)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.theta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{g.theta.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.dollarTheta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmt(g.dollarTheta)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--accent)]">{g.vega.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--accent)]">{fmt(g.dollarVega)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-[var(--text-muted)] mt-3">
          Dollar Theta shows your daily P&L from time decay. Negative means you lose money each day (net long options).
        </p>
      </div>

      {/* Breakeven & Max Gain/Loss */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Breakeven(s)</div>
          <div className="font-mono text-lg font-bold text-[var(--warning)]">
            {breakevens.length > 0 ? breakevens.map(b => `$${b}`).join(', ') : 'None'}
          </div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Max Gain (at expiry)</div>
          <div className="font-mono text-lg font-bold text-[var(--accent)]">{fmt(maxGain)}</div>
        </div>
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
          <div className="text-xs text-[var(--text-muted)] mb-1">Max Loss (at expiry)</div>
          <div className="font-mono text-lg font-bold text-[var(--danger)]">{fmt(maxLoss)}</div>
        </div>
      </div>

      {/* Nav */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-elevated)] transition text-sm">
          <ArrowLeft className="w-4 h-4" /> Back to Review
        </button>
        <button
          onClick={() => onNext(selectedTicker)}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition text-sm"
        >
          Research a Ticker <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 py-3">
      <div className="text-xs font-medium text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
      <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</div>
    </div>
  )
}
