const STYLE_PROMPTS = {
  vinyl: 'retro vinyl record sleeve texture, warm amber and sepia tones, grainy film grain, 1970s vintage aesthetic, rough paper edges, analog warmth',
  glass: 'modern glassmorphism, frosted translucent layers, soft gradient blends, flowing abstract shapes, sleek geometric accents, cool atmospheric tones',
  cinematic: 'cinematic atmosphere, dramatic lighting rays, deep rich shadows, film grain, widescreen epic mood, warm highlights',
  popArt: 'pop art halftone patterns, bold vibrant saturated colors, comic book ben-day dots, thick energetic outlines, dynamic abstract composition',
  minimal: 'Japanese zen minimalism, abundant negative space, subtle ink wash watercolor textures, muted earth and stone tones, peaceful empty composition',
  neon: 'cyberpunk neon aesthetic, dark void background, electric pink and cyan glow streaks, synthwave retrowave grid, futuristic urban atmosphere',
}

function clampPrompt(str) {
  if (str.length <= 500) return str
  return str.slice(0, 497) + '...'
}

export function buildPosterPrompt({ album, artist, year, tags, review, accentColor, style = 'glass' }) {
  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.glass
  const parts = []

  parts.push(`Abstract artistic background texture inspired by the album "${album}" by ${artist}${year ? ` (${year})` : ''}. ${styleDesc}.`)

  if (Array.isArray(tags) && tags.length) {
    parts.push(`Genres: ${tags.slice(0, 4).join(', ')}.`)
  }

  if (accentColor) {
    parts.push(`Use #${accentColor.replace('#', '')} as accent.`)
  }

  if (review) {
    parts.push(`Mood: "${review}"`)
  }

  parts.push('NO TEXT NO WORDS NO LETTERS. Pure abstract visual art background only. Portrait 9:16, suitable for placing text on top later.')

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
