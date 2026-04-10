'use client'

import { useState } from 'react'
import { Trash2, Plus, Check, Pencil, AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react'
import type { OptionPosition } from '@/types'

interface Step2ReviewProps {
  positions: OptionPosition[]
  onPositionsUpdated: (positions: OptionPosition[]) => void
  onBack: () => void
  onNext: () => void
}

export default function Step2Review({ positions, onPositionsUpdated, onBack, onNext }: Step2ReviewProps) {
  const [validationErrors, setValidationErrors] = useState<string[]>([])

  const update = (id: string, field: keyof OptionPosition, value: unknown) => {
    onPositionsUpdated(positions.map(p => p.id === id ? { ...p, [field]: value } : p))
  }

  const remove = (id: string) => {
    onPositionsUpdated(positions.filter(p => p.id !== id))
  }

  const addRow = () => {
    onPositionsUpdated([...positions, {
      id: crypto.randomUUID(),
      ticker: '',
      optionType: 'call',
      strike: 0,
      expiry: '',
      quantity: 1,
      avgCost: 0,
      currentPrice: 0,
      iv: null,
      underlyingPrice: null,
      contractSize: 100,
    }])
  }

  const validate = () => {
    const errors: string[] = []
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i]
      const label = `Row ${i + 1} (${p.ticker || '?'})`
      if (!p.ticker) errors.push(`${label}: Missing ticker`)
      if (p.strike <= 0) errors.push(`${label}: Strike must be > 0`)
      if (p.quantity === 0) errors.push(`${label}: Quantity cannot be 0`)
      if (!p.underlyingPrice) errors.push(`${label}: Missing stock price`)
      if (!p.expiry) errors.push(`${label}: Missing expiry date`)
      if (p.iv !== null && (p.iv < 0.01 || p.iv > 5.0)) {
        errors.push(`${label}: IV must be between 1% and 500%`)
      }
    }
    setValidationErrors(errors)
    if (errors.length === 0) onNext()
  }

  const getAssignmentRisk = (p: OptionPosition): string | null => {
    if (p.quantity >= 0 || !p.underlyingPrice) return null
    const daysLeft = Math.round((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    if (daysLeft > 7) return null
    const itm = p.optionType === 'call'
      ? p.underlyingPrice > p.strike
      : p.underlyingPrice < p.strike
    if (!itm) return null
    return `ITM short ${p.optionType}, ${daysLeft}d to expiry`
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Review Positions</h2>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          All prices are per-share (Questrade convention). Negative quantity = short.
        </p>
      </div>

      <div className="overflow-x-auto border border-[var(--border)] rounded-xl">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Ticker</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Type</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Strike</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Expiry</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Qty</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Avg Cost</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Current</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">IV %</th>
              <th className="px-3 py-3 text-left text-xs font-medium text-[var(--text-muted)]">Stock $</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map(pos => {
              const risk = getAssignmentRisk(pos)
              return (
                <tr key={pos.id} className="border-b border-[var(--border)] hover:bg-[var(--bg-elevated)]/50 transition">
                  <td className="px-3 py-2">
                    <input
                      className="w-20 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                      value={pos.ticker}
                      onChange={e => update(pos.id, 'ticker', e.target.value.toUpperCase())}
                      placeholder="AAPL"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none"
                      value={pos.optionType}
                      onChange={e => update(pos.id, 'optionType', e.target.value)}
                    >
                      <option value="call">Call</option>
                      <option value="put">Put</option>
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-20 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                      type="number" step="0.5" value={pos.strike || ''}
                      onChange={e => update(pos.id, 'strike', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none"
                      type="date" value={pos.expiry}
                      onChange={e => update(pos.id, 'expiry', e.target.value)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className={`w-16 bg-[var(--bg-elevated)] border rounded px-2 py-1.5 font-mono text-sm focus:outline-none ${
                        pos.quantity < 0 ? 'border-[var(--danger)]/40 text-[var(--danger)] focus:border-[var(--danger)]' : 'border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)]'
                      }`}
                      type="number" step="1" value={pos.quantity}
                      onChange={e => update(pos.id, 'quantity', parseInt(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-20 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                      type="number" step="0.01" value={pos.avgCost || ''}
                      onChange={e => update(pos.id, 'avgCost', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-20 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                      type="number" step="0.01" value={pos.currentPrice || ''}
                      onChange={e => update(pos.id, 'currentPrice', parseFloat(e.target.value) || 0)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      className="w-16 bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text-primary)] font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                      type="number" step="0.1"
                      value={pos.iv !== null ? (pos.iv * 100).toFixed(1) : ''}
                      placeholder="auto"
                      onChange={e => {
                        const val = parseFloat(e.target.value)
                        update(pos.id, 'iv', isNaN(val) ? null : val / 100)
                      }}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1">
                      <input
                        className={`w-20 bg-[var(--bg-elevated)] border rounded px-2 py-1.5 font-mono text-sm focus:outline-none ${
                          pos.underlyingPrice ? 'border-[var(--border)] text-[var(--text-primary)] focus:border-[var(--accent)]' : 'border-[var(--danger)]/40 text-[var(--danger)] focus:border-[var(--danger)]'
                        }`}
                        type="number" step="0.01"
                        value={pos.underlyingPrice || ''}
                        onChange={e => update(pos.id, 'underlyingPrice', parseFloat(e.target.value) || null)}
                      />
                      {pos.underlyingPrice ? (
                        <Check className="w-3.5 h-3.5 text-[var(--accent)]" />
                      ) : (
                        <Pencil className="w-3.5 h-3.5 text-[var(--danger)]" />
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => remove(pos.id)} className="p-1.5 rounded hover:bg-[var(--danger)]/10 text-[var(--text-muted)] hover:text-[var(--danger)] transition">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Assignment risk warnings */}
      {positions.some(p => getAssignmentRisk(p)) && (
        <div className="flex flex-col gap-1 bg-[var(--warning)]/5 border border-[var(--warning)]/20 rounded-lg px-4 py-3">
          {positions.map(pos => {
            const risk = getAssignmentRisk(pos)
            if (!risk) return null
            return (
              <div key={pos.id} className="flex items-center gap-2 text-sm text-[var(--warning)]">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{pos.ticker} {pos.strike} {pos.optionType}: {risk}</span>
              </div>
            )
          })}
        </div>
      )}

      {validationErrors.length > 0 && (
        <div className="flex flex-col gap-1 bg-[var(--danger)]/5 border border-[var(--danger)]/20 rounded-lg px-4 py-3">
          {validationErrors.map((err, i) => (
            <div key={i} className="text-sm text-[var(--danger)]">{err}</div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex gap-3">
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-elevated)] transition text-sm">
            <ArrowLeft className="w-4 h-4" /> Re-import
          </button>
          <button onClick={addRow} className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-elevated)] transition text-sm">
            <Plus className="w-4 h-4" /> Add Row
          </button>
        </div>
        <button
          onClick={validate}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition text-sm"
        >
          Run Analysis <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
