import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const sourceRoot = path.resolve(
  process.env.NEXT_KEYSTONE_STARTER_DIR ?? '../next-keystone-starter',
)
const replacementRoot = process.cwd()

function read(filePath) {
  return readFileSync(filePath, 'utf8')
}

function normalizeKnownTypeAdaptations(source) {
  return source
    .replace(
      /roleForSession\(session\)\.(can[A-Za-z]+)/g,
      'session?.data.role?.$1',
    )
    .replace(/session\?\.itemId === item\?\.id/g, 'session?.itemId === item.id')
    .replace(/context\.session\.itemId/g, 'context.session?.itemId')
}

function initializerFor(source, exportName, fileName) {
  const javascript = ts.transpileModule(normalizeKnownTypeAdaptations(source), {
    compilerOptions: {
      target: ts.ScriptTarget.ESNext,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
    fileName,
  }).outputText
  const sourceFile = ts.createSourceFile(
    fileName,
    javascript,
    ts.ScriptTarget.ESNext,
    true,
    ts.ScriptKind.JS,
  )
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer
      ) {
        return declaration.initializer
      }
    }
  }
  throw new Error(
    `Unable to find exported ${exportName} initializer in ${fileName}`,
  )
}

function canonicalNode(node) {
  let value = ''
  if (ts.isIdentifier(node)) value = node.text
  else if (ts.isStringLiteral(node) || ts.isNumericLiteral(node))
    value = node.text
  else if (
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword
  )
    value = ts.tokenToString(node.kind) ?? ''
  const children = []
  node.forEachChild((child) => children.push(canonicalNode(child)))
  return [node.kind, value, children]
}

const models = ['User', 'Role', 'Todo', 'TodoImage']
const mismatches = []
for (const modelName of models) {
  const sourcePath = path.join(
    sourceRoot,
    'features/keystone/models',
    `${modelName}.ts`,
  )
  const replacementPath = path.join(
    replacementRoot,
    'src/features/cms/models',
    `${modelName}.ts`,
  )
  const sourceInitializer = canonicalNode(
    initializerFor(read(sourcePath), modelName, sourcePath),
  )
  const replacementInitializer = canonicalNode(
    initializerFor(read(replacementPath), modelName, replacementPath),
  )
  if (
    JSON.stringify(sourceInitializer) !== JSON.stringify(replacementInitializer)
  )
    mismatches.push(modelName)
}

const result = {
  sourceRoot,
  readOnly: true,
  comparedModels: models,
  importOnlyCompatibleModels: models.filter(
    (modelName) => !mismatches.includes(modelName),
  ),
  mismatches,
  importOnlyCompatibility: mismatches.length === 0,
  normalization: [
    'TypeScript-only annotations are erased before comparison.',
    'Local roleForSession and optional-item guards are normalized to their source expressions.',
    'Imports and comments are outside the exported list initializer comparison.',
  ],
}

assert.equal(
  result.importOnlyCompatibility,
  true,
  `Source model initializer mismatch: ${mismatches.join(', ')}`,
)
console.log(JSON.stringify(result, null, 2))
console.log('\nDirect next-keystone-starter model portability gate: PASS')
