import { AppError } from '../../shared/AppError.js'

export function createGetHealth({ database }) {
  return async function getHealth(req, res, next) {
    try {
      await database.query('SELECT 1 AS connection_check')

      res.status(200).json({
        data: {
          status: 'ok',
          service: 'gestor-documental-api',
          database: 'connected',
        },
      })
    } catch (error) {
      req.log?.warn({ err: error }, 'Database health check failed')
      next(
        new AppError({
          code: 'DATABASE_UNAVAILABLE',
          message: 'The database is not available.',
          statusCode: 503,
        }),
      )
    }
  }
}
