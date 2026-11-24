# Parity/readiness report consolidation plan

**Decision date:** 2026-07-18  
**Canonical report:** `READINESS.md`

## Problem

The repository contains many root reports, worker outputs, audit loops, dissertation chapters, screenshots, and handoff notes created at different implementation stages. Many directly contradict current source (for example, early reports say auth, context APIs, uploads, many mutations, or virtual fields do not exist). Treating all of them as current creates false regressions and false parity claims.

## Policy

1. `READINESS.md` is the only current product-readiness and Keystone-removal verdict.
2. `reports/README.md` is the report index and directs readers to the canonical matrix.
3. Existing reports are preserved as historical evidence because this workspace explicitly forbids deleting existing files and has no Git history to recover them from.
4. Historical reports may identify tests or source references, but their status/percentage/verdict language is non-authoritative until revalidated and incorporated into `READINESS.md`.
5. Do not create another `*-latest.md`, loop report, worker output, parity dissertation, or root verdict. Update the relevant row, evidence, date, and gate in `READINESS.md` instead.
6. Implementation details that need more room belong in stable topical docs (`docs/graphql-contract.md`, migration docs, ADRs), not another readiness report.

## Consolidation inventory

| Class                         | Examples                                                                                                        | Disposition                                                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Root context/progress reports | `context.md`, `progress.md`, `feature-completeness-verdict.md`, `official-keystone-*.md`, `backend-*-output.md` | Historical snapshots; retain, do not use as current verdict.                                                      |
| Dashboard handoffs/audits     | `dashboard-*.md`, `forms-fields-audit.md`, `list-controls-audit.md`, `shell-nav-audit.md`                       | Historical implementation/browser evidence; unresolved claims must be copied into canonical matrix before action. |
| Loop reports                  | `reports/subagent-next-parity-audit-loop-*.md`                                                                  | Superseded iteration logs. Never cite a loop status as current.                                                   |
| Dissertation/refresh sets     | `reports/parity-dissertation/**`, `reports/parity-refresh/**`                                                   | Research/reference only. Canonical matrix owns status.                                                            |
| Execution batches             | `reports/parity-execution/**`                                                                                   | Historical change/evidence logs. Rerun commands before relying on results.                                        |
| Latest audit aliases          | `reports/keystone-parity/*latest.md`, `subagent-artifacts/*latest.md`                                           | Frozen historical aliases; do not update.                                                                         |
| Screenshots                   | `reports/**/*.png`, browser smoke notes                                                                         | Historical visual evidence; new acceptance evidence should be date-stamped and linked from the canonical row.     |

## Safe cleanup sequence

Because all existing files must be preserved in this non-Git workspace, consolidation is logical rather than destructive now:

1. Add the canonical matrix and report index. **Done.**
2. Stop creating duplicate reports. **Effective immediately.**
3. When a claim is revisited, rerun its executable evidence and update `READINESS.md`; do not edit the old report to look current.
4. After this directory is eventually placed under a recoverable version-control/archive policy and the owner approves cleanup, move historical reports under `reports/archive/<date-or-topic>/` with a generated path map. Do not delete them in the current workspace.
5. Only after references are rewritten and archive integrity is verified may duplicate files be removed, with explicit owner approval.

## Update protocol for `READINESS.md`

A row may move to **Verified** only when:

- implementation source is identified;
- a bounded command/test or reviewed external artifact directly covers the claim;
- the command is rerun on the current dependency lock;
- known intentional differences are stated;
- consumer-specific proof is not inferred from starter-only proof.

A package-removal recommendation additionally requires every applicable P0 removal gate in `READINESS.md` to be checked.
