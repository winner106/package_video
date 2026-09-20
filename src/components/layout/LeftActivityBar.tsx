import { BookOpen, GitBranch, Home, Play, Puzzle, Search, Settings, User } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { executeCommand, useCommandContext } from '@/lib/commands'
import { cn } from '@/lib/utils'

const primaryItems = [
  { key: 'explorer', icon: Home, labelKey: 'activityBar.explorer' },
  { key: 'search', icon: Search, labelKey: 'activityBar.search' },
  { key: 'git', icon: GitBranch, labelKey: 'activityBar.git' },
  { key: 'run', icon: Play, labelKey: 'activityBar.run' },
  { key: 'extensions', icon: Puzzle, labelKey: 'activityBar.extensions' },
] as const

const secondaryItems = [
  { key: 'accounts', icon: User, labelKey: 'activityBar.accounts' },
  { key: 'settings', icon: Settings, labelKey: 'activityBar.settings' },
  { key: 'help', icon: BookOpen, labelKey: 'activityBar.help' },
] as const

export function LeftActivityBar() {
  const { t } = useTranslation()
  const commandContext = useCommandContext()

  const handleOpenPreferences = async () => {
    const result = await executeCommand('open-preferences', commandContext)
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error')
    }
  }

  return (
    <div
      className={cn('flex h-full w-12 flex-col justify-between border-r border-border bg-muted/40 text-foreground/80')}
    >
      <div className="flex flex-col items-center gap-1 py-2">
        {primaryItems.map(item => (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-foreground/70 hover:text-foreground"
                aria-label={t(item.labelKey)}
                // title={t(item.labelKey)}
              >
                <item.icon className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 py-2">
        {secondaryItems.map(item => {
          const handleClick = item.key === 'settings' ? handleOpenPreferences : undefined
          return (
            <Tooltip key={item.key}>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-foreground/70 hover:text-foreground"
                  aria-label={t(item.labelKey)}
                  onClick={handleClick}
                >
                  <item.icon className="size-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t(item.labelKey)}</TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </div>
  )
}
