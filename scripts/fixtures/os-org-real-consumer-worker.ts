import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'

import { graphql } from 'graphql'

import { setCmsAdapterForTests } from '../../src/features/cms/adapters'
import { createPrismaCmsAdapter } from '../../src/features/cms/adapters/prisma'
import { createCmsPrismaClient } from '../../src/features/cms/prisma-client'
import { cmsConfig, cmsLists } from '../../src/features/cms/registry'
import {
  createCmsContext,
  getCmsGraphQLSchema,
} from '../../src/features/cms/runtime'

type JsonRecord = Record<string, unknown>
type GraphqlExecution = Awaited<ReturnType<typeof graphql>>

const mode = process.env.OS_ORG_REAL_CANARY_MODE
const resultPath = process.env.OS_ORG_REAL_CANARY_WORKER_RESULT
const createdUserId = process.env.OS_ORG_REAL_CANARY_CREATED_USER_ID

assert.ok(mode, 'OS_ORG_REAL_CANARY_MODE is required')
assert.ok(resultPath, 'OS_ORG_REAL_CANARY_WORKER_RESULT is required')

function asRecord(value: unknown, label = 'value'): JsonRecord {
  assert.ok(
    value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object`,
  )
  return value as JsonRecord
}

function asArray(value: unknown, label = 'value'): unknown[] {
  assert.ok(Array.isArray(value), `${label} must be an array`)
  return value
}

function errorCodes(result: GraphqlExecution) {
  return (result.errors ?? []).map((error) => error.extensions?.code)
}

function assertNoErrors(result: GraphqlExecution, label: string) {
  assert.equal(
    result.errors?.length ?? 0,
    0,
    `${label}: ${result.errors?.map((error) => error.message).join('\n')}`,
  )
}

function assertAccessDenied(result: GraphqlExecution, label: string) {
  assert.ok(result.errors?.length, `${label} unexpectedly returned no errors`)
  assert.ok(
    errorCodes(result).includes('KS_ACCESS_DENIED'),
    `${label} did not return KS_ACCESS_DENIED: ${result.errors
      ?.map((error) => `${error.extensions?.code}:${error.message}`)
      .join('\n')}`,
  )
}

function assertManyReadHidden(
  result: GraphqlExecution,
  field: string,
  label: string,
) {
  assertNoErrors(result, label)
  assert.deepEqual(
    asRecord(result.data, `${label} data`)[field],
    [],
    `${label} must use Keystone's denied-many hiding semantics`,
  )
}

function cookieFrom(headers: Headers) {
  const setCookie = headers.get('set-cookie') ?? ''
  const match = setCookie.match(/keystonejs-session=[^;]+/i)
  assert.ok(match, 'authentication did not issue a Keystone session cookie')
  return match[0]
}

const prisma = createCmsPrismaClient()
setCmsAdapterForTests(createPrismaCmsAdapter({ prisma }))
const schema = getCmsGraphQLSchema()

function requestFor(cookie?: string) {
  return new Request('http://os-org-canary.local/api/graphql', {
    headers: {
      'x-cms-disable-dev-auth-fallback': 'true',
      ...(cookie ? { cookie } : { 'x-cms-anonymous': 'true' }),
    },
  })
}

async function executeRaw(
  source: string,
  cookie?: string,
  variableValues?: JsonRecord,
  responseHeaders?: Headers,
) {
  const context = await createCmsContext(
    requestFor(cookie),
    schema,
    responseHeaders,
  )
  return graphql({ schema, source, variableValues, contextValue: context })
}

async function execute(
  label: string,
  source: string,
  cookie?: string,
  variableValues?: JsonRecord,
) {
  const result = await executeRaw(source, cookie, variableValues)
  assertNoErrors(result, label)
  return asRecord(result.data, `${label} data`)
}

