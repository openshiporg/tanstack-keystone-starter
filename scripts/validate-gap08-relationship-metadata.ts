import assert from 'node:assert/strict'

import {
  assertGap08MatrixCoverage,
  deriveGap08RelationshipMatrix,
  GAP08_CONCURRENCY_HANDSHAKE,
  gap08ScenarioPlan,
} from './gap08-relationship-contract.mjs'
import gap08FixtureConfig from './fixtures/gap08-cms.config'
import { getAdminMeta } from '../src/features/cms/admin-meta'
import { initialiseLists } from '../src/features/cms/config'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'

const lists = initialiseLists(gap08FixtureConfig)
const adminMeta = getAdminMeta(lists)
const prismaSchema = printCmsPrismaSchema(lists)
const matrix = deriveGap08RelationshipMatrix({ adminMeta, prismaSchema })
assertGap08MatrixCoverage(matrix)
const scenarios = gap08ScenarioPlan(matrix)

assert.equal(matrix.length, 6, 'expected six metadata-derived endpoints')
assert.equal(scenarios.length, 76, 'expected the exact focused scenario count')
assert.equal(
  scenarios.filter((scenario) => scenario.kind === 'set').length,
  matrix.filter((entry) => entry.many).length,
  'set scenarios must be generated only for to-many endpoints',
)
assert.equal(
  scenarios.filter((scenario) => scenario.kind === 'required-create').length,
  matrix.filter((entry) => entry.required.create).length,
  'required-create scenarios must follow normalized AdminMeta',
)
assert.ok(
  matrix.every((entry) =>
    [
      entry.listKey,
      entry.listPath,
      entry.labelField,
      entry.related.listKey,
      entry.related.listPath,
      entry.related.labelField,
      ...Object.values(entry.graphql),
    ].every((value) => typeof value === 'string' && value.length > 0),
  ),
  'every endpoint must have nonempty executable metadata names and paths',
)
assert.ok(
  matrix.every((entry) =>
    entry.related.uniqueSelectors.some((selector) => selector !== 'id'),
  ),
  'every endpoint must derive an arbitrary non-id related selector',
)
assert.ok(
  matrix.every(
    (entry) =>
      entry.storage.modelName.startsWith('gap08_') &&
      entry.storage.relatedModelName.startsWith('gap08_'),
  ),
  'every endpoint must bind custom mapped tables through generated Prisma schema',
)

const locallyUpdateRequired = matrix.filter((entry) => entry.required.update)
const oppositeUpdateRequired = matrix.filter(
  (entry) => !entry.required.update && entry.required.opposite.update,
)
assert.equal(
  locallyUpdateRequired.length,
  1,
  'fixture must expose one locally update/item-required endpoint',
)
assert.equal(
  oppositeUpdateRequired.length,
  1,
  'fixture must propagate update/item requiredness to one inverse endpoint',
)
for (const entry of locallyUpdateRequired) {
  const kinds = scenarios
    .filter((scenario) => scenario.endpointId === entry.id)
    .map((scenario) => scenario.kind)
  assert.ok(
    !kinds.includes('disconnect') &&
      kinds.includes('required-disconnect') &&
      !kinds.includes('delete-related') &&
      kinds.includes('required-delete-related'),
    `${entry.id} must reject local update-required disconnect/delete-related bypasses`,
  )
}
for (const entry of oppositeUpdateRequired) {
  const kinds = scenarios
    .filter((scenario) => scenario.endpointId === entry.id)
    .map((scenario) => scenario.kind)
  assert.ok(
    !kinds.includes('disconnect') &&
      kinds.includes('opposite-required-disconnect') &&
      !kinds.includes('delete-local') &&
      kinds.includes('opposite-required-delete-local'),
    `${entry.id} must reject inverse-side update-required disconnect/delete-local bypasses`,
  )
}

