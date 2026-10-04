import { AppError } from '../shared/AppError.js'

export function validateRequest(schema, source = 'body') {
  return (req, res, next) => {
    if (source === 'body' && !req.is('application/json')) {
      throw new AppError({
        code: 'JSON_REQUIRED',
        message: 'Content-Type must be application/json.',
        statusCode: 415,
      })
    }

    const result = schema.safeParse(req[source])
    if (!result.success) {
      const fields = {}
      for (const issue of result.error.issues) {
        const field = issue.path.join('.') || '_request'
        fields[field] ??= issue.message
      }
      throw new AppError({
        code: 'INVALID_INPUT',
        message: 'The request contains invalid fields.',
        statusCode: 400,
        fields,
      })
    }

    req.validated ??= {}
    req.validated[source] = result.data
    next()
  }
}
