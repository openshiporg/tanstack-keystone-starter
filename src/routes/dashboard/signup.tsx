import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { Eye, EyeOff, Loader2Icon } from 'lucide-react'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Logo } from '@/components/dashboard/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p>Dashboard authentication is not configured.</p>
      </div>
    )
  }
  return <ConfiguredSignUp auth={auth} />
}

function ConfiguredSignUp({ auth }: { auth: DashboardPasswordAuthMeta }) {
  const navigate = Route.useNavigate()
  const contract = buildDashboardPublicAuthOperations(auth)
  const fields = [...new Set(contract.initFirstItemFields)]
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center space-x-1.5">
          <Logo className="h-8 w-fit" aria-hidden="true" />
        </div>
        <h3 className="mt-6 text-lg font-semibold text-foreground">
          Create your account
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Already have an account?
          <Link
            to="/dashboard/signin"
            className="ml-1 font-medium text-primary hover:text-primary/90"
          >
            Sign in
          </Link>
        </p>

        <form className="mt-8 space-y-4" action={formAction}>
          {fields.map((field) => {
            const isSecret = field === contract.secretField
            const isIdentity = field === contract.identityField
            return (
              <div key={field}>
                <Label
                  htmlFor={`signup-${field}`}
                  className="text-sm font-medium text-foreground"
                >
                  {humanize(field)}
                </Label>
                <div className={isSecret ? 'relative mt-2' : undefined}>
                  <Input
                    id={`signup-${field}`}
                    name={field}
                    type={isSecret && !showPassword ? 'password' : 'text'}
                    autoComplete={
                      isSecret
                        ? 'new-password'
                        : isIdentity
                          ? 'username'
                          : undefined
                    }
                    className={
                      isSecret ? 'bg-muted/40 pr-10' : 'mt-2 bg-muted/40'
                    }
                    defaultValue={formState.formData[field] ?? ''}
                    required
                  />
                  {isSecret ? (
                    <button
                      type="button"
                      onClick={() => setShowPassword((previous) => !previous)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                      aria-label={
                        showPassword ? 'Hide password' : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
            )
          })}
          <SignUpSubmitButton />
        </form>

        {formState.message ? (
          <Badge
            variant="destructive"
            className="mt-4 flex items-start gap-2 rounded-sm border border-destructive/50 bg-destructive/5 p-4 text-base hover:bg-destructive/10"
          >
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold tracking-wider uppercase">
                Error
              </h2>
              <span className="break-all text-sm font-normal opacity-75">
                {formState.message}
              </span>
            </div>
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function SignUpSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="w-full py-2 font-medium"
      disabled={pending}
    >
      {pending ? (
        <Loader2Icon className="size-4 shrink-0 animate-spin" />
      ) : (
        'Sign up'
      )}
    </Button>
  )
}