const exactSuccessfulCounts = {
  connect: { parentDelta: 0, relatedDelta: 0, edgeDelta: 1 },
  'nested-create': { parentDelta: 0, relatedDelta: 1, edgeDelta: 1 },
  set: { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
  disconnect: { parentDelta: 0, relatedDelta: 0, edgeDelta: -1 },
  'duplicate-write': { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
  'delete-local': { parentDelta: -1, relatedDelta: 0, edgeDelta: -1 },
  'delete-related': { parentDelta: 0, relatedDelta: -1, edgeDelta: -1 },
} as const

for (const scenario of scenarios) {
  if (scenario.kind in exactSuccessfulCounts) {
    assert.equal(
      scenario.expectedOutcome,
      'success',
      `${scenario.id} must be successful`,
    )
    assert.deepEqual(
      scenario.expectedCounts,
      exactSuccessfulCounts[
        scenario.kind as keyof typeof exactSuccessfulCounts
      ],
      `${scenario.id} has incorrect exact count deltas`,
    )
    continue
  }
  if (scenario.kind === 'unchanged-state') {
    assert.equal(scenario.expectedOutcome, 'assertion')
    assert.deepEqual(scenario.expectedCounts, {
      parentDelta: 0,
      relatedDelta: 0,
      edgeDelta: 0,
    })
    continue
  }
  assert.equal(
    scenario.expectedOutcome,
    'rejection',
    `${scenario.id} must reject`,
  )
  assert.ok(scenario.expectedError, `${scenario.id} must classify its error`)
  assert.deepEqual(
    scenario.expectedCounts,
    { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
    `${scenario.id} rejection must preserve all counts`,
  )
  if (scenario.expectedError === 'relationship-required') {
    assert.equal(
      scenario.invariant,
      'replacement-fixture-required-relationship-must-not-be-nulled',
    )
    assert.equal(
      scenario.invariantSource,
      scenario.kind === 'required-create'
        ? 'local-create-requiredness'
        : scenario.kind.startsWith('opposite-required')
          ? 'opposite-update-requiredness'
          : 'local-update-requiredness',
    )
    assert.equal(
      scenario.productRedOnAllowance,
      true,
      `${scenario.id} allowance must be treated as a bounded replacement-product RED`,
    )
  }
}

const requiredEndpoint = locallyUpdateRequired[0]
const requiredList = adminMeta.lists.find(
  (entry) => entry.key === requiredEndpoint.listKey,
)!
const requiredField = requiredList.fields.find(
  (field) => field.path === requiredEndpoint.fieldPath,
)!
const createOnlyAdminMeta = {
  ...adminMeta,
  lists: adminMeta.lists.map((entry) =>
    entry.key === requiredList.key
      ? {
          ...entry,
          fields: entry.fields.map((field) =>
            field.path === requiredField.path
              ? {
                  ...field,
                  isNonNull: ['create' as const],
                  createView: { ...field.createView, isRequired: true },
                  itemView: { ...field.itemView, isRequired: false },
                }
              : field,
          ),
        }
      : entry,
  ),
}
const createOnlyMatrix = deriveGap08RelationshipMatrix({
  adminMeta: createOnlyAdminMeta,
  prismaSchema,
})
const createOnlyScenarios = gap08ScenarioPlan(createOnlyMatrix)
const createOnlyLocal = createOnlyMatrix.find(
  (entry) => entry.id === requiredEndpoint.id,
)!
const createOnlyOpposite = createOnlyMatrix.find(
  (entry) => entry.id === requiredEndpoint.oppositeId,
)!
assert.equal(createOnlyLocal.required.create, true)
assert.equal(createOnlyLocal.required.update, false)
assert.equal(createOnlyOpposite.required.opposite.create, true)
assert.equal(createOnlyOpposite.required.opposite.update, false)
for (const endpoint of [createOnlyLocal, createOnlyOpposite]) {
  const kinds = createOnlyScenarios
    .filter((scenario) => scenario.endpointId === endpoint.id)
    .map((scenario) => scenario.kind)
  assert.ok(
    kinds.includes('disconnect'),
    `${endpoint.id} create-only requiredness must leave disconnect eligible`,
  )
}
assert.ok(
  createOnlyScenarios.some(
    (scenario) =>
      scenario.endpointId === createOnlyLocal.id &&
      scenario.kind === 'required-create',
  ),
  'create-only requiredness must retain required-create denial',
)

assert.deepEqual(GAP08_CONCURRENCY_HANDSHAKE, {
  actors: 'two-cms-graphql-adapter-mutations',
  holdPoint: 'after-operation-write-before-transaction-commit',
  firstPhase: 'held-after-write',
  observer: 'postgresql-pg-blocking-pids-lock-graph',
  releaseOperation: 'gap08ReleaseConcurrencyHandshake',
  releasePhase: 'released-before-commit',
  timeoutRole: 'failure-bound-only',
  loserClassification: 'graphql-error-plus-unchanged-row',
  finalState: 'one-edge-no-orphan-no-open-transaction',
})

const shared = matrix.filter((entry) => entry.ownership === 'shared')
assert.equal(shared.length, 2, 'expected both shared endpoints')
for (const entry of shared) {
  const physical = entry.storage.physicalJoinTable
  assert.ok(physical, `${entry.id} must derive physical join catalog evidence`)
  assert.equal(physical.tableName, `_${entry.storage.joinTableName}`)
  assert.deepEqual(
    new Set(physical.columns.map((column) => column.name)),
    new Set(['A', 'B']),
  )
  assert.equal(physical.requiredCatalogForeignKeys, 2)
  assert.deepEqual(physical.requiredUniqueColumns, ['A', 'B'])
  for (const column of physical.columns) {
    assert.ok(column.referencesTableName.startsWith('gap08_'))
    assert.equal(column.referencesColumnName, 'id')
  }
}

console.info(
  JSON.stringify(
    {
      concurrency: GAP08_CONCURRENCY_HANDSHAKE,
      endpoints: matrix.map((entry) => ({
        id: entry.id,
        pairId: entry.pairId,
        cardinality: entry.cardinality,
        ownership: entry.ownership,
        required: entry.required,
        selectors: entry.related.uniqueSelectors,
        storage: entry.storage,
      })),
      rejectionCount: scenarios.filter(
        (scenario) => scenario.expectedOutcome === 'rejection',
      ).length,
      scenarioCount: scenarios.length,
    },
    null,
    2,
  ),
)
