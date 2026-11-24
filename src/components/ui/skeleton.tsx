import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-[6px] bg-[var(--ks-hover)]', className)}
      {...props}
    />
  )
}

export { Skeleton }
