# Code Context

## Files Retrieved
1. `src/routes/dashboard/signup.tsx` (lines 1-155) - target signup flow still uses local `useState`/manual submit instead of parity-style action-state form handling.
2. `src/routes/dashboard/reset.tsx` (lines 1-161) - target reset flow also uses local `useState`/manual submit rather than action-state semantics.
3. `src/routes/dashboard/init.tsx` (lines 1-96) - target initial-user flow uses imperative local submit/loading state.
4. `src/routes/dashboard/signin.tsx` (lines 1-128) - target signin route already implements the newer auth action-state pattern with `useActionState` + `useFormStatus`; this is the local reference implementation to match.
5. `../next-keystone-starter/features/dashboard/actions/auth.ts` (lines 21-129, 164-289) - source project’s auth mutations expose state-returning action functions for sign-in, sign-up, create-initial-user, and reset flows.

## Key Code
- Target signin already uses action-state pattern:
  - `src/routes/dashboard/signin.tsx:42-73` wraps auth submission in `useActionState(...)`.
  - `src/routes/dashboard/signin.tsx:121-127` uses `useFormStatus()` for pending UI.
- But the sibling auth screens do not:
  - `src/routes/dashboard/signup.tsx:38-79` manages `formState` and `submitting` manually via `useState` and `onSubmit`.
  - `src/routes/dashboard/reset.tsx:29-77` does the same for reset/request-reset.
  - `src/routes/dashboard/init.tsx:25-61` does the same for first-user creation.
- In next-keystone-starter, auth logic is centralized into action-like functions that return `{ message, success, formData }` state objects instead of only imperative UI state:
  - `../next-keystone-starter/features/dashboard/actions/auth.ts:92-129` `signUp(...)`
  - `../next-keystone-starter/features/dashboard/actions/auth.ts:164-204` `createInitialUser(...)`
  - `../next-keystone-starter/features/dashboard/actions/auth.ts:206-289` `resetPassword(...)`

## Architecture
- The dashboard auth surface in the target is split across route files under `src/routes/dashboard/`.
- `signin.tsx` has already been migrated to an action-state form model:
  - form action encapsulates request/error handling
  - `useFormStatus()` drives pending button state
  - returned form state rehydrates field values and error rendering
- `signup.tsx`, `reset.tsx`, and `init.tsx` are now outliers in the same area: they still keep transient loading/error state locally and submit imperatively with `onSubmit`.
- Because the parity checklist explicitly included “auth action-state,” the remaining inconsistency is not in signin anymore; it is that the other auth screens have not adopted the same pattern.

## Start Here
Open `src/routes/dashboard/signup.tsx` first. It is the clearest remaining parity gap because `signin.tsx` in the same folder already demonstrates the target-local implementation pattern to copy.

## Next single concrete fixable parity gap
**Gap:** The target only migrated **signin** to action-state auth handling; **signup** still uses manual `useState` + imperative `onSubmit`, so auth action-state parity is incomplete.

### Exact files
- Primary file to change: `src/routes/dashboard/signup.tsx`
- Optional follow-up files after this single fix: `src/routes/dashboard/reset.tsx`, `src/routes/dashboard/init.tsx`

### Minimal implementation
Refactor `src/routes/dashboard/signup.tsx` to match the same structure used in `src/routes/dashboard/signin.tsx`:
1. Replace manual `formState`/`submitting` `useState` submit orchestration with `useActionState`.
2. Move the async create-user + authenticate flow into the action function passed to `useActionState`.
3. Convert the form from `onSubmit={onSubmit}` to `action={formAction}`.
4. Add a submit button component using `useFormStatus()` for pending state, mirroring `signin.tsx`.
5. Preserve current behavior by returning `{ message, formData }` on failure and redirect/navigate on success.

### Why this is the next best fix
- It is a direct leftover from the “auth action-state” work item.
- It is narrowly scoped to one route file.
- `src/routes/dashboard/signin.tsx` already provides an in-repo template, so implementation risk is low.
- It removes the remaining pattern inconsistency inside the auth routes before tackling broader optional parity cleanup in reset/init.
