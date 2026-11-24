import { createHash } from 'node:crypto'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import ts from 'typescript'

export type Gap15ClassificationCategory =
  | 'expected-demo'
  | 'expected-source-oracle'

export type Gap15MatchKind =
  | 'dashboard-route'
  | 'demo-persona'
  | 'demo-seed-id'
  | 'generated-name'
  | 'model-identifier'
  | 'model-key'
  | 'model-module'
  | 'model-ref'
  | 'source-migration'
  | 'starter-list-slug'
  | 'starter-table'

export type Gap15EvidenceKind =
  | 'external-browser-evidence'
  | 'memory-graphql-fixture'
  | 'static-fixture'

export type Gap15BrowserScope = 'external-memory-adminmeta-two-shape' | 'none'

export type Gap15EvidenceMarkerRole =
  | 'executable-code'
  | 'executed-regex'
  | 'executed-string'
  | 'package-script'

export interface Gap15Match {
  readonly path: string
  readonly kind: Gap15MatchKind
  readonly value: string
  readonly line: number
  readonly column: number
}

export interface Gap15Classification {
  readonly path: string
  readonly category: Gap15ClassificationCategory
  readonly reason: string
  readonly expectedMatchCount: number
  readonly matchFingerprint: string
  readonly sourceFingerprint: string
}

export interface Gap15EvidenceMarker {
  readonly path: string
  readonly text: string
  readonly expectedCount: number
  readonly role: Gap15EvidenceMarkerRole
  readonly sourceFingerprint: string
}

export interface Gap15ExternalEvidence {
  readonly checkpoint: 'checkpoint-028'
  readonly checkpointSourceAggregate: string
  readonly acceptedPrismaCuidAggregate: string
  readonly copiedSourceFingerprint: string
  readonly artifactHashes: readonly string[]
}

export interface Gap15EvidenceBinding {
  readonly id: string
  readonly evidenceKind: Gap15EvidenceKind
  readonly browserScope: Gap15BrowserScope
  readonly claimBoundary: string
  readonly markers: readonly Gap15EvidenceMarker[]
  readonly externalEvidence?: Gap15ExternalEvidence
}

export interface Gap15Allowlist {
  readonly version: 1
  readonly classifications: readonly Gap15Classification[]
  readonly evidenceBindings: readonly Gap15EvidenceBinding[]
}

export type Gap15IssueCode =
  | 'forbidden-generic-assumption'
  | 'invalid-allowlist'
  | 'invalid-classification'
  | 'stale-allowlist'
  | 'stale-evidence'
  | 'unclassified-literal'

export interface Gap15Issue {
  readonly code: Gap15IssueCode
  readonly message: string
  readonly path?: string
}

export interface Gap15AuditSummary {
  readonly scannedFiles: number
  readonly literalMatches: number
  readonly classifiedFiles: number
  readonly expectedDemoFiles: number
  readonly expectedSourceOracleFiles: number
  readonly evidenceBindings: number
  readonly browserRuns: 0
  readonly databaseRuns: 0
}

export interface Gap15AuditReport {
  readonly ok: boolean
  readonly issues: readonly Gap15Issue[]
  readonly matches: readonly Gap15Match[]
  readonly evidenceBindings: readonly Gap15EvidenceBinding[]
  readonly summary: Gap15AuditSummary
}

type UnknownRecord = Record<string, unknown>
type StaticPrimitive = boolean | number | string

interface StaticBinding {
  readonly declaration: ts.Node
  readonly initializer?: ts.Expression
}

interface StaticScope {
  readonly parent?: StaticScope
  readonly functionScope: boolean
  readonly bindings: Map<string, StaticBinding | null>
}

interface StaticEnvironment {
  readonly scopeByNode: WeakMap<ts.Node, StaticScope>
}

const sourceExtensions = new Set([
  '.cjs',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.mts',
  '.ts',
  '.tsx',
])

const excludedDirectoryNames = new Set([
  '.cms',
  '.cms-temp',
  '.cache',
  '.git',
  '.next',
  '.netlify',
  '.nitro',
  '.output',
  '.parcel-cache',
  '.tanstack',
  '.turbo',
  '.vercel',
  '.vite',
  '.vite-temp',
  '.yarn',
  'bower_components',
  'build',
  'coverage',
  'dist',
  'generated',
  'node_modules',
  'out',
  'vendor',
  'reports',
  'subagent-artifacts',
])

const generatedSourceFile = /(?:^|\/)[^/]+\.(?:gen|generated)\.[cm]?[jt]sx?$/

const policyPaths = new Set([
  'scripts/gap15-hardcode-allowlist.json',
  'scripts/validate-gap15-hardcodes.ts',
  'tests/gap15-hardcode-audit.test.ts',
])

// Paths are policy, not data: a renamed or newly created script/test fails closed
// until this scanner itself is reviewed. The JSON inventory cannot bless a path.
const approvedDemoPaths = new Set([
  'cms.config.ts',
  'cms.seed.ts',
  'prisma/seed.ts',
  'scripts/validate-cms-admin-meta.ts',
  'scripts/validate-cms-auth-continuity-worker.ts',
  'scripts/validate-cms-auth-continuity.mjs',
  'scripts/validate-cms-auth.ts',
  'scripts/fixtures/cms-access-parity-worker.ts',
  'scripts/validate-cms-config.ts',
  'scripts/validate-cms-crud.ts',
  'scripts/validate-cms-document-fields.ts',
  'scripts/validate-cms-document-runtime.ts',
  'scripts/validate-cms-graphql-upload-http.ts',
  'scripts/validate-cms-graphql-upload.ts',
  'scripts/validate-cms-prisma-adapter-metadata.ts',
  'scripts/validate-cms-prisma-auth.ts',
  'scripts/validate-cms-prisma-preflight.ts',
  'scripts/validate-cms-prisma-schema.ts',
  'scripts/validate-cms-prisma.ts',
  'scripts/validate-dashboard-browser.mjs',
  'scripts/validate-dashboard-completion.ts',
  'scripts/validate-dashboard-http.ts',
  'scripts/validate-gap10-provider-continuity.ts',
  'scripts/validate-nitro-error-runtime.mjs',
  'src/features/cms/models/Role.ts',
  'src/features/cms/models/Todo.ts',
  'src/features/cms/models/TodoImage.ts',
  'src/features/cms/models/User.ts',
  'src/features/cms/models/access.ts',
  'src/features/cms/models/index.ts',
  'tests/cms-password-reset-mail.test.ts',
  'tests/dashboard-bulk-delete.test.ts',
  'tests/dashboard-create-page-contract.test.ts',
  'tests/dashboard-field-state-contracts.test.ts',
  'tests/dashboard-filter-param-compat.test.ts',
  'tests/dashboard-graphql-error-details.test.ts',
  'tests/dashboard-init-route.test.ts',
  'tests/dashboard-list-state-persistence.test.ts',
  'tests/dashboard-relationship-view-contract.test.ts',
  'tests/dashboard-required-indicators.test.ts',
  'tests/dashboard-route-guards.test.ts',
  'tests/dashboard-specialized-controller-wiring.test.ts',
  'tests/gap08-relationship-matrix.test.ts',
  'tests/mcp-security-worker.ts',
])

