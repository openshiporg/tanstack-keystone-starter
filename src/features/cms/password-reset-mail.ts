import { createTransport } from 'nodemailer'

/** Maximum password-reset delivery retries permitted per request. */
export const MAX_SMTP_RETRIES = 5
/** Maximum delay between password-reset delivery attempts. */
export const MAX_SMTP_RETRY_DELAY_MS = 60_000
/** Default timeout for SMTP connection, greeting, and socket inactivity. */
export const DEFAULT_SMTP_TIMEOUT_MS = 30_000

type PasswordResetMailEnvironment = {
  SMTP_HOST?: string
  SMTP_PORT?: string
  SMTP_USER?: string
  SMTP_PASSWORD?: string
  SMTP_FROM?: string
  SMTP_STORE_LINK?: string
  SMTP_SECURE?: string
  SMTP_MAX_RETRIES?: string
  SMTP_RETRY_DELAY_MS?: string
  SMTP_TIMEOUT_MS?: string
}

function requiredEnvironmentValue(
  environment: PasswordResetMailEnvironment,
  name: keyof PasswordResetMailEnvironment,
) {
  const value = environment[name]?.trim()
  if (!value) throw new Error(`${name} is required to send password reset mail`)
  return value
}

export function passwordResetUrl(
  token: string,
  environment: PasswordResetMailEnvironment = process.env,
) {
  const baseUrl = requiredEnvironmentValue(environment, 'SMTP_STORE_LINK')
  const url = new URL('/dashboard/reset', baseUrl)
  url.searchParams.set('token', token)
  return url.toString()
}

export function passwordResetEmailHtml(url: string) {
  const escapedUrl = url.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
  return `<!doctype html>
<html lang="en">
  <body style="background:#f9f9f9;color:#444;font-family:Helvetica,Arial,sans-serif">
    <main style="background:#fff;border-radius:10px;margin:20px auto;max-width:600px;padding:30px;text-align:center">
      <p style="font-size:18px">Please click below to reset your password.</p>
      <p style="margin:30px 0">
        <a href="${escapedUrl}" style="background:#346df1;border-radius:5px;color:#fff;display:inline-block;font-size:18px;font-weight:bold;padding:10px 20px;text-decoration:none">Reset password</a>
      </p>
      <p>If you did not request this email, you can safely ignore it.</p>
    </main>
  </body>
</html>`
}

export async function sendPasswordResetEmail(
  token: string,
  identity: string,
  environment: PasswordResetMailEnvironment = process.env,
) {
  const host = requiredEnvironmentValue(environment, 'SMTP_HOST')
  const portValue = requiredEnvironmentValue(environment, 'SMTP_PORT')
  const from = requiredEnvironmentValue(environment, 'SMTP_FROM')
  const port = Number(portValue)
  if (!Number.isInteger(port) || port <= 0 || port > 65_535)
    throw new Error('SMTP_PORT must be a valid TCP port')

  const user = environment.SMTP_USER?.trim()
  const password = environment.SMTP_PASSWORD
  if (Boolean(user) !== Boolean(password))
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together')

  const url = passwordResetUrl(token, environment)
  const retries = parseNonNegativeInteger(
    environment.SMTP_MAX_RETRIES,
    'SMTP_MAX_RETRIES',
    MAX_SMTP_RETRIES,
  )
  const retryDelayMs = parseNonNegativeInteger(
    environment.SMTP_RETRY_DELAY_MS,
    'SMTP_RETRY_DELAY_MS',
    MAX_SMTP_RETRY_DELAY_MS,
  )
  const timeoutMs = parsePositiveInteger(
    environment.SMTP_TIMEOUT_MS,
    'SMTP_TIMEOUT_MS',
    DEFAULT_SMTP_TIMEOUT_MS,
  )
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const transport = createTransport({
      host,
      port,
      secure: environment.SMTP_SECURE === 'true',
      auth: user && password ? { user, pass: password } : undefined,
      disableFileAccess: true,
      disableUrlAccess: true,
      connectionTimeout: timeoutMs,
      greetingTimeout: timeoutMs,
      socketTimeout: timeoutMs,
    })
    try {
      await transport.sendMail({
        to: identity,
        from,
        subject: 'Reset your password',
        html: passwordResetEmailHtml(url),
      })
      transport.close()
      return
    } catch (error) {
      lastError = error
      transport.close()
      if (attempt < retries && retryDelayMs > 0)
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs))
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error('SMTP delivery failed')
}

function parseNonNegativeInteger(
  value: string | undefined,
  name: string,
  maximum: number,
) {
  if (value === undefined || value.trim() === '') return 0
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maximum)
    throw new Error(
      `${name} must be a non-negative safe integer no greater than ${maximum}`,
    )
  return parsed
}

function parsePositiveInteger(
  value: string | undefined,
  name: string,
  defaultValue: number,
) {
  if (value === undefined || value.trim() === '') return defaultValue
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new Error(`${name} must be a positive safe integer`)
  return parsed
}
