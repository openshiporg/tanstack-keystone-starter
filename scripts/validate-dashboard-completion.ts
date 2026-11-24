import assert from 'node:assert/strict'

import { graphql } from 'graphql'

import { completeDashboardPrompt } from '@/features/cms/dashboard-completion'
import { cmsGraphQLSchema } from '@/features/cms/graphql'
import { clearMcpAuditEvents, getMcpAuditEvents } from '@/features/cms/mcp'
import { createCmsContext } from '@/features/cms/runtime'

async function main() {
  const authRequest = new Request(
    'http://tanstack-keystone.local/api/graphql',
    { headers: { 'x-cms-disable-dev-auth-fallback': 'true' } },
  )
  const authContext = await createCmsContext(
    authRequest,
    cmsGraphQLSchema,
    new Headers(),
  )
  const authResult = await graphql({
    schema: cmsGraphQLSchema,
    source: /* GraphQL */ `
      mutation ValidateDashboardCompletionAuth(
        $email: String!
        $password: String!
      ) {
        authenticateUserWithPassword(email: $email, password: $password) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            sessionToken
          }
          ... on UserAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
    variableValues: { email: 'ada@example.com', password: 'password' },
    contextValue: authContext,
  })
  assert.equal(
    authResult.errors?.length ?? 0,
    0,
    'authentication mutation should not return GraphQL errors',
  )
  const authPayload = (
    authResult.data as
      | {
          authenticateUserWithPassword?: {
            __typename?: string
            sessionToken?: string
            message?: string
          }
        }
      | undefined
  )?.authenticateUserWithPassword
  assert(authPayload, 'authentication payload should be present')
  assert.equal(
    authPayload.__typename,
    'UserAuthenticationWithPasswordSuccess',
    authPayload.message ?? 'expected successful dashboard auth',
  )
  assert(
    authPayload.sessionToken,
    'authentication should return a session token',
  )

  const request = new Request('http://tanstack-keystone.local/api/completion', {
    headers: {
      authorization: `Bearer ${authPayload.sessionToken}`,
      'x-cms-disable-dev-auth-fallback': 'true',
    },
  })

  const editorAuthResult = await graphql({
    schema: cmsGraphQLSchema,
    source: /* GraphQL */ `
      mutation ValidateEditorDashboardCompletionAuth(
        $email: String!
        $password: String!
      ) {
        authenticateUserWithPassword(email: $email, password: $password) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            sessionToken
          }
        }
      }
    `,
    variableValues: { email: 'ed@example.com', password: 'password' },
    contextValue: authContext,
  })
  const editorSessionToken = (
    editorAuthResult.data as
      | {
          authenticateUserWithPassword?: { sessionToken?: string }
        }
      | undefined
  )?.authenticateUserWithPassword?.sessionToken
  assert(editorSessionToken, 'editor authentication should return a token')
  clearMcpAuditEvents()
  await assert.rejects(
    completeDashboardPrompt(
      new Request('http://tanstack-keystone.local/api/completion', {
        headers: {
          authorization: `Bearer ${editorSessionToken}`,
          'x-cms-disable-dev-auth-fallback': 'true',
        },
      }),
      { prompt: 'create roles {"name":"Must not be proposed"}' },
    ),
    /unknown or inaccessible list/i,
  )
  assert.equal(
    getMcpAuditEvents().length,
    0,
    'AdminMeta-hidden create must be rejected before MCP execution',
  )

  const listResult = await completeDashboardPrompt(request, {
    prompt: 'What lists can I manage?',
  })
  assert.match(
    listResult.message,
    /dashboard currently exposes these visible lists/i,
  )

  const identityResult = await completeDashboardPrompt(request, {
    prompt: 'Who am I?',
  })
  assert.match(identityResult.message, /signed in as/i)

  clearMcpAuditEvents()
  const proposal = await completeDashboardPrompt(request, {
    prompt: 'create todos {"label":"Assistant-confirmed Todo"}',
  })
  assert(
    proposal.pendingAction,
    'a CRUD prompt should produce a pending action',
  )
  assert.match(proposal.message, /review/i)
  assert.equal(
    getMcpAuditEvents().length,
    0,
    'proposing an action must not execute an MCP mutation',
  )
  const tamperedAction = structuredClone(proposal.pendingAction)
  tamperedAction.arguments = {
    ...tamperedAction.arguments,
    data: { label: 'Tampered after review' },
  }
  await assert.rejects(
    completeDashboardPrompt(request, {
      action: tamperedAction,
      confirmed: true,
    }),
    /changed.*expired/i,
  )
  assert.equal(
    getMcpAuditEvents().length,
    0,
    'a changed proposal must be rejected before MCP execution',
  )

  const confirmation = await completeDashboardPrompt(request, {
    action: proposal.pendingAction,
    confirmed: true,
  })
  assert.equal(confirmation.invalidateDashboardQueries, true)
  assert.match(confirmation.message, /completed/i)
  assert.equal(getMcpAuditEvents().at(-1)?.outcome, 'allowed')
  const auditCountAfterConfirmation = getMcpAuditEvents().length
  await assert.rejects(
    completeDashboardPrompt(request, {
      action: proposal.pendingAction,
      confirmed: true,
    }),
    /already used/i,
  )
  assert.equal(
    getMcpAuditEvents().length,
    auditCountAfterConfirmation,
    'a replayed approval must be rejected before MCP execution',
  )

  const secretProposal = await completeDashboardPrompt(request, {
    prompt:
      'create users {"name":"Assistant Secret Review","email":"assistant-secret@example.com","password":"do-not-echo-this"}',
  })
  assert(secretProposal.pendingAction)
  assert.match(secretProposal.pendingAction.summary, /\[redacted\]/)
  assert.doesNotMatch(secretProposal.pendingAction.summary, /do-not-echo-this/)

  const nestedSecretProposal = await completeDashboardPrompt(request, {
    prompt:
      'create todos {"label":"Nested secret review","assignedTo":{"create":{"name":"Nested User","email":"nested-secret@example.com","password":"nested-do-not-echo"}}}',
  })
  assert(nestedSecretProposal.pendingAction)
  assert.match(nestedSecretProposal.pendingAction.summary, /\[redacted\]/)
  assert.doesNotMatch(
    nestedSecretProposal.pendingAction.summary,
    /nested-do-not-echo/,
  )

  const createdId = confirmation.message.match(/\(([^)]+)\)/)?.[1]
  assert(createdId, 'confirmed create should report the created id')

  const deleteProposal = await completeDashboardPrompt(request, {
    prompt: `delete todos {"id":${JSON.stringify(createdId)}}`,
  })
  assert(deleteProposal.pendingAction)
  const deletion = await completeDashboardPrompt(request, {
    action: deleteProposal.pendingAction,
    confirmed: true,
  })
  assert.match(deletion.message, /completed/i)

  let rejected = false
  try {
    await completeDashboardPrompt(
      new Request('http://tanstack-keystone.local/api/completion', {
        headers: { 'x-cms-disable-dev-auth-fallback': 'true' },
      }),
      { prompt: 'Hello' },
    )
  } catch (error) {
    rejected = true
    assert.match(String(error), /signed in/i)
  }
  assert.equal(
    rejected,
    true,
    'anonymous completion requests should be rejected',
  )

  console.log('Dashboard completion validation passed.')
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
