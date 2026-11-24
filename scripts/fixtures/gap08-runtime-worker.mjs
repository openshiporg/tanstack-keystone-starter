import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'

import { graphql } from 'graphql'
import pg from 'pg'

import {
  assertGeneratedExecutionPlan,
  assertSnapshotDelta,
  boundedDiagnostic,
  captureError,
  physicalJoinCatalogContract,
  sha256,
  waitFor,
  writeJsonAtomic,
} from '../gap08-heavy-lifecycle.mjs'
import {
  assertGap08MatrixCoverage,
  deriveGap08RelationshipMatrix,
  gap08ScenarioPlan,
} from '../gap08-relationship-contract.mjs'

const { Client } = pg
const fixtureRoot = path.resolve('.')
const reportPath = process.env.GAP08_WORKER_REPORT
assert.ok(reportPath, 'GAP08_WORKER_REPORT is required')
assert.ok(
  path.relative(fixtureRoot, path.resolve(reportPath)).startsWith('..'),
  'worker RED evidence must remain outside the disposable fixture',
)
assert.ok(process.env.DATABASE_URL, 'DATABASE_URL is required')

const report = {
  status: 'RUNNING',
  startedAt: new Date().toISOString(),
  currentScenario: null,
  generated: null,
  catalog: [],
  scenarios: [],
  rollbackProbes: [],
  concurrency: null,
  failure: null,
}

function hashJson(value) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex')
}

function quoteIdentifier(value) {
  assert.match(value, /^[A-Za-z_][A-Za-z0-9_]*$/)
  return `"${value.replaceAll('"', '""')}"`
}

function asRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {}
}

function relationSelection(endpoint) {
  return `${endpoint.fieldPath} { id ${endpoint.related.labelField} }`
}

