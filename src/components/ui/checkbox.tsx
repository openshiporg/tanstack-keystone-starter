'use client'

import { Checkbox as CheckboxPrimitive } from '@base-ui/react/checkbox'

import { cn } from '@/lib/utils'
import { CheckIcon } from 'lucide-react'

function Checkbox({ className, ...props }: CheckboxPrimitive.Root.Props) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer relative flex size-4 shrink-0 items-center justify-center rounded-[5px] bg-[var(--ks-field)] shadow-[var(--ks-field-shadow)] transition-[background,box-shadow] outline-none group-has-disabled/field:opacity-50 after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:ring-2 focus-visible:ring-[var(--ks-focus)] disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:shadow-[inset_0_0_0_1px_var(--ks-danger)] data-checked:bg-[var(--ks-accent)] data-checked:text-white data-checked:shadow-[inset_0_0_0_1px_rgb(0_0_0/.12)] data-indeterminate:bg-[var(--ks-accent)] data-indeterminate:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none [&>svg]:size-3.5"
      >
        <CheckIcon />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
