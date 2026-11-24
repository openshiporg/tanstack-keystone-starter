import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import { createPrismaCmsAdapter } from '../src/features/cms/adapters/prisma'
import { createCmsPrismaClient } from '../src/features/cms/prisma-client'
import type { CmsContext } from '../src/features/cms/adapters'
import { initialiseLists } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import {
  config,
  graphql as keystoneGraphql,
  list,
} from '../src/features/cms/keystone/core'
import {
  checkbox,
  integer,
  relationship,
  text,
} from '../src/features/cms/keystone/fields'
import { structure } from '../src/features/cms/keystone/fields-document'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'
import {
  buildCmsContext,
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

const execFileAsync = promisify(execFile)

type GeneratedPrismaClientModule = {
  PrismaClient: new (options: { adapter: unknown }) => {
    $disconnect: () => Promise<void>
    publishedPost: { create: (args: unknown) => Promise<unknown> }
  }
}
type GeneratedPrismaClient = InstanceType<
  GeneratedPrismaClientModule['PrismaClient']
>

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

const structureText = (defaultValue: string) => ({
  kind: 'form' as const,
  defaultValue,
  validate: (value: unknown) => typeof value === 'string',
  graphql: {
    input: keystoneGraphql.String,
    output: keystoneGraphql.field({
      type: keystoneGraphql.String,
      resolve: (source: unknown) => (source as { value: string }).value,
    }),
  },
})

function withClientOutput(schema: string) {
  return schema.replace(
    'output   = "../src/generated/prisma"',
    'output   = "./client"',
  )
}

const fixtureConfig = config({
  db: {
    provider: 'sqlite',
    url: 'file:./fixture.db',
  },
  lists: {
    Product: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        sku: text({ isIndexed: 'unique' }),
        isPublished: checkbox({ defaultValue: false }),
        inventory: integer({ defaultValue: 0 }),
        settings: structure({
          schema: {
            kind: 'object',
            fields: {
              headline: structureText('Default headline'),
              featuredPost: {
                kind: 'relationship',
                listKey: 'PublishedPost',
                selection: 'slug',
                label: 'Featured post',
                many: false,
              },
            },
          },
        }),
        posts: relationship({ ref: 'PublishedPost.product', many: true }),
      },
    }),
    Account: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        username: text({ isIndexed: 'unique' }),
        profile: relationship({ ref: 'Profile.account' }),
      },
    }),
    Profile: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        handle: text({ isIndexed: 'unique' }),
        account: relationship({ ref: 'Account.profile' }),
      },
    }),
    PublishedPost: list({
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        title: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        slug: text({ isIndexed: 'unique' }),
        product: relationship({ ref: 'Product.posts' }),
      },
    }),
  },
})

