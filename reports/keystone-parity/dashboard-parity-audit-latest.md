# Dashboard Parity Audit — Exhaustive Dashboard Reconciliation

Date: 2026-05-28

Scope: dashboard UI parity only. The source of truth is `/Users/junaid/code/next-keystone-starter/features/dashboard/**` and directly related local dashboard code in `/Users/junaid/code/tanstack-keystone-starter`. This audit intentionally does not use Keystone core internals as the dashboard UI target unless a dashboard file directly depends on them.

## Verdict

The dashboard is **not at full non-document dashboard parity**. The earlier CSS/root-shell and seeded-login blockers are fixed/narrowed, and the just-landed `ThemeProvider` fix removes the live browser crash path `dashboard-sidebar.tsx -> user-profile.tsx -> useTheme()`. However, a hostile dashboard reconciliation found many remaining concrete dashboard differences versus `next-keystone-starter`, including several user-impacting blockers.

The detailed 69-item cited ledger now lives at:

- `reports/keystone-parity/dashboard-exhaustive-difference-ledger.md`

## Current live evidence

### Fixed / narrowed

- Root shell/CSS: `src/routes/__root.tsx` imports `app/globals.css?url`, renders `HeadContent`, and renders `Scripts`.
- Live SSR `GET http://localhost:3001/dashboard/signin` returns 200 with stylesheet links, script tags, sign-in text, and no `Hello "__root"` placeholder.
- Live HTTP `POST /api/graphql` with `ada@example.com` / `password` returns 200, `UserAuthenticationWithPasswordSuccess`, and `set-cookie: keystonejs-session=...`.
- ThemeProvider crash: current `src/components/dashboard/dashboard-providers.tsx` wraps the dashboard tree in `ThemeProvider`; live browser routes after signin render instead of crashing with `useTheme must be used within ThemeProvider`.
- ToasterProvider crash class: current `src/components/dashboard/dashboard-providers.tsx` also wraps the dashboard tree in `ToasterProvider`; local list/create/item components call `useToast()`, whose hook throws without that provider.
- Relationship inline create sheet inert-button bug: current `src/components/dashboard/relationship-create-sheet.tsx` and `src/components/dashboard/relationship-edit-sheet.tsx` pass `disablePointerDismissal` to the controlled Base UI sheet root. Live browser verification on `/dashboard/users/user_admin` shows clicking `Create related Todo` now mounts a visible sheet dialog with `Create related Todo`, `Create Todo`, field controls, `Cancel`, and `Close`.
- Relationship sheet footer layout slice: both relationship sheets now use `form className="flex min-h-0 flex-1 flex-col overflow-hidden"`, `div className="min-h-0 flex-1 overflow-y-auto ..."`, and a `relative z-10 shrink-0` footer with native `type="submit"` buttons.
- TanStack Router Devtools removal: `src/routes/__root.tsx` now renders `<Outlet />` and `<Scripts />` only; it no longer imports or renders `TanStackRouterDevtools`. Live browser query found no `Open TanStack Router Devtools` button.
- Parent inline-create trigger fallback: `src/components/dashboard/relationship-field-editor.tsx` now has `openCreateRelated()`, an `onPointerDown` fallback, and `onClick={openCreateRelated}` on the parent `Create related ...` button.
- Init route contract: `src/routes/dashboard/init.tsx` now exports `createInitialUserAndSignIn(...)`, calls `createInitialUser`, then calls `authenticateUserWithPassword` with the same submitted credentials before redirect. `tests/dashboard-init-route.test.ts` proves both the two-call order and failure on follow-up sign-in failure. This matches the reference `InitPage` create-then-`signIn` sequencing.
- Dashboard error boundary: `src/components/dashboard/error-boundary.tsx` now exports a real class `DashboardErrorBoundary` with `getDerivedStateFromError` and `componentDidCatch`; `src/components/dashboard/dashboard-shell.tsx` wraps the live `<DashboardLayout>` tree in it. `tests/dashboard-error-boundary.test.ts` proves normal children render and fallback UI renders after captured render-error state, and the user-provided proof rerun `npx vitest run tests/dashboard-error-boundary.test.ts` passed with 2 tests plus `npm run lint` passed. This closes the previous functional ErrorBoundary blocker against upstream `features/dashboard/components/ErrorBoundary.tsx` + `DashboardLayout.tsx`.
- Right AI sidebar shell: `src/components/dashboard/dashboard-layout.tsx` now mounts `<RightSidebar side="right" />` and `<FloatingChatButton />`, using local right-sidebar state from `useSidebar()`. This matches the reference shell-level mount in `features/dashboard/components/DashboardLayout.tsx`; AI chat internals remain simpler than upstream.
- Timestamp view: `src/components/dashboard/views/timestamp.tsx` now uses Keystone-shaped create/update value state, validation matching the upstream null/default-now/updatedAt/required cases, formatted read display, and dedicated native date + time inputs. This removes the old single-`datetime-local` editor blocker. Remaining timestamp parity gaps are controller filter semantics and missing `CardValue` export.
- **Current live verification result remains negative:** ordinary pointer click still did not open the relationship sheet from the parent `Create related Todo` button, while direct DOM `openBtn.click()` did open it. The parent button is topmost at its center via `document.elementFromPoint(...)`, but `agent-browser click @e27` and raw mouse down/up did not record captured document pointer/click events. After DOM-opening the sheet, `document.elementFromPoint(...)` over the `Create Todo` button returned the actual submit button, but real pointer/keyboard activation attempts did not fire captured click/submit listeners and did not create the new related todo. Therefore the devtools overlay and missing `onPointerDown` were real issues to address, but the current live verification still shows an input-event delivery blocker.

### Still not complete

