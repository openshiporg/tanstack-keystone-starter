import { createFileRoute } from '@tanstack/react-router'
import { useActionState } from 'react'

import {
  AuthField,
  AuthMessage,
  AuthNotConfigured,
  AuthShell,
  AuthSubmit,
  PasswordInput,
} from '@/components/dashboard/auth-shell'
import { Input } from '@/components/ui/input'
import {
  buildDashboardPasswordAuthContract,
  executeDashboardGraphQL,
  fetchDashboardPublicAuthMeta,
} from '@/features/cms/graphql-client'
import type { DashboardPasswordAuthMeta } from '@/features/cms/graphql-client'
import { humanize } from '@/features/cms/gql-names'

export const Route = createFileRoute('/dashboard/init')({
  loader: () => fetchDashboardPublicAuthMeta(),
  component: InitRoute,
})

type InitFormState = {
  message: string | null
  formData: Record<string, string>
}

type DynamicMutationResult = Record<
  string,
  {
    __typename?: string
    sessionToken?: string
    message?: string
    item?: { id: string }
  }
>

export async function createInitialUserAndSignIn({
  auth,
  data,
}: {
  auth: DashboardPasswordAuthMeta
  data: Record<string, string>
}) {
  const contract = buildDashboardPasswordAuthContract(auth)
  await executeDashboardGraphQL<DynamicMutationResult>(
    `mutation CreateInitialDashboardItem($data: ${contract.createInitialInputName}!) {
      ${contract.createInitialMutationName}(data: $data) {
        sessionToken
        item { id }
      }
    }`,
    { data },
  )

  const signInResult = await executeDashboardGraphQL<DynamicMutationResult>(
    `mutation SignInAfterInit($identity: String!, $secret: String!) {
      ${contract.authenticateMutationName}(
        ${contract.identityField}: $identity
        ${contract.secretField}: $secret
      ) {
        __typename
        ... on ${contract.authenticationSuccessType} { sessionToken }
        ... on ${contract.authenticationFailureType} { message }
      }
    }`,
    {
      identity: data[contract.identityField] ?? '',
      secret: data[contract.secretField] ?? '',
    },
  )

  const authResult = signInResult[contract.authenticateMutationName]
  if (authResult?.__typename !== contract.authenticationSuccessType) {
    throw new Error(
      authResult?.message ||
        'Authentication failed after creating the initial admin user.',
    )
  }
}

function InitRoute() {
  const auth = Route.useLoaderData()
  if (!auth) {
    return <AuthNotConfigured />
  }
  return <ConfiguredInit auth={auth} />
}

function ConfiguredInit({ auth }: { auth: DashboardPasswordAuthMeta }) {
  const contract = buildDashboardPasswordAuthContract(auth)
  const initialValues = Object.fromEntries(
    contract.initFirstItemFields.map((field) => [field, '']),
  )
  const [formState, formAction] = useActionState(
    async (
      _previous: InitFormState,
      formData: FormData,
    ): Promise<InitFormState> => {
      const data = Object.fromEntries(
        contract.initFirstItemFields.map((field) => [
          field,
          String(formData.get(field) ?? ''),
        ]),
      )
      try {
        await createInitialUserAndSignIn({ auth, data })
        window.location.assign('/dashboard')
        return { message: null, formData: data }
      } catch (submissionError) {
        const message =
          submissionError instanceof Error
            ? submissionError.message
            : 'Unable to create the initial admin user.'
        console.error('[dashboard/init] createInitialUser failed:', message)
        return { message, formData: data }
      }
    },
    { message: null, formData: initialValues },
  )

  return (
    <AuthShell
      title="Create admin account"
      description="First run. This account gets full access."
    >
      <form action={formAction} className="flex flex-col gap-4">
        {contract.initFirstItemFields.map((field) => {
          const isSecret = field === contract.secretField
          const isIdentity = field === contract.identityField
          return (
            <AuthField key={field} id={field} label={humanize(field)}>
              {isSecret ? (
                <PasswordInput
                  id={field}
                  name={field}
                  autoComplete="new-password"
                  defaultValue={formState.formData[field] ?? ''}
                  required
                />
              ) : (
                <Input
                  id={field}
                  name={field}
                  type={
                    isIdentity && field.toLowerCase().includes('email')
                      ? 'email'
                      : 'text'
                  }
                  autoComplete={isIdentity ? 'username' : 'name'}
                  className="h-9"
                  defaultValue={formState.formData[field] ?? ''}
                  required
                />
              )}
            </AuthField>
          )
        })}
        <AuthSubmit pendingLabel="Creating account">Create account</AuthSubmit>
      </form>

      {formState.message ? <AuthMessage>{formState.message}</AuthMessage> : null}
    </AuthShell>
  )
}
