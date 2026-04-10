'use client'

import { useState } from 'react'
import { Lock, ArrowRight } from 'lucide-react'

interface PasswordGateProps {
  children: React.ReactNode
}

const PASSCODE = process.env.NEXT_PUBLIC_PASSCODE || 'najeeb2026'

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

  if (unlocked) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4">
      <div className="w-full max-w-sm flex flex-col items-center gap-6">
        <div className="w-14 h-14 bg-[var(--accent)]/10 border border-[var(--accent)]/20 rounded-2xl flex items-center justify-center">
          <Lock className="w-6 h-6 text-[var(--accent)]" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-[var(--text-primary)]">Najeeb&apos;s Options</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Enter the passcode to continue</p>
        </div>
        <div className="w-full flex flex-col gap-3">
          <input
            type="password"
            className={`w-full bg-[var(--bg-elevated)] border rounded-lg px-4 py-3 text-center text-lg font-mono tracking-widest text-[var(--text-primary)] focus:outline-none transition ${
              error ? 'border-[var(--danger)] shake' : 'border-[var(--border)] focus:border-[var(--accent)]'
            }`}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="••••••"
            autoFocus
          />
          <button
            onClick={submit}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition"
          >
            Enter <ArrowRight className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <p className="text-sm text-[var(--danger)]">Wrong passcode</p>
        )}
      </div>
    </div>
  )
}
