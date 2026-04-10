'use client'

import { useState, Component, type ReactNode } from 'react'
import StepIndicator from '@/components/StepIndicator'
import Step1Import from '@/components/Step1Import'
import Step2Review from '@/components/Step2Review'
import Step3Analysis from '@/components/Step3Analysis'
import Step4Research from '@/components/Step4Research'
import type { OptionPosition } from '@/types'

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

export default function Home() {
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [positions, setPositions] = useState<OptionPosition[]>([])
  const [researchTicker, setResearchTicker] = useState('')

  const goToStep = (step: 1 | 2 | 3 | 4) => setCurrentStep(step)

  const completeStep = (step: number) => {
    if (!completedSteps.includes(step)) {
      setCompletedSteps(prev => [...prev, step])
    }
  }

  const allTickers = [...new Set(positions.map(p => p.ticker).filter(Boolean))]

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-[var(--border)] bg-[var(--bg-surface)]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[var(--accent)] rounded-lg flex items-center justify-center text-[var(--bg-base)] font-bold text-sm">N</div>
            <div>
              <h1 className="text-sm font-semibold text-[var(--text-primary)] leading-tight">Najeeb&apos;s Options</h1>
              <p className="text-[10px] text-[var(--text-muted)] leading-tight">Portfolio Scenario Analyzer</p>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-4">
          <StepIndicator currentStep={currentStep} completedSteps={completedSteps} onStepClick={goToStep} />
        </div>
      </header>

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8">
        {currentStep === 1 && (
          <Step1Import
            onPositionsParsed={(parsed) => {
              setPositions(prev => [...prev, ...parsed])
              completeStep(1)
              goToStep(2)
            }}
          />
        )}
        {currentStep === 2 && (
          <Step2Review
            positions={positions}
            onPositionsUpdated={setPositions}
            onBack={() => goToStep(1)}
            onNext={() => { completeStep(2); goToStep(3) }}
          />
        )}
        {currentStep === 3 && (
          <ErrorBoundary fallbackLabel="Analysis">
            <Step3Analysis
              positions={positions}
              onBack={() => goToStep(2)}
              onNext={(ticker) => { setResearchTicker(ticker); completeStep(3); goToStep(4) }}
            />
          </ErrorBoundary>
        )}
        {currentStep === 4 && (
          <ErrorBoundary fallbackLabel="Research">
            <Step4Research defaultTicker={researchTicker} allTickers={allTickers} />
          </ErrorBoundary>
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-4">
        <p className="text-center text-xs text-[var(--text-muted)]">
          Built for Najeeb &middot; American option pricing (Bjerksund-Stensland 2002) &middot; Not financial advice
        </p>
      </footer>
    </div>
  )
}
