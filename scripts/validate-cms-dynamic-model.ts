import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'

import { graphql, printSchema } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import { getAdminMeta } from '../src/features/cms/admin-meta'
import { initialiseLists } from '../src/features/cms/config'
import { config, list, group } from '../src/features/cms/keystone/core'
import { allowAll } from '../src/features/cms/keystone/access'
import { document } from '../src/features/cms/keystone/fields-document'
import {
  bigInt,
  checkbox,
  decimal,
  image,
  integer,
  json,
  multiselect,
  relationship,
  select,
  text,
  timestamp,
  virtual,
} from '../src/features/cms/keystone/fields'
import {
  printCmsPrismaSchema,
  resolveCmsPrismaDatasourceUrl,
} from '../src/features/cms/prisma-schema'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function asRecord(value: unknown) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

let threwForVisibleCompositeVirtualWithoutQuery = false
try {
  initialiseLists(
    config({
      lists: {
        InvalidVirtualThing: list({
          fields: {
            visibleComposite: virtual({
              graphQLReturnType: 'PasswordState',
              resolver: () => ({ isSet: true }),
            }),
          },
        }),
      },
    }),
  )
} catch (error) {
  threwForVisibleCompositeVirtualWithoutQuery =
    error instanceof Error &&
    error.message.includes(
      'virtual fields with non-scalar GraphQL return types require ui.query',
    )
}
assert(
  threwForVisibleCompositeVirtualWithoutQuery,
  'visible non-scalar virtual fields should require ui.query unless hidden',
)

