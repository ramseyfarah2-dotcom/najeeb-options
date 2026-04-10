'use client'

import { useState, useCallback } from 'react'
import { Search, Loader2, AlertCircle, RotateCcw } from 'lucide-react'

interface Step4ResearchProps {
  defaultTicker?: string
  allTickers: string[]
}

export default function Step4Research({ defaultTicker, allTickers }: Step4ResearchProps) {
  const [ticker, setTicker] = useState(defaultTicker ?? '')
  const [question, setQuestion] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runResearch = useCallback(async () => {
    const clean = ticker.trim().toUpperCase()
    if (!clean || !/^[A-Z]{1,6}$/.test(clean)) {
      setError('Enter a valid ticker symbol (1-6 letters)')
      return
    }

    setLoading(true)
    setError(null)
    setContent('')

    try {
      const response = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker: clean, question: question.trim() || undefined }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({ error: 'Server error' }))
        throw new Error(data.error || `Server returned ${response.status}`)
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setContent(prev => prev + decoder.decode(value))
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Research failed')
    } finally {
      setLoading(false)
    }
  }, [ticker, question])

  const reset = () => {
    setContent('')
    setError(null)
    setQuestion('')
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">Market Research</h2>
        <p className="text-[var(--text-muted)] text-sm mt-1">
          AI-powered deep dive using real-time web search.
        </p>
      </div>

      {/* Ticker quick-select */}
      {allTickers.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {allTickers.map(t => (
            <button key={t}
              onClick={() => { setTicker(t); reset() }}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition ${
                t === ticker.toUpperCase()
                  ? 'bg-[var(--accent)] text-[var(--bg-base)]'
                  : 'bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'
              }`}
            >{t}</button>
          ))}
        </div>
      )}

      {/* Inputs */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Ticker</label>
          <input
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
            value={ticker}
            onChange={e => setTicker(e.target.value.toUpperCase())}
            placeholder="AAPL"
            onKeyDown={e => e.key === 'Enter' && runResearch()}
          />
        </div>
        <div className="flex-[2]">
          <label className="text-xs font-medium text-[var(--text-muted)] mb-1 block">Custom Question (optional)</label>
          <input
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] text-sm focus:border-[var(--accent)] focus:outline-none"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="e.g. What's the earnings outlook?"
            onKeyDown={e => e.key === 'Enter' && runResearch()}
          />
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={runResearch}
          disabled={loading || !ticker.trim()}
          className="flex items-center gap-2 px-6 py-2.5 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition text-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? 'Searching the web...' : 'Get Briefing'}
        </button>
        {content && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2.5 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-elevated)] transition text-sm"
          >
            <RotateCcw className="w-4 h-4" /> Research Another
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg px-4 py-3 text-[var(--danger)] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Loading indicator */}
      {loading && !content && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[var(--accent)] mb-3" />
          <p className="text-[var(--text-muted)] text-sm">Searching the web for market intelligence...</p>
          <p className="text-[var(--text-muted)] text-xs mt-1">This may take 15-30 seconds</p>
        </div>
      )}

      {/* Streaming response */}
      {content && (
        <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl p-6">
          <pre className="whitespace-pre-wrap text-sm text-[var(--text-primary)] leading-relaxed font-[Inter,sans-serif]">
            {content}
          </pre>
        </div>
      )}
    </div>
  )
}
