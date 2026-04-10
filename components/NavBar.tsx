'use client'

import { LayoutDashboard, Upload, Eye, Lightbulb, Grid3x3 } from 'lucide-react'
import type { ActiveView } from '@/types'

const NAV_ITEMS: { view: ActiveView; icon: typeof LayoutDashboard; label: string }[] = [
  { view: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { view: 'import', icon: Upload, label: 'Import' },
  { view: 'simulator', icon: Grid3x3, label: 'Simulator' },
  { view: 'watchlist', icon: Eye, label: 'Watchlist' },
  { view: 'trade-ideas', icon: Lightbulb, label: 'Ideas' },
]

interface NavBarProps {
  activeView: ActiveView
  onViewChange: (view: ActiveView) => void
  hasPositions: boolean
}

export default function NavBar({ activeView, onViewChange, hasPositions }: NavBarProps) {
  return (
    <>
      {/* Desktop nav */}
      <nav className="hidden sm:flex items-center gap-1">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = activeView === view
          const isDisabled = (view === 'dashboard' || view === 'simulator') && !hasPositions
          return (
            <button
              key={view}
              onClick={() => !isDisabled && onViewChange(view)}
              disabled={isDisabled}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all active:scale-[0.97] ${
                isActive
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : isDisabled
                  ? 'text-[var(--text-muted)]/40 cursor-default'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          )
        })}
      </nav>

      {/* Mobile bottom tab bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[var(--bg-surface)] border-t border-[var(--border)] flex">
        {NAV_ITEMS.map(({ view, icon: Icon, label }) => {
          const isActive = activeView === view
          const isDisabled = (view === 'dashboard' || view === 'simulator') && !hasPositions
          return (
            <button
              key={view}
              onClick={() => !isDisabled && onViewChange(view)}
              disabled={isDisabled}
              className={`flex-1 flex flex-col items-center gap-1 py-3 text-[10px] font-medium transition-all ${
                isActive
                  ? 'text-[var(--accent)]'
                  : isDisabled
                  ? 'text-[var(--text-muted)]/30'
                  : 'text-[var(--text-muted)]'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          )
        })}
      </div>
    </>
  )
}
