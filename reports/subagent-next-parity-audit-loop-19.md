# Code Context

## Files Retrieved
1. `../next-keystone-starter/features/dashboard/screens/SignInPage/SignInForm.tsx` (lines 1-113) - upstream sign-in uses `useActionState` + `useFormStatus` server-action form flow.
2. `../next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx` (lines 1-136) - upstream sign-up uses the same action-state pattern.
3. `../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx` (lines 1-145) - upstream reset/request flow uses `useActionState` with success/error state returned from action.
4. `../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx` (lines 1-197) - upstream initial-user setup also uses action-state form submission.
5. `../next-keystone-starter/features/dashboard/actions/auth.ts` (lines 1-320) - upstream action functions return structured state objects and redirect from action on success.
6. `src/routes/dashboard/signin.tsx` (lines 1-151) - target still uses client-side `useState` and manual submit mutation flow.
7. `src/routes/dashboard/signup.tsx` (lines 1-145) - target still uses client-side local state + manual submit.
8. `src/routes/dashboard/reset.tsx` (lines 1-154) - target still uses client-side local state + manual submit with success/error state.
9. `src/routes/dashboard/init.tsx` (lines 1-91) - target still uses client-side local state + manual submit.

## Key Code

Upstream pattern is consistent across auth pages:

```tsx
const [state, formAction] = useActionState(signIn, initialState)

<form action={formAction} className="mt-8 space-y-4">
  ...
  <SubmitButton />
</form>
```

with pending UI delegated to `useFormStatus()`:

```tsx
function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button disabled={pending}>{pending ? <Spinner /> : 'Sign in'}</Button>
}
```

Target still uses imperative client handlers instead:

```tsx
const [formState, setFormState] = useState<AuthFormState>(...)
const [isSubmitting, setIsSubmitting] = useState(false)

async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault()
  setIsSubmitting(true)
  ...
  const result = await executeDashboardGraphQL(...)
  window.location.assign(...)
}
```

This same non-parity pattern exists in:
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`

## Architecture

Upstream auth flow is split into:
1. UI forms that use `useActionState` / `useFormStatus`
2. action functions in `features/dashboard/actions/auth.ts`
3. action-returned state objects that repopulate form fields and show errors/success
4. redirects occurring inside the action on success

Target currently keeps everything inside route components:
1. local React state stores field values and messages
2. submit handlers call `executeDashboardGraphQL(...)` directly
3. pending state is manually managed with `useState`
4. redirects happen in the route component (`window.location.assign` / router navigation)

So the next parity gap is not sidebar/filter/sort anymore; it is that the target dashboard auth pages still do not match the upstream action-state form architecture.

## Start Here

Open `src/routes/dashboard/signin.tsx` first.

It is the smallest/auth-clearest example of the remaining gap, and the same refactor pattern can then be repeated in `signup.tsx`, `reset.tsx`, and `init.tsx`.

## Next single concrete fixable parity gap

**Gap:** dashboard auth pages still use imperative client-side submit handlers instead of upstream-style action-state forms.

### Exact files to change
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- likely add a new shared action module, e.g. `src/features/cms/dashboard-auth.actions.ts` (or similar alongside existing dashboard auth helpers)

### Minimal implementation
1. Create auth action helpers that return structured state objects:
   - `signIn(prevState, formData)`
   - `signUp(prevState, formData)`
   - `resetPassword(prevState, formData, mode)`
   - `createInitialUser(prevState, formData)`
2. In each auth route, replace `onSubmit` / `handleSubmit` + `isSubmitting` with:
   - `useActionState(...)`
   - a small `SubmitButton` using `useFormStatus()`
   - uncontrolled inputs using `defaultValue={state.formData...}`
3. Move success redirect behavior into the action result path so the route component only renders form state.

### Why this is the next best gap
- It is still clearly behind upstream parity.
- It affects four user-facing auth screens.
- The implementation is localized and mechanical.
- The recently mentioned sidebar/filter/sort/provider items already appear addressed in the target, while auth action-state parity is still missing.