async function main() {
  process.env.CMS_ADAPTER = 'prisma'
  process.env.CMS_BOOTSTRAP_MODE = 'fresh'

  const [adminMetaBytes, prismaSchemaBytes] = await Promise.all([
    readFile(path.join(fixtureRoot, '.cms/admin-meta.json')),
    readFile(path.join(fixtureRoot, '.cms/schema.prisma')),
  ])
  const adminMeta = JSON.parse(adminMetaBytes.toString('utf8'))
  const prismaSchema = prismaSchemaBytes.toString('utf8')
  const matrix = deriveGap08RelationshipMatrix({ adminMeta, prismaSchema })
  assertGap08MatrixCoverage(matrix)
  const scenarios = gap08ScenarioPlan(matrix)
  const executionPlan = assertGeneratedExecutionPlan({
    matrix,
    scenarios,
    adminMetaSha256: sha256(adminMetaBytes),
    prismaSchemaSha256: sha256(prismaSchemaBytes),
  })
  report.generated = {
    provenance: executionPlan.provenance,
    adminMetaSha256: executionPlan.adminMetaSha256,
    prismaSchemaSha256: executionPlan.prismaSchemaSha256,
    endpointIds: executionPlan.endpointIds,
    scenarioIds: executionPlan.scenarioIds,
  }
  await writeJsonAtomic(reportPath, report)

  const [
    adapterModule,
    prismaAdapterModule,
    clientModule,
    registryModule,
    runtimeModule,
  ] = await Promise.all([
    import('../../src/features/cms/adapters/index.ts'),
    import('../../src/features/cms/adapters/prisma.ts'),
    import('../../src/features/cms/prisma-client.ts'),
    import('../../src/features/cms/registry.ts'),
    import('../../src/features/cms/runtime.ts'),
  ])
  const prisma = clientModule.createCmsPrismaClient()
  const cmsLists = registryModule.cmsLists
  const adapter = prismaAdapterModule.createPrismaCmsAdapter({
    prisma,
    lists: cmsLists,
  })
  adapterModule.setCmsAdapterForTests(adapter)
  const schema = runtimeModule.getCmsGraphQLSchema()
  const listConfigByKey = new Map(cmsLists.map((list) => [list.key, list]))
  const metaByKey = new Map(adminMeta.lists.map((list) => [list.key, list]))
  const matrixById = new Map(matrix.map((entry) => [entry.id, entry]))
  const domainKeys = [
    ...new Set(
      matrix.flatMap((entry) => [entry.listKey, entry.related.listKey]),
    ),
  ].sort()
  const observer = new Client({ connectionString: process.env.DATABASE_URL })
  await observer.connect()

  const context = async () =>
    runtimeModule.createCmsContext(
      new Request('http://gap08.local/api/graphql'),
      schema,
    )
  const execute = async (source, variableValues) =>
    graphql({
      schema,
      source,
      variableValues,
      contextValue: await context(),
    })
  const delegate = (listKey) => {
    const prismaKey = listConfigByKey.get(listKey)?.prisma?.listKey
    assert.ok(
      prismaKey && prisma[prismaKey],
      `Missing Prisma delegate ${listKey}`,
    )
    return prisma[prismaKey]
  }

  async function resetDomain() {
    for (const listKey of [...domainKeys].reverse())
      await delegate(listKey).deleteMany({})
  }

  async function createDirect(listKey, code) {
    return delegate(listKey).create({ data: { code } })
  }

  async function connectDirect(endpoint, currentId, relatedId) {
    await delegate(endpoint.listKey).update({
      where: { id: currentId },
      data: { [endpoint.fieldPath]: { connect: { id: relatedId } } },
    })
  }

  async function seedScenario(endpoint, scenario, index) {
    await resetDomain()
    const suffix = `${index}-${Date.now()}`
    const sentinels = {}
    for (const listKey of domainKeys)
      sentinels[listKey] = await createDirect(
        listKey,
        `g8-sentinel-${listKey.toLowerCase()}-${suffix}`,
      )
    const current = await createDirect(endpoint.listKey, `g8-current-${suffix}`)
    const relatedA = await createDirect(
      endpoint.related.listKey,
      `g8-related-a-${suffix}`,
    )
    const relatedB = await createDirect(
      endpoint.related.listKey,
      `g8-related-b-${suffix}`,
    )
    const crossListKey = domainKeys.find(
      (key) => key !== endpoint.listKey && key !== endpoint.related.listKey,
    )
    assert.ok(crossListKey, `${scenario.id} requires a cross-list selector`)
    const cross = await createDirect(crossListKey, `g8-cross-${suffix}`)
    const startsWithoutEdge = [
      'connect',
      'nested-create',
      'required-create',
    ].includes(scenario.kind)
    if (!startsWithoutEdge)
      await connectDirect(endpoint, current.id, relatedA.id)
    return {
      suffix,
      sentinels,
      current,
      relatedA,
      relatedB,
      cross,
      crossListKey,
    }
  }

  async function verifyPhysicalCatalog() {
    const seen = new Set()
    for (const endpoint of matrix.filter(
      (entry) => entry.ownership === 'shared',
    )) {
      const contract = physicalJoinCatalogContract(
        endpoint.storage.physicalJoinTable,
      )
      if (seen.has(contract.tableName)) continue
      seen.add(contract.tableName)
      const [columnsResult, foreignKeysResult, uniqueResult] =
        await Promise.all(
          contract.catalogQueries.map((query) =>
            observer.query(query, [contract.tableName]),
          ),
        )
      const columns = columnsResult.rows.map((row) => row.attname).sort()
      assert.deepEqual(columns, contract.expectedColumns)
      const foreignKeys = foreignKeysResult.rows.map((row) => ({
        column: row.source_column,
        referencesTableName: row.target_table,
        referencesColumnName: row.target_column,
      }))
      for (const expected of contract.expectedForeignKeys)
        assert.ok(
          foreignKeys.some(
            (actual) =>
              actual.column === expected.column &&
              actual.referencesTableName === expected.referencesTableName &&
              actual.referencesColumnName === expected.referencesColumnName,
          ),
          `Missing physical join FK ${JSON.stringify(expected)}`,
        )
      assert.ok(
        uniqueResult.rows.some((row) => {
          const names = Array.isArray(row.array_agg)
            ? row.array_agg
            : String(row.array_agg).replace(/[{}]/g, '').split(',')
          return names.join(',') === 'A,B'
        }),
        `${contract.tableName} is missing the A/B unique catalog key`,
      )
      report.catalog.push({
        tableName: contract.tableName,
        columns,
        foreignKeys,
        uniqueIndexes: uniqueResult.rows,
      })
    }
  }

  async function edgeAndStorage(endpoint, seed) {
    const hydrated = await delegate(endpoint.listKey).findUnique({
      where: { id: seed.current.id },
      include: { [endpoint.fieldPath]: true },
    })
    const relation = hydrated?.[endpoint.fieldPath]
    const edgeCount = endpoint.many
      ? Array.isArray(relation)
        ? relation.length
        : 0
      : relation
        ? 1
        : 0
    let storage
    if (endpoint.ownership === 'shared') {
      const physical = endpoint.storage.physicalJoinTable
      const result = await observer.query(
        `SELECT ${quoteIdentifier(physical.localColumn)}, ${quoteIdentifier(physical.relatedColumn)} FROM ${quoteIdentifier(physical.tableName)} ORDER BY 1, 2`,
      )
      storage = result.rows
    } else {
      const owner =
        endpoint.ownership === 'own'
          ? endpoint
          : matrixById.get(endpoint.oppositeId)
      assert.equal(owner.ownership, 'own')
      const ownerId =
        endpoint.ownership === 'own' ? seed.current.id : seed.relatedA.id
      const result = await observer.query(
        `SELECT ${quoteIdentifier(owner.storage.foreignKeyColumnName)} FROM ${quoteIdentifier(owner.storage.foreignKeyTableName)} WHERE id = $1`,
        [ownerId],
      )
      storage = result.rows
    }
    return { edgeCount, storage }
  }

  async function snapshot(endpoint, seed) {
    const [parentCount, relatedCount, relationState] = await Promise.all([
      delegate(endpoint.listKey).count(),
      delegate(endpoint.related.listKey).count(),
      edgeAndStorage(endpoint, seed),
    ])
    const sentinelRows = []
    for (const [listKey, sentinel] of Object.entries(seed.sentinels)) {
      const row = await delegate(listKey).findUnique({
        where: { id: sentinel.id },
      })
      sentinelRows.push([listKey, row?.id ?? null, row?.code ?? null])
    }
    const current = await delegate(endpoint.listKey).findUnique({
      where: { id: seed.current.id },
    })
    return {
      parentCount,
      relatedCount,
      edgeCount: relationState.edgeCount,
      sentinelHash: hashJson(sentinelRows.sort()),
      scalarHash: hashJson({
        id: current?.id ?? null,
        code: current?.code ?? null,
      }),
      storageHash: hashJson(relationState.storage),
    }
  }

  function selector(endpoint, item) {
    const selectorPath = endpoint.related.uniqueSelectors.find(
      (entry) => entry !== 'id',
    )
    assert.ok(selectorPath, `${endpoint.id} lacks generated non-id selector`)
    return { [selectorPath]: item[selectorPath] }
  }

  async function executeScenario(endpoint, scenario, seed) {
    const opposite = matrixById.get(endpoint.oppositeId)
    assert.ok(opposite)
    const localNames = endpoint.graphql
    const relatedNames = opposite.graphql
    const localWhere = { id: seed.current.id }
    const selectedA = selector(endpoint, seed.relatedA)
    const selectedB = selector(endpoint, seed.relatedB)
    const updateSource = `mutation Gap08Update($where: ${localNames.whereUniqueInputName}!, $data: ${localNames.updateInputName}!) { ${localNames.updateMutationName}(where: $where, data: $data) { id ${endpoint.labelField} ${relationSelection(endpoint)} } }`
    const update = (data) => execute(updateSource, { where: localWhere, data })
    const manyValue = (value) => (endpoint.many ? [value] : value)

    if (scenario.kind === 'unchanged-state')
      return { data: { assertion: true } }
    if (scenario.kind === 'required-create')
      return execute(
        `mutation Gap08RequiredCreate($data: ${localNames.createInputName}!) { ${localNames.createMutationName}(data: $data) { id } }`,
        {
          data: { [endpoint.labelField]: `g8-required-create-${seed.suffix}` },
        },
      )
    if (
      scenario.kind === 'delete-local' ||
      scenario.kind === 'opposite-required-delete-local'
    )
      return execute(
        `mutation Gap08DeleteLocal($where: ${localNames.whereUniqueInputName}!) { ${localNames.deleteMutationName}(where: $where) { id } }`,
        { where: localWhere },
      )
    if (
      scenario.kind === 'delete-related' ||
      scenario.kind === 'required-delete-related'
    )
      return execute(
        `mutation Gap08DeleteRelated($where: ${relatedNames.whereUniqueInputName}!) { ${relatedNames.deleteMutationName}(where: $where) { id } }`,
        { where: { id: seed.relatedA.id } },
      )

    let relationInput
    if (scenario.kind === 'connect')
      relationInput = { connect: manyValue(selectedA) }
    else if (scenario.kind === 'nested-create')
      relationInput = {
        create: manyValue({
          [endpoint.related.labelField]: `g8-nested-${seed.suffix}`,
        }),
      }
    else if (
      scenario.kind === 'set' ||
      scenario.kind === 'opposite-required-set'
    )
      relationInput = { set: [selectedB] }
    else if (
      scenario.kind === 'disconnect' ||
      scenario.kind === 'required-disconnect' ||
      scenario.kind === 'opposite-required-disconnect'
    )
      relationInput = { disconnect: endpoint.many ? [selectedA] : true }
    else if (scenario.kind === 'duplicate-write')
      relationInput = {
        connect: endpoint.many ? [selectedA, selectedA] : selectedA,
      }
    else if (scenario.kind === 'invalid-id')
      relationInput = {
        connect: manyValue({ id: `missing-${seed.suffix}` }),
      }
    else if (scenario.kind === 'invalid-selector')
      relationInput = {
        connect: manyValue({ gap08InvalidSelector: seed.suffix }),
      }
    else if (scenario.kind === 'cross-list-id')
      relationInput = { connect: manyValue({ id: seed.cross.id }) }
    else if (scenario.kind === 'conflicting-write')
      relationInput = endpoint.many
        ? { set: [selectedA], disconnect: [selectedA] }
        : {
            connect: selectedB,
            create: {
              [endpoint.related.labelField]: `g8-conflict-${seed.suffix}`,
            },
          }
    else if (scenario.kind === 'atomic-rollback')
      relationInput = {
        connect: manyValue({ id: `missing-rollback-${seed.suffix}` }),
      }
    else throw new Error(`Unimplemented generated scenario ${scenario.kind}`)

    const changes = { [endpoint.fieldPath]: relationInput }
    if (
      [
        'invalid-id',
        'invalid-selector',
        'cross-list-id',
        'atomic-rollback',
      ].includes(scenario.kind)
    )
      changes[endpoint.labelField] = `g8-must-rollback-${seed.suffix}`
    return update(changes)
  }

  await verifyPhysicalCatalog()

  let scenarioIndex = 0
  for (const scenario of executionPlan.scenarios) {
    const index = scenarioIndex++
    report.currentScenario = scenario.id
    await writeJsonAtomic(reportPath, report)
    const endpoint = matrixById.get(scenario.endpointId)
    assert.ok(endpoint, `${scenario.id} endpoint disappeared`)
    const seed = await seedScenario(endpoint, scenario, index)
    const before = await snapshot(endpoint, seed)
    const result = await executeScenario(endpoint, scenario, seed)
    const errors = result.errors ?? []
    if (scenario.expectedOutcome === 'rejection')
      assert.ok(errors.length > 0, `${scenario.id} allowance is a product RED`)
    else assert.equal(errors.length, 0, `${scenario.id}: ${errors.join('\n')}`)
    const after = await snapshot(endpoint, seed)
    assertSnapshotDelta(before, after, scenario.expectedCounts, {
      requireUnchangedState:
        scenario.expectedOutcome === 'rejection' ||
        scenario.expectedOutcome === 'assertion',
    })
    report.scenarios.push({
      id: scenario.id,
      endpointId: endpoint.id,
      kind: scenario.kind,
      expectedOutcome: scenario.expectedOutcome,
      before,
      after,
      errors: errors.map((error) => ({
        message: boundedDiagnostic(error.message, 2_000),
        code: error.extensions?.code ?? null,
      })),
    })
    report.currentScenario = null
    await writeJsonAtomic(reportPath, report)
  }

  async function rollbackProbe(kind, dataFactory) {
    await resetDomain()
    const parent = matrix.find(
      (entry) =>
        entry.ownership === 'own' &&
        entry.cardinality === 'one-to-one' &&
        matrix.some(
          (candidate) =>
            candidate.listKey === entry.listKey &&
            candidate.ownership === 'shared',
        ),
    )
    assert.ok(parent, 'metadata did not expose rollback parent')
    const sameList = matrix.filter((entry) => entry.listKey === parent.listKey)
    const shared = sameList.find((entry) => entry.ownership === 'shared')
    const inverseMany = sameList.find(
      (entry) => entry.cardinality === 'one-to-many',
    )
    assert.ok(shared && inverseMany)
    const restricted = await createDirect(
      shared.related.listKey,
      'g8-restricted',
    )
    const countsBefore = Object.fromEntries(
      await Promise.all(
        domainKeys.map(async (key) => [key, await delegate(key).count()]),
      ),
    )
    const data = dataFactory({ parent, shared, inverseMany, restricted })
    const result = await execute(
      `mutation Gap08RollbackProbe($data: ${parent.graphql.createInputName}!) { ${parent.graphql.createMutationName}(data: $data) { id } }`,
      { data },
    )
    assert.ok(result.errors?.length, `${kind} must reject`)
    const countsAfter = Object.fromEntries(
      await Promise.all(
        domainKeys.map(async (key) => [key, await delegate(key).count()]),
      ),
    )
    assert.deepEqual(countsAfter, countsBefore, `${kind} left nested rows`)
    report.rollbackProbes.push({ kind, countsBefore, countsAfter })
  }

  await rollbackProbe(
    'access-after-partial-nested-write',
    ({ parent, shared, restricted }) => ({
      [parent.labelField]: 'g8-access-parent',
      [parent.fieldPath]: {
        create: { [parent.related.labelField]: 'g8-access-nested' },
      },
      [shared.fieldPath]: { connect: [{ id: restricted.id }] },
    }),
  )
  await rollbackProbe(
    'hook-after-partial-nested-write',
    ({ parent, inverseMany }) => ({
      [parent.labelField]: 'g8-hook-parent-fail',
      [parent.fieldPath]: {
        create: { [parent.related.labelField]: 'g8-hook-nested-one' },
      },
      [inverseMany.fieldPath]: {
        create: [{ [inverseMany.related.labelField]: 'g8-hook-nested-many' }],
      },
    }),
  )
  await rollbackProbe(
    'missing-selector-after-partial-nested-write',
    ({ parent, shared }) => ({
      [parent.labelField]: 'g8-missing-parent',
      [parent.fieldPath]: {
        create: { [parent.related.labelField]: 'g8-missing-nested' },
      },
      [shared.fieldPath]: {
        connect: [{ id: 'g8-missing-after-partial' }],
      },
    }),
  )

  async function concurrencyProbe() {
    await resetDomain()
    const endpoint = matrix.find(
      (entry) =>
        entry.ownership === 'own' && entry.cardinality === 'one-to-one',
    )
    assert.ok(endpoint, 'generated matrix lacks owned one-to-one endpoint')
    const first = await createDirect(endpoint.listKey, 'g8-race-first-before')
    const second = await createDirect(endpoint.listKey, 'g8-race-second-before')
    const target = await createDirect(
      endpoint.related.listKey,
      'g8-race-target',
    )
    const control = async (source) => execute(source)
    const armed = await control('mutation { gap08ArmConcurrencyHandshake }')
    assert.equal(armed.errors?.length ?? 0, 0)
    const mutation = `mutation Gap08Race($where: ${endpoint.graphql.whereUniqueInputName}!, $data: ${endpoint.graphql.updateInputName}!) { ${endpoint.graphql.updateMutationName}(where: $where, data: $data) { id ${endpoint.labelField} } }`
    const firstPromise = execute(mutation, {
      where: { id: first.id },
      data: {
        [endpoint.labelField]: 'g8-race-first',
        [endpoint.fieldPath]: { connect: { id: target.id } },
      },
    })
    await waitFor(async () => {
      const state = await control('query { gap08ConcurrencyHandshake }')
      return state.data?.gap08ConcurrencyHandshake?.phase === 'held-after-write'
    }, 'first CMS mutation held after write and before commit')
    const secondPromise = execute(mutation, {
      where: { id: second.id },
      data: {
        [endpoint.labelField]: 'g8-race-second',
        [endpoint.fieldPath]: { connect: { id: target.id } },
      },
    })
    const lockGraph = await waitFor(async () => {
      const result = await observer.query(`
        SELECT blocked.pid AS blocked_pid,
               blocker.pid AS blocker_pid,
               blocked.wait_event_type,
               blocked.wait_event,
               blocked.state AS blocked_state,
               blocker.state AS blocker_state,
               blocked.query AS blocked_query
          FROM pg_stat_activity blocked
          CROSS JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS blocker_pid
          JOIN pg_stat_activity blocker ON blocker.pid = blocker_pid
         WHERE blocked.datname = current_database()
           AND blocked.pid <> pg_backend_pid()
      `)
      return result.rows.length === 1 ? result.rows[0] : false
    }, 'second CMS transaction PostgreSQL lock wait')
    assert.ok(lockGraph.blocked_pid && lockGraph.blocker_pid)
    const released = await control(
      'mutation { gap08ReleaseConcurrencyHandshake }',
    )
    assert.equal(released.errors?.length ?? 0, 0)
    const [firstResult, secondResult] = await Promise.all([
      firstPromise,
      secondPromise,
    ])
    assert.equal(firstResult.errors?.length ?? 0, 0)
    assert.ok(secondResult.errors?.length, 'concurrent loser must reject')
    const [firstAfter, secondAfter] = await Promise.all([
      delegate(endpoint.listKey).findUnique({
        where: { id: first.id },
        include: { [endpoint.fieldPath]: true },
      }),
      delegate(endpoint.listKey).findUnique({
        where: { id: second.id },
        include: { [endpoint.fieldPath]: true },
      }),
    ])
    assert.equal(firstAfter[endpoint.labelField], 'g8-race-first')
    assert.equal(firstAfter[endpoint.fieldPath]?.id, target.id)
    assert.equal(secondAfter[endpoint.labelField], 'g8-race-second-before')
    assert.equal(secondAfter[endpoint.fieldPath], null)
    const openTransactions = await observer.query(`
      SELECT count(*)::int AS count
        FROM pg_stat_activity
       WHERE datname = current_database()
         AND pid <> pg_backend_pid()
         AND state = 'idle in transaction'
    `)
    assert.equal(openTransactions.rows[0].count, 0)
    report.concurrency = {
      endpointId: endpoint.id,
      actors: 'two-cms-graphql-adapter-mutations',
      lockGraph,
      loserErrors: secondResult.errors.map((error) => ({
        message: boundedDiagnostic(error.message, 2_000),
        code: error.extensions?.code ?? null,
      })),
      final: {
        winnerId: first.id,
        loserId: second.id,
        targetId: target.id,
        edgeCount: 1,
        openTransactions: 0,
      },
    }
  }

  await concurrencyProbe()
  await resetDomain()
  await prisma.$disconnect()
  await observer.end()
  report.status = 'PASS'
  report.finalizedAt = new Date().toISOString()
  report.currentScenario = null
  await writeJsonAtomic(reportPath, report)
  return report
}

let primaryError
try {
  await main()
} catch (error) {
  primaryError = error
  report.status = 'RED'
  report.failure = captureError(error)
  report.finalizedAt = new Date().toISOString()
  await writeJsonAtomic(reportPath, report).catch(() => {})
}
if (primaryError) throw primaryError
