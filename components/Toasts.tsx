'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { Check, AlertTriangle, Info, X } from 'lucide-react'

interface Toast {
  id: string
  message: string
  type: 'success' | 'warning' | 'info'
  exiting?: boolean
}

interface ToastContextType {
  toast: (message: string, type?: 'success' | 'warning' | 'info') => void
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, type: 'success' | 'warning' | 'info' = 'info') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev.slice(-4), { id, message, type }])

    // Auto-dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, 250)
    }, 3000)
  }, [])

  const dismiss = (id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t))
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250)
  }

  const icons = {
    success: <Check className="w-4 h-4 text-[var(--accent)]" />,
    warning: <AlertTriangle className="w-4 h-4 text-[var(--warning)]" />,
    info: <Info className="w-4 h-4 text-[var(--text-muted)]" />,
  }

  const borderColors = {
    success: 'border-[var(--accent)]/20',
    warning: 'border-[var(--warning)]/20',
    info: 'border-[var(--border)]',
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-20 sm:bottom-6 right-4 sm:right-24 z-[60] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div key={t.id}
            className={`pointer-events-auto glass ${borderColors[t.type]} rounded-xl px-4 py-3 flex items-center gap-3 shadow-lg max-w-sm ${
              t.exiting ? 'toast-exit' : 'toast-enter'
            }`}
          >
            {icons[t.type]}
            <span className="text-sm text-[var(--text-primary)] flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="text-[var(--text-muted)] hover:text-[var(--text-primary)]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
