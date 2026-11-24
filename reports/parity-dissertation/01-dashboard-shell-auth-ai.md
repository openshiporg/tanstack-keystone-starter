# Dashboard Shell / Auth / AI Parity Audit

Date: 2026-05-18

Scope compared:
- Target: `/Users/junaid/code/tanstack-keystone-starter`
- Source of truth: `/Users/junaid/code/next-keystone-starter`

Inputs reviewed:
- `progress.md` (present)
- `plan.md` (missing: `/Users/junaid/code/tanstack-keystone-starter/plan.md`)

## Executive summary

TanStack has reached **strong structural parity** for the small dashboard primitives (`dashboard-provider.tsx`, `right-sidebar.tsx`, floating AI button shell, auth route surface), but it is still **materially behind** Next in the two places that matter most for this slice:

1. **Provider/layout composition is thinner and less featureful** than Next.
2. **AI assistant behavior is mostly stubbed** in TanStack: there is no `/api/completion` route, no streaming chat, no markdown/tool rendering, no shared/local key mode, no persisted AI config, and no data invalidation after AI CRUD.

Auth is in better shape than AI:
- Route coverage exists for `signin`, `signup`, `reset`, `init`, and `no-access`.
- Redirect gating in `src/routes/dashboard.tsx` is broadly equivalent to Next middleware semantics.
- Sign-in / sign-up / reset / init UI is visually and structurally close.

But auth still differs in **execution model and UX semantics**:
- Next centralizes auth mutations in server actions and middleware.
- TanStack performs auth mutations directly from route components via `executeDashboardGraphQL(...)` and full-page navigation.
- TanStack has no theme/toaster parity at dashboard app scope.
- Some copy and behavior diverges, especially reset semantics and provider-level UX affordances.

## What already matches

### 1) `dashboard-provider.tsx` is effectively at parity
- TanStack `src/components/dashboard/dashboard-provider.tsx:1-13`
- Next `features/dashboard/context/DashboardProvider.tsx:1-46`

Both expose the same minimal dashboard context shape:
- `basePath` defaulting to `/dashboard`
- `version` defaulting to `2.0.0`
- `useDashboard()` guard behavior

**Risk:** Low

### 2) `right-sidebar.tsx` is effectively at parity
- TanStack `src/components/dashboard/right-sidebar.tsx:1-15`
- Next `features/dashboard/components/dual-sidebar/right-sidebar.tsx:1-20`

Both implementations:
- render `Sidebar`
- include `SidebarRail`
- place `AiChatSidebar` inside `SidebarContent`

This file is essentially a direct parity match.

**Risk:** Low

### 3) Floating AI toggle button behavior is close
- TanStack `src/components/dashboard/dashboard-shell.tsx:13-30`
- Next `features/dashboard/components/DashboardLayout.tsx:58-80`

Both:
- use right-sidebar state via `useSidebarWithSide('right')`
- swap icon between sparkles and chevron based on right sidebar visibility
- reposition the FAB when the right sidebar is open

TanStack even preserves the same desktop/mobile chevron logic (`open && !isMobile`).

**Risk:** Low

### 4) Route surface parity for auth screens is present
TanStack has concrete route files for all requested routes:
- `src/routes/dashboard/signin.tsx`
- `src/routes/dashboard/signup.tsx`
- `src/routes/dashboard/reset.tsx`
- `src/routes/dashboard/init.tsx`
- `src/routes/dashboard/no-access.tsx`

Next has the corresponding route pages:
- `app/dashboard/signin/page.tsx:1-3`
- `app/dashboard/signup/page.tsx:1-3`
- `app/dashboard/reset/page.tsx:1-3`
- `app/dashboard/init/page.tsx:1-3`
- `app/dashboard/no-access/page.tsx:1-3`

And the actual screen implementations exist in:
- `features/dashboard/screens/SignInPage/*`
- `features/dashboard/screens/SignUpPage/*`
- `features/dashboard/screens/ResetPage/*`
- `features/dashboard/screens/InitPage/*`
- `features/dashboard/screens/NoAccessPage/*`

