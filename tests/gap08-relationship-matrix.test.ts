import { readFile } from 'node:fs/promises'

import { describe, expect, it } from 'vitest'

import {
  assertGap08MatrixCoverage,
  deriveGap08RelationshipMatrix,
  GAP08_CONCURRENCY_HANDSHAKE,
  gap08ScenarioPlan,
} from '../scripts/gap08-relationship-contract.mjs'
import gap08FixtureConfig from '../scripts/fixtures/gap08-cms.config'
import { getAdminMeta } from '../src/features/cms/admin-meta'
import { initialiseLists } from '../src/features/cms/config'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema'

function fixtureEvidence() {
  const lists = initialiseLists(gap08FixtureConfig)
  const adminMeta = getAdminMeta(lists)
  const prismaSchema = printCmsPrismaSchema(lists)
  const matrix = deriveGap08RelationshipMatrix({ adminMeta, prismaSchema })
  return { adminMeta, lists, matrix, prismaSchema }
}

describe('GAP-08 metadata-derived relationship matrix', () => {
  it('derives every endpoint and pair from normalized AdminMeta relationship metadata', () => {
    const { matrix } = fixtureEvidence()

    expect(matrix.map((entry) => entry.cardinality)).toEqual([
      'many-to-many',
      'one-to-many',
      'one-to-one',
      'one-to-one',
      'many-to-one',
      'many-to-many',
    ])
    expect(matrix.map((entry) => entry.ownership).sort()).toEqual([
      'inverse',
      'inverse',
      'own',
      'own',
      'shared',
      'shared',
    ])
    expect(new Set(matrix.map((entry) => entry.pairId))).toHaveProperty(
      'size',
      3,
    )
    for (const pairId of new Set(matrix.map((entry) => entry.pairId))) {
      expect(matrix.filter((entry) => entry.pairId === pairId)).toHaveLength(2)
    }
    expect(() => assertGap08MatrixCoverage(matrix)).not.toThrow()
  })

  it('binds nonempty GraphQL/UI names, arbitrary selectors, and mapped tables to actual schema metadata', () => {
    const { matrix, prismaSchema } = fixtureEvidence()

    for (const entry of matrix) {
      expect(entry.listPath.length).toBeGreaterThan(0)
      expect(entry.labelField.length).toBeGreaterThan(0)
      expect(entry.related.listPath.length).toBeGreaterThan(0)
      expect(entry.related.labelField.length).toBeGreaterThan(0)
      expect(entry.graphql.createMutationName).toMatch(/^create/)
      expect(entry.graphql.updateMutationName).toMatch(/^update/)
      expect(entry.graphql.deleteMutationName).toMatch(/^delete/)
      expect(entry.related.uniqueSelectors).toContain('id')
      expect(
        entry.related.uniqueSelectors.some((selector) => selector !== 'id'),
      ).toBe(true)
      expect(entry.storage.modelName).toMatch(/^gap08_/)
      expect(entry.storage.relatedModelName).toMatch(/^gap08_/)
      expect(prismaSchema).toMatch(
        new RegExp(
          `model ${entry.listKey} \\{[\\s\\S]*?@@map\\("${entry.storage.modelName}"\\)[\\s\\S]*?\\n\\}`,
        ),
      )
    }

    const own = matrix.filter((entry) => entry.ownership === 'own')
    expect(own).toHaveLength(2)
    expect(own.every((entry) => entry.storage.foreignKeyFieldName)).toBe(true)
    expect(
      own.every((entry) =>
        entry.storage.foreignKeyColumnName?.startsWith('g8_'),
      ),
    ).toBe(true)
    expect(
      own.every(
        (entry) =>
          entry.storage.foreignKeyTableName === entry.storage.modelName &&
          entry.storage.foreignKeyReferencedTableName ===
            entry.storage.relatedModelName,
      ),
    ).toBe(true)

    const shared = matrix.filter((entry) => entry.ownership === 'shared')
    expect(shared).toHaveLength(2)
    expect(new Set(shared.map((entry) => entry.storage.joinTableName))).toEqual(
      new Set(['Gap08MappedTagLink']),
    )
    expect(
      new Set(
        shared.map((entry) => entry.storage.physicalJoinTable?.tableName),
      ),
    ).toEqual(new Set(['_Gap08MappedTagLink']))
    expect(
      new Set(
        shared.flatMap((entry) => [
          entry.storage.physicalJoinTable?.localColumn,
          entry.storage.physicalJoinTable?.relatedColumn,
        ]),
      ),
    ).toEqual(new Set(['A', 'B']))
    expect(
      shared.every(
        (entry) =>
          entry.storage.physicalJoinTable?.derivation ===
          'prisma-implicit-many-to-many-v2',
      ),
    ).toBe(true)
  })

  it('generates exact success/rejection counts and pair-required bypass cases from metadata', () => {
    const { matrix } = fixtureEvidence()
    const scenarios = gap08ScenarioPlan(matrix)
    const exactSuccessCounts = {
      connect: { parentDelta: 0, relatedDelta: 0, edgeDelta: 1 },
      'nested-create': { parentDelta: 0, relatedDelta: 1, edgeDelta: 1 },
      set: { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
      disconnect: { parentDelta: 0, relatedDelta: 0, edgeDelta: -1 },
      'duplicate-write': { parentDelta: 0, relatedDelta: 0, edgeDelta: 0 },
      'delete-local': { parentDelta: -1, relatedDelta: 0, edgeDelta: -1 },
      'delete-related': { parentDelta: 0, relatedDelta: -1, edgeDelta: -1 },
    } as const

    for (const entry of matrix) {
      const endpointScenarios = scenarios.filter(
        (scenario) => scenario.endpointId === entry.id,
      )
      const kinds = endpointScenarios.map((scenario) => scenario.kind)
      expect(kinds).toEqual(
        expect.arrayContaining([
          'connect',
          'nested-create',
          'invalid-id',
          'invalid-selector',
          'cross-list-id',
          'duplicate-write',
          'conflicting-write',
          'atomic-rollback',
          'unchanged-state',
        ]),
      )
      expect(kinds.includes('set')).toBe(
        entry.many && !entry.required.opposite.update,
      )
      expect(kinds.includes('opposite-required-set')).toBe(
        entry.many && entry.required.opposite.update,
      )
      expect(kinds.includes('disconnect')).toBe(
        !entry.required.update && !entry.required.opposite.update,
      )
      expect(kinds.includes('required-disconnect')).toBe(entry.required.update)
      expect(kinds.includes('opposite-required-disconnect')).toBe(
        !entry.required.update && entry.required.opposite.update,
      )
      expect(kinds.includes('delete-related')).toBe(!entry.required.update)
      expect(kinds.includes('required-delete-related')).toBe(
        entry.required.update,
      )
      expect(kinds.includes('delete-local')).toBe(
        !entry.required.opposite.update,
      )
      expect(kinds.includes('opposite-required-delete-local')).toBe(
        entry.required.opposite.update,
      )
    }

    for (const scenario of scenarios) {
      if (scenario.kind in exactSuccessCounts) {
        expect(scenario.expectedOutcome).toBe('success')
        expect(scenario.expectedCounts).toEqual(
          exactSuccessCounts[scenario.kind as keyof typeof exactSuccessCounts],
        )
      } else if (scenario.kind === 'unchanged-state') {
        expect(scenario.expectedOutcome).toBe('assertion')
        expect(scenario.expectedCounts).toEqual({
          parentDelta: 0,
          relatedDelta: 0,
          edgeDelta: 0,
        })
      } else {
        expect(scenario.expectedOutcome).toBe('rejection')
        expect(scenario.expectedError).toBeTruthy()
        expect(scenario.expectedCounts).toEqual({
          parentDelta: 0,
          relatedDelta: 0,
          edgeDelta: 0,
        })
        if (scenario.expectedError === 'relationship-required') {
          expect(scenario.invariant).toBe(
            'replacement-fixture-required-relationship-must-not-be-nulled',
          )
          expect(scenario.productRedOnAllowance).toBe(true)
          expect(scenario.invariantSource).toBe(
            scenario.kind === 'required-create'
              ? 'local-create-requiredness'
              : scenario.kind.startsWith('opposite-required')
                ? 'opposite-update-requiredness'
                : 'local-update-requiredness',
          )
        }
      }
    }
  })

  it('keeps create-only requiredness specific and leaves disconnect/delete eligible', () => {
    const { adminMeta, matrix, prismaSchema } = fixtureEvidence()
    const requiredEndpoint = matrix.find((entry) => entry.required.update)
    expect(requiredEndpoint).toBeDefined()
    if (!requiredEndpoint) throw new Error('Missing update-required endpoint')
    const list = adminMeta.lists.find(
      (candidate) => candidate.key === requiredEndpoint.listKey,
    )!
    const field = list.fields.find(
      (candidate) => candidate.path === requiredEndpoint.fieldPath,
    )!
    const createOnlyMeta = {
      ...adminMeta,
      lists: adminMeta.lists.map((candidate) =>
        candidate.key === list.key
          ? {
              ...candidate,
              fields: candidate.fields.map((candidateField) =>
                candidateField.path === field.path
                  ? {
                      ...candidateField,
                      isNonNull: ['create' as const],
                      createView: {
                        ...candidateField.createView,
                        isRequired: true,
                      },
                      itemView: {
                        ...candidateField.itemView,
                        isRequired: false,
                      },
                    }
                  : candidateField,
              ),
            }
          : candidate,
      ),
    }
    const createOnlyMatrix = deriveGap08RelationshipMatrix({
      adminMeta: createOnlyMeta,
      prismaSchema,
    })
    const local = createOnlyMatrix.find(
      (entry) => entry.id === requiredEndpoint.id,
    )!
    const opposite = createOnlyMatrix.find(
      (entry) => entry.id === requiredEndpoint.oppositeId,
    )!
    expect(local.required).toMatchObject({ create: true, update: false })
    expect(opposite.required.opposite).toMatchObject({
      create: true,
      update: false,
    })

    const scenarios = gap08ScenarioPlan(createOnlyMatrix)
    const localKinds = scenarios
      .filter((scenario) => scenario.endpointId === local.id)
      .map((scenario) => scenario.kind)
    const oppositeKinds = scenarios
      .filter((scenario) => scenario.endpointId === opposite.id)
      .map((scenario) => scenario.kind)
    expect(localKinds).toEqual(
      expect.arrayContaining([
        'required-create',
        'disconnect',
        'delete-related',
      ]),
    )
    expect(localKinds).not.toContain('required-disconnect')
    expect(localKinds).not.toContain('required-delete-related')
    expect(oppositeKinds).toEqual(
      expect.arrayContaining(['disconnect', 'delete-local']),
    )
    expect(oppositeKinds).not.toContain('opposite-required-disconnect')
    expect(oppositeKinds).not.toContain('opposite-required-delete-local')
  })

  it('requires an after-write CMS GraphQL concurrency handshake and catalog lock oracle', async () => {
    const [fixtureSource, planSource] = await Promise.all([
      readFile('scripts/fixtures/gap08-cms.config.ts', 'utf8'),
      readFile('reports/gap-08-relationship-matrix-plan.md', 'utf8'),
    ])

    expect(GAP08_CONCURRENCY_HANDSHAKE).toMatchObject({
      actors: 'two-cms-graphql-adapter-mutations',
      holdPoint: 'after-operation-write-before-transaction-commit',
      observer: 'postgresql-pg-blocking-pids-lock-graph',
      timeoutRole: 'failure-bound-only',
    })
    expect(fixtureSource).toContain('gap08ArmConcurrencyHandshake')
    expect(fixtureSource).toContain('gap08ReleaseConcurrencyHandshake')
    expect(fixtureSource).toContain('held-after-write')
    expect(fixtureSource).toContain('released-before-commit')
    expect(fixtureSource).toMatch(/afterOperation:[\s\S]*update:/)
    expect(fixtureSource).not.toMatch(/beforeOperation:[\s\S]*Race/)
    expect(fixtureSource).not.toMatch(/await\s+sleep|setTimeout\(resolve/)
    expect(fixtureSource).not.toMatch(/\$executeRaw|\bUPDATE\s+gap08_/)
    expect(planSource).toContain('two concurrent CMS GraphQL mutations')
    expect(planSource).toContain(
      'direct PostgreSQL writes are forbidden as actors',
    )
    expect(planSource).toContain('pg_blocking_pids')
    expect(planSource).toContain('failure bound only')
    expect(planSource).toContain('not a blanket Keystone parity statement')
  })

  it('rejects empty executable names instead of trusting the declaration', () => {
    const { adminMeta, prismaSchema } = fixtureEvidence()
    const [firstList, ...remaining] = adminMeta.lists
    expect(firstList).toBeDefined()
    const invalid = {
      ...adminMeta,
      lists: [
        {
          ...firstList!,
          path: '',
          graphql: {
            ...firstList!.graphql,
            names: {
              ...firstList!.graphql.names,
              createMutationName: '',
            },
          },
        },
        ...remaining,
      ],
    }
    expect(() =>
      deriveGap08RelationshipMatrix({ adminMeta: invalid, prismaSchema }),
    ).toThrow(/path|createMutationName|nonempty/i)
  })

  it('rejects stale or contradictory AdminMeta/schema ownership evidence', () => {
    const { adminMeta, prismaSchema } = fixtureEvidence()
    const relationshipList = adminMeta.lists.find((list) =>
      Object.values(list.resolvedDbFields).some(
        (field) => field.relationship?.ownership === 'own',
      ),
    )
    expect(relationshipList).toBeDefined()
    const ownedEntry = Object.entries(relationshipList!.resolvedDbFields).find(
      ([, field]) => field.relationship?.ownership === 'own',
    )
    expect(ownedEntry?.[1].relationship).toBeDefined()
    const [ownedPath, ownedField] = ownedEntry!
    const cloned = {
      ...adminMeta,
      lists: adminMeta.lists.map((list) =>
        list.key === relationshipList!.key
          ? {
              ...list,
              resolvedDbFields: {
                ...list.resolvedDbFields,
                [ownedPath]: {
                  ...ownedField,
                  relationship: {
                    ...ownedField.relationship!,
                    ownership: 'inverse' as const,
                  },
                },
              },
            }
          : list,
      ),
    }

    expect(() =>
      deriveGap08RelationshipMatrix({ adminMeta: cloned, prismaSchema }),
    ).toThrow(/ownership|foreign key/i)
  })

  it('keeps the candidate boundary synthetic and free of accepted demo-model assumptions', async () => {
    const candidateFiles = [
      'scripts/gap08-relationship-contract.mjs',
      'scripts/fixtures/gap08-cms.config.ts',
      'scripts/validate-gap08-relationship-metadata.ts',
    ]
    const source = (
      await Promise.all(candidateFiles.map((file) => readFile(file, 'utf8')))
    ).join('\n')

    for (const forbidden of ['Todo', 'Article', 'Author']) {
      expect(source).not.toContain(forbidden)
    }
    expect(source).toContain('deriveGap08RelationshipMatrix')
    expect(source).toContain('resolvedDbFields')
  })
})
