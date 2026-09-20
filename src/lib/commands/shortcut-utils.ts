import { getPlatform } from '@/hooks/use-platform'

/**
 * Formats a shortcut string for display with nice symbols.
 * Converts "CommandOrControl+Shift+." to "⌘⇧." on macOS or "Ctrl+Shift+." on other platforms.
 */
export function formatShortcutForDisplay(shortcut: string): string {
  const isMac = getPlatform() === 'macos'

  let formatted = shortcut
    // Handle CommandOrControl first
    .replace(/CommandOrControl/gi, isMac ? '⌘' : 'Ctrl')
    .replace(/CmdOrCtrl/gi, isMac ? '⌘' : 'Ctrl')
    // Then handle individual modifiers
    .replace(/Command/gi, '⌘')
    .replace(/Control/gi, isMac ? '⌃' : 'Ctrl')
    .replace(/Ctrl/gi, isMac ? '⌃' : 'Ctrl')
    .replace(/Shift/gi, isMac ? '⇧' : 'Shift')
    .replace(/Alt/gi, isMac ? '⌥' : 'Alt')
    .replace(/Super/gi, isMac ? '⌘' : 'Win')
    // Handle common key names
    .replace(/Period/gi, '.')
    .replace(/Comma/gi, ',')
    .replace(/Slash/gi, '/')
    .replace(/Backslash/gi, '\\')
    .replace(/BracketLeft/gi, '[')
    .replace(/BracketRight/gi, ']')
    .replace(/Semicolon/gi, ';')
    .replace(/Quote/gi, "'")
    .replace(/Backquote/gi, '`')
    .replace(/Minus/gi, '-')
    .replace(/Equal/gi, '=')
    .replace(/Space/gi, 'Space')
    .replace(/Enter/gi, '↵')
    .replace(/Escape/gi, 'Esc')
    .replace(/Backspace/gi, '⌫')
    .replace(/Delete/gi, '⌦')
    .replace(/ArrowUp/gi, '↑')
    .replace(/ArrowDown/gi, '↓')
    .replace(/ArrowLeft/gi, '←')
    .replace(/ArrowRight/gi, '→')
    .replace(/Tab/gi, '⇥')

  // On Mac, join with no separator for modifier symbols
  if (isMac) {
    // Replace + between symbols with nothing for compact display
    formatted = formatted.replace(/\+/g, '')
  }

  return formatted
}
