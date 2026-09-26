import { AppError } from '../shared/AppError.js'

export function notFound(req, _res, next) {
  next(
    new AppError({
      code: 'ROUTE_NOT_FOUND',
      message: `Route ${req.method} ${req.path} was not found.`,
      statusCode: 404,
    }),
  )
}
