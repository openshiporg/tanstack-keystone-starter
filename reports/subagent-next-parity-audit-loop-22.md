# Code Context

## Files Retrieved
1. `src/routes/dashboard/signup.tsx` (lines 1-155) - target signup route still uses local `useState`, controlled inputs, and imperative `onSubmit`; this is the clearest remaining parity gap.
2. `src/routes/dashboard/signin.tsx` (lines 1-128) - target signin route already shows the parity pattern to copy locally: `useActionState`, `useFormStatus`, returned `{ message, formData }`, and form `action={formAction}`.
3. `src/routes/dashboard/reset.tsx` (lines 1-161) - target reset route also still uses imperative local submit state, confirming auth action-state parity is not fully finished.
4. `src/routes/dashboard/init.tsx` (lines 1-96) - target initial-user creation route likewise still uses manual submit/loading state.
5. `../next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx` (lines 1-118) - reference signup form uses `useActionState` and field rehydration via returned state.
6. `../next-keystone-starter/features/dashboard/screens/SignInPage/SignInForm.tsx` (lines 1-105) - reference signin confirms the same action-state architecture.
7. `../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx` (lines 1-138) - reference reset form also uses `useActionState`.
8. `../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx` (lines 1-183) - reference init page uses `useActionState` for first-user creation.
9. `../next-keystone-starter/features/dashboard/actions/auth.ts` (lines 92-129, 206-289) - reference auth actions return state objects like `{ message, success, formData }`, which the screens consume through `useActionState`.

## Key Code

### Target signup is still imperative
`src/routes/dashboard/signup.tsx:38-82`
```ts
const [formState, setFormState] = useState<SignUpFormState>({ message: null, formData: { email: '', password: '' } })
const [submitting, setSubmitting] = useState(false)

async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setSubmitting(true)
  setFormState((previous) => ({ ...previous, message: null }))
  ...
}
```

`src/routes/dashboard/signup.tsx:96-142`
```tsx
<form className="mt-8 space-y-4" onSubmit={onSubmit}>
...
<Input ... value={email} onChange={...} />
...
<Button type="submit" ... disabled={submitting}>
  {submitting ? <Loader2Icon ... /> : 'Sign up'}
</Button>
</form>
```

### Target signin already matches the desired pattern
`src/routes/dashboard/signin.tsx:35-63`
```ts
const [formState, formAction] = useActionState(async (_previous: AuthFormState, formData: FormData): Promise<AuthFormState> => {
  const email = String(formData.get('email') ?? '')
  const password = String(formData.get('password') ?? '')
  ...
  return { message: null, formData: { email, password } }
}, { message: null, formData: { email: '', password: '' } })
```

`src/routes/dashboard/signin.tsx:80-100`
```tsx
<form className="mt-8 space-y-4" action={formAction}>
  ...
  <Input ... defaultValue={formState.formData.email} />
  <Input ... defaultValue={formState.formData.password} />
  <SignInSubmitButton />
</form>
```

`src/routes/dashboard/signin.tsx:121-127`
```ts
function SignInSubmitButton() {
  const { pending } = useFormStatus()
  return <Button ... disabled={pending}>...</Button>
}
```

### Reference signup uses the same action-state contract
`../next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx:41-85`
```ts
const [state, formAction] = useActionState(signUp, initialState)
...
<form action={formAction} className="mt-8 space-y-4">
...
<Input ... defaultValue={state.formData.email} />
<Input ... defaultValue={state.formData.password} />
```

### Reference auth action shape
`../next-keystone-starter/features/dashboard/actions/auth.ts:92-129`
```ts
export async function signUp(prevState, formData: FormData) {
  ...
  return {
    message: error instanceof Error ? error.message : 'An error occurred',
    formData: {
      email: formData.get('email') as string,
      password: formData.get('password') as string
    }
  };
}
```

## Architecture
- The target dashboard auth pages live directly in `src/routes/dashboard/`.
- `signin.tsx` has already been migrated to an action-state model and serves as the in-repo template.
- `signup.tsx`, `reset.tsx`, and `init.tsx` still use older imperative client submit orchestration.
- The upstream Next implementation uses the same architecture across auth screens: form submits through `useActionState`, field values are restored from returned `formData`, and pending state comes from `useFormStatus` instead of route-local boolean submit flags.
- Since the user’s parity checklist says sidebar/provider/filter/sort/auth fixes already landed, the next remaining parity gap is not in sidebar/filter plumbing; it is the unfinished auth action-state conversion, with signup being the narrowest single-file fix.

## Start Here
Open `src/routes/dashboard/signup.tsx` first. It is the smallest remaining auth route that still diverges, and `src/routes/dashboard/signin.tsx` already contains the target-local implementation pattern to follow.

## Next single concrete fixable parity gap
**Gap:** `src/routes/dashboard/signup.tsx` still uses manual `useState` + imperative `onSubmit` instead of the upstream action-state form pattern already adopted by target `signin.tsx`.

### Exact files
- Change: `src/routes/dashboard/signup.tsx`
- Reference while implementing: `src/routes/dashboard/signin.tsx`
- Upstream comparison: `../next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx`

### Minimal implementation
1. In `src/routes/dashboard/signup.tsx`, replace the local `submitting` state and `onSubmit` handler with `useActionState`.
2. Move the current create-user-then-authenticate logic into the async action passed to `useActionState`.
3. Return `{ message, formData: { email, password } }` from that action on both success/failure paths, matching the existing signin contract.
4. Change the form from `onSubmit={onSubmit}` to `action={formAction}`.
5. Swap controlled `value/onChange` inputs to `defaultValue={formState.formData.email/password}`.
6. Extract the submit button into a small `SignUpSubmitButton` that uses `useFormStatus()` for pending UI, just like `signin.tsx`.
7. Keep current success behavior by navigating/redirecting to `/dashboard` after successful authenticate.

### Why this is the next best parity fix
- It is still an actual mismatch after the sidebar/provider/filter/sort fixes.
- It is a single-file, low-risk change.
- The target repo already contains the exact local pattern to copy (`signin.tsx`).
- It advances the unfinished “auth action-state” parity item without widening scope into reset/init yet.