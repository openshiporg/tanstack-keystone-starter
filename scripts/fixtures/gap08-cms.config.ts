import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'

import type { CmsContext } from '../../src/features/cms/adapters'
import type { CmsHookBaseArgs } from '../../src/features/cms/types'
import {
  createAuth,
  statelessSessions,
} from '../../src/features/cms/keystone/auth'
import { allowAll } from '../../src/features/cms/keystone/access'
import { config, list } from '../../src/features/cms/keystone/core'
import {
  password,
  relationship,
  text,
} from '../../src/features/cms/keystone/fields'

const GAP08_CONCURRENCY_HANDSHAKE_TIMEOUT_MS = 15_000

type ConcurrencyPhase =
  | 'armed'
  | 'held-after-write'
  | 'release-requested'
  | 'released-before-commit'
  | 'timed-out'

type ConcurrencyHandshake = {
  phase: ConcurrencyPhase
  firstItemId: string | null
  releasePromise: Promise<void>
  resolveRelease: () => void
  rejectRelease: (error: Error) => void
  timeout?: ReturnType<typeof setTimeout>
}

type Gap08Global = typeof globalThis & {
  __gap08ConcurrencyHandshake?: ConcurrencyHandshake
}

function newConcurrencyHandshake(): ConcurrencyHandshake {
  let resolveRelease: (() => void) | undefined
  let rejectRelease: ((error: Error) => void) | undefined
  const releasePromise = new Promise<void>((resolve, reject) => {
    resolveRelease = resolve
    rejectRelease = reject
  })
  return {
    phase: 'armed',
    firstItemId: null,
    releasePromise,
    resolveRelease: () => resolveRelease?.(),
    rejectRelease: (error) => rejectRelease?.(error),
  }
}

function concurrencyHandshake() {
  return (globalThis as Gap08Global).__gap08ConcurrencyHandshake
}

function gap08ArmConcurrencyHandshake() {
  const state = concurrencyHandshake()
  if (
    state?.phase === 'held-after-write' ||
    state?.phase === 'release-requested'
  )
    throw new Error('GAP08_CONCURRENCY_HANDSHAKE_ALREADY_ACTIVE')
  if (state?.timeout) clearTimeout(state.timeout)
  const globalState = globalThis as Gap08Global
  globalState.__gap08ConcurrencyHandshake = newConcurrencyHandshake()
  return true
}

function gap08ReleaseConcurrencyHandshake() {
  const state = concurrencyHandshake()
  if (state?.phase !== 'held-after-write')
    throw new Error('GAP08_CONCURRENCY_FIRST_WRITE_NOT_HELD')
  state.phase = 'release-requested'
  state.resolveRelease()
  return true
}

function gap08ConcurrencyHandshakeSnapshot() {
  const state = concurrencyHandshake()
  return {
    phase: state?.phase ?? 'unarmed',
    firstItemId: state?.firstItemId ?? null,
    timeoutRole: 'failure-bound-only',
  }
}

async function holdFirstMutationAfterWrite(args: CmsHookBaseArgs) {
  if (args.operation !== 'update' || args.resolvedData.code !== 'g8-race-first')
    return

  const state = concurrencyHandshake()
  if (state?.phase !== 'armed')
    throw new Error('GAP08_CONCURRENCY_HANDSHAKE_NOT_ARMED')
  state.phase = 'held-after-write'
  state.firstItemId = args.item?.id ? String(args.item.id) : null
  state.timeout = setTimeout(() => {
    state.phase = 'timed-out'
    state.rejectRelease(
      new Error('GAP08_CONCURRENCY_HANDSHAKE_TIMEOUT_FAILURE_BOUND'),
    )
  }, GAP08_CONCURRENCY_HANDSHAKE_TIMEOUT_MS)
  try {
    await state.releasePromise
  } finally {
    if (state.timeout) clearTimeout(state.timeout)
  }
  const releasedState = concurrencyHandshake()
  if (releasedState?.phase !== 'release-requested')
    throw new Error('GAP08_CONCURRENCY_HANDSHAKE_RELEASE_INVALID')
  releasedState.phase = 'released-before-commit'
}