async function authenticate(email: string, password: string) {
  const responseHeaders = new Headers()
  const result = await executeRaw(
    /* GraphQL */ `
      mutation Authenticate($email: String!, $password: String!) {
        authenticateUserWithPassword(email: $email, password: $password) {
          __typename
          ... on UserAuthenticationWithPasswordSuccess {
            item {
              id
              email
            }
          }
          ... on UserAuthenticationWithPasswordFailure {
            message
          }
        }
      }
    `,
    undefined,
    { email, password },
    responseHeaders,
  )
  assertNoErrors(result, `authenticate ${email}`)
  const auth = asRecord(
    asRecord(result.data, 'authentication data').authenticateUserWithPassword,
    'authentication result',
  )
  return { auth, responseHeaders }
}

async function authenticatedCookie(
  email: string,
  password: string,
  expectedId: string,
) {
  const { auth, responseHeaders } = await authenticate(email, password)
  assert.equal(
    auth.__typename,
    'UserAuthenticationWithPasswordSuccess',
    `authentication failed for ${email}`,
  )
  assert.equal(asRecord(auth.item, 'authenticated item').id, expectedId)
  return cookieFrom(responseHeaders)
}

async function uiAccessAllowed(cookie?: string) {
  const context = await createCmsContext(requestFor(cookie), schema)
  const isAccessAllowed = cmsConfig.ui?.isAccessAllowed
  if (typeof isAccessAllowed !== 'function') {
    throw new TypeError('os.org UI access callback is unavailable')
  }
  return Boolean(await isAccessAllowed(context))
}

async function assertAnonymousAndMemberAccess() {
  assert.equal(await uiAccessAllowed(), false)

  const publicCatalog = await execute(
    'anonymous public catalog read',
    /* GraphQL */ `
      query PublicCatalog {
        products(where: { stripeProductId: { equals: "prod_source_seed" } }) {
          id
          name
          prices {
            stripePriceId
          }
        }
        prices(where: { stripePriceId: { equals: "price_source_seed" } }) {
          id
          product {
            stripeProductId
          }
        }
      }
    `,
  )
  assert.equal(
    asRecord(asArray(publicCatalog.products, 'public products')[0]).name,
    'Source Seed Product',
  )
  assert.equal(
    asRecord(asArray(publicCatalog.prices, 'public prices')[0]).product &&
      asRecord(
        asRecord(asArray(publicCatalog.prices)[0]).product,
        'public price product',
      ).stripeProductId,
    'prod_source_seed',
  )

  assertManyReadHidden(
    await executeRaw('query { instances { id } }'),
    'instances',
    'anonymous Instance query',
  )
  assertAccessDenied(
    await executeRaw(
      'mutation { createProduct(data: { stripeProductId: "prod_anon_denied", name: "Denied", application: "openfront" }) { id } }',
    ),
    'anonymous Product create',
  )

  const badAuth = await authenticate(
    'member@os-org-canary.invalid',
    'wrong-password',
  )
  assert.equal(badAuth.auth.__typename, 'UserAuthenticationWithPasswordFailure')
  assert.equal(badAuth.auth.message, 'Authentication failed.')
  assert.equal(badAuth.responseHeaders.get('set-cookie'), null)

  const memberCookie = await authenticatedCookie(
    'member@os-org-canary.invalid',
    'member-canary-password',
    'source_member',
  )
  assert.equal(await uiAccessAllowed(memberCookie), false)

  assertAccessDenied(
    await executeRaw(
      'query { keystone { adminMeta { isAccessAllowed lists { key } } } }',
      memberCookie,
    ),
    'member AdminMeta query',
  )

  const memberView = await execute(
    'member ownership-filtered reads',
    /* GraphQL */ `
      query MemberView {
        authenticatedItem {
          ... on User {
            id
            email
            stripeCustomerID
            paymentMethod
            billingAddress
          }
        }
        users {
          id
          email
          stripeCustomerID
        }
        roles {
          id
          name
        }
        instances {
          id
          domain
          user {
            id
          }
          subscription {
            id
          }
        }
        subscriptions {
          id
          stripeSubscriptionId
          user {
            id
          }
          instance {
            id
          }
        }
      }
    `,
    memberCookie,
  )
  assert.equal(asRecord(memberView.authenticatedItem).id, 'source_member')
  assert.deepEqual(
    asArray(memberView.users).map((item) => asRecord(item).id),
    ['source_member'],
  )
  assert.equal(
    asRecord(asArray(memberView.users)[0]).stripeCustomerID,
    'cus_member_source',
  )
  assert.deepEqual(
    asArray(memberView.instances).map((item) => asRecord(item).id),
    ['source_member_instance'],
  )
  assert.deepEqual(
    asArray(memberView.subscriptions).map((item) => asRecord(item).id),
    ['source_member_subscription'],
  )
  assert.equal(asArray(memberView.roles).length, 2)

  for (const [label, mutation] of [
    [
      'member Product create',
      'mutation { createProduct(data: { stripeProductId: "prod_member_denied", name: "Denied", application: "openfront" }) { id } }',
    ],
    [
      'member Subscription create',
      'mutation { createSubscription(data: { stripeSubscriptionId: "sub_member_denied", status: "INCOMPLETE" }) { id } }',
    ],
    [
      'member Role create',
      'mutation { createRole(data: { name: "Denied Role" }) { id } }',
    ],
    [
      'member User create',
      'mutation { createUser(data: { name: "Denied User", email: "denied@os-org-canary.invalid", password: "denied-password" }) { id } }',
    ],
  ] as const) {
    assertAccessDenied(await executeRaw(mutation, memberCookie), label)
  }
  assertManyReadHidden(
    await executeRaw('query { newsletters { id } }', memberCookie),
    'newsletters',
    'member Newsletter query',
  )
  assertAccessDenied(
    await executeRaw(
      'mutation { updateInstance(where: { id: "source_member_instance" }, data: { projectStatus: "forbidden" }) { id } }',
      memberCookie,
    ),
    'member protected Instance field update',
  )
  assertAccessDenied(
    await executeRaw(
      'mutation { createInstance(data: { domain: "member-forbidden-owner", deploymentType: "openfront-restaurant", user: { connect: { id: "source_admin" } } }) { id } }',
      memberCookie,
    ),
    'member foreign Instance owner create',
  )

  const memberCreated = await execute(
    'member owned Instance create',
    /* GraphQL */ `
      mutation {
        createInstance(
          data: {
            domain: "member-created-instance"
            deploymentType: "openfront-restaurant"
          }
        ) {
          id
          domain
          user {
            id
          }
        }
      }
    `,
    memberCookie,
  )
  const createdInstance = asRecord(memberCreated.createInstance)
  assert.equal(createdInstance.domain, 'member-created-instance')
  assert.equal(asRecord(createdInstance.user).id, 'source_member')

  return {
    memberCreatedInstanceId: createdInstance.id,
    memberUserCount: asArray(memberView.users).length,
    memberInstanceCount: asArray(memberView.instances).length,
    memberSubscriptionCount: asArray(memberView.subscriptions).length,
  }
}

