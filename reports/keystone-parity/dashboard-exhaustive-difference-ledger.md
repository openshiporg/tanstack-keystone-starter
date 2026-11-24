# Exhaustive Dashboard Difference Ledger

Date: 2026-05-28

Scope: dashboard parity only. Source of truth is `/Users/junaid/code/next-keystone-starter/features/dashboard/**` plus live local behavior at `http://localhost:3001`. Keystone core internals are intentionally not used as UI truth.

## Live browser/runtime evidence in this pass

- After the ThemeProvider fix, live browser navigation with seeded login rendered `/dashboard`, `/dashboard/users`, `/dashboard/users/create`, and `/dashboard/users/user_admin` instead of the previous `useTheme must be used within ThemeProvider` crash.
- A second provider crash class was identified and appears fixed in current code: `ToasterProvider` is now mounted around dashboard pages. Earlier list/create/item components call `useToast`; this would crash without the provider.
- Live HTTP still proves signin SSR shell/CSS and seeded Ada auth cookie behavior.

## 50+ item ledger

### 1. Root document now loads global CSS and TanStack document shell

- **status:** matched
- **local file path(s):** `src/routes/__root.tsx`
- **upstream file path(s):** `N/A: TanStack shell adaptation; upstream is Next app shell`
- **exact cited evidence:**
  - src/routes/__root.tsx:11 — `import appCss from '../../app/globals.css?url'`
  - src/routes/__root.tsx:29 — `<HeadContent />`
  - src/routes/__root.tsx:34 — `<Scripts />`
  - Live HTTP: GET http://localhost:3001/dashboard/signin returned 200, body contained `/app/globals.css`, `<script`, and `Sign in to your account`, and did not contain `Hello "__root"`.
- **why it matters to parity:** Without this the entire dashboard can render unstyled or non-hydrated.
- **recommended fix direction:** Keep this invariant in `scripts/validate-dashboard-http.ts`; do not regress root shell.

### 2. ThemeProvider crash path is fixed

- **status:** matched
- **local file path(s):** `src/components/dashboard/dashboard-providers.tsx`, `src/components/dashboard/user-profile.tsx`, `src/components/ui/theme-provider.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/UserProfileClient.tsx`
- **exact cited evidence:**
  - src/components/dashboard/dashboard-providers.tsx:35 — `<ThemeProvider>`
  - src/components/dashboard/user-profile.tsx:33 — `const { theme, setTheme } = useTheme()`
  - src/components/ui/theme-provider.tsx:61 — `if (!context) throw new Error('useTheme must be used within ThemeProvider')`
  - Live browser: after reload, `/dashboard/users/user_admin` rendered item controls and fields instead of `useTheme must be used within ThemeProvider`.
- **why it matters to parity:** The dashboard sidebar profile used to crash protected pages after signin.
- **recommended fix direction:** Keep ThemeProvider wrapped around the full dashboard shell.

### 3. ToasterProvider is now mounted around dashboard pages

- **status:** matched
- **local file path(s):** `src/components/dashboard/dashboard-providers.tsx`, `src/components/ui/toaster.tsx`, `src/components/dashboard/keystone-list-table.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx`
- **exact cited evidence:**
  - src/components/dashboard/dashboard-providers.tsx:36 — `<ToasterProvider>`
  - src/components/ui/toaster.tsx:71 — `if (!context) throw new Error('useToast must be used within ToasterProvider')`
  - src/components/dashboard/keystone-list-table.tsx:51 — `const { toast } = useToast()`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:11 — `import { toast } from "sonner";`
- **why it matters to parity:** Local dashboard components call `useToast`; without the provider list/create/item pages crash.
- **recommended fix direction:** Keep provider; consider switching to sonner if exact upstream notification behavior matters.

### 4. Local toast system differs from upstream sonner API

- **status:** partial
- **local file path(s):** `src/components/ui/toaster.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx`
- **exact cited evidence:**
  - src/components/ui/toaster.tsx:22 — `export function ToasterProvider({ children }: { children: React.ReactNode }) {`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:82 — `toast.error('Delete functionality not available for this list');`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:95 — `toast.success(\`${list.singular} deleted successfully.\`)`
- **why it matters to parity:** Notifications may differ in placement, styling, duration, action semantics, and accessibility from upstream.
- **recommended fix direction:** Either adopt sonner or document/customize local Toaster to match visible upstream behavior.

### 5. Real dashboard ErrorBoundary wrapper is now present

- **status:** matched for functional class-boundary presence; partial for exact fallback presentation
- **local file path(s):** `src/components/dashboard/dashboard-shell.tsx`, `src/components/dashboard/error-boundary.tsx`, `tests/dashboard-error-boundary.test.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ErrorBoundary.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/dashboard-shell.tsx:15-21` — local shell wraps `<DashboardLayout ...>` in `<DashboardErrorBoundary>`.
  - `src/components/dashboard/error-boundary.tsx:64-89` — local `DashboardErrorBoundary` is a real React class component with `getDerivedStateFromError`, `componentDidCatch`, and reset handling.
  - `src/components/dashboard/error-boundary.tsx:18-56` — local fallback renders `Something went wrong`, an error message, `Try again`, `Refresh page`, and dev-only stack details.
  - `tests/dashboard-error-boundary.test.ts:11-33` — focused test proves normal children render and fallback UI renders from captured render-error state. User-provided rerun proof: `npx vitest run tests/dashboard-error-boundary.test.ts` passed with 2 tests, and `npm run lint` passed.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:109-125` — upstream wraps the dashboard provider/layout tree in `<ErrorBoundary>`.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ErrorBoundary.tsx:18-66` — upstream `ErrorBoundary` has the same class-boundary lifecycle shape and recovery UI.
- **why it matters to parity:** The old functional fallback did not catch render errors. The live dashboard tree now has the same class of recovery boundary as the reference.
- **recommended fix direction:** Treat remaining fallback styling/copy differences as visual polish unless strict screenshot parity is required.

### 6. Query provider boundary moved from dashboard-owned to app-router global

- **status:** partial
- **local file path(s):** `src/router.tsx`, `src/features/query-client.tsx`, `src/components/dashboard/dashboard-providers.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/providers/QueryProvider.tsx`
- **exact cited evidence:**
  - src/router.tsx:? — pattern not found: context: { queryClient }
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:120 — `<QueryProvider>`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/providers/QueryProvider.tsx:3 — `* Wraps the application with QueryClientProvider and DevTools`
- **why it matters to parity:** Cache lifetime, devtools, hydration, and invalidation boundaries are not identical to upstream dashboard.
- **recommended fix direction:** Audit query defaults and hydration; keep if intentional TanStack adaptation, but cite as non-identical.

### 7. No AdminMetaProvider equivalent in local provider tree

