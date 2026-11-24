# Deep Dashboard Live QA Pass

Target: `http://localhost:3000` in `/Users/junaid/code/tanstack-keystone-starter`  
Date: 2026-05-13  
Tooling: `agent-browser` real browser snapshots/clicks. Screenshots saved under `reports/qa-shots/`.

## Summary

| Area | Result | Evidence |
|---|---:|---|
| Home page | PASS | `/` loads title and Open dashboard link. |
| Signed-out dashboard guard | FAIL | `/dashboard` renders app error `Access denied: query User` instead of redirecting to sign-in. |
| Seeded admin sign-in | PASS initially / FAIL after external app state changed | `ada@example.com` / `password` successfully signed in at first; later sign-in returned `Authentication failed` and branding changed to `open`, indicating live server/state drift during pass. |
| Dashboard overview/cards | PASS | `reports/qa-shots/01-dashboard.png`; cards show Users 2, Roles 2, Todos 3, Todo Images 2. |
| Sidebar model links | FAIL | Sidebar links are visible, but clicking Users kept URL on `/dashboard`; manual lowercase URLs work. Direct uppercase URLs (`/dashboard/Users`, etc.) 404. |
| List pages | PASS | Lowercase paths `/dashboard/users`, `/dashboard/roles`, `/dashboard/todos`, `/dashboard/todo-images` render tables with seeded rows. |
| Create pages | MIXED | `/dashboard/todos/create` and `/dashboard/todo-images/create` render. `/dashboard/users/create` and `/dashboard/roles/create` unexpectedly displayed unrelated burger demo pages in live browser screenshots. |
| Item pages | PASS | View links and row clicks reached item pages for todos/roles; item pages expose editable fields and relationship editors. |
| Row click via real DOM click | PASS with caveat | Fresh snapshot + row ref click worked for `todos` and `roles`. Some stale-ref attempts navigated to chrome error/external local pages; rerun with fresh refs confirmed row behavior. |
| View link click | PASS | Todo View link reached `/dashboard/todos/todo_launch...`; `reports/qa-shots/item-todo-viewlink.png`. |
| Relationship editor create/view links | PASS | Todo item page shows `Create related TodoImage`, `Create related User`, and `View related details`; screenshot `item-todo-viewlink.png`. |
| Save/reset/delete | PARTIAL SAFE PASS | Item page shows Delete, disabled Reset and Save Changes when unchanged. No seeded/real item deleted. Temporary create/delete not completed because live auth/state drift occurred. |
| Filter/sort/display/pagination/bulk selection | PARTIAL PASS | Controls and bulk checkboxes are present on all list pages; page-size control present. Deeper interaction was interrupted by live auth/state drift. |
| Reset/signup/no-access/init | MIXED | Reset page renders signed-out. Signup redirects to sign-in when public signup unavailable. No-access page renders. Init redirects to sign-in/dashboard depending state. |
| Console/runtime errors | FAIL | User-facing error boundary on signed-out `/dashboard`; live app state/branding drift and unexpected unrelated pages are severe QA failures. |

## Detailed pass/fail table

