import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('UIStore', () => {
  beforeEach(() => {
    vi.unstubAllEnvs()
  })

  it('has correct initial state (default features)', async () => {
    vi.resetModules()
    const { useUIStore } = await import('./ui-store')

    const state = useUIStore.getState()
    expect(state.leftSidebarVisible).toBe(true)
    expect(state.rightSidebarVisible).toBe(true)
    expect(state.commandPaletteOpen).toBe(false)
    expect(state.preferencesOpen).toBe(false)
  })

  it('toggles left sidebar visibility', async () => {
    vi.resetModules()
    const { useUIStore } = await import('./ui-store')

    // Reset store state before each test
    useUIStore.setState({
      leftSidebarVisible: true,
      rightSidebarVisible: true,
      commandPaletteOpen: false,
      preferencesOpen: false,
      lastQuickPaneEntry: null,
    })

    const { toggleLeftSidebar } = useUIStore.getState()

    toggleLeftSidebar()
    expect(useUIStore.getState().leftSidebarVisible).toBe(false)

    toggleLeftSidebar()
    expect(useUIStore.getState().leftSidebarVisible).toBe(true)
  })

  it('sets left sidebar visibility directly', async () => {
    vi.resetModules()
    const { useUIStore } = await import('./ui-store')

    const { setLeftSidebarVisible } = useUIStore.getState()

    setLeftSidebarVisible(false)
    expect(useUIStore.getState().leftSidebarVisible).toBe(false)

    setLeftSidebarVisible(true)
    expect(useUIStore.getState().leftSidebarVisible).toBe(true)
  })

  it('toggles preferences dialog', async () => {
    vi.resetModules()
    const { useUIStore } = await import('./ui-store')

    const { togglePreferences } = useUIStore.getState()

    togglePreferences()
    expect(useUIStore.getState().preferencesOpen).toBe(true)

    togglePreferences()
    expect(useUIStore.getState().preferencesOpen).toBe(false)
  })

  it('toggles command palette', async () => {
    vi.resetModules()
    const { useUIStore } = await import('./ui-store')

    const { toggleCommandPalette } = useUIStore.getState()

    toggleCommandPalette()
    expect(useUIStore.getState().commandPaletteOpen).toBe(true)

    toggleCommandPalette()
    expect(useUIStore.getState().commandPaletteOpen).toBe(false)
  })

  it('disables right sidebar when VITE_ENABLE_RIGHT_SIDEBAR=0', async () => {
    vi.stubEnv('VITE_ENABLE_RIGHT_SIDEBAR', '0')
    vi.resetModules()
    const { useUIStore } = await import('./ui-store')

    expect(useUIStore.getState().rightSidebarVisible).toBe(false)

    useUIStore.getState().toggleRightSidebar()
    expect(useUIStore.getState().rightSidebarVisible).toBe(false)

    useUIStore.getState().setRightSidebarVisible(true)
    expect(useUIStore.getState().rightSidebarVisible).toBe(false)
  })

  it('disables left sidebar when VITE_ENABLE_LEFT_SIDEBAR=0', async () => {
    vi.stubEnv('VITE_ENABLE_LEFT_SIDEBAR', '0')
    vi.resetModules()
    const { useUIStore } = await import('./ui-store')

    expect(useUIStore.getState().leftSidebarVisible).toBe(false)

    useUIStore.getState().toggleLeftSidebar()
    expect(useUIStore.getState().leftSidebarVisible).toBe(false)

    useUIStore.getState().setLeftSidebarVisible(true)
    expect(useUIStore.getState().leftSidebarVisible).toBe(false)
  })
})
