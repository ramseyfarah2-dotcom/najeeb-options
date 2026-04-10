'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import PasswordGate, { useAuth } from '@/components/PasswordGate'
import QuoteBanner from '@/components/QuoteBanner'
import NavBar from '@/components/NavBar'
import ThemeToggle from '@/components/ThemeToggle'
import ImportWizard from '@/components/ImportWizard'
import Dashboard from '@/components/Dashboard'
import Watchlist from '@/components/Watchlist'
import Simulator from '@/components/Simulator'
import TradeIdeas from '@/components/TradeIdeas'
import ChatPanel from '@/components/ChatPanel'
import { ToastProvider, useToast } from '@/components/Toasts'
import { PortfolioContext } from '@/lib/context'
import { bjerksundStensland } from '@/lib/blackScholes'
import type { OptionPosition, ActiveView } from '@/types'
import { RefreshCw, Clock, LogOut } from 'lucide-react'

function loadSavedPositions(): OptionPosition[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem('na-positions')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function savePositions(positions: OptionPosition[]) {
  localStorage.setItem('na-positions', JSON.stringify(positions))
  localStorage.setItem('na-positions-saved-at', new Date().toISOString())
}

function getSavedAt(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('na-positions-saved-at')
}

export default function Home() {
  return (
    <PasswordGate>
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </PasswordGate>
  )
}

function AppInner() {
  const { logout } = useAuth()
  const [activeView, setActiveView] = useState<ActiveView>('import')
  const [positions, setPositions] = useState<OptionPosition[]>([])
  const [lastSaved, setLastSaved] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load saved positions on mount
  useEffect(() => {
    const saved = loadSavedPositions()
    if (saved.length > 0) {
      setPositions(saved)
      setActiveView('dashboard')
    }
    setLastSaved(getSavedAt())
    setLoaded(true)
  }, [])

  // Wrap setPositions to also persist
  const updatePositions = useCallback((newPositions: OptionPosition[] | ((prev: OptionPosition[]) => OptionPosition[])) => {
    setPositions(prev => {
      const next = typeof newPositions === 'function' ? newPositions(prev) : newPositions
      savePositions(next)
      setLastSaved(new Date().toISOString())
      return next
    })
  }, [])

  // Refresh stock prices and recalculate option values
  const refreshPrices = useCallback(async () => {
    if (positions.length === 0) return
    setRefreshing(true)
    try {
      const tickers = [...new Set(positions.map(p => p.ticker).filter(Boolean))]
      const res = await fetch('/api/stock-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tickers }),
      })
      if (!res.ok) return
      const { prices } = await res.json()

      setPositions(prev => {
        const updated = prev.map(p => {
          const data = prices[p.ticker]
          if (!data?.price) return p

          const newUnderlyingPrice = data.price
          const iv = p.iv ?? 0.30
          const dte = Math.max(0, Math.round((new Date(p.expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          const T = dte / 365

          // Recalculate theoretical option price using current stock price
          let newOptionPrice = p.currentPrice
          if (T > 0 && p.strike > 0 && iv > 0) {
            newOptionPrice = bjerksundStensland(
              newUnderlyingPrice, p.strike, T, 0.045, 0, iv, p.optionType
            )
            newOptionPrice = Math.round(newOptionPrice * 100) / 100
          } else if (T <= 0) {
            // Expired — intrinsic only
            newOptionPrice = p.optionType === 'call'
              ? Math.max(0, newUnderlyingPrice - p.strike)
              : Math.max(0, p.strike - newUnderlyingPrice)
          }

          return { ...p, underlyingPrice: newUnderlyingPrice, currentPrice: newOptionPrice }
        })
        savePositions(updated)
        setLastSaved(new Date().toISOString())
        return updated
      })
    } catch { /* silent */ }
    finally { setRefreshing(false) }
  }, [positions])

  // Auto-refresh prices on load (if positions exist) and every 60 seconds
  useEffect(() => {
    if (!loaded || positions.length === 0) return

    // Refresh on load
    refreshPrices()

    // Refresh every 60 seconds
    intervalRef.current = setInterval(refreshPrices, 60_000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [loaded, positions.length > 0]) // only re-setup when positions go from 0 to >0

  const underlyingPrices = useMemo(() => {
    const p: Record<string, number> = {}
    for (const pos of positions) {
      if (pos.underlyingPrice && !p[pos.ticker]) p[pos.ticker] = pos.underlyingPrice
    }
    return p
  }, [positions])

  const hasPositions = positions.length > 0

  const clearPortfolio = () => {
    setPositions([])
    localStorage.removeItem('na-positions')
    localStorage.removeItem('na-positions-saved-at')
    setLastSaved(null)
    setActiveView('import')
  }

  const formatSavedAt = (iso: string | null) => {
    if (!iso) return null
    const d = new Date(iso)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
      <PortfolioContext.Provider value={{ positions, setPositions: updatePositions, underlyingPrices }}>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-[var(--border)] glass sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center text-[var(--bg-base)] font-bold text-sm">
                  N
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                    Najeeb&apos;s Options
                  </h1>
                  {hasPositions && lastSaved ? (
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      Updated {formatSavedAt(lastSaved)}
                      {refreshing && <RefreshCw className="w-2.5 h-2.5 animate-spin ml-1" />}
                    </p>
                  ) : (
                    <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                      Portfolio Scenario Analyzer
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {hasPositions && (
                  <>
                    <button
                      onClick={refreshPrices}
                      disabled={refreshing}
                      className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] transition active:scale-95"
                      title="Refresh prices"
                    >
                      <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                      onClick={clearPortfolio}
                      className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/5 transition active:scale-95 hidden sm:block"
                      title="Clear portfolio"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                      </svg>
                    </button>
                  </>
                )}
                <NavBar
                  activeView={activeView}
                  onViewChange={setActiveView}
                  hasPositions={hasPositions}
                />
                <div className="hidden sm:block w-px h-6 bg-[var(--border)]" />
                <ThemeToggle />
                <button
                  onClick={logout}
                  className="p-2 rounded-lg border border-[var(--border)] text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/5 transition active:scale-95"
                  title="Log out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </header>

          {/* Quote banner */}
          <QuoteBanner />

          {/* Main content */}
          <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 pb-24 sm:pb-8">
            <div className="animate-fadeIn" key={activeView}>
              {activeView === 'dashboard' && (
                <Dashboard onGoToImport={() => setActiveView('import')} />
              )}
              {activeView === 'import' && (
                <ImportWizard
                  onPositionsReady={() => setActiveView('dashboard')}
                />
              )}
              {activeView === 'simulator' && (
                <Simulator onGoToImport={() => setActiveView('import')} />
              )}
              {activeView === 'watchlist' && <Watchlist />}
              {activeView === 'trade-ideas' && <TradeIdeas />}
            </div>
          </main>

          {/* Chat FAB */}
          <ChatPanel />

          {/* Footer */}
          <footer className="border-t border-[var(--border)] py-4 hidden sm:block">
            <p className="text-center text-xs text-[var(--text-muted)]">
              Built for Najeeb &middot; American option pricing (Bjerksund-Stensland 2002) &middot; Not financial advice
            </p>
          </footer>
        </div>
      </PortfolioContext.Provider>
  )
}
