# Code Context

## Files Retrieved
1. `src/routes/dashboard/reset.tsx` (lines 1-161) - target reset route still uses local `useState`, controlled inputs, and manual `onSubmit`/`submitting` handling instead of the Next `useActionState` + `useFormStatus` pattern.
2. `../next-keystone-starter/features/dashboard/screens/ResetPage/index.tsx` (lines 1-33) - reference page shell for reset screen; confirms the outer layout/copy contract and that the form logic is split into a dedicated action-state-driven form component.
3. `../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx` (lines 1-133) - reference implementation showing the parity contract: `useActionState`, `useFormStatus`, uncontrolled form defaults, and success/error badge rendering driven from action state.
4. `src/routes/dashboard/init.tsx` (lines 1-82) - another remaining parity gap, but broader because it also diverges in layout and post-submit auth flow.
5. `../next-keystone-starter/features/dashboard/screens/InitPage/index.tsx` (lines 1-179) - reference init page; confirms init remains divergent, but fixing reset is smaller and more isolated.
6. `src/routes/dashboard/no-access.tsx` (lines 1-39) - confirms the previously reported no-access gap is already fixed in target.
7. `src/routes/dashboard/signin.tsx` (lines 1-128) - confirms signin already matches the requested `useActionState` / `useFormStatus` parity direction.

## Key Code

### Target reset route is still manual state/submit driven
`src/routes/dashboard/reset.tsx:24-69`
```tsx
function ResetRoute() {
  const search = Route.useSearch()
  const [formState, setFormState] = useState<ResetFormState>({ message: null, success: null, formData: { email: search.email, password: '' } })
  const { email, password } = formState.formData
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const redeemMode = Boolean(search.token)

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setFormState((previous) => ({ ...previous, message: null, success: null }))
```

`src/routes/dashboard/reset.tsx:80-124`
```tsx
<form className="mt-8 space-y-4" onSubmit={onSubmit}>
...
  <Input
    ...
    value={email}
    onChange={(event) => setFormState((previous) => ({ ...previous, formData: { ...previous.formData, email: event.target.value } }))}
  />
...
  <Input
    ...
    value={password}
    onChange={(event) => setFormState((previous) => ({ ...previous, formData: { ...previous.formData, password: event.target.value } }))}
  />
...
  <Button className="w-full py-2 font-medium" type="submit" disabled={submitting}>
    {submitting ? <Loader2Icon className="size-4 shrink-0 animate-spin" /> : redeemMode ? 'Reset password' : 'Send reset link'}
  </Button>
</form>
```

### Next reference uses `useActionState` + `useFormStatus`
`../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx:31-46`
```tsx
function SubmitButton({ mode }: { mode: "reset" | "request" }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      className="w-full py-2 font-medium"
      disabled={pending}
    >
```

`../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx:64-72`
```tsx
const [state, dispatch] = useActionState(
  (prevState: ActionState | null, formData: FormData) => formAction(prevState, formData, mode, token),
  initialState
);
```

`../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx:76-111`
```tsx
<form action={dispatch} className="mt-8 space-y-4">
...
  <Input ... defaultValue={state.formData.email} />
...
  <Input ... defaultValue={state.formData.password} />
```

### Already-fixed areas should not be chosen again
`src/routes/dashboard/no-access.tsx:1-39` now already contains the Next-parity `Access Denied` copy and `Go Back` / `Home` actions.

`src/routes/dashboard/signin.tsx:3-4, 42-68, 121-127` already uses `useActionState` and `useFormStatus`.

## Architecture
- Dashboard auth/access routes live under `src/routes/dashboard`.
- The target app has already absorbed the prior parity fixes around no-access, signin/signup action-state forms, side-aware sidebar APIs, and filter popovers.
- Remaining auth-screen parity gaps are concentrated in `reset.tsx` and `init.tsx`.
- Of those, `reset.tsx` is the narrowest next change: it is a single route with existing GraphQL mutations already working, and the parity gap is mostly about form state management and submit-button wiring.

## Start Here
Open `src/routes/dashboard/reset.tsx` first. It is the next smallest clear Next-vs-target mismatch and can be fixed without touching unrelated dashboard layout/sidebar/filter code.

## Next single concrete fixable parity gap
**Gap:** `src/routes/dashboard/reset.tsx` still uses imperative `useState`/`onSubmit` form handling instead of the Next reset screen’s `useActionState` + `useFormStatus` pattern.

### Exact files
- Change: `src/routes/dashboard/reset.tsx`
- Reference: `../next-keystone-starter/features/dashboard/screens/ResetPage/index.tsx`
- Reference: `../next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx`

### Minimal implementation
1. In `src/routes/dashboard/reset.tsx`, import `useActionState` from `react` and `useFormStatus` from `react-dom`; remove the local `submitting` state and manual `onSubmit` handler.
2. Keep `showPassword` as local UI state, but replace the current controlled `formState`/`setFormState` model with an action-state object shaped like:
   - `message: string | null`
   - `success: string | null`
   - `formData: { email: string; password: string }`
3. Initialize action state from route search so request/redeem mode still pre-fills `email` from `search.email`.
4. Move the existing mutation logic into the `useActionState` callback:
   - if `search.token` exists, call `redeemUserPasswordResetToken`
   - otherwise call `sendUserPasswordResetLink`
   - return the next action state object instead of calling `setFormState`
5. Change the form from `onSubmit={onSubmit}` to `action={formAction}`.
6. Convert inputs from controlled `value`/`onChange` fields to uncontrolled `defaultValue={formState.formData.email}` and `defaultValue={formState.formData.password}` to mirror Next’s form pattern.
7. Extract the submit button into a small child component using `useFormStatus()` so button pending state comes from form submission context, matching the already-fixed signin/signup routes.
8. Leave the existing outer layout, copy, and badge rendering mostly intact; only wire them to the returned action state.

### Why this is the next best parity fix
- The previously reported no-access mismatch is already fixed, so it is no longer a valid next action.
- Reset is a direct, isolated parity miss against the exact pattern called out in the task family (`useActionState` / `useFormStatus`).
- It is a one-file change with no schema or routing contract changes.
- `init.tsx` is also divergent, but it is broader: it differs in layout, copy, form state pattern, and post-create sign-in behavior, making reset the smaller next concrete fix.