import bcrypt from 'bcryptjs'

const COST = 12

/**
 * @param {string} plain
 * @returns {Promise<string>} bcrypt hash (60 chars)
 */
export function hashPassword(plain) {
  return bcrypt.hash(plain, COST)
}

/**
 * @param {string} plain
 * @param {string} hash
 * @returns {Promise<boolean>}
 */
export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash)
}
