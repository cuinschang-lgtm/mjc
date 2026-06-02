const STYLE_PROMPTS = {
  vinyl: 'vintage vinyl record poster, warm amber tones, retro typography, grainy texture',
  glass: 'modern glassmorphism poster, frosted glass, soft gradients, sleek typography',
  cinematic: 'cinematic movie poster, dramatic lighting, film grain, bold title text',
  popArt: 'pop art poster, vibrant colors, halftone dots, comic book style',
  minimal: 'Japanese minimalism, negative space, muted earth tones, zen aesthetic',
  neon: 'cyberpunk neon, dark background, pink cyan glow, synthwave style',
}

function clampPrompt(str) {
  if (str.length <= 512) return str
  return str.slice(0, 509) + '...'
}

export function buildPosterPrompt({ album, artist, year, tags, review, accentColor, style = 'glass' }) {
  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.glass
  const parts = []

  parts.push(`Transform this album cover into a stunning music poster. Title: "${album}" by ${artist}${year ? ` (${year})` : ''}. Style: ${styleDesc}.`)

  if (Array.isArray(tags) && tags.length) {
    parts.push(`Genre: ${tags.slice(0, 3).join(', ')}.`)
  }

  if (accentColor) {
    parts.push(`Use color #${accentColor.replace('#', '')} as accent.`)
  }

  if (review) {
    parts.push(`Add quote: "${review}"`)
  }

  parts.push('9:16 portrait, elegant layout.')

  return clampPrompt(parts.join(' '))
}

export function buildStyleLabel(style) {
  const labels = {
    vinyl: '复古黑胶',
    glass: '玻璃质感',
    cinematic: '电影质感',
    popArt: '波普风格',
    minimal: '极简日式',
    neon: '赛博霓虹',
  }
  return labels[style] || style
}

export const AI_POSTER_STYLES = [
  { key: 'glass', label: '玻璃质感' },
  { key: 'vinyl', label: '复古黑胶' },
  { key: 'cinematic', label: '电影质感' },
  { key: 'popArt', label: '波普风格' },
  { key: 'minimal', label: '极简日式' },
  { key: 'neon', label: '赛博霓虹' },
]
