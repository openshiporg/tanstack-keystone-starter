import bcrypt from 'bcryptjs'

import type { CmsField } from '../types'

const BCRYPT_ROUNDS = 10
const BCRYPT_HASH_REGEX = /^\$2[aby]?\$\d{1,2}\$[./A-Za-z0-9]{53}$/
const DUMMY_PASSWORD = 'simulated-password-to-counter-timing-attack'
const COMMON_PASSWORDS = new Set([
  'password',
  'password123',
  '123456',
  '12345678',
  '123456789',
  'qwerty',
  'abc123',
  '111111',
  'letmein',
  'admin',
])

function passwordValidationConfig(field: CmsField | undefined) {
  const validation = field?.fieldMeta?.validation as
    | Record<string, unknown>
    | undefined
  const length = validation?.length as Record<string, unknown> | undefined
  const match = validation?.match as Record<string, unknown> | null | undefined
  const regexConfig = match?.regex as Record<string, unknown> | undefined
  const regex =
    typeof regexConfig?.source === 'string'
      ? new RegExp(
          regexConfig.source,
          typeof regexConfig.flags === 'string' ? regexConfig.flags : '',
        )
      : null

  return {
    rejectCommon: validation?.rejectCommon === true,
    min: typeof length?.min === 'number' ? length.min : undefined,
    max: typeof length?.max === 'number' ? length.max : undefined,
    regex,
    explanation:
      typeof match?.explanation === 'string' ? match.explanation : undefined,
  }
}

export function validatePasswordInput(secret: string, field?: CmsField) {
  const { rejectCommon, min, max, regex, explanation } =
    passwordValidationConfig(field)
  if (min !== undefined && secret.length < min) {
    throw new Error(
      min === 1
        ? 'value must not be empty'
        : `value must be at least ${min} characters long`,
    )
  }
  if (max !== undefined && secret.length > max) {
    throw new Error(`value must be no longer than ${max} characters`)
  }
  if (regex && !regex.test(secret)) {
    throw new Error(explanation ?? `value must match ${regex}`)
  }
  if (rejectCommon && COMMON_PASSWORDS.has(secret.toLowerCase())) {
    throw new Error('value is too common and is not allowed')
  }
  if (bcrypt.truncates(secret))
    throw new Error('value must be no longer than 72 characters')
}

function validatePasswordPreimage(secret: string, field?: CmsField) {
  validatePasswordInput(secret, field)
}

export async function hashPassword(secret: string, field?: CmsField) {
  validatePasswordPreimage(secret, field)
  return bcrypt.hash(secret, BCRYPT_ROUNDS)
}

export function hashPasswordSync(secret: string, field?: CmsField) {
  validatePasswordPreimage(secret, field)
  return bcrypt.hashSync(secret, BCRYPT_ROUNDS)
}

export function getPasswordFieldKdf(field: CmsField | undefined) {
  return (
    field?.password?.kdf ?? {
      hash: hashPassword,
      compare: async (secret: string, hash: string) =>
        bcrypt.compare(secret, hash),
    }
  )
}

export function isPasswordHash(value: unknown): value is string {
  return typeof value === 'string' && BCRYPT_HASH_REGEX.test(value)
}

export async function verifyPassword(
  secret: string,
  hash: unknown,
  field?: CmsField,
) {
  const kdf = getPasswordFieldKdf(field)
  if (typeof hash !== 'string' || hash.length === 0) {
    await kdf.hash(DUMMY_PASSWORD)
    return false
  }
  return kdf.compare(secret, hash)
}