Live browser after signin now renders these routes/interactions:

- `/dashboard`
- `/dashboard/users`
- `/dashboard/users/create`
- `/dashboard/users/user_admin`
- `/dashboard/users/user_admin` renders and the TanStack devtools overlay is gone
- ordinary pointer click on `Create related Todo` still failed in the current live browser verification
- direct DOM `.click()` can open the controlled inline-create sheet, proving React state path exists, but real user pointer/keyboard submit remains broken

But rendering is not parity. The exhaustive ledger identifies missing shell features, provider differences, auth-flow divergences, list-control differences, and large field-view/controller gaps.

## Top 10 concrete dashboard blockers after the ThemeProvider fix

1. **Relationship sheet real pointer interaction remains broken.** The TanStack devtools overlay is removed and the parent trigger now has `onPointerDown`, but ordinary pointer click on parent `Create related Todo` still did not open the sheet or even reach captured document listeners; DOM `.click()` did. After DOM-opening, ordinary pointer/keyboard submit did not fire captured click/submit listeners or create the related todo.
2. **Document field is not a real editor.** Local `src/components/dashboard/views/document.tsx` is a textarea/JSON shim, while upstream uses `DocumentEditor`, Slate document state, component blocks, relationships, and validation.
3. **Text/number controller gaps remain; timestamp is narrowed but incomplete.** Local timestamp now has dedicated date/time UI and Keystone-shaped state, but lacks upstream timestamp filter semantics and `CardValue`; local text is still a basic input and integer/float/decimal/bigInt are collapsed into one generic number view.
4. **AI chat behavior remains simplified.** The right sidebar and floating toggle are now mounted, but local `AiChatSidebar` still does not match upstream `useChat`/`DefaultChatTransport`, markdown/GFM rendering, shared-key lookup, CRUD-tool detection, and query invalidation behavior.
5. **Relationship editor remains a broader parity risk.** Beyond the pointer bug, local relationship editor still differs from upstream metadata shape, cards/select/inline edit behavior, focus/close semantics, and rich relationship cell behavior.
6. **File/image view parity gaps.** Local maps `file` to `imageView`, and local image selection defaults to `config.path` instead of upstream image data selection including `id/url/extension/filesize/width/height`.
7. **Sidebar grouped/collapsed navigation regression.** Upstream has grouped/collapsible Models nav and icon-mode dropdown; local sidebar is flatter.
8. **Auth route action semantics diverge outside init.** Signin/signup/reset remain route-level GraphQL reimplementations rather than the upstream server-action flow; live seeded login works, and init sequencing is now matched, but strict behavior parity for the other auth routes is not proven.
9. **Init route still needs live cookie/redirect proof, but the prior create-then-sign-in ordering blocker is fixed.** The new helper and test prove sequencing; a full browser init-first-user run was not repeated in this pass.
10. **ErrorBoundary visual/copy drift is now polish only.** The functional class boundary exists and wraps the dashboard; remaining differences are Alert-vs-Card presentation and copy/casing.

## Reconciliation against `complete-parity-dissertation.md`

`reports/keystone-parity/complete-parity-dissertation.md` contains stale or under-qualified dashboard claims:

- The scorecard entries `Dashboard shell and route surface | 75%`, `Dashboard list UX | 72%`, and `Dashboard create/item forms | 68%` are now too optimistic unless interpreted as pre-browser-smoke implementation estimates.
- Route existence is not enough. The dashboard recently had a live provider crash despite the route surface existing, and the exhaustive ledger now shows many remaining field/controller/shell deltas.
- The dissertation correctly warned that image/file/document and field controllers lag, but it understates the severity for dashboard parity: document is not a real editor, text/number are simplified, timestamp is narrowed but still lacks filter/CardValue parity, and relationship/editor behavior is not a direct upstream port.
- Any claim that dashboard is now “only final manual visual/browser verification” is stale. That was true only for the narrow CSS/login suspicion; the broader dashboard parity ledger has concrete remaining blockers.

## Next recommended fix order

1. **Fix real pointer interaction for controlled relationship sheets.** DOM `.click()` is not enough; the dashboard needs ordinary mouse/pointer open and submit to work. Devtools is removed and the parent trigger now has `onPointerDown`, so the next investigation should start at why real pointer events are not reaching document capture listeners at all. Inspect browser/session state, CSS/global overlays, modal inerting/focus guards, pointer-events CSS, and Base UI Dialog/Sheet behavior. Add a regression that first asserts captured pointer/click events reach the trigger, then asserts sheet open and native submit.
2. **Run a console-clean live shell pass** after the provider/error-boundary/right-sidebar fixes to ensure the wrapper does not hide recurring runtime errors.
3. **Decide document parity:** either keep document field explicitly deferred/broken, or start porting upstream `DocumentEditor` and Slate state.
4. **Field controller cleanup:** add timestamp `CardValue` and filter semantics, then split/align text and numeric controllers if document remains deferred.
5. **If AI parity remains in scope, port the chat internals**: upstream `useChat` transport, markdown/GFM rendering, shared-key path, CRUD-tool detection, and query invalidation.
5. **Auth-route cleanup after init:** init ordering is fixed, so remaining auth work should focus on signin/signup/reset server-action semantic drift and live cookie/redirect proof.

## Evidence files

- Exhaustive 69-item cited ledger: `reports/keystone-parity/dashboard-exhaustive-difference-ledger.md`
- Prior broad dissertation with stale dashboard claims: `reports/keystone-parity/complete-parity-dissertation.md`
- Local live evidence from this pass: browser snapshots of `/dashboard`, `/dashboard/users`, `/dashboard/users/create`, `/dashboard/users/user_admin`, plus HTTP signin/auth checks.
