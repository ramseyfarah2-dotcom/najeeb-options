'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, Loader2, AlertCircle } from 'lucide-react'
import type { OptionPosition } from '@/types'

interface Step1ImportProps {
  onPositionsParsed: (positions: OptionPosition[]) => void
}

export default function Step1Import({ onPositionsParsed }: Step1ImportProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback((f: File) => {
    setError(null)
    const validTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
    const isHeic = f.name.toLowerCase().endsWith('.heic') || f.name.toLowerCase().endsWith('.heif')
    if (!isHeic && !validTypes.includes(f.type) && f.type !== '') {
      setError('Please upload a PNG, JPEG, WebP, or HEIC image.')
      return
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('Image too large (max 10MB). Try cropping to just the positions table.')
      return
    }
    setFile(f)
    if (!isHeic && f.type !== 'image/heic' && f.type !== 'image/heif') {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null) // HEIC can't preview in browser
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files[0]
    if (f) processFile(f)
  }, [processFile])

  const parseScreenshot = async () => {
    if (!file) return
    setLoading(true)
    setError(null)

    try {
      const { base64, mimeType } = await fileToBase64(file)

      const res = await fetch('/api/parse-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageData: base64, mimeType }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse screenshot')

      const positions: OptionPosition[] = (data.positions ?? []).map((p: Record<string, unknown>) => ({
        id: crypto.randomUUID(),
        ticker: (p.ticker as string || '').toUpperCase(),
        optionType: (p.optionType as string || 'call').toLowerCase() === 'put' ? 'put' as const : 'call' as const,
        strike: Number(p.strike) || 0,
        expiry: (p.expiry as string) || '',
        quantity: Number(p.quantity) || 0,
        avgCost: Number(p.avgCost) || 0,
        currentPrice: Number(p.currentPrice) || 0,
        iv: typeof p.iv === 'number' ? p.iv : null,
        underlyingPrice: typeof p.underlyingPrice === 'number' ? p.underlyingPrice : null,
        contractSize: Number(p.contractSize) || 100,
      }))

      if (positions.length === 0) {
        setError('No positions found in the screenshot. Try a clearer image of the positions table.')
        return
      }

      // Auto-fetch stock prices
      const tickersNeedingPrices = [...new Set(positions.filter(p => !p.underlyingPrice).map(p => p.ticker))].filter(Boolean)
      if (tickersNeedingPrices.length > 0) {
        try {
          const priceRes = await fetch('/api/stock-price', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tickers: tickersNeedingPrices }),
          })
          if (priceRes.ok) {
            const { prices } = await priceRes.json()
            for (const pos of positions) {
              if (!pos.underlyingPrice && prices[pos.ticker]) {
                pos.underlyingPrice = prices[pos.ticker]
              }
            }
          }
        } catch { /* user can enter manually */ }
      }

      onPositionsParsed(positions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse screenshot')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col items-center gap-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold tracking-tight text-[var(--text-primary)]">
          Import Your Positions
        </h2>
        <p className="text-[var(--text-muted)] mt-3 text-base">
          Take a screenshot of your Questrade positions table and drop it here.
        </p>
      </div>

      {!file ? (
        <div
          className={`w-full border-2 border-dashed rounded-xl p-16 text-center cursor-pointer transition-all ${
            dragOver
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--border)] hover:border-[var(--text-muted)]'
          }`}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="w-10 h-10 mx-auto text-[var(--text-muted)] mb-4" />
          <p className="text-[var(--text-primary)] font-semibold text-lg">
            Drop your screenshot here
          </p>
          <p className="text-[var(--text-muted)] text-sm mt-2">
            or click to browse — PNG, JPEG, WebP, HEIC (iPhone)
          </p>
        </div>
      ) : (
        <div className="w-full flex flex-col items-center gap-4">
          {preview && (
            <div className="relative border border-[var(--border)] rounded-xl overflow-hidden">
              <img src={preview} alt="Screenshot" className="max-h-[300px] object-contain" />
            </div>
          )}
          <div className="text-sm text-[var(--text-muted)]">
            {file.name} ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </div>
          <div className="flex gap-3">
            <button
              onClick={parseScreenshot}
              disabled={loading}
              className="px-6 py-3 bg-[var(--accent)] text-[var(--bg-base)] font-semibold rounded-lg hover:brightness-110 transition disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Claude is reading your positions...
                </>
              ) : (
                'Parse Positions with AI'
              )}
            </button>
            <button
              onClick={() => { setFile(null); setPreview(null); setError(null) }}
              disabled={loading}
              className="px-4 py-3 border border-[var(--border)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-elevated)] transition"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/heic,image/heif,.heic,.heif"
        onChange={e => { const f = e.target.files?.[0]; if (f) processFile(f) }}
        className="hidden"
      />

      {error && (
        <div className="w-full flex items-center gap-3 bg-[var(--danger)]/10 border border-[var(--danger)]/20 rounded-lg px-4 py-3 text-[var(--danger)] text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={() => { setFile(null); setPreview(null); setError(null) }}
            className="font-semibold hover:underline"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  )
}

function fileToBase64(file: File): Promise<{ base64: string; mimeType: string }> {
  const isHeic = file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')
    || file.type === 'image/heic' || file.type === 'image/heif'

  if (isHeic) {
    // HEIC: draw to canvas via createImageBitmap to convert to PNG
    return file.arrayBuffer()
      .then(buf => createImageBitmap(new Blob([buf])))
      .then(bitmap => {
        const canvas = document.createElement('canvas')
        canvas.width = bitmap.width
        canvas.height = bitmap.height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(bitmap, 0, 0)
        const dataUrl = canvas.toDataURL('image/png')
        return { base64: dataUrl.split(',')[1], mimeType: 'image/png' }
      })
      .catch(() => {
        // Fallback: send raw and hope for the best
        return new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            resolve({ base64: (reader.result as string).split(',')[1], mimeType: 'image/png' })
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
      })
  }

  // Non-HEIC: resize if large, convert to PNG via canvas
  return new Promise((resolve, reject) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = () => {
      img.onload = () => {
        const MAX_WIDTH = 2000
        let { width, height } = img
        if (width > MAX_WIDTH) {
          height = Math.round(height * (MAX_WIDTH / width))
          width = MAX_WIDTH
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        const dataUrl = canvas.toDataURL('image/png')
        resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/png' })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
