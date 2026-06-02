function getApiKey() {
  return process.env.POSTER_AI_API_KEY || ''
}

function getBaseUrl() {
  return process.env.POSTER_AI_BASE_URL || 'https://api.stepfun.com/v1'
}

function getModel() {
  return process.env.POSTER_AI_MODEL || 'step-image-edit-2'
}

async function generateImage(prompt) {
  const url = `${getBaseUrl()}/images/generations`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel(),
      prompt,
      size: '768x1360',
      n: 1,
      response_format: 'b64_json',
      steps: 8,
      cfg_scale: 1.0,
    }),
    signal: AbortSignal.timeout(120000),
  })

  const text = await res.text()
  if (!res.ok) {
    const err = new Error(text.slice(0, 500) || `HTTP ${res.status}`)
    err.status = res.status
    throw err
  }

  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('阶跃星辰返回格式异常: ' + text.slice(0, 300))
  }

  const b64 = data?.data?.[0]?.b64_json
  if (!b64) {
    throw new Error('未返回图片: ' + JSON.stringify(data).slice(0, 500))
  }

  return b64
}

export async function generateAIPosterImage({ prompt }) {
  if (!getApiKey()) {
    throw new Error('POSTER_AI_API_KEY 未配置')
  }

  const base64 = await generateImage(prompt)
  return { base64, revisedPrompt: null }
}

export function isPosterAiConfigured() {
  return !!getApiKey()
}
