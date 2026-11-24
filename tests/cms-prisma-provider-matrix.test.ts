import { describe, expect, it } from 'vitest'

import { initialiseLists } from '../src/features/cms/config'
import { config, list } from '../src/features/cms/keystone/core'
import {
  calendarDay,
  decimal,
  select,
  text,
} from '../src/features/cms/keystone/fields'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'

function schema(provider: 'postgresql' | 'sqlite' | 'mysql') {
  const lists = initialiseLists(
    config({
      db: { provider },
      lists: {
        ProviderValue: list({
          fields: {
            label: text({ db: { map: 'display_label' }, isIndexed: true }),
            amount: decimal({ precision: 12, scale: 4 }),
            day: calendarDay(),
            state: select({
              type: 'enum',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Live', value: 'live' },
              ],
              defaultValue: 'draft',
            }),
          },
        }),
      },
    }),
  )
  return printCmsPrismaSchema(lists, { provider })
}

describe('Prisma provider schema matrix', () => {
  it.each(['postgresql', 'mysql'] as const)(
    'emits native date, decimal and enum types for %s',
    (provider) => {
      const output = schema(provider)
      expect(output).toContain(`provider = "${provider}"`)
      expect(output).toContain('amount Decimal? @db.Decimal(12, 4)')
      expect(output).toContain('day DateTime? @db.Date')
      expect(output).toContain('state ProviderValueStateType')
      expect(output).toContain('@@index([label])')
      expect(output).toContain('@map("display_label")')
    },
  )

  it('uses Prisma 7 SQLite-compatible scalar replacements', () => {
    const output = schema('sqlite')
    expect(output).toContain('provider = "sqlite"')
    expect(output).toContain('amount Decimal?')
    expect(output).not.toContain('@db.Decimal')
    expect(output).toContain('day String?')
    expect(output).toContain('state String? @default("draft")')
    expect(output).not.toContain('enum ProviderValueStateType')
  })
})
