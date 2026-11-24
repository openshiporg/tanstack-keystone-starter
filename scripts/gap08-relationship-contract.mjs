import assert from 'node:assert/strict'

export const GAP08_PRISMA_IMPLICIT_M2M_CONVENTION = Object.freeze({
  derivation: 'prisma-implicit-many-to-many-v2',
  tablePrefix: '_',
  columns: Object.freeze(['A', 'B']),
  ordering: 'lexical-prisma-model-name',
  referencedColumn: 'id',
})

export const GAP08_CONCURRENCY_HANDSHAKE = Object.freeze({
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

function asRecord(value, description) {
  assert.ok(
    value && typeof value === 'object' && !Array.isArray(value),
    `${description} must be an object`,
  )
  return value
}

function requiredString(value, description) {
  assert.equal(typeof value, 'string', `${description} must be a string`)
  assert.ok(value.trim().length > 0, `${description} must be nonempty`)
  return value
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function relationshipCardinality(many, oppositeMany) {
  if (many && oppositeMany) return 'many-to-many'
  if (many) return 'one-to-many'
  if (oppositeMany) return 'many-to-one'
  return 'one-to-one'
}

function fieldByPath(list, fieldPath) {
  return list.fields?.find((field) => field.path === fieldPath)
}

function storageModelName(list) {
  return list.prisma?.mapping ?? list.db?.map ?? list.key
}

function uniqueSelectors(list) {
  return Object.entries(list.resolvedDbFields ?? {})
    .filter(([, field]) => field?.isUnique === true)
    .map(([fieldPath]) => fieldPath)
    .filter((fieldPath) => fieldByPath(list, fieldPath))
    .sort()
}

function prismaModelBlock(prismaSchema, listKey) {
  const matches = [
    ...prismaSchema.matchAll(
      new RegExp(
        `(?:^|\\n)model\\s+${escapeRegExp(listKey)}\\s*\\{[\\s\\S]*?\\n\\}`,
        'g',
      ),
    ),
  ]
  assert.equal(
    matches.length,
    1,
    `${listKey} must have exactly one generated Prisma model`,
  )
  return matches[0][0]
}

function assertMappedModel(prismaSchema, list) {
  const listKey = requiredString(list.key, 'AdminMeta list key')
  const modelName = requiredString(
    storageModelName(list),
    `${listKey} mapped table name`,
  )
  const modelBlock = prismaModelBlock(prismaSchema, listKey)
  const mapDirectives = [
    ...modelBlock.matchAll(/@@map\(("(?:[^"\\]|\\.)*")\)/g),
  ]
  if (modelName === listKey) {
    assert.equal(
      mapDirectives.length,
      0,
      `${listKey} unexpectedly maps to a different physical table`,
    )
  } else {
    assert.equal(
      mapDirectives.length,
      1,
      `${listKey} must have exactly one model @@map directive`,
    )
    assert.equal(
      mapDirectives[0][1],
      JSON.stringify(modelName),
      `${listKey} @@map does not bind ${modelName}`,
    )
  }
  return { modelBlock, modelName }
}

function physicalJoinTable(list, relatedList, relationName) {
  const localModel = requiredString(list.key, 'local Prisma model name')
  const relatedModel = requiredString(
    relatedList.key,
    'related Prisma model name',
  )
  assert.notEqual(
    localModel,
    relatedModel,
    'GAP-08 physical join derivation excludes self relationships',
  )
  const [columnAModel, columnBModel] = [localModel, relatedModel].sort((a, b) =>
    a.localeCompare(b),
  )
  const localColumn = localModel === columnAModel ? 'A' : 'B'
  const relatedColumn = localColumn === 'A' ? 'B' : 'A'
  const listsByKey = new Map([
    [list.key, list],
    [relatedList.key, relatedList],
  ])
  const columnAList = listsByKey.get(columnAModel)
  const columnBList = listsByKey.get(columnBModel)
  assert.ok(columnAList && columnBList)

  return {
    derivation: GAP08_PRISMA_IMPLICIT_M2M_CONVENTION.derivation,
    tableName: `${GAP08_PRISMA_IMPLICIT_M2M_CONVENTION.tablePrefix}${relationName}`,
    localColumn,
    relatedColumn,
    columns: [
      {
        name: 'A',
        listKey: columnAModel,
        referencesTableName: storageModelName(columnAList),
        referencesColumnName:
          GAP08_PRISMA_IMPLICIT_M2M_CONVENTION.referencedColumn,
      },
      {
        name: 'B',
        listKey: columnBModel,
        referencesTableName: storageModelName(columnBList),
        referencesColumnName:
          GAP08_PRISMA_IMPLICIT_M2M_CONVENTION.referencedColumn,
      },
    ],
    requiredCatalogForeignKeys: 2,
    requiredUniqueColumns: ['A', 'B'],
  }
}

function assertStorageEvidence(entry, modelBlock) {
  if (entry.ownership === 'own') {
    assert.ok(
      entry.storage.foreignKeyFieldName,
      `${entry.id} claims ownership without a foreign key field`,
    )
    assert.ok(
      entry.storage.foreignKeyColumnName,
      `${entry.id} claims ownership without a foreign key column mapping`,
    )
    assert.match(
      modelBlock,
      new RegExp(
        `${escapeRegExp(entry.storage.foreignKeyFieldName)}\\s+(?:String|Int)\\?[^\\n]*@map\\(${JSON.stringify(entry.storage.foreignKeyColumnName)}\\)`,
      ),
      `${entry.id} foreign key ownership is absent from generated Prisma schema`,
    )
    assert.equal(
      entry.storage.foreignKeyTableName,
      entry.storage.modelName,
      `${entry.id} foreign key table must be the mapped local table`,
    )
    assert.equal(
      entry.storage.foreignKeyReferencedTableName,
      entry.storage.relatedModelName,
      `${entry.id} foreign key target must be the mapped related table`,
    )
  } else {
    assert.equal(
      entry.storage.foreignKeyFieldName,
      undefined,
      `${entry.id} has ${entry.ownership} ownership but exposes a foreign key`,
    )
  }

  if (entry.ownership === 'shared') {
    assert.ok(
      entry.storage.joinTableName,
      `${entry.id} shared ownership requires a relation name`,
    )
    assert.match(
      modelBlock,
      new RegExp(
        `@relation\\(${JSON.stringify(entry.storage.joinTableName)}\\)`,
      ),
      `${entry.id} shared relation is absent from generated Prisma schema`,
    )
    assert.ok(
      entry.storage.physicalJoinTable,
      `${entry.id} must derive a physical join catalog contract`,
    )
  }
}

const requiredGraphqlNames = [
  'createInputName',
  'createMutationName',
  'deleteMutationName',
  'itemQueryName',
  'listQueryName',
  'updateInputName',
  'updateMutationName',
  'whereUniqueInputName',
]

export function deriveGap08RelationshipMatrix({ adminMeta, prismaSchema }) {
  const meta = asRecord(adminMeta, 'AdminMeta')
  assert.ok(Array.isArray(meta.lists), 'AdminMeta.lists must be an array')
  assert.equal(typeof prismaSchema, 'string', 'Prisma schema must be text')
  assert.ok(prismaSchema.length > 0, 'Prisma schema must not be empty')

  const listStorage = new Map()
  for (const list of meta.lists) {
    const listKey = requiredString(list.key, 'AdminMeta list key')
    requiredString(list.path, `${listKey} list path`)
    requiredString(list.labelField, `${listKey} label field`)
    assert.ok(Array.isArray(list.fields), `${listKey}.fields must be an array`)
    const graphqlNames = asRecord(
      list.graphql?.names ?? list.gqlNames,
      `${listKey}.graphql.names`,
    )
    for (const name of requiredGraphqlNames)
      requiredString(graphqlNames[name], `${listKey}.${name}`)
    listStorage.set(listKey, assertMappedModel(prismaSchema, list))
  }

  const listsByKey = new Map(meta.lists.map((list) => [list.key, list]))
  const matrix = []

  for (const list of meta.lists) {
    const resolvedFields = asRecord(
      list.resolvedDbFields,
      `${list.key}.resolvedDbFields`,
    )
    for (const [fieldPathValue, resolvedField] of Object.entries(
      resolvedFields,
    )) {
      if (resolvedField?.kind !== 'relationship') continue
      const fieldPath = requiredString(
        fieldPathValue,
        `${list.key} relationship field path`,
      )
      const relationship = asRecord(
        resolvedField.relationship,
        `${list.key}.${fieldPath}.relationship`,
      )
      assert.equal(
        relationship.oppositeExists,
        true,
        `${list.key}.${fieldPath} must be a two-sided relationship`,
      )
      const refListKey = requiredString(
        relationship.refListKey,
        `${list.key}.${fieldPath}.refListKey`,
      )
      const refFieldKey = requiredString(
        relationship.refFieldKey,
        `${list.key}.${fieldPath}.refFieldKey`,
      )
      assert.equal(
        typeof relationship.oppositeMany,
        'boolean',
        `${list.key}.${fieldPath} must expose oppositeMany`,
      )
      const relatedList = listsByKey.get(refListKey)
      assert.ok(
        relatedList,
        `${list.key}.${fieldPath} points to missing AdminMeta list ${refListKey}`,
      )
      const adminField = fieldByPath(list, fieldPath)
      assert.ok(
        adminField,
        `${list.key}.${fieldPath} is missing from AdminMeta fields`,
      )
      const fieldMeta = asRecord(
        adminField.fieldMeta,
        `${list.key}.${fieldPath}.fieldMeta`,
      )
      assert.equal(
        fieldMeta.kind,
        'relationship',
        `${list.key}.${fieldPath} fieldMeta kind drifted`,
      )
      assert.equal(
        fieldMeta.refListKey,
        refListKey,
        `${list.key}.${fieldPath} AdminMeta refListKey drifted`,
      )
      assert.equal(
        fieldMeta.refFieldKey,
        refFieldKey,
        `${list.key}.${fieldPath} AdminMeta refFieldKey drifted`,
      )
      assert.equal(
        Boolean(fieldMeta.many),
        relationship.many,
        `${list.key}.${fieldPath} AdminMeta cardinality drifted`,
      )

      const oppositeId = `${refListKey}.${refFieldKey}`
      const id = `${list.key}.${fieldPath}`
      const graphqlNames = list.graphql?.names ?? list.gqlNames
      const selectors = uniqueSelectors(relatedList)
      assert.ok(
        selectors.includes('id'),
        `${id} related list must expose id as a unique selector`,
      )
      const createRequired =
        adminField.isNonNull?.includes('create') === true ||
        adminField.createView?.isRequired === true
      const updateRequired =
        adminField.isNonNull?.includes('update') === true ||
        adminField.itemView?.isRequired === true
      const relationName =
        relationship.ownership === 'shared'
          ? requiredString(
              relationship.joinTableName ?? relationship.relationName,
              `${id} shared relation name`,
            )
          : relationship.relationName

      const entry = {
        id,
        pairId: [id, oppositeId].sort().join('<->'),
        oppositeId,
        listKey: list.key,
        listPath: list.path,
        fieldPath,
        labelField: list.labelField,
        many: relationship.many,
        oppositeMany: relationship.oppositeMany,
        cardinality: relationshipCardinality(
          relationship.many,
          relationship.oppositeMany,
        ),
        ownership: relationship.ownership,
        required: {
          create: createRequired,
          update: updateRequired,
          opposite: { create: false, update: false },
        },
        graphql: Object.fromEntries(
          requiredGraphqlNames.map((name) => [name, graphqlNames[name]]),
        ),
        related: {
          listKey: relatedList.key,
          listPath: relatedList.path,
          fieldPath: refFieldKey,
          labelField: relatedList.labelField,
          uniqueSelectors: selectors,
        },
        storage: {
          modelName: listStorage.get(list.key).modelName,
          relatedModelName: listStorage.get(relatedList.key).modelName,
          relationKind: relationship.relationKind,
          relationName: relationship.relationName,
          foreignKeyFieldName: relationship.foreignKeyFieldName,
          foreignKeyColumnName: relationship.foreignKeyMap,
          foreignKeyScalarType: relationship.foreignKeyScalarType,
          foreignKeyTableName:
            relationship.ownership === 'own'
              ? listStorage.get(list.key).modelName
              : undefined,
          foreignKeyReferencedTableName:
            relationship.ownership === 'own'
              ? listStorage.get(relatedList.key).modelName
              : undefined,
          foreignKeyReferencedColumnName:
            relationship.ownership === 'own'
              ? relationship.referencedDbColumnName
              : undefined,
          joinTableName: relationship.joinTableName,
          relationNearFieldName: relationship.joinTableNearForeignKey,
          relationFarFieldName: relationship.joinTableFarForeignKey,
          physicalJoinTable:
            relationship.ownership === 'shared'
              ? physicalJoinTable(list, relatedList, relationName)
              : undefined,
          onDelete: relationship.onDelete,
          onUpdate: relationship.onUpdate,
        },
      }
      assertStorageEvidence(entry, listStorage.get(list.key).modelBlock)
      matrix.push(entry)
    }
  }

  matrix.sort((left, right) => left.id.localeCompare(right.id))
  const byId = new Map(matrix.map((entry) => [entry.id, entry]))
  for (const entry of matrix) {
    const opposite = byId.get(entry.oppositeId)
    assert.ok(
      opposite,
      `${entry.id} is missing opposite endpoint ${entry.oppositeId}`,
    )
    assert.equal(
      opposite.oppositeId,
      entry.id,
      `${entry.id} opposite is not reciprocal`,
    )
    assert.equal(
      opposite.pairId,
      entry.pairId,
      `${entry.id} pair identity drifted`,
    )
    assert.equal(
      opposite.many,
      entry.oppositeMany,
      `${entry.id} opposite cardinality is contradictory`,
    )
    assert.equal(
      opposite.oppositeMany,
      entry.many,
      `${entry.id} local cardinality is contradictory`,
    )
    if (entry.ownership === 'own')
      assert.equal(
        opposite.ownership,
        'inverse',
        `${entry.id} owned foreign key must have one inverse endpoint`,
      )
    if (entry.ownership === 'inverse')
      assert.equal(
        opposite.ownership,
        'own',
        `${entry.id} inverse relationship must have one owned endpoint`,
      )
    if (entry.ownership === 'shared')
      assert.equal(
        opposite.ownership,
        'shared',
        `${entry.id} shared relationship must have two shared endpoints`,
      )
    entry.required.opposite = {
      create: opposite.required.create,
      update: opposite.required.update,
    }
  }

  return matrix
}

export function assertGap08MatrixCoverage(matrix) {
  assert.ok(Array.isArray(matrix), 'GAP-08 matrix must be an array')
  const exactCardinalityCounts = {
    'one-to-one': 2,
    'one-to-many': 1,
    'many-to-one': 1,
    'many-to-many': 2,
  }
  for (const [cardinality, expected] of Object.entries(
    exactCardinalityCounts,
  )) {
    assert.equal(
      matrix.filter((entry) => entry.cardinality === cardinality).length,
      expected,
      `GAP-08 matrix requires exactly ${expected} ${cardinality} endpoint(s)`,
    )
  }
  for (const [ownership, expected] of Object.entries({
    own: 2,
    inverse: 2,
    shared: 2,
  })) {
    assert.equal(
      matrix.filter((entry) => entry.ownership === ownership).length,
      expected,
      `GAP-08 matrix requires exactly ${expected} ${ownership} endpoint(s)`,
    )
  }
  const pairs = new Set(matrix.map((entry) => entry.pairId))
  assert.equal(pairs.size, 3, 'GAP-08 matrix requires three relationship pairs')
  for (const pairId of pairs)
    assert.equal(
      matrix.filter((entry) => entry.pairId === pairId).length,
      2,
      `${pairId} must contain both relationship sides`,
    )
  for (const entry of matrix) {
    assert.ok(
      entry.related.uniqueSelectors.some((selector) => selector !== 'id'),
      `${entry.id} must derive an arbitrary non-id unique selector`,
    )
    assert.notEqual(
      entry.storage.modelName,
      entry.listKey,
      `${entry.id} must exercise a mapped model name`,
    )
  }
  return true
}

const baseScenarioKinds = [
  'connect',
  'nested-create',
  'invalid-id',
  'invalid-selector',
  'cross-list-id',
  'duplicate-write',
  'conflicting-write',
  'atomic-rollback',
  'unchanged-state',
]

const rejectionErrors = {
  'invalid-id': 'relationship-resolution',
  'invalid-selector': 'graphql-validation',
  'cross-list-id': 'relationship-resolution',
  'conflicting-write': 'relationship-conflict',
  'atomic-rollback': 'transaction-rollback',
  'required-create': 'relationship-required',
  'required-disconnect': 'relationship-required',
  'opposite-required-disconnect': 'relationship-required',
  'opposite-required-set': 'relationship-required',
  'required-delete-related': 'relationship-required',
  'opposite-required-delete-local': 'relationship-required',
}

const replacementFixtureInvariantSources = {
  'required-create': 'local-create-requiredness',
  'required-disconnect': 'local-update-requiredness',
  'opposite-required-disconnect': 'opposite-update-requiredness',
  'opposite-required-set': 'opposite-update-requiredness',
  'required-delete-related': 'local-update-requiredness',
  'opposite-required-delete-local': 'opposite-update-requiredness',
}

function scenarioSemantics(kind) {
  if (kind === 'connect')
    return {
      expectedOutcome: 'success',
      expectedCounts: { parentDelta: 0, relatedDelta: 0, edgeDelta: 1 },
    }
  if (kind === 'nested-create')
    return {
      expectedOutcome: 'success',
      expectedCounts: { parentDelta: 0, relatedDelta: 1, edgeDelta: 1 },
    }
  if (kind === 'disconnect')
    return {
      expectedOutcome: 'success',
      expectedCounts: { parentDelta: 0, relatedDelta: 0, edgeDelta: -1 },
    }
  if (kind === 'set' || kind === 'duplicate-write')
    return {
      expectedOutcome: 'success',
      expectedCounts: { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
    }
  if (kind === 'delete-local')
    return {
      expectedOutcome: 'success',
      expectedCounts: { parentDelta: -1, relatedDelta: 0, edgeDelta: -1 },
    }
  if (kind === 'delete-related')
    return {
      expectedOutcome: 'success',
      expectedCounts: { parentDelta: 0, relatedDelta: -1, edgeDelta: -1 },
    }
  if (kind === 'unchanged-state')
    return {
      expectedOutcome: 'assertion',
      expectedCounts: { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
    }
  const invariantSource = replacementFixtureInvariantSources[kind]
  return {
    expectedOutcome: 'rejection',
    expectedError: rejectionErrors[kind],
    expectedCounts: { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
    ...(invariantSource
      ? {
          invariant:
            'replacement-fixture-required-relationship-must-not-be-nulled',
          invariantSource,
          productRedOnAllowance: true,
        }
      : {}),
  }
}

export function gap08ScenarioPlan(matrix) {
  assertGap08MatrixCoverage(matrix)
  return matrix.flatMap((entry) => {
    const disconnectKind = entry.required.update
      ? 'required-disconnect'
      : entry.required.opposite.update
        ? 'opposite-required-disconnect'
        : 'disconnect'
    const deleteRelatedKind = entry.required.update
      ? 'required-delete-related'
      : 'delete-related'
    const deleteLocalKind = entry.required.opposite.update
      ? 'opposite-required-delete-local'
      : 'delete-local'
    const kinds = [
      ...baseScenarioKinds,
      ...(entry.many
        ? [entry.required.opposite.update ? 'opposite-required-set' : 'set']
        : []),
      disconnectKind,
      deleteLocalKind,
      deleteRelatedKind,
      ...(entry.required.create ? ['required-create'] : []),
    ]
    return kinds.map((kind) => ({
      id: `${entry.id}:${kind}`,
      endpointId: entry.id,
      pairId: entry.pairId,
      kind,
      selector:
        entry.related.uniqueSelectors.find((candidate) => candidate !== 'id') ??
        'id',
      ...scenarioSemantics(kind),
    }))
  })
}
