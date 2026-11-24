import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { graphql } from 'graphql'

import { createCmsContext } from './runtime'
import { cmsGraphQLSchema } from './graphql'

type DashboardGraphQLError = {
  message: string
  path?: Array<string | number>
  extensions?: Record<string, unknown>
}

type DashboardGraphQLResponse<TData> = {
  data?: TData
  errors?: DashboardGraphQLError[]
}

function getCurrentRequestHeaders() {
  try {
    return getRequest().headers
  } catch {
    return undefined
  }
}

function createDashboardGraphQLRequest(headers?: HeadersInit) {
  const requestHeaders = new Headers(getCurrentRequestHeaders())
  new Headers(headers).forEach((value, key) => requestHeaders.set(key, value))

  // Dashboard requests should behave like Keystone Admin UI requests, not like local
  // development seed-user shortcuts. Auth must come from a real cookie/Bearer token.
  requestHeaders.set('x-cms-disable-dev-auth-fallback', 'true')

  return new Request('http://tanstack-keystone.local/api/graphql', {
    headers: requestHeaders,
  })
}

const executeDashboardGraphQLInProcessRawIsomorphic = createIsomorphicFn()
  .client(
    (
      _query: string,
      _variables?: Record<string, unknown>,
      _headers?: HeadersInit,
    ): Promise<DashboardGraphQLResponse<unknown>> => {
      throw new Error(
        'In-process dashboard GraphQL is only available during server rendering',
      )
    },
  )
  .server(
    async (
      query: string,
      variables?: Record<string, unknown>,
      headers?: HeadersInit,
    ): Promise<DashboardGraphQLResponse<unknown>> => {
      const result = await graphql({
        schema: cmsGraphQLSchema,
        source: query,
        variableValues: variables,
        contextValue: await createCmsContext(
          createDashboardGraphQLRequest(headers),
          cmsGraphQLSchema,
        ),
      })

      return {
        data: result.data,
        errors: result.errors?.map((error) => ({
          message: error.message,
          path: error.path ? [...error.path] : undefined,
          extensions: { ...error.extensions },
        })),
      }
    },
  )

export async function executeDashboardGraphQLInProcessRaw<TData>(
  query: string,
  variables?: Record<string, unknown>,
  headers?: HeadersInit,
): Promise<DashboardGraphQLResponse<TData>> {
  return (await executeDashboardGraphQLInProcessRawIsomorphic(
    query,
    variables,
    headers,
  )) as DashboardGraphQLResponse<TData>
}

export async function executeDashboardGraphQLInProcess<TData>(
  query: string,
  variables?: Record<string, unknown>,
  headers?: HeadersInit,
): Promise<TData> {
  const result = await executeDashboardGraphQLInProcessRaw<TData>(
    query,
    variables,
    headers,
  )

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  }

  if (!result.data) {
    throw new Error('GraphQL response did not include data')
  }

  return result.data
}
