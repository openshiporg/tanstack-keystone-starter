import { createYoga } from 'graphql-yoga'

import cmsConfig from '../../../cms.config'
import { createCmsContext, getCmsGraphQLSchema } from './runtime'
import type { CmsContext } from './runtime'

export const cmsGraphQLSchema = getCmsGraphQLSchema()

export const cmsGraphQLYoga = createYoga<
  { cmsResponseHeaders?: Headers },
  CmsContext
>({
  schema: cmsGraphQLSchema,
  graphqlEndpoint: cmsConfig.graphql?.path ?? '/api/graphql',
  graphiql:
    cmsConfig.graphql?.playground ?? process.env.NODE_ENV !== 'production',
  logging: false,
  context: ({
    request,
    cmsResponseHeaders,
  }: {
    request: Request
    cmsResponseHeaders?: Headers
  }) => createCmsContext(request, cmsGraphQLSchema, cmsResponseHeaders),
})

export { adminMetaGraphQLQuery } from './admin-meta-query'
