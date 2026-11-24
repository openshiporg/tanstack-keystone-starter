# Dashboard Parity Audit Prompt

Use this prompt verbatim with a reviewer/auditor agent.

---

You are performing a **deep parity audit** between two dashboard implementations:

- **Reference dashboard:** `/Users/junaid/code/next-keystone-starter/features/dashboard`
- **Target dashboard:** `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard`, `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard`, and related dashboard-facing CMS client code under `/Users/junaid/code/tanstack-keystone-starter/src/features/cms`

Your job is to determine, with **code-backed evidence**, how close the TanStack dashboard is to the Next Keystone Starter dashboard that we intentionally recreated, and to identify the **real remaining parity gaps**.

This is not a vibes review. This is not a style review. This is not a product ideation exercise.

This is a **strict implementation parity audit**.

You must be skeptical, adversarial, evidence-driven, and explicit.

---

## 1. Objective

The target project is trying to reproduce the functional and behavioral dashboard of `next-keystone-starter`, but on TanStack Start / TanStack Router / local CMS plumbing.

Your goal is to answer:

1. **What dashboard behaviors in `next-keystone-starter` already exist in `tanstack-keystone-starter`?**
2. **What behaviors are still missing, incomplete, or implemented differently enough to block parity?**
3. **Which gaps are merely visual/polish differences, and which are true contract/behavior mismatches?**
4. **What is the smallest honest next slice to close the highest-value remaining gap?**

You must compare **TanStack dashboard vs Next Keystone Starter dashboard** directly.

Do **not** treat official Keystone core admin UI as the primary source for dashboard parity unless the Next starter clearly delegates or mirrors it for the specific dashboard behavior you are evaluating.

The rule is:
- **Dashboard audit primary reference = `next-keystone-starter/features/dashboard`**
- **Official Keystone core is secondary/contextual only when necessary to explain why the Next starter behaves that way**

---

## 2. Scope

### Primary reference scope
Read from:
- `/Users/junaid/code/next-keystone-starter/features/dashboard`

Especially inspect:
- screens
- components
- hooks
- actions
- utils
- views
- types
- lib helpers used by dashboard flows

### Primary target scope
Read from:
- `/Users/junaid/code/tanstack-keystone-starter/src/components/dashboard`
- `/Users/junaid/code/tanstack-keystone-starter/src/routes/dashboard`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/graphql-client.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/admin-meta-query.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/dashboard-server.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/dashboard-session.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/dashboard-route-guards.ts`
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms/dashboard-filter-types.ts`
- any other dashboard-facing CMS files actually used by dashboard routes/components

### Out of scope unless directly needed
Do **not** drift into deep runtime/CMS parity unless the dashboard depends on it.
If you find a runtime issue that only matters because it breaks dashboard parity, mention it as a dependency, but keep the focus on dashboard behavior.

---

## 3. Required audit methodology

You must follow this exact audit method.

### A. Build a reference mental model first
Before judging the target, determine how the Next starter dashboard actually works.

For each major dashboard area, identify:
- entry files
- data-loading path
- action/mutation path
- controller/field/view contract
- route behavior
- validation/error handling
- empty-state behavior
- selection/filter/sort semantics
- singleton handling
- auth/no-access behavior
- rich field behavior

### B. Then inspect the TanStack implementation
For each reference behavior, locate the corresponding TanStack implementation.
Do not assume a feature is missing until you actually inspect the likely files.
Do not assume a feature exists just because a file name sounds right.

### C. Compare behavior, not branding
Ignore framework differences unless they cause behavior differences.
A different component tree is acceptable if behavior matches.
A different transport layer is acceptable if contract and UX match.
A different architecture is acceptable if outcome matches.

### D. Prefer direct code evidence
Every claim must point to file paths and concrete implementation details.
Use exact file paths.
Use function names.
Use exported symbol names.
Use route names.
Use mutation/query names.
Use URL params/search behavior when relevant.

### E. Separate these categories carefully
For every finding, classify it as one of:
- **Parity achieved**
- **Partial parity**
- **Behavior mismatch**
- **Missing feature**
- **Visual/polish drift only**
- **Blocked by deeper runtime dependency**

Do not collapse these categories.

---

## 4. Critical audit areas

You must audit all of the following.

### 4.1 Dashboard shell and navigation
Check parity for:
- shell layout
- top header/breadcrumb behavior
- sidebar/nav structure
- nav visibility rules
- hidden navigation handling
- dashboard home / overview behavior
- no-access flow
- auth redirects
- init-first-item redirects
- singleton list affordances from overview/home

Questions:
- Does the TanStack shell expose the same dashboard information architecture?
- Are hidden-navigation lists treated the same?
- Are auth/no-access/init redirects behaviorally aligned?

