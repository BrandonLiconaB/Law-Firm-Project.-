import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'
import { closeDatabasePool } from './db/pool.js'

const app = createApp()
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Gestor documental API started')
})

let isShuttingDown = false

function closeServer(signal) {
  if (isShuttingDown) return
  isShuttingDown = true

  logger.info({ signal }, 'Shutting down API')

  server.close(async (error) => {
    if (error) {
      logger.error({ err: error }, 'API shutdown failed')
      process.exitCode = 1
    }

    try {
      await closeDatabasePool()
    } catch (databaseError) {
      logger.error({ err: databaseError }, 'Database pool shutdown failed')
      process.exitCode = 1
    }

    logger.info('API stopped')
  })
}

process.once('SIGINT', () => closeServer('SIGINT'))
process.once('SIGTERM', () => closeServer('SIGTERM'))
