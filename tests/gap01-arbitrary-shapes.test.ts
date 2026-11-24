import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  Gap01CapturedChildError,
  runGap01CapturedChild,
} from '../scripts/gap01-bounded-capture.mjs'
import {
  GAP01_CHECKPOINT017_CUID_EVIDENCE,
  GAP01_ID_PROVENANCE,
  GAP01_SHAPES,
  GAP01_USER_REPRO_INTAKE,
  classifyGraphqlEvidence,
  expectedCreatableListKeys,
  gap01RequestExpression,
  validateUserReproEvidence,
  validateUserReproInputs,
  validateUserReproPaths,
} from '../scripts/gap01-contract.mjs'

const expectedOperation = 'CreateInventory'
const expectedRouteId = 'inventory_1'
const successEvidence = {
  operation: expectedOperation,
  request: {
    query: `mutation ${expectedOperation}($data: InventoryCreateInput!) { createInventory(data: $data) { id } }`,
    variables: { data: { title: 'Inventory' } },
  },
  response: {
    status: 200,
    body: { data: { createInventory: { id: expectedRouteId } } },
  },
}

function classify(
  overrides: Record<string, unknown> | undefined,
  expected = {},
) {
  const evidence =
    overrides === undefined ? undefined : { ...successEvidence, ...overrides }
  return classifyGraphqlEvidence(evidence, {
    operation: expectedOperation,
    routeId: expectedRouteId,
    idPath: ['createInventory', 'id'],
    ...expected,
  })
}

