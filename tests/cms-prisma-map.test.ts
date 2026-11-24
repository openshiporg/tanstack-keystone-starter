import { describe, expect, it } from 'vitest'

import { initialiseLists } from '../src/features/cms/config'
import { config, list } from '../src/features/cms/keystone/core'
import { text } from '../src/features/cms/keystone/fields'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'

describe('Prisma mapped CMS fields', () => {
  it('prints db.map so a logical field rename can retain its database column', () => {
    const lists = initialiseLists(
      config({
        db: { provider: 'postgresql' },
        lists: {
          Project: list({
            fields: {
              rank: text({ db: { map: 'priority' } }),
            },
          }),
        },
      }),
    )

    expect(printCmsPrismaSchema(lists)).toContain(
      'rank String @default("") @map("priority")',
    )
  })
})
