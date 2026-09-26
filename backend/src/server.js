import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

const app = createApp()
const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, 'Gestor documental API started')
})

function closeServer(signal) {
  logger.info({ signal }, 'Shutting down API')

  server.close((error) => {
    if (error) {
      logger.error({ err: error }, 'API shutdown failed')
      process.exitCode = 1
      return
    }

    logger.info('API stopped')
  })
}

process.once('SIGINT', () => closeServer('SIGINT'))
process.once('SIGTERM', () => closeServer('SIGTERM'))
