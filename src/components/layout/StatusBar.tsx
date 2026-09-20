import { Laptop, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useTheme } from '@/hooks/use-theme'
import { cn } from '@/lib/utils'
import { usePreferences, useSavePreferences } from '@/services/preferences'

type ColorModeOption = 'light' | 'dark' | 'system'

interface ColorModeEntry {
  value: ColorModeOption
  icon: React.ComponentType<{ className?: string }>
}

const colorModeOptions = [
  { value: 'light', icon: Sun },
  { value: 'dark', icon: Moon },
  { value: 'system', icon: Laptop },
] as const satisfies readonly ColorModeEntry[]

export function StatusBar() {
  const { t } = useTranslation()
  // colorMode = light/dark/system; themePack handles palettes (e.g., business-blue, vscode).
  const { colorMode, setColorMode } = useTheme()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences({ toastOnSuccess: false })

  const currentTheme = colorModeOptions.find(option => option.value === colorMode) ?? colorModeOptions[0]
  const currentIndex = colorModeOptions.indexOf(currentTheme)
  const nextTheme = colorModeOptions[(currentIndex + 1) % colorModeOptions.length] ?? colorModeOptions[0]

  const handleThemeChange = (value: ColorModeOption) => {
    setColorMode(value)
    if (preferences) {
      savePreferences.mutate({ ...preferences, theme: value })
    }
  }

  return (
    <div className="flex h-10 items-center justify-between border-t border-border bg-muted/30 px-3 text-xs text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="text-foreground font-medium">{t('statusBar.status')}</span>
        <span className="hidden sm:inline">{t('statusBar.ready')}</span>
        <span className="hidden md:inline text-muted-foreground/80">{t('statusBar.placeholder')}</span>
      </div>

      <div className="flex items-center gap-1.5">
        {/* <span className="hidden sm:inline text-muted-foreground/80">{t('statusBar.theme.label')}</span> */}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('statusBar.theme.toggle')}
          title={t('statusBar.theme.toggle')}
          onClick={() => handleThemeChange(nextTheme.value)}
          className={cn('transition-colors', 'text-foreground')}
        >
          <currentTheme.icon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
