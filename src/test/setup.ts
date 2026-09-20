import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock matchMedia for tests
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
})

// Mock Tauri APIs for tests
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(() => {
    // Mock unlisten function
  }),
}))

vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn().mockResolvedValue(null),
}))

// Mock typed Tauri bindings (tauri-specta generated)
vi.mock('@/lib/tauri-bindings', () => ({
  commands: {
    greet: vi.fn().mockResolvedValue('Hello, test!'),
    loadPreferences: vi.fn().mockResolvedValue({
      status: 'ok',
      data: {
        theme: 'system',
        theme_palette: 'default',
        auto_start: false,
        quick_pane_shortcut: null,
        language: null,
        close_behavior: 'ask',
        silent_start: false,
        mood_candidates: {
          en: ['😀 Feeling great'],
        },
      },
    }),
    savePreferences: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    getParcelRecordingDirectory: vi.fn().mockResolvedValue({ status: 'ok', data: '/tmp/parcel-recordings' }),
    saveParcelRecordingMp4: vi.fn().mockResolvedValue({
      status: 'ok',
      data: {
        file_name: '20260920_TEST123.mp4',
        file_path: '/tmp/parcel-recordings/20260920_TEST123.mp4',
        file_size_bytes: 1024,
        deleted_files: [],
        total_size_bytes: 1024,
      },
    }),
    sendNativeNotification: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    saveEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    loadEmergencyData: vi.fn().mockResolvedValue({ status: 'ok', data: null }),
    cleanupOldRecoveryFiles: vi.fn().mockResolvedValue({ status: 'ok', data: 0 }),
  },
  unwrapResult: vi.fn((result: { status: string; data?: unknown }) => {
    if (result.status === 'ok') return result.data
    throw result
  }),
}))
