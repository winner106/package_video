import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useTheme } from '@/hooks/use-theme'
import { languageNames, availableLanguages } from '@/i18n'
import { getBestLanguageMatch } from '@/i18n/language-utils'
import { logger } from '@/lib/logger'
import { DEFAULT_MOOD_CANDIDATES, getMoodCandidatesForLocale } from '@/lib/moods'
import { themePacks } from '@/lib/themes'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { locale } from '@tauri-apps/plugin-os'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'

export function AppearancePane() {
  const { t, i18n } = useTranslation()
  // colorMode = light/dark/system; themePack = palette (e.g., business-blue, vscode)
  const { colorMode, setColorMode, themePack, setThemePack } = useTheme()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const currentLocale = preferences?.language ?? i18n.language
  const [moodText, setMoodText] = useState('')

  // Sync textarea with preferences / locale
  useEffect(() => {
    const moods =
      preferences?.mood_candidates?.[currentLocale] ??
      getMoodCandidatesForLocale(currentLocale, DEFAULT_MOOD_CANDIDATES)
    const next = moods.join('\n')
    let isActive = true
    // Defer the state update to a microtask to avoid synchronous setState inside the effect
    Promise.resolve().then(() => {
      if (isActive) setMoodText(next)
    })
    return () => {
      isActive = false
    }
  }, [currentLocale, preferences?.mood_candidates])

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    // Update the theme provider immediately for instant UI feedback
    setColorMode(value)

    // Persist the theme preference to disk, preserving other preferences
    if (preferences) {
      savePreferences.mutate({ ...preferences, theme: value })
    }
  }

  const handleThemePackChange = (value: string) => {
    const pack = value as (typeof themePacks)[number]['id']
    setThemePack(pack)

    if (preferences) {
      savePreferences.mutate({ ...preferences, theme_palette: pack })
    }
  }

  const handleLanguageChange = async (value: string) => {
    const language = value === 'system' ? null : value

    try {
      // Change the language immediately for instant UI feedback
      // 改变语言会自动触发 languageChanged 事件
      // 该事件已在 tray-language.ts 中被监听，会自动同步托盘菜单语言
      if (language) {
        await i18n.changeLanguage(language)
      } else {
        // System language selected - detect and apply system locale
        const systemLocale = await locale()
        const bestMatch = getBestLanguageMatch(systemLocale)
        await i18n.changeLanguage(bestMatch)
      }
    } catch (error) {
      logger.error('Failed to change language', { error })
      toast.error(t('toast.error.generic'))
      return
    }

    // Persist the language preference to disk
    if (preferences) {
      savePreferences.mutate({ ...preferences, language })
    }
  }

  // Determine the current language value for the select
  const currentLanguageValue = preferences?.language ?? 'system'

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.appearance.language')}>
        <SettingsField
          label={t('preferences.appearance.language')}
          description={t('preferences.appearance.languageDescription')}
        >
          <Select
            value={currentLanguageValue}
            onValueChange={handleLanguageChange}
            disabled={savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="system">{t('preferences.appearance.language.system')}</SelectItem>
              {availableLanguages.map(lang => (
                <SelectItem key={lang} value={lang}>
                  {languageNames[lang] ?? lang}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.appearance.theme')}>
        <SettingsField
          label={t('preferences.appearance.colorTheme')}
          description={t('preferences.appearance.colorThemeDescription')}
        >
          <Select value={colorMode} onValueChange={handleThemeChange} disabled={savePreferences.isPending}>
            <SelectTrigger>
              <SelectValue placeholder={t('preferences.appearance.selectTheme')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">{t('preferences.appearance.theme.light')}</SelectItem>
              <SelectItem value="dark">{t('preferences.appearance.theme.dark')}</SelectItem>
              <SelectItem value="system">{t('preferences.appearance.theme.system')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>

        <SettingsField
          label={t('preferences.appearance.themePack.label')}
          description={t('preferences.appearance.themePack.description')}
        >
          <Select value={preferences?.theme_palette ?? themePack} onValueChange={handleThemePackChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {themePacks.map(pack => (
                <SelectItem key={pack.id} value={pack.id}>
                  {t(pack.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection
        title={
          <div className="flex items-center justify-between">
            <span>{t('preferences.appearance.moods.title')}</span>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  const defaults = getMoodCandidatesForLocale(currentLocale, DEFAULT_MOOD_CANDIDATES)
                  setMoodText(defaults.join('\n'))

                  if (!preferences) return
                  const updated = {
                    ...(preferences.mood_candidates ?? DEFAULT_MOOD_CANDIDATES),
                    [currentLocale]: defaults,
                  }
                  savePreferences.mutate({ ...preferences, mood_candidates: updated })
                }}
                disabled={!preferences || savePreferences.isPending}
              >
                {t('common.reset')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (!preferences) return
                  const lines = moodText.split(/\r?\n/).reduce<string[]>((acc, raw) => {
                    if (acc.length >= 10) return acc
                    const trimmed = raw.trim()
                    if (!trimmed) return acc
                    const normalized = trimmed.length > 140 ? trimmed.slice(0, 140) : trimmed
                    acc.push(normalized)
                    return acc
                  }, [])

                  const updated = {
                    ...(preferences.mood_candidates ?? DEFAULT_MOOD_CANDIDATES),
                    [currentLocale]: lines,
                  }

                  savePreferences.mutate({ ...preferences, mood_candidates: updated })
                }}
                disabled={!preferences || savePreferences.isPending}
              >
                {t('preferences.appearance.moods.save')}
              </Button>
            </div>
          </div>
        }
      >
        <SettingsField
          label={t('preferences.appearance.moods.label')}
          description={t('preferences.appearance.moods.description')}
        >
          <Textarea
            className="min-h-[140px]"
            value={moodText}
            onChange={e => setMoodText(e.target.value)}
            placeholder={getMoodCandidatesForLocale(currentLocale, DEFAULT_MOOD_CANDIDATES).join('\n')}
          />
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
