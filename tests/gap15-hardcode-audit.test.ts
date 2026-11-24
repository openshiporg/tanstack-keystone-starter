import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import nodePath from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  auditGap15Files,
  fingerprintGap15Matches,
  fingerprintGap15Source,
  runGap15RepositoryAudit,
  scanGap15Source,
} from '../scripts/validate-gap15-hardcodes'
import type {
  Gap15Allowlist,
  Gap15Classification,
} from '../scripts/validate-gap15-hardcodes'

const emptyAllowlist = (): Gap15Allowlist => ({
  version: 1,
  classifications: [],
  evidenceBindings: [],
})

function classification(
  path: string,
  source: string,
  category: Gap15Classification['category'],
): Gap15Classification {
  const matches = scanGap15Source(path, source)
  return {
    path,
    category,
    reason: 'Explicit test classification with an exact literal inventory.',
    expectedMatchCount: matches.length,
    matchFingerprint: fingerprintGap15Matches(matches),
    sourceFingerprint: fingerprintGap15Source(source),
  }
}

describe('GAP-15 hard-code audit', () => {
  it('finds direct starter models, generated names, routes, seed IDs, and model modules', () => {
    const matches = scanGap15Source(
      'scripts/example.ts',
      [
        "const model = 'Todo'",
        "const mutation = 'createTodo'",
        "const route = '/dashboard/todos/create'",
        "const id = 'user_admin'",
        "const modulePath = './Todo'",
      ].join('\n'),
    )

    expect(matches.map((match) => `${match.kind}:${match.value}`)).toEqual([
      'model-key:Todo',
      'generated-name:createTodo',
      'dashboard-route:todos',
      'demo-seed-id:user_admin',
      'model-module:./Todo',
    ])
  })

  it('finds model and generated tokens embedded in GraphQL strings', () => {
    const matches = scanGap15Source(
      'src/features/cms/generic-query.ts',
      `const query = /* GraphQL */ \`
        mutation CreateItem($data: TodoCreateInput!) {
          createTodo(data: $data) {
            ... on Todo { id }
          }
        }
      \``,
    )

    expect(matches.map((match) => `${match.kind}:${match.value}`)).toEqual(
      expect.arrayContaining([
        'generated-name:TodoCreateInput',
        'generated-name:createTodo',
        'model-key:Todo',
      ]),
    )
  })

  it('folds static composition/templates and finds exact model identifiers', () => {
    const matches = scanGap15Source(
      'src/features/cms/generic-query.ts',
      [
        "const suffix = 'do'",
        "const listKey = 'To' + suffix",
        "const mutation = `create${'To' + suffix}`",
        'const Todo = registry[listKey]',
      ].join('\n'),
    )

    expect(matches.map((match) => `${match.kind}:${match.value}`)).toEqual(
      expect.arrayContaining([
        'model-key:Todo',
        'generated-name:createTodo',
        'model-identifier:Todo',
      ]),
    )
  })

  it('finds JSX text, regex routes, embedded values, and scope-correct shadowed composition', () => {
    const matches = scanGap15Source(
      'tools/generic.tsx',
      [
        "function unrelated() { const suffix = 'ser'; return 'U' + suffix }",
        "function target() { const suffix = 'do'; return 'To' + suffix }",
        'export const View = () => <span>Todo</span>',
        'const route = /\\/dashboard\\/todos/',
        "const credentials = 'sign in as ada@example.com using todo_launch'",
        'const query = `query Lookup { item(path: "todo-images") { id } }`',
        'const command = \'create users {"name":"Example"}\'',
      ].join('\n'),
    )
    const inventory = matches.map((match) => `${match.kind}:${match.value}`)

    expect(inventory).toEqual(
      expect.arrayContaining([
        'model-key:User',
        'model-key:Todo',
        'dashboard-route:todos',
        'demo-persona:ada@example.com',
        'demo-seed-id:todo_launch',
        'starter-list-slug:todo-images',
        'starter-list-slug:users',
      ]),
    )
  })

  it('rejects unclassified literals and stale allowlist entries', () => {
    const source = "export const listKey = 'Todo'"
    const unclassified = auditGap15Files(
      { 'cms.seed.ts': source },
      emptyAllowlist(),
    )
    expect(unclassified.issues.map((issue) => issue.code)).toContain(
      'unclassified-literal',
    )

    const staleEntry = classification('cms.seed.ts', source, 'expected-demo')
    const stale = auditGap15Files(
      { 'cms.seed.ts': 'export const listKey = getListKey()' },
      {
        ...emptyAllowlist(),
        classifications: [staleEntry],
      },
    )
    expect(stale.issues.map((issue) => issue.code)).toContain('stale-allowlist')
  })

  it('never permits a demo allowlist to hide a generic runtime assumption', () => {
    const path = 'src/features/cms/runtime-example.ts'
    const source = "export const defaultList = 'Todo'"
    const report = auditGap15Files(
      { [path]: source },
      {
        ...emptyAllowlist(),
        classifications: [classification(path, source, 'expected-demo')],
      },
    )

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'forbidden-generic-assumption',
          path,
        }),
      ]),
    )
  })

  it('fails when non-literal source changes behind the same match inventory', () => {
    const path = 'cms.seed.ts'
    const source = "export const listKey = 'Todo'\nrunFixture(1)"
    const changed = "export const listKey = 'Todo'\nrunFixture(2)"
    const report = auditGap15Files(
      { [path]: changed },
      {
        ...emptyAllowlist(),
        classifications: [classification(path, source, 'expected-demo')],
      },
    )

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'stale-allowlist', path }),
      ]),
    )
  })

  it('keeps demo and approved source-oracle classifications distinct', () => {
    const demoPath = 'cms.seed.ts'
    const demoSource = "export const item = { id: 'todo_launch' }"
    const oraclePath = 'scripts/audit-next-model-portability.mjs'
    const oracleSource = "const models = ['User', 'Role', 'Todo', 'TodoImage']"
    const allowlist: Gap15Allowlist = {
      ...emptyAllowlist(),
      classifications: [
        classification(demoPath, demoSource, 'expected-demo'),
        classification(oraclePath, oracleSource, 'expected-source-oracle'),
      ],
    }

    expect(
      auditGap15Files(
        { [demoPath]: demoSource, [oraclePath]: oracleSource },
        allowlist,
      ).issues,
    ).toEqual([])

    const misclassified = auditGap15Files(
      { [demoPath]: demoSource },
      {
        ...emptyAllowlist(),
        classifications: [
          classification(demoPath, demoSource, 'expected-source-oracle'),
        ],
      },
    )
    expect(misclassified.issues.map((issue) => issue.code)).toContain(
      'invalid-classification',
    )
  })

  it('rejects renamed generic scripts, tests, and copied oracles even if fingerprinted', () => {
    for (const renamedPath of [
      'scripts/renamed-generic-fixture.ts',
      'scripts/copied-source-oracle.mjs',
      'tests/renamed-production.test.ts',
    ]) {
      const source = "export const listKey = 'Todo'"
      const report = auditGap15Files(
        { [renamedPath]: source },
        {
          ...emptyAllowlist(),
          classifications: [
            classification(renamedPath, source, 'expected-demo'),
          ],
        },
      )
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'forbidden-generic-assumption',
            path: renamedPath,
          }),
        ]),
      )
    }
  })

  it('rejects unknown classification and evidence enum values at runtime', () => {
    const source = "export const listKey = 'Todo'"
    const unknownCategory = {
      ...classification('cms.seed.ts', source, 'expected-demo'),
      category: 'reviewer-invented-category',
    }
    const report = auditGap15Files(
      { 'cms.seed.ts': source, 'scripts/evidence.ts': 'const proof = true' },
      {
        version: 1,
        classifications: [unknownCategory],
        evidenceBindings: [
          {
            id: 'unknown-evidence',
            evidenceKind: 'reviewer-invented-evidence',
            browserScope: 'reviewer-invented-browser-scope',
            claimBoundary: 'Unknown enum values must fail closed at runtime.',
            markers: [
              {
                path: 'scripts/evidence.ts',
                text: 'const proof = true',
                expectedCount: 1,
              },
            ],
          },
        ],
      } as unknown as Gap15Allowlist,
    )

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-classification' }),
        expect.objectContaining({ code: 'invalid-allowlist' }),
      ]),
    )
  })

  it('fails stale evidence markers instead of treating fixture names as proof', () => {
    const files = {
      'scripts/fixture.ts':
        "const kind = 'uuid'\nconst marker = 'schema proof'",
    }
    const base: Gap15Allowlist = {
      ...emptyAllowlist(),
      evidenceBindings: [
        {
          id: 'uuid-fixture',
          evidenceKind: 'static-fixture',
          browserScope: 'none',
          claimBoundary: 'Static UUID schema fixture only; no browser claim.',
          markers: [
            {
              path: 'scripts/fixture.ts',
              text: "const kind = 'uuid'",
              expectedCount: 1,
              role: 'executable-code',
              sourceFingerprint: fingerprintGap15Source(
                files['scripts/fixture.ts'],
              ),
            },
          ],
        },
      ],
    }

    expect(auditGap15Files(files, base).issues).toEqual([])
    const commentOnly = auditGap15Files(
      {
        'scripts/fixture.ts':
          "// const kind = 'uuid'\nconst marker = 'schema proof'",
      },
      base,
    )
    expect(commentOnly.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'stale-evidence',
          path: 'scripts/fixture.ts',
        }),
      ]),
    )

    const stale = auditGap15Files(
      { 'scripts/fixture.ts': "const kind = 'cuid'" },
      base,
    )
    expect(stale.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'stale-evidence',
          path: 'scripts/fixture.ts',
        }),
      ]),
    )
  })

  it('rejects evidence markers preserved only as inert strings or dead code', () => {
    function evidenceAllowlist(source: string): Gap15Allowlist {
      return {
        ...emptyAllowlist(),
        evidenceBindings: [
          {
            id: 'uuid-fixture',
            evidenceKind: 'static-fixture',
            browserScope: 'none',
            claimBoundary: 'Static UUID schema fixture only; no browser claim.',
            markers: [
              {
                path: 'tools/fixture.ts',
                text: "const kind = 'uuid'",
                expectedCount: 1,
                role: 'executable-code',
                sourceFingerprint: fingerprintGap15Source(source),
              },
            ],
          },
        ],
      }
    }

    const live = "const kind = 'uuid'\nconsume(kind)"
    expect(
      auditGap15Files({ 'tools/fixture.ts': live }, evidenceAllowlist(live))
        .issues,
    ).toEqual([])

    for (const inertSource of [
      `const decoy = ${JSON.stringify("const kind = 'uuid'")}`,
      "if (false) { const kind = 'uuid'; consume(kind) }",
    ]) {
      expect(
        auditGap15Files(
          { 'tools/fixture.ts': inertSource },
          evidenceAllowlist(inertSource),
        ).issues,
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'stale-evidence',
            path: 'tools/fixture.ts',
          }),
        ]),
      )
    }
  })

  it('requires the immutable accepted checkpoint hashes for external browser evidence', () => {
    const source = 'const acceptedCheckpoint = true'
    const externalEvidence = {
      checkpoint: 'checkpoint-028',
      checkpointSourceAggregate:
        '67cde5df31d2db955247db1845800c204c347a755b83ad747d25944842f767e4',
      acceptedPrismaCuidAggregate:
        '418884314c5dff970a8fc5c2ed10f175fd411669fbc7c8a7fe2118e6f3e94e4d',
      copiedSourceFingerprint:
        '68a2f8bdd26df91651798de54ce2135b0fe10524305cf478fc9c7bc3aec6c00b',
      artifactHashes: [
        'ea355cf828134ba4e068d8e52b80b77c8d03e790a78fec20b3b1c1e18edfd210',
        '7b24a3458247381f91d3cff5b47cee78d9e865c193ad3a555c8972e97bcc1c0c',
        'aa5102898c1d7b1e371b24a4ae37c2eff5a7360c5da54c4eb6accd649466b823',
        '81f8d81078f170e14ff849bb9dd02ea5ee9618a1de1dce38d4e553ed3374ba84',
      ],
    }
    const binding = {
      id: 'gap01-adminmeta-arbitrary-shapes',
      evidenceKind: 'external-browser-evidence',
      browserScope: 'external-memory-adminmeta-two-shape',
      claimBoundary:
        'Accepted checkpoint-028 two-shape memory browser evidence only.',
      externalEvidence,
      markers: [
        {
          path: 'tools/evidence.ts',
          text: 'const acceptedCheckpoint = true',
          expectedCount: 1,
          role: 'executable-code',
          sourceFingerprint: fingerprintGap15Source(source),
        },
      ],
    }
    const files = { 'tools/evidence.ts': source }

    expect(
      auditGap15Files(files, {
        ...emptyAllowlist(),
        evidenceBindings: [binding],
      } as unknown as Gap15Allowlist).issues,
    ).toEqual([])
    expect(
      auditGap15Files(files, {
        ...emptyAllowlist(),
        evidenceBindings: [
          {
            ...binding,
            externalEvidence: {
              ...externalEvidence,
              checkpointSourceAggregate: '0'.repeat(64),
            },
          },
        ],
      } as unknown as Gap15Allowlist).issues,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'invalid-allowlist' }),
      ]),
    )
  })

  it('collects maintained root files, arbitrary source directories, and package scripts while excluding artifacts', async () => {
    const root = await mkdtemp(nodePath.join(os.tmpdir(), 'gap15-all-source-'))
    try {
      await Promise.all([
        mkdir(nodePath.join(root, 'scripts'), { recursive: true }),
        mkdir(nodePath.join(root, 'tools'), { recursive: true }),
        mkdir(nodePath.join(root, 'node_modules/ignored'), { recursive: true }),
        mkdir(nodePath.join(root, 'dist/ignored'), { recursive: true }),
        mkdir(nodePath.join(root, 'src/generated'), { recursive: true }),
      ])
      await Promise.all([
        writeFile(
          nodePath.join(root, 'scripts/gap15-hardcode-allowlist.json'),
          JSON.stringify(emptyAllowlist()),
        ),
        writeFile(
          nodePath.join(root, 'maintained.ts'),
          "export const id = 'todo_launch'",
        ),
        writeFile(
          nodePath.join(root, 'tools/generic.ts'),
          "export const defaultList = 'Todo'",
        ),
        writeFile(
          nodePath.join(root, 'package.json'),
          JSON.stringify({ scripts: { probe: 'node probe.js --model Todo' } }),
        ),
        writeFile(
          nodePath.join(root, 'node_modules/ignored/index.ts'),
          "export const model = 'User'",
        ),
        writeFile(
          nodePath.join(root, 'dist/ignored/index.js'),
          "export const model = 'Role'",
        ),
        writeFile(
          nodePath.join(root, 'src/generated/client.ts'),
          "export const model = 'TodoImage'",
        ),
      ])

      const report = await runGap15RepositoryAudit(root)
      expect(
        report.issues
          .filter((issue) => issue.code === 'forbidden-generic-assumption')
          .map((issue) => issue.path),
      ).toEqual(['maintained.ts', 'package.json', 'tools/generic.ts'])
      expect(
        report.matches.some((match) => match.path.includes('ignored')),
      ).toBe(false)
      expect(
        report.matches.some(
          (match) => match.path === 'src/generated/client.ts',
        ),
      ).toBe(false)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('collects root source configs such as vite.config.ts', async () => {
    const root = await mkdtemp(nodePath.join(os.tmpdir(), 'gap15-root-config-'))
    try {
      await mkdir(nodePath.join(root, 'scripts'))
      await writeFile(
        nodePath.join(root, 'scripts/gap15-hardcode-allowlist.json'),
        JSON.stringify(emptyAllowlist()),
      )
      await writeFile(
        nodePath.join(root, 'vite.config.ts'),
        "export default { defaultList: 'Todo' }",
      )
      const report = await runGap15RepositoryAudit(root)
      expect(report.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: 'forbidden-generic-assumption',
            path: 'vite.config.ts',
          }),
        ]),
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('keeps the exact os.org real-consumer source-oracle inventory', async () => {
    for (const fixture of [
      {
        path: 'scripts/fixtures/os-org-real-consumer-worker.ts',
        count: 22,
        matchFingerprint:
          'c1dd4d9d66a4cc51f6adb08305cd24a5d66cd8f78d23a81239c6f1ab16effab9',
        sourceFingerprint:
          'b7303041444c25e4543df654c346969977c27a6ce8ca2f1b4da18236a9dead0c',
      },
      {
        path: 'scripts/validate-os-org-real-consumer-canary.mjs',
        count: 2,
        matchFingerprint:
          '81cebe154ba09ed86db9dc87ea894ae5739441b2ec07a463d603342ad1b83046',
        sourceFingerprint:
          'a860b2ab25ef0dc30f4ae93d4d3c1a73cca6d8f26201aa830606d0299a869237',
      },
      {
        path: 'tests/os-org-real-consumer-canary.test.ts',
        count: 1,
        matchFingerprint:
          '8d420dd01ed0db0fdfe92511a73d4d3b8a7932afe6be00603da1464f7946f0cc',
        sourceFingerprint:
          '176b0e798ebe3f793cc2690ec62a7a09eeaebbffed6d1ba50b00124c09ec4fbd',
      },
    ]) {
      const source = await readFile(fixture.path, 'utf8')
      const matches = scanGap15Source(fixture.path, source)
      expect(matches).toHaveLength(fixture.count)
      expect(fingerprintGap15Matches(matches)).toBe(fixture.matchFingerprint)
      expect(fingerprintGap15Source(source)).toBe(fixture.sourceFingerprint)
    }
  })

  it('passes the checked-in exact inventory and preserves bounded evidence claims', async () => {
    const report = await runGap15RepositoryAudit()
    expect(report.issues).toEqual([])
    expect(report.ok).toBe(true)

    const evidence = new Map(
      report.evidenceBindings.map((binding) => [binding.id, binding]),
    )
    expect(evidence.get('gap01-adminmeta-arbitrary-shapes')).toMatchObject({
      evidenceKind: 'external-browser-evidence',
      browserScope: 'external-memory-adminmeta-two-shape',
      externalEvidence: {
        checkpoint: 'checkpoint-028',
        checkpointSourceAggregate:
          '67cde5df31d2db955247db1845800c204c347a755b83ad747d25944842f767e4',
        acceptedPrismaCuidAggregate:
          '418884314c5dff970a8fc5c2ed10f175fd411669fbc7c8a7fe2118e6f3e94e4d',
        copiedSourceFingerprint:
          '68a2f8bdd26df91651798de54ce2135b0fe10524305cf478fc9c7bc3aec6c00b',
        artifactHashes: [
          'ea355cf828134ba4e068d8e52b80b77c8d03e790a78fec20b3b1c1e18edfd210',
          '7b24a3458247381f91d3cff5b47cee78d9e865c193ad3a555c8972e97bcc1c0c',
          'aa5102898c1d7b1e371b24a4ae37c2eff5a7360c5da54c4eb6accd649466b823',
          '81f8d81078f170e14ff849bb9dd02ea5ee9618a1de1dce38d4e553ed3374ba84',
        ],
      },
    })
    for (const id of [
      'uuid-schema-fixture',
      'autoincrement-schema-fixture',
      'mapped-schema-fixture',
      'singleton-memory-graphql-fixture',
    ]) {
      expect(evidence.get(id)?.browserScope).toBe('none')
    }
    expect(report.summary).toMatchObject({
      browserRuns: 0,
      databaseRuns: 0,
    })
  }, 15_000)
})
