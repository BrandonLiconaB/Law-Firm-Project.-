export function cleanUserName(value) {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeUserEmail(value) {
  return value.trim().toLowerCase()
}

export function isUserEmailValid(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeUserEmail(email))
}

export function isUserEmailDuplicate(users, email, excludedUserId = null) {
  const normalizedEmail = normalizeUserEmail(email)

  return users.some(
    (user) =>
      user.id !== excludedUserId &&
      normalizeUserEmail(user.email) === normalizedEmail,
  )
}
