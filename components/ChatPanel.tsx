'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { X, Send, Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { usePortfolio } from '@/lib/context'
import { portfolioGreeks } from '@/lib/greeks'
import type { ChatMessage } from '@/types'

function serializePortfolio(positions: Parameters<typeof portfolioGreeks>[0], prices: Record<string, number>): string {
  if (positions.length === 0) return 'No positions loaded.'
  const tickers = [...new Set(positions.map(p => p.ticker))]
  const greeks = portfolioGreeks(positions, prices)
  let totalPnl = 0
  const lines: string[] = [`Portfolio: ${positions.length} positions across ${tickers.join(', ')}`]
  for (const p of positions) {
    const pnl = (p.currentPrice - p.avgCost) * p.quantity * p.contractSize
    totalPnl += pnl
    const dte = Math.max(0, Math.round((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    lines.push(`- ${p.quantity > 0 ? 'Long' : 'Short'} ${Math.abs(p.quantity)} ${p.ticker} ${p.strike} ${p.optionType} exp ${p.expiry} (${dte}d) | avg $${p.avgCost} | now $${p.currentPrice} | stock $${p.underlyingPrice ?? '?'} | IV ${p.iv ? (p.iv * 100).toFixed(1) + '%' : '?'} | P&L $${pnl.toFixed(2)}`)
  }
  lines.push(`\nTotal P&L: $${totalPnl.toFixed(2)} | $ Delta: $${greeks.dollarDelta.toFixed(2)} | $ Theta: $${greeks.dollarTheta.toFixed(2)}/day | $ Vega: $${greeks.dollarVega.toFixed(2)}`)
  return lines.join('\n')
}

function BullFace({ speaking, listening, className }: { speaking: boolean; listening: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none">
      {/* Horns */}
      <path d="M14 18C10 10 4 8 2 10C4 14 8 16 14 22" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      <path d="M50 18C54 10 60 8 62 10C60 14 56 16 50 22" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
      {/* Head */}
      <ellipse cx="32" cy="32" rx="18" ry="16" fill="white" opacity="0.95"/>
      {/* Ears */}
      <ellipse cx="14" cy="24" rx="4" ry="6" fill="white" opacity="0.9" transform="rotate(-15 14 24)"/>
      <ellipse cx="50" cy="24" rx="4" ry="6" fill="white" opacity="0.9" transform="rotate(15 50 24)"/>
      {/* Eyes - blink when listening */}
      {listening ? (
        <>
          <line x1="21" y1="28" x2="27" y2="28" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
          <line x1="37" y1="28" x2="43" y2="28" stroke="#1a1a2e" strokeWidth="2" strokeLinecap="round"/>
        </>
      ) : (
        <>
          <circle cx="24" cy="28" r="3" fill="#1a1a2e"/>
          <circle cx="40" cy="28" r="3" fill="#1a1a2e"/>
          <circle cx="25" cy="27" r="1" fill="white"/>
          <circle cx="41" cy="27" r="1" fill="white"/>
        </>
      )}
      {/* Nostrils */}
      <ellipse cx="28" cy="38" rx="2.5" ry="2" fill="#1a1a2e" opacity="0.3"/>
      <ellipse cx="36" cy="38" rx="2.5" ry="2" fill="#1a1a2e" opacity="0.3"/>
      {/* Mouth - animates when speaking */}
      {speaking ? (
        <ellipse cx="32" cy="44" rx="5" ry="3.5" fill="#1a1a2e" opacity="0.4">
          <animate attributeName="ry" values="3.5;2;3.5;4;3.5" dur="0.3s" repeatCount="indefinite"/>
          <animate attributeName="rx" values="5;4;5;6;5" dur="0.4s" repeatCount="indefinite"/>
        </ellipse>
      ) : (
        <path d="M26 42C28 45 36 45 38 42" stroke="#1a1a2e" strokeWidth="1.5" strokeLinecap="round" fill="none" opacity="0.5"/>
      )}
      {/* Listening indicator - sound waves near ears */}
      {listening && (
        <>
          <path d="M6 20C4 22 4 26 6 28" stroke="#00c896" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite"/>
          </path>
          <path d="M58 20C60 22 60 26 58 28" stroke="#00c896" strokeWidth="1.5" strokeLinecap="round" opacity="0.6">
            <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1s" repeatCount="indefinite" begin="0.5s"/>
          </path>
        </>
      )}
    </svg>
  )
}

export default function ChatPanel() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [listening, setListening] = useState(false)
  const [speaking, setSpeaking] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const { positions, underlyingPrices } = usePortfolio()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && !listening) inputRef.current?.focus()
  }, [isOpen, listening])

  // Text-to-speech
  const speak = useCallback((text: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    // Clean markdown-like formatting for speech
    const clean = text
      .replace(/\*\*/g, '')
      .replace(/#{1,4}\s/g, '')
      .replace(/\[.*?\]\(.*?\)/g, '')
      .replace(/`/g, '')
      .slice(0, 2000) // Limit length

    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 0.95
    utterance.pitch = 0.9

    // Try to get a good voice
    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find(v => v.name.includes('Google') && v.lang.startsWith('en'))
      || voices.find(v => v.name.includes('Samantha'))
      || voices.find(v => v.lang.startsWith('en') && v.localService)
    if (preferred) utterance.voice = preferred

    utterance.onstart = () => setSpeaking(true)
    utterance.onend = () => setSpeaking(false)
    utterance.onerror = () => setSpeaking(false)

    window.speechSynthesis.speak(utterance)
  }, [voiceEnabled])

  // Speech recognition
  const startListening = useCallback(() => {
    if (typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setInput('Voice not supported in this browser')
      return
    }

    // Stop any current speech
    window.speechSynthesis?.cancel()
    setSpeaking(false)

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join('')
      setInput(transcript)

      // Auto-send on final result
      if (event.results[event.results.length - 1].isFinal) {
        setTimeout(() => {
          setListening(false)
        }, 300)
      }
    }

    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  // Send message (text or voice)
  const sendMessage = useCallback(async (overrideText?: string) => {
    const text = (overrideText || input).trim()
    if (!text || loading) return

    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, timestamp: Date.now() }
    const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: 'assistant', content: '', timestamp: Date.now() }

    setMessages(prev => [...prev, userMsg, assistantMsg])
    setInput('')
    setLoading(true)

    let fullResponse = ''

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
        fullResponse += chunk
        setMessages(prev =>
          prev.map(m => m.id === assistantMsg.id ? { ...m, content: m.content + chunk } : m)
        )
      }

      // Speak the response
      if (voiceEnabled && fullResponse) {
        speak(fullResponse)
      }
    } catch (err) {
      const errorMsg = `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id ? { ...m, content: errorMsg } : m)
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, positions, underlyingPrices, voiceEnabled, speak])

  // Auto-send after voice input finishes
  const prevListening = useRef(listening)
  useEffect(() => {
    if (prevListening.current && !listening && input.trim()) {
      sendMessage(input.trim())
    }
    prevListening.current = listening
  }, [listening])

  return (
    <>
      {/* Bull mascot FAB */}
      {!isOpen && (
        <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end gap-2">
          {/* Speech bubble */}
          <div className="glass rounded-xl px-3 py-2 text-xs font-medium text-[var(--text-primary)] animate-fadeIn shadow-lg max-w-[180px] text-center relative">
            Tap me to chat — or use your voice!
            <div className="absolute -bottom-1.5 right-6 w-3 h-3 glass rotate-45" />
          </div>
          {/* Bull button */}
          <button
            onClick={() => setIsOpen(true)}
            className="group w-16 h-16 rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-700 text-white flex items-center justify-center shadow-xl hover:shadow-2xl hover:scale-105 transition-all active:scale-95 relative"
          >
            <BullFace speaking={false} listening={false} className="w-10 h-10" />
            <span className="absolute inset-0 rounded-full border-2 border-[var(--accent)] animate-ping opacity-20" />
          </button>
        </div>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 sm:w-[420px] sm:h-[600px] flex flex-col bg-[var(--bg-surface)] sm:rounded-2xl sm:border sm:border-[var(--border)] sm:shadow-2xl animate-slideUp">
          {/* Header with animated bull */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-700 flex items-center justify-center transition-all ${speaking ? 'shadow-lg shadow-[var(--accent)]/30 scale-105' : ''} ${listening ? 'shadow-lg shadow-blue-500/30 scale-105' : ''}`}>
                <BullFace speaking={speaking} listening={listening} className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Wall St. Bull</p>
                <p className="text-[10px] text-[var(--text-muted)]">
                  {speaking ? '🔊 Speaking...' : listening ? '🎤 Listening...' : loading ? '🤔 Thinking...' : 'Your trading assistant'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setVoiceEnabled(!voiceEnabled); if (speaking) { window.speechSynthesis?.cancel(); setSpeaking(false) } }}
                className={`p-1.5 rounded-lg transition ${voiceEnabled ? 'text-[var(--accent)] hover:bg-[var(--accent)]/10' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}
                title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              <button onClick={() => { setIsOpen(false); window.speechSynthesis?.cancel(); setSpeaking(false) }} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] transition">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
            {messages.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-6">
                <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-[var(--accent)] to-emerald-700 flex items-center justify-center ${speaking ? 'animate-pulse' : ''}`}>
                  <BullFace speaking={speaking} listening={listening} className="w-12 h-12" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Hey Najeeb!</p>
                  <p className="text-xs text-[var(--text-muted)] mt-1">Ask me anything — type or tap the mic</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['What\'s my biggest risk?', 'Explain my theta', 'Should I close anything?'].map(q => (
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
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" />
                      <span className="text-xs text-[var(--text-muted)]">Thinking...</span>
                    </div>
                  ) : null)}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input with voice button */}
          <div className="px-4 py-3 border-t border-[var(--border)]">
            {listening && (
              <div className="flex items-center justify-center gap-2 mb-2 py-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="w-1 bg-[var(--accent)] rounded-full" style={{
                      height: `${12 + Math.random() * 16}px`,
                      animation: `pulse 0.5s ease-in-out ${i * 0.1}s infinite alternate`,
                    }} />
                  ))}
                </div>
                <span className="text-xs text-[var(--accent)] font-medium">Listening...</span>
              </div>
            )}
            <div className="flex gap-2">
              {/* Mic button */}
              <button
                onClick={listening ? stopListening : startListening}
                disabled={loading}
                className={`px-3 py-2.5 rounded-lg transition active:scale-95 ${
                  listening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--border)]'
                }`}
                title={listening ? 'Stop listening' : 'Speak to the bull'}
              >
                {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                ref={inputRef}
                className="flex-1 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:outline-none"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder={listening ? 'Listening...' : 'Type or tap the mic...'}
                disabled={loading || listening}
              />
              <button
                onClick={() => sendMessage()}
                disabled={loading || !input.trim() || listening}
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
