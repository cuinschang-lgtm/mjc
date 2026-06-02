import OpenAI from 'openai'

let _client = null

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.POSTER_AI_API_KEY || 'placeholder',
      baseURL: (process.env.POSTER_AI_BASE_URL || 'https://api.302.ai') + '/v1',
    })
  }
  return _client
}

export async function generateAIPosterImage({ prompt }) {
  if (!process.env.POSTER_AI_API_KEY) {
    throw new Error('POSTER_AI_API_KEY 未配置')
  }

  const response = await getClient().images.generate({
    model: process.env.POSTER_AI_MODEL || 'gpt-image-2',
    prompt,
    n: 1,
    size: '1024x1792',
    response_format: 'b64_json',
  })

  const imageData = response.data[0]
  if (!imageData || !imageData.b64_json) {
    throw new Error('AI 图片生成返回为空')
  }

  return {
    base64: imageData.b64_json,
    revisedPrompt: imageData.revised_prompt || null,
  }
}

export async function generateAIPosterImageUrl({ prompt }) {
  if (!process.env.POSTER_AI_API_KEY) {
    throw new Error('POSTER_AI_API_KEY 未配置')
  }

  const response = await getClient().images.generate({
    model: process.env.POSTER_AI_MODEL || 'gpt-image-2',
    prompt,
    n: 1,
    size: '1024x1792',
    response_format: 'url',
  })

  const imageData = response.data[0]
  if (!imageData || !imageData.url) {
    throw new Error('AI 图片生成返回为空')
  }

  return {
    url: imageData.url,
    revisedPrompt: imageData.revised_prompt || null,
  }
}

export function isPosterAiConfigured() {
  return !!process.env.POSTER_AI_API_KEY
}
