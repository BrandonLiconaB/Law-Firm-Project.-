export class AppError extends Error {
  constructor({ code, message, statusCode = 500, fields = undefined }) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.statusCode = statusCode
    this.fields = fields
    this.isOperational = true
  }
}
