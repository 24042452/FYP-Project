import fs from 'node:fs'
import path from 'node:path'

/**
 * Help-centre content: parsing content/faq.md into chunks, and where each topic lives in the portal.
 * (Server/scripts only: it reads a file.)
 */

/** Topic (the `#` heading in faq.md) to the portal page that answers it. */
export const SOURCE_PAGES = {
  Settlements: '/settlements',
  Payments: '/transactions',
  Fees: '/invoices',
  Bills: '/invoices',
  'Check-up': '/reconciliation',
  Account: '/requests',
}

/**
 * Split faq.md into chunks: `#` starts a topic (source), `##` starts a question (heading), and the
 * text under it is the answer. The intro text before the first topic is skipped.
 * @param {string} markdown
 * @returns {{source: string, heading: string, content: string}[]}
 */
export function parseFaq(markdown) {
  /** @type {{source: string, heading: string, content: string}[]} */
  const out = []
  let source = ''
  /** @type {{source: string, heading: string, lines: string[]} | null} */
  let cur = null
  const flush = () => {
    if (cur) {
      const content = cur.lines.join(' ').replace(/\s+/g, ' ').trim()
      if (content) out.push({ source: cur.source, heading: cur.heading, content })
    }
    cur = null
  }
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith('## ')) {
      flush()
      cur = { source, heading: line.slice(3).trim(), lines: [] }
    } else if (line.startsWith('# ')) {
      flush()
      // The first `#` is the document title; real topics come after it.
      source = line.slice(2).trim()
      if (/^sample help content/i.test(source)) source = ''
    } else if (cur) {
      cur.lines.push(line)
    }
  }
  flush()
  return out.filter((c) => c.source)
}

/** Read and parse content/faq.md. */
export function loadFaq() {
  const file = path.join(process.cwd(), 'content', 'faq.md')
  return parseFaq(fs.readFileSync(file, 'utf8'))
}

/**
 * The portal page for a help chunk.
 * @param {{source: string}} chunk
 * @returns {string}
 */
export function pageForSource(chunk) {
  return /** @type {Record<string, string>} */ (SOURCE_PAGES)[chunk.source] ?? '/'
}
