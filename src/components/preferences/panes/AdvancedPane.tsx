import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { open } from '@tauri-apps/plugin-dialog'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { checkAutoStartEnabled, disableAutoStart, enableAutoStart } from '@/services/autostart'
import { logger } from '@/lib/logger'
import { SettingsField, SettingsSection } from '../shared/SettingsComponents'
import { ENABLE_EXAMPLE_PREFERENCES } from '@/lib/features'

export function AdvancedPane() {
  const { t } = useTranslation()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences({ toastOnSuccess: false })

  // Example settings (not persisted)
  const [exampleAdvancedToggle, setExampleAdvancedToggle] = useState(false)
  const [exampleDropdown, setExampleDropdown] = useState('option1')
  const [recordingDirectoryInput, setRecordingDirectoryInput] = useState('')

  // Autostart state
  const [isAutoStartEnabled, setIsAutoStartEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setRecordingDirectoryInput(preferences?.recording_directory ?? '')
  }, [preferences?.recording_directory])

  // Initialize autostart status
  useEffect(() => {
    async function checkStatus() {
      try {
        setIsLoading(true)
        const enabled = await checkAutoStartEnabled()
        setIsAutoStartEnabled(enabled)
      } catch (error) {
        logger.error('Failed to check autostart status', { error })
      } finally {
        setIsLoading(false)
      }
    }
    checkStatus()
  }, [])

  const handleAutoStartChange = async (enabled: boolean) => {
    try {
      if (enabled) {
        await enableAutoStart()
      } else {
        await disableAutoStart()
      }

      setIsAutoStartEnabled(enabled)

      if (preferences) {
        savePreferences.mutate({
          ...preferences,
          auto_start: enabled,
        })
      }

      toast.success(enabled ? t('toast.autostart.enabled') : t('toast.autostart.disabled'))
    } catch (error) {
      logger.error('Failed to change autostart setting', { error })
      toast.error(t('toast.error.generic'))
    }
  }

  const handleSilentStartChange = (enabled: boolean) => {
    if (!preferences) return
    savePreferences.mutate({
      ...preferences,
      silent_start: enabled,
    })
    toast.success(enabled ? t('toast.autostart.enabled') : t('toast.autostart.disabled'))
  }

  const handleCloseBehaviorChange = (value: 'ask' | 'minimizeToTray' | 'quit') => {
    if (!preferences) return
    savePreferences.mutate(
      {
        ...preferences,
        close_behavior: value,
      },
      {
        onSuccess: () => {
          toast.success(t('toast.success.preferencesSaved'))
        },
        onError: () => {
          toast.error(t('toast.error.generic'))
        },
      }
    )
  }

  const handleBrowseRecordingDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
      })

      if (!selected || Array.isArray(selected)) {
        return
      }

      setRecordingDirectoryInput(selected)
    } catch (error) {
      logger.error('Failed to select recording directory', { error })
      toast.error(t('toast.error.generic'))
    }
  }

  const handleSaveRecordingDirectory = () => {
    if (!preferences) {
      return
    }

    const trimmed = recordingDirectoryInput.trim()
    savePreferences.mutate(
      {
        ...preferences,
        recording_directory: trimmed || null,
      },
      {
        onSuccess: () => {
          toast.success(t('toast.success.preferencesSaved'))
        },
        onError: () => {
          toast.error(t('toast.error.preferencesSaved'))
        },
      }
    )
  }

  const handleResetRecordingDirectory = () => {
    if (!preferences) {
      return
    }

    setRecordingDirectoryInput('')
    savePreferences.mutate(
      {
        ...preferences,
        recording_directory: null,
      },
      {
        onSuccess: () => {
          toast.success(t('toast.success.preferencesSaved'))
        },
        onError: () => {
          toast.error(t('toast.error.preferencesSaved'))
        },
      }
    )
  }

  return (
    <div className="space-y-6">
      {/* Startup settings */}
      <SettingsSection title={t('preferences.advanced.autostart.title')}>
        <SettingsField
          label={t('preferences.advanced.autostart.label')}
          description={t('preferences.advanced.autostart.description')}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="autostart-toggle"
              checked={isAutoStartEnabled}
              onCheckedChange={handleAutoStartChange}
              disabled={isLoading}
            />
            <Label htmlFor="autostart-toggle" className="text-sm">
              {isAutoStartEnabled ? t('common.enabled') : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>

        <SettingsField
          label={t('preferences.advanced.silentStart.label')}
          description={t('preferences.advanced.silentStart.description')}
        >
          <div className="flex items-center space-x-2">
            <Switch
              id="silent-start-toggle"
              checked={preferences?.silent_start ?? false}
              onCheckedChange={handleSilentStartChange}
              disabled={!preferences || savePreferences.isPending}
            />
            <Label htmlFor="silent-start-toggle" className="text-sm">
              {(preferences?.silent_start ?? false) ? t('common.enabled') : t('common.disabled')}
            </Label>
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Close/exit settings */}
      <SettingsSection title={t('preferences.advanced.close.title')}>
        <SettingsField
          label={t('preferences.advanced.closeBehavior.label')}
          description={t('preferences.advanced.closeBehavior.description')}
        >
          <Select
            value={preferences?.close_behavior ?? 'ask'}
            onValueChange={value => handleCloseBehaviorChange(value as 'ask' | 'minimizeToTray' | 'quit')}
            disabled={!preferences || savePreferences.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ask">{t('preferences.advanced.closeBehavior.ask')}</SelectItem>
              <SelectItem value="minimizeToTray">{t('preferences.advanced.closeBehavior.minimizeToTray')}</SelectItem>
              <SelectItem value="quit">{t('preferences.advanced.closeBehavior.quit')}</SelectItem>
            </SelectContent>
          </Select>
        </SettingsField>
      </SettingsSection>

      <SettingsSection title={t('preferences.advanced.recording.title')}>
        <SettingsField
          label={t('preferences.advanced.recording.directory.label')}
          description={t('preferences.advanced.recording.directory.description')}
        >
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                value={recordingDirectoryInput}
                onChange={event => setRecordingDirectoryInput(event.target.value)}
                placeholder={t('preferences.advanced.recording.directory.placeholder')}
                disabled={!preferences || savePreferences.isPending}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleBrowseRecordingDirectory}
                disabled={!preferences || savePreferences.isPending}
              >
                {t('preferences.advanced.recording.directory.browse')}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleSaveRecordingDirectory}
                disabled={!preferences || savePreferences.isPending}
              >
                {t('preferences.advanced.recording.directory.save')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleResetRecordingDirectory}
                disabled={!preferences || savePreferences.isPending}
              >
                {t('preferences.advanced.recording.directory.reset')}
              </Button>
            </div>
          </div>
        </SettingsField>
      </SettingsSection>

      {/* Example settings */}
      {ENABLE_EXAMPLE_PREFERENCES && (
        <SettingsSection title={t('preferences.advanced.title')}>
          <SettingsField
            label={t('preferences.advanced.toggle')}
            description={t('preferences.advanced.toggleDescription')}
          >
            <div className="flex items-center space-x-2">
              <Switch
                id="example-advanced-toggle"
                checked={exampleAdvancedToggle}
                onCheckedChange={setExampleAdvancedToggle}
              />
              <Label htmlFor="example-advanced-toggle" className="text-sm">
                {exampleAdvancedToggle ? t('common.enabled') : t('common.disabled')}
              </Label>
            </div>
          </SettingsField>

          <SettingsField
            label={t('preferences.advanced.dropdown')}
            description={t('preferences.advanced.dropdownDescription')}
          >
            <Select value={exampleDropdown} onValueChange={setExampleDropdown}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="option1">{t('preferences.advanced.option1')}</SelectItem>
                <SelectItem value="option2">{t('preferences.advanced.option2')}</SelectItem>
                <SelectItem value="option3">{t('preferences.advanced.option3')}</SelectItem>
              </SelectContent>
            </Select>
          </SettingsField>
        </SettingsSection>
      )}
    </div>
  )
}