async function main() {
  const tempRoot = path.join(process.cwd(), '.cms-temp')
  await mkdir(tempRoot, { recursive: true })
  const tempDir = await mkdtemp(path.join(tempRoot, 'prisma-client-'))
  const schemaPath = path.join(tempDir, 'schema.prisma')
  const configPath = path.join(tempDir, 'prisma.config.ts')
  const databasePath = path.join(tempDir, 'fixture.db')
  const lists = initialiseLists(fixtureConfig)
  await writeFile(
    schemaPath,
    withClientOutput(printCmsPrismaSchema(lists, fixtureConfig.db)),
  )
  await writeFile(
    configPath,
    `import { defineConfig } from 'prisma/config'\n\nexport default defineConfig({\n  schema: 'schema.prisma',\n  datasource: { url: ${JSON.stringify(`file:${databasePath}`)} },\n})\n`,
  )

  try {
    const prismaEnv = {
      ...process.env,
      PRISMA_GENERATE_SKIP_AUTOINSTALL: '1',
    }
    await execFileAsync(
      'npx',
      ['--no-install', 'prisma', 'db', 'push', '--config', configPath],
      { cwd: process.cwd(), env: prismaEnv },
    )
    await execFileAsync(
      'npx',
      ['--no-install', 'prisma', 'generate', '--config', configPath],
      { cwd: process.cwd(), env: prismaEnv },
    )
    const clientModule = (await import(
      pathToFileURL(path.join(tempDir, 'client', 'client.ts')).href
    )) as GeneratedPrismaClientModule
    const prisma = createCmsPrismaClient<GeneratedPrismaClient>({
      provider: 'sqlite',
      url: `file:${databasePath}`,
      Client: clientModule.PrismaClient as never,
    })

    try {
      await prisma.publishedPost.create({
        data: { id: 'post_seed', title: 'Seed Post', slug: 'seed-post' },
      })
      const adapter = createPrismaCmsAdapter({ prisma: prisma as never, lists })
      const schema = makeExecutableSchema({
        typeDefs: generateCmsTypeDefsForLists(lists),
        resolvers: generateCmsResolversForLists(lists),
      })
      const contextValue = buildCmsContext({
        adapter,
        lists,
        schema,
        sudo: true,
      }) as CmsContext

      const createdResult = await graphql({
        schema,
        source: /* GraphQL */ `
          mutation ValidateRealTempPrismaClient {
            createProduct(
              data: {
                name: "Real Temp Product"
                sku: "real-temp-sku"
                inventory: 4
                settings: {
                  headline: "SQLite structure"
                  featuredPost: { connect: { slug: "seed-post" } }
                }
                posts: { connect: [{ slug: "seed-post" }] }
              }
            ) {
              id
              sku
              inventory
              settings {
                structure {
                  headline
                  featuredPost {
                    id
                    slug
                  }
                }
                json
              }
              posts {
                id
                slug
              }
              postsCount
            }
          }
        `,
        contextValue,
      })
      if (createdResult.errors?.length)
        throw new Error(
          createdResult.errors.map((error) => error.message).join('\n'),
        )
      const created = asRecord(asRecord(createdResult.data).createProduct)
      assert(
        created.sku === 'real-temp-sku',
        'real generated Prisma client should create arbitrary-list scalar data',
      )
      assert(
        asRecord(asRecord(created.settings).structure).headline ===
          'SQLite structure' &&
          asRecord(asRecord(asRecord(created.settings).structure).featuredPost)
            .slug === 'seed-post' &&
          asRecord(asRecord(created.settings).json).headline ===
            'SQLite structure',
        'provider-dispatched live SQLite client should persist and resolve structure fields',
      )
      assert(
        created.postsCount === 1,
        'real generated Prisma client should connect relationships by non-id unique scalar',
      )

      const oneToOneCreate = await graphql({
        schema,
        source: /* GraphQL */ `
          mutation ValidateRealTempPrismaOneToOneCreate {
            createProfile(data: { handle: "profile-handle" }) {
              id
            }
            createAccount(
              data: {
                username: "account-name"
                profile: { connect: { handle: "profile-handle" } }
              }
            ) {
              id
              profile {
                handle
              }
            }
          }
        `,
        contextValue,
      })
      if (oneToOneCreate.errors?.length)
        throw new Error(
          oneToOneCreate.errors.map((error) => error.message).join('\n'),
        )
      const oneToOneLookup = await graphql({
        schema,
        source: /* GraphQL */ `
          query ValidateRealTempPrismaOneToOneUnique {
            account(where: { profile: { handle: "profile-handle" } }) {
              username
              profile {
                handle
              }
            }
            profile(where: { account: { username: "account-name" } }) {
              handle
              account {
                username
              }
            }
          }
        `,
        contextValue,
      })
      if (oneToOneLookup.errors?.length)
        throw new Error(
          oneToOneLookup.errors.map((error) => error.message).join('\n'),
        )
      assert(
        asRecord(asRecord(oneToOneLookup.data).account).username ===
          'account-name' &&
          asRecord(asRecord(oneToOneLookup.data).profile).handle ===
            'profile-handle',
        'real generated Prisma client should resolve both one-to-one endpoints by nested unique selectors',
      )

      const lifecycleResult = await graphql({
        schema,
        source: /* GraphQL */ `
          mutation ValidateRealTempPrismaClientLifecycle {
            updateProduct(
              where: { sku: "real-temp-sku" }
              data: { isPublished: true, inventory: 8 }
            ) {
              id
              sku
              isPublished
              inventory
            }
            deleteProducts(where: [{ sku: "real-temp-sku" }]) {
              id
              sku
            }
          }
        `,
        contextValue,
      })
      if (lifecycleResult.errors?.length)
        throw new Error(
          lifecycleResult.errors.map((error) => error.message).join('\n'),
        )
      const lifecycle = asRecord(lifecycleResult.data)
      assert(
        asRecord(lifecycle.updateProduct).inventory === 8,
        'real generated Prisma client should update by non-id unique scalar',
      )
      assert(
        asRecord((lifecycle.deleteProducts as unknown[])[0]).sku ===
          'real-temp-sku',
        'real generated Prisma client should delete-many by non-id unique scalar',
      )
    } finally {
      await prisma.$disconnect()
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }

  console.info('CMS real temporary Prisma Client validation passed.')
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