**Risk:** Low

### 5) High-level dashboard auth redirect matrix is mostly aligned
- TanStack route guard: `src/routes/dashboard.tsx:17-69`
- Next middleware handler: `features/dashboard/middleware.ts:103-158`

Both enforce the same major cases:
- redirect to `/dashboard/init` when `redirectToInit` is true
- bounce away from `/dashboard/init` when init is already complete
- send unauthenticated users to `/dashboard/signin`
- send authenticated but unauthorized users to `/dashboard/no-access`
- redirect authenticated users away from public auth routes

**Risk:** Medium-Low

### 6) Sign-in, sign-up, reset, init, no-access UI structure is close
Examples:
- TanStack sign-in `src/routes/dashboard/signin.tsx:75-118` vs Next `features/dashboard/screens/SignInPage/index.tsx:17-48` and `SignInForm.tsx:41-105`
- TanStack sign-up `src/routes/dashboard/signup.tsx:75-116` vs Next `features/dashboard/screens/SignUpPage/SignUpForm.tsx:55-145`
- TanStack reset `src/routes/dashboard/reset.tsx:73-123` vs Next `features/dashboard/screens/ResetPage/index.tsx:17-36` and `ResetForm.tsx:83-158`
- TanStack init `src/routes/dashboard/init.tsx:63-113` vs Next `features/dashboard/screens/InitPage/index.tsx:93-197`
- TanStack no-access `src/routes/dashboard/no-access.tsx:13-42` vs Next `features/dashboard/screens/NoAccessPage/index.tsx:10-49`

Shared semantics include:
- logo header
- one-column centered auth layout
- email/password fields with show/hide password toggles
- inline destructive badge errors
- same no-access copy and same CTA pair

**Risk:** Low

### 7) TanStack auth cookie plumbing is present for GraphQL-based sign-in/init/signup
Evidence chain:
- client GraphQL uses `credentials: 'include'`: `src/features/cms/graphql-client.ts:115-120`
- `/api/graphql` forwards CMS response headers including `set-cookie`: `src/routes/api/graphql.ts:5-11`
- auth mutations call `context.sessionStrategy.start(...)`: `src/features/cms/auth/graphql.ts:141-143`, `224-230`
- session strategy writes `set-cookie`: `src/features/cms/auth/session.ts` grep hits at lines `119-136`

That means TanStack’s client-side auth mutations are not obviously broken just because they run from route components instead of server actions.

**Risk:** Medium-Low

## Current gaps and differences

## A. Dashboard shell and provider composition

### A1) TanStack provider stack is materially thinner than Next
**TanStack**
- `src/components/dashboard/dashboard-providers.tsx:42-79`
- wraps only:
  - `DashboardProvider`
  - local `AiConfigContext`
  - local `ChatModeContext`
  - `SidebarProvider`

**Next**
- `features/dashboard/components/DashboardLayout.tsx:117-137`
- wraps:
  - `ErrorBoundary`
  - `QueryProvider`
  - `DashboardProvider`
  - `AdminMetaProvider`
  - `AiConfigProvider`
  - `ChatModeProvider`
  - `SidebarProvider`

Important nuance: TanStack does have app-level query wiring and root error handling elsewhere:
- query client is installed in router context: `src/router.tsx:5-16`
- root dashboard error boundary is configured at app shell: `src/routes/__root.tsx:17-41`

So this is **not** a complete absence of error/query infra. The gap is that TanStack lacks the **dashboard-scoped composition parity** and related dashboard feature providers.

**Why it matters**
- Admin metadata is fetched ad hoc instead of via a shared provider layer.
- AI config is a placeholder context, not a reusable persisted subsystem.
- The Next dashboard layout is a more explicit integration seam for auth/adminMeta/AI features.

**Risk:** Medium

### A2) No dashboard-level theme/toast parity
**Next**
- `app/dashboard/layout.tsx:1-27` provides `ThemeProvider` and `Toaster`

