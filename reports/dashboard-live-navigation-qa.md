# Dashboard live navigation QA

Date: 2026-05-12
App under test: `/Users/junaid/code/tanstack-keystone-starter`
Browser target: `https://tanstack.local` returned HTTP 502, so I used the already-running dev server on `http://localhost:3000` (node listening on localhost:3000). No code was modified.
Seeded login tested: `ada@example.com` / `password`.
Screenshot captured: `reports/dashboard-list.png`.

## Summary verdict

The dashboard can authenticate and render the dashboard/list pages with seeded memory data, but most dashboard navigation links are effectively inert after the app has loaded. Clicking list cards, sidebar list links, table rows, item id links, View links, relationship links, and Create buttons does not change the URL. Directly entering item/create URLs also does not render item/create routes; instead the parent list route remains active and appends list search params.

Likely root cause: the generated TanStack Router route tree contains `/$listKey` before static `/init`, `/reset`, `/signin`, `/signup`, etc. and before child routes; the dynamic list route greedily matches nested paths such as `/dashboard/users/create` and `/dashboard/users/user_admin`. Combined with links using TanStack Router `Link`/`navigate`, attempted navigations are resolved back to the currently-matched parent list route, preserving `?page=1&search=&sortBy=&fields=`. The create and item route files exist, but they are not reached in the live app.

## Tested flows and exact URL transitions

### Entry and login

1. `https://tanstack.local` -> HTTP 502 from portless proxy.
2. `http://localhost:3000/` renders landing page.
3. Click `Open dashboard`:
   - `http://localhost:3000/` -> `http://localhost:3000/dashboard/signin?from=%2Fdashboard`
4. Fill email/password and click `Sign in`:
   - `http://localhost:3000/dashboard/signin?from=%2Fdashboard` -> `http://localhost:3000/dashboard`
5. Dashboard renders 4 model cards:
   - Users: 2 items
   - Roles: 2 items
   - Todos: 3 items
   - Todo Images: 2 items

### Dashboard cards and sidebar model links

From `http://localhost:3000/dashboard`:

- Click dashboard card link `Users 2 items`:
  - expected: `/dashboard/users`
  - actual: stayed at `http://localhost:3000/dashboard`
- Click sidebar `Users` link:
  - expected: `/dashboard/users`
  - actual: stayed at `http://localhost:3000/dashboard`

Direct navigation to the list URL does work:

- Open `http://localhost:3000/dashboard/users`:
  - actual URL becomes `http://localhost:3000/dashboard/users?page=1&search=&sortBy=&fields=`
  - Users list renders correctly with table rows for `user_admin` and `user_editor`.

### List rows, item links, View links

From `http://localhost:3000/dashboard/users?page=1&search=&sortBy=&fields=`:

- Click first table row (`user_admin`):
  - expected: `/dashboard/users/user_admin`
  - actual: stayed at `http://localhost:3000/dashboard/users?page=1&search=&sortBy=&fields=`
- Click `View` link for `user_admin`:
  - expected: `/dashboard/users/user_admin`
  - actual: stayed at `http://localhost:3000/dashboard/users?page=1&search=&sortBy=&fields=`
- Direct open `http://localhost:3000/dashboard/users/user_admin`:
  - actual URL becomes `http://localhost:3000/dashboard/users/user_admin?page=1&search=&sortBy=&fields=`
  - actual content is still the Users list page, not an item page.

From `http://localhost:3000/dashboard/todos?page=1&search=&sortBy=&fields=`:

- Rows render for `todo_launch`, `todo_docs`, `todo_private`.
- Click relationship link `Ada Admin` in the Assigned To column:
  - expected: `/dashboard/users/user_admin` (or equivalent related item URL)
  - actual: stayed at `http://localhost:3000/dashboard/todos?page=1&search=&sortBy=&fields=`
- Direct open `http://localhost:3000/dashboard/todos/todo_launch`:
  - actual URL becomes `http://localhost:3000/dashboard/todos/todo_launch?page=1&search=&sortBy=&fields=`
  - actual content is still the Todos list page, not an item page.

### Create links/routes

From `http://localhost:3000/dashboard/users?page=1&search=&sortBy=&fields=`:

- Click `Create User`:
  - expected: `/dashboard/users/create`
  - actual: stayed at `http://localhost:3000/dashboard/users?page=1&search=&sortBy=&fields=`
- Direct open `http://localhost:3000/dashboard/users/create`:
  - actual URL becomes `http://localhost:3000/dashboard/users/create?page=1&search=&sortBy=&fields=`
  - actual content is still Users list page, not create form.

Create route file exists at `src/routes/dashboard/$listKey.create.tsx` and appears to implement a create form and mutation, but it is not reached in the running app.

### Item edit page actions

Because direct item URLs render the list route, I could not reach a real item edit page. Therefore these controls could not be functionally tested in browser:

- Save
- Reset
- Delete
- Item relationship editor controls

The item route file currently contains only a placeholder:

```tsx
// src/routes/dashboard/$listKey.$id.tsx
function RouteComponent() {
  return <div>Hello "/dashboard/$listKey/$id"!</div>
}
```

Even after route matching is fixed, the item edit page will still need real implementation to match next-keystone-starter behavior.

