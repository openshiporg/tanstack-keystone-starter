import { useBlocker } from '@tanstack/react-router'

export function usePreventNavigation(shouldPreventNavigation: boolean) {
  useBlocker({
    shouldBlockFn: () => {
      if (!shouldPreventNavigation) return false
      return !window.confirm(
        'There are unsaved changes, are you sure you want to leave?',
      )
    },
    enableBeforeUnload: shouldPreventNavigation,
    disabled: !shouldPreventNavigation,
  })
}
