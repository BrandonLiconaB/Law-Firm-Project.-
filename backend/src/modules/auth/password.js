import argon2 from 'argon2'

const PASSWORD_HASH_OPTIONS = Object.freeze({
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 1,
  hashLength: 32,
})

export function hashPassword(password) {
  return argon2.hash(password, PASSWORD_HASH_OPTIONS)
}

export async function verifyPassword(passwordHash, password) {
  try {
    return await argon2.verify(passwordHash, password)
  } catch {
    return false
  }
}
