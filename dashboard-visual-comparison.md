# Dashboard visual comparison: original Next Keystone vs current TanStack dashboard

Date: 2026-05-12

## Scope and method

- **Original source app:** `/Users/junaid/code/next-keystone-starter`
- **Current target app:** `/Users/junaid/code/tanstack-keystone-starter`
- **Current app URL tested:** `http://localhost:3001/dashboard`
- **Credentials used for both apps:** `ada@example.com` / `password`
- **No source files were edited.** This report is the only intended artifact.

### Original app run status

The original Next Keystone dashboard was not already running. Its `.env` pointed at PostgreSQL port `5426`, but no server was listening there. I was able to run the built original app for inspection by:

1. Using the existing `next-keystone-starter/.next` build.
2. Applying the original repo's existing Prisma migrations to a temporary PostgreSQL database on the already-running local PostgreSQL server at `localhost:55432`.
3. Seeding equivalent demo rows for Roles, Users, Todos, and Todo Images so counts/content match the current target app.
4. Starting `next start` on `http://localhost:3100`.
5. Capturing browser snapshots/screenshots, then stopping that temporary server.

Because this used the original code and original migrations but a temporary seeded database, the visual/DOM comparison should be treated as a faithful UI structure comparison against the shared sample data, not as evidence about the user's original production database.

### Screenshot artifacts captured

The browser screenshots were saved by `agent-browser` under `/tmp`:

| Route/state | Original screenshot | Current screenshot |
|---|---|---|
| Sign-in | `/tmp/original-signin-full.png` | `/tmp/current-signin-latest-full.png` |
| Dashboard home | `/tmp/original-dashboard-full.png` | `/tmp/current-dashboard-latest-full.png` |
| Users list | `/tmp/original-users-full.png` | `/tmp/current-users-latest-full.png` |
| Todos list | `/tmp/original-todos-full.png` | `/tmp/current-todos-latest-full.png` |
| Create User | `/tmp/original-create-user-full.png` | `/tmp/current-create-user-latest-full.png` |
| User item detail | `/tmp/original-item-user-full.png` | `/tmp/current-item-user-latest-full.png` |
| Authless reset | `/tmp/original-authless-reset-full.png` | current redirects to sign-in |

All screenshots above were captured at `1280px` wide. Most are `1280x633`; the original User item detail full-page capture was `1280x654`.

## High-level verdict

The current TanStack dashboard is now **visually close on the authenticated dashboard home and list table routes**, but still diverges significantly from the original Next Keystone dashboard in route coverage and interactive Admin UI behavior.

Strong matches:

- Auth guard redirects unauthenticated `/dashboard` to `/dashboard/signin?from=%2Fdashboard`.
- Authenticated home page shows the same model set and counts: Users `2`, Roles `2`, Todos `3`, Todo Images `2`.
- Left dashboard shell, logo, model cards, breadcrumb header, table layout, row checkboxes, `View` links, user profile footer, and page-size pagination are all present in the current app.

Main gaps:

- Current `/dashboard/signin` is a simplified seed-login card, not the original branded auth screen with logo, sign-up/reset links, and password visibility toggle.
- Current list `Filter`, `Sort`, and `Display` buttons are visible but disabled; original opens real controls.
- Current search fields are narrower than original Keystone metadata-driven search placeholders.
- Current table cell rendering differs for relationships, multiselect labels, booleans, and default sort/order.
- Current `Create` and `View` links currently route to **Not Found**. The file `src/routes/dashboard/$listKey.create.tsx` exists, but it is incomplete/truncated and is not registered in `src/routeTree.gen.ts`; no item detail route is registered either.
- Original right AI Assistant sidebar is a real visible sidebar; current only has a floating placeholder button titled `AI chat sidebar coming next`.
- Original reset route exists for unauthenticated users; current reset/signup paths redirect to sign-in when unauthenticated and show Not Found when treated as dashboard child routes after auth.

## Route-by-route comparison

### 1. Sign-in route

