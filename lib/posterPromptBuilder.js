const STYLE_PROMPTS = {
  vinyl: 'retro vinyl record sleeve design, warm amber and sepia tones, grainy film texture, vintage typography, 1970s aesthetic, rough paper edges',
  glass: 'modern glassmorphism UI design, frosted translucent panels, soft gradient backgrounds, sleek minimal layout, elegant sans-serif typography, geometric accents',
  cinematic: 'cinematic movie poster, dramatic lighting with deep shadows, widescreen composition, film grain texture, bold large title typography',
  popArt: 'bold pop art style, vibrant saturated colors, halftone dot patterns, thick comic book outlines, energetic dynamic composition',
  minimal: 'Japanese zen minimalism, abundant negative space, subtle ink wash textures, muted earth tones, clean delicate typography, peaceful balanced layout',
  neon: 'cyberpunk neon aesthetic, dark background, electric pink and cyan glow effects, synthwave vibes, retrowave grid lines, futuristic chrome typography',
}

function clampPrompt(str, maxLen = 1000) {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 3) + '...'
}

export function buildPosterPrompt({ album, artist, year, tags, review, accentColor, style = 'glass' }) {
  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.glass
  const parts = []

  parts.push(`Create a beautiful shareable music poster card. Style: ${styleDesc}.`)
  parts.push(`Album: "${album}" by ${artist}${year ? `, released ${year}` : ''}.`)

  if (Array.isArray(tags) && tags.length) {
    parts.push(`Genres: ${tags.slice(0, 4).join(', ')}.`)
  }

  if (accentColor) {
    parts.push(`Use #${accentColor.replace('#', '')} as the dominant accent color.`)
  }

  if (review) {
    parts.push(`Include this review quote elegantly on the poster: "${review}"`)
  }

  parts.push('The composition should have the album title prominently displayed as the hero text, artist name as subtitle. Include subtle music-related decorative elements. Portrait orientation, suitable for sharing on social media.')

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
