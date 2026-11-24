import { Link, createFileRoute, redirect } from '@tanstack/react-router'
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
import {
  buildDashboardPublicAuthOperations,
  executeDashboardGraphQL,
  fetchDashboardPublicAuthMeta,
} from '@/features/cms/graphql-client'
import type { DashboardPasswordAuthMeta } from '@/features/cms/graphql-client'
import { humanize } from '@/features/cms/gql-names'

function publicSignupsAllowed() {
  return (
    process.env.PUBLIC_SIGNUPS_ALLOWED === 'true' ||
    import.meta.env.PUBLIC_SIGNUPS_ALLOWED === 'true'
  )
}

export const Route = createFileRoute('/dashboard/signup')({
  beforeLoad: () => {
    if (!publicSignupsAllowed()) throw redirect({ to: '/dashboard/signin' })
  },
  loader: () => fetchDashboardPublicAuthMeta(),
  component: SignUpRoute,
})

type SignUpFormState = {
  message: string | null
  formData: Record<string, string>
}

type DynamicMutationResult = Record<
  string,
  | {
      id?: string
      __typename?: string
      sessionToken?: string
      message?: string
    }
  | undefined
>

function SignUpRoute() {
  const auth = Route.useLoaderData()
  if (!auth) {
    return <AuthNotConfigured />
  }
  return <ConfiguredSignUp auth={auth} />
}

function ConfiguredSignUp({ auth }: { auth: DashboardPasswordAuthMeta }) {
  const navigate = Route.useNavigate()
  const contract = buildDashboardPublicAuthOperations(auth)
  const fields = [...new Set(contract.initFirstItemFields)]
  const [formState, formAction] = useActionState(
    async (
      _previous: SignUpFormState,
      formData: FormData,
    ): Promise<SignUpFormState> => {
      const values = Object.fromEntries(
        fields.map((field) => [field, String(formData.get(field) ?? '')]),
      )
      const identity = values[contract.identityField] ?? ''
      const secret = values[contract.secretField] ?? ''

      try {
        const created = await executeDashboardGraphQL<DynamicMutationResult>(
          `mutation DashboardSignUp($data: ${contract.createInputName}!) {
            ${contract.createMutationName}(data: $data) { id }
          }`,
          { data: values },
        )
        if (!created[contract.createMutationName]?.id)
          throw new Error('Account creation failed.')

        const authResult = await executeDashboardGraphQL<DynamicMutationResult>(
          `mutation DashboardSignInAfterSignUp($identity: String!, $secret: String!) {
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
        const result = authResult[contract.authenticateMutationName]
        if (result?.__typename !== contract.authenticationSuccessType)
          throw new Error(result?.message || 'Authentication failed.')
        await navigate({ to: '/dashboard' })
        return { message: null, formData: values }
      } catch (submissionError) {
        return {
          message:
            submissionError instanceof Error
              ? submissionError.message
              : 'An error occurred',
          formData: values,
        }
      }
    },
    { message: null, formData: {} },
  )

  return (
    <AuthShell
      title="Create account"
      foot={
        <>
          Have an account?{' '}
          <Link to="/dashboard/signin" className={authLinkClass}>
            Sign in
          </Link>
        </>
      }
    >
      <form className="flex flex-col gap-4" action={formAction}>
        {fields.map((field) => {
          const isSecret = field === contract.secretField
          const isIdentity = field === contract.identityField
          const id = `signup-${field}`
          return (
            <AuthField key={field} id={id} label={humanize(field)}>
              {isSecret ? (
                <PasswordInput
                  id={id}
                  name={field}
                  autoComplete="new-password"
                  defaultValue={formState.formData[field] ?? ''}
                  required
                />
              ) : (
                <Input
                  id={id}
                  name={field}
                  type={
                    isIdentity && field.toLowerCase().includes('email')
                      ? 'email'
                      : 'text'
                  }
                  autoComplete={isIdentity ? 'username' : undefined}
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
