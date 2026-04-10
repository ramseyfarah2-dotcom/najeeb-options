'use client'

import { useMemo } from 'react'
import { usePortfolio } from '@/lib/context'
import { portfolioGreeks, calculateGreeks } from '@/lib/greeks'
import { Upload, TrendingUp, TrendingDown, AlertTriangle, Shield, ShieldAlert, ShieldX } from 'lucide-react'
import type { OptionPosition } from '@/types'

interface DashboardProps {
  onGoToImport: () => void
}

function daysToExpiry(expiry: string): number {
  return Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

function fmt(n: number): string {
  const abs = Math.abs(n)
  const str = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n >= 0 ? `$${str}` : `-$${str}`
}

type RiskLevel = 'safe' | 'caution' | 'danger'

function computeRisk(positions: OptionPosition[], prices: Record<string, number>): { level: RiskLevel; factors: string[] } {
  const factors: string[] = []
  let level: RiskLevel = 'safe'

  // Concentration check
  const tickerValues: Record<string, number> = {}
  let totalValue = 0
  for (const p of positions) {
    const val = Math.abs(p.currentPrice * p.quantity * p.contractSize)
    tickerValues[p.ticker] = (tickerValues[p.ticker] || 0) + val
    totalValue += val
  }
  if (totalValue > 0) {
    for (const [ticker, val] of Object.entries(tickerValues)) {
      const pct = val / totalValue
      if (pct > 0.5) {
        factors.push(`${ticker} is ${Math.round(pct * 100)}% of portfolio — concentrated`)
        level = 'danger'
      } else if (pct > 0.35) {
        factors.push(`${ticker} is ${Math.round(pct * 100)}% of portfolio`)
        if (level === 'safe') level = 'caution'
      }
    }
  }

  // DTE check
  for (const p of positions) {
    const dte = daysToExpiry(p.expiry)
    if (dte <= 3 && dte > 0) {
      factors.push(`${p.ticker} ${p.strike} ${p.optionType} expires in ${dte}d`)
      level = 'danger'
    } else if (dte <= 7 && dte > 0) {
      factors.push(`${p.ticker} ${p.strike} ${p.optionType} expires in ${dte}d`)
      if (level === 'safe') level = 'caution'
    }
  }

  // Short ITM check
  for (const p of positions) {
    if (p.quantity >= 0 || !p.underlyingPrice) continue
    const itm = p.optionType === 'call'
      ? p.underlyingPrice > p.strike
      : p.underlyingPrice < p.strike
    if (itm) {
      const intrinsic = p.optionType === 'call'
        ? p.underlyingPrice - p.strike
        : p.strike - p.underlyingPrice
      factors.push(`Short ${p.ticker} ${p.strike} ${p.optionType} is $${intrinsic.toFixed(2)} ITM`)
      level = 'danger'
    }
  }

  if (factors.length === 0) factors.push('No immediate risks detected')
  return { level, factors }
}

export default function Dashboard({ onGoToImport }: DashboardProps) {
  const { positions, underlyingPrices } = usePortfolio()

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24 animate-fadeIn">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
          <Upload className="w-7 h-7 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">No positions yet</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Import your Questrade screenshot to get started</p>
        </div>
        <button
          onClick={onGoToImport}
          className="px-6 py-3 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition active:scale-[0.97]"
        >
          Import Positions
        </button>
      </div>
    )
  }

  const tickers = [...new Set(positions.map(p => p.ticker))]

  // Portfolio value & P&L
  const { totalValue, totalCost, unrealizedPnl } = useMemo(() => {
    let val = 0, cost = 0
    for (const p of positions) {
      val += p.currentPrice * p.quantity * p.contractSize
      cost += p.avgCost * p.quantity * p.contractSize
    }
    return { totalValue: val, totalCost: cost, unrealizedPnl: val - cost }
  }, [positions])

  // Greeks
  const greeks = useMemo(() => portfolioGreeks(positions, underlyingPrices), [positions, underlyingPrices])

  // Risk
  const risk = useMemo(() => computeRisk(positions, underlyingPrices), [positions, underlyingPrices])

  // Nearest expiry
  const nearestExpiry = useMemo(() => {
    let min = Infinity
    for (const p of positions) {
      const d = daysToExpiry(p.expiry)
      if (d > 0 && d < min) min = d
    }
    return min === Infinity ? 0 : min
  }, [positions])

  // Winners & Losers
  const sorted = useMemo(() => {
    return positions
      .map(p => ({
        pos: p,
        pnl: (p.currentPrice - p.avgCost) * p.quantity * p.contractSize,
      }))
      .sort((a, b) => b.pnl - a.pnl)
  }, [positions])

  const winners = sorted.filter(s => s.pnl > 0).slice(0, 3)
  const losers = sorted.filter(s => s.pnl < 0).slice(-3).reverse()

  // Expiration calendar
  const expiryDates = useMemo(() => {
    const map: Record<string, OptionPosition[]> = {}
    for (const p of positions) {
      if (!map[p.expiry]) map[p.expiry] = []
      map[p.expiry].push(p)
    }
    return Object.entries(map)
      .map(([date, pos]) => ({ date, positions: pos, days: daysToExpiry(date) }))
      .sort((a, b) => a.days - b.days)
  }, [positions])

  const RiskIcon = risk.level === 'safe' ? Shield : risk.level === 'caution' ? ShieldAlert : ShieldX
  const riskColor = risk.level === 'safe' ? 'var(--accent)' : risk.level === 'caution' ? 'var(--warning)' : 'var(--danger)'

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* Value Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-stagger">
        <MetricCard label="Portfolio Value" value={fmt(totalValue)} color="var(--text-primary)" />
        <MetricCard label="Unrealized P&L" value={fmt(unrealizedPnl)} color={unrealizedPnl >= 0 ? 'var(--accent)' : 'var(--danger)'} />
        <MetricCard label="Daily Theta" value={fmt(greeks.dollarTheta)} sub="per day" color={greeks.dollarTheta >= 0 ? 'var(--accent)' : 'var(--danger)'} />
        <MetricCard label="Nearest Expiry" value={`${nearestExpiry}d`} sub={`${positions.length} positions, ${tickers.length} tickers`} color="var(--warning)" />
      </div>

      {/* Risk Meter */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <RiskIcon className="w-5 h-5" style={{ color: riskColor }} />
          <h3 className="text-sm font-semibold" style={{ color: riskColor }}>
            Risk Level: {risk.level.toUpperCase()}
          </h3>
        </div>
        {/* Risk bar */}
        <div className="h-2 rounded-full bg-[var(--bg-elevated)] mb-3 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: risk.level === 'safe' ? '33%' : risk.level === 'caution' ? '66%' : '100%',
              backgroundColor: riskColor,
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          {risk.factors.map((f, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" style={{ color: riskColor }} />
              {f}
            </div>
          ))}
        </div>
      </div>

      {/* Winners & Losers + Greeks */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Winners */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Winners</h3>
          </div>
          {winners.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No winning positions</p>
          ) : (
            <div className="flex flex-col gap-2">
              {winners.map(w => (
                <div key={w.pos.id} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)]">
                    {w.pos.ticker} {w.pos.strike} {w.pos.optionType}
                  </span>
                  <span className="text-sm font-mono font-semibold text-[var(--accent)]">{fmt(w.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Losers */}
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-[var(--danger)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Top Losers</h3>
          </div>
          {losers.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)]">No losing positions</p>
          ) : (
            <div className="flex flex-col gap-2">
              {losers.map(l => (
                <div key={l.pos.id} className="flex items-center justify-between">
                  <span className="text-sm text-[var(--text-primary)]">
                    {l.pos.ticker} {l.pos.strike} {l.pos.optionType}
                  </span>
                  <span className="text-sm font-mono font-semibold text-[var(--danger)]">{fmt(l.pnl)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Greeks Summary */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Portfolio Greeks</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <GreekCard label="Dollar Delta" value={fmt(greeks.dollarDelta)} sub="per $1 stock move" />
          <GreekCard label="Dollar Theta" value={fmt(greeks.dollarTheta)} sub="per day" />
          <GreekCard label="Dollar Vega" value={fmt(greeks.dollarVega)} sub="per 1% IV" />
          <GreekCard label="Net Delta" value={greeks.delta.toFixed(2)} sub="contracts" />
        </div>
      </div>

      {/* Expiration Calendar */}
      <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-5">
        <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Upcoming Expirations</h3>
        <div className="flex flex-col gap-2">
          {expiryDates.map(({ date, positions: pos, days }) => {
            const hasShort = pos.some(p => p.quantity < 0)
            const urgent = days <= 7
            return (
              <div key={date} className={`flex items-center justify-between px-3 py-2 rounded-lg ${
                urgent ? 'bg-[var(--warning)]/5 border border-[var(--warning)]/15' : 'bg-[var(--bg-elevated)]'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                    urgent ? 'bg-[var(--warning)]/15 text-[var(--warning)]' : 'bg-[var(--border)] text-[var(--text-muted)]'
                  }`}>
                    {days}d
                  </span>
                  <div>
                    <span className="text-sm text-[var(--text-primary)]">{date}</span>
                    <span className="text-xs text-[var(--text-muted)] ml-2">
                      {pos.length} position{pos.length !== 1 ? 's' : ''}
                      {hasShort && <span className="text-[var(--warning)] ml-1">(has shorts)</span>}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {pos.map(p => (
                    <span key={p.id} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      p.quantity < 0 ? 'bg-[var(--danger)]/10 text-[var(--danger)]' : 'bg-[var(--accent)]/10 text-[var(--accent)]'
                    }`}>
                      {p.quantity > 0 ? '+' : ''}{p.quantity} {p.ticker} {p.strike}{p.optionType[0].toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl px-4 py-3">
      <div className="text-xs font-medium text-[var(--text-muted)] mb-1">{label}</div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{sub}</div>}
    </div>
  )
}

function GreekCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-[var(--text-muted)]">{label}</div>
      <div className="text-base font-bold font-mono text-[var(--text-primary)]">{value}</div>
      <div className="text-[10px] text-[var(--text-muted)]">{sub}</div>
    </div>
  )
}
