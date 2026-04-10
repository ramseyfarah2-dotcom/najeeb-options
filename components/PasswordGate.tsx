'use client'

import { useState, useEffect, useMemo, createContext, useContext } from 'react'
import { Lock, ArrowRight } from 'lucide-react'

const AuthContext = createContext<{ logout: () => void }>({ logout: () => {} })
export function useAuth() { return useContext(AuthContext) }

interface PasswordGateProps {
  children: React.ReactNode
}

const PASSCODE = process.env.NEXT_PUBLIC_PASSCODE || 'najeeb2026'

const TICKERS = [
  'AAPL', 'TSLA', 'MSFT', 'GOOG', 'AMZN', 'META', 'NVDA', 'JPM', 'V', 'MA',
  'NFLX', 'DIS', 'BABA', 'AMD', 'INTC', 'CRM', 'PYPL', 'SQ', 'SHOP', 'UBER',
  'COIN', 'PLTR', 'SNOW', 'NET', 'DDOG', 'ZS', 'CRWD', 'MDB', 'ABNB', 'RIVN',
  'BA', 'GS', 'MS', 'WMT', 'HD', 'NKE', 'SBUX', 'KO', 'PEP', 'MCD',
  'XOM', 'CVX', 'PFE', 'JNJ', 'UNH', 'LLY', 'ABBV', 'TMO', 'COST', 'TGT',
]

function generateTicker() {
  const ticker = TICKERS[Math.floor(Math.random() * TICKERS.length)]
  const basePrice = 50 + Math.random() * 450
  const price = basePrice.toFixed(2)
  const change = (Math.random() - 0.45) * 8 // Slight bullish bias
  const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`
  const isUp = change >= 0
  return { ticker, price, changeStr, isUp }
}

interface TickerRow {
  id: number
  items: { ticker: string; price: string; changeStr: string; isUp: boolean }[]
  top: number       // % from top
  duration: number  // scroll duration
  reverse: boolean  // scroll direction
  opacity: number
}

function TickerTape() {
  const rows = useMemo(() => {
    const r: TickerRow[] = []
    const rowCount = 8
    for (let i = 0; i < rowCount; i++) {
      const items = []
      for (let j = 0; j < 12; j++) items.push(generateTicker())
      // Rows closer to center are more visible
      const distFromCenter = Math.abs(i - (rowCount - 1) / 2) / ((rowCount - 1) / 2)
      const opacity = 0.55 + (1 - distFromCenter) * 0.25
      r.push({
        id: i,
        items,
        top: 8 + (i * 84) / (rowCount - 1),
        duration: 40 + Math.random() * 30,
        reverse: i % 2 === 1,
        opacity,
      })
    }
    return r
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {rows.map(row => (
        <div
          key={row.id}
          className="absolute whitespace-nowrap font-mono flex gap-8"
          style={{
            top: `${row.top}%`,
            opacity: row.opacity,
            animation: `${row.reverse ? 'tickerScrollRight' : 'tickerScrollLeft'} ${row.duration}s linear infinite`,
          }}
        >
          {/* Duplicate items for seamless loop */}
          {[...row.items, ...row.items].map((item, j) => (
            <span key={j} className="inline-flex items-center gap-1.5 text-[11px]"
              style={{ color: item.isUp ? 'rgba(0, 200, 150, 0.85)' : 'rgba(244, 63, 94, 0.75)' }}
            >
              <span className="font-semibold">{item.ticker}</span>
              <span>{item.price}</span>
              <span className="text-[10px]">{item.changeStr}</span>
              <span className="mx-2 text-white/20">|</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function PasswordGate({ children }: PasswordGateProps) {
  const [unlocked, setUnlocked] = useState(() => {
    if (typeof window === 'undefined') return false
    return sessionStorage.getItem('na-unlocked') === '1'
  })
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  const submit = () => {
    if (input.trim() === PASSCODE) {
      sessionStorage.setItem('na-unlocked', '1')
      setUnlocked(true)
    } else {
      setError(true)
      setTimeout(() => setError(false), 1500)
    }
  }

  const logout = () => {
    sessionStorage.removeItem('na-unlocked')
    setUnlocked(false)
    setInput('')
  }

  if (unlocked) {
    return <AuthContext.Provider value={{ logout }}>{children}</AuthContext.Provider>
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#060608] px-4 relative overflow-hidden">
      {/* Ticker tape background */}
      <TickerTape />

      {/* Gradient overlay for depth */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#060608]/60 to-[#060608]" />

      {/* Login card with glass effect */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6 animate-fadeIn glass rounded-2xl px-8 py-10">
        <div className="w-14 h-14 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl flex items-center justify-center">
          <Lock className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Welcome, Najeeb</h1>
          <p className="text-sm text-[#71717a] mt-1">Enter your passcode to continue</p>
        </div>
        <div className="w-full flex flex-col gap-3">
          <input
            type="password"
            className={`w-full bg-white/5 border rounded-lg px-4 py-3 text-center text-lg font-mono tracking-widest text-white focus:outline-none transition ${
              error ? 'border-[#f43f5e]' : 'border-white/10 focus:border-[#00c896]'
            }`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="••••••"
            autoFocus
          />
          <button
            onClick={submit}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#00c896] text-[#060608] font-semibold rounded-lg hover:brightness-110 transition active:scale-[0.97]"
          >
            Enter <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <p className="text-sm text-[#f43f5e]">Wrong passcode</p>
        )}
      </div>
    </div>
  )
}
