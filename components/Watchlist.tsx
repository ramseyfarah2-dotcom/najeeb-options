'use client'

import { Eye } from 'lucide-react'

export default function Watchlist() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-24">
      <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
        <Eye className="w-7 h-7 text-[var(--accent)]" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Watchlist</h2>
        <p className="text-[var(--text-muted)] text-sm mt-1">Live prices and watchlist coming in Phase 4...</p>
      </div>
    </div>
  )
}