**TanStack**
- `src/routes/__root.tsx:44-66` has no corresponding theme provider or toaster in the root shell
- a repo-wide grep for `ThemeProvider|Toaster` inside `src` returned no matches in the inspected target code

**Why it matters**
- auth and AI flows in Next have a clear place for future toast-driven UX and theme controls
- TanStack currently lacks the same shell-level UX semantics

**Risk:** Medium

### A3) TanStack fetches dashboard overview in the shell instead of receiving pre-fetched server layout data
**TanStack**
- `src/components/dashboard/dashboard-shell.tsx:32-46` calls `useSuspenseQuery(fetchDashboardOverview)` in the shell itself

**Next**
- `app/dashboard/(admin)/layout.tsx:6-20` fetches adminMeta + user on the server and passes them into `DashboardLayout`

**Why it matters**
- Next’s composition avoids shell-level loading dependency drift and keeps layout data assembly centralized
- TanStack’s shell is functional, but composition is less explicit and diverges from the source architecture

**Risk:** Medium-Low

## B. AI sidebar behavior and `/api/completion` parity

### B1) TanStack AI is currently a local stub, not a real chat transport
**TanStack**
- `src/components/dashboard/dashboard-providers.tsx:47-67`
- `sendMessage(text)` just appends two local messages, including the placeholder response:
  - “AI assistant wiring is ready for the dashboard shell. Connect /api/completion to enable live responses.”

**Next**
- `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:86-146`
- uses `useChat(...)` with `DefaultChatTransport`
- posts to `/api/completion`
- supports loading/error states and async submission

This is the largest parity gap in the requested scope.

**Risk:** High

### B2) TanStack has no `/api/completion` route at all
**Next**
- `app/api/completion/route.ts:1-293`

**TanStack**
- `src/routes/api/graphql.ts:1-21`
- `src/routes/api/cms/upload.ts` exists
- no `/api/completion` route found
- no `mcp-transport` route found
- no `createMCPClient`, `openrouter`, `useChat`, or shared-keys equivalents found in target search results

**Why it matters**
Without this route, TanStack cannot match any of the requested AI behavior parity:
- streaming assistant responses
- tool calls
- CRUD invalidation after AI mutations
- shared/local key execution

**Risk:** High

### B3) TanStack AI config is only a static placeholder
**TanStack**
- `src/components/dashboard/dashboard-providers.tsx:14-17`, `45`
- config shape is only:
  - `enabled: boolean`
  - `completionEndpoint: string`
- always hardcoded to `{ enabled: true, completionEndpoint: '/api/completion' }`

**Next**
- `features/dashboard/hooks/use-ai-config.tsx:5-242`
- supports:
  - `keyMode: 'env' | 'local'`
  - persisted local keys in `localStorage`
  - hydration handling
  - cross-tab sync
  - convenience hooks

**Why it matters**
TanStack currently cannot support the source’s auth/AI UX for:
- shared env key mode
- local key mode
- model selection
- stored per-browser AI settings

**Risk:** High

### B4) TanStack AI sidebar UI is missing several source behaviors
**TanStack**
- `src/components/dashboard/ai-chat-sidebar.tsx:22-80`
- supports only:
  - simple empty state
  - textarea
  - submit button
  - close button
  - flat text bubbles

**Next**
- `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:156-250`
- adds:
  - markdown rendering via `ReactMarkdown`, `remarkGfm`, `remarkBreaks`
  - thinking state
  - scroll anchor/button infrastructure
  - error rendering
  - settings/mode controls via `ModeSplitButton`
  - disabled UI during submission

Supporting components present in Next but absent in TanStack include:
- `features/dashboard/components/dual-sidebar/mode-split-button.tsx:1-25`
- `features/dashboard/components/dual-sidebar/chat-container.tsx`
- `features/dashboard/components/dual-sidebar/scroll-button.tsx`
- `features/dashboard/components/dual-sidebar/chat-empty-state.tsx:1-220+`
- settings/config/model selector helpers in the same directory

