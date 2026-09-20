import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { ENABLE_LEFT_SIDEBAR, ENABLE_RIGHT_SIDEBAR, ENABLE_STATUS_BAR } from '@/lib/features'

interface UIState {
  leftSidebarVisible: boolean
  rightSidebarVisible: boolean
  commandPaletteOpen: boolean
  preferencesOpen: boolean
  lastQuickPaneEntry: string | null
  isAlwaysOnTop: boolean
  statusBarVisible: boolean

  toggleLeftSidebar: () => void
  setLeftSidebarVisible: (visible: boolean) => void
  toggleRightSidebar: () => void
  setRightSidebarVisible: (visible: boolean) => void
  toggleCommandPalette: () => void
  setCommandPaletteOpen: (open: boolean) => void
  togglePreferences: () => void
  setPreferencesOpen: (open: boolean) => void
  setLastQuickPaneEntry: (text: string) => void
  setAlwaysOnTop: (value: boolean) => void
  toggleStatusBar: () => void
  setStatusBarVisible: (visible: boolean) => void
}

export const useUIStore = create<UIState>()(
  devtools(
    set => ({
      leftSidebarVisible: ENABLE_LEFT_SIDEBAR,
      rightSidebarVisible: ENABLE_RIGHT_SIDEBAR,
      commandPaletteOpen: false,
      preferencesOpen: false,
      lastQuickPaneEntry: null,
      isAlwaysOnTop: false,
      statusBarVisible: ENABLE_STATUS_BAR,

      toggleLeftSidebar: () =>
        set(
          state => ({
            leftSidebarVisible: ENABLE_LEFT_SIDEBAR ? !state.leftSidebarVisible : false,
          }),
          undefined,
          'toggleLeftSidebar'
        ),

      setLeftSidebarVisible: visible =>
        set({ leftSidebarVisible: ENABLE_LEFT_SIDEBAR ? visible : false }, undefined, 'setLeftSidebarVisible'),

      toggleRightSidebar: () =>
        set(
          state => ({
            rightSidebarVisible: ENABLE_RIGHT_SIDEBAR ? !state.rightSidebarVisible : false,
          }),
          undefined,
          'toggleRightSidebar'
        ),

      setRightSidebarVisible: visible =>
        set({ rightSidebarVisible: ENABLE_RIGHT_SIDEBAR ? visible : false }, undefined, 'setRightSidebarVisible'),

      toggleCommandPalette: () =>
        set(state => ({ commandPaletteOpen: !state.commandPaletteOpen }), undefined, 'toggleCommandPalette'),

      setCommandPaletteOpen: open => set({ commandPaletteOpen: open }, undefined, 'setCommandPaletteOpen'),

      togglePreferences: () =>
        set(state => ({ preferencesOpen: !state.preferencesOpen }), undefined, 'togglePreferences'),

      setPreferencesOpen: open => set({ preferencesOpen: open }, undefined, 'setPreferencesOpen'),

      setLastQuickPaneEntry: text => set({ lastQuickPaneEntry: text }, undefined, 'setLastQuickPaneEntry'),

      setAlwaysOnTop: value => set({ isAlwaysOnTop: value }, undefined, 'setAlwaysOnTop'),

      toggleStatusBar: () =>
        set(
          state => ({
            statusBarVisible: ENABLE_STATUS_BAR ? !state.statusBarVisible : false,
          }),
          undefined,
          'toggleStatusBar'
        ),

      setStatusBarVisible: visible =>
        set({ statusBarVisible: ENABLE_STATUS_BAR ? visible : false }, undefined, 'setStatusBarVisible'),
    }),
    {
      name: 'ui-store',
    }
  )
)
