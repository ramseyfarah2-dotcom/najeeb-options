'use client'

import { useState, useMemo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer, Legend,
} from 'recharts'
import { usePortfolio } from '@/lib/context'
import { positionPnl } from '@/lib/scenarios'
import { calculateGreeks, portfolioGreeks } from '@/lib/greeks'
import { Grid3x3 } from 'lucide-react'

function fmt(n: number): string {
  const abs = Math.abs(n)
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  return n >= 0 ? `$${str}` : `-$${str}`
}

function fmtFull(n: number): string {
  const abs = Math.abs(n)
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n >= 0 ? `$${str}` : `-$${str}`
}

function cellColor(pnl: number, maxAbs: number): string {
  if (maxAbs === 0) return 'transparent'
  const intensity = Math.min(1, Math.abs(pnl) / maxAbs)
  const alpha = 0.08 + intensity * 0.5
  if (pnl > 0) return `rgba(0, 200, 150, ${alpha})`
  if (pnl < 0) return `rgba(244, 63, 94, ${alpha})`
  return 'transparent'
}

const LINE_COLORS = ['#00c896', '#38bdf8', '#a78bfa', '#f59e0b', '#f43f5e']

interface SimulatorProps {
  onGoToImport: () => void
}

export default function Simulator({ onGoToImport }: SimulatorProps) {
  const { positions, underlyingPrices } = usePortfolio()

  const [priceRange, setPriceRange] = useState(30) // ±30%
  const [ivShift, setIvShift] = useState(0) // %
  const tickers = [...new Set(positions.map(p => p.ticker))]
  const [selectedTicker, setSelectedTicker] = useState(tickers[0] || '')

  // Ensure selected ticker is valid
  useMemo(() => {
    if (!selectedTicker && tickers.length > 0) setSelectedTicker(tickers[0])
  }, [tickers, selectedTicker])

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
          <Grid3x3 className="w-7 h-7 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">No positions to simulate</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Import your positions first</p>
        </div>
        <button onClick={onGoToImport} className="px-6 py-3 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition active:scale-[0.97]">
          Import Positions
        </button>
      </div>
    )
  }

  const currentPrice = underlyingPrices[selectedTicker] || 0
  const tickerPositions = positions.filter(p => p.ticker === selectedTicker)

  // Price steps for rows (every 2.5% from -range to +range)
  const priceMoves = useMemo(() => {
    const moves: number[] = []
    for (let i = -priceRange; i <= priceRange; i += 2.5) moves.push(i / 100)
    return moves
  }, [priceRange])

  // Time columns
  const maxDte = useMemo(() => {
    let max = 30
    for (const p of tickerPositions) {
      const d = Math.max(0, Math.round((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
      if (d > max) max = d
    }
    return max
  }, [tickerPositions])

  const timeColumns = useMemo(() => {
    const cols = [0, 7, 14, 30]
    if (maxDte > 30 && !cols.includes(maxDte)) cols.push(maxDte)
    return cols.filter(d => d <= maxDte || d === 0)
  }, [maxDte])

  const timeLabels = timeColumns.map(d => d === 0 ? 'Now' : d === maxDte ? 'Expiry' : `+${d}d`)

  // Compute the full matrix
  const matrix = useMemo(() => {
    const ivShiftDecimal = ivShift / 100
    return priceMoves.map(move => {
      const stockPrice = Math.round(currentPrice * (1 + move) * 100) / 100
      const pnls = timeColumns.map(days => {
        let total = 0
        for (const pos of tickerPositions) {
          total += positionPnl(pos, stockPrice, days, ivShiftDecimal)
        }
        return Math.round(total * 100) / 100
      })
      return { move, stockPrice, pnls }
    })
  }, [priceMoves, currentPrice, tickerPositions, timeColumns, ivShift])

  // Max absolute P&L for color scaling
  const maxAbs = useMemo(() => {
    let max = 1
    for (const row of matrix) {
      for (const pnl of row.pnls) {
        if (Math.abs(pnl) > max) max = Math.abs(pnl)
      }
    }
    return max
  }, [matrix])

  // P&L chart data (lines for each time period)
  const chartData = useMemo(() => {
    return matrix.map(row => {
      const point: Record<string, number> = { stockPrice: row.stockPrice }
      timeLabels.forEach((label, i) => { point[label] = row.pnls[i] })
      return point
    })
  }, [matrix, timeLabels])

  // Breakevens (at expiry)
  const breakevens = useMemo(() => {
    const be: number[] = []
    const lastCol = timeColumns.length - 1
    for (let i = 1; i < matrix.length; i++) {
      const prev = matrix[i - 1].pnls[lastCol]
      const curr = matrix[i].pnls[lastCol]
      if ((prev <= 0 && curr > 0) || (prev >= 0 && curr < 0)) {
        const x1 = matrix[i - 1].stockPrice, x2 = matrix[i].stockPrice
        be.push(Math.round((x1 - prev * (x2 - x1) / (curr - prev)) * 100) / 100)
      }
    }
    return be
  }, [matrix, timeColumns])

  // Max gain/loss at expiry
  const lastColPnls = matrix.map(r => r.pnls[r.pnls.length - 1])
  const maxGain = Math.max(...lastColPnls)
  const maxLoss = Math.min(...lastColPnls)

  // Per-position greeks
  const posGreeks = useMemo(() =>
    tickerPositions.map(p => ({ pos: p, greeks: calculateGreeks(p, currentPrice) })),
    [tickerPositions, currentPrice]
  )
  const portGreeks = useMemo(() => portfolioGreeks(tickerPositions, underlyingPrices), [tickerPositions, underlyingPrices])

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">P&L Simulator</h2>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          See exactly how your positions react to stock price changes over time
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-wrap gap-3 items-end">
        {/* Ticker selector */}
        {tickers.length > 1 && (
          <div>
            <label className="text-[10px] font-medium text-[var(--text-muted)] block mb-1">Underlying</label>
            <div className="flex gap-1">
              {tickers.map(t => (
                <button key={t} onClick={() => setSelectedTicker(t)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold transition active:scale-95 ${
                    t === selectedTicker ? 'bg-[var(--accent)] text-[var(--bg-base)]' : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >{t}</button>
              ))}
            </div>
          </div>
        )}

        {/* Price range */}
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-medium text-[var(--text-muted)] block mb-1">Price Range: ±{priceRange}%</label>
          <input type="range" min={10} max={50} step={5} value={priceRange}
            onChange={e => setPriceRange(parseInt(e.target.value))} className="w-full" />
        </div>

        {/* IV shift */}
        <div className="flex-1 min-w-[180px]">
          <label className="text-[10px] font-medium text-[var(--text-muted)] block mb-1">
            IV Shift: {ivShift >= 0 ? '+' : ''}{ivShift}%
          </label>
          <input type="range" min={-30} max={30} step={1} value={ivShift}
            onChange={e => setIvShift(parseInt(e.target.value))} className="w-full" />
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 animate-stagger">
        <MiniCard label="Current Price" value={`$${currentPrice.toFixed(2)}`} color="var(--text-primary)" />
        <MiniCard label="Breakeven(s)" value={breakevens.length > 0 ? breakevens.map(b => `$${b}`).join(', ') : 'None'} color="var(--warning)" />
        <MiniCard label="Max Gain (expiry)" value={fmtFull(maxGain)} color="var(--accent)" />
        <MiniCard label="Max Loss (expiry)" value={fmtFull(maxLoss)} color="var(--danger)" />
      </div>

      {/* P&L Chart */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">{selectedTicker} — P&L by Stock Price</h3>
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
            <XAxis dataKey="stockPrice" stroke="var(--text-muted)" fontSize={11} fontFamily="IBM Plex Mono" tickFormatter={v => `$${v}`} />
            <YAxis stroke="var(--text-muted)" fontSize={11} fontFamily="IBM Plex Mono" tickFormatter={v => Math.abs(v) >= 1000 ? `${v < 0 ? '-' : ''}$${(Math.abs(v)/1000).toFixed(1)}k` : `$${v}`} />
            <Tooltip
              contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, fontFamily: 'IBM Plex Mono' }}
              labelFormatter={l => `Stock: $${l}`}
              formatter={(value) => [fmtFull(Number(value))]}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <ReferenceLine y={0} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="4 4" />
            {currentPrice > 0 && (
              <ReferenceLine x={currentPrice} stroke="var(--accent)" strokeDasharray="5 5"
                label={{ value: `$${currentPrice}`, position: 'top', fill: 'var(--accent)', fontSize: 11, fontWeight: 600 }} />
            )}
            {breakevens.map((be, i) => (
              <ReferenceLine key={i} x={be} stroke="var(--warning)" strokeDasharray="4 4"
                label={{ value: `BE $${be}`, position: 'insideTopRight', fill: 'var(--warning)', fontSize: 10 }} />
            ))}
            {timeLabels.map((label, i) => (
              <Line key={label} type="monotone" dataKey={label}
                stroke={LINE_COLORS[i % LINE_COLORS.length]}
                strokeWidth={i === timeLabels.length - 1 ? 2.5 : 1.5}
                strokeDasharray={i === 0 ? '' : i === timeLabels.length - 1 ? '' : '6 3'}
                dot={false} animationDuration={800} animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* P&L Matrix */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">P&L Matrix — {selectedTicker}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono border-collapse">
            <thead>
              <tr>
                <th className="text-left px-2 py-2 text-[var(--text-muted)] font-medium bg-[var(--bg-elevated)] sticky left-0 z-10 border-b border-[var(--border)]">
                  Stock Price
                </th>
                {timeLabels.map(t => (
                  <th key={t} className="text-center px-3 py-2 text-[var(--text-muted)] font-medium bg-[var(--bg-elevated)] border-b border-[var(--border)] whitespace-nowrap">
                    {t}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map(row => {
                const pctMove = row.move * 100
                const isNearCurrent = Math.abs(pctMove) < 1.5
                return (
                  <tr key={row.move} className={isNearCurrent ? 'bg-[var(--accent)]/5' : ''}>
                    <td className={`px-2 py-1.5 whitespace-nowrap sticky left-0 z-10 border-b border-[var(--border)]/50 ${
                      isNearCurrent ? 'bg-[var(--accent)]/5 font-bold text-[var(--accent)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'
                    }`}>
                      ${row.stockPrice.toFixed(1)}
                      <span className="text-[10px] ml-1 opacity-60">
                        ({pctMove >= 0 ? '+' : ''}{pctMove.toFixed(1)}%)
                      </span>
                    </td>
                    {row.pnls.map((pnl, ci) => (
                      <td key={ci}
                        className="text-center px-3 py-1.5 font-semibold border-b border-[var(--border)]/30 whitespace-nowrap"
                        style={{
                          backgroundColor: cellColor(pnl, maxAbs),
                          color: pnl > 0 ? 'var(--accent)' : pnl < 0 ? 'var(--danger)' : 'var(--text-muted)',
                        }}
                      >
                        {fmt(pnl)}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Greeks per position */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-4">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] mb-3">Greeks — {selectedTicker}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="text-left px-3 py-2 text-xs text-[var(--text-muted)]">Position</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Delta</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">$ Delta</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Theta/day</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">$ Theta</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">Vega</th>
                <th className="text-right px-3 py-2 text-xs text-[var(--text-muted)]">$ Vega</th>
              </tr>
            </thead>
            <tbody>
              {posGreeks.map(({ pos, greeks: g }) => (
                <tr key={pos.id} className="border-b border-[var(--border)]/40">
                  <td className="px-3 py-2 text-[var(--text-primary)]">
                    {pos.quantity > 0 ? 'Long' : 'Short'} {Math.abs(pos.quantity)} × {pos.strike} {pos.optionType}
                  </td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.delta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{g.delta.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.dollarDelta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmtFull(g.dollarDelta)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.theta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{g.theta.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono" style={{ color: g.dollarTheta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmtFull(g.dollarTheta)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--accent)]">{g.vega.toFixed(4)}</td>
                  <td className="px-3 py-2 text-right font-mono text-[var(--accent)]">{fmtFull(g.dollarVega)}</td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="border-t-2 border-[var(--border)]">
                <td className="px-3 py-2 font-semibold text-[var(--text-primary)]">Total</td>
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: portGreeks.delta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{portGreeks.delta.toFixed(4)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: portGreeks.dollarDelta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmtFull(portGreeks.dollarDelta)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: portGreeks.theta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{portGreeks.theta.toFixed(4)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold" style={{ color: portGreeks.dollarTheta >= 0 ? 'var(--accent)' : 'var(--danger)' }}>{fmtFull(portGreeks.dollarTheta)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-[var(--accent)]">{portGreeks.vega.toFixed(4)}</td>
                <td className="px-3 py-2 text-right font-mono font-bold text-[var(--accent)]">{fmtFull(portGreeks.dollarVega)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-[var(--text-muted)] mt-2">
          $ Delta = P&L per $1 stock move · $ Theta = daily time decay · $ Vega = P&L per 1% IV change
        </p>
      </div>
    </div>
  )
}

function MiniCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-3 py-2">
      <div className="text-[10px] font-medium text-[var(--text-muted)]">{label}</div>
      <div className="text-sm font-bold font-mono mt-0.5" style={{ color }}>{value}</div>
    </div>
  )
}
