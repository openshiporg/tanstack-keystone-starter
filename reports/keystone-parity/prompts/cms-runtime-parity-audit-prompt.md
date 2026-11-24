# CMS Runtime / Keystone Core Parity Audit Prompt

Use this prompt verbatim with a reviewer/auditor agent.

---

You are performing a **deep parity audit** between:

- **Reference implementation:** official Keystone core source code under `/Users/junaid/code/keystone/packages/core` and related official Keystone packages when directly relevant
- **Target implementation:** the local CMS/runtime layer in `/Users/junaid/code/tanstack-keystone-starter/src/features/cms`

Your job is to determine, with **code-backed evidence**, how close the local TanStack CMS/Keystone-like runtime is to the Keystone behavior that the project is trying to bring in.

This is not a dashboard audit.
This is not a visual audit.
This is not a product-level review.

This is a **strict runtime / imported-Keystone parity audit**.

You must be adversarial, skeptical, and explicit.

---

## 1. Objective

The target project is attempting to provide a local Keystone-like CMS/runtime layer that reproduces important Keystone core behavior closely enough for the project’s dashboard and CMS flows.

Your goal is to answer:

1. **Which Keystone core behaviors are already meaningfully reproduced in the local CMS/runtime?**
2. **Which important Keystone behaviors are still missing, simplified, or incompatible?**
3. **Which gaps are contract-level/runtime blockers versus acceptable implementation differences?**
4. **What is the single most valuable next runtime slice to implement?**

Important framing:
- You are **not** comparing the dashboard against the dashboard here.
- You are **not** comparing to `next-keystone-starter/features/dashboard` here.
- You **are** comparing the **local CMS/runtime implementation** against **official Keystone core / imported Keystone behavior**.

Primary target scope is the local CMS/runtime.
Primary reference scope is official Keystone core.

---

## 2. Scope

### Reference scope
Read from official Keystone core, especially:
- `/Users/junaid/code/keystone/packages/core/src/lib`
- `/Users/junaid/code/keystone/packages/core/src/types`
- `/Users/junaid/code/keystone/packages/core/src/fields`
- `/Users/junaid/code/keystone/packages/core/src/session.ts`
- `/Users/junaid/code/keystone/packages/auth/src`

Use additional official files only where necessary.

### Target scope
Read from:
- `/Users/junaid/code/tanstack-keystone-starter/src/features/cms`

Especially inspect:
- runtime/schema generation
- admin meta generation/resolution
- auth/session behavior
- storage behavior
- adapters
- access control
- hooks
- field normalization/config
- GraphQL behavior
- generated GraphQL names / schema conventions
- context APIs
- field semantics

### Secondary scope
You may inspect `cms.config.ts` and local models only when needed to understand the runtime surface.

---

## 3. Required audit method

You must follow this method exactly.

### A. Determine official Keystone behavior first
Before judging the target, identify how Keystone core actually works for the audited area.
Do not infer from memory.
Do not infer from a starter app unless the behavior is delegated directly from core.

### B. Inspect the local runtime only after establishing the reference
Locate the corresponding local implementation.
Compare actual behavior, contracts, and omissions.

### C. Compare behavior and exposed contract
Focus on:
- public API behavior
- GraphQL schema shape
- resolver semantics
- access control semantics
- item/list/field config normalization
- field input/output behavior
- session/auth behavior
- admin-meta behavior
- storage behavior
- context/db/query semantics

Different internal architecture is acceptable **only if the observable behavior and contract match closely enough**.

### D. Prefer code and validation evidence
Every claim must cite concrete files and specific symbols/behaviors.
If the repo already contains validation scripts, you may use them as supporting evidence — but only after checking whether they truly cover the behavior in question.

### E. Classify findings carefully
For every major area, classify as:
- **Parity achieved**
- **Partial parity**
- **Behavior mismatch**
- **Missing feature**
- **Acceptable implementation difference**
- **Known explicit compromise / blocker**

---

## 4. Critical runtime audit areas

You must inspect all of the following.

### 4.1 Config normalization and list initialization
Compare how Keystone initializes lists/config versus the local runtime.
Check:
- list normalization
- id field injection/defaulting
- singleton handling
- group handling
- default label/path/plural logic
- ui config normalization
- graphql config normalization
- server/db normalization
- list actions config support
- default field mode propagation

Questions:
- Does the target normalize config to a Keystone-like runtime shape?
- Are important defaults missing or shallower than core?

### 4.2 GraphQL schema generation
Audit:
- query generation
- mutation generation
- many-mutation generation
- where/order input generation
- field output generation
- omitted public vs internal schema behavior
- auth GraphQL additions
- action mutation generation if supported
- upload scalar handling

Questions:
- Are the generated schema contracts meaningfully Keystone-like?
- Are there important missing mutations/types/contracts?

### 4.3 CRUD resolver semantics
Audit:
- create/update/delete one
- create/update/delete many
- ordering of many-operation results
- partial failure behavior
- hook order
- access enforcement
- relationship resolution
- omitted field/list behavior
- error behavior

Questions:
- Does the target preserve Keystone-like semantics or cut corners?
- Are many-mutation semantics truly aligned?

