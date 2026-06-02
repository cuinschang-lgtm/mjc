function getApiKey() {
  return process.env.POSTER_AI_API_KEY || ''
}

function getBaseUrl() {
  return process.env.POSTER_AI_BASE_URL || 'https://api.302.ai'
}

async function callApi(endpoint, bodyFn) {
  const url = `${getBaseUrl()}${endpoint}`
  const body = bodyFn()
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(text || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }

  return res.json()
}

async function callKolors(prompt) {
  const form = new FormData()
  form.append('model', 'Kwai-Kolors/Kolors')
  form.append('prompt', prompt)
  form.append('image_size', '720x1280')
  form.append('batch_size', '1')
  form.append('num_inference_steps', '50')
  form.append('guidance_scale', '7.5')

  const url = `${getBaseUrl()}/siliconflow/v1/images/generations`
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

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('Kolors 返回格式异常: ' + text.slice(0, 200))
  }

  const image = data?.images?.[0] || data?.data?.[0]?.b64_json || data?.data?.[0]?.url
  if (!image) {
    throw new Error('Kolors 未返回图片: ' + JSON.stringify(data).slice(0, 300))
  }

  if (typeof image === 'string' && image.startsWith('http')) {
    const imgRes = await fetch(image)
    const buffer = await imgRes.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  }

  return image
}

async function callQwenImage(prompt) {
  const data = await callApi('/302ai/v1/images/generations', () => ({
    model: 'qwen-image',
    prompt,
    image_size: '720x1280',
    num_images: 1,
  }))

  const image = data?.images?.[0] || data?.data?.[0]?.url || data?.data?.[0]?.b64_json
  if (!image) {
    throw new Error('Qwen-Image 未返回图片: ' + JSON.stringify(data).slice(0, 300))
  }

  if (typeof image === 'string' && image.startsWith('http')) {
    const imgRes = await fetch(image)
    const buffer = await imgRes.arrayBuffer()
    return Buffer.from(buffer).toString('base64')
  }

  return image
}

const MODEL_HANDLERS = [
  { name: 'Kolors', fn: callKolors },
  { name: 'Qwen-Image', fn: callQwenImage },
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
      console.warn(`[AI Poster] ${handler.name} 失败:`, e?.message)
      lastError = e
    }
  }

  throw lastError || new Error('所有 AI 模型均不可用')
}

export function isPosterAiConfigured() {
  return !!getApiKey()
}
