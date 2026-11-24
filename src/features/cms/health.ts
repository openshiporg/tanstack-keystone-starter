import { cmsLists } from './registry'
import { createCmsContext, getCmsGraphQLSchema } from './runtime'

const healthHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
}

export function cmsLivenessResponse() {
  return Response.json(
    { status: 'ok', checks: { runtime: 'ok' } },
    { status: 200, headers: healthHeaders },
  )
}

export function cmsReadinessTimeoutMs() {
  const configured = Number(process.env.CMS_READINESS_TIMEOUT_MS)
  return Number.isSafeInteger(configured) &&
    configured >= 100 &&
    configured <= 30_000
    ? configured
    : 5_000
}

async function readinessCheck(request: Request) {
  const context = await createCmsContext(request, getCmsGraphQLSchema())
  const firstList = cmsLists[0]
  if (firstList) await context.sudo().db[firstList.key].count()
  return Boolean(firstList)
}

let readinessInFlight: Promise<boolean> | undefined

function sharedReadinessCheck(request: Request) {
  readinessInFlight ??= readinessCheck(request).finally(() => {
    readinessInFlight = undefined
  })
  return readinessInFlight
}

export async function cmsReadinessResponse(request: Request) {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const hasPersistence = await Promise.race([
      sharedReadinessCheck(request),
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('CMS readiness deadline exceeded')),
          cmsReadinessTimeoutMs(),
        )
        timer.unref?.()
      }),
    ])
    return Response.json(
      {
        status: 'ready',
        checks: {
          configuration: 'ok',
          persistence: hasPersistence ? 'ok' : 'not-configured',
        },
      },
      { status: 200, headers: healthHeaders },
    )
  } catch {
    return Response.json(
      {
        status: 'unavailable',
        checks: { configuration: 'ok', persistence: 'failed' },
      },
      { status: 503, headers: healthHeaders },
    )
  } finally {
    if (timer) clearTimeout(timer)
  }
}
