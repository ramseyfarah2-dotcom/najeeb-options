import { bjerksundStensland } from './blackScholes'
import type { OptionPosition, Greeks } from '@/types'

const DEFAULT_RATE = 0.045

function daysToExpiry(expiry: string): number {
  const now = new Date()
  const exp = new Date(expiry)
  return Math.max(0, Math.round((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
}

export function calculateGreeks(
  position: OptionPosition,
  underlyingPrice: number,
  riskFreeRate: number = DEFAULT_RATE
): Greeks {
  const S = underlyingPrice
  const K = position.strike
  const days = daysToExpiry(position.expiry)
  const T = days / 365
  const sigma = position.iv ?? 0.30
  const q = 0 // dividend yield
  const type = position.optionType
  const qty = position.quantity
  const mult = position.contractSize

  if (T <= 0 || S <= 0 || K <= 0 || sigma <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, dollarDelta: 0, dollarTheta: 0, dollarVega: 0 }
  }

  const price = bjerksundStensland(S, K, T, riskFreeRate, q, sigma, type)

  // Finite difference bumps
  const dS = S * 0.001
  const priceUp = bjerksundStensland(S + dS, K, T, riskFreeRate, q, sigma, type)
  const priceDown = bjerksundStensland(S - dS, K, T, riskFreeRate, q, sigma, type)

  const delta = (priceUp - priceDown) / (2 * dS)
  const gamma = (priceUp - 2 * price + priceDown) / (dS * dS)

  // Theta: bump time by 1 day
  const dT = 1 / 365
  const priceTminus = T - dT > 0
    ? bjerksundStensland(S, K, T - dT, riskFreeRate, q, sigma, type)
    : (type === 'call' ? Math.max(0, S - K) : Math.max(0, K - S))
  const theta = priceTminus - price // per day (negative for long)

  // Vega: bump sigma by 0.01 (1%)
  const dSigma = 0.01
  const priceVup = bjerksundStensland(S, K, T, riskFreeRate, q, sigma + dSigma, type)
  const priceVdown = bjerksundStensland(S, K, T, riskFreeRate, q, Math.max(0.001, sigma - dSigma), type)
  const vega = (priceVup - priceVdown) / 2 // per 1% IV move

  // Rho: bump rate by 0.01
  const dr = 0.01
  const priceRup = bjerksundStensland(S, K, T, riskFreeRate + dr, q, sigma, type)
  const rho = (priceRup - price) / dr

  return {
    delta,
    gamma,
    theta,
    vega,
    rho,
    dollarDelta: delta * mult * qty,
    dollarTheta: theta * mult * Math.abs(qty),
    dollarVega: vega * mult * Math.abs(qty),
  }
}

export function portfolioGreeks(
  positions: OptionPosition[],
  underlyingPrices: Record<string, number>
): Greeks {
  const totals: Greeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, dollarDelta: 0, dollarTheta: 0, dollarVega: 0 }

  for (const pos of positions) {
    const price = underlyingPrices[pos.ticker]
    if (!price) continue
    const g = calculateGreeks(pos, price)
    totals.delta += g.delta * pos.quantity
    totals.gamma += g.gamma * pos.quantity
    totals.theta += g.theta * pos.quantity
    totals.vega += g.vega * pos.quantity
    totals.rho += g.rho * pos.quantity
    totals.dollarDelta += g.dollarDelta
    totals.dollarTheta += g.dollarTheta * (pos.quantity < 0 ? -1 : 1)
    totals.dollarVega += g.dollarVega * (pos.quantity < 0 ? -1 : 1)
  }

  return totals
}
