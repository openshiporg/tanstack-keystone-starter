# Batch 2 AI/dashboard realism

Date: 2026-05-19

## What changed

Implemented the scoped Batch 2 AI/dashboard realism work from `reports/parity-dissertation/00-master-parity-dissertation-and-roadmap.md`.

### 1) Added a clearer dashboard composition layer
- Introduced `src/components/dashboard/dashboard-layout.tsx` as a dedicated composition layer analogous to the Next dashboard layout.
- Kept the current good pieces (sidebar, right sidebar, floating AI button, overview query) but moved the shell composition into a named layout component so provider/shell boundaries are more explicit.
- `DashboardShell` now focuses on fetching overview data and rendering `DashboardLayout`.

### 2) Replaced placeholder AI config with a real provider foundation
- Added `src/components/dashboard/ai-config.tsx`.
- AI config is now a provider-backed subsystem instead of the previous hardcoded `{ enabled, completionEndpoint }` memo.
- The config now has a stable shape and localStorage-backed hydration for:
  - `enabled`
  - `completionEndpoint`
  - `keyMode`
- This is intentionally minimal and target-native: it does not attempt the full Next MCP/OpenRouter stack yet, but it stops AI config from being a throwaway stub.

### 3) Replaced local stub chat state with a provider-backed async chat mode
- Added `src/components/dashboard/chat-mode.tsx`.
- Chat state is now provider-backed and uses a real async POST to `/api/completion`.
- Added:
  - optimistic user message append
  - async assistant response handling
  - loading/sending state
  - dismissible error handling
  - optional dashboard query invalidation hook when the backend signals it

### 4) Added a real target `/api/completion` route
- Added `src/routes/api/completion.ts`.
- Added backend logic in `src/features/cms/dashboard-completion.ts`.
- The completion route now uses real authenticated backend logic instead of a canned frontend-only response.
- The first-step implementation is intentionally minimal and TanStack-native:
  - validates the request is authenticated and dashboard-authorized
  - inspects real dashboard/admin metadata context
  - returns real backend-generated responses for:
    - identity/account questions
    - available lists/models
    - dashboard workflow/help questions
    - create/update/delete intent acknowledgement
- This does **not** implement the full Next MCP/OpenRouter/AI SDK stack yet; it is a focused real backend transport step that removes the fake canned assistant behavior.

### 5) Wired the sidebar to real backend transport
- Updated `src/components/dashboard/ai-chat-sidebar.tsx` to use the new providers.
- The sidebar now:
  - submits to the backend route
  - shows loading state (`Thinking...`)
  - renders backend responses in message flow
  - surfaces/dismisses backend errors
  - allows enabling/disabling the assistant from the sidebar
- Removed the previous hardcoded “AI assistant wiring is ready...” placeholder behavior.

### 6) Added targeted validation for the new completion path
- Added `scripts/validate-dashboard-completion.ts`.
- Added package script:
  - `npm run test:dashboard:ai`
- The validation:
  - authenticates through the real auth GraphQL mutation
  - calls the new completion backend directly
  - verifies authenticated responses for list/help prompts
  - verifies anonymous requests are rejected

## Exact files changed

- `src/components/dashboard/dashboard-shell.tsx`
- `src/components/dashboard/dashboard-providers.tsx`
- `src/components/dashboard/ai-chat-sidebar.tsx`
- `src/components/dashboard/dashboard-layout.tsx` **new**
- `src/components/dashboard/ai-config.tsx` **new**
- `src/components/dashboard/chat-mode.tsx` **new**
- `src/features/cms/dashboard-completion.ts` **new**
- `src/routes/api/completion.ts` **new**
- `scripts/validate-dashboard-completion.ts` **new**
- `package.json`
- `scripts/validate-cms-auth.ts` (lint-only cleanup from an existing Batch 1 assertion)

## Validations run and results

### Required validations
- `npm run lint` ✅ passed
- `npm run build` ✅ passed

### Targeted validation
- `npm run test:dashboard:ai` ✅ passed
  - authenticated completion request works
  - anonymous completion request is rejected

## Remaining blockers / follow-up notes

These Batch 2 changes are intentionally scoped and do **not** claim full AI parity with `next-keystone-starter`.

### Still not done in this batch
- no full MCP/OpenRouter/AI SDK parity stack
- no streaming transport
- no markdown/tool rendering layer from the Next implementation
- no local/shared API-key mode UI parity beyond the new minimal config foundation
- no CRUD tool execution from AI yet
- no rich `ModeSplitButton` / settings popover parity

### Practical state after Batch 2
- The dashboard AI sidebar is no longer a fake canned stub.
- It now uses a real backend route with authenticated server-side logic.
- The provider/composition story is clearer and closer to the Next layout model.
- This is a target-native first step toward parity, not the final AI parity endpoint.
