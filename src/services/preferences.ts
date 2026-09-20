import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { logger } from '@/lib/logger'
import { commands, type AppPreferences } from '@/lib/tauri-bindings'
import { DEFAULT_MOOD_CANDIDATES } from '@/lib/moods'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// Query keys for preferences
export const preferencesQueryKeys = {
  all: ['preferences'] as const,
  preferences: () => [...preferencesQueryKeys.all] as const,
}

// TanStack Query hooks following the architectural patterns
export function usePreferences() {
  const defaultPreferences: AppPreferences = {
    theme: 'system',
    auto_start: false,
    quick_pane_shortcut: null,
    language: null,
    close_behavior: 'ask',
    theme_palette: 'default',
    silent_start: false,
    mood_candidates: DEFAULT_MOOD_CANDIDATES,
    recording_directory: null,
  }

  const normalizePreferences = (preferences: AppPreferences): AppPreferences => ({
    ...defaultPreferences,
    ...preferences,
    close_behavior: preferences.close_behavior ?? 'ask',
    auto_start: preferences.auto_start ?? false,
    theme_palette: preferences.theme_palette ?? 'default',
    silent_start: preferences.silent_start ?? false,
    mood_candidates: preferences.mood_candidates ?? DEFAULT_MOOD_CANDIDATES,
    recording_directory: preferences.recording_directory ?? null,
  })

  return useQuery({
    queryKey: preferencesQueryKeys.preferences(),
    queryFn: async (): Promise<AppPreferences> => {
      logger.debug('Loading preferences from backend')
      const result = await commands.loadPreferences()

      if (result.status === 'error') {
        // Return defaults if preferences file doesn't exist yet
        logger.warn('Failed to load preferences, using defaults', {
          error: result.error,
        })
        return defaultPreferences
      }

      logger.info('Preferences loaded successfully', {
        preferences: result.data,
      })
      return normalizePreferences(result.data)
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  })
}

interface SavePreferencesOptions {
  /** Show the generic success toast when saving completes. Defaults to true. */
  toastOnSuccess?: boolean
  /** Override the success message key. Defaults to toast.success.preferencesSaved */
  successMessageKey?: string
  /** Optional description to include in the success toast. */
  successDescription?: string
}

export function useSavePreferences(options?: SavePreferencesOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const toastOnSuccess = options?.toastOnSuccess ?? true
  const successMessageKey = options?.successMessageKey ?? 'toast.success.preferencesSaved'
  const successDescription = options?.successDescription

  return useMutation({
    mutationFn: async (preferences: AppPreferences) => {
      logger.debug('Saving preferences to backend', { preferences })
      const result = await commands.savePreferences(preferences)

      if (result.status === 'error') {
        logger.error('Failed to save preferences', {
          error: result.error,
          preferences,
        })
        toast.error(t('toast.error.preferencesSaved'), { description: result.error })
        throw new Error(result.error)
      }

      logger.info('Preferences saved successfully')
    },
    onSuccess: (_, preferences) => {
      // Update the cache with the new preferences
      queryClient.setQueryData(preferencesQueryKeys.preferences(), preferences)
      logger.info('Preferences cache updated')
      if (toastOnSuccess) {
        toast.success(t(successMessageKey), successDescription ? { description: successDescription } : undefined)
      }
    },
  })
}
