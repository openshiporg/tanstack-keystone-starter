import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { Logo } from '../src/components/dashboard/logo'

function normalizedText(markup: string) {
  return markup
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('TanStack dashboard branding', () => {
  it('identifies the migrated TanStack runtime rather than Next.js', () => {
    const text = normalizedText(
      renderToStaticMarkup(createElement(Logo)),
    ).toLowerCase()

    expect(text).toContain('keystone x tanstack')
    expect(text).not.toContain('next')
  })
})