describe('GAP-01 arbitrary shape contract', () => {
  it('covers materially different nonstandard auth and create shapes', () => {
    expect(GAP01_SHAPES).toHaveLength(2)
    expect(GAP01_SHAPES[0].auth).toMatchObject({
      listKey: 'Staff',
      identityField: 'loginName',
      secretField: 'passphrase',
      displayField: 'displayName',
    })
    expect(GAP01_SHAPES[1].auth).toMatchObject({
      listKey: 'Operator',
      identityField: 'handle',
      secretField: 'pin',
      displayField: 'fullName',
    })
    expect(GAP01_SHAPES[0].creatableLists).not.toEqual(
      GAP01_SHAPES[1].creatableLists,
    )
  })

  it('keeps denied lists out of the expected creatable metadata set', () => {
    for (const shape of GAP01_SHAPES) {
      expect(expectedCreatableListKeys(shape)).toEqual(
        [...shape.creatableLists].sort(),
      )
      expect(expectedCreatableListKeys(shape)).not.toContain(shape.deniedList)
    }
  })

  it('binds the accepted checkpoint-017 Prisma/CUID evidence to the canonical concat', () => {
    const digest = createHash('sha256')
    for (const file of GAP01_CHECKPOINT017_CUID_EVIDENCE.files)
      digest.update(readFileSync(path.resolve(file)))
    expect(digest.digest('hex')).toBe(GAP01_CHECKPOINT017_CUID_EVIDENCE.sha256)
    expect(GAP01_CHECKPOINT017_CUID_EVIDENCE.classification).toBe(
      'external-accepted-checkpoint-017-prisma-cuid-evidence',
    )
  })

  it('does not overclaim realistic memory IDs and binds Prisma IDs externally', () => {
    expect(GAP01_ID_PROVENANCE.memory.classification).toBe('synthetic')
    expect(GAP01_ID_PROVENANCE.prisma.classification).toBe(
      'external-checkpoint-017',
    )
    expect(GAP01_ID_PROVENANCE.prisma.evidenceHash).toBe(
      '418884314c5dff970a8fc5c2ed10f175fd411669fbc7c8a7fe2118e6f3e94e4d',
    )
  })

  it('validates missing and invalid user repro inputs without executing user data', () => {
    expect(validateUserReproInputs({})).toMatchObject({
      ok: false,
      reason: 'missing-inputs',
    })
    expect(
      validateUserReproInputs({
        fixture: '/tmp',
        command: 'not-json',
        runtime: 'node',
        versions: 'v',
        evidence: '/tmp/evidence.json',
      }),
    ).toEqual({ ok: false, reason: 'invalid-json-argv' })
    expect(
      validateUserReproInputs({
        fixture: '/tmp',
        command: '["node","-e","0"]',
        runtime: 'node',
        versions: 'v',
        evidence: '/tmp/evidence.json',
      }),
    ).toMatchObject({ ok: true, argv: ['node', '-e', '0'] })
    expect(
      validateUserReproPaths({
        fixtureIsDirectory: false,
        evidenceIsFile: true,
      }),
    ).toEqual({ ok: false, reason: 'invalid-paths' })
    const escapedRequest = {
      query: 'mutation `quoted` ${value} \\"quoted\\" \\\\slash',
      variables: { data: { title: 'quote " and slash \\ 🌿' } },
    }
    const escapedExpression = gap01RequestExpression(escapedRequest)
    expect(Function(`return (${escapedExpression})`)()).toEqual(escapedRequest)
  })

  it('preserves nonzero output and cleans stubborn descendants and reports', async () => {
    const temporaryRoot = await mkdtemp(
      path.join(os.tmpdir(), 'gap01-capture-test-'),
    )
    try {
      const nonzeroReport = path.join(temporaryRoot, 'nonzero.json')
      const nonzero = await runGap01CapturedChild(
        process.execPath,
        [path.resolve('scripts/fixtures/gap01-nonzero-child.mjs')],
        {
          label: 'GAP-01 capture nonzero proof',
          timeout: 5_000,
          maxCapturedBytes: 64 * 1024,
          cwd: process.cwd(),
          reportPath: nonzeroReport,
        },
      )
      expect(nonzero.exitCode).toBe(7)
      expect(nonzero.stdout).toContain('GAP01_NONZERO_STDOUT')
      expect(nonzero.stderr).toContain('GAP01_NONZERO_STDERR')
      expect(JSON.parse(await readFile(nonzeroReport, 'utf8'))).toMatchObject({
        exitCode: 7,
        stdout: expect.stringContaining('GAP01_NONZERO_STDOUT'),
        stderr: expect.stringContaining('GAP01_NONZERO_STDERR'),
      })

      const overflowReport = path.join(temporaryRoot, 'overflow.json')
      const overflow = await runGap01CapturedChild(
        process.execPath,
        [path.resolve('scripts/fixtures/gap01-overflow-child.mjs')],
        {
          label: 'GAP-01 capture overflow proof',
          timeout: 5_000,
          maxCapturedBytes: 64 * 1024,
          cwd: process.cwd(),
          reportPath: overflowReport,
        },
      )
      expect(overflow.exitCode).toBe(1)
      expect(overflow.signal).toBeNull()
      expect(overflow.captureOverflow).toBe(true)
      expect(
        Buffer.byteLength(overflow.stdout) + Buffer.byteLength(overflow.stderr),
      ).toBeLessThanOrEqual(64 * 1024)
      expect(
        validateUserReproEvidence({
          report: overflow,
          evidence: { traceToken: 'GAP01_OVERFLOW' },
        }),
      ).toEqual({ status: 'blocked', reason: 'captured-output-overflow' })
      expect(JSON.parse(await readFile(overflowReport, 'utf8'))).toMatchObject({
        exitCode: 1,
        captureOverflow: true,
      })

      const marker = `gap01-capture-stubborn-${process.pid}-${Date.now()}`
      const stubbornReport = path.join(temporaryRoot, 'stubborn.json')
      const stubborn = await runGap01CapturedChild(
        process.execPath,
        [path.resolve('scripts/fixtures/gap01-stubborn-child.mjs'), marker],
        {
          label: 'GAP-01 capture stubborn proof',
          timeout: 300,
          termGrace: 100,
          cwd: process.cwd(),
          reportPath: stubbornReport,
        },
      )
      expect(stubborn.timedOut).toBe(true)
      expect(stubborn.quiescent).toBe(true)
      expect((await stat(stubbornReport)).isFile()).toBe(true)

      const successfulMarker = `gap01-capture-successful-${process.pid}-${Date.now()}`
      const successfulReport = path.join(
        temporaryRoot,
        'successful-descendant.json',
      )
      let successfulError: Gap01CapturedChildError | undefined
      try {
        await runGap01CapturedChild(
          process.execPath,
          [
            path.resolve('scripts/fixtures/gap01-successful-descendant.mjs'),
            successfulMarker,
          ],
          {
            label: 'GAP-01 capture successful descendant proof',
            timeout: 5_000,
            termGrace: 100,
            cwd: process.cwd(),
            reportPath: successfulReport,
          },
        )
      } catch (error: unknown) {
        if (!(error instanceof Gap01CapturedChildError)) throw error
        successfulError = error
      }
      expect(successfulError?.result).toMatchObject({
        exitCode: 0,
        leftDescendants: true,
        quiescent: true,
      })
      expect((await stat(successfulReport)).isFile()).toBe(true)

      const processes = await runGap01CapturedChild(
        '/bin/ps',
        ['-axo', 'pid=,command='],
        {
          label: 'GAP-01 capture residue proof',
          timeout: 5_000,
          maxCapturedBytes: 4 * 1024 * 1024,
        },
      )
      for (const residueMarker of [marker, successfulMarker])
        expect(processes.stdout).not.toContain(residueMarker)
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
    await expect(stat(temporaryRoot)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('blocks missing, non-failing, and unmatched user repro evidence', () => {
    expect(
      validateUserReproEvidence({ report: undefined, evidence: undefined }),
    ).toEqual({ status: 'blocked', reason: 'probe-did-not-fail' })
    expect(
      validateUserReproEvidence({
        report: { exitCode: 0, stdout: '', stderr: '' },
        evidence: { traceToken: 'trace' },
      }).status,
    ).toBe('blocked')
    expect(
      validateUserReproEvidence({
        report: { exitCode: 1, stdout: 'other', stderr: '' },
        evidence: { traceToken: 'trace' },
      }),
    ).toEqual({
      status: 'blocked',
      reason: 'captured-trace-does-not-match-evidence',
    })
    expect(
      validateUserReproEvidence({
        report: { timedOut: true, exitCode: 1, stdout: 'trace', stderr: '' },
        evidence: { traceToken: 'trace' },
      }),
    ).toEqual({ status: 'blocked', reason: 'probe-timed-out' })
    expect(
      validateUserReproEvidence({
        report: {
          exitCode: 1,
          captureOverflow: true,
          stdout: 'trace',
          stderr: '',
        },
        evidence: { traceToken: 'trace' },
      }),
    ).toEqual({ status: 'blocked', reason: 'captured-output-overflow' })
    expect(
      validateUserReproEvidence({
        report: {
          exitCode: null,
          terminationPending: true,
          stdout: 'trace',
          stderr: '',
        },
        evidence: { traceToken: 'trace' },
      }),
    ).toEqual({
      status: 'blocked',
      reason: 'probe-process-group-not-quiescent',
    })
    expect(
      validateUserReproEvidence({
        report: { exitCode: 1, stdout: 'trace CLASS', stderr: '' },
        evidence: { traceToken: 'trace', classification: 'CLASS' },
      }),
    ).toMatchObject({ status: 'reproduced', classification: 'CLASS' })
  })

  it('records unavailable user-specific reproduction as an environmental blocker', () => {
    expect(GAP01_USER_REPRO_INTAKE.status).toBe('not-reproduced')
    expect(GAP01_USER_REPRO_INTAKE.classification).toBe('environmental-blocker')
    expect(GAP01_USER_REPRO_INTAKE.requiredInputs.length).toBeGreaterThan(2)
    expect(GAP01_USER_REPRO_INTAKE.rule).toMatch(
      /Never infer|claim reproduction/,
    )
  })

  it.each([
    ['missing capture', undefined, 'transport/harness'],
    ['harness error', { harnessError: 'bad fixture' }, 'transport/harness'],
    ['wrong operation', { operation: 'OtherOperation' }, 'transport/harness'],
    [
      'missing variables.data',
      { request: { query: `mutation ${expectedOperation}`, variables: {} } },
      'transport/harness',
    ],
    ['network error', { networkError: 'connection reset' }, 'network'],
    [
      'network error before operation attribution',
      { operation: undefined, networkError: 'connection reset' },
      'network',
    ],
    ['missing response', { response: undefined }, 'network'],
    ['missing HTTP status', { response: { body: {} } }, 'transport/harness'],
    ['HTTP failure', { response: { status: 404, body: {} } }, 'http'],
    [
      'HTTP access failure',
      { response: { status: 403, body: {} } },
      'access-denied',
    ],
    ['HTTP server failure', { response: { status: 503, body: {} } }, 'server'],
    [
      'GraphQL validation',
      {
        response: {
          status: 200,
          body: {
            errors: [{ extensions: { code: 'GRAPHQL_VALIDATION_FAILED' } }],
          },
        },
      },
      'graphql-validation',
    ],
    [
      'Keystone validation',
      {
        response: {
          status: 200,
          body: { errors: [{ extensions: { code: 'KS_VALIDATION_FAILURE' } }] },
        },
      },
      'graphql-validation',
    ],
    [
      'bad user input validation',
      {
        response: {
          status: 200,
          body: { errors: [{ extensions: { code: 'BAD_USER_INPUT' } }] },
        },
      },
      'graphql-validation',
    ],
    [
      'access denied',
      {
        response: {
          status: 200,
          body: { errors: [{ extensions: { code: 'FORBIDDEN' } }] },
        },
      },
      'access-denied',
    ],
    [
      'Keystone access denied',
      {
        response: {
          status: 200,
          body: { errors: [{ extensions: { code: 'KS_ACCESS_DENIED' } }] },
        },
      },
      'access-denied',
    ],
    [
      'server failure',
      {
        response: {
          status: 200,
          body: { errors: [{ extensions: { code: 'INTERNAL_SERVER_ERROR' } }] },
        },
      },
      'server',
    ],
    [
      'route id mismatch',
      {
        response: {
          status: 200,
          body: { data: { createInventory: { id: 'other' } } },
        },
      },
      'transport/harness',
    ],
  ])(
    'classifies %s without false success',
    (_name, evidence, classification) => {
      expect(classify(evidence as any).classification).toBe(classification)
    },
  )

  it('classifies malformed expected operations as harness failures', () => {
    expect(
      classifyGraphqlEvidence(successEvidence, { operation: undefined }),
    ).toEqual({
      classification: 'transport/harness',
      reason: 'invalid-expected-operation',
    })
    expect(
      classifyGraphqlEvidence(successEvidence, { operation: 42 as any }),
    ).toEqual({
      classification: 'transport/harness',
      reason: 'invalid-expected-operation',
    })
  })

  it('requires exact operation data and accepts string or numeric route-matched IDs', () => {
    expect(
      classify({
        request: {
          query:
            'mutation CreateInventoryEvil($data: InventoryCreateInput!) { createInventory(data: $data) { id } }',
          variables: { data: { title: 'Inventory' } },
        },
      }).classification,
    ).toBe('transport/harness')
    expect(classify({})).toMatchObject({
      classification: 'success',
      returnedId: expectedRouteId,
    })
    expect(
      classify(
        {
          response: {
            status: 200,
            body: { data: { createInventory: { id: 1 } } },
          },
        },
        { routeId: 1 },
      ).classification,
    ).toBe('success')
    expect(
      classify({
        request: {
          query: `mutation ${expectedOperation}($data: InventoryCreateInput!) { createInventory(data: $data) { id } }`,
          variables: { data: {} },
        },
      }).classification,
    ).toBe('transport/harness')
  })
})
