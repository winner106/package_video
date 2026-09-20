import { createContext } from 'react'
import type { ThemePackId } from './themes'

// ColorMode = light/dark/system. ThemePack = palette class (e.g., business-blue).
export type ColorMode = 'dark' | 'light' | 'system'

export interface ThemeProviderState {
  colorMode: ColorMode
  themePack: ThemePackId
  setColorMode: (colorMode: ColorMode) => void
  setThemePack: (themePack: ThemePackId) => void
}

const initialState: ThemeProviderState = {
  colorMode: 'system',
  themePack: 'default',
  setColorMode: () => null,
  setThemePack: () => null,
}

export const ThemeProviderContext = createContext<ThemeProviderState>(initialState)
