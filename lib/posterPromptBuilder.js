const STYLE_PROMPTS = {
  vinyl: 'vintage vinyl record aesthetic, warm analog tones, grainy texture, 1970s music poster style, retro typography, warm amber and sepia palette',
  glass: 'modern glassmorphism design, frosted glass panels, sleek minimal layout, soft gradients, contemporary geometric accents, elegant sans-serif typography',
  cinematic: 'cinematic movie poster style, dramatic lighting, widescreen composition, film grain, bold title typography, deep shadows and highlights',
  popArt: 'bold pop art style, vibrant comic book colors, halftone patterns, Roy Lichtenstein inspired, Ben-Day dots, thick outlines, energetic composition',
  minimal: 'Japanese minimalism, negative space, zen aesthetic, subtle ink wash textures, muted earth tones, clean sans-serif typography, peaceful composition',
  neon: 'cyberpunk neon aesthetic, dark background, electric glow effects, synthwave vibes, neon pink and cyan, retrowave grid, futuristic typography',
}

export function buildPosterPrompt({ album, artist, year, tags, review, accentColor, style = 'glass' }) {
  const styleDesc = STYLE_PROMPTS[style] || STYLE_PROMPTS.glass
  const tagStr = Array.isArray(tags) && tags.length
    ? tags.slice(0, 3).join('、')
    : ''

  let prompt = `A beautifully designed music album poster in ${styleDesc}. `

  prompt += `The poster features album "${album}" by ${artist}`

  if (year) {
    prompt += ` (${year})`
  }

  prompt += '. '

  if (tagStr) {
    prompt += `Music genre: ${tagStr}. `
  }

  if (accentColor) {
    const c = accentColor.replace('#', '')
    prompt += `The dominant color theme should be anchored on #${c} with harmonious complementary tones. `
  }

  if (review) {
    prompt += `The poster should include the review quote: "${review}". `
  } else {
    prompt += `The poster should look like a premium music streaming share card. `
  }

  prompt += `The overall composition should be balanced, with a clear visual hierarchy: album title as the hero element, artist name secondary, and review text elegantly placed. Include subtle musical decorative elements. High quality, 9:16 portrait aspect ratio, suitable for social media sharing.`

  return prompt
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