async function exercise() {
  assert.deepEqual(
    cmsLists.map((list) => list.key),
    [
      'User',
      'Role',
      'Product',
      'Price',
      'Instance',
      'Subscription',
      'Newsletter',
    ],
  )
  const policy = await assertAnonymousAndMemberAccess()

  const adminCookie = await authenticatedCookie(
    'admin@os-org-canary.invalid',
    'admin-canary-password',
    'source_admin',
  )
  assert.equal(await uiAccessAllowed(adminCookie), true)

  const adminMeta = await execute(
    'admin metadata access',
    'query { keystone { adminMeta { isAccessAllowed lists { key path } } } }',
    adminCookie,
  )
  const lists = asArray(
    asRecord(asRecord(adminMeta.keystone).adminMeta).lists,
    'admin metadata lists',
  ).map((list) => asRecord(list).key)
  assert.deepEqual(lists, [
    'User',
    'Role',
    'Product',
    'Price',
    'Instance',
    'Subscription',
    'Newsletter',
  ])

  const role = await execute(
    'create Role',
    'mutation { createRole(data: { name: "Cutover Operator", canAccessDashboard: false }) { id name } }',
    adminCookie,
  )
  const roleId = asRecord(role.createRole).id
  const user = await execute(
    'create User',
    /* GraphQL */ `
      mutation CreateUser($roleId: ID!) {
        createUser(
          data: {
            name: "Cutover Operator"
            email: "cutover.operator@os-org-canary.invalid"
            password: "cutover-operator-password"
            stripeCustomerID: "cus_cutover_operator"
            role: { connect: { id: $roleId } }
          }
        ) {
          id
          email
          role {
            id
          }
        }
      }
    `,
    adminCookie,
    { roleId },
  )
  const userId = asRecord(user.createUser).id
  assert.equal(asRecord(asRecord(user.createUser).role).id, roleId)

  const product = await execute(
    'create Product',
    /* GraphQL */ `
      mutation {
        createProduct(
          data: {
            stripeProductId: "prod_real_cutover"
            name: "Real Consumer Product"
            application: "openfront"
            description: "Created through replacement GraphQL"
          }
        ) {
          id
          stripeProductId
        }
      }
    `,
    adminCookie,
  )
  const productId = asRecord(product.createProduct).id
  const price = await execute(
    'create Price',
    /* GraphQL */ `
      mutation CreatePrice($productId: ID!) {
        createPrice(
          data: {
            stripePriceId: "price_real_cutover"
            description: "Real cutover monthly"
            unitAmount: 3100
            product: { connect: { id: $productId } }
          }
        ) {
          id
          product {
            id
          }
        }
      }
    `,
    adminCookie,
    { productId },
  )
  const priceId = asRecord(price.createPrice).id
  assert.equal(asRecord(asRecord(price.createPrice).product).id, productId)

  const instance = await execute(
    'create Instance',
    /* GraphQL */ `
      mutation CreateInstance($userId: ID!) {
        createInstance(
          data: {
            domain: "cutover-instance"
            deploymentType: "openfront-restaurant"
            projectId: "project_real_cutover"
            projectStatus: "ready"
            user: { connect: { id: $userId } }
          }
        ) {
          id
          user {
            id
          }
        }
      }
    `,
    adminCookie,
    { userId },
  )
  const instanceId = asRecord(instance.createInstance).id
  assert.equal(asRecord(asRecord(instance.createInstance).user).id, userId)

  const subscription = await execute(
    'create Subscription',
    /* GraphQL */ `
      mutation CreateSubscription(
        $priceId: ID!
        $instanceId: ID!
        $userId: ID!
      ) {
        createSubscription(
          data: {
            stripeSubscriptionId: "sub_real_cutover"
            status: "INCOMPLETE"
            price: { connect: { id: $priceId } }
            instance: { connect: { id: $instanceId } }
            user: { connect: { id: $userId } }
          }
        ) {
          id
          price {
            id
          }
          instance {
            id
          }
          user {
            id
          }
        }
      }
    `,
    adminCookie,
    { priceId, instanceId, userId },
  )
  const subscriptionId = asRecord(subscription.createSubscription).id
  assert.equal(
    asRecord(asRecord(subscription.createSubscription).instance).id,
    instanceId,
  )

  const newsletter = await execute(
    'create Newsletter',
    'mutation { createNewsletter(data: { email: "cutover-newsletter@os-org-canary.invalid", vertical: "general" }) { id email } }',
    adminCookie,
  )
  const newsletterId = asRecord(newsletter.createNewsletter).id

  await execute(
    'update retained records',
    /* GraphQL */ `
      mutation Persist(
        $roleId: ID!
        $userId: ID!
        $productId: ID!
        $instanceId: ID!
        $newsletterId: ID!
      ) {
        updateRole(
          where: { id: $roleId }
          data: { name: "Cutover Operator Persisted" }
        ) {
          id
        }
        updateUser(
          where: { id: $userId }
          data: { name: "Cutover Operator Persisted" }
        ) {
          id
        }
        updateProduct(
          where: { id: $productId }
          data: { name: "Real Consumer Product Persisted" }
        ) {
          id
        }
        updateInstance(
          where: { id: $instanceId }
          data: { projectStatus: "persisted" }
        ) {
          id
        }
        updateNewsletter(
          where: { id: $newsletterId }
          data: { vertical: "general" }
        ) {
          id
        }
      }
    `,
    adminCookie,
    { roleId, userId, productId, instanceId, newsletterId },
  )

  const deleteProduct = await execute(
    'create delete-marker Product',
    'mutation { createProduct(data: { stripeProductId: "prod_real_deleted", name: "Delete marker", application: "openfront" }) { id } }',
    adminCookie,
  )
  const deleteProductId = asRecord(deleteProduct.createProduct).id
  await execute(
    'delete Product',
    'mutation DeleteProduct($id: ID!) { deleteProduct(where: { id: $id }) { id } }',
    adminCookie,
    { id: deleteProductId },
  )

  const deleteNewsletter = await execute(
    'create delete-marker Newsletter',
    'mutation { createNewsletter(data: { email: "deleted-newsletter@os-org-canary.invalid", vertical: "general" }) { id } }',
    adminCookie,
  )
  await execute(
    'delete Newsletter',
    'mutation DeleteNewsletter($id: ID!) { deleteNewsletter(where: { id: $id }) { id } }',
    adminCookie,
    { id: asRecord(deleteNewsletter.createNewsletter).id },
  )

  const retained = await execute(
    'read retained CRUD graph',
    /* GraphQL */ `
      query {
        products(where: { stripeProductId: { equals: "prod_real_cutover" } }) {
          id
          name
          prices {
            stripePriceId
          }
        }
        instances(where: { domain: { equals: "cutover-instance" } }) {
          id
          projectStatus
          subscription {
            stripeSubscriptionId
          }
          user {
            email
          }
        }
        newsletters(
          where: {
            email: { equals: "cutover-newsletter@os-org-canary.invalid" }
          }
        ) {
          id
        }
        deletedProducts: products(
          where: { stripeProductId: { equals: "prod_real_deleted" } }
        ) {
          id
        }
        deletedNewsletters: newsletters(
          where: {
            email: { equals: "deleted-newsletter@os-org-canary.invalid" }
          }
        ) {
          id
        }
      }
    `,
    adminCookie,
  )
  const retainedProduct = asRecord(asArray(retained.products)[0])
  const retainedInstance = asRecord(asArray(retained.instances)[0])
  assert.equal(retainedProduct.name, 'Real Consumer Product Persisted')
  assert.equal(
    asRecord(asArray(retainedProduct.prices)[0]).stripePriceId,
    'price_real_cutover',
  )
  assert.equal(retainedInstance.projectStatus, 'persisted')
  assert.equal(
    asRecord(retainedInstance.subscription).stripeSubscriptionId,
    'sub_real_cutover',
  )
  assert.equal(asArray(retained.newsletters).length, 1)
  assert.equal(asArray(retained.deletedProducts).length, 0)
  assert.equal(asArray(retained.deletedNewsletters).length, 0)

  return {
    mode,
    listKeys: cmsLists.map((list) => list.key),
    access: {
      anonymousCatalogRead: true,
      anonymousProtectedReadDenied: true,
      memberDashboardDenied: true,
      memberOwnershipFilters: true,
      memberProtectedWritesDenied: true,
      memberAutoOwnership: true,
      ...policy,
    },
    auth: {
      invalidPasswordRejected: true,
      memberCookieHydrated: true,
      adminCookieHydrated: true,
      roleBackedUiAccess: true,
    },
    crud: {
      roleId,
      userId,
      productId,
      priceId,
      instanceId,
      subscriptionId,
      newsletterId,
      retainedGraphReloaded: true,
      deleteAbsenceVerified: true,
    },
  }
}