const approvedSourceOraclePaths = new Set([
  'scripts/audit-next-keystone-source.mjs',
  'scripts/audit-next-model-portability.mjs',
  'scripts/fixtures/os-org-real-consumer-worker.ts',
  'scripts/validate-openfront-consumers.mjs',
  'scripts/validate-openfront-runtime-canary.mjs',
  'scripts/validate-os-org-real-consumer-canary.mjs',
  'scripts/validate-runtime-dependencies.ts',
  'scripts/validate-sibling-oracle.mjs',
  'scripts/validate-source-cutover-runtime.ts',
  'scripts/validate-source-cutover.mjs',
  'tests/os-org-real-consumer-canary.test.ts',
])

const classificationCategories = new Set<Gap15ClassificationCategory>([
  'expected-demo',
  'expected-source-oracle',
])
const evidenceKinds = new Set<Gap15EvidenceKind>([
  'external-browser-evidence',
  'memory-graphql-fixture',
  'static-fixture',
])
const browserScopes = new Set<Gap15BrowserScope>([
  'external-memory-adminmeta-two-shape',
  'none',
])
const evidenceMarkerRoles = new Set<Gap15EvidenceMarkerRole>([
  'executable-code',
  'executed-regex',
  'executed-string',
  'package-script',
])

export const GAP15_ACCEPTED_GAP01_EXTERNAL_EVIDENCE: Gap15ExternalEvidence =
  Object.freeze({
    checkpoint: 'checkpoint-028',
    checkpointSourceAggregate:
      '67cde5df31d2db955247db1845800c204c347a755b83ad747d25944842f767e4',
    acceptedPrismaCuidAggregate:
      '418884314c5dff970a8fc5c2ed10f175fd411669fbc7c8a7fe2118e6f3e94e4d',
    copiedSourceFingerprint:
      '68a2f8bdd26df91651798de54ce2135b0fe10524305cf478fc9c7bc3aec6c00b',
    artifactHashes: Object.freeze([
      'ea355cf828134ba4e068d8e52b80b77c8d03e790a78fec20b3b1c1e18edfd210',
      '7b24a3458247381f91d3cff5b47cee78d9e865c193ad3a555c8972e97bcc1c0c',
      'aa5102898c1d7b1e371b24a4ae37c2eff5a7360c5da54c4eb6accd649466b823',
      '81f8d81078f170e14ff849bb9dd02ea5ee9618a1de1dce38d4e553ed3374ba84',
    ]),
  })

const modelKeys = ['TodoImage', 'Todo', 'User', 'Role'] as const
const exactModelKeys = new Set<string>(modelKeys)
const exactListSlugs = new Set(['roles', 'todo-images', 'todos', 'users'])
const demoSeedId =
  /^(?:role_(?:admin|editor)|todo_(?:docs|launch|private)|user_(?:admin|editor))$/
const demoPersona = /^(?:Ada Admin|Ed Editor|ada@example\.com|ed@example\.com)$/
const sourceMigration = /^\d{14}_[a-z0-9_]*(?:role|todo|user)[a-z0-9_]*$/
const starterTable = /^_Todo[A-Za-z0-9_]*$/
const graphQlName = /^[_A-Za-z][_0-9A-Za-z]*$/
const graphQlToken = /[_A-Za-z][_0-9A-Za-z]*/g
const modelToken = /(?:TodoImage|Todo|User|Role)/
const modelReference =
  /^(?:TodoImage|Todo|User|Role)\.[_$A-Za-z][_$0-9A-Za-z]*$/
const modelModule =
  /^(?:\.\.?\/)*(?:TodoImage|Todo|User|Role)(?:\.[cm]?[jt]sx?)?$/
const modelFilePath = /(?:^|\/)(?:TodoImage|Todo|User|Role)\.[cm]?[jt]sx?$/
const dashboardRoute =
  /\/dashboard\/(roles|todo-images|todos|users)(?:\/|\?|$)/g
const graphQlDocument =
  /\b(?:fragment|mutation|query|subscription)\b[\s\S]*[{}]|\.\.\.\s+on\s+[_A-Za-z]/

function asRecord(value: unknown): UnknownRecord | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined
}

function hasOnlyKeys(record: UnknownRecord, allowed: readonly string[]) {
  const allowedKeys = new Set(allowed)
  return Object.keys(record).every((key) => allowedKeys.has(key))
}

