import { BookOpen, ArrowDownToDot } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

const primaryItems = [{ key: 'settings', icon: ArrowDownToDot, labelKey: 'activityBar.settings' }] as const

const secondaryItems = [{ key: 'help', icon: BookOpen, labelKey: 'activityBar.help' }] as const

export function RightActivityBar() {
  const { t } = useTranslation()

  return (
    <div
      className={cn('flex h-full w-12 flex-col justify-between border-l border-border bg-muted/40 text-foreground/80')}
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
            <TooltipContent side="left">{t(item.labelKey)}</TooltipContent>
          </Tooltip>
        ))}
      </div>

      <div className="flex flex-col items-center gap-1 py-2">
        {secondaryItems.map(item => (
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
            <TooltipContent side="left">{t(item.labelKey)}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
