'use client'

import { usePortfolio } from '@/lib/context'
import { Upload } from 'lucide-react'

interface DashboardProps {
  onGoToImport: () => void
}

export default function Dashboard({ onGoToImport }: DashboardProps) {
  const { positions } = usePortfolio()

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-24">
        <div className="w-16 h-16 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/20 flex items-center justify-center">
          <Upload className="w-7 h-7 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">No positions yet</h2>
          <p className="text-[var(--text-muted)] text-sm mt-1">Import your Questrade screenshot to get started</p>
        </div>
        <button
          onClick={onGoToImport}
          className="px-6 py-3 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition active:scale-[0.97]"
        >
          Import Positions
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-[var(--text-primary)]">Dashboard</h2>
      <p className="text-[var(--text-muted)] text-sm">Portfolio overview coming in Phase 2...</p>
    </div>
  )
}
