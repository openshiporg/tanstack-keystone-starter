import { Link, createFileRoute } from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
import { Eye, EyeOff, Loader2Icon } from 'lucide-react'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Logo } from '@/components/dashboard/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  loader: () => fetchDashboardPublicAuthMeta(),
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
  const auth = Route.useLoaderData()
  if (!auth) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p>Dashboard authentication is not configured.</p>
      </div>
    )
  }
  return <ConfiguredSignIn auth={auth} from={search.from} />
}

function ConfiguredSignIn({
  auth,
  from,
}: {
  auth: DashboardPasswordAuthMeta
  from?: string
}) {
  const contract = buildDashboardPasswordAuthContract(auth)
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center space-x-1.5">
          <Logo className="h-8 w-fit" aria-hidden="true" />
        </div>
        <h3 className="mt-6 text-lg font-semibold text-foreground">
          Sign in to your account
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Don&apos;t have an account?
          <Link
            to="/dashboard/signup"
            className="ml-1 font-medium text-primary hover:text-primary/90"
          >
            Sign up
          </Link>
        </p>
        <form className="mt-8 space-y-4" action={formAction}>
          <input type="hidden" name="from" value={from ?? '/dashboard'} />
          <div>
            <Label
              htmlFor={contract.identityField}
              className="text-sm font-medium text-foreground"
            >
              {identityLabel}
            </Label>
            <Input
              id={contract.identityField}
              name={contract.identityField}
              type={
                contract.identityField.toLowerCase().includes('email')
                  ? 'email'
                  : 'text'
              }
              autoComplete="username"
              placeholder={`Enter ${identityLabel.toLowerCase()}`}
              className="mt-2 bg-muted/40"
              defaultValue={formState.formData.identity}
              required
            />
          </div>
          <div>
            <Label
              htmlFor={contract.secretField}
              className="text-sm font-medium text-foreground"
            >
              {secretLabel}
            </Label>
            <div className="relative mt-2">
              <Input
                id={contract.secretField}
                name={contract.secretField}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder={`Enter ${secretLabel.toLowerCase()}`}
                className="bg-muted/40 pr-10"
                defaultValue={formState.formData.secret}
                required
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((previous) => !previous)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
          <SignInSubmitButton />
        </form>

        {formState.message ? (
          <Badge
            variant="destructive"
            className="mt-4 flex items-start gap-2 rounded-sm border border-destructive/50 bg-destructive/5 p-4 text-base hover:bg-destructive/10"
          >
            <span className="font-semibold">Error:</span>
            <span className="break-all text-sm font-normal opacity-75">
              {formState.message}
            </span>
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function SignInSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="w-full py-2 font-medium"
      disabled={pending}
    >
      {pending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
      Sign in
    </Button>
  )
}