### 4.4 Access control semantics
Audit:
- operation access
- filter access
- item access
- field access
- filterability/orderability controls
- sudo/internal behavior
- auth-related access flows
- action access semantics if supported

Questions:
- Does the target enforce access in the same effective places?
- Are there meaningful differences in denied-item behavior or filter semantics?

### 4.5 Admin meta generation and runtime resolution
Audit:
- list meta shape
- field meta shape
- group meta shape
- action meta shape
- item-aware `list(key:, itemId:)` behavior
- dynamic `itemView` / `createView` / `listView` resolution
- requiredness / positions / search metadata
- hideCreate / hideDelete / hideNavigation behavior

This section matters because the dashboard depends heavily on it.
But keep the focus on **runtime parity**, not dashboard rendering.

### 4.6 Field-type semantics
Audit field behavior for at least:
- text
- password
- relationship
- document
- image
- file
- select/multiselect
- json
- timestamp
- numeric fields
- virtual

For each important field type, evaluate:
- config normalization
- GraphQL input/output shape
- stored representation
- access behavior
- special UI/admin meta payloads where relevant

Be explicit where the local runtime is simplified.

### 4.7 Auth and session behavior
Audit:
- auth GraphQL schema integration
- password authentication flow
- authenticatedItem flow
- endSession flow
- init-first-item behavior
- session token strategy
- session hydration behavior
- sessionData validation/shape
- differences from official Keystone session semantics

Important:
If the target intentionally uses a different session primitive (for example because a specific Keystone dependency is unavailable), classify that as an explicit compromise if behavior is close — not automatically as total failure.
But do not overstate parity.

### 4.8 Storage / upload behavior
Audit:
- local storage behavior
- remote/S3-like storage behavior
- signed URL generation
- upload mutation path / GraphQL upload support
- delete behavior
- output URL behavior
- config surface parity

Questions:
- Is storage support real or just declarative scaffolding?
- Are image/file semantics broader or looser than Keystone core?

### 4.9 Context APIs
Audit:
- `context.db`
- `context.query`
- `context.graphql`
- transaction behavior
- internal/sudo context behavior
- whether `context.db` is schema-derived in a Keystone-like way or just a looser compatibility layer

This is an area where previous audits have found meaningful drift, so be careful and current.

### 4.10 Known compromise areas
Explicitly revisit whether these are still true and still blockers:
- document runtime fidelity
- password field gaps
- broad file/image mutation semantics
- non-schema-derived `context.db`
- session strategy differences
- config/defaulting depth

Do not assume the old status is still correct; re-check code.

---

## 5. Anti-slop rules

You must obey all of these:

1. **Do not reward scaffolding.** A type existing is not parity.
2. **Do not reward a similar name.** A function called `config()` is not Keystone parity by itself.
3. **Do not treat tests as proof unless they cover the exact behavior.**
4. **Do not penalize harmless internal implementation differences.**
5. **Do not repeat stale local reports without re-checking code.**
6. **Do not soften gaps.** If something is still materially different, say so plainly.
7. **Do not conflate dashboard parity and runtime parity.**

---

## 6. How to use existing repo evidence

The target repo may contain validation scripts and prior reports.
You may use them, but only carefully.

Examples of relevant target-side evidence include scripts under:
- `scripts/validate-cms-*.ts`
- `reports/keystone-parity/*.md`

Rules for using them:
- read the script itself before trusting its claim
- verify what exact behavior it does and does not cover
- if a report claim conflicts with current code, trust current code
- if a script proves only a narrow slice, do not overgeneralize

---

## 7. Output format

Produce a report with exactly these sections.

# CMS Runtime / Keystone Core Parity Audit

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
- why it blocks runtime parity
- official Keystone reference files
- target implementation files
- exact mismatch explanation
- whether it also affects dashboard parity or is runtime-only

## 4. Explicit compromises that are honest but not fake parity
List areas where the target made an intentional substitute or staged implementation.
Explain whether each compromise is acceptable for now or still a blocker.

## 5. False alarms / acceptable implementation differences
List differences that should **not** be treated as blockers.
This is important.

## 6. Smallest next slice
Recommend the single best next runtime slice to implement.
Include exact files likely to change.

## 7. Evidence appendix
Organize by topic.
List exact file references and what each proves.

---

## 8. Desired tone
Use blunt, technical, evidence-backed language.
No fake optimism.
No vague percentages unless justified.
No “looks good overall” language.

Good:
- “The local runtime now exposes real action mutations, but `context.db` still remains a looser compatibility API than Keystone core.”
- “The public/internal omit proof is real and validated by runtime GraphQL execution.”

Bad:
- “The CMS appears mature.”
- “Parity is roughly close.”

---

## 9. Final reminder
This is a **runtime parity audit**.

Compare:
- **Reference:** official Keystone core / auth package source
- **Target:** local CMS/runtime in `tanstack-keystone-starter/src/features/cms`

Do not drift into a dashboard parity audit.
Do not use `next-keystone-starter/features/dashboard` as your primary reference here.

Your job is to tell us, precisely, what runtime parity still remains.
