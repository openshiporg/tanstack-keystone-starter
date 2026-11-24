import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { makeExecutableSchema } from '@graphql-tools/schema'
import { build } from 'esbuild'
import {
  buildSchema,
  findBreakingChanges,
  findDangerousChanges,
  printSchema,
} from 'graphql'

import { addAuthGraphQLSchema } from '../src/features/cms/auth/graphql.ts'
import { statelessSessions } from '../src/features/cms/auth/session.ts'
import { initialiseLists } from '../src/features/cms/config.ts'
import { createAuth } from '../src/features/cms/keystone/auth.ts'
import { config } from '../src/features/cms/keystone/core.ts'
import { printCmsPrismaSchema } from '../src/features/cms/prisma-schema.ts'
import {
  generateCmsResolversForLists,
  generateCmsTypeDefsForLists,
} from '../src/features/cms/runtime.ts'

const replacementRoot = process.cwd()
const configuredConsumers = process.env.OPENFRONT_CONSUMER_DIRS?.split(
  path.delimiter,
)
  .map((entry) => entry.trim())
  .filter(Boolean)
const consumers = configuredConsumers?.length
  ? configuredConsumers.map((entry) => path.resolve(entry))
  : [path.resolve('../opensource.builders'), path.resolve('../os.org')]

const compatibilityAliases = new Map([
  [
    '@keystone-6/core',
    path.join(replacementRoot, 'src/features/cms/keystone/core.ts'),
  ],
  [
    '@keystone-6/core/access',
    path.join(replacementRoot, 'src/features/cms/keystone/access.ts'),
  ],
  [
    '@keystone-6/core/fields',
    path.join(replacementRoot, 'src/features/cms/keystone/fields.ts'),
  ],
  [
    '@keystone-6/fields-document',
    path.join(replacementRoot, 'src/features/cms/keystone/fields-document.ts'),
  ],
])

function read(filePath) {
  return readFileSync(filePath, 'utf8')
}

function sanitizePrismaSchema(schema) {
  return schema
    .split('\n')
    .filter(
      (line) =>
        !line.trimStart().startsWith('url ') &&
        !line.trimStart().startsWith('shadowDatabaseUrl '),
    )
    .join('\n')
}