function normalizePath(filePath: string) {
  return filePath.split(path.sep).join('/').replace(/^\.\//, '')
}

function isSafeRepositoryPath(filePath: string) {
  const normalized = normalizePath(filePath)
  return (
    normalized.length > 0 &&
    !path.isAbsolute(filePath) &&
    normalized !== '..' &&
    !normalized.startsWith('../') &&
    !normalized.includes('/../')
  )
}

function shouldScanPath(filePath: string) {
  const normalized = normalizePath(filePath)
  if (policyPaths.has(normalized)) return false
  const segments = normalized.split('/')
  if (
    segments.some((segment) => excludedDirectoryNames.has(segment)) ||
    generatedSourceFile.test(normalized)
  )
    return false
  return (
    normalized === 'package.json' ||
    sourceExtensions.has(path.extname(normalized))
  )
}

function approvedCategoryForPath(
  filePath: string,
): Gap15ClassificationCategory | undefined {
  const normalized = normalizePath(filePath)
  if (approvedDemoPaths.has(normalized)) return 'expected-demo'
  if (approvedSourceOraclePaths.has(normalized)) return 'expected-source-oracle'
  return undefined
}

function scriptKind(filePath: string) {
  if (filePath === 'package.json') return ts.ScriptKind.JSON
  if (filePath.endsWith('.tsx')) return ts.ScriptKind.TSX
  if (filePath.endsWith('.jsx')) return ts.ScriptKind.JSX
  if (/\.[cm]?js$/.test(filePath)) return ts.ScriptKind.JS
  return ts.ScriptKind.TS
}

function addUniqueMatch(
  matches: Array<{ kind: Gap15MatchKind; value: string }>,
  kind: Gap15MatchKind,
  value: string,
) {
  if (!matches.some((match) => match.kind === kind && match.value === value))
    matches.push({ kind, value })
}

const demoSeedValues = [
  'role_admin',
  'role_editor',
  'todo_docs',
  'todo_launch',
  'todo_private',
  'user_admin',
  'user_editor',
] as const
const demoPersonaValues = [
  'Ada Admin',
  'Ed Editor',
  'ada@example.com',
  'ed@example.com',
] as const
const quotedListSlug = /(["'])(roles|todo-images|todos|users)\1/g
const commandListSlug =
  /\b(?:browse|create|delete|list|navigate|open|select|show|update|visit)\s+(?:the\s+)?(roles|todo-images|todos|users)\b/gi
const commandText =
  /^\s*(?:bash|bun|create|delete|deno|echo|node|npm|npx|pnpm|sh|tsx|update|yarn|zsh)(?:\s|$)|&&|\|\||(?:^|\s)--[A-Za-z]/

function containsBounded(value: string, token: string) {
  let offset = 0
  while (offset <= value.length - token.length) {
    const index = value.indexOf(token, offset)
    if (index < 0) return false
    const before = value[index - 1]
    const after = value[index + token.length]
    if (
      (!before || !/[A-Za-z0-9_.@-]/.test(before)) &&
      (!after || !/[A-Za-z0-9_.@-]/.test(after))
    )
      return true
    offset = index + token.length
  }
  return false
}

function addEmbeddedIdentifiers(
  matches: Array<{ kind: Gap15MatchKind; value: string }>,
  value: string,
) {
  graphQlToken.lastIndex = 0
  for (const tokenMatch of value.matchAll(graphQlToken)) {
    const token = tokenMatch[0]
    if (!modelToken.test(token)) continue
    addUniqueMatch(
      matches,
      exactModelKeys.has(token) ? 'model-key' : 'generated-name',
      token,
    )
  }
}

function matchesForLiteral(value: string, scanIdentifiers = false) {
  const matches: Array<{ kind: Gap15MatchKind; value: string }> = []
  if (exactModelKeys.has(value)) addUniqueMatch(matches, 'model-key', value)
  if (demoSeedId.test(value)) addUniqueMatch(matches, 'demo-seed-id', value)
  if (demoPersona.test(value)) addUniqueMatch(matches, 'demo-persona', value)
  if (exactListSlugs.has(value))
    addUniqueMatch(matches, 'starter-list-slug', value)
  if (sourceMigration.test(value))
    addUniqueMatch(matches, 'source-migration', value)
  if (starterTable.test(value)) addUniqueMatch(matches, 'starter-table', value)
  if (modelReference.test(value)) addUniqueMatch(matches, 'model-ref', value)
  if (
    !exactModelKeys.has(value) &&
    (modelModule.test(value) || modelFilePath.test(value))
  )
    addUniqueMatch(matches, 'model-module', value)

  for (const token of demoSeedValues)
    if (containsBounded(value, token))
      addUniqueMatch(matches, 'demo-seed-id', token)
  for (const token of demoPersonaValues)
    if (containsBounded(value, token))
      addUniqueMatch(matches, 'demo-persona', token)

  dashboardRoute.lastIndex = 0
  for (const match of value.matchAll(dashboardRoute))
    addUniqueMatch(matches, 'dashboard-route', match[1])

  quotedListSlug.lastIndex = 0
  for (const match of value.matchAll(quotedListSlug))
    addUniqueMatch(matches, 'starter-list-slug', match[2])
  commandListSlug.lastIndex = 0
  for (const match of value.matchAll(commandListSlug))
    addUniqueMatch(matches, 'starter-list-slug', match[1])

  if (graphQlName.test(value) && modelToken.test(value))
    addUniqueMatch(
      matches,
      exactModelKeys.has(value) ? 'model-key' : 'generated-name',
      value,
    )

  if (scanIdentifiers || graphQlDocument.test(value))
    addEmbeddedIdentifiers(matches, value)
  return matches
}

function isFunctionScopeNode(node: ts.Node) {
  return (
    ts.isArrowFunction(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isSetAccessorDeclaration(node)
  )
}

function isLexicalScopeNode(node: ts.Node) {
  return (
    ts.isBlock(node) ||
    ts.isCaseBlock(node) ||
    ts.isCatchClause(node) ||
    ts.isForInStatement(node) ||
    ts.isForOfStatement(node) ||
    ts.isForStatement(node) ||
    ts.isModuleBlock(node)
  )
}

function addStaticBinding(
  scope: StaticScope,
  name: ts.BindingName | ts.Identifier,
  binding: StaticBinding,
) {
  if (ts.isIdentifier(name)) {
    scope.bindings.set(
      name.text,
      scope.bindings.has(name.text) ? null : binding,
    )
    return
  }
  for (const element of name.elements)
    if (!ts.isOmittedExpression(element))
      addStaticBinding(scope, element.name, {
        declaration: element,
      })
}

function nearestFunctionScope(scope: StaticScope) {
  let current = scope
  while (!current.functionScope && current.parent) current = current.parent
  return current
}

function collectStaticEnvironment(
  sourceFile: ts.SourceFile,
): StaticEnvironment {
  const scopeByNode = new WeakMap<ts.Node, StaticScope>()
  const rootScope: StaticScope = {
    functionScope: true,
    bindings: new Map(),
  }

  function visit(node: ts.Node, parentScope: StaticScope) {
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.name
    )
      addStaticBinding(parentScope, node.name, { declaration: node })

    let scope = parentScope
    if (node !== sourceFile && isFunctionScopeNode(node))
      scope = {
        parent: parentScope,
        functionScope: true,
        bindings: new Map(),
      }
    else if (node !== sourceFile && isLexicalScopeNode(node))
      scope = {
        parent: parentScope,
        functionScope: false,
        bindings: new Map(),
      }
    scopeByNode.set(node, scope)

    if (ts.isFunctionExpression(node) && node.name)
      addStaticBinding(scope, node.name, { declaration: node })

    if (ts.isVariableDeclaration(node)) {
      const declarationList = ts.isVariableDeclarationList(node.parent)
        ? node.parent
        : undefined
      const isConst =
        declarationList !== undefined &&
        (declarationList.flags & ts.NodeFlags.Const) !== 0
      const isBlockScoped =
        declarationList !== undefined &&
        (declarationList.flags & ts.NodeFlags.BlockScoped) !== 0
      const targetScope = isBlockScoped ? scope : nearestFunctionScope(scope)
      addStaticBinding(targetScope, node.name, {
        declaration: node,
        ...(isConst && ts.isIdentifier(node.name) && node.initializer
          ? { initializer: node.initializer }
          : {}),
      })
    } else if (ts.isParameter(node))
      addStaticBinding(scope, node.name, { declaration: node })
    else if (ts.isImportClause(node) && node.name)
      addStaticBinding(scope, node.name, { declaration: node })
    else if (ts.isImportSpecifier(node))
      addStaticBinding(scope, node.name, { declaration: node })
    else if (ts.isNamespaceImport(node))
      addStaticBinding(scope, node.name, { declaration: node })
    else if (ts.isImportEqualsDeclaration(node))
      addStaticBinding(scope, node.name, { declaration: node })
    else if (
      (ts.isClassExpression(node) || ts.isEnumDeclaration(node)) &&
      node.name
    )
      addStaticBinding(scope, node.name, { declaration: node })

    ts.forEachChild(node, (child) => visit(child, scope))
  }

  visit(sourceFile, rootScope)
  return { scopeByNode }
}

function unwrapExpression(expression: ts.Expression): ts.Expression {
  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  )
    return unwrapExpression(expression.expression)
  return expression
}

function resolveStaticBinding(
  identifier: ts.Identifier,
  environment: StaticEnvironment,
) {
  let scope = environment.scopeByNode.get(identifier)
  while (scope) {
    if (scope.bindings.has(identifier.text))
      return scope.bindings.get(identifier.text) ?? undefined
    scope = scope.parent
  }
  return undefined
}

function staticPrimitive(
  expression: ts.Expression,
  environment: StaticEnvironment,
  resolving = new Set<ts.Node>(),
): StaticPrimitive | undefined {
  const unwrapped = unwrapExpression(expression)
  if (ts.isStringLiteral(unwrapped)) return unwrapped.text
  if (ts.isNoSubstitutionTemplateLiteral(unwrapped)) return unwrapped.text
  if (ts.isNumericLiteral(unwrapped)) return Number(unwrapped.text)
  if (unwrapped.kind === ts.SyntaxKind.TrueKeyword) return true
  if (unwrapped.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isIdentifier(unwrapped)) {
    const binding = resolveStaticBinding(unwrapped, environment)
    if (!binding?.initializer || resolving.has(binding.declaration))
      return undefined
    const nextResolving = new Set(resolving).add(binding.declaration)
    return staticPrimitive(binding.initializer, environment, nextResolving)
  }
  if (
    ts.isBinaryExpression(unwrapped) &&
    unwrapped.operatorToken.kind === ts.SyntaxKind.PlusToken
  ) {
    const left = staticPrimitive(unwrapped.left, environment, resolving)
    const right = staticPrimitive(unwrapped.right, environment, resolving)
    if (left === undefined || right === undefined) return undefined
    return `${String(left)}${String(right)}`
  }
  if (ts.isTemplateExpression(unwrapped)) {
    let value = unwrapped.head.text
    for (const span of unwrapped.templateSpans) {
      const expressionValue = staticPrimitive(
        span.expression,
        environment,
        resolving,
      )
      if (expressionValue === undefined) return undefined
      value += `${String(expressionValue)}${span.literal.text}`
    }
    return value
  }
  return undefined
}

function expressionCanFoldToString(
  node: ts.Node,
  environment: StaticEnvironment,
): node is ts.Expression {
  if (!ts.isExpression(node)) return false
  return typeof staticPrimitive(node, environment) === 'string'
}

function hasFoldedStringParent(
  node: ts.Expression,
  environment: StaticEnvironment,
) {
  const parent = node.parent
  if (!parent || !ts.isExpression(parent)) return false
  if (
    ts.isParenthesizedExpression(parent) ||
    ts.isAsExpression(parent) ||
    ts.isSatisfiesExpression(parent) ||
    ts.isTypeAssertionExpression(parent) ||
    ts.isNonNullExpression(parent) ||
    ts.isBinaryExpression(parent) ||
    ts.isTemplateExpression(parent)
  )
    return expressionCanFoldToString(parent, environment)
  return false
}

export function scanGap15Source(
  filePath: string,
  source: string,
): Gap15Match[] {
  const normalized = normalizePath(filePath)
  if (!shouldScanPath(normalized)) return []
  const sourceFile = ts.createSourceFile(
    normalized,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(normalized),
  )
  const environment = collectStaticEnvironment(sourceFile)
  const matches: Gap15Match[] = []

  function addMatches(
    node: ts.Node,
    found: ReadonlyArray<{ kind: Gap15MatchKind; value: string }>,
  ) {
    const location = sourceFile.getLineAndCharacterOfPosition(
      node.getStart(sourceFile),
    )
    for (const match of found)
      matches.push({
        path: normalized,
        ...match,
        line: location.line + 1,
        column: location.character + 1,
      })
  }

  function visit(node: ts.Node) {
    if (ts.isIdentifier(node) && exactModelKeys.has(node.text))
      addMatches(node, [{ kind: 'model-identifier', value: node.text }])

    if (ts.isJsxText(node))
      addMatches(node, matchesForLiteral(node.getText(sourceFile), true))
    else if (ts.isRegularExpressionLiteral(node))
      addMatches(node, matchesForLiteral(node.text.replaceAll('\\/', '/')))

    const isVariableDeclarationName =
      ts.isIdentifier(node) &&
      ts.isVariableDeclaration(node.parent) &&
      node.parent.name === node
    if (
      ts.isExpression(node) &&
      !ts.isRegularExpressionLiteral(node) &&
      !isVariableDeclarationName &&
      !hasFoldedStringParent(node, environment)
    ) {
      const value = staticPrimitive(node, environment)
      if (typeof value === 'string')
        addMatches(
          node,
          matchesForLiteral(
            value,
            normalized === 'package.json' && commandText.test(value),
          ),
        )
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return matches
}

export function fingerprintGap15Matches(matches: readonly Gap15Match[]) {
  const inventory = matches
    .map((match) => `${match.kind}\0${match.value}`)
    .sort()
    .join('\n')
  return createHash('sha256').update(inventory).digest('hex')
}

export function fingerprintGap15Source(source: string) {
  return createHash('sha256').update(source).digest('hex')
}

function sourceWithoutComments(source: string) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  )
  const output = [...source]
  for (let token = scanner.scan(); token !== ts.SyntaxKind.EndOfFileToken; ) {
    if (
      token === ts.SyntaxKind.SingleLineCommentTrivia ||
      token === ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      for (
        let index = scanner.getTokenPos();
        index < scanner.getTextPos();
        index += 1
      )
        if (output[index] !== '\n' && output[index] !== '\r')
          output[index] = ' '
    }
    token = scanner.scan()
  }
  return output.join('')
}

function nodeContainsRange(node: ts.Node, start: number, end: number) {
  return node.getFullStart() <= start && node.getEnd() >= end
}

function narrowestNodeContaining(
  sourceFile: ts.SourceFile,
  start: number,
  end: number,
) {
  let result: ts.Node = sourceFile
  function visit(node: ts.Node) {
    if (!nodeContainsRange(node, start, end)) return
    result = node
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)
  return result
}

function isStringEvidenceNode(node: ts.Node) {
  return (
    ts.isJsxText(node) ||
    ts.isNoSubstitutionTemplateLiteral(node) ||
    ts.isStringLiteral(node) ||
    ts.isTemplateExpression(node) ||
    node.kind === ts.SyntaxKind.TemplateHead ||
    node.kind === ts.SyntaxKind.TemplateMiddle ||
    node.kind === ts.SyntaxKind.TemplateTail
  )
}

function stringAncestor(node: ts.Node, start: number, end: number) {
  let current: ts.Node | undefined = node
  while (current) {
    if (
      isStringEvidenceNode(current) &&
      current.getFullStart() <= start &&
      current.getEnd() >= end
    )
      return current
    current = current.parent
  }
  return undefined
}

function regexAncestor(node: ts.Node, start: number, end: number) {
  let current: ts.Node | undefined = node
  while (current) {
    if (
      ts.isRegularExpressionLiteral(current) &&
      current.getFullStart() <= start &&
      current.getEnd() >= end
    )
      return current
    current = current.parent
  }
  return undefined
}

function staticTruthiness(
  expression: ts.Expression,
  environment: StaticEnvironment,
): boolean | undefined {
  const unwrapped = unwrapExpression(expression)
  if (
    ts.isPrefixUnaryExpression(unwrapped) &&
    unwrapped.operator === ts.SyntaxKind.ExclamationToken
  ) {
    const operand = staticTruthiness(unwrapped.operand, environment)
    return operand === undefined ? undefined : !operand
  }
  const value = staticPrimitive(unwrapped, environment)
  return value === undefined ? undefined : Boolean(value)
}

function isInsideDeadBranch(node: ts.Node, environment: StaticEnvironment) {
  let current = node
  while (current.parent) {
    const parent = current.parent
    if (ts.isIfStatement(parent)) {
      const truthiness = staticTruthiness(parent.expression, environment)
      if (
        (truthiness === false &&
          nodeContainsRange(
            parent.thenStatement,
            current.getFullStart(),
            current.getEnd(),
          )) ||
        (truthiness === true &&
          parent.elseStatement &&
          nodeContainsRange(
            parent.elseStatement,
            current.getFullStart(),
            current.getEnd(),
          ))
      )
        return true
    } else if (ts.isWhileStatement(parent) || ts.isForStatement(parent)) {
      const condition = ts.isWhileStatement(parent)
        ? parent.expression
        : parent.condition
      if (condition && staticTruthiness(condition, environment) === false)
        return true
    } else if (
      ts.isConditionalExpression(parent) &&
      current !== parent.condition
    ) {
      const truthiness = staticTruthiness(parent.condition, environment)
      if (
        (truthiness === false && current === parent.whenTrue) ||
        (truthiness === true && current === parent.whenFalse)
      )
        return true
    } else if (ts.isBinaryExpression(parent) && current === parent.right) {
      const left = staticTruthiness(parent.left, environment)
      if (
        (parent.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
          left === false) ||
        (parent.operatorToken.kind === ts.SyntaxKind.BarBarToken &&
          left === true)
      )
        return true
    }
    current = parent
  }
  return false
}

function isExecutedValue(node: ts.Node) {
  let current = node
  while (current.parent) {
    const parent = current.parent
    if (
      (ts.isCallExpression(parent) || ts.isNewExpression(parent)) &&
      parent.arguments?.some(
        (argument) =>
          argument.getFullStart() <= current.getFullStart() &&
          argument.getEnd() >= current.getEnd(),
      )
    )
      return true
    if (ts.isTaggedTemplateExpression(parent) && parent.template === current)
      return true
    if (ts.isVariableDeclaration(parent)) return false
    if (
      ts.isArrayLiteralExpression(parent) ||
      ts.isAsExpression(parent) ||
      ts.isBinaryExpression(parent) ||
      ts.isNonNullExpression(parent) ||
      ts.isObjectLiteralExpression(parent) ||
      ts.isParenthesizedExpression(parent) ||
      ts.isPropertyAssignment(parent) ||
      ts.isSatisfiesExpression(parent) ||
      ts.isSpreadAssignment(parent) ||
      ts.isTemplateExpression(parent) ||
      ts.isTypeAssertionExpression(parent)
    ) {
      current = parent
      continue
    }
    return false
  }
  return false
}

function countPackageScriptOccurrences(source: string, marker: string) {
  let parsed: unknown
  try {
    parsed = JSON.parse(source)
  } catch {
    return 0
  }
  const scripts = asRecord(asRecord(parsed)?.scripts)
  if (!scripts) return 0
  let count = 0
  for (const value of Object.values(scripts)) {
    if (typeof value !== 'string') continue
    let offset = 0
    while (offset <= value.length - marker.length) {
      const index = value.indexOf(marker, offset)
      if (index < 0) break
      count += 1
      offset = index + marker.length
    }
  }
  return count
}

function countEvidenceOccurrences(
  filePath: string,
  source: string,
  marker: string,
  role: Gap15EvidenceMarkerRole,
) {
  if (!marker) return 0
  if (role === 'package-script')
    return filePath === 'package.json'
      ? countPackageScriptOccurrences(source, marker)
      : 0

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(filePath),
  )
  const environment = collectStaticEnvironment(sourceFile)
  const executableSource = sourceWithoutComments(source)
  let count = 0
  let offset = 0
  while (offset <= source.length - marker.length) {
    const index = source.indexOf(marker, offset)
    if (index < 0) break
    const end = index + marker.length
    offset = end
    if (executableSource.slice(index, end) !== marker) continue
    const node = narrowestNodeContaining(sourceFile, index, end)
    if (isInsideDeadBranch(node, environment)) continue
    const literal = stringAncestor(node, index, end)
    const regex = regexAncestor(node, index, end)
    if (
      (role === 'executable-code' && !literal && !regex) ||
      (role === 'executed-string' && literal && isExecutedValue(literal)) ||
      (role === 'executed-regex' && regex && isExecutedValue(regex))
    )
      count += 1
  }
  return count
}

function issue(
  issues: Gap15Issue[],
  code: Gap15IssueCode,
  message: string,
  filePath?: string,
) {
  issues.push({ code, message, ...(filePath ? { path: filePath } : {}) })
}

function parseClassification(
  value: unknown,
  issues: Gap15Issue[],
): Gap15Classification | undefined {
  const record = asRecord(value)
  const rawPath = record?.path
  const normalized = typeof rawPath === 'string' ? normalizePath(rawPath) : ''
  if (
    !record ||
    !hasOnlyKeys(record, [
      'path',
      'category',
      'reason',
      'expectedMatchCount',
      'matchFingerprint',
      'sourceFingerprint',
    ]) ||
    !normalized ||
    !isSafeRepositoryPath(normalized)
  ) {
    issue(
      issues,
      'invalid-allowlist',
      'Classification has an invalid repository path.',
      normalized || undefined,
    )
    return undefined
  }
  if (
    typeof record.category !== 'string' ||
    !classificationCategories.has(
      record.category as Gap15ClassificationCategory,
    )
  ) {
    issue(
      issues,
      'invalid-classification',
      `${normalized} has unknown classification ${JSON.stringify(record.category)}.`,
      normalized,
    )
    return undefined
  }
  const category = record.category as Gap15ClassificationCategory
  const approvedCategory = approvedCategoryForPath(normalized)
  if (!approvedCategory || approvedCategory !== category) {
    issue(
      issues,
      'invalid-classification',
      `${normalized} is not approved for ${category}.`,
      normalized,
    )
    if (!approvedCategory)
      issue(
        issues,
        'forbidden-generic-assumption',
        `${normalized} is generic infrastructure and cannot be allowlisted.`,
        normalized,
      )
  }
  if (
    typeof record.reason !== 'string' ||
    record.reason.trim().length < 20 ||
    !Number.isInteger(record.expectedMatchCount) ||
    Number(record.expectedMatchCount) < 1 ||
    typeof record.matchFingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(record.matchFingerprint) ||
    typeof record.sourceFingerprint !== 'string' ||
    !/^[a-f0-9]{64}$/.test(record.sourceFingerprint)
  ) {
    issue(
      issues,
      'invalid-allowlist',
      `Classification for ${normalized} is malformed.`,
      normalized,
    )
    return undefined
  }
  if (!approvedCategory || approvedCategory !== category) return undefined
  return {
    path: normalized,
    category,
    reason: record.reason,
    expectedMatchCount: Number(record.expectedMatchCount),
    matchFingerprint: record.matchFingerprint,
    sourceFingerprint: record.sourceFingerprint,
  }
}

function parseExternalEvidence(
  value: unknown,
  bindingId: string,
  issues: Gap15Issue[],
): Gap15ExternalEvidence | undefined {
  const record = asRecord(value)
  const expected = GAP15_ACCEPTED_GAP01_EXTERNAL_EVIDENCE
  const artifactHashes = Array.isArray(record?.artifactHashes)
    ? record.artifactHashes
    : []
  const isExact =
    record !== undefined &&
    hasOnlyKeys(record, [
      'checkpoint',
      'checkpointSourceAggregate',
      'acceptedPrismaCuidAggregate',
      'copiedSourceFingerprint',
      'artifactHashes',
    ]) &&
    bindingId === 'gap01-adminmeta-arbitrary-shapes' &&
    record.checkpoint === expected.checkpoint &&
    record.checkpointSourceAggregate === expected.checkpointSourceAggregate &&
    record.acceptedPrismaCuidAggregate ===
      expected.acceptedPrismaCuidAggregate &&
    record.copiedSourceFingerprint === expected.copiedSourceFingerprint &&
    artifactHashes.length === expected.artifactHashes.length &&
    artifactHashes.every(
      (hash, index) => hash === expected.artifactHashes[index],
    )
  if (!isExact) {
    issue(
      issues,
      'invalid-allowlist',
      `External evidence binding ${bindingId} is not bound to the accepted checkpoint-028/a61 boundary.`,
    )
    return undefined
  }
  return expected
}

function parseEvidenceBinding(
  value: unknown,
  files: Readonly<Record<string, string>>,
  issues: Gap15Issue[],
): Gap15EvidenceBinding | undefined {
  const record = asRecord(value)
  const id = typeof record?.id === 'string' ? record.id : ''
  if (
    !record ||
    !id ||
    !hasOnlyKeys(record, [
      'id',
      'evidenceKind',
      'browserScope',
      'claimBoundary',
      'markers',
      'externalEvidence',
    ])
  ) {
    issue(
      issues,
      'invalid-allowlist',
      'Evidence binding is missing its id or contains unknown fields.',
    )
    return undefined
  }
  if (
    typeof record.evidenceKind !== 'string' ||
    !evidenceKinds.has(record.evidenceKind as Gap15EvidenceKind)
  ) {
    issue(
      issues,
      'invalid-allowlist',
      `Evidence binding ${id} has unknown evidenceKind ${JSON.stringify(record.evidenceKind)}.`,
    )
    return undefined
  }
  if (
    typeof record.browserScope !== 'string' ||
    !browserScopes.has(record.browserScope as Gap15BrowserScope)
  ) {
    issue(
      issues,
      'invalid-allowlist',
      `Evidence binding ${id} has unknown browserScope ${JSON.stringify(record.browserScope)}.`,
    )
    return undefined
  }
  const evidenceKind = record.evidenceKind as Gap15EvidenceKind
  const browserScope = record.browserScope as Gap15BrowserScope
  const externalEvidence =
    evidenceKind === 'external-browser-evidence'
      ? parseExternalEvidence(record.externalEvidence, id, issues)
      : undefined
  if (
    evidenceKind !== 'external-browser-evidence' &&
    record.externalEvidence !== undefined
  )
    issue(
      issues,
      'invalid-allowlist',
      `Non-browser evidence binding ${id} cannot carry external evidence metadata.`,
    )
  if (
    evidenceKind === 'external-browser-evidence'
      ? browserScope !== 'external-memory-adminmeta-two-shape'
      : browserScope !== 'none'
  )
    issue(
      issues,
      'invalid-allowlist',
      `Evidence binding ${id} has an incompatible browser scope.`,
    )
  if (
    typeof record.claimBoundary !== 'string' ||
    record.claimBoundary.trim().length < 20 ||
    !Array.isArray(record.markers) ||
    record.markers.length === 0
  ) {
    issue(issues, 'invalid-allowlist', `Evidence binding ${id} is incomplete.`)
    return undefined
  }

  const markers: Gap15EvidenceMarker[] = []
  for (const rawMarker of record.markers) {
    const marker = asRecord(rawMarker)
    const markerPath =
      typeof marker?.path === 'string' ? normalizePath(marker.path) : ''
    if (
      !marker ||
      !hasOnlyKeys(marker, [
        'path',
        'text',
        'expectedCount',
        'role',
        'sourceFingerprint',
      ]) ||
      !markerPath ||
      !isSafeRepositoryPath(markerPath) ||
      typeof marker.text !== 'string' ||
      marker.text.length === 0 ||
      !Number.isInteger(marker.expectedCount) ||
      Number(marker.expectedCount) < 1 ||
      typeof marker.role !== 'string' ||
      !evidenceMarkerRoles.has(marker.role as Gap15EvidenceMarkerRole) ||
      typeof marker.sourceFingerprint !== 'string' ||
      !/^[a-f0-9]{64}$/.test(marker.sourceFingerprint)
    ) {
      issue(
        issues,
        'invalid-allowlist',
        `Evidence binding ${id} contains an invalid marker.`,
        markerPath || undefined,
      )
      continue
    }
    const expectedCount = Number(marker.expectedCount)
    const source = files[markerPath]
    const actualSourceFingerprint =
      source === undefined ? undefined : fingerprintGap15Source(source)
    if (actualSourceFingerprint !== marker.sourceFingerprint)
      issue(
        issues,
        'stale-evidence',
        `Evidence ${id} source fingerprint changed: expected ${marker.sourceFingerprint}, found ${actualSourceFingerprint ?? 'missing'}.`,
        markerPath,
      )
    const role = marker.role as Gap15EvidenceMarkerRole
    const actualCount =
      source === undefined
        ? 0
        : countEvidenceOccurrences(markerPath, source, marker.text, role)
    if (actualCount !== expectedCount)
      issue(
        issues,
        'stale-evidence',
        `Evidence ${id} marker expected ${expectedCount} executable occurrence(s), found ${actualCount}: ${JSON.stringify(marker.text)}`,
        markerPath,
      )
    markers.push({
      path: markerPath,
      text: marker.text,
      expectedCount,
      role,
      sourceFingerprint: marker.sourceFingerprint,
    })
  }
  return {
    id,
    evidenceKind,
    browserScope,
    claimBoundary: record.claimBoundary,
    markers,
    ...(externalEvidence ? { externalEvidence } : {}),
  }
}

export function auditGap15Files(
  inputFiles: Readonly<Record<string, string>>,
  allowlist: Gap15Allowlist | unknown,
): Gap15AuditReport {
  const files = Object.fromEntries(
    Object.entries(inputFiles).map(([filePath, source]) => [
      normalizePath(filePath),
      source,
    ]),
  )
  const scannedPaths = Object.keys(files).filter(shouldScanPath).sort()
  const matches = scannedPaths.flatMap((filePath) =>
    scanGap15Source(filePath, files[filePath]),
  )
  const matchesByPath = new Map<string, Gap15Match[]>()
  for (const match of matches) {
    const pathMatches = matchesByPath.get(match.path) ?? []
    pathMatches.push(match)
    matchesByPath.set(match.path, pathMatches)
  }

  const issues: Gap15Issue[] = []
  const allowlistRecord = asRecord(allowlist)
  if (
    allowlistRecord &&
    !hasOnlyKeys(allowlistRecord, [
      'version',
      'classifications',
      'evidenceBindings',
    ])
  )
    issue(
      issues,
      'invalid-allowlist',
      'GAP-15 allowlist contains unknown top-level fields.',
    )
  if (allowlistRecord?.version !== 1)
    issue(
      issues,
      'invalid-allowlist',
      'GAP-15 allowlist version must be exactly 1.',
    )

  const rawClassifications = Array.isArray(allowlistRecord?.classifications)
    ? allowlistRecord.classifications
    : []
  if (!Array.isArray(allowlistRecord?.classifications))
    issue(
      issues,
      'invalid-allowlist',
      'GAP-15 classifications must be an array.',
    )
  const classifications: Gap15Classification[] = []
  const classificationByPath = new Map<string, Gap15Classification>()
  for (const rawClassification of rawClassifications) {
    const classification = parseClassification(rawClassification, issues)
    if (!classification) continue
    if (classificationByPath.has(classification.path)) {
      issue(
        issues,
        'invalid-allowlist',
        `Duplicate classification for ${classification.path}.`,
        classification.path,
      )
      continue
    }
    classifications.push(classification)
    classificationByPath.set(classification.path, classification)
  }

  for (const [filePath, pathMatches] of matchesByPath) {
    const approvedCategory = approvedCategoryForPath(filePath)
    if (!approvedCategory) {
      issue(
        issues,
        'forbidden-generic-assumption',
        `Generic infrastructure contains ${pathMatches.length} starter-specific assumption(s): ${pathMatches.map((match) => `${match.kind}:${match.value}@${match.line}`).join(', ')}`,
        filePath,
      )
      continue
    }
    const classification = classificationByPath.get(filePath)
    if (!classification) {
      issue(
        issues,
        'unclassified-literal',
        `Unclassified ${approvedCategory} assumptions: ${pathMatches.map((match) => `${match.kind}:${match.value}@${match.line}`).join(', ')}`,
        filePath,
      )
      continue
    }
    const sourceFingerprint = fingerprintGap15Source(files[filePath])
    const matchFingerprint = fingerprintGap15Matches(pathMatches)
    if (
      classification.expectedMatchCount !== pathMatches.length ||
      classification.matchFingerprint !== matchFingerprint ||
      classification.sourceFingerprint !== sourceFingerprint
    )
      issue(
        issues,
        'stale-allowlist',
        `Inventory/source changed: expected ${classification.expectedMatchCount}/${classification.matchFingerprint}/${classification.sourceFingerprint}, found ${pathMatches.length}/${matchFingerprint}/${sourceFingerprint}.`,
        filePath,
      )
  }

  for (const classification of classifications) {
    const pathMatches = matchesByPath.get(classification.path)
    if (!pathMatches)
      issue(
        issues,
        'stale-allowlist',
        'Allowlist entry no longer classifies any starter assumption.',
        classification.path,
      )
    else if (!(classification.path in files))
      issue(
        issues,
        'stale-allowlist',
        'Allowlist source file is missing.',
        classification.path,
      )
  }

  const rawEvidenceBindings = Array.isArray(allowlistRecord?.evidenceBindings)
    ? allowlistRecord.evidenceBindings
    : []
  if (!Array.isArray(allowlistRecord?.evidenceBindings))
    issue(
      issues,
      'invalid-allowlist',
      'GAP-15 evidenceBindings must be an array.',
    )
  const evidenceBindings: Gap15EvidenceBinding[] = []
  const evidenceIds = new Set<string>()
  for (const rawBinding of rawEvidenceBindings) {
    const binding = parseEvidenceBinding(rawBinding, files, issues)
    if (!binding) continue
    if (evidenceIds.has(binding.id))
      issue(
        issues,
        'invalid-allowlist',
        `Duplicate evidence binding id ${binding.id}.`,
      )
    evidenceIds.add(binding.id)
    evidenceBindings.push(binding)
  }

  const sortedIssues = [...issues].sort((left, right) =>
    `${left.path ?? ''}:${left.code}:${left.message}`.localeCompare(
      `${right.path ?? ''}:${right.code}:${right.message}`,
    ),
  )
  return {
    ok: sortedIssues.length === 0,
    issues: sortedIssues,
    matches,
    evidenceBindings,
    summary: {
      scannedFiles: scannedPaths.length,
      literalMatches: matches.length,
      classifiedFiles: matchesByPath.size,
      expectedDemoFiles: classifications.filter(
        (entry) => entry.category === 'expected-demo',
      ).length,
      expectedSourceOracleFiles: classifications.filter(
        (entry) => entry.category === 'expected-source-oracle',
      ).length,
      evidenceBindings: evidenceBindings.length,
      browserRuns: 0,
      databaseRuns: 0,
    },
  }
}

async function collectRepositoryFiles(root: string) {
  const files: Record<string, string> = {}

  async function visit(relativeDirectory = ''): Promise<void> {
    const absoluteDirectory = path.join(root, relativeDirectory)
    let entries
    try {
      entries = await readdir(absoluteDirectory, { withFileTypes: true })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    for (const entry of entries.sort((left, right) =>
      left.name.localeCompare(right.name),
    )) {
      const relativePath = normalizePath(
        path.join(relativeDirectory, entry.name),
      )
      if (entry.isDirectory()) {
        if (!excludedDirectoryNames.has(entry.name)) await visit(relativePath)
        continue
      }
      if (!entry.isFile() || !shouldScanPath(relativePath)) continue
      files[relativePath] = await readFile(
        path.join(root, relativePath),
        'utf8',
      )
    }
  }

  await visit()
  return files
}

export const GAP15_ALLOWLIST_PATH = 'scripts/gap15-hardcode-allowlist.json'

export async function runGap15RepositoryAudit(root = process.cwd()) {
  const [files, allowlistSource] = await Promise.all([
    collectRepositoryFiles(root),
    readFile(path.join(root, GAP15_ALLOWLIST_PATH), 'utf8'),
  ])
  return auditGap15Files(files, JSON.parse(allowlistSource) as unknown)
}

function formatIssue(entry: Gap15Issue) {
  return `- [${entry.code}]${entry.path ? ` ${entry.path}:` : ''} ${entry.message}`
}

async function main() {
  const report = await runGap15RepositoryAudit()
  if (!report.ok) {
    console.error(
      `GAP-15 hard-code audit failed with ${report.issues.length} issue(s):\n${report.issues.map(formatIssue).join('\n')}`,
    )
    process.exitCode = 1
    return
  }

  console.info(
    `GAP-15 hard-code audit passed: ${report.summary.literalMatches} starter assumption(s) in ${report.summary.classifiedFiles} exactly classified file(s) (${report.summary.expectedDemoFiles} demo, ${report.summary.expectedSourceOracleFiles} source-oracle); ${report.summary.evidenceBindings} bounded evidence binding(s).`,
  )
  for (const binding of report.evidenceBindings)
    console.info(
      `- ${binding.id}: ${binding.evidenceKind}; browser=${binding.browserScope}; ${binding.claimBoundary}`,
    )
  console.info(
    'This static gate ran no browser, server, or database and makes no browser-breadth or GAP-15 closure claim.',
  )
}

const invokedPath = process.argv[1]
if (
  invokedPath &&
  pathToFileURL(path.resolve(invokedPath)).href === import.meta.url
)
  await main()
