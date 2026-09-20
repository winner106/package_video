import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getName, getVersion } from '@tauri-apps/api/app'
import { relaunch } from '@tauri-apps/plugin-process'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { Info } from 'lucide-react'
import Logo from '@/assets/logo.svg?react'
import { Button } from '@/components/ui/button'
import { notify } from '@/lib/notifications'
import { logger } from '@/lib/logger'
import { SettingsSection, SettingsField } from '../shared/SettingsComponents'

type UpdateStatus = 'idle' | 'checking' | 'upToDate' | 'available' | 'installing' | 'installed' | 'error'

export function AboutPane() {
  const { t } = useTranslation()
  const [appName, setAppName] = useState<string>((import.meta.env.VITE_APP_NAME as string | undefined) ?? 'Tauri App')
  const [version, setVersion] = useState<string>((import.meta.env.VITE_APP_VERSION as string | undefined) ?? '0.0.0')
  const description =
    (import.meta.env.VITE_APP_DESCRIPTION as string | undefined) ?? t('preferences.about.noDescription')
  const author = ((import.meta.env.VITE_APP_AUTHOR as string | undefined) ?? '').trim()

  const updateRef = useRef<Update | null>(null)
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [availableUpdate, setAvailableUpdate] = useState<{ version: string; date?: string; body?: string } | null>(null)

  useEffect(() => {
    const loadMeta = async () => {
      try {
        const results = await Promise.allSettled([getName(), getVersion()])
        const [nameResult, versionResult] = results

        if (nameResult.status === 'fulfilled' && nameResult.value) setAppName(nameResult.value)
        if (versionResult.status === 'fulfilled' && versionResult.value) setVersion(versionResult.value)
      } catch {
        // swallow errors, keep defaults
      }
    }
    loadMeta()
  }, [])

  const closeUpdateResource = useCallback(async () => {
    const existing = updateRef.current
    if (!existing) return
    updateRef.current = null
    try {
      await existing.close()
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    return () => {
      void closeUpdateResource()
    }
  }, [closeUpdateResource])

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking')
    setAvailableUpdate(null)
    await closeUpdateResource()

    await notify(t('preferences.about.updates.checkingTitle'), t('preferences.about.updates.checkingDescription'), {
      type: 'info',
      duration: 0,
      id: 'about-update-check',
    })

    try {
      const update = await check()
      if (update) {
        updateRef.current = update
        setAvailableUpdate({ version: update.version, date: update.date, body: update.body })
        setUpdateStatus('available')
        await notify(
          t('preferences.about.updates.availableTitle'),
          t('preferences.about.updates.availableDescription', { version: update.version }),
          { type: 'info', id: 'about-update-check' }
        )
      } else {
        setUpdateStatus('upToDate')
        await notify(t('preferences.about.updates.upToDateTitle'), t('preferences.about.updates.upToDateDescription'), {
          type: 'success',
          id: 'about-update-check',
        })
      }
    } catch (error) {
      logger.error('Manual update check failed', { error })
      setUpdateStatus('error')
      await notify(t('preferences.about.updates.failedTitle'), t('preferences.about.updates.failedDescription'), {
        type: 'error',
        id: 'about-update-check',
      })
    }
  }

  const handleInstallUpdate = async () => {
    const update = updateRef.current
    if (!update) return

    setUpdateStatus('installing')
    await notify(t('preferences.about.updates.installingTitle'), t('preferences.about.updates.installingDescription'), {
      type: 'info',
      duration: 0,
      id: 'about-update-install',
    })

    try {
      await update.downloadAndInstall()
      setUpdateStatus('installed')
      await notify(t('preferences.about.updates.installedTitle'), t('preferences.about.updates.installedDescription'), {
        type: 'success',
        id: 'about-update-install',
      })
    } catch (error) {
      logger.error('Update install failed', { error })
      setUpdateStatus('error')
      await notify(
        t('preferences.about.updates.installFailedTitle'),
        t('preferences.about.updates.installFailedDescription'),
        {
          type: 'error',
          id: 'about-update-install',
        }
      )
    } finally {
      await closeUpdateResource()
    }
  }

  const handleRelaunch = async () => {
    try {
      await relaunch()
    } catch (error) {
      logger.error('Failed to relaunch app after update', { error })
      await notify(
        t('preferences.about.updates.relaunchFailedTitle'),
        t('preferences.about.updates.relaunchFailedDescription'),
        {
          type: 'error',
        }
      )
    }
  }

  const updateStatusLabel =
    updateStatus === 'checking'
      ? t('preferences.about.updates.statusChecking')
      : updateStatus === 'installing'
        ? t('preferences.about.updates.statusInstalling')
        : updateStatus === 'installed'
          ? t('preferences.about.updates.statusInstalled')
          : updateStatus === 'available' && availableUpdate
            ? t('preferences.about.updates.statusAvailable', { version: availableUpdate.version })
            : updateStatus === 'upToDate'
              ? t('preferences.about.updates.statusUpToDate')
              : updateStatus === 'error'
                ? t('preferences.about.updates.statusError')
                : t('preferences.about.updates.statusIdle')

  return (
    <div className="space-y-6">
      <SettingsSection title={t('preferences.about')}>
        <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/40 p-4">
          <Logo className="h-12 w-12 text-primary" aria-hidden />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <span>{appName}</span>
              <span className="text-xs text-muted-foreground">v{version}</span>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-border bg-muted/20 p-4 md:grid-cols-2">
          <SettingsField label={t('preferences.about.version')} description={t('preferences.about.versionDescription')}>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span>{version}</span>
            </div>
          </SettingsField>
          <SettingsField label={t('preferences.about.author')} description={t('preferences.about.authorDescription')}>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <Info className="h-4 w-4 text-muted-foreground" aria-hidden />
              <span>{author || t('preferences.about.authorPlaceholder')}</span>
            </div>
          </SettingsField>
          <div className="md:col-span-2">
            <SettingsField
              label={t('preferences.about.description')}
              description={t('preferences.about.descriptionHelp')}
            >
              <div className="text-sm text-foreground">{description}</div>
            </SettingsField>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title={t('preferences.about.updates.title')}>
        <SettingsField label={t('preferences.about.updates.label')} description={t('preferences.about.updates.help')}>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm text-foreground">{updateStatusLabel}</div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCheckForUpdates}
                  disabled={updateStatus === 'checking' || updateStatus === 'installing'}
                >
                  {t('preferences.about.updates.check')}
                </Button>

                {(updateStatus === 'available' || updateStatus === 'installing') && (
                  <Button size="sm" onClick={handleInstallUpdate} disabled={updateStatus === 'installing'}>
                    {t('preferences.about.updates.install')}
                  </Button>
                )}

                {updateStatus === 'installed' && (
                  <Button size="sm" onClick={handleRelaunch}>
                    {t('preferences.about.updates.relaunch')}
                  </Button>
                )}
              </div>
            </div>

            {availableUpdate?.body ? (
              <div className="rounded-md border border-border bg-background/50 p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                {availableUpdate.body}
              </div>
            ) : null}
          </div>
        </SettingsField>
      </SettingsSection>
    </div>
  )
}
