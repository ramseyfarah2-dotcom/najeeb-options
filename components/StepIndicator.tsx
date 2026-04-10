'use client'

import { Check } from 'lucide-react'

const STEPS = [
  { num: 1, label: 'Import' },
  { num: 2, label: 'Review' },
  { num: 3, label: 'Analysis' },
  { num: 4, label: 'Research' },
]

interface StepIndicatorProps {
  currentStep: 1 | 2 | 3 | 4
  completedSteps: number[]
  onStepClick: (step: 1 | 2 | 3 | 4) => void
}

export default function StepIndicator({ currentStep, completedSteps, onStepClick }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-4">
      {STEPS.map((step, i) => {
        const isActive = step.num === currentStep
        const isDone = completedSteps.includes(step.num)
        const isClickable = isDone || step.num === currentStep

        return (
          <div key={step.num} className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => isClickable && onStepClick(step.num as 1 | 2 | 3 | 4)}
              disabled={!isClickable}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--bg-base)]'
                  : isDone
                  ? 'bg-[var(--bg-elevated)] text-[var(--accent)] cursor-pointer hover:bg-[var(--border)]'
                  : 'bg-transparent text-[var(--text-muted)] cursor-default'
              }`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                isActive ? 'bg-[var(--bg-base)] text-[var(--accent)]'
                : isDone ? 'bg-[var(--accent)]/20 text-[var(--accent)]'
                : 'bg-[var(--border)] text-[var(--text-muted)]'
              }`}>
                {isDone && !isActive ? <Check className="w-3 h-3" /> : step.num}
              </span>
              <span className="hidden sm:inline">{step.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className={`w-6 sm:w-10 h-px ${isDone ? 'bg-[var(--accent)]/40' : 'bg-[var(--border)]'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}
