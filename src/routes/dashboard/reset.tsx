import { createFileRoute } from '@tanstack/react-router'
import type { SearchSchemaInput } from '@tanstack/react-router'
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

export const Route = createFileRoute('/dashboard/reset')({
  validateSearch: (
    search: SearchSchemaInput & {
      token?: unknown
      identity?: unknown
      email?: unknown
    },
  ) => ({
    token: typeof search.token === 'string' ? search.token : '',
    identity:
      typeof search.identity === 'string'
        ? search.identity
        : typeof search.email === 'string'
          ? search.email
          : '',
  }),
  loader: () => fetchDashboardPublicAuthMeta(),
  component: ResetRoute,
})

type ResetFormState = {
  message: string | null
  success: string | null
  formData: { identity: string; secret: string }
}

type DynamicResetResult = Record<
  string,
  boolean | { code?: string; message?: string } | null | undefined
>

function ResetRoute() {
  const auth = Route.useLoaderData()
  if (!auth) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p>Dashboard authentication is not configured.</p>
      </div>
    )
  }
  return <ConfiguredReset auth={auth} />
}

function ConfiguredReset({ auth }: { auth: DashboardPasswordAuthMeta }) {
  const search = Route.useSearch()
  const contract = buildDashboardPublicAuthOperations(auth)
  const [showPassword, setShowPassword] = useState(false)
  const redeemMode = Boolean(search.token)
  const [formState, formAction] = useActionState(
    async (
      _previous: ResetFormState,
      formData: FormData,
    ): Promise<ResetFormState> => {
      const identity = String(formData.get(contract.identityField) ?? '')
      const secret = String(formData.get(contract.secretField) ?? '')

      try {
        if (redeemMode) {
          const result = await executeDashboardGraphQL<DynamicResetResult>(
            `mutation RedeemReset($identity: String!, $token: String!, $secret: String!) {
              ${contract.redeemPasswordResetMutationName}(
                ${contract.identityField}: $identity
                token: $token
                ${contract.secretField}: $secret
              ) { code message }
            }`,
            { identity, token: search.token, secret },
          )
          const redemption = result[contract.redeemPasswordResetMutationName]
          if (
            redemption &&
            typeof redemption === 'object' &&
            redemption.message
          )
            throw new Error(redemption.message)
          return {
            message: null,
            success: 'Password has been reset. You can now sign in.',
            formData: { identity, secret },
          }
        }

        await executeDashboardGraphQL<DynamicResetResult>(
          `mutation SendReset($identity: String!) {
            ${contract.sendPasswordResetMutationName}(${contract.identityField}: $identity)
          }`,
          { identity },
        )
        return {
          message: null,
          success:
            'If an account exists for this identity, a reset link has been sent.',
          formData: { identity, secret },
        }
      } catch (submissionError) {
        return {
          message:
            submissionError instanceof Error
              ? submissionError.message
              : 'Reset operation failed.',
          success: null,
          formData: { identity, secret },
        }
      }
    },
    {
      message: null,
      success: null,
      formData: { identity: search.identity, secret: '' },
    },
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
          {redeemMode ? 'Reset your password' : 'Reset password'}
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {redeemMode
            ? 'Enter your new password below.'
            : `Enter your ${identityLabel.toLowerCase()} and we'll send you a link to reset your password.`}
        </p>

        <form className="mt-8 space-y-4" action={formAction}>
          <div>
            <Label
              htmlFor="reset-identity"
              className="text-sm font-medium text-foreground"
            >
              {identityLabel}
            </Label>
            <Input
              id="reset-identity"
              name={contract.identityField}
              type="text"
              autoComplete="username"
              className="mt-2 bg-muted/40"
              defaultValue={formState.formData.identity}
              required
            />
          </div>

          {redeemMode ? (
            <div>
              <Label
                htmlFor="reset-secret"
                className="text-sm font-medium text-foreground"
              >
                New {secretLabel}
              </Label>
              <div className="relative mt-2">
                <Input
                  id="reset-secret"
                  name={contract.secretField}
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  className="bg-muted/40 pr-10"
                  defaultValue={formState.formData.secret}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((previous) => !previous)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-500"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>
          ) : null}

          <ResetSubmitButton redeemMode={redeemMode} />
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
        {formState.success ? (
          <Badge className="mt-4 flex items-start gap-2 rounded-sm bg-emerald-500/10 p-4 text-base text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300">
            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-semibold tracking-wider uppercase">
                Success
              </h2>
              <span className="break-all text-sm font-normal opacity-75">
                {formState.success}
              </span>
            </div>
          </Badge>
        ) : null}
      </div>
    </div>
  )
}

function ResetSubmitButton({ redeemMode }: { redeemMode: boolean }) {
  const { pending } = useFormStatus()
  return (
    <Button
      className="w-full py-2 font-medium"
      type="submit"
      disabled={pending}
    >
      {pending ? (
        <Loader2Icon className="size-4 shrink-0 animate-spin" />
      ) : redeemMode ? (
        'Reset password'
      ) : (
        'Send reset link'
      )}
    </Button>
  )
}
