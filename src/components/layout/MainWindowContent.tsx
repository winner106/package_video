import { ParcelVideoRecorder } from '@/components/parcel-video/ParcelVideoRecorder'
import { cn } from '@/lib/utils'

interface MainWindowContentProps {
  children?: React.ReactNode
  className?: string
}

export function MainWindowContent({ children, className }: MainWindowContentProps) {
  return (
    <div className={cn('flex h-full flex-col bg-background', className)}>{children || <ParcelVideoRecorder />}</div>
  )
}
