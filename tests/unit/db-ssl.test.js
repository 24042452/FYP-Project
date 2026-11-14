import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { sslOptions } from '../../lib/db-ssl.js'

describe('sslOptions', () => {
  it('is off unless DATABASE_SSL=true', () => {
    expect(sslOptions({})).toBeUndefined()
    expect(sslOptions({ DATABASE_SSL: 'false' })).toBeUndefined()
  })
  it('turns on verified TLS 1.2+', () => {
    expect(sslOptions({ DATABASE_SSL: 'true' })).toEqual({ minVersion: 'TLSv1.2', rejectUnauthorized: true })
  })
  it('takes the CA as PEM text', () => {
    const pem = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----'
    expect(sslOptions({ DATABASE_SSL: 'true', DATABASE_SSL_CA: pem }).ca).toBe(pem)
  })
  it('takes the CA from a file path', () => {
    const f = path.join(os.tmpdir(), `ca-${process.pid}.pem`)
    fs.writeFileSync(f, 'PEMDATA')
    try {
      expect(sslOptions({ DATABASE_SSL: 'true', DATABASE_SSL_CA: f }).ca).toBe('PEMDATA')
    } finally {
      fs.unlinkSync(f)
    }
  })
})
