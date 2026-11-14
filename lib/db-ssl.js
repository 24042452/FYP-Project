import fs from 'node:fs'

/**
 * TLS options for the MySQL connection, from the environment. Shared by the app (lib/db.js) and
 * the scripts (migrate, seed), so it must not import `server-only`.
 *
 * - DATABASE_SSL=true turns TLS on (TLS 1.2 or newer, the server certificate is verified).
 * - DATABASE_SSL_CA (optional) is the CA certificate: either the PEM text itself or a path to a file.
 *   Needed when the provider uses its own certificate authority.
 * @param {Record<string, string | undefined>} [env]
 * @returns {import('node:tls').ConnectionOptions | undefined} undefined when TLS is off
 */
export function sslOptions(env = process.env) {
  if (env.DATABASE_SSL !== 'true') return undefined
  /** @type {import('node:tls').ConnectionOptions} */
  const opts = { minVersion: 'TLSv1.2', rejectUnauthorized: true }
  const ca = env.DATABASE_SSL_CA?.trim()
  if (ca) opts.ca = ca.includes('-----BEGIN') ? ca : fs.readFileSync(ca, 'utf8')
  return opts
}
