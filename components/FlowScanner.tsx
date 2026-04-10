'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Radar, Loader2, RefreshCw, AlertCircle, Zap } from 'lucide-react'
import { usePortfolio } from '@/lib/context'

interface ScanResult {
  ticker: string
  content: string
  timestamp: number
  signal: 'bullish' | 'bearish' | 'neutral' | 'scanning'
}

export default function FlowScanner() {
  const { positions } = usePortfolio()
  const [results, setResults] = useState<ScanResult[]>([])
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customTickers, setCustomTickers] = useState('')
  const [streamingContent, setStreamingContent] = useState('')
  const [activeScanTickers, setActiveScanTickers] = useState<string[]>([])
  const radarRef = useRef<HTMLDivElement>(null)

  const positionTickers = [...new Set(positions.map(p => p.ticker).filter(Boolean))]

  const runScan = useCallback(async (tickers: string[]) => {
    if (tickers.length === 0 || scanning) return
    setScanning(true)
    setError(null)
    setStreamingContent('')
    setActiveScanTickers(tickers)

    // Add scanning placeholders
    setResults(tickers.map(t => ({ ticker: t, content: '', timestamp: Date.now(), signal: 'scanning' as const })))

    try {
      const res = await fetch('/api/options-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      })

      if (!res.ok) throw new Error('Scan failed')

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        fullContent += chunk
        setStreamingContent(fullContent)
      }

      // Parse the full response into per-ticker results
      const parsed = parseScanResults(fullContent, tickers)
      setResults(parsed)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
      setResults([])
    } finally {
      setScanning(false)
    }
  }, [scanning])

  const scanAll = () => {
    const all = customTickers.trim()
      ? customTickers.split(',').map(t => t.trim().toUpperCase()).filter(Boolean)
      : positionTickers
    runScan(all)
  }

  return (
    <div className="flex flex-col gap-5 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Radar className="w-6 h-6 text-[var(--accent)]" />
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">Options Flow Scanner</h2>
          </div>
          <p className="text-[var(--text-muted)] text-sm mt-1">
            AI scans the web for unusual options activity, smart money moves, and institutional flow
          </p>
        </div>
      </div>

      {/* Radar visualization */}
      <div ref={radarRef} className="relative glass rounded-2xl p-6 overflow-hidden">
        {/* Radar background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-20">
          <div className="w-64 h-64 rounded-full border border-[var(--accent)]" />
          <div className="absolute w-48 h-48 rounded-full border border-[var(--accent)]" />
          <div className="absolute w-32 h-32 rounded-full border border-[var(--accent)]" />
          <div className="absolute w-16 h-16 rounded-full border border-[var(--accent)]" />
          {/* Crosshairs */}
          <div className="absolute w-64 h-px bg-[var(--accent)]" />
          <div className="absolute w-px h-64 bg-[var(--accent)]" />
          {/* Sweep line */}
          {scanning && (
            <div className="absolute w-32 h-px bg-gradient-to-r from-transparent to-[var(--accent)] origin-left" style={{ animation: 'spin 3s linear infinite' }} />
          )}
        </div>

        {/* Ticker blips on radar */}
        <div className="relative z-10 flex flex-wrap gap-3 justify-center min-h-[120px] items-center">
          {activeScanTickers.length > 0 ? (
            activeScanTickers.map((ticker, i) => {
              const result = results.find(r => r.ticker === ticker)
              const signal = result?.signal || 'scanning'
              const colors = {
                bullish: 'bg-[var(--accent)] text-[var(--bg-base)] shadow-[var(--accent)]/30',
                bearish: 'bg-[var(--danger)] text-white shadow-[var(--danger)]/30',
                neutral: 'bg-[var(--warning)] text-[var(--bg-base)] shadow-[var(--warning)]/30',
                scanning: 'bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]',
              }
              return (
                <div key={ticker}
                  className={`px-4 py-2 rounded-xl font-mono font-bold text-sm shadow-lg transition-all ${colors[signal]} ${signal === 'scanning' ? 'animate-pulse' : 'animate-scaleIn'}`}
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="flex items-center gap-2">
                    {signal === 'scanning' && <Loader2 className="w-3 h-3 animate-spin" />}
                    {signal === 'bullish' && <span>🟢</span>}
                    {signal === 'bearish' && <span>🔴</span>}
                    {signal === 'neutral' && <span>🟡</span>}
                    {ticker}
                  </div>
                </div>
              )
            })
          ) : (
            <p className="text-[var(--text-muted)] text-sm">Select tickers and hit scan</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <input
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
            value={customTickers}
            onChange={e => setCustomTickers(e.target.value.toUpperCase())}
            placeholder={positionTickers.length > 0 ? `Your tickers: ${positionTickers.join(', ')}` : 'Enter tickers: AAPL, TSLA, NVDA'}
            onKeyDown={e => e.key === 'Enter' && scanAll()}
          />
        </div>
        <button
          onClick={scanAll}
          disabled={scanning}
          className="flex items-center justify-center gap-2 px-6 py-2.5 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition active:scale-95 disabled:opacity-50 text-sm whitespace-nowrap"
        >
          {scanning ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Scanning...</>
          ) : (
            <><Zap className="w-4 h-4" /> Scan Flow</>
          )}
        </button>
      </div>

      {/* Quick scan buttons */}
      {positionTickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <span className="text-xs text-[var(--text-muted)] self-center mr-1">Quick scan:</span>
          {positionTickers.map(t => (
            <button key={t} onClick={() => runScan([t])} disabled={scanning}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)] transition disabled:opacity-40"
            >{t}</button>
          ))}
          {positionTickers.length > 1 && (
            <button onClick={() => runScan(positionTickers)} disabled={scanning}
              className="px-3 py-1 rounded-lg text-xs font-semibold bg-[var(--accent)]/10 text-[var(--accent)] hover:bg-[var(--accent)]/20 transition disabled:opacity-40"
            >Scan All ({positionTickers.length})</button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg px-4 py-3 text-[var(--danger)] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}

      {/* Streaming results */}
      {(streamingContent || results.some(r => r.content)) && (
        <div className="glass rounded-2xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Radar className="w-4 h-4 text-[var(--accent)]" />
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">Flow Analysis</h3>
            {scanning && <Loader2 className="w-3 h-3 animate-spin text-[var(--accent)]" />}
          </div>
          <pre className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed font-[Inter,sans-serif]">
            {streamingContent || results.map(r => r.content).join('\n\n')}
          </pre>
        </div>
      )}
    </div>
  )
}

function parseScanResults(content: string, tickers: string[]): ScanResult[] {
  return tickers.map(ticker => {
    const lower = content.toLowerCase()
    const tickerLower = ticker.toLowerCase()

    // Try to detect sentiment from content
    let signal: 'bullish' | 'bearish' | 'neutral' = 'neutral'

    // Look for explicit signals near the ticker
    const tickerIdx = lower.indexOf(tickerLower)
    if (tickerIdx >= 0) {
      const nearby = lower.slice(Math.max(0, tickerIdx - 200), tickerIdx + 500)
      const bullishWords = (nearby.match(/bullish|🟢|calls? bought|call sweep|upside|accumulation/gi) || []).length
      const bearishWords = (nearby.match(/bearish|🔴|puts? bought|put sweep|downside|distribution/gi) || []).length
      if (bullishWords > bearishWords) signal = 'bullish'
      else if (bearishWords > bullishWords) signal = 'bearish'
    }

    return { ticker, content, timestamp: Date.now(), signal }
  })
}
