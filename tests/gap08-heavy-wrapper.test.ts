import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  assertExternalReportPath,
  assertGeneratedExecutionPlan,
  assertSnapshotDelta,
  boundedDiagnostic,
  GAP08_ACCEPTED_SIX,
  GAP08_CLEANUP_STEPS,
  Gap08RunLedger,
  physicalJoinCatalogContract,
} from '../scripts/gap08-heavy-lifecycle.mjs'

const acceptedAggregate =
  '55f0b916771efaf82b4de885615c98328d29e2574e5c9dac0e6ad8b81ad92e2c'

function fakeGeneratedPlan() {
  const matrix = Array.from({ length: 6 }, (_, index) => ({
    id: `Synthetic${index}.relation`,
    pairId: `pair-${Math.floor(index / 2)}`,
    ownership: index < 2 ? 'own' : index < 4 ? 'inverse' : 'shared',
  }))
  const scenarios = Array.from({ length: 76 }, (_, index) => ({
    id: `scenario-${index}`,
    endpointId: matrix[index % matrix.length].id,
    kind: index % 2 ? 'connect' : 'invalid-id',
    expectedOutcome: index % 2 ? 'success' : 'rejection',
    expectedCounts: { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
  }))
  return { matrix, scenarios }
}

describe('GAP-08 source-only heavy wrapper lifecycle', () => {
  it('binds the accepted six-file aggregate exactly', async () => {
    const aggregate = createHash('sha256')
    for (const file of [...GAP08_ACCEPTED_SIX.files].sort()) {
      aggregate.update(file)
      aggregate.update('\0')
      aggregate.update(await readFile(file))
      aggregate.update('\0')
    }
    expect(aggregate.digest('hex')).toBe(acceptedAggregate)
    expect(GAP08_ACCEPTED_SIX.sha256).toBe(acceptedAggregate)
  })

  it('accepts only generated six-endpoint/76-scenario execution plans', () => {
    const { matrix, scenarios } = fakeGeneratedPlan()
    const plan = assertGeneratedExecutionPlan({
      matrix,
      scenarios,
      adminMetaSha256: 'a'.repeat(64),
      prismaSchemaSha256: 'b'.repeat(64),
    })
    expect(plan).toMatchObject({
      provenance: 'generated-adminmeta-plus-prisma-schema',
      endpointCount: 6,
      scenarioCount: 76,
    })
    expect(plan.scenarioIds).toHaveLength(76)

    expect(() =>
      assertGeneratedExecutionPlan({
        matrix,
        scenarios: scenarios.slice(1),
        adminMetaSha256: 'a'.repeat(64),
        prismaSchemaSha256: 'b'.repeat(64),
      }),
    ).toThrow(/76/)
    expect(() =>
      assertGeneratedExecutionPlan({
        matrix,
        scenarios: [
          ...scenarios.slice(0, -1),
          { ...scenarios.at(-1)!, endpointId: 'Handwritten.missing' },
        ],
        adminMetaSha256: 'a'.repeat(64),
        prismaSchemaSha256: 'b'.repeat(64),
      }),
    ).toThrow(/generated endpoint/i)
  })

  it('enforces exact snapshot deltas and unchanged rejection state', () => {
    const before = {
      parentCount: 2,
      relatedCount: 3,
      edgeCount: 1,
      sentinelHash: 'sentinel',
      scalarHash: 'scalar',
      storageHash: 'storage',
    }
    expect(() =>
      assertSnapshotDelta(
        before,
        { ...before, edgeCount: 0 },
        {
          parentDelta: 0,
          relatedDelta: 0,
          edgeDelta: -1,
        },
        { requireUnchangedState: true },
      ),
    ).not.toThrow()
    expect(() =>
      assertSnapshotDelta(
        before,
        { ...before, parentCount: 3, scalarHash: 'changed' },
        { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
        { requireUnchangedState: true },
      ),
    ).toThrow(/parentCount|scalar/i)
  })

  it('cannot finalize PASS before gate completion and post-cleanup verification', () => {
    const ledger = new Gap08RunLedger('run-static')
    ledger.recordPhase('source-verified')
    expect(() => ledger.finalize()).toThrow(/gate completion/i)
    ledger.markGateCompleted({ scenarioCount: 76 })
    expect(() => ledger.finalize()).toThrow(/post-cleanup/i)
    ledger.markCleanupCompleted(GAP08_CLEANUP_STEPS)
    expect(() => ledger.finalize()).toThrow(/post-cleanup/i)
    ledger.markPostCleanupVerified({ sourceRestored: true })
    expect(ledger.finalize()).toMatchObject({ status: 'PASS' })

    const red = new Gap08RunLedger('run-red')
    red.recordFailure(new Error('synthetic RED'))
    red.markCleanupCompleted(GAP08_CLEANUP_STEPS)
    red.markPostCleanupVerified({ sourceRestored: true })
    expect(red.finalize()).toMatchObject({ status: 'RED' })
  })

  it('keeps bounded RED diagnostics outside the disposable root', () => {
    const disposableRoot = '/tmp/tks-gap08-heavy-fixture'
    expect(() =>
      assertExternalReportPath(
        disposableRoot,
        '/tmp/tks-gap08-heavy-report.json',
      ),
    ).not.toThrow()
    expect(() =>
      assertExternalReportPath(
        disposableRoot,
        path.join(disposableRoot, 'report.json'),
      ),
    ).toThrow(/outside/i)
    expect(boundedDiagnostic('x'.repeat(100), 16)).toBe('x'.repeat(16))
  })

  it('derives physical join catalog checks without treating relation fields as columns', () => {
    const contract = physicalJoinCatalogContract({
      tableName: '_SyntheticRelation',
      localColumn: 'A',
      relatedColumn: 'B',
      columns: [
        {
          name: 'A',
          referencesTableName: 'mapped_alpha',
          referencesColumnName: 'id',
        },
        {
          name: 'B',
          referencesTableName: 'mapped_beta',
          referencesColumnName: 'id',
        },
      ],
      requiredCatalogForeignKeys: 2,
      requiredUniqueColumns: ['A', 'B'],
    })
    expect(contract.tableName).toBe('_SyntheticRelation')
    expect(contract.expectedColumns).toEqual(['A', 'B'])
    expect(contract.catalogQueries.join('\n')).toContain('pg_constraint')
    expect(contract.catalogQueries.join('\n')).toContain('pg_attribute')
    expect(contract.catalogQueries.join('\n')).not.toContain('nearForeignKey')
  })

  it('statically requires generated-plan consumption and finite restoration', async () => {
    const files = [
      'scripts/validate-gap08-relationship-matrix.mjs',
      'scripts/fixtures/gap08-runtime-worker.mjs',
      'scripts/fixtures/gap08-browser-worker.mjs',
    ]
    const [wrapper, runtimeWorker, browserWorker] = await Promise.all(
      files.map((file) => readFile(file, 'utf8')),
    )
    const implementation = [wrapper, runtimeWorker, browserWorker].join('\n')

    expect(wrapper).toContain('GAP08_HEAVY_CLEARANCE')
    expect(wrapper).toContain(
      "readFile(path.join(fixtureRoot, '.cms/admin-meta.json')",
    )
    expect(wrapper).toContain(
      "readFile(path.join(fixtureRoot, '.cms/schema.prisma')",
    )
    expect(wrapper).toContain('deriveGap08RelationshipMatrix')
    expect(wrapper).toContain('gap08ScenarioPlan')
    expect(wrapper).toContain('assertGeneratedExecutionPlan')
    expect(wrapper).toContain('terminateChildGroup')
    expect(wrapper).toContain('verifyDatabaseAbsent')
    expect(wrapper).toContain('markPostCleanupVerified')
    expect(runtimeWorker).toContain(
      'for (const scenario of executionPlan.scenarios)',
    )
    expect(runtimeWorker).toContain('pg_blocking_pids')
    expect(runtimeWorker).toContain('gap08ReleaseConcurrencyHandshake')
    expect(browserWorker).toContain('deriveGap08RelationshipMatrix')
    expect(browserWorker).toContain('returnedId')
    expect(browserWorker).toContain('routeId')
    expect(implementation).not.toMatch(/\b(?:Todo|Article|Author)\b/)
    expect(implementation).not.toContain('delete-referential')
  })
})
