import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const outputFile = path.resolve('.output/server/index.mjs')

async function writeFaultOutput() {
  await mkdir(path.dirname(outputFile), { recursive: true })
  await writeFile(outputFile, 'PARITY_TEST_GENUINE_SERVER_ERROR\n')
}

process.on('SIGTERM', () => {
  // Deliberately ignore TERM so the parent must escalate and await SIGKILL.
})

await writeFaultOutput()
setInterval(() => {
  void writeFaultOutput()
}, 25)
