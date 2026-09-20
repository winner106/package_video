export type ThemePackId = 'default' | 'business-blue' | 'vscode'

export interface ThemePack {
  id: ThemePackId
  labelKey: string
  className: string
  previewColor: string
}

export const themePacks: ThemePack[] = [
  {
    id: 'default',
    labelKey: 'preferences.appearance.themePack.default',
    className: 'theme-default',
    previewColor: '#0f172a',
  },
  {
    id: 'business-blue',
    labelKey: 'preferences.appearance.themePack.businessBlue',
    className: 'theme-business-blue',
    previewColor: '#1f4b99',
  },
  {
    id: 'vscode',
    labelKey: 'preferences.appearance.themePack.vscode',
    className: 'theme-vscode',
    previewColor: '#007acc',
  },
]

export const getThemePackClass = (id: ThemePackId): string => {
  const found = themePacks.find(theme => theme.id === id)
  return found?.className ?? 'theme-default'
}
