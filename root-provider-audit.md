# Code Context

## Files Retrieved
1. `src/components/dashboard/dashboard-layout.tsx` (lines 1-22) - local dashboard layout entry; shows shell composition is minimal and delegates to `DashboardProviders`.
2. `src/components/dashboard/dashboard-providers.tsx` (lines 1-40) - local provider stack; critical for parity on dashboard root providers.
3. `src/components/dashboard/dashboard-shell.tsx` (lines 1-18) - local dashboard shell; fetches overview via React Query and wraps content in layout.
4. `src/components/dashboard/error-boundary.tsx` (lines 1-56) - local dashboard-specific fallback UI, but not actually wired at the route root.
5. `src/components/ui/theme-provider.tsx` (lines 1-63) - local custom theme context/provider.
6. `src/components/ui/toaster.tsx` (lines 1-73) - local toast provider/hook implementation.
7. `src/components/dashboard/ai-config.tsx` (lines 1-90) - local AI config provider behavior.
8. `src/components/dashboard/dashboard-provider.tsx` (lines 1-13) - local dashboard context provider.
9. `src/features/query-client.tsx` (lines 1-29) - local app-level query client config + SSR router integration.
10. `src/router.tsx` (lines 1-27) - local router creates a single app-wide `QueryClient`.
11. `src/routes/__root.tsx` (lines 1-38) - local app root; no dashboard-scoped provider/error wiring here either.
12. `src/routes/dashboard.tsx` (lines 1-47) - local dashboard route root; wraps with `DashboardShell`, no dashboard error boundary/provider for toasts.
13. `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx` (lines 1-139) - upstream dashboard app shell/provider root.
14. `../next-keystone-starter/features/dashboard/providers/QueryProvider.tsx` (lines 1-31) - upstream dashboard-local query provider.
15. `../next-keystone-starter/features/dashboard/components/ErrorBoundary.tsx` (lines 1-80) - upstream class error boundary actually wrapping dashboard layout.
16. `../next-keystone-starter/features/dashboard/context/DashboardProvider.tsx` (lines 1-46) - upstream dashboard context provider.
17. `../next-keystone-starter/features/dashboard/hooks/use-ai-config.tsx` (lines 1-242) - upstream AI config provider; richer than local.
18. `../next-keystone-starter/features/dashboard/lib/queryClient.ts` (lines 1-44) - upstream dashboard-local query client defaults.
19. `../next-keystone-starter/features/dashboard/hooks/useAdminMeta.tsx` (lines 47-80) - upstream `AdminMetaProvider`, missing from local root stack.

## Key Code

### 1. Local dashboard root is missing upstream’s dashboard-owned shell responsibilities

Local shell only fetches overview and renders a thin layout:

- `src/components/dashboard/dashboard-shell.tsx:7-17`
- `src/components/dashboard/dashboard-layout.tsx:16-20`

```tsx
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { data } = useSuspenseQuery({
    queryKey: dashboardQueryKeys.overview,
    queryFn: () => fetchDashboardOverview(),
  })

  return (
    <DashboardLayout user={data.authenticatedItem} lists={data.lists}>
      {children}
    </DashboardLayout>
  )
}
```

Upstream `DashboardLayout` is the real shell and includes error boundary, query provider, admin-meta provider, chat state, sidebar plumbing, and right sidebar/chat affordance:

- `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:117-135`
- `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:83-92`
- `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:58-80`

```tsx
export function DashboardLayout({ children, adminMeta, authenticatedItem }: DashboardLayoutProps) {
  return (
    <ErrorBoundary>
      <QueryProvider>
        <DashboardProvider>
          <AdminMetaProvider initialData={adminMeta}>
            <AiConfigProvider>
              <ChatModeProvider user={authenticatedItem}>
                <SidebarProvider defaultOpenRight={false}>
                  <DashboardLayoutContent adminMeta={adminMeta} authenticatedItem={authenticatedItem}>
                    {children}
                  </DashboardLayoutContent>
                </SidebarProvider>
              </ChatModeProvider>
            </AiConfigProvider>
          </AdminMetaProvider>
        </DashboardProvider>
      </QueryProvider>
    </ErrorBoundary>
  )
}
```

