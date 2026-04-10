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
  const [paused, setPaused] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null)
  const speechQueueRef = useRef<string[]>([])
  const spokenSoFarRef = useRef('')
  const isSpeakingRef = useRef(false)
  const { positions, underlyingPrices } = usePortfolio()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && !listening) inputRef.current?.focus()
  }, [isOpen, listening])

  // Clean text for speech
  const cleanForSpeech = (text: string) => text
    .replace(/\*\*/g, '').replace(/#{1,4}\s/g, '').replace(/\[.*?\]\(.*?\)/g, '')
    .replace(/`/g, '').replace(/\n{2,}/g, '. ').replace(/\n/g, ' ')

  // Get a warm, kind voice
  const getVoice = useCallback(() => {
    if (typeof window === 'undefined') return null
    const voices = window.speechSynthesis.getVoices()
    // Prefer warm female voices
    return voices.find(v => v.name.includes('Samantha'))
      || voices.find(v => v.name.includes('Karen'))
      || voices.find(v => v.name.includes('Google UK English Female'))
      || voices.find(v => v.name.includes('Google US English') && !v.name.includes('Male'))
      || voices.find(v => v.name.includes('Microsoft Zira'))
      || voices.find(v => v.name.includes('Female') && v.lang.startsWith('en'))
      || voices.find(v => v.lang.startsWith('en'))
      || null
  }, [])

  // Speak a single sentence
  const speakSentence = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (!text.trim() || typeof window === 'undefined') { resolve(); return }
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.92
      utterance.pitch = 1.05  // Slightly higher = warmer/kinder
      utterance.volume = 1.0
      const voice = getVoice()
      if (voice) utterance.voice = voice
      utterance.onend = () => resolve()
      utterance.onerror = () => resolve()
      window.speechSynthesis.speak(utterance)
    })
  }, [getVoice])

  // Process speech queue — speaks sentences as they arrive
  const processSpeechQueue = useCallback(async () => {
    if (isSpeakingRef.current) return
    isSpeakingRef.current = true
    setSpeaking(true)

    while (speechQueueRef.current.length > 0) {
      const sentence = speechQueueRef.current.shift()!
      await speakSentence(sentence)
    }

    isSpeakingRef.current = false
    setSpeaking(false)
  }, [speakSentence])

  // Queue new text for speaking (called as streaming chunks arrive)
  const queueSpeech = useCallback((fullText: string) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) return
    const clean = cleanForSpeech(fullText)
    const alreadySpoken = spokenSoFarRef.current
    const newText = clean.slice(alreadySpoken.length)

    // Split on sentence boundaries
    const sentenceEnders = /(?<=[.!?])\s+/
    const parts = newText.split(sentenceEnders)

    // Only queue complete sentences (keep the last incomplete part for later)
    if (parts.length > 1) {
      const completeSentences = parts.slice(0, -1)
      for (const s of completeSentences) {
        if (s.trim()) speechQueueRef.current.push(s.trim())
      }
      spokenSoFarRef.current = clean.slice(0, clean.length - parts[parts.length - 1].length)
      processSpeechQueue()
    }
  }, [voiceEnabled, processSpeechQueue])

  // Flush remaining text when streaming is done
  const flushSpeech = useCallback((fullText: string) => {
    if (!voiceEnabled || typeof window === 'undefined') return
    const clean = cleanForSpeech(fullText)
    const remaining = clean.slice(spokenSoFarRef.current.length).trim()
    if (remaining) {
      speechQueueRef.current.push(remaining)
      processSpeechQueue()
    }
    spokenSoFarRef.current = ''
  }, [voiceEnabled, processSpeechQueue])

  // Pause / Resume
  const togglePause = useCallback(() => {
    if (!window.speechSynthesis) return
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume()
      setPaused(false)
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause()
      setPaused(true)
    }
  }, [])

  // Stop all speech
  const stopSpeech = useCallback(() => {
    speechQueueRef.current = []
    spokenSoFarRef.current = ''
    isSpeakingRef.current = false
    window.speechSynthesis?.cancel()
    setSpeaking(false)
    setPaused(false)
  }, [])

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
    spokenSoFarRef.current = ''
    speechQueueRef.current = []

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
        // Stream speech as sentences complete
        queueSpeech(fullResponse)
      }

      // Flush any remaining unspoken text
      flushSpeech(fullResponse)
    } catch (err) {
      const errorMsg = `Error: ${err instanceof Error ? err.message : 'Something went wrong'}`
      setMessages(prev =>
        prev.map(m => m.id === assistantMsg.id ? { ...m, content: errorMsg } : m)
      )
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, positions, underlyingPrices, queueSpeech, flushSpeech])

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
                  {paused ? '⏸ Paused' : speaking ? '🔊 Speaking...' : listening ? '🎤 Listening...' : loading ? '🤔 Thinking...' : 'Your trading assistant'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Pause/Resume when speaking */}
              {speaking && (
                <button
                  onClick={togglePause}
                  className="p-1.5 rounded-lg text-[var(--accent)] hover:bg-[var(--accent)]/10 transition"
                  title={paused ? 'Resume' : 'Pause'}
                >
                  {paused ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  )}
                </button>
              )}
              {/* Stop speaking */}
              {speaking && (
                <button
                  onClick={stopSpeech}
                  className="p-1.5 rounded-lg text-[var(--danger)] hover:bg-[var(--danger)]/10 transition"
                  title="Stop speaking"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>
                </button>
              )}
              {/* Mute toggle */}
              <button
                onClick={() => { setVoiceEnabled(!voiceEnabled); if (speaking) stopSpeech() }}
                className={`p-1.5 rounded-lg transition ${voiceEnabled ? 'text-[var(--accent)] hover:bg-[var(--accent)]/10' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}
                title={voiceEnabled ? 'Mute voice' : 'Enable voice'}
              >
                {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>
              {/* Close */}
              <button onClick={() => { setIsOpen(false); stopSpeech() }} className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] transition">
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