### Signup/reset/init/no-access redirects while signed in

With Ada signed in:

- Open `/dashboard/signup` -> redirected/rendered `/dashboard`
- Open `/dashboard/reset` -> redirected/rendered `/dashboard`
- Open `/dashboard/init` -> redirected/rendered `/dashboard`
- Open `/dashboard/no-access` -> stayed at `/dashboard/no-access` and rendered the no-access message.

## Console / GraphQL errors observed

Console output included normal Vite/React messages plus these relevant errors/warnings:

- `Access denied: query User` in `<DashboardShell>` occurred when visiting `/dashboard/no-access` while signed in. This appears to be caused by the shell/sidebar still querying dashboard admin/user data on a route intended to show no access.
- Repeated React warning/error: `React does not recognize the nativeButton prop on a DOM element...` This is likely from Button composition usage such as `nativeButton={false}` being forwarded to DOM elements.

No explicit network/GraphQL error was observed for item/create clicks; the click failures look like client-side routing/matching issues rather than failed GraphQL requests.

## Likely file-level causes and fixes

### 1. Route tree ordering / route matching

Relevant files:

- `src/routeTree.gen.ts`
- `src/routes/dashboard/$listKey.tsx`
- `src/routes/dashboard/$listKey.create.tsx`
- `src/routes/dashboard/$listKey.$id.tsx`
- `vite.config.ts` / TanStack Router plugin config if route generation is configured there

The generated route tree currently defines and registers `DashboardListKeyRoute` (`/$listKey`) before static dashboard routes and before its `create`/`$id` children. Live behavior shows this dynamic route captures nested paths like `/dashboard/users/create` and `/dashboard/users/user_admin`, causing the list route loader/search validation to run and add list query params.

Recommended fix:

- Regenerate/fix TanStack Router route tree so specific/static and child routes are matched before the greedy `/$listKey` route.
- Verify file-route naming for nested routes. If needed, prefer directory routes such as:
  - `src/routes/dashboard/$listKey/index.tsx` for list
  - `src/routes/dashboard/$listKey/create.tsx` for create
  - `src/routes/dashboard/$listKey/$id.tsx` for item
  rather than flat files that may be generating an order/path ambiguity.
- After route generation, confirm direct URLs render correct components:
  - `/dashboard/users` -> list
  - `/dashboard/users/create` -> create form
  - `/dashboard/users/user_admin` -> item page

### 2. Inert `<Link>`/`navigate` clicks

Relevant files:

- `src/components/dashboard/list-card.tsx`
- `src/components/dashboard/dashboard-sidebar.tsx`
- `src/components/dashboard/filter-bar.tsx`
- `src/components/dashboard/keystone-list-table.tsx`
- `src/components/dashboard/relationship-field-editor.tsx`
- `src/components/ui/button.tsx`

The links are present in the accessibility tree, but clicks do not update the URL in the live app. This likely falls out of the same route resolution issue. Also inspect Button composition: several links are rendered through `Button render={<Link ... />}` with a nonstandard `nativeButton` prop. The `nativeButton` prop is leaking to DOM and may indicate the local Button API does not match its callers.

Recommended fix:

- Once route matching is fixed, retest all links.
- Ensure Button supports `nativeButton={false}` without forwarding it to DOM, or remove/replace that prop according to the actual Button component API.
- For row `onClick`, keep using `navigate({ to: '/dashboard/$listKey/$id', params: ... })`, but verify the route exists and resolves after route tree regeneration.

### 3. Missing item edit implementation

Relevant file:

- `src/routes/dashboard/$listKey.$id.tsx`

This route is currently a placeholder. Implement a Keystone-like item detail/edit page that:

- loads item + admin meta by list path and id;
- renders editable fields according to `itemView.fieldMode`/field access;
- supports relationship links/editors;
- implements Save, Reset, Delete;
- redirects after delete back to the list page;
- handles access/not-found GraphQL errors.

### 4. No-access route still querying User

Relevant files:

- `src/routes/dashboard.tsx`
- `src/components/dashboard/dashboard-shell.tsx`
- `src/features/cms/dashboard-auth.ts`

`/dashboard/no-access` should not require dashboard list/user queries that can throw `Access denied: query User`. Consider making the shell skip admin-meta/user queries on auth routes and no-access routes, or render a minimal auth/no-access layout before the dashboard shell.

## Minimal reproduction

1. Start seeded dev server (already running in this QA): `CMS_ADAPTER=memory CMS_BOOTSTRAP_MODE=seeded npm run dev`.
2. Open `http://localhost:3000/dashboard`.
3. Sign in as `ada@example.com` / `password`.
4. Click dashboard card `Users 2 items`.
   - Actual: remains `/dashboard`.
5. Directly open `http://localhost:3000/dashboard/users`.
6. Click the `user_admin` row or `View` link.
   - Actual: remains `/dashboard/users?page=1&search=&sortBy=&fields=`.
7. Click `Create User`.
   - Actual: remains `/dashboard/users?page=1&search=&sortBy=&fields=`.
8. Directly open `http://localhost:3000/dashboard/users/create` or `/dashboard/users/user_admin`.
   - Actual: the URL includes the nested path, but the Users list page renders and appends list search params.
