function getApiKey() {
  return process.env.POSTER_AI_API_KEY || ''
}

function getBaseUrl() {
  return process.env.POSTER_AI_BASE_URL || 'https://api.stepfun.com/v1'
}

async function apiJson(method, endpoint, body) {
  const url = `${getBaseUrl()}${endpoint}`
  const res = await fetch(url, {
    method,
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: method === 'GET' ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(text.slice(0, 500) || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  try { return JSON.parse(text) } catch { return text }
}

function extractB64(data) {
  const b64 = data?.data?.[0]?.b64_json || data?.data?.[0]?.url
  if (!b64) throw new Error('未返回图片: ' + JSON.stringify(data).slice(0, 400))
  return b64
}

async function generateWithStyleRef(prompt, coverBase64) {
  const data = await apiJson('POST', '/images/generations', {
    model: 'step-1x-medium',
    prompt,
    size: '800x1280',
    n: 1,
    response_format: 'b64_json',
    steps: 30,
    cfg_scale: 5.0,
    style_reference: {
      source_url: `data:image/jpeg;base64,${coverBase64}`,
      weight: 0.5,
    },
  })
  return extractB64(data)
}

async function generateTextOnly(prompt) {
  const data = await apiJson('POST', '/images/generations', {
    model: 'step-1x-medium',
    prompt,
    size: '800x1280',
    n: 1,
    response_format: 'b64_json',
    steps: 50,
    cfg_scale: 7.5,
  })
  return extractB64(data)
}

async function generateWithEdit(prompt, coverBase64) {
  if (prompt.length > 500) prompt = prompt.slice(0, 497) + '...'

  const url = `${getBaseUrl()}/images/edits`
  const form = new FormData()
  form.append('model', 'step-image-edit-2')
  form.append('prompt', prompt)
  form.append('response_format', 'b64_json')
  form.append('steps', '8')
  form.append('cfg_scale', '1.0')
  form.append('text_mode', 'true')

  const buf = Buffer.from(coverBase64, 'base64')
  form.append('image', new Blob([buf], { type: 'image/png' }), 'cover.png')

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${getApiKey()}` },
    body: form,
    signal: AbortSignal.timeout(120000),
  })
  const text = await res.text()
  if (!res.ok) {
    const err = new Error(text.slice(0, 500) || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }
  return extractB64(JSON.parse(text))
}

export async function generateAIPosterImage({ prompt, imageBase64 }) {
  if (!getApiKey()) {
    throw new Error('POSTER_AI_API_KEY 未配置')
  }

  // 1) style_reference 模式: 用 step-1x-medium 参考封面生成海报（质量最高）
  if (imageBase64) {
    try {
      return await generateWithStyleRef(prompt, imageBase64)
    } catch (e) {
      console.warn('[AI Poster] style_reference 失败, 尝试编辑模式:', e?.message?.slice(0, 200))
      // 2) 降级到编辑模式
    }
    try {
      return await generateWithEdit(prompt, imageBase64)
    } catch (e2) {
      console.warn('[AI Poster] 编辑模式也失败, 回退纯文本:', e2?.message?.slice(0, 200))
    }
  }

  // 3) 纯文本生成
  return await generateTextOnly(prompt)
}

export function isPosterAiConfigured() {
  return !!getApiKey()
}