- **status:** partial
- **local file path(s):** `src/components/dashboard/dashboard-providers.tsx`, `src/features/cms/graphql-client.ts`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useAdminMeta.tsx`
- **exact cited evidence:**
  - src/components/dashboard/dashboard-providers.tsx:33 — `<DashboardProvider>`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:122 — `<AdminMetaProvider initialData={adminMeta}>`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useAdminMeta.tsx:56 — `export function AdminMetaProvider({`
- **why it matters to parity:** Components relying on context-style admin meta cannot be ported 1:1; local uses fetch/query props instead.
- **recommended fix direction:** Either add AdminMetaProvider for parity or document route/query replacement and test consumers.

### 8. AI right sidebar is now mounted in local dashboard layout

- **status:** matched for shell mounting; partial for full AI chat behavior
- **local file path(s):** `src/components/dashboard/dashboard-layout.tsx`, `src/components/dashboard/right-sidebar.tsx`, `src/components/dashboard/dashboard-providers.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/right-sidebar.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/dashboard-layout.tsx:42-48` — local layout now renders `<RightSidebar side="right" />` after `SidebarInset`.
  - `src/components/dashboard/right-sidebar.tsx:7-15` — local `RightSidebar` wraps `AiChatSidebar` in the shared right-side `Sidebar` shell.
  - `src/components/dashboard/dashboard-providers.tsx:23-27` — local provider stack includes `ChatModeProvider` and `SidebarProvider defaultOpenRight={false}`.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:84-92` — upstream mounts `<RightSidebar side="right" />` in dashboard content.
- **why it matters to parity:** The previous local right sidebar was dead code. It is now mounted in the live shell like the reference dashboard.
- **recommended fix direction:** Treat mount absence as fixed. Continue auditing the AI chat internals separately.

### 9. Floating AI chat button is now mounted

- **status:** matched for toggle affordance presence; partial for exact positioning behavior
- **local file path(s):** `src/components/dashboard/dashboard-layout.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/dashboard-layout.tsx:12-29` — local `FloatingChatButton` uses right-side sidebar state, renders Sparkles/ChevronRight, and calls `toggleSidebarWithSide('right')`.
  - `src/components/dashboard/dashboard-layout.tsx:47` — local layout renders `<FloatingChatButton />`.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:58-79` — upstream `FloatingChatButton` toggles the right sidebar with Sparkles/Chevron behavior.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:91` — upstream layout renders `<FloatingChatButton />`.
- **why it matters to parity:** Users now have the same shell-level AI toggle affordance class as the reference dashboard.
- **recommended fix direction:** If screenshot parity matters, tune right-offset behavior for `18rem` vs `30rem` breakpoints; otherwise keep focus on AI chat behavior and richer dashboard blockers.

### 10. Local AI chat implementation is stripped down

- **status:** partial
- **local file path(s):** `src/components/dashboard/ai-chat-sidebar.tsx`, `src/components/dashboard/chat-mode.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx`
- **exact cited evidence:**
  - src/components/dashboard/ai-chat-sidebar.tsx:9 — `import { useChatMode } from './chat-mode'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:86 — `const { messages, sendMessage, status, error } = useChat({`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:93 — `queryClient.invalidateQueries();`
- **why it matters to parity:** Upstream AI chat streams, detects tool-like CRUD activity, and invalidates dashboard data; local is simpler.
- **recommended fix direction:** Port upstream `useChat`/transport/tool invalidation behavior or mark AI parity out of scope.

### 11. AI markdown rendering missing locally

- **status:** partial
- **local file path(s):** `src/components/dashboard/ai-chat-sidebar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx`
- **exact cited evidence:**
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx:7 — `import ReactMarkdown from "react-markdown";`
  - src/components/dashboard/ai-chat-sidebar.tsx:69 — `messages.map((message) => <ChatMessageBubble key={message.id} message={message} />)`
- **why it matters to parity:** Assistant responses with code/lists/markdown lose fidelity.
- **recommended fix direction:** Add ReactMarkdown/GFM rendering or equivalent.

### 12. Sidebar model navigation flattened

- **status:** partial
- **local file path(s):** `src/components/dashboard/dashboard-sidebar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx`
- **exact cited evidence:**
  - src/components/dashboard/dashboard-sidebar.tsx:9 — `SidebarMenu,`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx:18 — `SidebarGroupLabel,`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx:133 — `<Collapsible`
- **why it matters to parity:** Upstream groups models and preserves navigation hierarchy; local makes all links same level.
- **recommended fix direction:** Port grouped/collapsible Models section.

### 13. Collapsed sidebar lacks upstream dropdown model navigation

- **status:** partial
- **local file path(s):** `src/components/dashboard/dashboard-sidebar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx`
- **exact cited evidence:**
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx:175 — `<DropdownMenu>`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx:35 — `DropdownMenuItem,`
- **why it matters to parity:** Collapsed/icon mode is much less discoverable locally.
- **recommended fix direction:** Add collapsed dropdown fallback.

### 14. Hidden-list filtering weaker locally

- **status:** partial
- **local file path(s):** `src/routes/dashboard/index.tsx`, `src/components/dashboard/dashboard-layout.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/HomePage/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/index.tsx:26 — `const lists = data.lists.filter((list) => !list.hideNavigation)`
  - src/components/dashboard/dashboard-layout.tsx:18 — `<DashboardSidebar lists={lists.filter((list) => !list.hideNavigation)} user={user} />`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:103 — `const enhancedLists = lists.filter((list: any) => !(list.hideNavigation ?? list.isHidden))`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Sidebar.tsx:59 — `const listsArray = Object.values(lists).filter((list: any) => !(list.hideNavigation ?? list.isHidden))`
- **why it matters to parity:** Lists with `isHidden` but not `hideNavigation` can leak into nav/home.
- **recommended fix direction:** Filter on both `hideNavigation` and `isHidden` in local dashboard data model or mapper.

### 15. User profile dropdown width differs from upstream

- **status:** partial
- **local file path(s):** `src/components/dashboard/user-profile.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/UserProfileClient.tsx`
- **exact cited evidence:**
  - src/components/dashboard/user-profile.tsx:59 — `className="min-w-56 rounded-lg"`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/UserProfileClient.tsx:80 — `className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"`
- **why it matters to parity:** Menu width/position can look detached from trigger.
- **recommended fix direction:** Match upstream dropdown width classes.

### 16. Seeded sign-in works over real HTTP for Ada

- **status:** matched
- **local file path(s):** `src/routes/dashboard/signin.tsx`, `src/features/cms/graphql-client.ts`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/SignInPage/SignInForm.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - src/routes/dashboard/signin.tsx:27 — `authenticateUserWithPassword: {`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/SignInPage/SignInForm.tsx:55 — `const [state, formAction] = useActionState(signIn, initialState);`
  - Live HTTP: POST `/api/graphql` with ada@example.com/password returned 200, `UserAuthenticationWithPasswordSuccess`, and `set-cookie: keystonejs-session=...`.
- **why it matters to parity:** Confirms the recent CSS/login blocker is not currently present.
- **recommended fix direction:** Keep `test:cms:auth` and `test:dashboard:http` coverage.

### 17. Sign-in uses client GraphQL and hard navigation instead of upstream server action

- **status:** partial
- **local file path(s):** `src/routes/dashboard/signin.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/SignInPage/SignInForm.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - src/routes/dashboard/signin.tsx:12 — `import { executeDashboardGraphQL } from '@/features/cms/graphql-client'`
  - src/routes/dashboard/signin.tsx:60 — `window.location.assign(safeDashboardRedirectPath(search.from))`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/SignInPage/SignInForm.tsx:55 — `const [state, formAction] = useActionState(signIn, initialState);`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:21 — `export async function signIn(prevState: { message: string | null, formData: { email: string, password: string } }, formData: FormData) {`
- **why it matters to parity:** Behavior depends on GraphQL cookie side effects and full page navigation, not upstream server action contract.
- **recommended fix direction:** Extract local dashboard auth actions that explicitly preserve cookie/redirect semantics.

### 18. Sign-in redirect safety is stronger locally than upstream

- **status:** matched
- **local file path(s):** `src/routes/dashboard/signin.tsx`, `src/features/cms/dashboard-route-guards.ts`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - src/routes/dashboard/signin.tsx:11 — `import { safeDashboardRedirectPath } from '@/features/cms/dashboard-route-guards'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:89 — `redirect(from);`
- **why it matters to parity:** Prevents open redirects while upstream leaves raw `from` behavior.
- **recommended fix direction:** Keep local safety; note it as deliberate divergence.

### 19. Signup reimplements upstream signUp->signIn flow in route code

- **status:** partial
- **local file path(s):** `src/routes/dashboard/signup.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - src/routes/dashboard/signup.tsx:30 — `createUser?: { id: string; email?: string }`
  - src/routes/dashboard/signup.tsx:34 — `authenticateUserWithPassword?:`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/SignUpPage/SignUpForm.tsx:53 — `const [state, formAction] = useActionState(signUp, initialState);`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:119 — `return signIn({ message: null, formData: { email, password } }, formData);`
- **why it matters to parity:** Future auth action changes will not apply; session persistence is implicit.
- **recommended fix direction:** Create shared local auth action helpers mirroring upstream.

### 20. Init flow contract now matches upstream createInitialUser then signIn ordering

- **status:** matched for create-then-sign-in sequencing; partial for broader auth/cookie live proof
- **local file path(s):** `src/routes/dashboard/init.tsx`, `tests/dashboard-init-route.test.ts`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/InitPage/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - `src/routes/dashboard/init.tsx:34-68` — `createInitialUserAndSignIn(...)` calls `createInitialUser(data: $data)`, then `authenticateUserWithPassword(email: $email, password: $password)`, and throws when the auth result is not `UserAuthenticationWithPasswordSuccess`.
  - `src/routes/dashboard/init.tsx:79-81` — the form action awaits `createInitialUserAndSignIn({ name, email, password })` before `window.location.assign('/dashboard')`.
  - `tests/dashboard-init-route.test.ts:15-51` — focused regression proves `createInitialUser` and then `authenticateUserWithPassword` are called with the submitted credentials.
  - `tests/dashboard-init-route.test.ts:53-78` — focused regression proves a follow-up sign-in failure rejects instead of silently redirecting.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/InitPage/index.tsx:47-75` — upstream `InitPage` first calls `createInitialUser`, then calls `signIn(...)` with the same form data.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:17-75` — upstream `signIn` executes `authenticateUserWithPassword`, validates `sessionToken`, sets `keystonejs-session`, then redirects.
- **why it matters to parity:** The earlier local route could redirect after creation without proving a durable signin. The target now follows the reference dashboard's create-then-sign-in sequencing.
- **recommended fix direction:** Keep the regression. Remaining auth parity should target signin/signup/reset action semantics and live cookie/redirect proof, not init ordering.

### 21. Reset request branch ignores boolean result where upstream checks it

- **status:** partial
- **local file path(s):** `src/routes/dashboard/reset.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ResetPage/ResetForm.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - src/routes/dashboard/reset.tsx:55 — `await executeDashboardGraphQL<SendResetResult>(`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:257 — `sendUserPasswordResetLink(email: $email)`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:271 — `if (response.data?.sendUserPasswordResetLink === true) {`
- **why it matters to parity:** Local can show success when upstream would show failure.
- **recommended fix direction:** Inspect mutation result and match upstream success/failure rules.

### 22. Reset redeem branch treats message as failure, upstream checks error code

- **status:** partial
- **local file path(s):** `src/routes/dashboard/reset.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - src/routes/dashboard/reset.tsx:28 — `type RedeemResetResult = { redeemUserPasswordResetToken: { code: string; message: string } | null }`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:206 — `export async function resetPassword(prevState: { message: string | null, success: string | null, formData: { email: string, password: string } }, formData: FormData, mode: 'reset' | 'request') {`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:12 — `code: string;`
- **why it matters to parity:** Could falsely fail successful reset responses that include informational messages.
- **recommended fix direction:** Match upstream result union semantics.

### 23. No-access page is effectively equivalent

- **status:** matched
- **local file path(s):** `src/routes/dashboard/no-access.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/no-access.tsx:1 — `import { createFileRoute, useNavigate } from '@tanstack/react-router'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/NoAccessPage/index.tsx:7 — `export function NoAccessPage() {`
- **why it matters to parity:** Low-risk route; only framework navigation differs.
- **recommended fix direction:** Keep as-is; smoke test unauthorised access.

### 24. Home route is client-query/TanStack loader, upstream is server-fetched

- **status:** partial
- **local file path(s):** `src/routes/dashboard/index.tsx`, `src/components/dashboard/dashboard-shell.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/HomePage/index.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/index.tsx:8 — `import { dashboardQueryKeys, fetchDashboardOverview } from '@/features/cms/graphql-client'`
  - src/components/dashboard/dashboard-shell.tsx:3 — `import { dashboardQueryKeys, fetchDashboardOverview } from '@/features/cms/graphql-client'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/HomePage/index.tsx:12 — `import { getAdminMetaAction, getListCounts } from '../../actions'`
- **why it matters to parity:** Different data loading/cache semantics; local shell and home duplicate overview fetch.
- **recommended fix direction:** Avoid duplicate overview queries or document framework adaptation.

### 25. List URL state normalized centrally, upstream reads ad hoc params

- **status:** partial
- **local file path(s):** `src/routes/dashboard/$listKey.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.tsx:12 — `validateSearch: (search: Record<string, unknown>) => ({`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:10 — `import { useRouter, useSearchParams } from 'next/navigation'`
- **why it matters to parity:** URL behavior differs; this is safer locally but not exact NKS parity.
- **recommended fix direction:** Keep with compatibility tests; note divergence.

### 26. Local strips default URL params, upstream leaves raw params

- **status:** partial
- **local file path(s):** `src/components/dashboard/list-search-url.ts`, `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx`
- **exact cited evidence:**
  - src/components/dashboard/filter-bar.tsx:9 — `import { normalizeListSearchForUrl } from './list-search-url'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:? — pattern not found: params.set
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:? — pattern not found: params.set
- **why it matters to parity:** Back/forward/shareable URLs differ.
- **recommended fix direction:** Decide canonical URL parity; if upstream parity required, stop stripping defaults.

### 27. Local persists list state in localStorage, upstream URL-only

- **status:** partial
- **local file path(s):** `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx`
- **exact cited evidence:**
  - src/components/dashboard/filter-bar.tsx:114 — `const storedRaw = window.localStorage.getItem(storageKey)`
  - src/components/dashboard/filter-bar.tsx:134 — `window.localStorage.setItem(storageKey, JSON.stringify(persistedState))`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:29 — `export function FilterBar({ list, selectedFields = new Set() }: FilterBarProps) {`
- **why it matters to parity:** Users may see remembered filters/columns that upstream would not restore.
- **recommended fix direction:** Document as intentional product improvement or disable persistence for strict parity.

### 28. Filter URL formats differ and local dual-writes

- **status:** partial
- **local file path(s):** `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterList.tsx`
- **exact cited evidence:**
  - src/components/dashboard/filter-bar.tsx:8 — `import { formatOfficialFilterParam, officialFilterParamsFromSearch, parseOfficialFilterParam } from './filter-param-compat'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterList.tsx:? — pattern not found: !${field.path}_${filterType}
- **why it matters to parity:** Incoming links and active filter chips may behave differently.
- **recommended fix direction:** Keep dual parser but verify exact upstream `!field_type` compatibility.

### 29. Local filtered empty-state handles structured filters better than upstream

- **status:** matched
- **local file path(s):** `src/routes/dashboard/$listKey.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.tsx:5 — `import { hasAnyDashboardFilters } from '@/components/dashboard/filter-param-compat'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:93 — `const searchString = currentSearchParams.search || ''`
- **why it matters to parity:** This is a useful local improvement; not a blocker.
- **recommended fix direction:** Keep tests proving filter-only empty states.

### 30. Reset list-state control exists locally but not upstream toolbar

- **status:** partial
- **local file path(s):** `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx`
- **exact cited evidence:**
  - src/components/dashboard/filter-bar.tsx:109 — `const showResetControls = useMemo(() => !isAtDefaultListState(list, searchParams), [list, searchParams])`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/ListPage/ListPageClient.tsx:? — pattern not found: NoResultsFound
- **why it matters to parity:** Toolbar affordances differ from upstream.
- **recommended fix direction:** Keep if desired; otherwise hide reset except empty state.

### 31. Search placeholder can advertise broad filterable fields

- **status:** partial
- **local file path(s):** `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx`
- **exact cited evidence:**
  - src/components/dashboard/filter-bar.tsx:30 — `return \`Search by ${searchLabels.length ? searchLabels.join(', ').toLowerCase() : 'id'}\``
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/FilterBar.tsx:80 — `const searchLabels = searchableFields.map((field: any) => field.label)`
- **why it matters to parity:** Live browser observed `/dashboard/users` placeholder: `Search by id, name, password, password reset token, password reset issued at, password reset redeemed at, role, tasks`; this is noisy and likely worse than upstream intent.
- **recommended fix direction:** Restrict placeholder to `initialSearchFields`/trivially searchable labels.

### 32. Column selection excludes hidden fields locally; upstream component only filters id

- **status:** partial
- **local file path(s):** `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FieldSelection.tsx`
- **exact cited evidence:**
  - src/components/dashboard/filter-bar.tsx:348 — `const orderableFields = list.fields.filter((field) => field.isOrderable && field.listView.fieldMode !== 'hidden')`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/FieldSelection.tsx:? — pattern not found: field.path !==
- **why it matters to parity:** Local is safer but strict parity differs.
- **recommended fix direction:** Keep local safety; add tests.

### 33. Column URL compatibility writes `fields` and `column`, upstream only `fields`

- **status:** partial
- **local file path(s):** `src/routes/dashboard/$listKey.tsx`, `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/hooks/useSelectedFields.ts`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/FieldSelection.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.tsx:20 — `: Array.isArray(search.column)`
  - src/components/dashboard/filter-bar.tsx:155 — `column: normalized.length ? normalized : undefined,`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/FieldSelection.tsx:52 — `const setNewSelectedFields = (fields: string[]) => {`
- **why it matters to parity:** URL surface differs.
- **recommended fix direction:** Keep for backward compatibility, but ledger as divergence.

### 34. Sort menu hides hidden fields locally, upstream checks only orderable

- **status:** partial
- **local file path(s):** `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx`
- **exact cited evidence:**
  - src/components/dashboard/filter-bar.tsx:348 — `const orderableFields = list.fields.filter((field) => field.isOrderable && field.listView.fieldMode !== 'hidden')`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/SortSelection.tsx:88 — `.filter(([, field]) => field.isOrderable)`
- **why it matters to parity:** Local avoids invalid controls but is not identical.
- **recommended fix direction:** Keep unless exact upstream reproduction is required.

### 35. Table header sort skips local URL normalizer

- **status:** partial
- **local file path(s):** `src/components/dashboard/keystone-list-table.tsx`, `src/components/dashboard/filter-bar.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx`
- **exact cited evidence:**
  - src/components/dashboard/keystone-list-table.tsx:275 — `void navigate({ search: (previous) => ({ ...previous, sortBy: nextSort, page: 1 }) })`
  - src/components/dashboard/filter-bar.tsx:9 — `import { normalizeListSearchForUrl } from './list-search-url'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:213 — `const currentSort = query.sortBy;`
- **why it matters to parity:** Internal inconsistency: toolbar cleans URLs, header sort can reintroduce defaults.
- **recommended fix direction:** Route header sort through `normalizeListSearchForUrl`.

### 36. Page-size semantics constrained locally, arbitrary upstream

- **status:** partial
- **local file path(s):** `src/components/dashboard/pagination.tsx`, `src/routes/dashboard/$listKey.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.tsx:8 — `import { normalizeDashboardPageSize } from '@/components/dashboard/page-size'`
  - src/components/dashboard/pagination.tsx:165 — `<DropdownMenuLabel>Page Size</DropdownMenuLabel>`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:82 — `const totalPages = Math.max(1, Math.ceil(total / pageSize));`
- **why it matters to parity:** Share URLs with arbitrary pageSize can normalize differently.
- **recommended fix direction:** Decide whether snapping is desired; document or match upstream.

### 37. Bulk selection supports extra actions locally, upstream delete-only

- **status:** partial
- **local file path(s):** `src/components/dashboard/pagination.tsx`, `src/components/dashboard/keystone-list-table.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx`
- **exact cited evidence:**
  - src/components/dashboard/pagination.tsx:34 — `selectionActions,`
  - src/components/dashboard/keystone-list-table.tsx:14 — `import { ListPageActions } from './list-page-actions'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/Pagination.tsx:48 — `onDelete?: () => void;`
- **why it matters to parity:** Visible footer actions differ.
- **recommended fix direction:** Keep extension if local actions are in scope; visually compare.

### 38. Table cell rendering richer locally than upstream primitive fallback

- **status:** partial
- **local file path(s):** `src/components/dashboard/keystone-list-table.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx`
- **exact cited evidence:**
  - src/components/dashboard/keystone-list-table.tsx:308 — `const viewCell = renderViewCell({ listPath, item, field, isFirstField })`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/components/ListTable.tsx:204 — `Complex data`
- **why it matters to parity:** Likely improvement, but exact upstream visuals differ.
- **recommended fix direction:** Snapshot users/todos cells against accepted target.

### 39. Relationship cells differ

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/relationship.tsx`, `src/components/dashboard/keystone-list-table.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/relationship.tsx:35 — `displayMode: base.displayMode === 'cards' || base.displayMode === 'count' || base.displayMode === 'select' ? base.displayMode : undefined,`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/index.tsx:301 — `config.fieldMeta.displayMode === "count" ? "count" : "cards-or-select",`
- **why it matters to parity:** Count/list labels, truncation, links, and overflow differ.
- **recommended fix direction:** Port upstream relationship cell rules.

### 40. Create page has local runtime metadata merge not present upstream

- **status:** partial
- **local file path(s):** `src/routes/dashboard/$listKey.create.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.create.tsx:55 — `const runtimeMeta = data.fieldMetaByPath[fieldPath]`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx:20 — `import { enhanceFields } from '../../utils/enhanceFields'`
- **why it matters to parity:** May be necessary for local runtime but not exact upstream behavior.
- **recommended fix direction:** Keep if required; test field mode parity.

### 41. Create page sidebar field grouping differs from upstream

- **status:** partial
- **local file path(s):** `src/routes/dashboard/$listKey.create.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/CreatePage/CreatePageClient.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.create.tsx:153 — `{sidebarGroups.length ? <EnhancedFormFields list={list} fields={formFields} values={state} serialized={serialized} view="createView" region="sidebar" invalidFields={showValidation ? highlightedFields : undefined} onChange={setState} /> : null}`
  - Upstream CreatePageClient comments put all fields in main; see subagent audit citation: `CreatePageClient.tsx:110-121`.
- **why it matters to parity:** Layout can differ significantly for field positions.
- **recommended fix direction:** Visual compare create users/todos; align grouping only if upstream target actually expects it.

### 42. Item page deserializes full item record, upstream passes per-field object

- **status:** partial
- **local file path(s):** `src/routes/dashboard/$listKey.$id.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.$id.tsx:91 — `return Object.fromEntries(Object.entries(allVisibleFields).map(([fieldPath, field]) => [fieldPath, field.controller.deserialize(itemRecord)]))`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:224 — `function deserializeItemToValue(`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:235 — `// Create itemForField with only the GraphQL fields this controller needs`
- **why it matters to parity:** Local is more correct for multi-field controllers; not exact upstream.
- **recommended fix direction:** Keep; add tests for image/password/document selections.

### 43. Item page hides itemView hidden fields locally

- **status:** partial
- **local file path(s):** `src/routes/dashboard/$listKey.$id.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx`
- **exact cited evidence:**
  - src/routes/dashboard/$listKey.$id.tsx:87 — `const allVisibleFields = useMemo(() => Object.fromEntries(Object.entries(enhancedFields).filter(([, field]) => field.path === 'id' || field.itemView.fieldMode !== 'hidden')), [enhancedFields])`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:16 — `import { enhanceFields } from '../../utils/enhanceFields'`
- **why it matters to parity:** Local may suppress fields upstream would display due to upstream bug/omission.
- **recommended fix direction:** Keep if admin meta says hidden; snapshot visibility.

### 44. Relationship editor is a rewrite, not upstream ClientField port

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/relationship.tsx`, `src/components/dashboard/relationship-field-editor.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/relationship.tsx:3 — `import { RelationshipFieldEditor } from '../relationship-field-editor'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/index.tsx:6 — `import { ClientField } from "./client/Field";`
- **why it matters to parity:** High-risk for inline create/edit/cards/connect parity.
- **recommended fix direction:** Audit relationship editor against upstream subcomponents; port missing cards/select semantics.

### 45. Relationship metadata shape differs

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/relationship.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/relationship.tsx:28 — `const ui = field.fieldMeta.ui`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/index.tsx:279 — `config.fieldMeta.displayMode === "cards"`
- **why it matters to parity:** Controllers may not receive the same metadata contract.
- **recommended fix direction:** Normalize admin meta to upstream shape or adapt controllers comprehensively.

### 46. Password view is near but not exact upstream contract

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/password.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/password/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/password.tsx:76 — `function validatePassword(value: PasswordValue, validation: PasswordValidation, isRequired: boolean, label: string) {`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/password/index.tsx:326 — `graphqlSelection: \`${config.path} { isSet }\`,`
- **why it matters to parity:** Validation hints/state shape differ; browser focus/show-hide parity unproven.
- **recommended fix direction:** Run interaction tests for set/cancel/show/hide/error copy.

### 47. File view is aliased to image view

- **status:** broken
- **local file path(s):** `src/components/dashboard/views/registry.tsx`, `src/components/dashboard/views/image.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/image/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/registry.tsx:284 — `file: imageView,`
  - src/components/dashboard/views/image.tsx:31 — `graphqlSelection: typeof config.fieldMeta.graphqlSelection === 'string' ? config.fieldMeta.graphqlSelection : config.path,`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/image/index.tsx:2 — `import { SUPPORTED_IMAGE_EXTENSIONS } from './utils'`
- **why it matters to parity:** File and image are not the same UX/validation/data shape.
- **recommended fix direction:** Add dedicated file view or prove local file-field editor covers file semantics.

### 48. Image controller under-fetches compared with upstream

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/image.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/image/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/image.tsx:28 — `path: config.path,`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/image/index.tsx:62 — `graphqlSelection: \`${config.path} {`
- **why it matters to parity:** Missing `url/extension/filesize/width/height` can break previews or details.
- **recommended fix direction:** Use upstream image GraphQL selection unless local metadata supplies it.

### 49. Document field is textarea/JSON shim, not upstream DocumentEditor

- **status:** broken
- **local file path(s):** `src/components/dashboard/views/document.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/document.tsx:34 — `<Textarea`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx:10 — `// Import required components from DocumentEditor folder`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx:13 — `import { createDocumentEditor } from './client/DocumentEditor/editor-shared'`
- **why it matters to parity:** This is the largest field-view parity failure; rich editing, relationships, component blocks, validation are absent.
- **recommended fix direction:** Port upstream DocumentEditor stack or keep document parity explicitly deferred.

### 50. Document controller state shape incompatible

- **status:** broken
- **local file path(s):** `src/components/dashboard/views/document.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/document.tsx:83 — `deserialize: (item: Record<string, unknown>) => {`
  - src/components/dashboard/views/document.tsx:83 — `deserialize: (item: Record<string, unknown>) => {`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx:242 — `deserialize: (data: any) => {`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx:261 — `serialize: (value: any) => ({`
- **why it matters to parity:** String-based state cannot match Slate-node editor behavior.
- **recommended fix direction:** Replace with Slate descendant state model.

### 51. Text view drops nullable/displayMode/validation/filter controller surface

- **status:** broken
- **local file path(s):** `src/components/dashboard/views/text.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/text/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/text.tsx:41 — `deserialize: (item: Record<string, unknown>) => {`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/text/index.tsx:31 — `displayMode: 'input' | 'textarea'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/text/index.tsx:96 — `function deserializeTextValue(value: string | null): InnerTextValue {`
- **why it matters to parity:** Text fields lose textarea mode, null toggle, regex/length behavior, filters.
- **recommended fix direction:** Port upstream text controller.

### 52. Select/multiselect controller omits upstream filter/controller surface

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/select.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/select/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/multiselect/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/select.tsx:28 — `const displayMode = field.fieldMeta.displayMode`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/select/index.tsx:50 — `displayMode: 'select' | 'segmented-control' | 'radio'`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/multiselect/index.tsx:214 — `graphqlSelection: config.path,`
- **why it matters to parity:** Basic UI exists, but list filters and multiselect UX can diverge.
- **recommended fix direction:** Port filter methods and richer multiselect UI.

### 53. Number family collapsed into one generic view

- **status:** broken
- **local file path(s):** `src/components/dashboard/views/registry.tsx`, `src/components/dashboard/views/number.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/integer/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/float/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/decimal/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/bigInt/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/registry.tsx:275 — `integer: numberView,`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/integer/index.tsx:52 — `function validate_(`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/decimal/index.tsx:58 — `function validateDecimal(input: string): { isValid: boolean; number?: number; error?: string } {`
- **why it matters to parity:** Integer/float/decimal/bigInt each have distinct validation/format/filter semantics upstream.
- **recommended fix direction:** Split local number view by type or implement exact per-kind branches.

### 54. Timestamp view is no longer a plain datetime-local input, but full upstream filter/CardValue parity is still missing

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/timestamp.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/views/timestamp.tsx:12-18` — local now uses Keystone-shaped create/update timestamp value state.
  - `src/components/dashboard/views/timestamp.tsx:80-96` — local validation mirrors upstream null-initial/default-now/updatedAt/required behavior.
  - `src/components/dashboard/views/timestamp.tsx:119-183` — local field now renders formatted display plus dedicated native date and time inputs, not a single `datetime-local` text-like input.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx:116-183` — upstream renders a Popover/Calendar date picker plus time input.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx:264-398` — upstream controller exposes timestamp filter UI, GraphQL mapping, parseGraphQL, label formatting, and filter types.
  - `src/components/dashboard/views/timestamp.tsx` has no controller `filter` object and does not export `CardValue` despite listing it in `allowedExportsOnCustomViews`.
- **why it matters to parity:** The old severe timestamp editor/state blocker is narrowed. Remaining differences affect list/card/filter behavior and strict upstream dashboard field-view parity.
- **recommended fix direction:** Add `CardValue` plus timestamp filter UI/GraphQL/parse/label/type semantics, or explicitly defer timestamp filtering.

### 55. JSON invalid serialization can throw if validation is bypassed

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/json.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/json/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/json.tsx:44 — `return { [config.path]: raw ? JSON.parse(raw) : undefined }`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/json/index.tsx:135 — `serialize: value => {`
- **why it matters to parity:** Form submission path should be robust even under race/manual calls.
- **recommended fix direction:** Wrap parse like upstream and return undefined/error state consistently.

### 56. Checkbox cell renders badge instead of disabled checkbox

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/checkbox.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/checkbox/index.tsx`
- **exact cited evidence:**
  - src/components/dashboard/views/checkbox.tsx:16 — `if (!onChange) return <Badge variant={value === true ? 'secondary' : 'outline'}>{value === true ? 'Yes' : 'No'}</Badge>`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/checkbox/index.tsx:73 — `aria-label={fieldValue ? "true" : "false"}`
- **why it matters to parity:** Visual and accessibility behavior differ.
- **recommended fix direction:** Render disabled checkbox in cells if strict upstream parity is required.

### 57. Document editor parity remains explicitly deferred in earlier audit but is a real dashboard gap

- **status:** deferred
- **local file path(s):** `src/components/dashboard/views/document.tsx`, `reports/keystone-parity/dashboard-parity-audit-latest.md`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx`
- **exact cited evidence:**
  - reports/keystone-parity/dashboard-parity-audit-latest.md:22 — `Document editor parity remains deferred and is not counted as the current non-document dashboard blocker.`
  - /Users/junaid/code/next-keystone-starter/features/dashboard/views/document/index.tsx:10 — `// Import required components from DocumentEditor folder`
- **why it matters to parity:** The old report not counting document parity is stale for exhaustive dashboard UI parity.
- **recommended fix direction:** Keep as top-level deferred/broken dashboard ledger item until ported.

### 58. Runtime browser verification after ThemeProvider exposed no theme crash but still needs console-clean pass

- **status:** partial
- **local file path(s):** `src/components/dashboard/dashboard-providers.tsx`
- **upstream file path(s):** `live browser http://localhost:3001`
- **exact cited evidence:**
  - src/components/dashboard/dashboard-providers.tsx:35 — `<ThemeProvider>`
  - Live browser observed `/dashboard`, `/dashboard/users`, `/dashboard/users/create`, and `/dashboard/users/user_admin` rendering after signin. Earlier `useTheme` crash no longer visible. Full console/network clean audit not yet complete.
- **why it matters to parity:** A route rendering is necessary but not sufficient; console errors can still hide interaction bugs.
- **recommended fix direction:** Run complete live browser pass with console/network capture after next fixes.

### 59. TanStack devtools button appears in dashboard UI during dev

- **status:** partial
- **local file path(s):** `src/routes/__root.tsx`
- **upstream file path(s):** `N/A upstream Next dev environment`
- **exact cited evidence:**
  - src/routes/__root.tsx:9 — `import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'`
  - Live snapshots show `Open TanStack Router Devtools` button on signin/dashboard/list/item pages.
- **why it matters to parity:** Dev-only button affects visual parity screenshots.
- **recommended fix direction:** Hide devtools for parity screenshots or gate behind env.

### 60. Complete parity dissertation dashboard claims are stale after live crash discoveries

- **status:** partial
- **local file path(s):** `reports/keystone-parity/complete-parity-dissertation.md`
- **upstream file path(s):** `this ledger`
- **exact cited evidence:**
  - reports/keystone-parity/complete-parity-dissertation.md:42 — `| Dashboard shell and route surface | 75% | Core routes and shell exist; some interaction details remain partial. |`
  - reports/keystone-parity/complete-parity-dissertation.md:43 — `| Dashboard list UX | 72% | Read path, list controls, persistence, snapped page sizes, and stronger bulk-delete semantics exist; exact Keystone URL/action/controller behavior still differs. |`
  - reports/keystone-parity/complete-parity-dissertation.md:44 — `| Dashboard create/item forms | 68% | Routes exist, reset confirmation and richer mutation error handling are present, but full field/controller parity is still incomplete. |`
- **why it matters to parity:** Those scores did not account for the just-fixed ThemeProvider crash, ToasterProvider crash path, and exhaustive field-view deltas.
- **recommended fix direction:** Revise dissertation dashboard scorecard downward/conditional and link this ledger.

### 61. Controlled relationship create sheet now opens from plain inline-create button

- **status:** matched for the specific live inert-button bug; partial for full upstream relationship parity
- **local file path(s):** `src/components/dashboard/relationship-create-sheet.tsx`, `src/components/dashboard/relationship-edit-sheet.tsx`, `src/components/dashboard/relationship-field-editor.tsx`, `src/components/ui/sheet.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/client/components/InlineCreate.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/client/components/InlineEdit.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/relationship-create-sheet.tsx:94` — `<Sheet open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : requestClose())} disablePointerDismissal>`
  - `src/components/dashboard/relationship-edit-sheet.tsx:126` — `<Sheet open={open} onOpenChange={(nextOpen) => (nextOpen ? onOpenChange(true) : requestClose())} disablePointerDismissal>`
  - `src/components/dashboard/relationship-field-editor.tsx:419` — `Create related {relatedList.singular}`
  - `src/components/dashboard/relationship-field-editor.tsx:441` — `<RelationshipCreateSheet`
  - Live browser: on `http://localhost:3001/dashboard/users/user_admin`, programmatically clicking the visible `Create related Todo` button produced `[data-slot=sheet-overlay]` and `[data-slot=sheet-content][role=dialog]` with text beginning `Create related Todo Add a new todo without leaving this form`.
  - Live browser: the mounted create sheet exposed interactive controls including `Cancel`, `Create Todo`, `Close`, task status controls, attachment controls, document textarea controls, and related User controls.
- **why it matters to parity:** The previous live behavior made inline relationship create look inert even though state was changing. Inline create/edit is central to upstream relationship cards/select parity, so a non-opening sheet is a top-level usability blocker.
- **recommended fix direction:** Keep `disablePointerDismissal` for controlled sheets launched from plain buttons. Continue auditing close/focus/escape/unsaved-change behavior and upstream relationship metadata parity; this fixes the inert launch bug, not full relationship parity.

### 62. Relationship sheet footer body layout now uses `min-h-0`, but submit/close still needs a clean mouse-only regression test

- **status:** partial
- **local file path(s):** `src/components/dashboard/relationship-create-sheet.tsx`, `src/components/dashboard/relationship-edit-sheet.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/client/components/InlineCreate.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/client/components/InlineEdit.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/relationship-create-sheet.tsx:101-108` — the controlled sheet body is now inside a `form` with `className="flex min-h-0 flex-1 flex-col"`, and the scroll pane is `className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"`.
  - `src/components/dashboard/relationship-create-sheet.tsx:125-141` — footer is `className="relative z-10 shrink-0 border-t bg-background"` and the submit button is `type="submit"`.
  - `src/components/dashboard/relationship-edit-sheet.tsx:133-140` — edit sheet uses the same `form` / `min-h-0` flex column structure.
  - `src/components/dashboard/relationship-edit-sheet.tsx:160-175` — edit footer is also `relative z-10 shrink-0` with a `type="submit"` save button.
  - Live browser: after hiding the TanStack devtools button for hit-test clarity, `document.elementFromPoint(...)` at the Create Todo button center returned the actual `button type="submit"`, proving the scroll body is no longer the top hit-test target at that point.
  - Live browser: focusing the `Create Todo` submit button and pressing Enter fired both captured `click` and `submit` events.
  - Live browser: a newly created related todo (`Browser smoke todo deep inspect`, `todo_5`) appeared in the parent user Tasks relationship list during this verification pass, proving the create path can execute and update the parent relationship list.
- **why it matters to parity:** Inline relationship create must be operable with real browser input. The previous layout made the visible footer appear clickable while events were intercepted/ineffective.
- **recommended fix direction:** Keep `min-h-0`, footer `shrink-0`, and native form submit structure. Add a deterministic browser regression test that opens `Create related Todo`, fills Label, clicks the visible footer submit with a real pointer event, asserts the sheet closes, asserts the new related option is selected, and asserts no stale invisible dialog remains.

### 63. Relationship sheet form wrapper now clips overflow, but real pointer events still did not reach submit in live verification

- **status:** broken
- **local file path(s):** `src/components/dashboard/relationship-create-sheet.tsx`, `src/components/dashboard/relationship-edit-sheet.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/client/components/InlineCreate.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/client/components/InlineEdit.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/relationship-create-sheet.tsx:101-108` — create sheet form wrapper now has `className="flex min-h-0 flex-1 flex-col overflow-hidden"`, and the body pane remains `className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"`.
  - `src/components/dashboard/relationship-edit-sheet.tsx:133-140` — edit sheet form wrapper has the same `overflow-hidden` form wrapper and `min-h-0` scroll pane.
  - `src/components/dashboard/relationship-create-sheet.tsx:125-141` — create sheet footer is `relative z-10 shrink-0`, and `Create Todo` is a native `button type="submit"`.
  - Live browser: ordinary pointer click on the parent page `Create related Todo` still did not open the sheet, while direct DOM `openBtn.click()` did open it.
  - Live browser: after DOM-opening the sheet, `document.elementFromPoint(...)` over `Create Todo` returned the actual submit button, but `agent-browser click @e4`, mouse down/up at the button coordinates, and focused Enter activation did not fire captured document/button/form click or submit listeners.
  - Live browser: the sheet remained open and no new `Browser pointer submit overflow hidden` related todo appeared after the real-click submit attempt.
- **why it matters to parity:** This keeps inline relationship create/edit in a broken state for real user input even though DOM `.click()` can execute React handlers. The latest layout changes improve the DOM structure but do not prove real pointer operability in the current live browser session.
- **recommended fix direction:** Treat this as the top concrete dashboard blocker. Inspect Base UI Dialog/Sheet event layering, portal/backdrop z-index, inert/focus guards, and any devtools/overlay interaction. Build a minimal repro for a controlled `Sheet` opened by plain button. Add a browser regression that uses real pointer events rather than DOM `.click()`.

### 64. TanStack Router Devtools removed from root shell, but relationship pointer interaction still fails in current live verification

- **status:** broken
- **local file path(s):** `src/routes/__root.tsx`, `src/components/dashboard/relationship-create-sheet.tsx`, `src/components/dashboard/relationship-edit-sheet.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/**` has no TanStack Router Devtools root overlay
- **exact cited evidence:**
  - `src/routes/__root.tsx:29-31` — root body now renders only `<Outlet />` and `<Scripts />`; `TanStackRouterDevtools` is absent.
  - `src/routes/__root.tsx:3-9` — root imports `HeadContent`, `Outlet`, `Scripts`, `createRootRoute`, and CSS, but no longer imports `TanStackRouterDevtools`.
  - Live browser: querying buttons after reload found no `Open TanStack Router Devtools` button.
  - Live browser: ordinary pointer click on the parent `Create related Todo` still did not open the sheet; document-level captured `pointerdown`/`mousedown`/`mouseup`/`click` listeners recorded no events.
  - Live browser: direct DOM `openBtn.click()` still opened the sheet, proving the React handler path exists.
  - Live browser: after DOM-opening, filling the visible Label input and clicking/focusing the `Create Todo` submit button still failed to fire captured click/submit listeners and did not create a `Browser smoke todo after devtools removal` related todo.
- **why it matters to parity:** Removing the devtools overlay was necessary because it was not part of dashboard parity and previously appeared in hit testing. But this pass proves the overlay was not the only cause of inert relationship controls. Real pointer/keyboard input still fails in the relationship create flow.
- **recommended fix direction:** Keep devtools removed from parity shell. Continue debugging real input delivery: inspect app-side causes such as Base UI Dialog modal/inert behavior, portal/backdrop event handling, scroll container capture, pointer-events CSS, and controlled dialog launched without a registered trigger. Add a real pointer regression test.

### 65. Parent relationship trigger has `onPointerDown` fallback, but live pointer events still do not reach it

- **status:** broken
- **local file path(s):** `src/components/dashboard/relationship-field-editor.tsx`, `src/components/dashboard/relationship-create-sheet.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/relationship/client/components/InlineCreate.tsx`
- **exact cited evidence:**
  - `src/components/dashboard/relationship-field-editor.tsx:327-332` — `openCreateRelated()` sets cards create state when needed and calls `setCreateOpen(true)`.
  - `src/components/dashboard/relationship-field-editor.tsx:429-436` — the parent `Create related ...` button now has `onPointerDown` that calls `openCreateRelated()` and keeps `onClick={openCreateRelated}`.
  - Live browser: the parent `Create related Todo` button is topmost at its center via `document.elementFromPoint(...)`, but `agent-browser click @e27` and raw mouse down/up did not record captured document pointer/click events and did not open the sheet.
  - Live browser: direct DOM `.click()` on the same button still opens the create sheet, proving `openCreateRelated()` and React state are viable when invoked programmatically.
  - Live browser: after DOM-opening the sheet, filling `Pointer fallback still no open` and clicking `Create Todo` still recorded no captured click/submit events and did not create/select the related todo.
- **why it matters to parity:** The added `onPointerDown` fallback is correct defensive code, but it cannot help if the browser automation/user input layer is not delivering any pointer events to the document. The inline relationship create flow remains unusable under real pointer interaction in this verification pass.
- **recommended fix direction:** Continue from the event-delivery failure, not from React handler logic. Verify with a clean browser session and, if reproducible, inspect CSS/global overlays, modal inerting, browser automation state, and Base UI focus/inert guards. The regression must assert captured pointer/click events reach the button before checking sheet state.

### 66. Init route now performs create-then-sign-in like the reference dashboard

- **status:** matched for the init create/sign-in sequencing contract; partial for broader auth-route parity
- **local file path(s):** `src/routes/dashboard/init.tsx`, `tests/dashboard-init-route.test.ts`, `src/features/cms/graphql-client.ts`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/InitPage/index.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts`
- **exact cited evidence:**
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/screens/InitPage/index.tsx:47-75` — `InitPage` first awaits `createInitialUser(prevState, formData)`, returns errors if `result.message` exists, then calls `signIn(...)` with the same submitted form data.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:153-183` — upstream `createInitialUser` issues a `createInitialUser` GraphQL mutation and returns data/form state instead of directly redirecting the dashboard route.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/actions/auth.ts:17-75` — upstream `signIn` calls `authenticateUserWithPassword`, requires a `sessionToken`, sets the `keystonejs-session` cookie, and redirects.
  - `src/routes/dashboard/init.tsx:34-68` — local `createInitialUserAndSignIn(...)` first sends `createInitialUser(data: $data)`, then sends `authenticateUserWithPassword(email: $email, password: $password)`, and throws if the second result is not `UserAuthenticationWithPasswordSuccess`.
  - `src/routes/dashboard/init.tsx:79-81` — the local form action calls `createInitialUserAndSignIn({ name, email, password })` and then redirects to `/dashboard`.
  - `tests/dashboard-init-route.test.ts:15-51` — regression test proves the helper calls GraphQL twice, first containing `createInitialUser` with `{ name, email, password }`, then containing `authenticateUserWithPassword` with the same `email` and `password`.
  - `tests/dashboard-init-route.test.ts:53-78` — regression test proves the helper rejects when follow-up sign-in returns `UserAuthenticationWithPasswordFailure`.
- **why it matters to parity:** The prior local init route treated initial-user creation as sufficient for entering the dashboard. The reference dashboard explicitly creates the first user and then signs in through the normal password auth flow. The new helper closes that concrete dashboard-auth sequencing mismatch.
- **recommended fix direction:** Keep the helper and regression. Remaining auth-route parity should focus on signin/signup/reset action semantics, cookie/redirect behavior, and user-facing error messages, not the init create-then-sign-in ordering.

### 67. Dashboard shell now has a real class error boundary wrapping the live dashboard layout

- **status:** matched for real error-boundary presence; partial for exact fallback styling/placement
- **local file path(s):** `src/components/dashboard/error-boundary.tsx`, `src/components/dashboard/dashboard-shell.tsx`, `tests/dashboard-error-boundary.test.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ErrorBoundary.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`
- **exact cited evidence:**
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/ErrorBoundary.tsx:18-66` — upstream exports a class `ErrorBoundary` with `getDerivedStateFromError`, `componentDidCatch`, fallback text `Something went wrong`, `Refresh Page`, `Try Again`, and development error details.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:109-125` — upstream wraps the dashboard provider/layout tree in `<ErrorBoundary>`.
  - `src/components/dashboard/error-boundary.tsx:64-89` — local exports class `DashboardErrorBoundary` with `getDerivedStateFromError`, `componentDidCatch`, reset state handling, and fallback rendering.
  - `src/components/dashboard/error-boundary.tsx:18-56` — local fallback renders `Something went wrong`, error message text, `Try again`, `Refresh page`, and dev-only stack details.
  - `src/components/dashboard/dashboard-shell.tsx:15-21` — local `DashboardShell` now wraps `<DashboardLayout ...>` in `<DashboardErrorBoundary>`.
  - `tests/dashboard-error-boundary.test.ts:11-33` — focused regression proves normal children render and fallback UI renders after captured render-error state. User-provided rerun proof: `npx vitest run tests/dashboard-error-boundary.test.ts` passed with 2 tests, and `npm run lint` passed.
- **why it matters to parity:** The previous local fallback component was not a live React error boundary around the dashboard tree. The target now matches the reference behavior class: render errors below the shell are caught and replaced by recovery UI instead of unmounting the whole app.
- **recommended fix direction:** Keep the class boundary and test. If strict visual parity is later required, tune fallback copy/casing/styling (`Refresh Page` vs `Refresh page`, Alert vs Card), but this is no longer a top functional dashboard blocker.

### 68. Right AI sidebar and floating toggle are now mounted in the live dashboard layout

- **status:** matched for layout mounting/toggle presence; partial for full upstream AI chat behavior
- **local file path(s):** `src/components/dashboard/dashboard-layout.tsx`, `src/components/dashboard/right-sidebar.tsx`, `src/components/dashboard/ai-chat-sidebar.tsx`, `src/components/dashboard/dashboard-providers.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/right-sidebar.tsx`, `/Users/junaid/code/next-keystone-starter/features/dashboard/components/dual-sidebar/ai-chat-sidebar.tsx`
- **exact cited evidence:**
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:58-79` — upstream `FloatingChatButton` uses right-sidebar state and toggles the right sidebar with a Sparkles/Chevron icon.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:84-92` — upstream dashboard content mounts `<RightSidebar side="right" />` and `<FloatingChatButton />`.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:109-125` — upstream provider stack includes `AiConfigProvider`, `ChatModeProvider`, and `SidebarProvider defaultOpenRight={false}`.
  - `src/components/dashboard/dashboard-layout.tsx:12-29` — local `FloatingChatButton` reads `rightOpen`, `rightOpenMobile`, `isMobile`, and `toggleSidebarWithSide` from `useSidebar()`, then renders a fixed round Sparkles/Chevron button.
  - `src/components/dashboard/dashboard-layout.tsx:42-48` — local live dashboard layout now renders `<RightSidebar side="right" />` and `<FloatingChatButton />` after the left sidebar and `SidebarInset`.
  - `src/components/dashboard/right-sidebar.tsx:7-15` — local right sidebar wraps `AiChatSidebar` in the shared `Sidebar`/`SidebarContent` shell.
  - `src/components/dashboard/dashboard-providers.tsx:23-27` — local provider stack already supplies `ChatModeProvider` and `SidebarProvider defaultOpenRight={false}` needed by the mounted right sidebar.
- **why it matters to parity:** The previous target had right-sidebar/AI chat components in the tree as dead code but did not mount them. The reference dashboard always mounts the right sidebar and floating assistant toggle in `DashboardLayoutContent`. The target now matches that shell-level behavior.
- **recommended fix direction:** Treat mount/toggle absence as fixed. Continue auditing AI chat behavior itself: upstream uses `useChat`, `DefaultChatTransport`, markdown rendering with GFM/breaks, shared-key lookup, CRUD-tool detection, and query invalidation, while local `AiChatSidebar` remains a simpler custom transport/rendering path.

### 69. Timestamp view now has dedicated date/time UI and Keystone-shaped value state, but filter/CardValue parity remains missing

- **status:** partial
- **local file path(s):** `src/components/dashboard/views/timestamp.tsx`, `src/components/dashboard/views/registry.tsx`
- **upstream file path(s):** `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx`
- **exact cited evidence:**
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx:28-40` — upstream `Value` is `{ kind: 'create'; value } | { kind: 'update'; value; initial }`.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx:68-85` — upstream validation allows null update values when initial was null, allows create default `{ kind: 'now' }`/`updatedAt`, and enforces required labels.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx:116-183` — upstream field renders formatted date/time picker UI, dirty-state validation, and a separate time input.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx:212-263` — upstream controller exposes `defaultValue`, `deserialize`, `serialize`, and `validate` around the same `Value` shape.
  - `/Users/junaid/code/next-keystone-starter/features/dashboard/views/timestamp/index.tsx:264-398` — upstream controller also exposes timestamp `filter` UI, GraphQL mapping, parseGraphQL, labels, and filter types.
  - `src/components/dashboard/views/timestamp.tsx:12-18` — local now defines the same create/update `Value` shape plus timestamp field metadata.
  - `src/components/dashboard/views/timestamp.tsx:80-96` — local validation now mirrors the upstream null-initial/default-now/updatedAt/required cases.
  - `src/components/dashboard/views/timestamp.tsx:119-183` — local field now renders formatted display plus native date and time inputs instead of the old single `datetime-local` input.
  - `src/components/dashboard/views/timestamp.tsx:200-220` — local controller now serializes/deserializes the Keystone-shaped timestamp value and validates it.
  - `src/components/dashboard/views/timestamp.tsx:222` — local `allowedExportsOnCustomViews` lists only `Cell` and `CardValue`, but the file does not export `CardValue`.
  - Local `src/components/dashboard/views/timestamp.tsx` currently has no `filter` object, while upstream exposes filter UI and GraphQL semantics at lines 264-398.
- **why it matters to parity:** The severe old timestamp blocker — a text-like `datetime-local` path with no Keystone-shaped controller state — is narrowed. But strict dashboard parity still lacks upstream timestamp filter controls/labels/GraphQL parse semantics and `CardValue` export parity.
- **recommended fix direction:** Keep the no-new-dependency native date/time implementation as an acceptable local adaptation if Calendar/Popover/date-fns are unavailable. Next timestamp-specific slice should add `CardValue` and controller `filter` parity, or explicitly document timestamp filters as deferred.

## Top 10 blockers by user impact

1. **Relationship sheet real pointer interaction remains broken** (items 63-65): devtools is now removed, parent has `onPointerDown`, and DOM `.click()` works, but ordinary user pointer/keyboard events still did not open/submit in live verification.
2. **Document field is not a real editor** (items 49-50, 57).
3. **Document-adjacent/text/number controller gaps remain; timestamp is narrowed but still lacks filter/CardValue parity** (items 51, 53, 54, 69).
4. **AI chat behavior remains simplified even though the right sidebar is now mounted** (items 8-10, 68).
5. **Relationship editor is a rewrite with metadata-shape drift** (items 44-45, 63-65).
6. **File/image view parity gaps** (items 47-48).
7. **Sidebar grouped/collapsed navigation regression** (items 12-13).
8. **Reset/signup/signin route action semantics diverge from upstream server actions** (items 17, 19, 21-22).
9. **Broader init/auth route parity still needs live cookie/redirect proof, but the create-then-sign-in sequence is now matched** (item 66).
10. **Error boundary visual/copy differences remain polish only; real class boundary is now present** (item 67).

## Stale claims in complete-parity-dissertation.md

- The scorecard entries `Dashboard shell and route surface | 75%`, `Dashboard list UX | 72%`, and `Dashboard create/item forms | 68%` are stale/over-optimistic for dashboard UI parity because they predate the browser-observed provider crash class and do not account for the 69 cited dashboard deltas above.
- The dissertation claim that route existence means the dashboard is substantially complete is stale for this audit. Route existence did not prevent provider crashes and does not cover field-controller parity.
- The dissertation correctly warned that image/file/document and field controllers lag, but it understates severity: document is a textarea shim, timestamp is now a richer native date/time implementation but still lacks filter/CardValue parity, and four numeric controllers are collapsed into one local view.
