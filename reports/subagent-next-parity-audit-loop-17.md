# Code Context

## Files Retrieved
1. `src/routes/dashboard/no-access.tsx` (lines 1-37) - target no-access route still renders a single sign-out CTA and different copy than Next.
2. `../next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx` (lines 1-49) - reference no-access screen uses "Access Denied" copy plus Go Back and Home actions.
3. `src/components/dashboard/pagination.tsx` (lines 155-186) - checked prior page-size area named in the prompt; it already matches the expected Page Size label/custom controls closely, so it is not the next gap.

## Key Code

### Target still diverges on no-access behavior
`src/routes/dashboard/no-access.tsx:21-32`
```tsx
<div className="mt-4 gap-0 text-center">
  <h1 className="text-center text-lg font-semibold">You don&apos;t have access to this page.</h1>
  <p className="mx-auto mt-2 text-center text-sm text-muted-foreground sm:max-w-[90%]">
    Sign out and use an account with dashboard access.
  </p>
</div>

<div className="mt-8 flex w-full">
  <Button className="w-full" onClick={() => void signOutDashboard()}>
    <LogOut className="size-3" />
    Sign out
  </Button>
</div>
```

### Next reference behavior
`../next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx:19-43`
```tsx
<div className="text-center gap-0 mt-4">
  <h1 className="text-center text-lg font-semibold">Access Denied</h1>
  <p className="mt-2 text-center mx-auto sm:max-w-[90%] text-sm text-muted-foreground">
    You don't have permission to access this page. If you believe this is an error, please contact your administrator for assistance.
  </p>
</div>

<div className="flex flex-col sm:flex-row gap-2 w-full mt-8">
  <Button variant="outline" className="flex-1" onClick={() => router.back()}>
    <ArrowLeft className="size-3" />
    Go Back
  </Button>
  <Button variant="default" className="flex-1" onClick={() => router.push('/')}>
    <Store className="size-3" />
    Home
  </Button>
</div>
```

### Why this is the next concrete gap
The prompt’s previously fixed areas were spot-checked, and `src/components/dashboard/pagination.tsx:160-180` already shows the corrected Page Size label and custom page-size controls. By contrast, the no-access screen still reflects the old sign-out-only flow instead of the current Next reference.

## Architecture
- `src/routes/dashboard.tsx:49-50` redirects authenticated users without dashboard permission to `/dashboard/no-access`.
- `src/routes/dashboard/no-access.tsx` is therefore the sole user-facing denial screen for this policy branch.
- The parity mismatch is isolated to this route component; no backend/auth runtime changes are needed.

## Start Here
Open `src/routes/dashboard/no-access.tsx` first. It is the only target file that needs behavior/copy/action parity work for this gap.

## Next single concrete fixable parity gap
**Gap:** The target no-access screen still uses a sign-out CTA and different denial copy, while Next now shows an "Access Denied" card with **Go Back** and **Home** actions.

### Exact files
- Target: `src/routes/dashboard/no-access.tsx`
- Reference: `../next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx`

### Minimal implementation
In `src/routes/dashboard/no-access.tsx`:
1. Remove the `signOutDashboard` import and replace `LogOut` with `ArrowLeft` and `Store` icons.
2. Use TanStack navigation (`useRouter` and/or `useNavigate`) to implement:
   - `router.history.back()` or equivalent for **Go Back**
   - navigation to `/` for **Home**
3. Update the heading/copy to match the Next reference:
   - heading: `Access Denied`
   - body: `You don't have permission to access this page. If you believe this is an error, please contact your administrator for assistance.`
4. Replace the single full-width sign-out button with a two-button container matching Next layout:
   - `flex flex-col sm:flex-row gap-2 w-full mt-8`
   - outline `Go Back`
   - default `Home`

### Risk / constraint
- Keep the route public within the existing dashboard auth shell rules; only the UI/actions should change.
- If TanStack back-navigation has no prior history entry, a safe fallback is redirecting **Go Back** to `/dashboard` or `/`.