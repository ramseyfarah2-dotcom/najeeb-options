import { bjerksundStensland } from './blackScholes'
import type { OptionPosition, ScenarioPoint, HeatmapCell } from '@/types'

const DEFAULT_RATE = 0.045

function daysToExpiry(expiry: string): number {
  const now = new Date()
  const exp = new Date(expiry)
  return Math.max(0, Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

// P&L of a single position at a hypothetical stock price and future date
export function positionPnl(
  position: OptionPosition,
  newUnderlyingPrice: number,
  daysForward: number,
  ivShiftDecimal: number = 0,
  riskFreeRate: number = DEFAULT_RATE
): number {
  const K = position.strike
  const sigma = (position.iv ?? 0.30) + ivShiftDecimal
  const clampedSigma = Math.max(0.001, sigma)
  const days = daysToExpiry(position.expiry)
  const remainingDays = Math.max(0, days - daysForward)
  const T = remainingDays / 365

  let futureOptionPrice: number
  if (T <= 0) {
    // Expired — intrinsic only
    futureOptionPrice = position.optionType === 'call'
      ? Math.max(0, newUnderlyingPrice - K)
      : Math.max(0, K - newUnderlyingPrice)
  } else {
    futureOptionPrice = bjerksundStensland(
      newUnderlyingPrice, K, T, riskFreeRate, 0, clampedSigma, position.optionType
    )
  }

  // P&L = (new price - avg cost) × quantity × contract size
  return (futureOptionPrice - position.avgCost) * position.quantity * position.contractSize
}

// Generate scenario grid for positions sharing an underlying
export function generateScenarioGrid(
  positions: OptionPosition[],
  underlyingPrice: number,
  stockMoves: number[],
  daysRange: number[],
  ivShift: number = 0
): ScenarioPoint[] {
  return stockMoves.map(move => {
    const newPrice = Math.round(underlyingPrice * (1 + move) * 100) / 100
    const pnls: Record<string, number> = {}

    for (const days of daysRange) {
      let totalPnl = 0
      for (const pos of positions) {
        totalPnl += positionPnl(pos, newPrice, days, ivShift)
      }
      pnls[`d${days}`] = Math.round(totalPnl * 100) / 100
    }

    return {
      stockPrice: newPrice,
      stockPricePct: move,
      pnl_today: pnls[`d${daysRange[0]}`] ?? 0,
      pnl_7d: pnls[`d${daysRange[1]}`] ?? 0,
      pnl_14d: pnls[`d${daysRange[2]}`] ?? 0,
      pnl_30d: pnls[`d${daysRange[3]}`] ?? 0,
      pnl_expiry: pnls[`d${daysRange[daysRange.length - 1]}`] ?? 0,
    }
  })
}

// Generate heatmap data
export function generateHeatmap(
  positions: OptionPosition[],
  underlyingPrice: number,
  stockMoves: number[],
  daysRange: number[],
  ivShift: number = 0
): HeatmapCell[] {
  const cells: HeatmapCell[] = []

  for (const move of stockMoves) {
    const newPrice = underlyingPrice * (1 + move)
    for (const days of daysRange) {
      let totalPnl = 0
      for (const pos of positions) {
        totalPnl += positionPnl(pos, newPrice, days, ivShift)
      }
      cells.push({
        stockPricePct: move,
        daysForward: days,
        pnl: Math.round(totalPnl * 100) / 100,
      })
    }
  }

  return cells
}

// Find breakeven prices from the expiry P&L curve
export function findBreakevens(scenarioPoints: ScenarioPoint[]): number[] {
  const breakevens: number[] = []
  for (let i = 1; i < scenarioPoints.length; i++) {
    const prev = scenarioPoints[i - 1].pnl_expiry
    const curr = scenarioPoints[i].pnl_expiry
    if ((prev <= 0 && curr > 0) || (prev >= 0 && curr < 0)) {
      const x1 = scenarioPoints[i - 1].stockPrice
      const x2 = scenarioPoints[i].stockPrice
      const y1 = prev, y2 = curr
      const be = x1 - y1 * (x2 - x1) / (y2 - y1)
      breakevens.push(Math.round(be * 100) / 100)
    }
  }
  return breakevens
}