Target searches found **no TanStack equivalents** for `mode-split-button`, `chat-container`, or `scroll-button`.

**Risk:** High

### B5) TanStack AI cannot invalidate dashboard queries after AI CRUD operations
**Next**
- `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:50-76` detects CRUD tool calls
- `features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:91-95` invalidates React Query cache on completion

**TanStack**
- `src/components/dashboard/ai-chat-sidebar.tsx:22-80` has no query-client integration
- target search found no AI-side `invalidateQueries()` usage

**Why it matters**
Even if `/api/completion` existed, the current TanStack AI sidebar would not keep list/item screens coherent after AI-side create/update/delete.

**Risk:** High

### B6) Next completion route depends on subsystems that do not yet exist in TanStack
The Next route is not just a transport endpoint; it depends on:
- OpenRouter provider logic: `app/api/completion/route.ts:1-5`, `229`
- shared/local key body semantics: `70-94`
- `getBaseUrl()`: `4`, `142-143`
- MCP transport and server tool availability: `2`, `5`, `146-149`
- shared keys server action: consumed client-side from `features/dashboard/actions/ai-chat.ts:28-51`

TanStack currently has none of those pieces in the inspected scope.

**Risk:** High

## C. Auth routing and UX semantics

### C1) Execution model differs: Next server actions vs TanStack client route actions
**Next**
- central auth logic in `features/dashboard/actions/auth.ts:21-319`
- UI forms call `signIn`, `signUp`, `resetPassword`, `createInitialUser`
- redirects happen server-side via `redirect(...)`

**TanStack**
- each route owns its own `useActionState(async ...)` implementation:
  - sign-in: `src/routes/dashboard/signin.tsx:39-73`
  - sign-up: `src/routes/dashboard/signup.tsx:39-73`
  - reset: `src/routes/dashboard/reset.tsx:30-71`
  - init: `src/routes/dashboard/init.tsx:32-61`
- redirects happen client-side via:
  - `window.location.assign(...)`: sign-in `65`, init `54`
  - router navigation: sign-up `65`

**Why it matters**
This is not necessarily incorrect, but it is a parity difference:
- less centralized auth policy
- less reusable action semantics
- more chance of route-to-route drift over time

**Risk:** Medium

### C2) Sign-in parity is good, but not exact
**Matches**
- `from` param handling exists in both TanStack and Next
- password reveal toggle exists
- same field layout/copy is close
- safe redirect logic exists in TanStack: `src/routes/dashboard/signin.tsx:33-37`

**Differs**
- Next sign-in sets cookie in a server action and redirects server-side: `features/dashboard/actions/auth.ts:21-90`
- TanStack relies on the GraphQL response setting the cookie and then does `window.location.assign(...)`: `src/routes/dashboard/signin.tsx:47-66`
- TanStack error badge formatting is slightly simpler than Next’s nested heading style: `106-110` vs Next `SignInForm.tsx:86-104`

**Risk:** Low-Medium

### C3) Public signup gating is functionally present, but implemented inconsistently
**TanStack parent guard**
- `src/routes/dashboard.tsx:6-8` uses `process.env.PUBLIC_SIGNUPS_ALLOWED === 'true'`

**TanStack signup route**
- `src/routes/dashboard/signup.tsx:13-15` uses `process.env.PUBLIC_SIGNUPS_ALLOWED === 'true' || import.meta.env.PUBLIC_SIGNUPS_ALLOWED === 'true'`

**Next signup page**
- `features/dashboard/screens/SignUpPage/index.tsx:4-11` uses `process.env.PUBLIC_SIGNUPS_ALLOWED === 'true'`

**Implication**
TanStack currently has two slightly different implementations of the same policy. That is survivable, but it is avoidable drift.

**Risk:** Low-Medium

### C4) Signup flow is close, but still more route-local than source
**TanStack**
- create user directly: `src/routes/dashboard/signup.tsx:47-52`
- authenticate immediately after: `54-65`

**Next**
- server action `signUp(...)` creates the user and then delegates to `signIn(...)`: `features/dashboard/actions/auth.ts:92-129`