const dynamicConfig = config({
  db: {
    provider: 'sqlite',
    url: 'file:./dynamic-fixture.db',
  },
  graphql: {
    maxTake: 2,
  },
  storage: {
    local_images: {
      kind: 'local',
      type: 'image',
      storagePath: '.cms-temp/dynamic-images',
      serverRoute: '/files',
    },
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
      ui: { listView: { initialColumns: ['name', 'sku', 'isPublished'] } },
      fields: {
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        sku: text({ isIndexed: 'unique' }),
        summary: text({
          graphql: { omit: { read: true, create: true, update: true } },
        }),
        displayName: virtual({
          graphQLReturnType: 'String',
          resolver: (item) => `${String(item.name)}:${String(item.sku ?? '')}`,
        }),
        computedSecret: virtual({
          graphQLReturnType: 'PasswordState',
          ui: { query: '{ isSet }' },
          resolver: () => ({ isSet: true }),
        }),
        ...group({
          label: 'Publishing',
          ui: {
            createView: { defaultFieldMode: 'hidden' },
            itemView: { defaultFieldMode: 'read' },
            listView: { defaultFieldMode: 'hidden' },
          },
          fields: {
            isPublished: checkbox({ defaultValue: false }),
            inventory: integer({ defaultValue: 0 }),
            status: select({
              defaultValue: 'draft',
              options: [
                { label: 'Draft', value: 'draft' },
                { label: 'Live', value: 'live' },
              ],
            }),
            tags: multiselect({
              defaultValue: ['featured'],
              options: [
                { label: 'Featured', value: 'featured' },
                { label: 'Sale', value: 'sale' },
              ],
            }),
            publishedAt: timestamp({ db: { prismaDefault: 'now()' } }),
          },
        }),
        price: decimal(),
        largeCounter: bigInt(),
        metadata: json(),
        body: document({
          formatting: true,
          layouts: [[1, 1]],
          links: true,
          dividers: true,
        }),
        heroImage: image({ storage: 'local_images' }),
        posts: relationship({ ref: 'PublishedPost.product', many: true }),
        categories: relationship({
          ref: 'Category.products',
          many: true,
          db: { relationName: 'CategoryProducts' },
        }),
      },
      db: {
        extraPrismaFields: ['legacyCode String? @map("legacy_code")'],
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
        excerpt: text(),
        product: relationship({ ref: 'Product.posts' }),
      },
    }),
    Category: list({
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
        products: relationship({
          ref: 'Product.categories',
          many: true,
          db: { relationName: 'CategoryProducts' },
        }),
      },
    }),
    AuditLog: list({
      graphql: { omit: true },
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        message: text(),
      },
    }),
    ReadOnlyNote: list({
      graphql: { omit: { create: true, update: true, delete: true } },
      access: {
        operation: {
          query: allowAll,
          create: allowAll,
          update: allowAll,
          delete: allowAll,
        },
      },
      fields: {
        title: text(),
      },
    }),
  },
})

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)

  const lists = initialiseLists(dynamicConfig)
  assert(
    lists.map((entry) => entry.key).join(',') ===
      'Product,PublishedPost,Category,AuditLog,ReadOnlyNote',
    'initialiseLists should accept arbitrary Keystone-like model keys',
  )
  const product = lists.find((entry) => entry.key === 'Product')
  assert(product, 'Product list should exist')
  assert(
    product.fields.some((field) => field.path === 'id'),
    'initialiseLists should inject id for dynamic lists',
  )
  assert(
    product.fields.some(
      (field) => field.path === 'sku' && field.db?.isUnique === true,
    ),
    "dynamic model isIndexed: 'unique' should map to db.isUnique",
  )
  assert(
    product.graphql?.maxTake === 2,
    'dynamic model should inherit global graphql.maxTake onto list runtime config',
  )
  assert(
    product.groups?.some(
      (groupEntry) =>
        groupEntry.label === 'Publishing' &&
        groupEntry.fields.join(',') ===
          'isPublished,inventory,status,tags,publishedAt',
    ),
    'dynamic model Keystone group spread metadata should survive initialization',
  )
  const publishingGroup = product.groups?.find(
    (groupEntry) => groupEntry.label === 'Publishing',
  )
  assert(
    publishingGroup?.ui && typeof publishingGroup.ui === 'object',
    'dynamic model group UI metadata should survive initialization',
  )

  resetMemoryAdapter(
    {
      Product: [
        {
          id: 'product_seed',
          name: 'Seed Product',
          sku: 'seed-product',
          summary: null,
          isPublished: true,
          inventory: 5,
          status: 'live',
          tags: ['featured'],
          publishedAt: '2026-01-01T00:00:00.000Z',
          price: '19.99',
          largeCounter: '9007199254740993',
          metadata: { source: 'seed' },
          body: { document: [] },
          heroImage: null,
          posts: ['post_seed'],
          categories: ['category_seed'],
        },
      ],
      PublishedPost: [
        {
          id: 'post_seed',
          title: 'Seed Post',
          slug: 'seed-post',
          excerpt: null,
          product: 'product_seed',
        },
      ],
      Category: [
        {
          id: 'category_seed',
          title: 'Seed Category',
          slug: 'seed-category',
          products: ['product_seed'],
        },
      ],
    },
    lists,
  )

  const generatedPrisma = printCmsPrismaSchema(lists, dynamicConfig.db)
  assert(
    generatedPrisma.includes('model Product {'),
    'dynamic generated Prisma schema should include Product model',
  )
  assert(
    generatedPrisma.includes('model PublishedPost {'),
    'dynamic generated Prisma schema should include PublishedPost model',
  )
  assert(
    generatedPrisma.includes('model Category {'),
    'dynamic generated Prisma schema should include Category model',
  )
  assert(
    generatedPrisma.includes('provider = "sqlite"'),
    'dynamic generated Prisma schema should honor cmsConfig.db.provider',
  )
  assert(
    !generatedPrisma.includes('url      ='),
    'Prisma 7 generated schemas should leave datasource URLs to prisma.config.ts',
  )
  assert(
    resolveCmsPrismaDatasourceUrl(dynamicConfig.db?.url) ===
      'file:./dynamic-fixture.db',
    'Prisma config URL resolution should honor literal cmsConfig.db.url values',
  )
  assert(
    resolveCmsPrismaDatasourceUrl('env("DYNAMIC_DATABASE_URL")', {
      DYNAMIC_DATABASE_URL: 'file:./dynamic-env.db',
    }) === 'file:./dynamic-env.db',
    'Prisma config URL resolution should honor env-based cmsConfig.db.url values',
  )
  assert(
    generatedPrisma.includes('name String'),
    'dynamic generated Prisma schema should include required text fields',
  )
  assert(
    generatedPrisma.includes('summary String @default("")'),
    'text fields should use Keystone-compatible non-null database columns with empty-string defaults',
  )
  assert(
    !generatedPrisma.includes('displayName'),
    'dynamic generated Prisma schema should not persist virtual fields',
  )
  assert(
    generatedPrisma.includes('sku String @default("") @unique'),
    'dynamic generated Prisma schema should include Product.sku unique field',
  )
  assert(
    generatedPrisma.includes('isPublished Boolean @default(false)'),
    'dynamic generated Prisma schema should include checkbox defaults',
  )
  assert(
    generatedPrisma.includes('inventory Int? @default(0)'),
    'dynamic generated Prisma schema should include integer defaults',
  )
  assert(
    generatedPrisma.includes('status String? @default("draft")'),
    'dynamic generated Prisma schema should include select defaults',
  )
  assert(
    generatedPrisma.includes('tags Json @default("[\\"featured\\"]")'),
    'dynamic generated Prisma schema should preserve arbitrary multiselect defaults',
  )
  assert(
    generatedPrisma.includes('publishedAt DateTime? @default(now())'),
    'dynamic generated Prisma schema should include prismaDefault attributes',
  )
  assert(
    generatedPrisma.includes('metadata Json?'),
    'dynamic generated Prisma schema should include JSON stubs',
  )
  assert(
    generatedPrisma.includes(
      'body Json @default("[{\\"type\\":\\"paragraph\\",\\"children\\":[{\\"text\\":\\"\\"}]}]")',
    ),
    'dynamic generated Prisma schema should include Keystone-compatible document defaults',
  )
  assert(
    generatedPrisma.includes('price Decimal?') ||
      generatedPrisma.includes('price Decimal'),
    'dynamic generated Prisma schema should emit Decimal fields as Prisma Decimal columns rather than String',
  )
  assert(
    generatedPrisma.includes('largeCounter BigInt?') ||
      generatedPrisma.includes('largeCounter BigInt'),
    'dynamic generated Prisma schema should emit BigInt fields as Prisma BigInt columns rather than String',
  )
  assert(
    generatedPrisma.includes('heroImage_id String?'),
    'dynamic generated Prisma schema should include image id columns',
  )
  assert(
    generatedPrisma.includes('heroImage_extension String?'),
    'dynamic generated Prisma schema should include image extension columns',
  )
  assert(
    generatedPrisma.includes('heroImage_filesize Int?'),
    'dynamic generated Prisma schema should include image filesize columns',
  )
  assert(
    generatedPrisma.includes('heroImage_width Int?'),
    'dynamic generated Prisma schema should include image width columns',
  )
  assert(
    generatedPrisma.includes('heroImage_height Int?'),
    'dynamic generated Prisma schema should include image height columns',
  )
  assert(
    generatedPrisma.includes('productId String?'),
    'dynamic generated Prisma schema should include relationship foreign key fields',
  )
  assert(
    generatedPrisma.includes(
      'categories Category[] @relation("CategoryProducts")',
    ),
    'dynamic generated Prisma schema should include many-to-many relationship fields',
  )
  assert(
    generatedPrisma.includes('legacyCode String? @map("legacy_code")'),
    'dynamic generated Prisma schema should include safe extraPrismaFields',
  )

  const adminMeta = getAdminMeta(lists)
  assert(
    adminMeta.views.length > 0 && adminMeta.views.includes('text'),
    'AdminMeta generation should expose a root views registry',
  )
  assert(
    adminMeta.lists.some((entry) => entry.key === 'Product'),
    'AdminMeta generation should consume arbitrary initialized list keys',
  )
  const productMeta = adminMeta.lists.find((entry) => entry.key === 'Product')
  assert(productMeta, 'AdminMeta should include Product metadata')
  assert(
    asRecord(productMeta.graphql).names &&
      asRecord(asRecord(productMeta?.graphql).names).listQueryName ===
        'products',
    'AdminMeta should derive GraphQL list query names for dynamic list keys',
  )
  assert(
    productMeta.fields.some(
      (field) => field.path === 'sku' && field.fieldMeta.kind === 'text',
    ),
    'AdminMeta should include dynamic model fields',
  )
  const publishingStatusField = productMeta.fields.find(
    (field) => field.path === 'status',
  )
  assert(publishingStatusField, 'Product status metadata should exist')
  assert(
    publishingStatusField.createView.fieldMode === 'hidden',
    'group ui.createView.defaultFieldMode should apply to grouped fields in adminMeta',
  )
  assert(
    publishingStatusField.itemView.fieldMode === 'read',
    'group ui.itemView.defaultFieldMode should apply to grouped fields in adminMeta',
  )
  assert(
    publishingStatusField.listView.fieldMode === 'hidden',
    'group ui.listView.defaultFieldMode should apply to grouped fields in adminMeta',
  )
  const productNameField = productMeta.fields.find(
    (field) => field.path === 'name',
  )
  assert(productNameField, 'Product name metadata should exist')
  assert(
    productNameField.createView.fieldMode === 'edit',
    'group default field modes should not leak onto fields outside the group',
  )
  const readOnlyNoteMeta = adminMeta.lists.find(
    (entry) => entry.key === 'ReadOnlyNote',
  )
  assert(
    readOnlyNoteMeta?.hideCreate === true &&
      readOnlyNoteMeta.hideDelete === true,
    'AdminMeta should default hideCreate/hideDelete from omitted public GraphQL operations',
  )

  const schema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })
  const sdl = printSchema(schema)
  assert(
    sdl.includes('type Product'),
    'GraphQL SDL generation should include dynamic Product type',
  )
  assert(
    sdl.includes('displayName: String'),
    'GraphQL SDL generation should include dynamic virtual fields',
  )
  assert(
    sdl.includes('computedSecret: PasswordState'),
    'GraphQL SDL generation should include non-scalar virtual fields when ui.query is provided',
  )
  assert(
    !/^\s+summary: String$/m.test(sdl),
    'public GraphQL SDL generation should omit fields configured with graphql.omit.read',
  )
  assert(
    !sdl.includes('summary: StringFilter'),
    'public GraphQL SDL generation should omit filters for fields whose read access is omitted in normalized metadata',
  )
  const internalSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists, 'internal'),
    resolvers: generateCmsResolversForLists(lists),
  })
  const internalSdl = printSchema(internalSchema)
  assert(
    internalSdl.includes('summary: String'),
    'internal GraphQL SDL generation should restore fields omitted from the public schema',
  )
  assert(
    !sdl.includes('type AuditLog'),
    'public GraphQL SDL generation should omit graphql.omit=true lists entirely',
  )
  assert(
    internalSdl.includes('type AuditLog'),
    'internal GraphQL SDL generation should restore graphql.omit=true lists',
  )
  assert(
    sdl.includes('readOnlyNotes('),
    'public GraphQL SDL generation should keep query operations when only mutations are omitted',
  )
  assert(
    !sdl.includes('createReadOnlyNote('),
    'public GraphQL SDL generation should omit create mutations configured with list graphql.omit.create',
  )
  assert(
    !sdl.includes('updateReadOnlyNote('),
    'public GraphQL SDL generation should omit update mutations configured with list graphql.omit.update',
  )
  assert(
    !sdl.includes('deleteReadOnlyNote('),
    'public GraphQL SDL generation should omit delete mutations configured with list graphql.omit.delete',
  )
  assert(
    internalSdl.includes('createReadOnlyNote(') &&
      internalSdl.includes('updateReadOnlyNote(') &&
      internalSdl.includes('deleteReadOnlyNote('),
    'internal GraphQL SDL generation should restore list mutations omitted from public schema',
  )
  assert(
    sdl.includes('type PublishedPost'),
    'GraphQL SDL generation should include dynamic PublishedPost type',
  )
  assert(
    sdl.includes('type Category'),
    'GraphQL SDL generation should include dynamic Category type',
  )
  assert(
    sdl.includes('input ProductWhereUniqueInput') &&
      sdl.includes('sku: String'),
    'GraphQL SDL generation should include dynamic unique scalar fields in WhereUniqueInput',
  )
  assert(
    sdl.includes('input PublishedPostWhereUniqueInput') &&
      sdl.includes('slug: String'),
    'GraphQL SDL generation should include related unique scalar fields for connect/set inputs',
  )
  assert(
    sdl.includes('createProducts(data: [ProductCreateInput!]!)'),
    'GraphQL SDL generation should include dynamic create-many mutation',
  )
  assert(
    sdl.includes('updateProducts(data: [ProductUpdateArgs!]!)'),
    'GraphQL SDL generation should include dynamic update-many mutation',
  )
  assert(
    sdl.includes('deleteProducts(where: [ProductWhereUniqueInput!]!)'),
    'GraphQL SDL generation should include dynamic delete-many mutation',
  )

  const contextValue = {
    adapter: memoryCmsAdapter,
    session: undefined,
    __internal: { sudo: true, lists, storage: dynamicConfig.storage },
    sudo() {
      return this
    },
  }

  const adminMetaResult = await graphql({
    schema,
    source: /* GraphQL */ `
      query ValidateDynamicAdminMetaFieldModes {
        keystone {
          adminMeta {
            list(key: "Product") {
              fields {
                path
                createView {
                  fieldMode
                }
                itemView {
                  fieldMode
                }
                listView {
                  fieldMode
                }
              }
            }
          }
        }
      }
    `,
    contextValue,
  })
  if (adminMetaResult.errors?.length)
    throw new Error(
      adminMetaResult.errors.map((error) => error.message).join('\n'),
    )
  const productMetaFields = new Map(
    (
      (asRecord(
        asRecord(asRecord(asRecord(adminMetaResult.data).keystone).adminMeta)
          .list,
      ).fields ?? []) as Array<unknown>
    ).map((field) => [String(asRecord(field).path), asRecord(field)]),
  )
  const graphqlStatusMeta = productMetaFields.get('status')
  assert(
    asRecord(asRecord(graphqlStatusMeta).createView).fieldMode === 'hidden',
    'runtime adminMeta query should apply group createView defaultFieldMode',
  )
  assert(
    asRecord(asRecord(graphqlStatusMeta).itemView).fieldMode === 'read',
    'runtime adminMeta query should apply group itemView defaultFieldMode',
  )
  assert(
    asRecord(asRecord(graphqlStatusMeta).listView).fieldMode === 'hidden',
    'runtime adminMeta query should apply group listView defaultFieldMode',
  )

  const uploadBytes = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000030000000208060000009d74661a0000000049454e44ae426082',
    'hex',
  )
  const result = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateDynamicMemoryAdapter($upload: Upload!) {
        createProduct(
          data: {
            name: "Dynamic Product"
            sku: "dynamic-product"
            inventory: 7
            metadata: { source: "dynamic" }
            body: {
              document: [{ type: "paragraph", children: [{ text: "Body" }] }]
            }
            heroImage: { upload: $upload }
            posts: { create: [{ title: "Dynamic Post", slug: "dynamic-post" }] }
            categories: {
              create: [{ title: "Dynamic Category", slug: "dynamic-category" }]
            }
          }
        ) {
          id
          name
          inventory
          metadata
          body {
            document
          }
          heroImage {
            id
            url
            extension
            filesize
            width
            height
          }
          displayName
          computedSecret {
            isSet
          }
          posts {
            id
            title
          }
          postsCount
          categories {
            id
            title
          }
          categoriesCount
        }
      }
    `,
    variableValues: {
      upload: Promise.resolve({
        filename: 'dynamic-hero.png',
        mimetype: 'image/png',
        encoding: '7bit',
        createReadStream: () => Readable.from(uploadBytes),
      }),
    },
    contextValue,
  })
  if (result.errors?.length)
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  const createdProduct = asRecord(asRecord(result.data).createProduct)
  assert(
    createdProduct.name === 'Dynamic Product',
    'memory adapter should create dynamic-list items without Product-specific runtime code',
  )
  assert(
    createdProduct.postsCount === 1,
    'memory adapter should resolve dynamic to-many relationships',
  )
  assert(
    createdProduct.categoriesCount === 1,
    'memory adapter should resolve dynamic many-to-many relationships',
  )
  assert(
    asRecord((createdProduct.posts as unknown[])[0]).title === 'Dynamic Post',
    'memory adapter should support nested create for dynamic related lists',
  )
  assert(
    asRecord((createdProduct.categories as unknown[])[0]).title ===
      'Dynamic Category',
    'memory adapter should support nested create for dynamic many-to-many related lists',
  )
  assert(
    asRecord(createdProduct.metadata).source === 'dynamic',
    'memory adapter should preserve dynamic JSON field values',
  )
  assert(
    Array.isArray(asRecord(createdProduct.body).document),
    'memory adapter should expose dynamic document fields through DocumentFieldOutput',
  )
  const createdHeroImage = asRecord(createdProduct.heroImage)
  assert(
    createdHeroImage.extension === 'png' &&
      createdHeroImage.width === 3 &&
      createdHeroImage.height === 2,
    'memory adapter should process dynamic image uploads through configured storage',
  )
  assert(
    String(createdHeroImage.url).startsWith('/files/'),
    'memory adapter should expose dynamic image URLs through Keystone-like output objects',
  )
  assert(
    createdProduct.displayName === 'Dynamic Product:dynamic-product',
    'GraphQL virtual field resolver should run for dynamic models',
  )
  assert(
    asRecord(createdProduct.computedSecret).isSet === true,
    'non-scalar virtual fields should resolve when ui.query is provided',
  )

  const operationsResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateDynamicManyOperations {
        createProducts(
          data: [
            {
              name: "Many One"
              sku: "many-one"
              categories: { connect: [{ slug: "seed-category" }] }
            }
            { name: "Many Two", sku: "many-two" }
          ]
        ) {
          id
          name
          categoriesCount
        }
      }
    `,
    contextValue,
  })
  if (operationsResult.errors?.length)
    throw new Error(
      operationsResult.errors.map((error) => error.message).join('\n'),
    )
  const manyCreated = asRecord(operationsResult.data)
    .createProducts as unknown[]
  assert(
    Array.isArray(manyCreated) && manyCreated.length === 2,
    'dynamic GraphQL create-many should return all created arbitrary-list items',
  )
  assert(
    asRecord(manyCreated[0]).categoriesCount === 1,
    'dynamic GraphQL create-many should execute relationship connect through resolvers',
  )

  const firstManyId = String(asRecord(manyCreated[0]).id)
  const secondManyId = String(asRecord(manyCreated[1]).id)
  const queryResult = await graphql({
    schema,
    source: /* GraphQL */ `
      query ValidateDynamicFindManyCount(
        $where: ProductWhereInput
        $orderBy: [ProductOrderByInput!]
      ) {
        products(where: $where, orderBy: $orderBy) {
          id
          name
          sku
        }
        productsCount(where: $where)
      }
    `,
    variableValues: {
      where: { sku: { contains: 'many' } },
      orderBy: [{ name: 'asc' }],
    },
    contextValue,
  })
  if (queryResult.errors?.length)
    throw new Error(queryResult.errors.map((error) => error.message).join('\n'))
  const queriedProducts = asRecord(queryResult.data).products as unknown[]
  assert(
    queriedProducts.length === 2,
    'dynamic GraphQL findMany should filter arbitrary-list items',
  )
  assert(
    asRecord(queryResult.data).productsCount === 2,
    'dynamic GraphQL count should filter arbitrary-list items',
  )

  const maxTakeResult = await graphql({
    schema,
    source: /* GraphQL */ `
      query ValidateMaxTake {
        products(take: 3) {
          id
        }
      }
    `,
    contextValue,
  })
  assert(
    maxTakeResult.errors?.[0]?.extensions.code === 'KS_VALIDATION_FAILURE',
    'dynamic GraphQL findMany should enforce configured graphql.maxTake',
  )

  const updateResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateDynamicUpdateMany($first: ID!) {
        updateProducts(
          data: [
            { where: { id: $first }, data: { isPublished: false } }
            {
              where: { sku: "many-two" }
              data: { isPublished: true, inventory: 11 }
            }
          ]
        ) {
          id
          isPublished
          inventory
        }
      }
    `,
    variableValues: { first: firstManyId },
    contextValue,
  })
  if (updateResult.errors?.length)
    throw new Error(
      updateResult.errors.map((error) => error.message).join('\n'),
    )
  const updatedProducts = asRecord(updateResult.data)
    .updateProducts as unknown[]
  assert(
    asRecord(updatedProducts[0]).isPublished === false,
    'dynamic GraphQL update-many should update optional scalar fields',
  )
  assert(
    asRecord(updatedProducts[1]).isPublished === true &&
      asRecord(updatedProducts[1]).inventory === 11,
    'dynamic GraphQL update-many should update defaulted fields',
  )

  const deleteResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateDynamicDeleteMany($first: ID!, $second: ID!) {
        deleteProducts(where: [{ id: $first }, { id: $second }]) {
          id
          name
        }
      }
    `,
    variableValues: { first: firstManyId, second: secondManyId },
    contextValue,
  })
  if (deleteResult.errors?.length)
    throw new Error(
      deleteResult.errors.map((error) => error.message).join('\n'),
    )
  const deletedProducts = asRecord(deleteResult.data)
    .deleteProducts as unknown[]
  assert(
    deletedProducts.length === 2,
    'dynamic GraphQL delete-many should delete arbitrary-list items in input order',
  )

  const singleDeleteResult = await graphql({
    schema,
    source: /* GraphQL */ `
      mutation ValidateDynamicDelete($id: ID!) {
        deleteProduct(where: { id: $id }) {
          id
          name
        }
      }
    `,
    variableValues: { id: String(createdProduct.id) },
    contextValue,
  })
  if (singleDeleteResult.errors?.length)
    throw new Error(
      singleDeleteResult.errors.map((error) => error.message).join('\n'),
    )
  assert(
    asRecord(asRecord(singleDeleteResult.data).deleteProduct).name ===
      'Dynamic Product',
    'dynamic GraphQL delete should execute through arbitrary-list resolvers',
  )

  await rm(
    join(
      process.cwd(),
      '.cms-temp/dynamic-images',
      String(createdHeroImage.url).split('/').pop() ?? '',
    ),
    { force: true },
  )
  resetMemoryAdapter()
  console.info('CMS dynamic model validation passed.')
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
