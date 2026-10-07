export function normalizeUsername(value) { return value.trim().toLowerCase() }

export function validateTemporaryPassword(password, confirmation) {
  const errors = {}
  if (password.length < 12 || password.length > 128) {
    errors.password = 'Use between 12 and 128 characters.'
  }
  if (!confirmation || password !== confirmation) errors.confirmation = 'The passwords do not match.'
  return errors
}

export function validateNewUser({ fullName, username, password, confirmation }) {
  const errors = validateTemporaryPassword(password, confirmation)
  if (fullName.trim().length < 2 || fullName.trim().length > 120) {
    errors.fullName = 'Use between 2 and 120 characters for the full name.'
  }
  const normalized = normalizeUsername(username)
  if (normalized.length < 3 || normalized.length > 50 || !/^[a-z0-9._-]+$/.test(normalized)) {
    errors.username = 'Use 3–50 letters, numbers, periods, hyphens, or underscores.'
  }
  return errors
}

export function validatePasswordReset({ administratorPassword, password, confirmation }) {
  const errors = validateTemporaryPassword(password, confirmation)
  if (!administratorPassword || administratorPassword.length > 128) {
    errors.administratorPassword = 'Enter your current administrator password.'
  }
  return errors
}

export function getUserFieldErrors(error, localErrors = {}, { reset = false } = {}) {
  const fields = { ...error?.fields }
  if (reset && fields.newPassword) { fields.password = fields.newPassword; delete fields.newPassword }
  if (error?.code === 'USERNAME_ALREADY_EXISTS') fields.username = 'That username is already in use.'
  if (error?.code === 'ADMIN_PASSWORD_INCORRECT') fields.administratorPassword = 'The administrator password is incorrect.'
  if (reset && error?.code === 'PASSWORD_UNCHANGED') fields.password = 'Choose a password different from the current password.'
  return { ...fields, ...localErrors }
}

export function getUsersPage(value) {
  return /^[1-9]\d{0,5}$/.test(value ?? '') && Number(value) <= 100_000 ? Number(value) : 1
}
