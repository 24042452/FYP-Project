/**
 * Small, fast seeded PRNG so synthetic data is reproducible. Returns floats in [0, 1).
 * @param {number} seed
 * @returns {() => number}
 */
export function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministic RFC-4122 v4-shaped UUID drawn from the PRNG.
 * @param {() => number} rand
 * @returns {string}
 */
export function uuidFrom(rand) {
  const b = Array.from({ length: 16 }, () => Math.floor(rand() * 256))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = b.map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/**
 * Pick a key from a weight table.
 * @template {string | number} K
 * @param {() => number} rand
 * @param {[K, number][]} weights
 * @returns {K}
 */
export function weighted(rand, weights) {
  const total = weights.reduce((a, [, w]) => a + w, 0)
  let r = rand() * total
  for (const [k, w] of weights) {
    r -= w
    if (r < 0) return k
  }
  return weights[weights.length - 1][0]
}

/**
 * Standard normal sample (Box–Muller).
 * @param {() => number} rand
 * @returns {number}
 */
export function normal(rand) {
  const u = Math.max(rand(), 1e-12)
  const v = rand()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}
