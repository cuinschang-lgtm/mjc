function getApiKey() {
  return process.env.POSTER_AI_API_KEY || ''
}

function getBaseUrl() {
  return process.env.POSTER_AI_BASE_URL || 'https://api.302.ai'
}

async function postJSON(endpoint, body) {
  const url = `${getBaseUrl()}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(text || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  try { return JSON.parse(text) } catch { return text }
}

async function postFormData(endpoint, fields) {
  const form = new FormData()
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, String(v))
  }
  const url = `${getBaseUrl()}${endpoint}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getApiKey()}` },
    body: form,
    signal: AbortSignal.timeout(60000),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(text || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  try { return JSON.parse(text) } catch { return text }
}

function extractBase64(data) {
  if (typeof data === 'string' && data.length > 100 && !data.startsWith('{')) {
    return data
  }
  const b64 = data?.images?.[0]?.b64_json
    || data?.data?.[0]?.b64_json
    || data?.images?.[0]?.image
    || data?.data?.[0]?.image
    || data?.images?.[0]
    || data?.data?.[0]?.url
  if (!b64) return null

  if (typeof b64 === 'string' && b64.startsWith('http')) {
    return null
  }
  return typeof b64 === 'string' ? b64 : null
}

async function downloadImageAsBase64(url) {
  const res = await fetch(url)
  const buffer = await res.arrayBuffer()
  return Buffer.from(buffer).toString('base64')
}

// --- Model callers ---

async function callStableDiffusion(prompt) {
  const data = await postJSON('/sdapi/v1/txt2img', {
    prompt,
    negative_prompt: '',
    steps: 20,
    cfg_scale: 7,
    width: 576,
    height: 1024,
    sampler_name: 'Euler a',
  })
  const b64 = extractBase64(data)
  if (b64) return b64
  throw new Error('SD 未返回图片: ' + JSON.stringify(data).slice(0, 300))
}

async function callWavespeedFluxSchnell(prompt) {
  const data = await postJSON('/wavespeed/v1/images/generations', {
    model: 'wavespeed-ai/flux-schnell',
    prompt,
    num_images: 1,
    width: 576,
    height: 1024,
  })
  const b64 = extractBase64(data)
  if (b64) return b64
  throw new Error('Flux 未返回图片: ' + JSON.stringify(data).slice(0, 300))
}

async function callWavespeedQwen(prompt) {
  const data = await postJSON('/wavespeed/v1/images/generations', {
    model: 'wavespeed-ai/qwen-image/text-to-image',
    prompt,
    num_images: 1,
    width: 576,
    height: 1024,
  })
  const b64 = extractBase64(data)
  if (b64) return b64
  throw new Error('Qwen 未返回图片: ' + JSON.stringify(data).slice(0, 300))
}

async function callSiliconflowKolors(prompt) {
  const data = await postFormData('/siliconflow/v1/images/generations', {
    model: 'Kwai-Kolors/Kolors',
    prompt,
    image_size: '768x1024',
    batch_size: '1',
    num_inference_steps: '30',
    guidance_scale: '5.0',
  })
  const text = JSON.stringify(data)
  if (text.includes('error') || text.includes('err_code')) {
    throw new Error('Kolors: ' + text.slice(0, 400))
  }
  const b64 = extractBase64(data)
  if (b64) return b64
  throw new Error('Kolors 未返回图片: ' + text.slice(0, 300))
}

async function callFluxDevLora(prompt) {
  const data = await postJSON('/302ai/v1/images/generations', {
    model: 'flux-dev',
    prompt,
    image_size: 'square_hd',
    num_images: 1,
  })
  const b64 = extractBase64(data)
  if (b64) return b64
  const url = data?.data?.[0]?.url
  if (url && url.startsWith('http')) {
    return downloadImageAsBase64(url)
  }
  throw new Error('Flux-Dev 未返回图片: ' + JSON.stringify(data).slice(0, 300))
}

async function callQwenImage302(prompt) {
  const data = await postJSON('/302ai/v1/images/generations', {
    model: 'qwen-image',
    prompt,
    image_size: 'portrait_4_3',
    num_images: 1,
  })
  const b64 = extractBase64(data)
  if (b64) return b64
  const url = data?.data?.[0]?.url
  if (url && url.startsWith('http')) {
    return downloadImageAsBase64(url)
  }
  throw new Error('Qwen-Image 未返回图片: ' + JSON.stringify(data).slice(0, 300))
}

const MODEL_HANDLERS = [
  { name: 'Flux-Dev', fn: callFluxDevLora },
  { name: 'Qwen-Image', fn: callQwenImage302 },
  { name: 'Kolors', fn: callSiliconflowKolors },
  { name: 'Flux-Schnell', fn: callWavespeedFluxSchnell },
  { name: 'Qwen-Wavespeed', fn: callWavespeedQwen },
  { name: 'StableDiffusion', fn: callStableDiffusion },
]

export async function generateAIPosterImage({ prompt }) {
  if (!getApiKey()) {
    throw new Error('POSTER_AI_API_KEY 未配置')
  }

  let lastError = null
  for (const handler of MODEL_HANDLERS) {
    try {
      const base64 = await handler.fn(prompt)
      return { base64, revisedPrompt: null }
    } catch (e) {
      console.warn(`[AI Poster] ${handler.name} 失败: ${e?.message?.slice(0, 200)}`)
      lastError = e
    }
  }

  throw lastError || new Error('所有 AI 模型均不可用')
}

export function isPosterAiConfigured() {
  return !!getApiKey()
}
