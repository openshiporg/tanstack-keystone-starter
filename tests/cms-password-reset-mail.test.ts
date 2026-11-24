import { describe, expect, it } from 'vitest'

import {
  MAX_SMTP_RETRIES,
  MAX_SMTP_RETRY_DELAY_MS,
  passwordResetEmailHtml,
  passwordResetUrl,
  sendPasswordResetEmail,
} from '../src/features/cms/password-reset-mail'

const baseEnvironment = {
  SMTP_HOST: 'smtp.example.com',
  SMTP_PORT: '587',
  SMTP_FROM: 'no-reply@example.com',
  SMTP_STORE_LINK: 'https://cms.example.com/app/',
}

describe('source-compatible password reset mail', () => {
  it('builds a public reset URL without interpolating an unescaped token', () => {
    expect(passwordResetUrl('a&b c', baseEnvironment)).toBe(
      'https://cms.example.com/dashboard/reset?token=a%26b+c',
    )
  })

  it('escapes the reset URL before rendering HTML', () => {
    const html = passwordResetEmailHtml(
      'https://cms.example.com/reset?token=a&next="settings"',
    )

    expect(html).toContain('token=a&amp;next=&quot;settings&quot;')
    expect(html).not.toContain('token=a&next="settings"')
  })

  it('fails before network access when SMTP configuration is incomplete', async () => {
    await expect(
      sendPasswordResetEmail('token', 'ada@example.com', {
        ...baseEnvironment,
        SMTP_HOST: undefined,
      }),
    ).rejects.toThrow('SMTP_HOST is required')
  })

  it('rejects retry values above the documented bounded maxima before network access', async () => {
    await expect(
      sendPasswordResetEmail('token', 'ada@example.com', {
        ...baseEnvironment,
        SMTP_MAX_RETRIES: String(MAX_SMTP_RETRIES + 1),
      }),
    ).rejects.toThrow('SMTP_MAX_RETRIES')
    await expect(
      sendPasswordResetEmail('token', 'ada@example.com', {
        ...baseEnvironment,
        SMTP_RETRY_DELAY_MS: String(MAX_SMTP_RETRY_DELAY_MS + 1),
      }),
    ).rejects.toThrow('SMTP_RETRY_DELAY_MS')
  })
})
