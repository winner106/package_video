import { useEffect, useMemo, useRef, useState } from 'react'
import { Settings, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import IconLeftSidebarOff from '@/assets/layout-sidebar-left-off.svg?react'
import IconLeftSidebar from '@/assets/layout-sidebar-left.svg?react'
import IconRightSidebarOff from '@/assets/layout-sidebar-right-off.svg?react'
import IconRightSidebar from '@/assets/layout-sidebar-right.svg?react'
import IconStatusBar from '@/assets/layout-statusbar.svg?react'
import { Button } from '@/components/ui/button'
import { executeCommand, useCommandContext } from '@/lib/commands'
import { ENABLE_LEFT_SIDEBAR, ENABLE_RIGHT_SIDEBAR, ENABLE_STATUS_BAR } from '@/lib/features'
import { getMoodCandidatesForLocale, DEFAULT_MOOD_CANDIDATES } from '@/lib/moods'
import { usePreferences } from '@/services/preferences'
import { useUIStore } from '@/store/ui-store'

/**
 * Left-side toolbar actions (sidebar toggle).
 * Place this after window controls on macOS, or at the start on Windows/Linux.
 */
export function TitleBarLeftActions() {
  const { t } = useTranslation()
  const leftSidebarVisible = useUIStore(state => state.leftSidebarVisible)
  const toggleLeftSidebar = useUIStore(state => state.toggleLeftSidebar)

  return (
    <div className="flex items-center gap-1">
      {ENABLE_LEFT_SIDEBAR && (
        <Button
          onClick={toggleLeftSidebar}
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-foreground/70 hover:text-foreground"
          title={t('titlebar.toggleLeftSidebar')}
        >
          {leftSidebarVisible ? <IconLeftSidebar className="h-3 w-3" /> : <IconLeftSidebarOff className="h-3 w-3" />}
        </Button>
      )}
    </div>
  )
}

/**
 * Right-side toolbar actions (settings, sidebar toggle).
 * Place this before window controls on Windows, or at the end on macOS/Linux.
 */
export function TitleBarRightActions() {
  const { t } = useTranslation()
  const rightSidebarVisible = useUIStore(state => state.rightSidebarVisible)
  const toggleRightSidebar = useUIStore(state => state.toggleRightSidebar)
  const toggleStatusBar = useUIStore(state => state.toggleStatusBar)
  const commandContext = useCommandContext()

  const handleOpenPreferences = async () => {
    const result = await executeCommand('open-preferences', commandContext)
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error')
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        onClick={handleOpenPreferences}
        variant="ghost"
        size="icon"
        className="h-6 w-6 text-foreground/70 hover:text-foreground"
        title={t('titlebar.settings')}
      >
        <Settings className="h-3 w-3" />
      </Button>

      {ENABLE_STATUS_BAR && (
        <Button
          onClick={toggleStatusBar}
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-foreground/70 hover:text-foreground"
          title={t('titlebar.toggleStatusBar')}
        >
          <IconStatusBar className="h-3 w-3" />
        </Button>
      )}

      {ENABLE_RIGHT_SIDEBAR && (
        <Button
          onClick={toggleRightSidebar}
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-foreground/70 hover:text-foreground"
          title={t('titlebar.toggleRightSidebar')}
        >
          {rightSidebarVisible ? <IconRightSidebar className="h-3 w-3" /> : <IconRightSidebarOff className="h-3 w-3" />}
        </Button>
      )}
    </div>
  )
}

interface TitleBarTitleProps {
  title?: string
}

/**
 * Centered title for the title bar.
 * Uses absolute positioning to stay centered regardless of other content.
 */
export function TitleBarTitle({ title = 'Tauri App' }: TitleBarTitleProps) {
  const { t, i18n } = useTranslation()
  const { data: preferences } = usePreferences()
  const [isEditingSignature, setIsEditingSignature] = useState(false)
  const [signature, setSignature] = useState('')
  const inputRef = useRef<HTMLInputElement | null>(null)

  const moodCandidates = useMemo(() => {
    const overrides = (preferences?.mood_candidates as Record<string, string[]> | undefined) ?? DEFAULT_MOOD_CANDIDATES
    return getMoodCandidatesForLocale(i18n.language, overrides)
  }, [i18n.language, preferences?.mood_candidates])
  const effectiveMoods =
    moodCandidates.length > 0 ? moodCandidates : getMoodCandidatesForLocale(i18n.language, DEFAULT_MOOD_CANDIDATES)

  useEffect(() => {
    if (isEditingSignature) {
      inputRef.current?.focus()
    }
  }, [isEditingSignature])

  const handleTitleDoubleClick = () => setIsEditingSignature(true)

  const handleSignatureDoubleClick = () => setIsEditingSignature(true)

  const handleInputDoubleClick = () => {
    if (effectiveMoods.length === 0) {
      setSignature('')
      return
    }
    const pick = effectiveMoods[Math.floor(Math.random() * effectiveMoods.length)] as string
    setSignature(pick)
  }

  const hasSignature = signature.trim().length > 0
  const shouldShowSignature = isEditingSignature || hasSignature

  return (
    <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 [app-region:no-drag]">
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-sm font-medium text-foreground/80"
        onDoubleClick={handleTitleDoubleClick}
        aria-label={t('titlebar.titleHover')}
        title={t('titlebar.titleHover')}
      >
        {title}
      </Button>

      {shouldShowSignature && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="text-foreground">-</span>
          {isEditingSignature ? (
            <div className="relative flex items-center">
              <input
                type="text"
                ref={inputRef}
                className="h-6 min-w-[180px] bg-transparent pr-6 px-1 text-xs text-foreground outline-none placeholder:text-muted-foreground border border-transparent focus:border-border rounded"
                placeholder={t('titlebar.signaturePlaceholder')}
                title={t('titlebar.titleHover')}
                value={signature}
                onChange={e => setSignature(e.target.value)}
                onDoubleClick={handleInputDoubleClick}
                onBlur={() => {
                  if (signature.trim().length === 0) {
                    setIsEditingSignature(false)
                  } else {
                    setIsEditingSignature(false)
                  }
                }}
                onKeyDown={e => {
                  if (e.key === 'Escape') {
                    setSignature('')
                    setIsEditingSignature(false)
                  } else if (e.key === 'Enter') {
                    setIsEditingSignature(false)
                  }
                }}
              />
              <X
                className="absolute right-1 h-3 w-3 text-muted-foreground hover:text-foreground"
                aria-label={t('common.reset')}
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setSignature('')
                  setIsEditingSignature(false)
                }}
              ></X>
            </div>
          ) : (
            <span
              className="cursor-default text-foreground truncate"
              title={t('titlebar.signaturePlaceholder')}
              onDoubleClick={handleSignatureDoubleClick}
            >
              {hasSignature ? signature : ''}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Combined toolbar content for simple layouts.
 * Use this for Linux or when you want all toolbar items in one fragment.
 *
 * For more control, use TitleBarLeftActions, TitleBarRightActions, and TitleBarTitle separately.
 */
export function TitleBarContent({ title = 'Tauri App' }: TitleBarTitleProps) {
  return (
    <>
      <TitleBarLeftActions />
      <TitleBarTitle title={title} />
      <TitleBarRightActions />
    </>
  )
}