**Net**
Behavior is broadly similar and likely works because of GraphQL cookie forwarding, but it does not share the source’s centralized policy surface.

**Risk:** Medium-Low

### C5) Reset request semantics differ from source
**TanStack request-mode success copy**
- `src/routes/dashboard/reset.tsx:63`
- “If an account exists for this email, a reset link has been sent.”

**Next request-mode success copy**
- `features/dashboard/actions/auth.ts:271-275`
- “Password reset link has been sent to your email.”

TanStack’s message is actually more privacy-preserving, but it is **not exact parity**.

Also:
- Next packs reset behavior into one centralized server action: `206-289`
- TanStack reimplements request/redeem directly in the route: `34-71`

**Risk:** Low

### C6) Init flow is closer than it first appears, but still architecturally different
**TanStack**
- calls `createInitialUser` mutation directly: `src/routes/dashboard/init.tsx:39-53`
- relies on GraphQL/cookie forwarding, then redirects via `window.location.assign('/dashboard')`: `54`

**Next**
- `createInitialUser(...)` action only creates the item: `features/dashboard/actions/auth.ts:164-204`
- then `InitPage` explicitly calls `signIn(...)`: `features/dashboard/screens/InitPage/index.tsx:69-79`

Because TanStack’s GraphQL auth schema sets a session cookie during `createInitialUser`:
- `src/features/cms/auth/graphql.ts:224-230`
- and `/api/graphql` forwards `set-cookie`: `src/routes/api/graphql.ts:5-11`

…the TanStack path may be functionally correct. But it still differs from the source’s explicit action choreography.

**Risk:** Medium-Low

### C7) No-access page is essentially parity-complete
- TanStack `src/routes/dashboard/no-access.tsx:13-42`
- Next `features/dashboard/screens/NoAccessPage/index.tsx:10-49`

Differences are implementation-only (`useNavigate`/`window.history.back()` vs `useRouter`).

**Risk:** Low

## D. Shell-adjacent user/auth UX

### D1) User profile menu is close, but Next has additional UX affordances
**TanStack**
- `src/components/dashboard/user-profile.tsx:24-82`
- includes:
  - avatar/name/email
  - link to user item
  - GraphQL API shortcut
  - log out button

**Next**
- `features/dashboard/components/UserProfileClient.tsx:30-123`
- includes all of the above plus:
  - theme switcher row
  - form-based server-action logout

**Logout behavior difference**
- TanStack logs out via client mutation and then `window.location.assign('/dashboard/signin')`: `src/features/cms/dashboard-session.ts:3-5`
- Next logs out via server action with cache revalidation and redirect: `features/dashboard/actions/auth.ts:131-162`

**Risk:** Medium-Low

## Dependency-aware fix plan

## Phase 0 — Keep the currently good pieces unchanged
Do **not** rewrite these first; they already match closely enough:
1. `src/components/dashboard/dashboard-provider.tsx`
2. `src/components/dashboard/right-sidebar.tsx`
3. `src/routes/dashboard/no-access.tsx`
4. floating button structure in `src/components/dashboard/dashboard-shell.tsx`

These are not the bottlenecks.

## Phase 1 — Normalize dashboard composition before touching AI behavior
**Goal:** make TanStack’s shell/provider topology look like a deliberate counterpart to Next.

Recommended order:
1. Introduce a single dashboard layout/composition component analogous to Next’s `DashboardLayout`.
2. Move TanStack’s local chat/AI contexts out of `dashboard-shell.tsx` adjacency and into that composition layer.
3. Decide explicitly whether admin meta should remain query-driven or whether an `AdminMetaProvider` equivalent is worth porting.
4. Add missing shell-level UX providers if desired for parity:
   - theme provider
   - toaster

**Dependencies:** none

**Why first:** AI and auth UX improvements will be easier if the shell/provider boundary is stable.

**Risk:** Medium

## Phase 2 — Port AI config infrastructure before the chat UI
**Goal:** replace placeholder AI config with the source’s real capability model.

