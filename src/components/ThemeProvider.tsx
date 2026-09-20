import { useEffect, useState } from 'react'
import { emit } from '@tauri-apps/api/event'
import { ThemeProviderContext, type ColorMode } from '@/lib/color-mode-context'
import { usePreferences } from '@/services/preferences'
import { getThemePackClass, type ThemePackId, themePacks } from '@/lib/themes'

interface ThemeProviderProps {
  children: React.ReactNode
  defaultColorMode?: ColorMode
  storageKey?: string
  themePackStorageKey?: string
}

const isColorMode = (value: unknown): value is ColorMode => value === 'light' || value === 'dark' || value === 'system'

const normalizeColorMode = (value: unknown, fallback: ColorMode): ColorMode => (isColorMode(value) ? value : fallback)

const normalizeThemePackId = (value: unknown): ThemePackId =>
  themePacks.some(pack => pack.id === value) ? (value as ThemePackId) : 'default'

export function ThemeProvider({
  children,
  defaultColorMode = 'system',
  storageKey = 'ui-theme',
  themePackStorageKey = 'ui-theme-pack',
  ...props
}: ThemeProviderProps) {
  const [colorModeOverride, setColorModeOverride] = useState<ColorMode | null>(null)
  const [themePackOverride, setThemePackOverride] = useState<ThemePackId | null>(null)

  // Load theme from persistent preferences
  const { data: preferences } = usePreferences()

  const storedColorMode = normalizeColorMode(localStorage.getItem(storageKey), defaultColorMode)
  const storedThemePack = normalizeThemePackId(localStorage.getItem(themePackStorageKey))

  const preferencesColorMode = preferences ? normalizeColorMode(preferences.theme, defaultColorMode) : null
  const preferencesThemePack = preferences ? normalizeThemePackId(preferences.theme_palette) : null

  const colorMode = colorModeOverride ?? preferencesColorMode ?? storedColorMode
  const themePack = themePackOverride ?? preferencesThemePack ?? storedThemePack

  // Keep external systems in sync with persisted preferences (e.g., quick pane reads localStorage).
  useEffect(() => {
    if (!preferences) return

    const nextColorMode = normalizeColorMode(preferences.theme, defaultColorMode)
    const nextThemePack = normalizeThemePackId(preferences.theme_palette)

    localStorage.setItem(storageKey, nextColorMode)
    localStorage.setItem(themePackStorageKey, nextThemePack)

    emit('theme-changed', { theme: nextColorMode })
    emit('theme-pack-changed', { themePack: nextThemePack })
  }, [defaultColorMode, preferences, storageKey, themePackStorageKey])

  useEffect(() => {
    const root = window.document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    const applyThemePack = (pack: ThemePackId) => {
      const classNames = themePacks.map(p => p.className)
      classNames.forEach(cls => root.classList.remove(cls))
      const className = getThemePackClass(pack)
      if (className && !root.classList.contains(className)) {
        root.classList.add(className)
      }
    }

    applyThemePack(themePack)

    const applyTheme = (isDark: boolean) => {
      root.classList.remove('light', 'dark')
      root.classList.add(isDark ? 'dark' : 'light')
    }

    if (colorMode === 'system') {
      applyTheme(mediaQuery.matches)

      const handleChange = (e: MediaQueryListEvent) => applyTheme(e.matches)
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    applyTheme(colorMode === 'dark')
  }, [colorMode, themePack])

  const value = {
    colorMode,
    themePack,
    setColorMode: (newMode: ColorMode) => {
      localStorage.setItem(storageKey, newMode)
      setColorModeOverride(newMode)
      // Notify other windows (e.g., quick pane) of theme change
      emit('theme-changed', { theme: newMode })
    },
    setThemePack: (newThemePack: ThemePackId) => {
      localStorage.setItem(themePackStorageKey, newThemePack)
      setThemePackOverride(newThemePack)
      emit('theme-pack-changed', { themePack: newThemePack })
    },
  }

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  )
}
