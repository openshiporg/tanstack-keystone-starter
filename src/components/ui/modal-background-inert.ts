import { useEffect } from 'react'

const inertOwners = new WeakMap<HTMLElement, number>()

function acquireBackgroundInert() {
  const background = document.querySelector<HTMLElement>(
    '[data-slot="sidebar-wrapper"]',
  )
  if (!background) return () => {}

  inertOwners.set(background, (inertOwners.get(background) ?? 0) + 1)
  background.inert = true

  return () => {
    const remaining = Math.max(0, (inertOwners.get(background) ?? 1) - 1)
    if (remaining === 0) {
      inertOwners.delete(background)
      background.inert = false
    } else {
      inertOwners.set(background, remaining)
    }
  }
}

export function useModalBackgroundInert(active: boolean) {
  useEffect(() => {
    if (!active) return
    return acquireBackgroundInert()
  }, [active])
}