function failAfterNestedWork(args: CmsHookBaseArgs) {
  if (
    args.operation === 'create' &&
    args.resolvedData.code === 'g8-hook-parent-fail'
  )
    throw new Error('GAP08_SYNTHETIC_AFTER_OPERATION_FAILURE')
}

function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: /* GraphQL */ `
      extend type Query {
        redirectToInit: Boolean!
        gap08ConcurrencyHandshake: JSON!
      }

      extend type Mutation {
        gap08ArmConcurrencyHandshake: Boolean!
        gap08ReleaseConcurrencyHandshake: Boolean!
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: async (
          _root: unknown,
          _args: unknown,
          context: CmsContext,
        ) => (await context.sudo().query.Custodian.count({})) === 0,
        gap08ConcurrencyHandshake: gap08ConcurrencyHandshakeSnapshot,
      },
      Mutation: {
        gap08ArmConcurrencyHandshake,
        gap08ReleaseConcurrencyHandshake,
      },
    },
  })
}

const allOperations = {
  query: allowAll,
  create: allowAll,
  update: allowAll,
  delete: allowAll,
}

const Aster = list({
  db: { map: 'gap08_aster_rows' },
  ui: { labelField: 'code' },
  access: { operation: allOperations },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    partner: relationship({
      ref: 'Rook.aster',
      db: { foreignKey: { map: 'g8_partner_fk' } },
    }),
    members: relationship({ ref: 'Sable.aster', many: true }),
    links: relationship({
      ref: 'Tag.asters',
      many: true,
      db: { relationName: 'Gap08MappedTagLink' },
    }),
  },
  hooks: {
    afterOperation: {
      create: failAfterNestedWork,
      update: holdFirstMutationAfterWrite,
    },
  },
})

const Rook = list({
  db: { map: 'gap08_rook_rows' },
  ui: { labelField: 'code' },
  access: { operation: allOperations },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    aster: relationship({ ref: 'Aster.partner' }),
  },
})

const Sable = list({
  db: { map: 'gap08_sable_rows' },
  ui: { labelField: 'code' },
  access: { operation: allOperations },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    aster: relationship({
      ref: 'Aster.members',
      validation: { isRequired: true },
      db: { foreignKey: { map: 'g8_aster_fk' } },
    }),
  },
})

const Tag = list({
  db: { map: 'gap08_tag_rows' },
  ui: { labelField: 'code' },
  access: {
    operation: allOperations,
    filter: {
      query: () => ({ code: { not: { equals: 'g8-restricted' } } }),
    },
  },
  fields: {
    code: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    asters: relationship({
      ref: 'Aster.links',
      many: true,
      db: { relationName: 'Gap08MappedTagLink' },
    }),
  },
})

const session = statelessSessions<{ itemId: string; listKey?: string }>({
  maxAge: 60 * 60,
})
const { withAuth } = createAuth({
  listKey: 'Custodian',
  identityField: 'handle',
  secretField: 'secret',
  initFirstItem: { fields: ['displayName', 'handle', 'secret'] },
  sessionData: 'displayName handle',
})

export default withAuth(
  config({
    db: { provider: 'postgresql', url: 'env("DATABASE_URL")' },
    session,
    graphql: { extendGraphqlSchema },
    ui: {
      isAccessAllowed: ({ session: currentSession }) => Boolean(currentSession),
    },
    lists: {
      Custodian: list({
        db: { map: 'gap08_custodian_rows' },
        ui: {
          hideCreate: true,
          hideNavigation: true,
          labelField: 'displayName',
        },
        access: { operation: allOperations },
        fields: {
          displayName: text({ validation: { isRequired: true } }),
          handle: text({
            isIndexed: 'unique',
            validation: { isRequired: true },
          }),
          secret: password({ validation: { isRequired: true } }),
        },
      }),
      Aster,
      Rook,
      Sable,
      Tag,
    },
  }),
)
