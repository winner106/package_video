import { Sidebar, PanelRight, Settings } from 'lucide-react'
import { useUIStore } from '@/store/ui-store'
import { ENABLE_LEFT_SIDEBAR, ENABLE_RIGHT_SIDEBAR } from '@/lib/features'
import type { AppCommand } from './types'

export const navigationCommands: AppCommand[] = [
  {
    id: 'show-left-sidebar',
    labelKey: 'commands.showLeftSidebar.label',
    descriptionKey: 'commands.showLeftSidebar.description',
    icon: Sidebar,
    group: 'navigation',
    shortcut: 'CommandOrControl+1',
    keywords: ['sidebar', 'left', 'panel', 'show'],

    execute: () => {
      if (!ENABLE_LEFT_SIDEBAR) return
      useUIStore.getState().setLeftSidebarVisible(true)
    },

    isAvailable: () => ENABLE_LEFT_SIDEBAR && !useUIStore.getState().leftSidebarVisible,
  },

  {
    id: 'hide-left-sidebar',
    labelKey: 'commands.hideLeftSidebar.label',
    descriptionKey: 'commands.hideLeftSidebar.description',
    icon: Sidebar,
    group: 'navigation',
    shortcut: 'CommandOrControl+1',
    keywords: ['sidebar', 'left', 'panel', 'hide'],

    execute: () => {
      if (!ENABLE_LEFT_SIDEBAR) return
      useUIStore.getState().setLeftSidebarVisible(false)
    },

    isAvailable: () => ENABLE_LEFT_SIDEBAR && useUIStore.getState().leftSidebarVisible,
  },

  {
    id: 'show-right-sidebar',
    labelKey: 'commands.showRightSidebar.label',
    descriptionKey: 'commands.showRightSidebar.description',
    icon: PanelRight,
    group: 'navigation',
    shortcut: 'CommandOrControl+2',
    keywords: ['sidebar', 'right', 'panel', 'show'],

    execute: () => {
      if (!ENABLE_RIGHT_SIDEBAR) return
      useUIStore.getState().setRightSidebarVisible(true)
    },

    isAvailable: () => ENABLE_RIGHT_SIDEBAR && !useUIStore.getState().rightSidebarVisible,
  },

  {
    id: 'hide-right-sidebar',
    labelKey: 'commands.hideRightSidebar.label',
    descriptionKey: 'commands.hideRightSidebar.description',
    icon: PanelRight,
    group: 'navigation',
    shortcut: 'CommandOrControl+2',
    keywords: ['sidebar', 'right', 'panel', 'hide'],

    execute: () => {
      if (!ENABLE_RIGHT_SIDEBAR) return
      useUIStore.getState().setRightSidebarVisible(false)
    },

    isAvailable: () => ENABLE_RIGHT_SIDEBAR && useUIStore.getState().rightSidebarVisible,
  },

  {
    id: 'open-preferences',
    labelKey: 'commands.openPreferences.label',
    descriptionKey: 'commands.openPreferences.description',
    icon: Settings,
    group: 'settings',
    shortcut: 'CommandOrControl+,',
    keywords: ['preferences', 'settings', 'config', 'options'],

    execute: context => {
      context.openPreferences()
    },
  },
]
