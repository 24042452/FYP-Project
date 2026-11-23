// Make phone photos small before they are sent with a dispute answer, so a 4 MB photo becomes a few
// hundred KB. Runs in the browser (canvas); `fitWithin` is the pure size maths.

const MAX_SIDE = 1600
const QUALITY = 0.82

/**
 * The size an image should be drawn at so its longest side is at most `max`, keeping its shape.
 * Images that already fit keep their size.
 * @param {number} w
 * @param {number} h
 * @param {number} [max]
 * @returns {{w: number, h: number}}
 */
export function fitWithin(w, h, max = MAX_SIDE) {
  const longest = Math.max(w, h)
  if (longest <= max) return { w, h }
  const scale = max / longest
  return { w: Math.round(w * scale), h: Math.round(h * scale) }
}

/**
 * A smaller JPEG copy of a photo (longest side 1600 px, quality 0.82). PDFs, other files, photos that
 * cannot be read, and photos whose copy would not be smaller come back unchanged.
 * @param {File} file
 * @returns {Promise<File>}
 */
export async function shrinkImage(file) {
  if (!/^image\/(jpeg|png)$/.test(file.type) || typeof createImageBitmap !== 'function') return file
  /** @type {ImageBitmap | undefined} */
  let bitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
    const { w, h } = fitWithin(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    // A PNG with see-through parts would turn black as a JPEG; paint white underneath.
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY))
    if (!blob || blob.size >= file.size) return file
    const name = file.name.replace(/\.(png|jpe?g)$/i, '') + '.jpg'
    return new File([blob], name, { type: 'image/jpeg', lastModified: file.lastModified })
  } catch {
    return file
  } finally {
    bitmap?.close()
  }
}