Port/adapt from Next:
1. `features/dashboard/hooks/use-ai-config.tsx`
2. any minimal config helpers required by:
   - `mode-split-button.tsx`
   - settings popover/config toggle/model selector

TanStack target currently only exposes `enabled` + `completionEndpoint` in `dashboard-providers.tsx:14-17`, `45`; that is not enough for source parity.

**Dependencies:** Phase 1 preferred, but can proceed in parallel if wired cleanly.

**Risk:** Medium-High

## Phase 3 — Add backend `/api/completion` prerequisites
**Goal:** make real AI transport possible.

Minimum dependency set inferred from Next:
1. Add TanStack route equivalent of `app/api/completion/route.ts`
2. Add or adapt a `getBaseUrl()` helper equivalent
3. Add shared-keys server function/action equivalent to `features/dashboard/actions/ai-chat.ts:28-51`
4. Add MCP transport/tool endpoint support or intentionally replace it with a TanStack-native alternative

This is the highest-risk phase because the TanStack repo currently shows **no** completion route and **no** MCP transport path in the inspected code.

**Dependencies:** Phase 2 strongly preferred for config contract alignment.

**Risk:** High

## Phase 4 — Replace stub AI sidebar with real source-equivalent chat behavior
**Goal:** bring the UI to parity once transport exists.

Port/adapt in this order:
1. `AiChatSidebar` core behavior (`useChat`, async submission, loading/error states)
2. `ChatEmptyState`
3. `chat-container` + `scroll-button`
4. markdown rendering
5. `ModeSplitButton` and settings controls
6. query invalidation after AI CRUD tool usage

Target file to replace substantially:
- `src/components/dashboard/ai-chat-sidebar.tsx:22-80`

**Dependencies:** Phases 2 and 3

**Risk:** High

## Phase 5 — Tighten auth parity after AI foundation lands
**Goal:** reduce drift in auth semantics without broad rewrites.

Recommended cleanup order:
1. Centralize auth mutations into shared helpers/server functions so route-local logic stops diverging.
2. Unify `PUBLIC_SIGNUPS_ALLOWED` handling so parent/child route policy is defined once.
3. Decide whether to keep TanStack’s privacy-preserving reset success copy or align exactly with Next.
4. Consider theme/toast parity for auth UX if dashboard product parity, not just code parity, is required.
5. Consider aligning logout semantics more closely with Next’s explicit cache invalidation model.

**Dependencies:** none blocked by AI, but easier after Phase 1 composition cleanup.

**Risk:** Medium

## Recommended priority matrix

### High priority
1. Missing `/api/completion` stack
2. Stubbed `AiChatSidebar`
3. Missing persisted AI config / mode selection

### Medium priority
1. Provider/layout composition parity
2. Auth centralization and logout semantics
3. Theme/toaster shell parity

### Low priority
1. No-access page polish
2. Exact auth copy parity
3. Minor badge/layout differences

## Bottom-line verdict

### Already solid
- `dashboard-provider.tsx`
- `right-sidebar.tsx`
- no-access route
- auth route coverage
- baseline redirect gating
- visual structure of sign-in/sign-up/reset/init screens

### Still materially behind
- dashboard layout/provider composition richness
- AI config system
- AI sidebar behavior
- `/api/completion` integration
- AI-driven query invalidation
- centralized auth UX semantics

## Concise current-state verdict

If the question is **"Is dashboard shell/provider/auth/AI at parity with Next?"** the answer is:

- **Shell primitives:** mostly yes
- **Auth routes and gating:** mostly yes, with architectural drift
- **Auth UX semantics:** partial parity
- **AI sidebar and `/api/completion`:** no, still substantially incomplete

Overall for this requested slice, TanStack is at roughly:
- **Dashboard shell/provider parity:** ~65-75%
- **Auth parity:** ~75-85%
- **AI parity:** ~10-20%

The next meaningful milestone is not incremental polish; it is replacing the TanStack AI stub with the real transport/config/tooling stack and then tightening provider composition around it.
