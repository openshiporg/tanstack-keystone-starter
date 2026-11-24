import { mergeSchemas } from '@graphql-tools/schema'
import type { GraphQLSchema } from 'graphql'

import { createAuth, statelessSessions } from './src/features/cms/keystone/auth'
import { config } from './src/features/cms/keystone/core'
import models from './src/features/cms/models'
import { demoMemorySeed } from './cms.seed'
import type { CmsContext } from './src/features/cms/adapters'
import { sendPasswordResetEmail } from './src/features/cms/password-reset-mail'

function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: /* GraphQL */ `
      type Query {
        redirectToInit: Boolean
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: async (
          _root: unknown,
          _args: unknown,
          context: CmsContext,
        ) => {
          const userCount = await context.sudo().query.User.count({})
          return userCount === 0
        },
      },
    },
  })
}

const session = statelessSessions<{ itemId: string; listKey?: string }>({
  maxAge: 60 * 60 * 24 * 360,
})

const {
  S3_BUCKET_NAME: bucketName = 'keystone-test',
  S3_REGION: region = 'ap-southeast-2',
  S3_ACCESS_KEY_ID: accessKeyId = 'keystone',
  S3_SECRET_ACCESS_KEY: secretAccessKey = 'keystone',
  S3_ENDPOINT: endpoint = 'https://sfo3.digitaloceanspaces.com',
} = process.env

const { withAuth } = createAuth({
  listKey: 'User',
  identityField: 'email',
  secretField: 'password',
  initFirstItem: {
    fields: ['name', 'email', 'password'],
    itemData: {
      role: {
        create: {
          name: 'Admin',
          canCreateTodos: true,
          canManageAllTodos: true,
          canSeeOtherPeople: true,
          canEditOtherPeople: true,
          canManagePeople: true,
          canManageRoles: true,
          canAccessDashboard: true,
        },
      },
    },
  },
  passwordResetLink: {
    sendToken: ({ token, identity }) => sendPasswordResetEmail(token, identity),
  },
  rateLimit: {
    login: { maxAttempts: 5, windowMs: 60 * 1000 },
    passwordReset: { maxAttempts: 5, windowMs: 60 * 1000 },
  },
  sessionData: `
    name
    email
    role {
      id
      name
      canCreateTodos
      canManageAllTodos
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canAccessDashboard
    }
  `,
})

export default withAuth(
  config({
    db: {
      provider: 'postgresql',
      url: 'env("DATABASE_URL")',
      prismaModelOrder: ['User', 'Role', 'Todo', 'TodoImage'],
    },
    session,
    memory: { seed: demoMemorySeed },
    storage: {
      my_images: {
        kind: 's3',
        type: 'image',
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5000 },
        forcePathStyle: true,
      },
    },
    ui: {
      isAccessAllowed: ({ session: currentSession }) => {
        const sessionData = currentSession as
          | { data?: { role?: { canAccessDashboard?: boolean } } }
          | undefined
        return sessionData?.data?.role?.canAccessDashboard ?? false
      },
    },
    graphql: {
      extendGraphqlSchema,
    },
    lists: models,
  }),
)
