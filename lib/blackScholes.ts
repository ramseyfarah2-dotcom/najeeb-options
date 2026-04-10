import type { OptionType } from '@/types'

// Standard normal CDF — Abramowitz & Stegun approximation (7+ decimal accuracy)
export function normalCDF(x: number): number {
  if (x === 0) return 0.5
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911
  const sign = x < 0 ? -1 : 1
  const absX = Math.abs(x)
  const t = 1.0 / (1.0 + p * absX)
  const y = 1.0 - (a1 * t + a2 * t * t + a3 * t ** 3 + a4 * t ** 4 + a5 * t ** 5) *
    Math.exp(-absX * absX / 2)
  return 0.5 * (1.0 + sign * y)
}

// Standard normal PDF
export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

// Bivariate normal CDF approximation (Drezner & Wesolowsky 1990)
function bivariateNormalCDF(a: number, b: number, rho: number): number {
  if (Math.abs(rho) < 1e-10) return normalCDF(a) * normalCDF(b)
  if (Math.abs(rho - 1) < 1e-10) return normalCDF(Math.min(a, b))
  if (Math.abs(rho + 1) < 1e-10) return Math.max(0, normalCDF(a) + normalCDF(b) - 1)

  // Gauss-Legendre quadrature approximation
  const x = [0.04691008, 0.23076534, 0.50000000, 0.76923466, 0.95308992]
  const w = [0.01846567, 0.08168853, 0.12457352, 0.08168853, 0.01846567]

  const asr = Math.asin(rho)
  let sum = 0
  for (let i = 0; i < 5; i++) {
    for (let j = -1; j <= 1; j += 2) {
      const sn = Math.sin(asr * (j * x[i] + 0.5))
      sum += w[i] * Math.exp((sn * a * b - a * a / 2 - b * b / 2) / (1 - sn * sn))
    }
  }
  return normalCDF(a) * normalCDF(b) + sum * asr / (4 * Math.PI)
}

// European Black-Scholes price
export function blackScholesPrice(
  S: number, K: number, T: number,
  r: number, sigma: number, optionType: OptionType
): number {
  if (S <= 0 || K <= 0 || sigma <= 0) return 0
  if (T <= 0) return optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)

  const sqrtT = Math.sqrt(T)
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma * sigma) * T) / (sigma * sqrtT)
  const d2 = d1 - sigma * sqrtT

  if (optionType === 'call') {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2)
  }
  return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1)
}

// Bjerksund-Stensland 2002 American option pricing
// Verification: bjerksundStensland(100,100,1,0.05,0,0.2,'call') ≈ 10.30–10.50
// Verification: bjerksundStensland(100,100,1,0.05,0,0.2,'put')  ≈ 5.57–5.75
export function bjerksundStensland(
  S: number, K: number, T: number,
  r: number, q: number, sigma: number, optionType: OptionType
): number {
  if (S <= 0 || K <= 0 || sigma <= 0) return 0
  if (T <= 0) return optionType === 'call' ? Math.max(0, S - K) : Math.max(0, K - S)
  if (T < 0.003) return Math.max(blackScholesPrice(S, K, T, r - q, sigma, optionType),
    optionType === 'call' ? S - K : K - S, 0)

  if (optionType === 'put') {
    // Put-call transformation
    return bs2002Call(K, S, T, q, r, sigma)
  }
  return bs2002Call(S, K, T, r, q, sigma)
}

function bs2002Call(S: number, K: number, T: number, r: number, q: number, sigma: number): number {
  const sig2 = sigma * sigma
  const b = r - q

  // No dividend, b >= r => American call = European call
  if (q <= 0 && b >= r) {
    return blackScholesPrice(S, K, T, b, sigma, 'call')
  }

  const beta = (0.5 - b / sig2) + Math.sqrt((b / sig2 - 0.5) ** 2 + 2 * r / sig2)
  const Binf = (beta / (beta - 1)) * K
  const B0 = Math.max(K, (r / (r - b)) * K)

  const ht = -(b * T + 2 * sigma * Math.sqrt(T)) * (K * K / ((Binf - B0) * B0))
  const t1 = T / 2

  const I2 = B0 + (Binf - B0) * (1 - Math.exp(ht))
  const ht1 = -(b * t1 + 2 * sigma * Math.sqrt(t1)) * (K * K / ((Binf - B0) * B0))
  const I1 = B0 + (Binf - B0) * (1 - Math.exp(ht1))

  if (S >= I2) return S - K

  const alpha1Coeff = (I2 - K) * Math.pow(I2, -beta)

  const european = blackScholesPrice(S, K, T, b, sigma, 'call')

  const value =
    alpha1Coeff * phiFunc(S, T, beta, I2, I2, r, b, sigma) -
    alpha1Coeff * phiFunc(S, T, beta, I1, I2, r, b, sigma) +
    phiFunc(S, T, 1, I2, I2, r, b, sigma) -
    phiFunc(S, T, 1, I1, I2, r, b, sigma) -
    K * phiFunc(S, T, 0, I2, I2, r, b, sigma) +
    K * phiFunc(S, T, 0, I1, I2, r, b, sigma) +
    european +
    (I2 - K) * phiFunc(S, t1, beta, I1, I1, r, b, sigma) -
    phiFunc(S, t1, 1, I1, I1, r, b, sigma) +
    K * phiFunc(S, t1, 0, I1, I1, r, b, sigma)

  return Math.max(value, Math.max(0, S - K))
}

function phiFunc(
  S: number, T: number, gamma: number, H: number, I: number,
  r: number, b: number, sigma: number
): number {
  const sig2 = sigma * sigma
  const sqrtT = Math.sqrt(T)
  const lambda = (-r + gamma * b + 0.5 * gamma * (gamma - 1) * sig2) * T
  const d1 = -(Math.log(S / H) + (b + (gamma - 0.5) * sig2) * T) / (sigma * sqrtT)
  const d2 = -(Math.log(I * I / (S * H)) + (b + (gamma - 0.5) * sig2) * T) / (sigma * sqrtT)
  const kappa = (2 * b) / sig2 + (2 * gamma - 1)
  return Math.exp(lambda) * Math.pow(S, gamma) *
    (normalCDF(d1) - Math.pow(I / S, kappa) * normalCDF(d2))
}

// Safe number parser with clamping
export function safeNum(val: unknown, min: number, max: number, fallback: number): number {
  const n = Number(val)
  if (!isFinite(n) || isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