**Difference:** local split the shell into TanStack Router + app-global query setup, but in doing so dropped several upstream dashboard-owned root concerns entirely: `ErrorBoundary`, `AdminMetaProvider`, `RightSidebar`, and `FloatingChatButton`.

### 2. Local provider stack is not parity with upstream, and it is internally broken for toast consumers

Local provider stack:

- `src/components/dashboard/dashboard-providers.tsx:30-39`

```tsx
<DashboardProvider>
  <AiConfigProvider>
    <ThemeProvider>
      <DashboardProvidersContent user={user}>{children}</DashboardProvidersContent>
    </ThemeProvider>
  </AiConfigProvider>
</DashboardProvider>
```

Nested local content adds only chat mode + sidebar:

- `src/components/dashboard/dashboard-providers.tsx:13-27`

Upstream provider stack:

- `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:119-135`

```tsx
<ErrorBoundary>
  <QueryProvider>
    <DashboardProvider>
      <AdminMetaProvider initialData={adminMeta}>
        <AiConfigProvider>
          <ChatModeProvider user={authenticatedItem}>
            <SidebarProvider defaultOpenRight={false}>
              ...
            </SidebarProvider>
          </ChatModeProvider>
        </AiConfigProvider>
      </AdminMetaProvider>
    </DashboardProvider>
  </QueryProvider>
</ErrorBoundary>
```

**Concrete misses in local stack:**
- No dashboard-root `ErrorBoundary` wrapper.
- No dashboard-root `AdminMetaProvider` equivalent.
- No `QueryProvider` because local uses app-global router `QueryClient` instead.
- Added local `ThemeProvider`, which upstream dashboard feature does not provide here.
- **No `ToasterProvider` anywhere in dashboard root despite many consumers calling `useToast()`.**

Toast hook hard-requires a provider:
- `src/components/ui/toaster.tsx:69-72`

```tsx
export function useToast() {
  const context = useContext(ToasterContext)
  if (!context) throw new Error('useToast must be used within ToasterProvider')
  return context
}
```

But local dashboard root never mounts `ToasterProvider`:
- `src/components/dashboard/dashboard-providers.tsx:30-39`
- `src/routes/__root.tsx:25-35`
- `src/routes/dashboard.tsx:36-46`

And multiple dashboard screens/components consume `useToast`, e.g.:
- `src/routes/dashboard/$listKey.create.tsx:14,38`
- `src/routes/dashboard/$listKey.$id.tsx:27,57,314`
- `src/components/dashboard/keystone-list-table.tsx:9,51`
- `src/components/dashboard/relationship-create-sheet.tsx:9,27`
- `src/components/dashboard/relationship-edit-sheet.tsx:9,29`

**Hostile conclusion:** local dashboard toast plumbing is dead-on-arrival unless some non-dashboard root elsewhere mounts `ToasterProvider`. In the audited dashboard root/app-shell lane, it does not.

### 3. Local replaced upstream sonner-based notifications with a custom toaster, but never integrated it

Upstream dashboard uses `sonner` directly inside components, not a custom provider:
- `../next-keystone-starter/features/dashboard/screens/ItemPage/ItemPageClient.tsx:38`
- `../next-keystone-starter/features/dashboard/components/ListTable.tsx:11`
- `../next-keystone-starter/features/dashboard/views/relationship/client/components/InlineCreate.tsx:5`
- `../next-keystone-starter/features/dashboard/views/relationship/client/components/InlineEdit.tsx:5`

Local migrated to `useToast()` in dashboard routes/components:
- `src/routes/dashboard/$listKey.create.tsx:14,38`
- `src/routes/dashboard/$listKey.$id.tsx:27,57,314`
- `src/components/dashboard/keystone-list-table.tsx:9,51`

