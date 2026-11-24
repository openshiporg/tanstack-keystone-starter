import { once } from 'node:events'
import { createServer } from 'node:net'

import { sendPasswordResetEmail } from '../src/features/cms/password-reset-mail'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

async function main() {
  let resolveMessage!: (message: string) => void
  const receivedMessage = new Promise<string>((resolve) => {
    resolveMessage = resolve
  })
  const server = createServer((socket) => {
    socket.setEncoding('utf8')
    socket.write('220 localhost ESMTP CMS validation\r\n')
    let buffer = ''
    let dataMode = false
    let messageLines: string[] = []

    socket.on('data', (chunk) => {
      buffer += chunk
      while (buffer.includes('\r\n')) {
        const boundary = buffer.indexOf('\r\n')
        const line = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)

        if (dataMode) {
          if (line === '.') {
            dataMode = false
            resolveMessage(messageLines.join('\r\n'))
            messageLines = []
            socket.write('250 2.0.0 accepted\r\n')
          } else {
            messageLines.push(line.startsWith('..') ? line.slice(1) : line)
          }
          continue
        }

        const command = line.toUpperCase()
        if (command.startsWith('EHLO') || command.startsWith('HELO')) {
          socket.write('250-localhost\r\n250 PIPELINING\r\n')
        } else if (
          command.startsWith('MAIL FROM:') ||
          command.startsWith('RCPT TO:')
        ) {
          socket.write('250 2.1.0 ok\r\n')
        } else if (command === 'DATA') {
          dataMode = true
          socket.write('354 End data with <CR><LF>.<CR><LF>\r\n')
        } else if (command === 'QUIT') {
          socket.write('221 2.0.0 bye\r\n')
          socket.end()
        } else {
          socket.write('250 2.0.0 ok\r\n')
        }
      }
    })
  })

  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const address = server.address()
  if (!address || typeof address === 'string')
    throw new Error('Failed to bind SMTP wire validation server')

  try {
    await sendPasswordResetEmail('wire-token', 'person@example.com', {
      SMTP_HOST: '127.0.0.1',
      SMTP_PORT: String(address.port),
      SMTP_FROM: 'CMS <cms@example.com>',
      SMTP_STORE_LINK: 'https://store.example.com',
      SMTP_SECURE: 'false',
    })
    const message = await Promise.race([
      receivedMessage,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('Timed out waiting for SMTP message')),
          5_000,
        ),
      ),
    ])
    assert(
      /To: person@example\.com/i.test(message),
      'SMTP delivery should preserve the reset recipient',
    )
    assert(
      /From: CMS <cms@example\.com>/i.test(message),
      'SMTP delivery should preserve the configured sender',
    )
    assert(
      /Subject: Reset your password/i.test(message),
      'SMTP delivery should include the reset subject',
    )
    const unfoldedMessage = message.replaceAll('=\r\n', '')
    assert(
      unfoldedMessage.includes(
        'https://store.example.com/dashboard/reset?token=wire-token',
      ) ||
        unfoldedMessage.includes(
          'https://store.example.com/dashboard/reset?token=3Dwire-token',
        ),
      'SMTP delivery should include the configured password reset URL',
    )
  } finally {
    server.close()
    await once(server, 'close')
  }

  console.info('CMS live SMTP wire delivery validation passed.')
}

await main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
