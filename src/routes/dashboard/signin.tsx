import { Link, createFileRoute } from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
import { useActionState } from 'react'

import {
  AuthField,
  AuthMessage,
  AuthNotConfigured,
  AuthShell,
  AuthSubmit,
  PasswordInput,
  authLinkClass,
} from '@/components/dashboard/auth-shell'
import { Input } from '@/components/ui/input'
import { getPublicSignupsAllowed } from '@/features/cms/public-signups.functions'
import { safeDashboardRedirectPath } from '@/features/cms/dashboard-route-guards'
import {
  buildDashboardPasswordAuthContract,
  executeDashboardGraphQL,
  fetchDashboardPublicAuthMeta,
} from '@/features/cms/graphql-client'
import type { DashboardPasswordAuthMeta } from '@/features/cms/graphql-client'
import { humanize } from '@/features/cms/gql-names'

export const Route = createFileRoute('/dashboard/signin')({
  validateSearch: (search: SearchSchemaInput & { from?: unknown }) => ({
    from: typeof search.from === 'string' ? search.from : undefined,
  }),
  loader: async () => {
    const [auth, signupsAllowed] = await Promise.all([
      fetchDashboardPublicAuthMeta(),
      getPublicSignupsAllowed(),
    ])
    return { auth, signupsAllowed }
  },
  component: SignInRoute,
})

type AuthFormState = {
  message: string | null
  formData: { identity: string; secret: string }
}

type DynamicAuthenticationResult = Record<
  string,
  { __typename: string; sessionToken?: string; message?: string }
>

export async function authenticateDashboardWithPassword({
  auth,
  identity,
  secret,
}: {
  auth: DashboardPasswordAuthMeta
  identity: string
  secret: string
}) {
  const contract = buildDashboardPasswordAuthContract(auth)
  const result = await executeDashboardGraphQL<DynamicAuthenticationResult>(
    `mutation DashboardSignIn($identity: String!, $secret: String!) {
      ${contract.authenticateMutationName}(
        ${contract.identityField}: $identity
        ${contract.secretField}: $secret
      ) {
        __typename
        ... on ${contract.authenticationSuccessType} { sessionToken }
        ... on ${contract.authenticationFailureType} { message }
      }
    }`,
    { identity, secret },
  )
  const authResult = result[contract.authenticateMutationName]
  if (authResult?.__typename !== contract.authenticationSuccessType) {
    throw new Error(authResult?.message || 'Authentication failed.')
  }
}

function SignInRoute() {
  const search = Route.useSearch()
  const { auth, signupsAllowed } = Route.useLoaderData()
  if (!auth) {
    return <AuthNotConfigured />
  }
  return (
    <ConfiguredSignIn
      auth={auth}
      from={search.from}
      signupsAllowed={signupsAllowed}
    />
  )
}

function ConfiguredSignIn({
  auth,
  from,
  signupsAllowed,
}: {
  auth: DashboardPasswordAuthMeta
  from?: string
  signupsAllowed: boolean
}) {
  const contract = buildDashboardPasswordAuthContract(auth)
  const [formState, formAction] = useActionState(
    async (
      _previous: AuthFormState,
      formData: FormData,
    ): Promise<AuthFormState> => {
      const identity = String(formData.get(contract.identityField) ?? '')
      const secret = String(formData.get(contract.secretField) ?? '')
      try {
        await authenticateDashboardWithPassword({ auth, identity, secret })
        window.location.assign(safeDashboardRedirectPath(from))
        return { message: null, formData: { identity, secret } }
      } catch (submissionError) {
        return {
          message:
            submissionError instanceof Error
              ? submissionError.message
              : 'Authentication failed.',
          formData: { identity, secret },
        }
      }
    },
    { message: null, formData: { identity: '', secret: '' } },
  )

  const identityLabel = humanize(contract.identityField)
  const secretLabel = humanize(contract.secretField)
  return (
    <AuthShell
      title="Sign in"
      foot={
        signupsAllowed ? (
          <>
            No account?{' '}
            <Link to="/dashboard/signup" className={authLinkClass}>
              Sign up
            </Link>
          </>
        ) : undefined
      }
    >
      <form className="flex flex-col gap-4" action={formAction}>
        <input type="hidden" name="from" value={from ?? '/dashboard'} />
        <AuthField id={contract.identityField} label={identityLabel}>
          <Input
            id={contract.identityField}
            name={contract.identityField}
            type={
              contract.identityField.toLowerCase().includes('email')
                ? 'email'
                : 'text'
            }
            autoComplete="username"
            placeholder={
              contract.identityField.toLowerCase().includes('email')
                ? 'you@company.com'
                : undefined
            }
            className="h-9"
            defaultValue={formState.formData.identity}
            aria-invalid={formState.message ? true : undefined}
            required
          />
        </AuthField>
        <AuthField
          id={contract.secretField}
          label={secretLabel}
          aside={
            <Link
              to="/dashboard/reset"
              className="text-[12px] text-[var(--ks-dim)] hover:text-[var(--ks-ink)]"
            >
              Forgot?
            </Link>
          }
        >
          <PasswordInput
            id={contract.secretField}
            name={contract.secretField}
            autoComplete="current-password"
            defaultValue={formState.formData.secret}
            aria-invalid={formState.message ? true : undefined}
            required
          />
        </AuthField>
        <AuthSubmit pendingLabel="Signing in">Sign in</AuthSubmit>
      </form>

      {formState.message ? <AuthMessage>{formState.message}</AuthMessage> : null}
    </AuthShell>
  )
}
