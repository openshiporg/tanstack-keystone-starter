import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva } from 'class-variance-authority'
import type { VariantProps } from 'class-variance-authority'

import { cn } from '@/lib/utils'

/*
  Buttons are raised pills. Standalone, a pill carries its own 2px recessed moat; inside a
  `.ks-track` it sits flush in the shared well (see styles.css). Ghost and link stay flat.
*/
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 font-medium whitespace-nowrap outline-none select-none disabled:pointer-events-none disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)] focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--ks-surface)] aria-invalid:ring-destructive/30 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
  {
    variants: {
      variant: {
        default: 'ks-pill',
        destructive: 'ks-pill',
        outline: 'ks-pill',
        secondary: 'ks-pill',
        ghost:
          'rounded-[7px] text-[var(--ks-dim)] transition-colors hover:bg-[var(--ks-hover)] hover:text-[var(--ks-ink)] data-[popup-open]:bg-[var(--ks-hover)] data-[popup-open]:text-[var(--ks-ink)]',
        link: 'text-[var(--ks-accent-ink)] underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3 text-[13px]',
        xs: 'h-6 px-2 text-[12px]',
        sm: 'h-7 px-2.5 text-[12px]',
        lg: 'h-9 px-4 text-[13px]',
        icon: 'size-8 text-[13px]',
        'icon-xs': 'size-6 text-[12px]',
        'icon-sm': 'size-7 text-[12px]',
        'icon-lg': 'size-9 text-[13px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

const pillVariant: Record<string, string | undefined> = {
  default: 'primary',
  destructive: 'danger-fill',
  outline: undefined,
  secondary: undefined,
}

function Button({
  className,
  variant = 'default',
  size = 'default',
  nativeButton: _nativeButton,
  ...props
}: ButtonPrimitive.Props &
  VariantProps<typeof buttonVariants> & { nativeButton?: boolean }) {
  return (
    <ButtonPrimitive
      data-slot="button"
      data-variant={pillVariant[variant ?? 'default']}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
