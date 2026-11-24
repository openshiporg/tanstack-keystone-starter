import { graphql } from 'graphql'
import { makeExecutableSchema } from '@graphql-tools/schema'

import {
  memoryCmsAdapter,
  resetMemoryAdapter,
  setCmsAdapterForTests,
} from '../src/features/cms/adapters'
import type { CmsContext } from '../src/features/cms/adapters'
import { config, initialiseLists, list } from '../src/features/cms/config'
import { allowAll } from '../src/features/cms/keystone/access'
import { relationship, text } from '../src/features/cms/keystone/fields'
import {
  buildCmsContext,
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

const omitConfig = config({
  lists: {
    PublicThing: list({
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
        secret: text({
          graphql: { omit: { read: true, create: true, update: true } },
        }),
      },
    }),
    HiddenThing: list({
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
        name: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
        publicRelations: relationship({
          ref: 'PublicRelationThing.hiddenRef',
          many: true,
        }),
      },
    }),
    ReadOnlyThing: list({
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
        title: text({
          validation: { isRequired: true },
          isNonNull: [true, true],
        }),
      },
    }),
    PublicRelationThing: list({
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
        hiddenRef: relationship({ ref: 'HiddenThing.publicRelations' }),
      },
    }),
    PublicParent: list({
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
        children: relationship({ ref: 'PublicChild.parent', many: true }),
      },
    }),
    PublicChild: list({
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
        parent: relationship({
          ref: 'PublicParent.children',
          graphql: { omit: { read: true } },
        }),
      },
    }),
  },
})

async function execute(
  schema: ReturnType<typeof makeExecutableSchema>,
  source: string,
  contextValue: CmsContext,
  variableValues?: Record<string, unknown>,
) {
  const result = await graphql({ schema, source, contextValue, variableValues })
  return result
}

const oneSidedNamedManyConfig = config({
  lists: {
    Tag: list({
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
      },
    }),
    Post: list({
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
        namedTags: relationship({
          ref: 'Tag',
          many: true,
          db: { relationName: 'PostNamedTags' },
        }),
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
        namedPeers: relationship({
          ref: 'Category',
          many: true,
          db: { relationName: 'CategoryNamedPeers' },
        }),
      },
    }),
  },
})

const namedManyOneSideOnlyConfig = config({
  lists: {
    Tag: list({
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
        posts: relationship({
          ref: 'Post.tags',
          many: true,
          db: { relationName: 'TagPosts' },
        }),
      },
    }),
    Post: list({
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
        tags: relationship({ ref: 'Tag.posts', many: true }),
      },
    }),
  },
})

