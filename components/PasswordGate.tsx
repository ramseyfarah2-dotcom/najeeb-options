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

interface RainDrop {
  id: number
  ticker: string
  price: string
  changeStr: string
  isUp: boolean
  left: number    // % from left
  delay: number   // animation delay in seconds
  duration: number // animation duration in seconds
  size: number    // font size multiplier
}

function TickerRain() {
  const drops = useMemo(() => {
    const d: RainDrop[] = []
    for (let i = 0; i < 30; i++) {
      const t = generateTicker()
      d.push({
        id: i,
        ...t,
        left: Math.random() * 95,
        delay: Math.random() * 20,
        duration: 15 + Math.random() * 20,
        size: 0.6 + Math.random() * 0.4,
      })
    }
    return d
  }, [])

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {drops.map(drop => (
        <div
          key={drop.id}
          className="absolute whitespace-nowrap font-mono"
          style={{
            left: `${drop.left}%`,
            fontSize: `${drop.size * 12}px`,
            color: drop.isUp ? 'rgba(0, 200, 150, 0.35)' : 'rgba(244, 63, 94, 0.30)',
            animation: `tickerFall ${drop.duration}s linear ${drop.delay}s infinite`,
          }}
        >
          <span className="font-semibold">{drop.ticker}</span>{' '}
          <span>{drop.price}</span>{' '}
          <span>{drop.changeStr}</span>
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
      {/* Ticker rain background */}
      <TickerRain />

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