#### Original: `http://localhost:3100/dashboard/signin`

Interactive snapshot:

```text
- heading "keystonexnext" [level=1]
- heading "Sign in to your account" [level=3]
- link "Sign up"
- textbox "Email" [required]
- textbox "Password" [required]
- button [password visibility toggle]
- button "Sign in"
- link "Reset password"
- region "Notifications alt+T"
```

Visible text:

```text
keystonexnext
Sign in to your account

Don't have an account?Sign up

Email
Password
Sign in

Forgot your password?Reset password
```

Visual structure:

- Centered narrow auth form.
- Branded `keystonexnext` logo above the form.
- Heading: `Sign in to your account`.
- Sign-up prompt and reset-password link are part of the page.
- Password field has an eye/visibility toggle.
- Sonner/toaster live region exists in the DOM.

#### Current: `http://localhost:3001/dashboard/signin`

Interactive snapshot:

```text
- textbox "Email" [required]: ada@example.com
- textbox "Password" [required]: ••••••••
- button "Sign in"
- button "Back to dashboard"
- button "Open TanStack Devtools"
```

Visible text:

```text
Dashboard sign in
Sign in with the Keystone-compatible auth mutation. Seeded memory-mode credentials are ada@example.com / password.
Email
Password
Sign inBack to dashboard
```

Differences:

- Current is a generic card, not the original branded auth page.
- Current pre-fills seed credentials; original starts blank.
- Current lacks `keystonexnext` logo, sign-up link, reset link, password visibility toggle, and toaster region.
- Current exposes TanStack Devtools in the DOM.

### 2. Authenticated dashboard home

#### Original: `http://localhost:3100/dashboard`

Interactive snapshot excerpt:

```text
- heading "keystonexnext" [level=1]
- link "Dashboard"
- button "Models" [expanded=false]
- button "AA Ada Admin ada@example.com" [expanded=false]
- button "Toggle Sidebar"
- navigation "breadcrumb"
  - link "Dashboard" [disabled]
- heading "Dashboard" [level=1]
- heading "DATA MODELS" [level=2]
- link "Users 2 items"
  - heading "Users" [level=3]
- link "Create new Users"
  - button "Create new Users"
- link "Roles 2 items"
- link "Create new Roles"
- link "Todos 3 items"
- link "Create new Todos"
- link "Todo Images 2 items"
- link "Create new Todo Images"
- heading "AI Assistant" [level=3]
- heading "Hi Ada Admin," [level=2]
- heading "Welcome back! How can I help?" [level=3]
- textbox "Ask me anything..."
- button "GPT-4o Mini" [disabled]
```

Visible text excerpt:

```text
keystonexnext
Dashboard
Models
Models
AA
Ada Admin
ada@example.com
Toggle Sidebar
Dashboard
Dashboard

4 Models

DATA MODELS
Users

2 items

Create new Users
Roles

2 items

Create new Roles
Todos

3 items

Create new Todos
Todo Images

2 items

Create new Todo Images
AI Assistant
Hi Ada Admin,
Welcome back! How can I help?
GPT-4o Mini
```

Visual structure:

- Left collapsible sidebar with logo, Dashboard link, collapsed Models section, user profile footer.
- Sticky header with sidebar trigger and breadcrumb.
- Main area: `Dashboard`, `4 Models`, `DATA MODELS`, 4 gradient cards in a responsive grid.
- Each model card is a link and has a small top-right plus/create button.
- Right AI Assistant sidebar is visible, with greeting and input.

#### Current: `http://localhost:3001/dashboard` after login

Interactive snapshot excerpt:

```text
- heading "keystonexnext" [level=1]
- link "Dashboard"
- button "Models"
- link "Users"
- link "Roles"
- link "Todos"
- link "Todo Images"
- button "AA Ada Admin ada@example.com" [expanded=false]
- button "Toggle Sidebar"
- navigation "breadcrumb"
  - link "Dashboard" [disabled]
- heading "Dashboard" [level=1]
- heading "DATA MODELS" [level=2]
- link "Users 2 items"
- link "Create new Users"
- link "Roles 2 items"
- link "Create new Roles"
- link "Todos 3 items"
- link "Create new Todos"
- link "Todo Images 2 items"
- link "Create new Todo Images"
- button "AI chat sidebar coming next"
- button "Open TanStack Devtools"
```

