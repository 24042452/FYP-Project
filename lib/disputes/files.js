// Evidence file checks for disputes. Pure: the caller reads each file's name, size and first bytes.

export const MAX_FILES = 3
export const MAX_FILE_BYTES = 2_097_152
export const MAX_TOTAL_BYTES = 4_194_304

/**
 * Work out the real file type from the first bytes (the file name is not trusted).
 * @param {Uint8Array} head at least the first 4 bytes
 * @returns {'image/jpeg' | 'image/png' | 'application/pdf' | null}
 */
export function sniffMime(head) {
  const at = (/** @type {number[]} */ bytes) => bytes.every((b, i) => head[i] === b)
  if (at([0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (at([0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (at([0x25, 0x50, 0x44, 0x46])) return 'application/pdf'
  return null
}

/** @param {number} bytes */
const mb = (bytes) => (bytes / 1_048_576).toFixed(1)

/**
 * Check a set of files for one dispute answer. Order of checks: count, each size, total size, type.
 * @param {{name: string, size: number, head: Uint8Array}[]} files
 * @returns {{ok: true, mimes: string[]} | {ok: false, message: string}}
 */
export function checkFiles(files) {
  if (files.length > MAX_FILES) return { ok: false, message: `You can add up to ${MAX_FILES} files.` }
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return { ok: false, message: `That file is ${mb(f.size)} MB. Files can be up to 2 MB.` }
  }
  const total = files.reduce((sum, f) => sum + f.size, 0)
  if (total > MAX_TOTAL_BYTES) {
    return { ok: false, message: `Your files add up to ${mb(total)} MB. Together they can be up to 4 MB.` }
  }
  const mimes = []
  for (const f of files) {
    const mime = sniffMime(f.head)
    if (!mime) return { ok: false, message: 'Only photos (JPG, PNG) or PDFs.' }
    mimes.push(mime)
  }
  return { ok: true, mimes }
}