async function persistence() {
  assert.ok(createdUserId, 'persistence mode requires the created User ID')
  const adminCookie = await authenticatedCookie(
    'admin@os-org-canary.invalid',
    'admin-canary-password',
    'source_admin',
  )
  const data = await execute(
    'fresh-process persistence reload',
    /* GraphQL */ `
      query Persistence($createdUserId: ID!) {
        user(where: { id: $createdUserId }) {
          id
          name
          role {
            name
          }
        }
        products(where: { stripeProductId: { equals: "prod_real_cutover" } }) {
          id
          name
          prices {
            stripePriceId
          }
        }
        instances(where: { domain: { equals: "cutover-instance" } }) {
          id
          projectStatus
          user {
            email
          }
          subscription {
            stripeSubscriptionId
          }
        }
        newsletters(
          where: {
            email: { equals: "cutover-newsletter@os-org-canary.invalid" }
          }
        ) {
          id
        }
        memberInstances: instances(
          where: { domain: { equals: "member-created-instance" } }
        ) {
          id
          user {
            id
          }
        }
        deletedProducts: products(
          where: { stripeProductId: { equals: "prod_real_deleted" } }
        ) {
          id
        }
      }
    `,
    adminCookie,
    { createdUserId },
  )
  const user = asRecord(data.user)
  const product = asRecord(asArray(data.products)[0])
  const instance = asRecord(asArray(data.instances)[0])
  assert.equal(user.name, 'Cutover Operator Persisted')
  assert.equal(asRecord(user.role).name, 'Cutover Operator Persisted')
  assert.equal(product.name, 'Real Consumer Product Persisted')
  assert.equal(
    asRecord(asArray(product.prices)[0]).stripePriceId,
    'price_real_cutover',
  )
  assert.equal(instance.projectStatus, 'persisted')
  assert.equal(
    asRecord(instance.user).email,
    'cutover.operator@os-org-canary.invalid',
  )
  assert.equal(
    asRecord(instance.subscription).stripeSubscriptionId,
    'sub_real_cutover',
  )
  assert.equal(asArray(data.newsletters).length, 1)
  assert.equal(
    asRecord(asArray(data.memberInstances)[0]).user &&
      asRecord(asRecord(asArray(data.memberInstances)[0]).user).id,
    'source_member',
  )
  assert.equal(asArray(data.deletedProducts).length, 0)

  return {
    mode,
    authenticatedFreshProcess: true,
    persistedUserRole: true,
    persistedProductPrice: true,
    persistedInstanceSubscriptionUser: true,
    persistedNewsletter: true,
    persistedMemberAutoOwnership: true,
    deletedMarkerAbsent: true,
  }
}