Visible text excerpt:

```text
keystonexnext
Dashboard
Models
Models
Users
Roles
Todos
Todo Images
AA
Ada Admin
ada@example.com
Toggle Sidebar
Dashboard
Dashboard

4 Models

DATA MODELS
Users

2 items

Create new Users
Roles

2 items

Create new Roles
Todos

3 items

Create new Todos
Todo Images

2 items

Create new Todo Images
```

Differences:

- Current home page has converged strongly with the original model-card layout.
- Current Models submenu is visibly expanded with Users/Roles/Todos/Todo Images links; original snapshot had the Models collapsible button closed.
- Current does **not** render the right AI Assistant panel; only a floating placeholder button is present.
- Current includes TanStack Devtools button in the DOM.
- Model cards visually and structurally match closely enough for the home route, but their create links currently lead to Not Found.

### 3. Users list route

#### Original: `http://localhost:3100/dashboard/users`

Interactive snapshot excerpt:

```text
- heading "Users" [level=1]
- searchbox "Search by id, name, email, role, tasks, password reset issued at, password reset redeemed at"
- button "Filter" [expanded=false]
- button "Sort" [expanded=false]
- button "Display" [expanded=false]
- link "Create User"
- checkbox [select all]
- columnheader "Id"
  - button "Id"
- columnheader "Name"
  - button "Name"
- columnheader "Email"
  - button "Email"
- columnheader "Role"
  - button "Role"
- columnheader "Tasks"
  - button "Tasks"
- columnheader "Actions"
- row: user_admin, Ada Admin, ada@example.com, Administrator, Launch TanStack CMS parity slice / Private admin-only planning, View
- row: user_editor, Ed Editor, ed@example.com, Todo Editor, Document GraphQL CRUD behavior, View
- floating pagination: page 1 / 1, 2 USERS, 50 PER PAGE
- right AI Assistant sidebar
```

Visible text excerpt:

```text
Users

Create and manage users

Filter
Sort
Display
Create User
	
Id
	
Name
	
Email
	
Role
	
Tasks
	Actions
	user_admin	Ada Admin	ada@example.com	
Administrator
	
Launch TanStack CMS parity slice, Private admin-only planning
	View
	user_editor	Ed Editor	ed@example.com	
Todo Editor
	
Document GraphQL CRUD behavior
	View
/
1
2
USERS
50
PER PAGE
```

#### Current: `http://localhost:3001/dashboard/users?page=1&search=`

Interactive snapshot excerpt:

```text
- heading "Users" [level=1]
- searchbox "Search by name"
- button "Filter" [disabled]
- button "Sort" [disabled]
- button "Display" [disabled]
- link "Create User"
- checkbox [select all]
- columnheader "ID"
  - button "ID"
- columnheader "Name"
  - button "Name"
- columnheader "Email"
  - button "Email" [disabled]
- columnheader "Role"
  - button "Role" [disabled]
- columnheader "Tasks"
  - button "Tasks" [disabled]
- columnheader "Actions"
- row: user_admin, Ada Admin, ada@example.com, Administrator, Launch TanStack CMS parity slice, Private admin-only planning, View
- row: user_editor, Ed Editor, ed@example.com, Todo Editor, Document GraphQL CRUD behavior, View
- textbox "Page number": 1
- combobox "Page size": 50, options 10/25/50/100
- button "AI chat sidebar coming next"
```

Visible text excerpt:

