function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getPlainTextLength(html) {
  return stripTags(html).length
}

export function sanitizeReviewHtml(html) {
  let s = String(html || '')

  s = s.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, '')
  s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')

  s = s.replace(/\s(href|src)\s*=\s*("[^"]*"|'[^']*')/gi, (m, attr, quoted) => {
    const v = String(quoted).slice(1, -1).trim()
    if (!v) return ` ${attr}=""`
    if (/^https?:\/\//i.test(v)) return ` ${attr}="${v}"`
    if (attr.toLowerCase() === 'src' && /^data:image\//i.test(v)) return ` ${attr}="${v}"`
    return ` ${attr}=""`
  })

  return s.trim()
}

export function validateReviewPayload({ title, contentHtml }) {
  const t = String(title || '').trim()
  const html = String(contentHtml || '').trim()
  const plainLen = getPlainTextLength(html)

  if (!t) return { ok: false, error: 'missing title' }
  if (t.length > 50) return { ok: false, error: 'title too long' }
  if (!html) return { ok: false, error: 'missing content' }
  if (plainLen < 15) return { ok: false, error: 'content too short' }
  if (plainLen > 2000) return { ok: false, error: 'content too long' }
  return { ok: true, title: t, contentHtml: html }
}



