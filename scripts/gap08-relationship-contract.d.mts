export type Gap08Cardinality =
  | 'one-to-one'
  | 'one-to-many'
  | 'many-to-one'
  | 'many-to-many'

export type Gap08Ownership = 'own' | 'inverse' | 'shared'

export const GAP08_PRISMA_IMPLICIT_M2M_CONVENTION: Readonly<{
  derivation: 'prisma-implicit-many-to-many-v2'
  tablePrefix: '_'
  columns: readonly ['A', 'B']
  ordering: 'lexical-prisma-model-name'
  referencedColumn: 'id'
}>

export const GAP08_CONCURRENCY_HANDSHAKE: Readonly<{
  actors: 'two-cms-graphql-adapter-mutations'
  holdPoint: 'after-operation-write-before-transaction-commit'
  firstPhase: 'held-after-write'
  observer: 'postgresql-pg-blocking-pids-lock-graph'
  releaseOperation: 'gap08ReleaseConcurrencyHandshake'
  releasePhase: 'released-before-commit'
  timeoutRole: 'failure-bound-only'
  loserClassification: 'graphql-error-plus-unchanged-row'
  finalState: 'one-edge-no-orphan-no-open-transaction'
}>

export type Gap08Requiredness = {
  create: boolean
  update: boolean
}

export type Gap08PhysicalJoinColumn = {
  name: 'A' | 'B'
  listKey: string
  referencesTableName: string
  referencesColumnName: 'id'
}

export type Gap08PhysicalJoinTable = {
  derivation: 'prisma-implicit-many-to-many-v2'
  tableName: string
  localColumn: 'A' | 'B'
  relatedColumn: 'A' | 'B'
  columns: [Gap08PhysicalJoinColumn, Gap08PhysicalJoinColumn]
  requiredCatalogForeignKeys: 2
  requiredUniqueColumns: ['A', 'B']
}

export type Gap08RelationshipEndpoint = {
  id: string
  pairId: string
  oppositeId: string
  listKey: string
  listPath: string
  fieldPath: string
  labelField: string
  many: boolean
  oppositeMany: boolean
  cardinality: Gap08Cardinality
  ownership: Gap08Ownership
  required: Gap08Requiredness & { opposite: Gap08Requiredness }
  graphql: {
    createInputName: string
    createMutationName: string
    deleteMutationName: string
    itemQueryName: string
    listQueryName: string
    updateInputName: string
    updateMutationName: string
    whereUniqueInputName: string
  }
  related: {
    listKey: string
    listPath: string
    fieldPath: string
    labelField: string
    uniqueSelectors: string[]
  }
  storage: {
    modelName: string
    relatedModelName: string
    relationKind: 'one' | 'many' | 'manyToMany'
    relationName?: string
    foreignKeyFieldName?: string
    foreignKeyColumnName?: string
    foreignKeyScalarType?: 'String' | 'Int'
    foreignKeyTableName?: string
    foreignKeyReferencedTableName?: string
    foreignKeyReferencedColumnName?: 'id'
    joinTableName?: string
    relationNearFieldName?: string
    relationFarFieldName?: string
    physicalJoinTable?: Gap08PhysicalJoinTable
    onDelete?: 'SetNull'
    onUpdate?: 'Cascade'
  }
}

export type Gap08ScenarioKind =
  | 'connect'
  | 'nested-create'
  | 'set'
  | 'disconnect'
  | 'invalid-id'
  | 'invalid-selector'
  | 'cross-list-id'
  | 'duplicate-write'
  | 'conflicting-write'
  | 'atomic-rollback'
  | 'unchanged-state'
  | 'delete-local'
  | 'delete-related'
  | 'required-create'
  | 'required-disconnect'
  | 'opposite-required-disconnect'
  | 'opposite-required-set'
  | 'required-delete-related'
  | 'opposite-required-delete-local'

export type Gap08Scenario = {
  id: string
  endpointId: string
  pairId: string
  kind: Gap08ScenarioKind
  selector: string
  expectedOutcome: 'success' | 'rejection' | 'assertion'
  expectedError?:
    | 'relationship-resolution'
    | 'graphql-validation'
    | 'relationship-conflict'
    | 'transaction-rollback'
    | 'relationship-required'
  expectedCounts: {
    parentDelta: number
    relatedDelta: number
    edgeDelta: number
  }
  invariant?: 'replacement-fixture-required-relationship-must-not-be-nulled'
  invariantSource?:
    | 'local-create-requiredness'
    | 'local-update-requiredness'
    | 'opposite-update-requiredness'
  productRedOnAllowance?: true
}

export function deriveGap08RelationshipMatrix(input: {
  adminMeta: unknown
  prismaSchema: string
}): Gap08RelationshipEndpoint[]

export function assertGap08MatrixCoverage(
  matrix: Gap08RelationshipEndpoint[],
): true

export function gap08ScenarioPlan(
  matrix: Gap08RelationshipEndpoint[],
): Gap08Scenario[]
