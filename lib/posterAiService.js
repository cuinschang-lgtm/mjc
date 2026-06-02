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
  const url = `${getBaseUrl()}/chat/completions`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
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

  const content = data?.choices?.[0]?.message?.content
  if (!content) {
    throw new Error('未返回内容: ' + JSON.stringify(data).slice(0, 500))
  }

  if (typeof content === 'string') {
    const base64Match = content.match(/data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)/)
    if (base64Match) {
      return base64Match[1]
    }
    const urlMatch = content.match(/https?:\/\/[^\s"')>]+\.(png|jpg|jpeg|webp)/i)
    if (urlMatch) {
      const imgRes = await fetch(urlMatch[0])
      const buffer = await imgRes.arrayBuffer()
      return Buffer.from(buffer).toString('base64')
    }
    throw new Error('内容中未找到图片: ' + content.slice(0, 500))
  }

  if (Array.isArray(content)) {
    for (const part of content) {
      if (part.type === 'image_url' && part.image_url?.url) {
        const imgUrl = part.image_url.url
        if (imgUrl.startsWith('data:image')) {
          return imgUrl.replace(/^data:image\/[^;]+;base64,/, '')
        }
        const imgRes = await fetch(imgUrl)
        const buffer = await imgRes.arrayBuffer()
        return Buffer.from(buffer).toString('base64')
      }
      if (part.type === 'image' && part.image) {
        const imgData = part.image?.b64_json || part.image?.base64 || part.image?.url || part.image
        if (typeof imgData === 'string') {
          if (imgData.startsWith('http')) {
            const imgRes = await fetch(imgData)
            const buffer = await imgRes.arrayBuffer()
            return Buffer.from(buffer).toString('base64')
          }
          return imgData.replace(/^data:image\/[^;]+;base64,/, '')
        }
      }
    }
  }

  const directBase64 = data?.images?.[0]?.b64_json
    || data?.data?.[0]?.b64_json
    || data?.image
    || data?.base64
  if (directBase64) {
    return typeof directBase64 === 'string'
      ? directBase64.replace(/^data:image\/[^;]+;base64,/, '')
      : directBase64
  }

  throw new Error('未找到图片数据: ' + JSON.stringify(data).slice(0, 500))
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