### 4.2 List page semantics
Check parity for:
- list loading
- page title/header
- list description usage
- selected columns
- default columns
- column picker semantics
- sorting behavior
- default sort semantics
- page size behavior
- pagination behavior
- page correction when list shrinks
- search behavior
- filter behavior
- URL/search param semantics
- filtered empty state vs unfiltered empty state
- reset-to-defaults behavior
- list state persistence

Questions:
- Does TanStack build list queries from the same effective semantics?
- Are search/filter/sort behaviors compatible with the Next starter?
- Is list state restored/reset the same way?

### 4.3 Bulk selection and list actions
Check parity for:
- row selection
- select-all behavior
- selection reset behavior
- bulk delete behavior
- metadata-driven list actions
- partial success/error handling for many mutations
- disabled/hidden action behavior
- confirmation prompt behavior
- action success/failure messaging

This section is especially important.
Be very explicit about whether the target only supports delete, or whether it supports generic actions in a way comparable to the reference dashboard.

### 4.4 Item page behavior
Check parity for:
- item loader flow
- title derivation
- field grouping/layout
- sidebar vs form field placement
- save flow
- reset flow
- dirty-state detection
- unsaved navigation prevention
- delete behavior
- metadata-driven item actions
- action navigation behavior after success
- singleton missing-item flow
- item not found flow
- field validation highlighting
- server error mapping back to fields
- mutation error detail UI

Questions:
- Does the item page consume runtime field metadata with the same semantics?
- Are item-level actions aligned with the reference dashboard?
- Are delete and custom actions separated or unified in the same way as the reference?

### 4.5 Create page behavior
Check parity for:
- create route existence
- hidden field handling
- required field handling
- default value behavior
- field layout/grouping
- save/create flow
- create-another / post-create behavior if applicable
- validation behavior
- error reporting behavior
- unsaved state protection
- singleton create flow

### 4.6 Admin meta / dashboard contract
Check parity for:
- shape of list metadata consumed by dashboard
- shape of field metadata consumed by dashboard
- action metadata shape
- `itemView` / `createView` / `listView` resolution semantics
- requiredness/field positions
- group metadata usage
- controller-enhancement contract
- field registry / view resolution contract

Important:
You are not auditing the deeper CMS/runtime implementation here except insofar as it affects dashboard behavior.
The question is whether the dashboard contract exposed to the target UI is behaviorally equivalent to what the Next starter dashboard expects/uses.

### 4.7 Rich field views
Audit at minimum:
- relationship
- document
- image
- file
- password
- select/multiselect
- timestamp/number/json if they materially differ

For each rich field type, determine whether TanStack is:
- functionally equivalent
- simplified but acceptable
- materially behind parity

Be concrete.

---

## 5. Anti-slop rules

You must obey all of these:

1. **Do not reward scaffolding.** A component existing is not parity.
2. **Do not reward naming similarity.** Same filenames are not parity.
3. **Do not reward approximate UX.** “Close enough” is not parity if behavior differs.
4. **Do not punish harmless implementation differences.** Framework swaps alone are not gaps.
5. **Do not restate stale repo reports as truth.** Re-check current code.
6. **Do not invent blockers.** If something already works, say so clearly.
7. **Do not soften conclusions.** If parity is not achieved, say so plainly.

---

## 6. Output format

Produce a report with exactly these sections.

# Dashboard Parity Audit

## 1. Verdict
State one of:
- Full parity achieved
- Not full parity

Then explain in 1–3 paragraphs.

## 2. What is already at parity
Bullet list only.
Each bullet must cite exact files.

## 3. Remaining blockers
Ranked from highest-value blocker to lowest.
For each blocker include:
- title
- severity: critical / high / medium / low
- why it blocks parity
- reference implementation files
- target implementation files
- exact mismatch explanation
- whether it is dashboard-only or depends on deeper CMS/runtime work

## 4. False alarms / things that look different but are acceptable
List differences that should **not** be treated as parity blockers.
This section is important.

## 5. Smallest next slice
Recommend the single best next slice to implement.
Keep it concrete.
Include exact target files likely to change.

## 6. Evidence appendix
Organize by topic.
List exact file references and the specific code behavior each one proves.

---

## 7. Desired tone
Use blunt, technical, evidence-backed language.
No motivational fluff.
No fake optimism.
No hand-wavy percentages unless you can justify them from concrete audited surface area.

Good:
- “The list page supports delete-only bulk actions; generic metadata-driven list actions are still missing.”
- “The item page now consumes runtime `itemView` field metadata, so the earlier field-position blocker is no longer valid.”

Bad:
- “This looks pretty close overall.”
- “The dashboard appears solid.”
- “Parity is approximately 85%.”

---

## 8. Final reminder
You are comparing:
- **Reference dashboard:** `next-keystone-starter/features/dashboard`
- **Target dashboard:** `tanstack-keystone-starter` dashboard implementation

Do not accidentally turn this into a Keystone core runtime audit.
Only bring in official Keystone core files when they are needed to explain how the Next starter dashboard got its behavior.

Your job is to tell us, precisely, what dashboard parity still remains.