```text
Users

Authentication users and ownership relationships.

Filter
Sort
Display
Create User
	
ID
	
Name
	
Email
	
Role
	
Tasks
	Actions

	user_admin	Ada Admin	ada@example.com	Administrator	Launch TanStack CMS parity slice, Private admin-only planning	View

	user_editor	Ed Editor	ed@example.com	Todo Editor	Document GraphQL CRUD behavior	View
2
USERS
/
of 1
10
25
50
100
```

Differences:

- Overall page shell and table shape are close.
- Current list description comes from target metadata (`Authentication users and ownership relationships.`) rather than the original generic `Create and manage users`.
- Current search placeholder only includes `name`; original includes more Keystone-derived searchable/filterable fields.
- Current `Filter`, `Sort`, and `Display` controls are disabled; original controls are active popover triggers.
- Current relationship cells render plain labels, not links; original role/task relationship labels are links.
- Current has `View` links, but the item detail route is not registered, so they lead to Not Found.
- Current pagination is structurally different and less polished than the original floating pill; it exposes native select options in text snapshots.

### 4. Todos list route

#### Original: `http://localhost:3100/dashboard/todos`

Interactive snapshot excerpt:

```text
- heading "Todos" [level=1]
- searchbox "Search by id, label, is complete, status, priority (1-5), tags, due date, weight, budget, is private, large number example, todo images, assigned to"
- button "Filter"
- button "Sort"
- button "Display"
- link "Create Todo"
- headers: Id, Label, Tags, Is Complete, Assigned To, Actions
- row order: todo_docs, todo_launch, todo_private
- Tags rendered as labels: Documentation; Backend, Feature; Urgent
- Is Complete rendered as disabled checkbox/false
- Assigned To rendered as linked relationship labels
- floating pagination: page 1 / 1, 3 TODOS, 50 PER PAGE
- right AI Assistant sidebar
```

Visible text excerpt:

```text
Todos

Create and manage todos

Filter
Sort
Display
Create Todo
	
Id
	
Label
	
Tags
	
Is Complete
	
Assigned To
	Actions
	todo_docs	Document GraphQL CRUD behavior	Documentation		
Ed Editor
	View
	todo_launch	Launch TanStack CMS parity slice	Backend, Feature		
Ada Admin
	View
	todo_private	Private admin-only planning	Urgent		
Ada Admin
	View
/
1
3
TODOS
50
PER PAGE
```

#### Current: `http://localhost:3001/dashboard/todos?page=1&search=`

Interactive snapshot excerpt:

```text
- heading "Todos" [level=1]
- searchbox "Search by label, status"
- button "Filter" [disabled]
- button "Sort" [disabled]
- button "Display" [disabled]
- link "Create Todo"
- headers: ID, Label, Tags, Is Complete, Assigned To, Actions
- row order: todo_launch, todo_docs, todo_private
- Tags rendered as raw values: backend, feature; documentation; urgent
- Is Complete rendered as badge text "No"
- Assigned To rendered as plain text
- page number textbox and page-size combobox
```

Visible text excerpt:

```text
Todos

Task/content example ported from the Keystone starter model.

Filter
Sort
Display
Create Todo
	
ID
	
Label
	
Tags
	
Is Complete
	
Assigned To
	Actions

	todo_launch	Launch TanStack CMS parity slice	backend, feature	No	Ada Admin	View

	todo_docs	Document GraphQL CRUD behavior	documentation	No	Ed Editor	View

	todo_private	Private admin-only planning	urgent	No	Ada Admin	View
3
TODOS
/
of 1
10
25
50
100
```

Differences:

- Current has the same basic table columns, row count, and action column.
- Current default row order differs from original (`todo_launch` first vs original `todo_docs` first). This suggests missing Keystone initial sort/order behavior.
- Current multiselect values are raw lowercase option values; original renders display labels (`Backend`, `Feature`, `Documentation`, `Urgent`).
- Current checkbox values render as `No` badges; original uses checkbox cell presentation.
- Current relationships are plain text, not links.
- Current controls are disabled and search field coverage is much narrower.

### 5. Create route

#### Original: `http://localhost:3100/dashboard/users/create`

