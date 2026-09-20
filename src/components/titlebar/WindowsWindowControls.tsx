import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useCommandContext } from '@/hooks/use-command-context'
import { useIsWindows } from '@/hooks/use-platform'
import { executeCommand } from '@/lib/commands'
import { commands } from '@/lib/tauri-bindings'
import { cn } from '@/lib/utils'
import { usePreferences, useSavePreferences } from '@/services/preferences'
import { useUIStore } from '@/store/ui-store'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { WindowsIcons } from './WindowControlIcons'

/**
 * Windows-style window control buttons (minimize, maximize/restore, close).
 * Positioned on the RIGHT side of the title bar, following Windows conventions.
 */
export function WindowsWindowControls() {
  const { t, i18n } = useTranslation()
  const context = useCommandContext()
  const isWindows = useIsWindows()
  const { data: preferences } = usePreferences()
  const savePreferences = useSavePreferences()
  const [isMaximized, setIsMaximized] = useState(false)
  const isAlwaysOnTop = useUIStore(state => state.isAlwaysOnTop)
  const setIsAlwaysOnTop = useUIStore(state => state.setAlwaysOnTop)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [dontAskAgain, setDontAskAgain] = useState(false)

  // Initialize and sync maximized state with actual window state
  useEffect(() => {
    const appWindow = getCurrentWindow()

    // Query initial state
    appWindow
      .isMaximized()
      .then(setIsMaximized)
      .catch(() => {
        // Ignore errors - window may not be ready
      })

    appWindow
      .isAlwaysOnTop()
      .then(setIsAlwaysOnTop)
      .catch(() => {
        // Ignore errors - window may not be ready
      })

    // Subscribe to resize events to keep state in sync
    // (handles maximize/unmaximize via title bar double-click, etc.)
    let aborted = false
    let resolvedUnsub: (() => void) | null = null

    appWindow
      .onResized(async () => {
        try {
          const [maximized, alwaysOnTop] = await Promise.all([appWindow.isMaximized(), appWindow.isAlwaysOnTop()])
          if (!aborted) {
            setIsMaximized(maximized)
            setIsAlwaysOnTop(alwaysOnTop)
          }
        } catch {
          // Ignore errors during cleanup
        }
      })
      .then(unsub => {
        // If already aborted, unsubscribe immediately
        if (aborted) {
          unsub()
        } else {
          resolvedUnsub = unsub
        }
      })

    return () => {
      aborted = true
      // If unsubscribe has resolved, call it; otherwise it will be called in the then handler
      if (resolvedUnsub) {
        resolvedUnsub()
      }
    }
  }, [setIsAlwaysOnTop])

  const handleClose = async () => {
    // Only prompt on Windows; other platforms keep existing behavior
    if (!isWindows) {
      await executeCommand('window-close', context)
      return
    }

    const behavior = preferences?.close_behavior ?? 'ask'

    if (behavior === 'minimizeToTray') {
      await performCloseBehavior('minimizeToTray')
      return
    }

    if (behavior === 'quit') {
      await executeCommand('window-close', context)
      return
    }

    // Otherwise ask the user
    setCloseDialogOpen(true)
  }

  const handleMinimize = async () => {
    await executeCommand('window-minimize', context)
  }

  const handleMaximizeToggle = async () => {
    try {
      const appWindow = getCurrentWindow()
      const maximized = await appWindow.isMaximized()
      if (maximized) {
        await appWindow.unmaximize()
        setIsMaximized(false)
      } else {
        await appWindow.maximize()
        setIsMaximized(true)
      }
    } catch {
      await executeCommand('window-toggle-maximize', context)
    }
  }

  const handleAlwaysOnTopToggle = async () => {
    try {
      const appWindow = getCurrentWindow()
      const alwaysOnTop = await appWindow.isAlwaysOnTop()
      await appWindow.setAlwaysOnTop(!alwaysOnTop)
      setIsAlwaysOnTop(!alwaysOnTop)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.error.generic')
      context.showToast(t('toast.error.windowAlwaysOnTopFailed', { message }), 'error')
    }
  }

  const refreshTrayMenu = async () => {
    const lang = preferences?.language ?? i18n.language ?? 'en'
    try {
      await commands.trayUpdateLang(lang)
    } catch {
      // Tray refresh is best-effort; ignore failures
    }
  }

  const performCloseBehavior = async (behavior: 'quit' | 'minimizeToTray') => {
    if (behavior === 'minimizeToTray') {
      try {
        const appWindow = getCurrentWindow()
        await appWindow.hide()
        await refreshTrayMenu()
      } catch (error) {
        const message = error instanceof Error ? error.message : t('toast.error.generic')
        context.showToast(t('toast.error.windowMinimizeFailed', { message }), 'error')
      }
      return
    }

    await executeCommand('window-close', context)
  }

  const persistCloseBehavior = async (behavior: 'quit' | 'minimizeToTray') => {
    if (!dontAskAgain || !preferences) return

    const updated = { ...preferences, close_behavior: behavior }
    try {
      await savePreferences.mutateAsync(updated)
    } catch (error) {
      const message = error instanceof Error ? error.message : t('toast.error.generic')
      context.showToast(message, 'error')
    }
  }

  const handleCloseChoice = async (behavior: 'quit' | 'minimizeToTray') => {
    setCloseDialogOpen(false)
    await persistCloseBehavior(behavior)
    await performCloseBehavior(behavior)
    setDontAskAgain(false)
  }

  // Base button styles for Windows controls
  const buttonClass = 'flex h-8 w-12 items-center justify-center transition-colors'

  return (
    <div className="flex">
      {/* AlwaysOnTop */}
      <button
        type="button"
        onClick={handleAlwaysOnTopToggle}
        className={cn(buttonClass, 'hover:bg-foreground/10')}
        title={isAlwaysOnTop ? t('titlebar.disableAlwaysOnTop') : t('titlebar.enableAlwaysOnTop')}
        aria-label={isAlwaysOnTop ? t('titlebar.disableAlwaysOnTop') : t('titlebar.enableAlwaysOnTop')}
      >
        <WindowsIcons.alwaysOnTop
          className={cn('h-4 w-4 transition-transform', isAlwaysOnTop && 'rotate-45')}
          fill={isAlwaysOnTop ? '#22c55e' : 'none'}
          stroke={isAlwaysOnTop ? '#16a34a' : 'currentColor'}
        />
      </button>

      {/* Minimize */}
      <button
        type="button"
        onClick={handleMinimize}
        className={cn(buttonClass, 'hover:bg-foreground/10')}
        title={t('titlebar.minimize')}
        aria-label={t('titlebar.minimize')}
      >
        <WindowsIcons.minimize />
      </button>

      {/* Maximize/Restore */}
      <button
        type="button"
        onClick={handleMaximizeToggle}
        className={cn(buttonClass, 'hover:bg-foreground/10')}
        title={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
        aria-label={isMaximized ? t('titlebar.restore') : t('titlebar.maximize')}
      >
        {isMaximized ? <WindowsIcons.restore /> : <WindowsIcons.maximize />}
      </button>

      {/* Close */}
      <button
        type="button"
        onClick={handleClose}
        className={cn(buttonClass, 'hover:bg-destructive hover:text-destructive-foreground')}
        title={t('titlebar.close')}
        aria-label={t('titlebar.close')}
      >
        <WindowsIcons.close />
      </button>

      <Dialog
        open={closeDialogOpen}
        onOpenChange={open => {
          setCloseDialogOpen(open)
          if (!open) {
            setDontAskAgain(false)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('titlebar.closeConfirm.title')}</DialogTitle>
            <DialogDescription>{t('titlebar.closeConfirm.description')}</DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Checkbox
                id="close-dont-ask"
                checked={dontAskAgain}
                onCheckedChange={value => setDontAskAgain(Boolean(value))}
              />
              <Label htmlFor="close-dont-ask" className="cursor-pointer text-sm leading-tight">
                {t('titlebar.closeConfirm.remember')}
              </Label>
            </div>
          </div>

          <DialogFooter className="flex w-full flex-col gap-2 sm:flex-row sm:justify-end sm:gap-3">
            <Button
              variant="secondary"
              onClick={() => void handleCloseChoice('minimizeToTray')}
              disabled={savePreferences.isPending}
            >
              {t('titlebar.closeConfirm.minimize')}
            </Button>
            <Button onClick={() => void handleCloseChoice('quit')} disabled={savePreferences.isPending}>
              {t('titlebar.closeConfirm.quit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
