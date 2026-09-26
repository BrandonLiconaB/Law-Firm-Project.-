import { AppError } from '../shared/AppError.js'

function isInvalidJsonError(error) {
  return (
    error instanceof SyntaxError &&
    error.status === 400 &&
    Object.hasOwn(error, 'body')
  )
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error)
    return
  }

  const handledError = isInvalidJsonError(error)
    ? new AppError({
        code: 'INVALID_JSON',
        message: 'The request body contains invalid JSON.',
        statusCode: 400,
      })
    : error

  if (!(handledError instanceof AppError)) {
    req.log?.error({ err: handledError }, 'Unhandled request error')

    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
      },
    })
    return
  }

  const responseBody = {
    error: {
      code: handledError.code,
      message: handledError.message,
    },
  }

  if (handledError.fields) {
    responseBody.error.fields = handledError.fields
  }

  res.status(handledError.statusCode).json(responseBody)
}
