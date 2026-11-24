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
    return <AuthNotConfigured />
  }
  return <ConfiguredReset auth={auth} />
}

function ConfiguredReset({ auth }: { auth: DashboardPasswordAuthMeta }) {
  const search = Route.useSearch()
  const contract = buildDashboardPublicAuthOperations(auth)
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
    <AuthShell
      title={redeemMode ? 'New password' : 'Reset password'}
      description={
        redeemMode
          ? undefined
          : `We'll send a reset link to your ${identityLabel.toLowerCase()}.`
      }
      foot={
        <Link to="/dashboard/signin" className={authLinkClass}>
          Back to sign in
        </Link>
      }
    >
      <form className="flex flex-col gap-4" action={formAction}>
        <AuthField id="reset-identity" label={identityLabel}>
          <Input
            id="reset-identity"
            name={contract.identityField}
            type={
              contract.identityField.toLowerCase().includes('email')
                ? 'email'
                : 'text'
            }
            autoComplete="username"
            className="h-9"
            defaultValue={formState.formData.identity}
            aria-invalid={formState.message ? true : undefined}
            required
          />
        </AuthField>

        {redeemMode ? (
          <AuthField id="reset-secret" label={`New ${secretLabel.toLowerCase()}`}>
            <PasswordInput
              id="reset-secret"
              name={contract.secretField}
              autoComplete="new-password"
              defaultValue={formState.formData.secret}
              aria-invalid={formState.message ? true : undefined}
              required
            />
          </AuthField>
        ) : null}

        <AuthSubmit pendingLabel={redeemMode ? 'Saving' : 'Sending'}>
          {redeemMode ? 'Reset password' : 'Send reset link'}
        </AuthSubmit>
      </form>

      {formState.message ? <AuthMessage>{formState.message}</AuthMessage> : null}
      {formState.success ? (
        <AuthMessage tone="success">{formState.success}</AuthMessage>
      ) : null}
    </AuthShell>
  )
}
