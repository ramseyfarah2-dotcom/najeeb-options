'use client'

import { createContext, useContext } from 'react'
import type { OptionPosition } from '@/types'

export interface PortfolioContextType {
  positions: OptionPosition[]
  setPositions: (positions: OptionPosition[]) => void
  underlyingPrices: Record<string, number>
}

export const PortfolioContext = createContext<PortfolioContextType>({
  positions: [],
  setPositions: () => {},
  underlyingPrices: {},
})

export function usePortfolio() {
  return useContext(PortfolioContext)
}
