import { Toaster } from 'sonner'

import { CommandPalette } from '@/components/command-palette/CommandPalette'
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog'
import { TitleBar } from '@/components/titlebar/TitleBar'
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { useIsWindows } from '@/hooks/use-platform'
import { useTheme } from '@/hooks/use-theme'
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners'
import {
  ENABLE_LEFT_ACTIVITY_BAR,
  ENABLE_LEFT_SIDEBAR,
  ENABLE_RIGHT_ACTIVITY_BAR,
  ENABLE_RIGHT_SIDEBAR,
  ENABLE_STATUS_BAR,
} from '@/lib/features'
import { cn } from '@/lib/utils'
import { useUIStore } from '@/store/ui-store'
import { LeftActivityBar } from './LeftActivityBar'
import { RightActivityBar } from './RightActivityBar'
import { LeftSideBar } from './LeftSideBar'
import { MainWindowContent } from './MainWindowContent'
import { RightSideBar } from './RightSideBar'
import { StatusBar } from './StatusBar'

/**
 * Layout sizing configuration for resizable panels.
 * All values are percentages of total width.
 * Sidebar defaults + main default must equal 100.
 */
const LAYOUT = {
  leftSidebar: { default: 20, min: 15, max: 40 },
  rightSidebar: { default: 20, min: 15, max: 40 },
  main: { min: 30 },
} as const

// Main content default is calculated to ensure totals sum to 100%
const MAIN_CONTENT_DEFAULT =
  100 -
  (ENABLE_LEFT_SIDEBAR ? LAYOUT.leftSidebar.default : 0) -
  (ENABLE_RIGHT_SIDEBAR ? LAYOUT.rightSidebar.default : 0)

export function MainWindow() {
  const { colorMode } = useTheme()
  const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)
  const rightSidebarVisible = useUIStore(state => state.rightSidebarVisible)
  const statusBarVisible = useUIStore(state => state.statusBarVisible)
  const isWindows = useIsWindows()

  // Set up global event listeners (keyboard shortcuts, etc.)
  useMainWindowEventListeners()

  return (
    <div className={cn('flex h-screen w-full flex-col overflow-hidden bg-background', !isWindows && 'rounded-xl')}>
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        {ENABLE_LEFT_ACTIVITY_BAR && <LeftActivityBar />}

        <ResizablePanelGroup direction="horizontal">
          {ENABLE_LEFT_SIDEBAR && (
            <>
              <ResizablePanel
                defaultSize={LAYOUT.leftSidebar.default}
                minSize={LAYOUT.leftSidebar.min}
                maxSize={LAYOUT.leftSidebar.max}
                className={cn(!leftSidebarVisible && 'hidden')}
              >
                <LeftSideBar />
              </ResizablePanel>

              <ResizableHandle className={cn(!leftSidebarVisible && 'hidden')} />
            </>
          )}

          <ResizablePanel defaultSize={MAIN_CONTENT_DEFAULT} minSize={LAYOUT.main.min}>
            <MainWindowContent />
          </ResizablePanel>

          {ENABLE_RIGHT_SIDEBAR && (
            <>
              <ResizableHandle className={cn(!rightSidebarVisible && 'hidden')} />

              <ResizablePanel
                defaultSize={LAYOUT.rightSidebar.default}
                minSize={LAYOUT.rightSidebar.min}
                maxSize={LAYOUT.rightSidebar.max}
                className={cn(!rightSidebarVisible && 'hidden')}
              >
                <RightSideBar />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {ENABLE_RIGHT_ACTIVITY_BAR && <RightActivityBar />}
      </div>

      {ENABLE_STATUS_BAR && statusBarVisible && <StatusBar />}

      {/* Global UI Components (hidden until triggered) */}
      <CommandPalette />
      <PreferencesDialog />
      <Toaster
        position="bottom-right"
        theme={colorMode === 'dark' ? 'dark' : colorMode === 'light' ? 'light' : 'system'}
        richColors
        className="toaster group"
        toastOptions={{
          duration: 3500,
          classNames: {
            toast: 'group toast border shadow-lg',
            actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
      />
    </div>
  )
}