Interactive snapshot excerpt:

```text
- breadcrumb: Dashboard > Users > Create
- button "Create User"
- heading "Create User" [level=1]
- textbox [Name]
- textbox [Email]
- button "Set password"
- button "Search..." [Role relationship selector]
- button "Create related Role"
- textbox "Search..." [Tasks relationship search]
- button "Create related Todo"
- button "View related Todos"
- right AI Assistant sidebar
```

Visible text:

```text
Dashboard
Users
Create
Create User
Create User

Add a new user to users

Name
Email
Password
Set password
Role
Search...
Create related Role
Tasks
Create related Todo
View related Todos
AI Assistant
Hi Ada Admin,
Welcome back! How can I help?
GPT-4o Mini
```

#### Current: `http://localhost:3001/dashboard/users/create?page=1&search=`

Interactive snapshot excerpt:

```text
- heading "keystonexnext"
- left sidebar links
- button "AI chat sidebar coming next"
- button "Open TanStack Devtools"
```

Visible text:

```text
keystonexnext
Dashboard
Models
Models
Users
Roles
Todos
Todo Images
AA
Ada Admin
ada@example.com

Not Found
```

Finding:

- Current `Create User` links are visible on cards/list pages, but the route is not actually available.
- By file inspection, `src/routes/dashboard/$listKey.create.tsx` exists but is incomplete/truncated at the start of `CreateRoute()` and is not imported in `src/routeTree.gen.ts`.
- The current generated route tree only registers `/dashboard`, `/dashboard/$listKey`, `/dashboard/signin`, `/dashboard/init`, and `/dashboard/no-access`.

### 6. Item detail/edit route

#### Original: `http://localhost:3100/dashboard/users/user_admin`

Interactive snapshot excerpt:

```text
- breadcrumb: Dashboard > Users > Ada Admin
- button "Delete"
- button "Save Changes" [disabled until edits]
- heading "Ada Admin" [level=1]
- ID card: user_admin, button "Copy ID"
- textbox "Ada Admin" [Name]
- textbox "ada@example.com" [Email]
- button "Set password"
- button "Administrator" [Role relationship]
- button "Create related Role"
- button/link "View Role details"
- relationship cards/chips for Tasks: Launch TanStack CMS parity slice, Private admin-only planning
- button "Create related Todo"
- button/link "View related Todos"
- right AI Assistant sidebar
```

Visible text:

```text
Dashboard
Users
Ada Admin
Delete
Save Changes
Ada Admin
ID
user_admin
Copy ID
Name
Email
Password
Set password
Role
Administrator
Create related Role
View Role details
Tasks
Launch TanStack CMS parity slice
Private admin-only planning
Create related Todo
View related Todos
AI Assistant
Hi Ada Admin,
Welcome back! How can I help?
GPT-4o Mini
```

#### Current: `http://localhost:3001/dashboard/users/user_admin?page=1&search=`

Visible text:

```text
keystonexnext
Dashboard
Models
Models
Users
Roles
Todos
Todo Images
AA
Ada Admin
ada@example.com

Not Found
```

Finding:

- Current table `View` links exist but route to Not Found.
- No current registered route exists for `/dashboard/$listKey/$id`.
- This is the largest remaining visual/DOM gap versus the original custom Keystone dashboard.

### 7. Auth/reset/init route behavior

#### Original unauthenticated reset

`http://localhost:3100/dashboard/reset` is accessible while signed out:

```text
keystonexnext
Reset password

Enter your email address and we'll send you a link to reset your password.

Email
Send reset link
```

#### Original sign-up

The original code has a sign-up screen, and the sign-in page links to it, but with the tested environment (`PUBLIC_SIGNUPS_ALLOWED=false`) unauthenticated `/dashboard/signup` redirected to:

```text
/dashboard/signin?from=%2Fdashboard%2Fsignup
```

#### Current authless reset/signup

Current unauthenticated routes redirected to sign-in:

