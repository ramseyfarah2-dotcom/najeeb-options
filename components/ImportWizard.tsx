'use client'

import { useState, Component, type ReactNode } from 'react'
import { Check } from 'lucide-react'
import Step1Import from '@/components/Step1Import'
import Step2Review from '@/components/Step2Review'
import Step3Analysis from '@/components/Step3Analysis'
import Step4Research from '@/components/Step4Research'
import { usePortfolio } from '@/lib/context'

class ErrorBoundary extends Component<
  { children: ReactNode; fallbackLabel: string },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode; fallbackLabel: string }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-xl p-6 text-center">
          <p className="text-[var(--danger)] font-semibold mb-2">
            Something went wrong in {this.props.fallbackLabel}
          </p>
          <p className="text-[var(--text-muted)] text-sm">{this.state.error}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: '' })}
            className="mt-4 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-muted)] hover:bg-[var(--border)] transition"
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

const STEPS = [
  { num: 1, label: 'Import' },
  { num: 2, label: 'Review' },
  { num: 3, label: 'Analysis' },
  { num: 4, label: 'Research' },
]

interface ImportWizardProps {
  onPositionsReady?: () => void
}

export default function ImportWizard({ onPositionsReady }: ImportWizardProps) {
  const { positions, setPositions } = usePortfolio()
  const [step, setStep] = useState<1 | 2 | 3 | 4>(positions.length > 0 ? 2 : 1)
  const [completedSteps, setCompletedSteps] = useState<number[]>(positions.length > 0 ? [1] : [])
  const [researchTicker, setResearchTicker] = useState('')

  const completeStep = (s: number) => {
    if (!completedSteps.includes(s)) setCompletedSteps(prev => [...prev, s])
  }

  const allTickers = [...new Set(positions.map(p => p.ticker).filter(Boolean))]

  return (
    <div>
      {/* Sub-step indicator */}
      <div className="flex items-center justify-center gap-1 sm:gap-2 pb-6">
        {STEPS.map((s, i) => {
          const isActive = s.num === step
          const isDone = completedSteps.includes(s.num)
          const isClickable = isDone || s.num === step
          return (
            <div key={s.num} className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => isClickable && setStep(s.num as 1 | 2 | 3 | 4)}
                disabled={!isClickable}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : isDone ? 'text-[var(--accent)]/70 cursor-pointer hover:bg-[var(--bg-elevated)]'
                  : 'text-[var(--text-muted)]/40 cursor-default'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                  : isDone ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'bg-[var(--border)] text-[var(--text-muted)]'
                }`}>
                  {isDone && !isActive ? <Check className="w-2.5 h-2.5" /> : s.num}
                </span>
                <span className="hidden sm:inline">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={`w-4 sm:w-8 h-px ${isDone ? 'bg-[var(--accent)]/30' : 'bg-[var(--border)]'}`} />
              )}
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <Step1Import
          onPositionsParsed={(parsed) => {
            setPositions([...positions, ...parsed])
            completeStep(1)
            setStep(2)
          }}
        />
      )}
      {step === 2 && (
        <Step2Review
          positions={positions}
          onPositionsUpdated={setPositions}
          onBack={() => setStep(1)}
          onNext={() => {
            completeStep(2)
            setStep(3)
            onPositionsReady?.()
          }}
        />
      )}
      {step === 3 && (
        <ErrorBoundary fallbackLabel="Analysis">
          <Step3Analysis
            positions={positions}
            onBack={() => setStep(2)}
            onNext={(ticker) => { setResearchTicker(ticker); completeStep(3); setStep(4) }}
          />
        </ErrorBoundary>
      )}
      {step === 4 && (
        <ErrorBoundary fallbackLabel="Research">
          <Step4Research defaultTicker={researchTicker} allTickers={allTickers} />
        </ErrorBoundary>
      )}
    </div>
  )
}
