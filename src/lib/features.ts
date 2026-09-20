const ENABLE_LEFT_SIDEBAR_DEFAULT = true
const ENABLE_RIGHT_SIDEBAR_DEFAULT = true
const ENABLE_EXAMPLE_PREFERENCES_DEFAULT = false
const ENABLE_STATUS_BAR_DEFAULT = true
const ENABLE_LEFT_ACTIVITY_BAR_DEFAULT = true
const ENABLE_RIGHT_ACTIVITY_BAR_DEFAULT = true

function readEnv(key: string): string | undefined {
  const viteValue = (import.meta as ImportMeta & { env?: Record<string, unknown> }).env?.[key]
  if (typeof viteValue === 'string') return viteValue
  if (typeof viteValue === 'boolean') return viteValue ? 'true' : 'false'

  if (typeof process !== 'undefined' && typeof process.env === 'object') {
    const nodeValue = process.env[key]
    if (typeof nodeValue === 'string') return nodeValue
  }

  return undefined
}

function parseBoolean(value: string | undefined): boolean | undefined {
  if (value == null) return undefined

  switch (value.trim().toLowerCase()) {
    case '1':
    case 'true':
    case 'yes':
    case 'on':
      return true
    case '0':
    case 'false':
    case 'no':
    case 'off':
      return false
    default:
      return undefined
  }
}

export const ENABLE_RIGHT_SIDEBAR = parseBoolean(readEnv('VITE_ENABLE_RIGHT_SIDEBAR')) ?? ENABLE_RIGHT_SIDEBAR_DEFAULT
export const ENABLE_LEFT_SIDEBAR = parseBoolean(readEnv('VITE_ENABLE_LEFT_SIDEBAR')) ?? ENABLE_LEFT_SIDEBAR_DEFAULT
export const ENABLE_EXAMPLE_PREFERENCES =
  parseBoolean(readEnv('VITE_ENABLE_EXAMPLE_PREFERENCES')) ?? ENABLE_EXAMPLE_PREFERENCES_DEFAULT
export const ENABLE_STATUS_BAR = parseBoolean(readEnv('VITE_ENABLE_STATUS_BAR')) ?? ENABLE_STATUS_BAR_DEFAULT
export const ENABLE_LEFT_ACTIVITY_BAR =
  parseBoolean(readEnv('VITE_ENABLE_LEFT_ACTIVITY_BAR')) ?? ENABLE_LEFT_ACTIVITY_BAR_DEFAULT
export const ENABLE_RIGHT_ACTIVITY_BAR =
  parseBoolean(readEnv('VITE_ENABLE_RIGHT_ACTIVITY_BAR')) ?? ENABLE_RIGHT_ACTIVITY_BAR_DEFAULT
