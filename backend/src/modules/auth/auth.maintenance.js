import { pool } from '../../db/pool.js'
import { logger } from '../../config/logger.js'
import { AUTH_CLEANUP_INTERVAL_MS } from './auth.constants.js'
import { deleteExpiredAuthenticationData } from './auth.repository.js'

export function startAuthMaintenance(database = pool) {
  let running = null
  let stopped = false

  function cleanup() {
    if (stopped || running) return
    running = deleteExpiredAuthenticationData(database)
      .catch(() => logger.warn('Authentication cleanup failed; it will be retried'))
      .finally(() => {
        running = null
      })
  }

  cleanup()
  const timer = setInterval(cleanup, AUTH_CLEANUP_INTERVAL_MS)
  timer.unref()

  return async function stopAuthMaintenance() {
    stopped = true
    clearInterval(timer)
    await running
  }
}