function prismaDiff(sourcePath, replacementPath) {
  const prismaBinary = path.join(replacementRoot, 'node_modules/.bin/prisma')
  const sql = execFileSync(
    prismaBinary,
    [
      'migrate',
      'diff',
      '--from-schema',
      sourcePath,
      '--to-schema',
      replacementPath,
      '--script',
    ],
    {
      cwd: replacementRoot,
      env: {
        ...process.env,
        DATABASE_URL:
          process.env.DATABASE_URL ??
          'postgresql://consumer_audit:consumer_audit@127.0.0.1:1/consumer_audit',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
  return sql
    .split('\n')
    .filter((line) => line.trim())
    .filter((line) => line.trim() !== '-- This is an empty migration.')
}

async function loadConsumerContract(consumerRoot, temporaryDirectory) {
  const modelsPath = path.join(
    consumerRoot,
    'features/keystone/models/index.ts',
  )
  const mutationsPath = path.join(
    consumerRoot,
    'features/keystone/mutations/index.ts',
  )
  assert.ok(
    existsSync(modelsPath),
    `Missing consumer model registry: ${modelsPath}`,
  )
  assert.ok(
    existsSync(mutationsPath),
    `Missing consumer schema extension: ${mutationsPath}`,
  )
  const outputPath = path.join(
    temporaryDirectory,
    `${path.basename(consumerRoot)}-models.mjs`,
  )
  await build({
    stdin: {
      contents: `export { models, default } from ${JSON.stringify(modelsPath)}; export { extendGraphqlSchema } from ${JSON.stringify(mutationsPath)};`,
      resolveDir: consumerRoot,
      sourcefile: 'consumer-contract.ts',
      loader: 'ts',
    },
    outfile: outputPath,
    bundle: true,
    packages: 'external',
    format: 'esm',
    platform: 'node',
    target: 'node22',
    logLevel: 'silent',
    plugins: [
      {
        name: 'tanstack-keystone-compatibility-aliases',
        setup(buildApi) {
          buildApi.onResolve({ filter: /lib\/railway$/ }, (args) => ({
            path: path.resolve(args.resolveDir, args.path),
            external: true,
          }))
          buildApi.onResolve({ filter: /^@keystone-6\// }, (args) => {
            const replacement = compatibilityAliases.get(args.path)
            if (!replacement)
              return {
                errors: [
                  {
                    text: `No local compatibility alias for ${args.path}`,
                  },
                ],
              }
            return { path: replacement }
          })
        },
      },
    ],
  })
  const loaded = await import(
    `${pathToFileURL(outputPath).href}?v=${Date.now()}`
  )
  return {
    models: loaded.models ?? loaded.default,
    extendGraphqlSchema: loaded.extendGraphqlSchema,
  }
}

function compareGraphql(sourceSdl, replacementSdl) {
  const sourceSchema = buildSchema(sourceSdl)
  const replacementSchema = buildSchema(replacementSdl)
  const sourceTypes = Object.keys(sourceSchema.getTypeMap()).filter(
    (name) => !name.startsWith('__'),
  )
  const replacementTypes = new Set(
    Object.keys(replacementSchema.getTypeMap()).filter(
      (name) => !name.startsWith('__'),
    ),
  )
  const sourceOnlyTypes = sourceTypes.filter(
    (name) => !replacementTypes.has(name),
  )
  const breakingChanges = findBreakingChanges(sourceSchema, replacementSchema)
  const dangerousChanges = findDangerousChanges(sourceSchema, replacementSchema)
  return { sourceOnlyTypes, breakingChanges, dangerousChanges }
}

async function validateConsumer(consumerRoot, temporaryDirectory) {
  const packageJson = JSON.parse(read(path.join(consumerRoot, 'package.json')))
  const sourceConfig = read(
    path.join(consumerRoot, 'features/keystone/index.ts'),
  )
  assert.match(sourceConfig, /listKey:\s*["']User["']/)
  assert.match(sourceConfig, /identityField:\s*["']email["']/)
  assert.match(sourceConfig, /secretField:\s*["']password["']/)
  assert.match(sourceConfig, /passwordResetLink:\s*{/)
  const { models, extendGraphqlSchema } = await loadConsumerContract(
    consumerRoot,
    temporaryDirectory,
  )
  assert.ok(models && typeof models === 'object' && !Array.isArray(models))
  assert.equal(typeof extendGraphqlSchema, 'function')
  const auth = {
    listKey: 'User',
    identityField: 'email',
    secretField: 'password',
    initFirstItem: { fields: ['name', 'email', 'password'] },
    passwordResetLink: { sendToken: async () => {} },
    sessionData: 'id',
  }
  const { withAuth } = createAuth(auth)
  const consumerConfig = withAuth(
    config({
      lists: models,
      session: statelessSessions({
        maxAge: 60 * 60,
        secret: 'representative-consumer-audit-secret-32-bytes',
      }),
    }),
  )
  const lists = initialiseLists(consumerConfig)
  const baseSchema = makeExecutableSchema({
    typeDefs: generateCmsTypeDefsForLists(lists),
    resolvers: generateCmsResolversForLists(lists),
  })
  const replacementGraphql = printSchema(
    extendGraphqlSchema(
      addAuthGraphQLSchema(baseSchema, lists, consumerConfig.auth),
    ),
  )
  const graphql = compareGraphql(
    read(path.join(consumerRoot, 'schema.graphql')),
    replacementGraphql,
  )

  const sourcePrismaPath = path.join(
    temporaryDirectory,
    `${path.basename(consumerRoot)}-source.prisma`,
  )
  const replacementPrismaPath = path.join(
    temporaryDirectory,
    `${path.basename(consumerRoot)}-replacement.prisma`,
  )
  writeFileSync(
    sourcePrismaPath,
    sanitizePrismaSchema(read(path.join(consumerRoot, 'schema.prisma'))),
  )
  writeFileSync(replacementPrismaPath, printCmsPrismaSchema(lists))
  const prismaDifference = prismaDiff(sourcePrismaPath, replacementPrismaPath)

  return {
    name: path.basename(consumerRoot),
    packageName: packageJson.name ?? null,
    root: consumerRoot,
    listCount: lists.length,
    fieldCount: lists.reduce((count, list) => count + list.fields.length, 0),
    graphql: {
      sourceOnlyTypes: graphql.sourceOnlyTypes,
      breakingChanges: graphql.breakingChanges,
      dangerousChanges: graphql.dangerousChanges,
    },
    prisma: {
      sqlLineCount: prismaDifference.length,
      firstLines: prismaDifference.slice(0, 20),
    },
    compatible:
      graphql.sourceOnlyTypes.length === 0 &&
      graphql.breakingChanges.length === 0 &&
      graphql.dangerousChanges.length === 0 &&
      prismaDifference.length === 0,
  }
}

const temporaryParent = path.join(
  replacementRoot,
  '.cms-temp/openfront-consumers',
)
mkdirSync(temporaryParent, { recursive: true })
const temporaryDirectory = mkdtempSync(
  path.join(temporaryParent, 'consumer-audit-'),
)
try {
  const results = []
  for (const consumerRoot of consumers) {
    assert.ok(
      existsSync(consumerRoot),
      `Representative consumer is unavailable: ${consumerRoot}`,
    )
    results.push(await validateConsumer(consumerRoot, temporaryDirectory))
  }
  const report = {
    readOnly: true,
    consumerCount: results.length,
    consumers: results,
    compatibilityGate: results.every((result) => result.compatible),
  }
  console.log(JSON.stringify(report, null, 2))
  assert.equal(
    report.compatibilityGate,
    true,
    'One or more representative Openfront consumers are not contract-compatible',
  )
  console.log('\nRepresentative Openfront consumer compatibility gate: PASS')
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