async function main() {
  process.env.CMS_ADAPTER = 'memory'
  setCmsAdapterForTests(memoryCmsAdapter)

  const lists = initialiseLists(omitConfig)
  resetMemoryAdapter(
    {
      PublicThing: [
        { id: 'public_1', name: 'Visible item', secret: 'server-secret' },
      ],
      HiddenThing: [{ id: 'hidden_1', name: 'Hidden item' }],
      ReadOnlyThing: [{ id: 'readonly_1', title: 'Read only item' }],
      PublicRelationThing: [
        {
          id: 'public_relation_1',
          name: 'Visible relation owner',
          hiddenRefId: 'hidden_1',
        },
      ],
      PublicParent: [{ id: 'public_parent_1', title: 'Visible parent' }],
      PublicChild: [
        {
          id: 'public_child_1',
          title: 'Visible child',
          parentId: 'public_parent_1',
        },
      ],
    },
    lists,
  )

  const publicSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })
  const internalSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists, 'internal'),
    resolvers: generateCmsResolversForLists(lists, 'internal'),
  })

  const publicContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: publicSchema,
    lists,
  })
  const internalContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: true,
    schema: internalSchema,
    lists,
  })

  const publicQuery = await execute(
    publicSchema,
    /* GraphQL */ `
      query ValidatePublicRuntimeOmit {
        publicThings {
          id
          name
        }
        publicThingsCount
        readOnlyThings {
          id
          title
        }
        publicParents {
          id
          title
          children {
            id
            title
          }
        }
        publicChilds {
          id
          title
        }
      }
    `,
    publicContext,
  )
  assert(
    !publicQuery.errors?.length,
    'public runtime schema should execute visible list queries',
  )
  assert(
    (asRecord(publicQuery.data).publicThingsCount as number) === 1,
    'public runtime schema should count visible list items',
  )

  const publicSecretQuery = await execute(
    publicSchema,
    /* GraphQL */ `
      query ValidatePublicSecretFieldOmit {
        publicThings {
          id
          secret
        }
      }
    `,
    publicContext,
  )
  assert(
    publicSecretQuery.errors?.length,
    'public runtime schema should reject omitted read fields',
  )
  assert(
    publicSecretQuery.errors[0]?.message.includes(
      'Cannot query field "secret"',
    ),
    'public runtime schema should omit secret from visible query fields',
  )

  const publicHiddenListQuery = await execute(
    publicSchema,
    /* GraphQL */ `
      query ValidatePublicHiddenListOmit {
        hiddenThings {
          id
          name
        }
      }
    `,
    publicContext,
  )
  assert(
    publicHiddenListQuery.errors?.length,
    'public runtime schema should reject fully omitted lists',
  )
  assert(
    publicHiddenListQuery.errors[0]?.message.includes(
      'Cannot query field "hiddenThings"',
    ),
    'public runtime schema should omit fully hidden lists from Query',
  )

  const publicMutationQuery = await execute(
    publicSchema,
    /* GraphQL */ `
      mutation ValidatePublicMutationOmit {
        createReadOnlyThing(data: { title: "Should not exist" }) {
          id
        }
      }
    `,
    publicContext,
  )
  assert(
    publicMutationQuery.errors?.length,
    'public runtime schema should reject omitted mutations',
  )
  assert(
    publicMutationQuery.errors[0]?.message.includes(
      'Cannot query field "createReadOnlyThing"',
    ),
    'public runtime schema should omit create mutation from read-only list',
  )

  const internalSecretQuery = await execute(
    internalSchema,
    /* GraphQL */ `
      query ValidateInternalSecretFieldPresent {
        publicThings {
          id
          name
          secret
        }
        hiddenThings {
          id
          name
        }
      }
    `,
    internalContext,
  )
  assert(
    !internalSecretQuery.errors?.length,
    'internal runtime schema should restore omitted fields and lists',
  )
  const internalPublicThings = (asRecord(internalSecretQuery.data)
    .publicThings ?? []) as Array<Record<string, unknown>>
  const internalHiddenThings = (asRecord(internalSecretQuery.data)
    .hiddenThings ?? []) as Array<Record<string, unknown>>
  assert(
    internalPublicThings[0]?.secret === 'server-secret',
    'internal runtime schema should expose omitted read fields',
  )
  assert(
    internalHiddenThings[0]?.name === 'Hidden item',
    'internal runtime schema should expose fully omitted lists',
  )

  const internalMutationQuery = await execute(
    internalSchema,
    /* GraphQL */ `
      mutation ValidateInternalMutationPresent {
        createReadOnlyThing(data: { title: "Allowed internally" }) {
          id
          title
        }
      }
    `,
    internalContext,
  )
  assert(
    !internalMutationQuery.errors?.length,
    'internal runtime schema should restore omitted mutations',
  )
  assert(
    typeof asRecord(asRecord(internalMutationQuery.data).createReadOnlyThing)
      .id === 'string',
    'internal runtime mutation should create items on an omitted public mutation list',
  )

  let publicDbCreateRejected = false
  try {
    await publicContext.db.HiddenThing.createOne({
      data: { name: 'Should fail publicly' },
    })
  } catch (error) {
    publicDbCreateRejected = String(error).includes(
      'not supported by the GraphQL schema',
    )
  }
  assert(
    publicDbCreateRejected,
    'public context.db should reject creates for omitted lists',
  )

  let publicDbReadOnlyCreateRejected = false
  try {
    await publicContext.db.ReadOnlyThing.createOne({
      data: { title: 'Should fail publicly' },
    })
  } catch (error) {
    publicDbReadOnlyCreateRejected = String(error).includes(
      'not supported by the GraphQL schema',
    )
  }
  assert(
    publicDbReadOnlyCreateRejected,
    'public context.db should reject omitted create mutations',
  )

  let publicQueryCreateRejected = false
  try {
    await publicContext.query.ReadOnlyThing.createOne({
      data: { title: 'Should fail publicly' },
      query: 'id',
    })
  } catch (error) {
    publicQueryCreateRejected = String(error).includes(
      'not supported by the GraphQL schema',
    )
  }
  assert(
    publicQueryCreateRejected,
    'public context.query should reject omitted create mutations',
  )

  const internalDbCreate = await internalContext.db.ReadOnlyThing.createOne({
    data: { title: 'Allowed via internal db' },
  })
  assert(
    typeof internalDbCreate.id === 'string',
    'internal context.db should still allow omitted public mutations',
  )

  const publicAdminMeta = publicContext.__internal.lists
  assert(publicAdminMeta, 'public context should retain runtime list metadata')
  const publicRelationList = publicAdminMeta.find(
    (listEntry) => listEntry.key === 'PublicRelationThing',
  )
  assert(
    publicRelationList,
    'public runtime fixture should include PublicRelationThing in visible lists',
  )

  const { getAdminMeta } = await import('../src/features/cms/admin-meta')
  const adminMeta = getAdminMeta(lists)
  const publicRelationMeta = adminMeta.lists.find(
    (listEntry) => listEntry.key === 'PublicRelationThing',
  )
  assert(
    publicRelationMeta,
    'public admin meta should include PublicRelationThing',
  )
  assert(
    !publicRelationMeta.fields.some((field) => field.path === 'hiddenRef'),
    'public admin meta should omit relationship fields that point to omitted lists',
  )

  const publicParentMeta = adminMeta.lists.find(
    (listEntry) => listEntry.key === 'PublicParent',
  )
  assert(
    publicParentMeta,
    'public admin meta should include PublicParent when the related list stays public',
  )
  assert(
    publicParentMeta.fields.some((field) => field.path === 'children'),
    'public admin meta should keep relationship fields when only the opposite field is omitted from public read',
  )

  const publicOppositeFieldQuery = await execute(
    publicSchema,
    /* GraphQL */ `
      query ValidatePublicOppositeFieldOmit {
        publicChilds {
          id
          title
          parent {
            id
            title
          }
        }
      }
    `,
    publicContext,
  )
  assert(
    publicOppositeFieldQuery.errors?.length,
    'public runtime schema should reject directly querying the omitted opposite relationship field',
  )
  assert(
    publicOppositeFieldQuery.errors[0]?.message.includes(
      'Cannot query field "parent"',
    ),
    'public runtime schema should omit the opposite relationship field from PublicChild when its read access is omitted',
  )

  const oneSidedNamedManyLists = initialiseLists(oneSidedNamedManyConfig)
  resetMemoryAdapter(
    {
      Tag: [
        { id: 'tag_a', name: 'Alpha' },
        { id: 'tag_b', name: 'Beta' },
      ],
      Post: [
        {
          id: 'post_1',
          title: 'Named tags post',
          namedTags: ['tag_a', 'tag_b'],
        },
      ],
      Category: [
        { id: 'category_1', title: 'First', namedPeers: ['category_2'] },
        { id: 'category_2', title: 'Second', namedPeers: ['category_1'] },
      ],
    },
    oneSidedNamedManyLists,
  )

  const oneSidedNamedManySchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(oneSidedNamedManyLists),
    resolvers: generateCmsResolversForLists(oneSidedNamedManyLists),
  })
  const oneSidedNamedManyContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: oneSidedNamedManySchema,
    lists: oneSidedNamedManyLists,
  })

  const oneSidedNamedManyQuery = await execute(
    oneSidedNamedManySchema,
    /* GraphQL */ `
      query ValidateOneSidedNamedManyRuntime {
        posts {
          id
          title
          namedTags {
            id
            name
          }
          namedTagsCount
        }
        categorys: categories {
          id
          title
          namedPeers {
            id
            title
          }
          namedPeersCount
        }
      }
    `,
    oneSidedNamedManyContext,
  )
  assert(
    !oneSidedNamedManyQuery.errors?.length,
    'runtime schema should execute one-sided named-many relationship queries',
  )
  const posts = (asRecord(oneSidedNamedManyQuery.data).posts ?? []) as Array<
    Record<string, unknown>
  >
  assert(
    posts.length === 1,
    'runtime schema should return the seeded post for one-sided named-many checks',
  )
  assert(
    ((posts[0]?.namedTags ?? []) as Array<Record<string, unknown>>)
      .map((tag) => tag.name)
      .join(',') === 'Alpha,Beta',
    'runtime schema should resolve one-sided named-many related items',
  )
  assert(
    posts[0]?.namedTagsCount === 2,
    'runtime schema should expose count fields for one-sided named-many relationships',
  )
  const categories = (asRecord(oneSidedNamedManyQuery.data).categorys ??
    []) as Array<Record<string, unknown>>
  assert(
    categories.length === 2,
    'runtime schema should return seeded self one-sided named-many categories',
  )
  assert(
    ((categories[0]?.namedPeers ?? []) as Array<Record<string, unknown>>)
      .length === 1,
    'runtime schema should resolve self one-sided named-many related items',
  )
  assert(
    categories.every((category) => category.namedPeersCount === 1),
    'runtime schema should expose count fields for self one-sided named-many relationships',
  )

  const namedManyOneSideOnlyLists = initialiseLists(namedManyOneSideOnlyConfig)
  resetMemoryAdapter(
    {
      Tag: [
        { id: 'tag_posts_1', name: 'Tagged One', posts: ['post_tags_1'] },
        { id: 'tag_posts_2', name: 'Tagged Two', posts: ['post_tags_1'] },
      ],
      Post: [
        {
          id: 'post_tags_1',
          title: 'Named relation post',
          tags: ['tag_posts_1', 'tag_posts_2'],
        },
      ],
    },
    namedManyOneSideOnlyLists,
  )

  const namedManyOneSideOnlySchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(namedManyOneSideOnlyLists),
    resolvers: generateCmsResolversForLists(namedManyOneSideOnlyLists),
  })
  const namedManyOneSideOnlyContext = buildCmsContext({
    adapter: memoryCmsAdapter,
    sudo: true,
    internal: false,
    schema: namedManyOneSideOnlySchema,
    lists: namedManyOneSideOnlyLists,
  })

  const namedManyOneSideOnlyQuery = await execute(
    namedManyOneSideOnlySchema,
    /* GraphQL */ `
      query ValidateNamedManyOneSideOnlyRuntime {
        tags {
          id
          name
          posts {
            id
            title
          }
          postsCount
        }
        posts {
          id
          title
          tags {
            id
            name
          }
          tagsCount
        }
      }
    `,
    namedManyOneSideOnlyContext,
  )
  assert(
    !namedManyOneSideOnlyQuery.errors?.length,
    'runtime schema should execute two-sided many-to-many queries when only one side sets relationName',
  )
  const runtimeTags = (asRecord(namedManyOneSideOnlyQuery.data).tags ??
    []) as Array<Record<string, unknown>>
  assert(
    runtimeTags.length === 2,
    'runtime schema should return seeded tags for named one-side-only many-to-many checks',
  )
  assert(
    runtimeTags.every((tag) => tag.postsCount === 1),
    'runtime schema should expose postsCount for the named many-to-many side',
  )
  assert(
    runtimeTags.every(
      (tag) =>
        ((tag.posts ?? []) as Array<Record<string, unknown>>).length === 1,
    ),
    'runtime schema should resolve related posts from the named many-to-many side',
  )
  const runtimePosts = (asRecord(namedManyOneSideOnlyQuery.data).posts ??
    []) as Array<Record<string, unknown>>
  assert(
    runtimePosts.length === 1,
    'runtime schema should return the seeded post for named one-side-only many-to-many checks',
  )
  assert(
    runtimePosts[0]?.tagsCount === 2,
    'runtime schema should expose tagsCount for the unnamed opposite many-to-many side',
  )
  assert(
    ((runtimePosts[0]?.tags ?? []) as Array<Record<string, unknown>>)
      .map((tag) => tag.name)
      .join(',') === 'Tagged One,Tagged Two',
    'runtime schema should resolve related tags from the unnamed opposite many-to-many side',
  )

  console.info('CMS runtime omit/internal validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