But local only defines the provider/hook in `src/components/ui/toaster.tsx:22-67` and never mounts it in the audited root shell/provider chain.

**Difference:** upstream had functioning notification calls via `sonner`; local attempted a provider-based abstraction but failed to wire the root provider. That is a regression, not a stylistic variation.

### 4. Error boundary parity is fake: local has a fallback component, upstream actually wraps the dashboard

Local defines a functional boundary-ish fallback component:
- `src/components/dashboard/error-boundary.tsx:16-56`

But no audited dashboard root file uses it:
- `src/components/dashboard/dashboard-layout.tsx:1-22`
- `src/components/dashboard/dashboard-providers.tsx:1-40`
- `src/routes/dashboard.tsx:36-46`

Upstream actually wraps the entire dashboard layout in a class error boundary:
- `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:119-135`
- `../next-keystone-starter/features/dashboard/components/ErrorBoundary.tsx:22-80`

The upstream boundary is a real React error boundary class (`extends Component`) using `getDerivedStateFromError` and `componentDidCatch`:
- `../next-keystone-starter/features/dashboard/components/ErrorBoundary.tsx:22-34`

**Difference:** local has fallback UI code but no actual error boundary wiring in the dashboard shell. Worse, the local `DashboardErrorBoundary` component itself is not a React error boundary class; it expects `{ error, reset }` props and therefore only works if some route-level error API explicitly renders it. The audited dashboard root does not do that.

### 5. Query provider parity changed from dashboard-owned provider to app-global router integration

Upstream dashboard owns its own query client instance through `QueryProvider`:
- `../next-keystone-starter/features/dashboard/providers/QueryProvider.tsx:17-30`

```tsx
const [queryClient] = useState(() => createQueryClient())
return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
```

Local instead creates the `QueryClient` at app router creation time and injects it through TanStack Router context:
- `src/router.tsx:6-20`
- `src/features/query-client.tsx:6-29`

```tsx
const queryClient = createAppQueryClient()
const router = createTanStackRouter({
  ...,
  context: { queryClient },
})
installQueryIntegration({ router, queryClient })
```

This is an architectural divergence, not automatically a bug. But it has two parity consequences:

1. **Dashboard no longer owns its query boundary/configuration** the way upstream does.
2. Local query defaults do not match upstream defaults.

Local defaults:
- `src/features/query-client.tsx:8-14`
  - `staleTime: 30_000`
  - `gcTime: 5 * 60_000`
  - `retry: 1`

Upstream defaults:
- `../next-keystone-starter/features/dashboard/lib/queryClient.ts:10-38`
  - `staleTime: 5 * 60 * 1000`
  - `gcTime: 10 * 60 * 1000`
  - custom `retry` up to 3, except 4xx
  - `retryDelay`
  - `refetchOnWindowFocus: false`
  - `refetchOnReconnect: true`
  - mutation defaults

**Difference:** local query behavior is materially less sticky, retries less, and omits upstream reconnect/focus/mutation settings.

### 6. Admin meta provider parity is missing at the shell root

Upstream dashboard root includes `AdminMetaProvider initialData={adminMeta}`:
- `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:121-123`

Provider implementation:
- `../next-keystone-starter/features/dashboard/hooks/useAdminMeta.tsx:55-80`

Local dashboard root has no equivalent provider in `DashboardProviders` or `DashboardShell`:
- `src/components/dashboard/dashboard-providers.tsx:30-39`
- `src/components/dashboard/dashboard-shell.tsx:7-17`

Local seems to bypass this by fetching overview directly and passing only `user` and `lists` into layout:
- `src/components/dashboard/dashboard-shell.tsx:8-15`

**Difference:** upstream root establishes a reusable admin-meta context for descendants; local root does not. Even if local descendants no longer rely on that exact context, this is still a direct shell/provider parity break.

