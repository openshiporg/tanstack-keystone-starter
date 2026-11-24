import { describe, expect, it } from 'vitest'

import { initialiseLists } from '../src/features/cms/config'
import { relationship, text } from '../src/features/cms/fields'
import { config, list } from '../src/features/cms/keystone/core'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'
import { generateCmsTypeDefsForLists } from '../src/features/cms/runtime'

describe('Prisma one-to-one relationship ownership', () => {
  it('places the foreign key on exactly one deterministic endpoint', () => {
    const lists = initialiseLists(
      config({
        lists: {
          Instance: list({
            fields: {
              domain: text(),
              subscription: relationship({ ref: 'Subscription.instance' }),
            },
          }),
          Subscription: list({
            fields: {
              externalId: text(),
              instance: relationship({ ref: 'Instance.subscription' }),
            },
          }),
        },
      }),
    )

    const schema = printCmsPrismaSchema(lists)
    expect(schema).toContain(
      'subscription Subscription? @relation("Instance_subscription", fields: [subscriptionId], references: [id])',
    )
    expect(schema).toContain(
      'instance Instance? @relation("Instance_subscription")',
    )
    expect(schema.match(/fields: \[[a-zA-Z]+Id\]/g)).toHaveLength(1)

    const graphql = generateCmsTypeDefsForLists(lists)
    expect(graphql).toMatch(
      /input InstanceWhereUniqueInput \{[^}]*subscription: SubscriptionWhereUniqueInput/s,
    )
    expect(graphql).toMatch(
      /input SubscriptionWhereUniqueInput \{[^}]*instance: InstanceWhereUniqueInput/s,
    )
  })

  it('uses Keystone-compatible consonant-y plural names', () => {
    const [category] = initialiseLists(
      config({ lists: { Category: list({ fields: { name: text() } }) } }),
    )
    expect(category.plural).toBe('Categories')
    expect(category.graphql.names.listQueryName).toBe('categories')
    expect(category.graphql.names.createManyMutationName).toBe(
      'createCategories',
    )
  })
})
