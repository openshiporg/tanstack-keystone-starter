import { describe, expect, it } from 'vitest'

import { dashboardThemeScript } from '../src/components/ui/theme-script'

function runThemeScript(stored: string | null, prefersDark: boolean) {
  const classes = new Set<string>()
  const style: Record<string, string> = {}
  const execute = new Function(
    'localStorage',
    'matchMedia',
    'document',
    dashboardThemeScript,
  )
  execute({ getItem: () => stored }, () => ({ matches: prefersDark }), {
    documentElement: {
      classList: {
        add: (...values: string[]) =>
          values.forEach((value) => classes.add(value)),
        remove: (...values: string[]) =>
          values.forEach((value) => classes.delete(value)),
      },
      style,
    },
  })
  return { classes, style }
}

describe('pre-hydration dashboard theme script', () => {
  it('applies an explicit stored theme before hydration', () => {
    const result = runThemeScript('dark', false)
    expect([...result.classes]).toEqual(['dark'])
    expect(result.style.colorScheme).toBe('dark')
  })

  it('resolves system theme from the current media preference', () => {
    expect([...runThemeScript('system', true).classes]).toEqual(['dark'])
    expect([...runThemeScript(null, false).classes]).toEqual(['light'])
  })
})