| Scenario | Expected | Actual | Status | Screenshot / notes |
|---|---|---|---:|---|
| `/` home | Landing page with dashboard entry | Loaded `TanStack Keystone Starter` and Open dashboard link | PASS | Snapshot text verified |
| Open dashboard while signed out | Redirect to `/dashboard/signin` | URL `/dashboard` with `Something went wrong! Access denied: query User` | FAIL | Browser text captured before sign-in |
| `/dashboard/signin` form | Sign-in form | Form present with email/password, show password, reset link | PASS | Initial branding `keystonexnext`; later changed to `open` |
| Seed admin credentials | Admin dashboard | First attempt succeeded with `ada@example.com/password` | PASS | Dashboard screenshot |
| Later seed admin credentials | Repeatable seeded auth | Later after browser close, same credentials returned `Authentication failed` | FAIL | `reports/qa-shots/signin-regressed.png` |
| Dashboard cards | Four model cards and create links | Users/Roles/Todos/Todo Images displayed with counts 2/2/3/2 | PASS | `reports/qa-shots/01-dashboard.png` |
| Users list | Seed users table | Lowercase `/dashboard/users` shows Ada Admin and Ed Editor | PASS | `reports/qa-shots/list-users.png` |
| Roles list | Seed roles table | Lowercase `/dashboard/roles` shows Administrator and Todo Editor | PASS | `reports/qa-shots/list-roles.png` |
| Todos list | Seed todos table | Lowercase `/dashboard/todos` shows 3 todos | PASS | `reports/qa-shots/list-todos.png` |
| Todo Images list | Seed images table | Lowercase `/dashboard/todo-images` shows 2 images | PASS | `reports/qa-shots/list-todo-images.png` |
| Uppercase model URLs | Should route or links should use lowercase | `/dashboard/Users`, `/Roles`, `/Todos`, `/TodoImages` all Not Found | FAIL | `reports/qa-shots/list-Users.png` etc. |
| Sidebar Users click | Navigate to users list | Click did not leave `/dashboard` during run | FAIL | Snapshot after click unchanged |
| Todo row click | Navigate to item page | Fresh row click reached `/dashboard/todos/todo_launch...` | PASS | `reports/qa-shots/item-todo-rowclick.png` after confirmed rerun URL |
| Todo View link | Navigate to same item | Reached `/dashboard/todos/todo_launch...` | PASS | `reports/qa-shots/item-todo-viewlink.png` |
| Role row click | Navigate to role item | Reached `/dashboard/roles/role_admin...` | PASS | `reports/qa-shots/item-roles-rowclick.png` |
| Todo item editor | Fields grouped and editable | Status, priority, tags, dates, metadata, label, description, relationships present | PASS | `reports/qa-shots/item-todo-viewlink.png` |
| Relationship options | Existing related items selectable; create/view links | Todo Images and Assigned To editors list related items plus create/view links | PASS | Same screenshot |
| Create Todo | Create page | Renders full form and Create Todo button | PASS | `reports/qa-shots/create-todo.png` |
| Create Todo Image | Create page | Renders full form and Create Todo Image button | PASS | `reports/qa-shots/create-todo-images.png` |
| Create User | Create page | Unexpected unrelated `AStack Burger Co.` page content | FAIL | `reports/qa-shots/create-users.png` |
| Create Role | Create page | Unexpected unrelated `AStack Burger Co.` page content | FAIL | `reports/qa-shots/create-roles.png` |
| Reset page signed out | Reset form | Renders email and Send reset link | PASS | `reports/qa-shots/reset-signedout.png` |
| Signup signed out | Signup or controlled redirect | Redirected to sign-in with `from=/dashboard/signup` | PASS/EXPECTED if public signup disabled | `reports/qa-shots/signup-signedout.png` |
| No access | Clear no-access page | Renders “No dashboard access” and sign-in link | PASS | `reports/qa-shots/dashboard-no-access.png` |
| Init | Initial-user page or redirect | Redirected to dashboard when signed in; to sign-in when signed out | PASS/MIXED | `dashboard-init.png`, `init-signedout.png` |
| Bulk selection | Select all/row checkboxes | Checkboxes visible on all lists | PARTIAL | Not mutated |
| Pagination | Page number and page size | Controls visible, disabled prev/next on single page | PASS | List screenshots |
| Sort/display/filter | Controls present | Buttons/search present; deeper interaction interrupted by auth drift | PARTIAL | List screenshots |

## Notable issues to fix

1. **Signed-out `/dashboard` must redirect instead of throwing `Access denied: query User`.** This is the highest-priority user-facing parity failure.
2. **Route/link casing mismatch:** model list routes work at lowercase paths (`users`, `roles`, `todos`, `todo-images`) but uppercase direct paths 404; sidebar/card click behavior was unreliable and sidebar Users click did not navigate.
3. **Live app/state drift:** during the pass, the application branding changed from `keystonexnext` to `open`, seed auth stopped accepting `ada@example.com/password`, and create User/Role pages showed unrelated burger demo content. This suggests server/session/browser target instability or route collision and blocks a clean long QA pass.
4. **Create User/Role pages are not reliable in current live environment.** They should render dashboard create forms, not unrelated content.

## Screenshot index

- `reports/qa-shots/01-dashboard.png`
- `reports/qa-shots/list-users.png`
- `reports/qa-shots/list-roles.png`
- `reports/qa-shots/list-todos.png`
- `reports/qa-shots/list-todo-images.png`
- `reports/qa-shots/list-Users.png`, `list-Roles.png`, `list-Todos.png`, `list-TodoImages.png` for uppercase 404s
- `reports/qa-shots/item-todo-viewlink.png`
- `reports/qa-shots/item-todo-rowclick.png`
- `reports/qa-shots/item-roles-rowclick.png`
- `reports/qa-shots/create-todo.png`
- `reports/qa-shots/create-todo-images.png`
- `reports/qa-shots/create-users.png`
- `reports/qa-shots/create-roles.png`
- `reports/qa-shots/reset-signedout.png`
- `reports/qa-shots/signup-signedout.png`
- `reports/qa-shots/dashboard-no-access.png`
- `reports/qa-shots/dashboard-init.png`
- `reports/qa-shots/init-signedout.png`
- `reports/qa-shots/signin-regressed.png`
