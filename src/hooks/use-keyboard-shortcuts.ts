import { useEffect } from 'react'
import { useUIStore } from '@/store/ui-store'
import type { CommandContext } from '@/lib/commands/types'
import { ENABLE_LEFT_SIDEBAR, ENABLE_RIGHT_SIDEBAR } from '@/lib/features'
import { executeCommand } from '@/lib/commands'

/**
 * Handles global keyboard shortcuts for the application.
 *
 * Currently handles:
 * - Cmd/Ctrl+, : Open preferences
 * - Cmd/Ctrl+1 : Toggle left sidebar
 * - Cmd/Ctrl+2 : Toggle right sidebar
 * - Alt+Enter : Toggle maximize
 * - Alt+Shift+M : Hide to tray
 * - Alt+Shift+T : Toggle always-on-top
 * - Cmd/Ctrl+W : Close window
 * - Cmd/Ctrl+M : Minimize window
 */
export function useKeyboardShortcuts(commandContext: CommandContext) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Alt-based shortcuts
      if (e.altKey) {
        if (!e.metaKey && !e.ctrlKey && e.key === 'Enter') {
          e.preventDefault()
          void executeCommand('window-toggle-maximize', commandContext)
          return
        }

        if (e.shiftKey && !e.metaKey && !e.ctrlKey) {
          switch (e.key.toLowerCase()) {
            case 'm': {
              e.preventDefault()
              void executeCommand('window-hide-to-tray', commandContext)
              return
            }
            case 't': {
              e.preventDefault()
              void executeCommand('window-toggle-always-on-top', commandContext)
              return
            }
            default:
          }
        }
      }

      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case ',': {
            e.preventDefault()
            commandContext.openPreferences()
            break
          }
          case 'w': {
            e.preventDefault()
            void executeCommand('window-close', commandContext)
            break
          }
          case '1': {
            e.preventDefault()
            if (!ENABLE_LEFT_SIDEBAR) break
            const { leftSidebarVisible, setLeftSidebarVisible } = useUIStore.getState()
            setLeftSidebarVisible(!leftSidebarVisible)
            break
          }
          case '2': {
            e.preventDefault()
            if (!ENABLE_RIGHT_SIDEBAR) break
            const { rightSidebarVisible, setRightSidebarVisible } = useUIStore.getState()
            setRightSidebarVisible(!rightSidebarVisible)
            break
          }
          case 'm': {
            e.preventDefault()
            void executeCommand('window-minimize', commandContext)
            break
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [commandContext])
}
