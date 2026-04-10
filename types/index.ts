export type OptionType = 'call' | 'put'

export interface OptionPosition {
  id: string
  ticker: string
  optionType: OptionType
  strike: number
  expiry: string              // ISO date YYYY-MM-DD
  quantity: number            // negative = short
  avgCost: number             // premium paid/received per share
  currentPrice: number        // current option price per share
  iv: number | null           // implied volatility as decimal (0.35 = 35%)
  underlyingPrice: number | null
  contractSize: number        // default 100
}

export interface Greeks {
  delta: number
  gamma: number
  theta: number          // per calendar day
  vega: number           // per 1% IV move
  rho: number
  dollarDelta: number
  dollarTheta: number
  dollarVega: number
}

export interface ScenarioPoint {
  stockPrice: number
  stockPricePct: number
  pnl_today: number
  pnl_7d: number
  pnl_14d: number
  pnl_30d: number
  pnl_expiry: number
}

export interface HeatmapCell {
  stockPricePct: number
  daysForward: number
  pnl: number
}

// Navigation
export type ActiveView = 'dashboard' | 'import' | 'simulator' | 'watchlist' | 'flow' | 'trade-ideas'

// Watchlist
export interface WatchlistItem {
  ticker: string
  currentPrice: number | null
  previousClose: number | null
  priceTarget: number | null
  addedAt: string
  isFromPositions: boolean
}

// Chat
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// Theme
export type Theme = 'dark' | 'light'
