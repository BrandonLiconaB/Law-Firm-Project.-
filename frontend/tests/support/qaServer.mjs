import { createInterface } from 'node:readline'
import { createBackendFixture } from './backendFixture.mjs'

const fixture = await createBackendFixture({ port: 3001, origin: 'http://localhost:3173' })
console.log(JSON.stringify({ api: fixture.baseUrl, users: Object.fromEntries(Object.entries(fixture.users).map(([key, user]) => [key, user.username])), fixturePassword: fixture.password }))
const input = createInterface({ input: process.stdin })
input.on('line', async (line) => {
  if (line === 'revoke') { await fixture.revokeSessions(); console.log('Fixture sessions revoked.') }
  if (line === 'stop') await stop()
})
let stopping = false
async function stop() {
  if (stopping) return
  stopping = true
  input.close()
  await fixture.close()
  console.log('Fixture data cleaned.')
  process.exitCode = 0
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