```text
/dashboard/reset  -> /dashboard/signin?from=%2Fdashboard%2Freset
/dashboard/signup -> /dashboard/signin?from=%2Fdashboard%2Fsignup
```

Current sign-in page does not expose reset or sign-up links, so the original auth screen surface is not yet replicated.

## File/code structure evidence

### Original route/UI surface

Original relevant files inspected:

```text
app/dashboard/(admin)/page.tsx                    -> HomePage
app/dashboard/(admin)/[listKey]/page.tsx          -> ListPage
app/dashboard/(admin)/[listKey]/[id]/page.tsx     -> ItemPage
app/dashboard/(admin)/[listKey]/create/page.tsx   -> CreatePage
app/dashboard/signin/page.tsx                     -> SignInPage
app/dashboard/signup/page.tsx                     -> SignUpPage
app/dashboard/reset/page.tsx                      -> ResetPage
app/dashboard/init/page.tsx                       -> InitPage
app/dashboard/no-access/page.tsx                  -> NoAccessPage
features/dashboard/components/DashboardLayout.tsx -> shell + providers + right AI sidebar
features/dashboard/components/Sidebar.tsx         -> left navigation/user profile
features/dashboard/components/FilterBar.tsx       -> search/filter/sort/display/create controls
features/dashboard/components/ListTable.tsx       -> selection table/action links/pagination
features/dashboard/components/Fields.tsx          -> Keystone-style field renderer
features/dashboard/screens/CreatePage/*           -> create form route
features/dashboard/screens/ItemPage/*             -> edit/detail route
features/dashboard/views/*                        -> field view/controller registry
```

### Current registered route surface

Current generated route tree inspected from `src/routeTree.gen.ts` registers:

```text
/dashboard
/dashboard/
/dashboard/$listKey
/dashboard/signin
/dashboard/init
/dashboard/no-access
/api/graphql
```

It does **not** register:

```text
/dashboard/$listKey/create
/dashboard/$listKey/$id
/dashboard/reset
/dashboard/signup
```

This matches browser behavior: create/detail routes currently show Not Found after login.

## Summary of parity status

| Area | Current status vs original |
|---|---|
| Auth redirect guard | Mostly matching for `/dashboard` unauthenticated redirect and post-login dashboard access. |
| Sign-in screen visual | Not matching; simplified card lacks original branding/signup/reset/toggle. |
| Dashboard home | Close visual parity for model cards/counts/shell. Missing right AI sidebar; Models nav state differs. |
| Sidebar/user profile | Close. Current user footer and logo are present; original model group is collapsible and current shows model links expanded. |
| List route layout | Close base table layout. Current has checkboxes, headers, rows, actions, pagination. |
| List controls | Not matching; current Filter/Sort/Display disabled, original active. |
| List search | Partial; current searchable fields are narrower. |
| Cell rendering | Partial; current lacks relationship links and original field-view-specific formatting for booleans/multiselect labels. |
| Sorting/order | Partial; observed Todos default order differs. |
| Create routes | Missing/broken; original full dynamic create forms exist. |
| Item edit/detail routes | Missing; original full dynamic edit form exists. |
| Reset route | Missing in current auth surface; original has reset form for signed-out users. |
| AI sidebar | Placeholder only in current; original has visible right AI assistant UI. |
| TanStack Devtools | Current-only DOM element; not present in original. |

## Recommended next visual parity targets

1. Register and complete `/dashboard/$listKey/create` and add `/dashboard/$listKey/$id` before polishing list tables; visible Create/View links currently dead-end.
2. Port the original `Fields` + field view/controller registry behavior for create/edit forms and for table cell rendering.
3. Enable list `Filter`, `Sort`, and `Display` popovers rather than rendering disabled buttons.
4. Match original search metadata and initial sorting/order behavior.
5. Restore branded auth screens: sign-in logo, signup/reset links, reset form, password visibility toggle, and error/toast styling.
6. Decide whether AI sidebar parity is required; if so, current floating placeholder must become the original right sidebar layout.
