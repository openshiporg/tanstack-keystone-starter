# Code Context

## Files Retrieved
1. `src/routes/dashboard/init.tsx` (lines 1-96) - target init route still uses local controlled state, imperative `onSubmit`, and a different layout/copy contract than Next.
2. `../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx` (lines 1-197) - reference implementation for the init screen; shows the expected `useActionState` + `useFormStatus` form pattern, logo-shell layout, password visibility toggle, and error badge contract.
3. `src/routes/dashboard/reset.tsx` (lines 1-133) - confirms reset has already been migrated to `useActionState` / `useFormStatus` in target.
4. `src/routes/dashboard/signin.tsx` (lines 1-128) - confirms signin already follows the action-state form pattern and provides a local target implementation style to copy.
5. `src/routes/dashboard/signup.tsx` (lines 1-116) - confirms signup already follows the action-state form pattern.
6. `src/routes/dashboard/no-access.tsx` (lines 1-39) - confirms the no-access page already matches the requested Access Denied + Go Back/Home parity direction.

## Key Code

### Remaining gap: init route is still pre-parity
`src/routes/dashboard/init.tsx:25-60`
```tsx
function InitRoute() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    ...
    await executeDashboardGraphQL<CreateInitialUserResult>(..., { data: { name, email, password } })
    window.location.assign('/dashboard')
```

`src/routes/dashboard/init.tsx:63-94`
```tsx
return (
  <div className="flex min-h-svh items-center justify-center bg-muted/30 p-6">
    <Card className="w-full max-w-md">
      ...
      <form className="space-y-4" onSubmit={handleSubmit}>
        <Input id="name" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        {error ? <p ...>{error}</p> : null}
        <Button className="w-full" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
          Create admin
        </Button>
      </form>
```

### Next reference: init uses the same auth-form architecture as signin/signup/reset
`../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx:25-40`
```tsx
function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full py-2 font-medium" disabled={pending}>
      {pending ? <RiLoader2Fill className="size-4 shrink-0 animate-spin" /> : "Create account"}
    </Button>
  );
}
```

`../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx:52-91`
```tsx
const [state, formAction] = useActionState(
  async (prevState: ActionState, formData: FormData) => {
    const result = await createInitialUser(prevState, formData);

    if ("message" in result && result.message) {
      return {
        message: result.message,
        formData: {
          name: formData.get("name") as string,
          email: formData.get("email") as string,
          password: formData.get("password") as string,
        },
      };
    }

    await signIn(...);

    return {
      message: null,
      formData: {
        name: formData.get("name") as string,
        email: formData.get("email") as string,
        password: formData.get("password") as string,
      },
    };
  },
  initialState
);
```

`../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx:93-191`
```tsx
<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
  <div className="w-full max-w-sm">
    <div className="flex items-center space-x-1.5">
      <Logo aria-hidden="true" />
    </div>
    ...
    <form action={formAction} className="mt-8 space-y-4">
      <Input name="name" defaultValue={state.formData.name} ... />
      <Input name="email" defaultValue={state.formData.email} ... />
      <Input name="password" defaultValue={state.formData.password} ... />
      <SubmitButton />
    </form>
    {state.message && <Badge variant="destructive" ...>...</Badge>}
```

### Confirmed already-fixed areas
- `src/routes/dashboard/reset.tsx:30-133` already uses `useActionState`, `useFormStatus`, and uncontrolled `defaultValue` inputs.
- `src/routes/dashboard/signin.tsx:39-128` already uses the same pattern.
- `src/routes/dashboard/signup.tsx:39-116` already uses the same pattern.
- `src/routes/dashboard/no-access.tsx:18-35` already has `Access Denied` plus `Go Back` and `Home` actions.

## Architecture
- All auth/access entry points live in `src/routes/dashboard`.
- The target app has already converged on a shared auth-screen pattern for `signin`, `signup`, and `reset`: `useActionState` for submit/result state, `useFormStatus` for pending button UI, uncontrolled `defaultValue` inputs, logo-top shell, and badge-based error rendering.
- `init.tsx` is now the outlier. It still uses an older Card-based screen, controlled `useState` inputs, imperative submit handling, and direct redirect after `createInitialUser`.
- In Next, the init screen also follows the same auth-screen shell and attempts sign-in after successful initial user creation. In the target repo, the GraphQL mutation already returns a `sessionToken`, so the minimal parity-oriented fix can keep existing transport behavior while aligning the UI/form architecture first.

## Start Here
Open `src/routes/dashboard/init.tsx` first. It is the only remaining auth screen in the scoped set that still diverges from the now-established `useActionState` / `useFormStatus` pattern used elsewhere in the target app.

## Next single concrete fixable parity gap
**Gap:** `src/routes/dashboard/init.tsx` still uses the old controlled-form/Card implementation instead of the Next init screen’s action-state auth-form shell.

### Exact files
- Change: `src/routes/dashboard/init.tsx`
- Reference: `../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx`
- Local pattern reference: `src/routes/dashboard/signin.tsx`
- Local pattern reference: `src/routes/dashboard/reset.tsx`

### Minimal implementation
1. In `src/routes/dashboard/init.tsx`, replace the current `Card` layout with the same auth-page shell already used by `signin.tsx`/`reset.tsx`:
   - outer `min-h-svh` centered container
   - `Logo` header
   - title/subtitle copy closer to Next (`Create admin account`, `Set up your admin account to get started.`)
2. Remove local controlled input state (`name`, `email`, `password`, `isSubmitting`, `error`) and introduce an action-state type:
```ts
{ message: string | null; formData: { name: string; email: string; password: string } }
```
3. Use `useActionState` in `InitRoute` and move the existing `createInitialUser` mutation into the action callback, returning the next state object instead of mutating local component state.
4. Convert the form from `onSubmit={handleSubmit}` to `action={formAction}`.
5. Convert inputs to uncontrolled fields with `name=` attributes and `defaultValue={formState.formData.*}`.
6. Add local `showPassword` UI state and a password visibility toggle so the init screen matches the other auth pages and the Next reference.
7. Extract the submit button into a small child component that uses `useFormStatus()` and renders the pending spinner from form context.
8. Replace the inline `<p>` error box with the same destructive `Badge` error presentation used by `signup.tsx`/`reset.tsx`.
9. Keep success navigation minimal: after successful mutation, continue redirecting to `/dashboard` as today unless the implementing agent also wants to wire an explicit post-create sign-in flow. For the single-file parity fix, the form architecture/layout conversion is the concrete minimum.

## Risks / open questions
- Next signs the user in after creating the initial account. The target currently redirects immediately after `createInitialUser`. Because the mutation already returns `sessionToken`, a deeper parity pass could verify whether redirect alone is sufficient in this app’s session transport. That is a secondary follow-up, not required for the minimal concrete fix above.
- If the implementing agent wants exact text/icon parity, they should also swap `UserPlusIcon` usage out in favor of the existing auth-form button text-only pattern used elsewhere.
