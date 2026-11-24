import { createFileRoute } from '@tanstack/react-router'
import { Eye, EyeOff, Loader2Icon } from 'lucide-react'
import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import { Logo } from '@/components/dashboard/logo'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p>Dashboard authentication is not configured.</p>
      </div>
    )
  }
  return <ConfiguredInit auth={auth} />
}

function ConfiguredInit({ auth }: { auth: DashboardPasswordAuthMeta }) {
  const [showPassword, setShowPassword] = useState(false)
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
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex items-center space-x-1.5">
          <Logo className="h-8 w-fit" aria-hidden="true" />
        </div>
        <h3 className="mt-6 text-lg font-semibold text-foreground">
          Create admin account
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Set up your admin account to get started.
        </p>

        <form action={formAction} className="mt-8 space-y-4">
          {contract.initFirstItemFields.map((field) => {
            const isSecret = field === contract.secretField
            const isIdentity = field === contract.identityField
            return (
              <div key={field}>
                <Label
                  htmlFor={field}
                  className="text-sm font-medium text-foreground"
                >
                  {humanize(field)}
                </Label>
                <div className={isSecret ? 'relative mt-2' : undefined}>
                  <Input
                    id={field}
                    name={field}
                    type={
                      isSecret
                        ? showPassword
                          ? 'text'
                          : 'password'
                        : isIdentity && field.toLowerCase().includes('email')
                          ? 'email'
                          : 'text'
                    }
                    autoComplete={
                      isSecret
                        ? 'new-password'
                        : isIdentity
                          ? 'username'
                          : 'name'
                    }
                    placeholder={`Enter ${humanize(field).toLowerCase()}`}
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
          <InitSubmitButton />
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

function InitSubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button
      type="submit"
      className="w-full py-2 font-medium"
      disabled={pending}
    >
      {pending ? <Loader2Icon className="mr-2 size-4 animate-spin" /> : null}
      Create account
    </Button>
  )
}