### 7. Theme handling is a local-only addition, not upstream parity

Local injects `ThemeProvider` inside dashboard providers:
- `src/components/dashboard/dashboard-providers.tsx:33-36`

Local custom theme provider mutates `document.documentElement` classes and stores `dashboard-theme` in localStorage:
- `src/components/ui/theme-provider.tsx:23-56`

Upstream dashboard root does **not** mount any `ThemeProvider` in `components/DashboardLayout.tsx:119-135`, and the feature tree audit found no dashboard-local theme provider counterpart under `../next-keystone-starter/features/dashboard`.

**Difference:** local added bespoke dashboard theme state not present in upstream dashboard feature root. That may be acceptable product work, but it is not parity.

### 8. AI config provider is narrowed locally versus upstream

Local AI config is server-only and much simpler:
- `src/components/dashboard/ai-config.tsx:3-9`
- `src/components/dashboard/ai-config.tsx:17-22`

```ts
export type AiKeyMode = 'server'
export type AiConfig = {
  enabled: boolean
  completionEndpoint: string
  keyMode: AiKeyMode
}
```

Upstream supports `env | local`, provider/model/api-key/custom-endpoint persistence, and nested-provider passthrough:
- `../next-keystone-starter/features/dashboard/hooks/use-ai-config.tsx:5-18`
- `../next-keystone-starter/features/dashboard/hooks/use-ai-config.tsx:44-65`
- `../next-keystone-starter/features/dashboard/hooks/use-ai-config.tsx:189-194`

**Difference:** local AI provider is intentionally reduced. For root/provider parity, local is not equivalent to upstream.

### 9. Sidebar shell is simplified; upstream right-sidebar/chat shell is gone

Local layout renders only left sidebar + inset:
- `src/components/dashboard/dashboard-layout.tsx:16-20`

Upstream layout content renders left sidebar, inset, right sidebar, and floating chat button:
- `../next-keystone-starter/features/dashboard/components/DashboardLayout.tsx:83-92`

**Difference:** local dashboard root shell is visually and behaviorally thinner than upstream feature shell.

## Architecture

Local dashboard architecture in this lane:
- App root (`src/routes/__root.tsx`) only renders `Outlet`, devtools, and scripts.
- Router setup (`src/router.tsx`) creates a single app-wide `QueryClient` and installs TanStack SSR query integration.
- Dashboard route root (`src/routes/dashboard.tsx`) uses auth redirects in `beforeLoad`, then wraps non-auth routes in `DashboardShell`.
- `DashboardShell` fetches overview via React Query and passes only `authenticatedItem` and `lists` to `DashboardLayout`.
- `DashboardLayout` delegates providers to `DashboardProviders`, then renders left sidebar + content inset.
- `DashboardProviders` mounts `DashboardProvider`, `AiConfigProvider`, `ThemeProvider`, `ChatModeProvider`, and `SidebarProvider`.

Upstream dashboard architecture:
- `components/DashboardLayout.tsx` is the true dashboard shell root.
- It mounts `ErrorBoundary -> QueryProvider -> DashboardProvider -> AdminMetaProvider -> AiConfigProvider -> ChatModeProvider -> SidebarProvider`.
- The same file also renders root shell furniture: left sidebar, right AI sidebar, floating chat button, and content inset.

The biggest parity break is not just reorganization; it is that local omitted upstream root responsibilities while also introducing a new toast provider abstraction that is not mounted.

## Start Here

Open `src/components/dashboard/dashboard-providers.tsx` first.

Why:
- It is the narrowest choke point for most root-parity issues.
- It proves the missing `ToasterProvider`, missing `AdminMetaProvider`, missing error-boundary wiring, and local-only `ThemeProvider` addition.
- Any repair to dashboard provider parity likely starts there, then fans out to `src/routes/dashboard.tsx`, `src/components/dashboard/dashboard-layout.tsx`, and possibly `src/router.tsx` depending on whether app-global query ownership is kept.
