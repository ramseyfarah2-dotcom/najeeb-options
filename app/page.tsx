'use client'

import { useState, useMemo } from 'react'
import PasswordGate from '@/components/PasswordGate'
import NavBar from '@/components/NavBar'
import ThemeToggle from '@/components/ThemeToggle'
import ImportWizard from '@/components/ImportWizard'
import Dashboard from '@/components/Dashboard'
import Watchlist from '@/components/Watchlist'
import TradeIdeas from '@/components/TradeIdeas'
import ChatPanel from '@/components/ChatPanel'
import { PortfolioContext } from '@/lib/context'
import type { OptionPosition, ActiveView } from '@/types'

export default function Home() {
  const [activeView, setActiveView] = useState<ActiveView>('import')
  const [positions, setPositions] = useState<OptionPosition[]>([])

  const underlyingPrices = useMemo(() => {
    const prices: Record<string, number> = {}
    for (const p of positions) {
      if (p.underlyingPrice && !prices[p.ticker]) {
        prices[p.ticker] = p.underlyingPrice
      }
    }
    return prices
  }, [positions])

  const hasPositions = positions.length > 0

  return (
    <PasswordGate>
      <PortfolioContext.Provider value={{ positions, setPositions, underlyingPrices }}>
        <div className="min-h-screen flex flex-col">
          {/* Header */}
          <header className="border-b border-[var(--border)] bg-[var(--bg-surface)] sticky top-0 z-40">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center text-[var(--bg-base)] font-bold text-sm">
                  N
                </div>
                <div>
                  <h1 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">
                    Najeeb&apos;s Options
                  </h1>
                  <p className="text-[10px] text-[var(--text-muted)] leading-tight">
                    Portfolio Scenario Analyzer
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <NavBar
                  activeView={activeView}
                  onViewChange={setActiveView}
                  hasPositions={hasPositions}
                />
                <div className="hidden sm:block w-px h-6 bg-[var(--border)]" />
                <ThemeToggle />
              </div>
            </div>
          </header>

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
    </PasswordGate>
  )
}
