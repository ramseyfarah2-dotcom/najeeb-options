'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2 } from 'lucide-react'
import { usePortfolio } from '@/lib/context'
import { portfolioGreeks } from '@/lib/greeks'
import type { ChatMessage } from '@/types'

function serializePortfolio(positions: Parameters<typeof portfolioGreeks>[0], prices: Record<string, number>): string {
  if (positions.length === 0) return 'No positions loaded.'

  const tickers = [...new Set(positions.map(p => p.ticker))]
  const greeks = portfolioGreeks(positions, prices)

  let totalPnl = 0
  const lines: string[] = []
  lines.push(`Portfolio: ${positions.length} positions across ${tickers.join(', ')}`)

  for (const p of positions) {
    const pnl = (p.currentPrice - p.avgCost) * p.quantity * p.contractSize
    totalPnl += pnl
    const dte = Math.max(0, Math.round((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    lines.push(
      `- ${p.quantity > 0 ? 'Long' : 'Short'} ${Math.abs(p.quantity)} ${p.ticker} ${p.strike} ${p.optionType} exp ${p.expiry} (${dte}d) | avg $${p.avgCost} | now $${p.currentPrice} | stock $${p.underlyingPrice ?? '?'} | IV ${p.iv ? (p.iv * 100).toFixed(1) + '%' : '?'} | P&L $${pnl.toFixed(2)}`
    )
  }

  lines.push(`\nTotal unrealized P&L: $${totalPnl.toFixed(2)}`)
  lines.push(`Net Dollar Delta: $${greeks.dollarDelta.toFixed(2)} per $1 move`)
  lines.push(`Daily Theta: $${greeks.dollarTheta.toFixed(2)} per day`)
  lines.push(`Dollar Vega: $${greeks.dollarVega.toFixed(2)} per 1% IV change`)

  return lines.join('\n')
}

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { positions, underlyingPrices } = usePortfolio()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now() }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    try {
      const portfolioContext = serializePortfolio(positions, underlyingPrices)
      const history = messages.map(m => ({ role: m.role, content: m.content }))

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, portfolioContext, history }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed' }))
        throw new Error(err.error || 'Chat failed')
      }

      const reader = response.body!.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev =>
          prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m)
        )
      }
    } catch (err) {
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id
          ? { ...m, content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}` }
          : m
        )
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, positions, underlyingPrices])

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 w-14 h-14 rounded-full bg-[var(--accent)] text-[var(--bg-base)] flex items-center justify-center shadow-lg hover:brightness-110 transition active:scale-95"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[420px] sm:h-[560px] flex flex-col bg-[var(--bg-surface)] sm:rounded-2xl sm:border sm:border-[var(--border)] sm:shadow-2xl animate-slideUp">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[var(--accent)]/15 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-[var(--accent)]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">AI Assistant</p>
                <p className="text-[10px] text-[var(--text-muted)]">Ask about your positions</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] transition">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-8">
                <p className="text-sm text-[var(--text-muted)]">Ask me anything about your portfolio</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['What\'s my biggest risk?', 'Explain my theta', 'Any positions I should close?'].map(q => (
                    <button key={q}
                      onClick={() => { setInput(q); inputRef.current?.focus() }}
                      className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] hover:bg-[var(--bg-elevated)] transition"
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-[var(--bg-base)]'
                    : 'bg-[var(--bg-elevated)] text-[var(--text-primary)]'
                }`}>
                  {msg.content || (loading && msg.role === 'assistant' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[var(--border)]">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Ask about your positions..."
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="px-3 py-2.5 bg-[var(--accent)] text-[var(--bg-base)] rounded-lg hover:brightness-110 transition active:scale-95 disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
