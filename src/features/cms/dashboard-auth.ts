import { graphql } from 'graphql'

import { cmsGraphQLSchema } from './graphql'
import { createCmsContext } from './runtime'
import cmsConfig from '../../../cms.config'

export type DashboardAuthState = {
  authenticatedItem: {
    id: string
    isAccessAllowed: boolean
  } | null
  redirectToInit: boolean
}

export function createDashboardAuthRequest(request: Request) {
  const headers = new Headers(request.headers)
  headers.set('x-cms-disable-dev-auth-fallback', 'true')
  return new Request(request.url, { headers })
}

export async function getDashboardAuthState(
  request: Request,
): Promise<DashboardAuthState> {
  const cmsContext = await createCmsContext(
    createDashboardAuthRequest(request),
    cmsGraphQLSchema,
  )
  const result = await graphql({
    schema: cmsGraphQLSchema,
    source: /* GraphQL */ `
      query DashboardAuthState {
        redirectToInit
      }
    `,
    contextValue: cmsContext,
  })

  if (result.errors?.length) {
    throw new Error(result.errors.map((error) => error.message).join('\n'))
  }

  const data = result.data as
    | Pick<DashboardAuthState, 'redirectToInit'>
    | undefined
  if (!cmsContext.session?.itemId) {
    return {
      authenticatedItem: null,
      redirectToInit: Boolean(data?.redirectToInit),
    }
  }

  const isAccessAllowed =
    typeof cmsConfig.ui?.isAccessAllowed === 'function'
      ? await cmsConfig.ui.isAccessAllowed(cmsContext)
      : true

  return {
    authenticatedItem: {
      id: cmsContext.session.itemId,
      isAccessAllowed,
    },
    redirectToInit: Boolean(data?.redirectToInit),
  }
}