async function rollback() {
  assert.ok(createdUserId, 'rollback mode requires the created User ID')
  const adminCookie = await authenticatedCookie(
    'admin@os-org-canary.invalid',
    'admin-canary-password',
    'source_admin',
  )
  const data = await execute(
    'restored source-state runtime read',
    /* GraphQL */ `
      query Rollback($createdUserId: ID!) {
        products(where: { stripeProductId: { equals: "prod_source_seed" } }) {
          id
          name
          prices {
            stripePriceId
          }
        }
        instances(where: { id: { equals: "source_member_instance" } }) {
          id
          domain
          user {
            id
          }
          subscription {
            stripeSubscriptionId
          }
        }
        cutoverProducts: products(
          where: { stripeProductId: { equals: "prod_real_cutover" } }
        ) {
          id
        }
        cutoverUser: user(where: { id: $createdUserId }) {
          id
        }
        memberCreated: instances(
          where: { domain: { equals: "member-created-instance" } }
        ) {
          id
        }
      }
    `,
    adminCookie,
    { createdUserId },
  )
  const product = asRecord(asArray(data.products)[0])
  const instance = asRecord(asArray(data.instances)[0])
  assert.equal(product.name, 'Source Seed Product')
  assert.equal(
    asRecord(asArray(product.prices)[0]).stripePriceId,
    'price_source_seed',
  )
  assert.equal(asRecord(instance.user).id, 'source_member')
  assert.equal(
    asRecord(instance.subscription).stripeSubscriptionId,
    'sub_member_source',
  )
  assert.equal(asArray(data.cutoverProducts).length, 0)
  assert.equal(data.cutoverUser, null)
  assert.equal(asArray(data.memberCreated).length, 0)
  assert.equal(await uiAccessAllowed(adminCookie), true)

  return {
    mode,
    sourceAdminReauthenticated: true,
    sourceRelationshipsRestored: true,
    postCutoverProductAbsent: true,
    postCutoverUserAbsent: true,
    postCutoverOwnedInstanceAbsent: true,
  }
}

try {
  const result =
    mode === 'exercise'
      ? await exercise()
      : mode === 'persistence'
        ? await persistence()
        : mode === 'rollback'
          ? await rollback()
          : assert.fail(`Unknown os.org real-consumer worker mode: ${mode}`)
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`)
} finally {
  await prisma.$disconnect()
}
