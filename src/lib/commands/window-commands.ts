import type { AppCommand } from './types'
import { getCurrentWindow } from '@tauri-apps/api/window'
import i18n from '@/i18n/config'
import { getPlatform } from '@/hooks/use-platform'
import { useUIStore } from '@/store/ui-store'

export const windowCommands: AppCommand[] = [
  {
    id: 'window-close',
    labelKey: 'commands.windowClose.label',
    descriptionKey: 'commands.windowClose.description',
    shortcut: 'CommandOrControl+W',

    execute: async context => {
      try {
        const appWindow = getCurrentWindow()
        await appWindow.close()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.showToast(i18n.t('toast.error.windowCloseFailed', { message }), 'error')
      }
    },
  },
  {
    id: 'window-hide-to-tray',
    labelKey: 'commands.windowHideToTray.label',
    descriptionKey: 'commands.windowHideToTray.description',
    shortcut: 'Alt+Shift+M',
    group: 'window',
    keywords: ['tray', 'hide', 'minimize'],

    execute: async context => {
      try {
        const appWindow = getCurrentWindow()
        await appWindow.hide()
        const platform = getPlatform()
        if (platform === 'linux') {
          // Subtle heads-up: some Linux DEs hide windows without a tray restore path
          context.showToast(i18n.t('toast.info.windowHiddenLinux'), 'info')
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.showToast(i18n.t('toast.error.windowHideFailed', { message }), 'error')
      }
    },
  },
  {
    id: 'window-toggle-always-on-top',
    labelKey: 'commands.windowToggleAlwaysOnTop.label',
    descriptionKey: 'commands.windowToggleAlwaysOnTop.description',
    group: 'window',
    shortcut: 'Alt+Shift+T',
    keywords: ['pin', 'top', 'always'],

    execute: async context => {
      try {
        const appWindow = getCurrentWindow()
        const current = await appWindow.isAlwaysOnTop()
        await appWindow.setAlwaysOnTop(!current)
        const { setAlwaysOnTop } = useUIStore.getState()
        setAlwaysOnTop(!current)
        context.showToast(
          !current ? i18n.t('toast.success.windowPinned') : i18n.t('toast.success.windowUnpinned'),
          'success',
          { duration: 2000, id: 'window-always-on-top' }
        )
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.showToast(i18n.t('toast.error.windowAlwaysOnTopFailed', { message }), 'error')
      }
    },
  },

  {
    id: 'window-minimize',
    labelKey: 'commands.windowMinimize.label',
    descriptionKey: 'commands.windowMinimize.description',
    shortcut: 'CommandOrControl+M',

    execute: async context => {
      try {
        const appWindow = getCurrentWindow()
        await appWindow.minimize()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.showToast(i18n.t('toast.error.windowMinimizeFailed', { message }), 'error')
      }
    },
  },

  {
    id: 'window-toggle-maximize',
    labelKey: 'commands.windowToggleMaximize.label',
    descriptionKey: 'commands.windowToggleMaximize.description',
    shortcut: 'Alt+Enter',

    execute: async context => {
      try {
        const appWindow = getCurrentWindow()
        await appWindow.toggleMaximize()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.showToast(i18n.t('toast.error.windowMaximizeFailed', { message }), 'error')
      }
    },
  },

  {
    id: 'window-fullscreen',
    labelKey: 'commands.windowFullscreen.label',
    descriptionKey: 'commands.windowFullscreen.description',
    shortcut: 'F11',

    execute: async context => {
      try {
        const appWindow = getCurrentWindow()
        await appWindow.setFullscreen(true)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.showToast(i18n.t('toast.error.fullscreenEnterFailed', { message }), 'error')
      }
    },
  },

  {
    id: 'window-exit-fullscreen',
    labelKey: 'commands.windowExitFullscreen.label',
    descriptionKey: 'commands.windowExitFullscreen.description',
    shortcut: 'Escape',

    execute: async context => {
      try {
        const appWindow = getCurrentWindow()
        await appWindow.setFullscreen(false)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        context.showToast(i18n.t('toast.error.fullscreenExitFailed', { message }), 'error')
      }
    },
  },
]
