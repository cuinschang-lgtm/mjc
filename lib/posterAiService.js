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

const SUPPORTED_MODELS = [
  'openai/gpt-image-1/text-to-image',
  'openai/gpt-image-1-high-fidelity',
  'openai/dall-e-3',
  'openai/dall-e-2',
  'gpt-image-2',
]

function getModel() {
  return process.env.POSTER_AI_MODEL || 'openai/gpt-image-1/text-to-image'
}

export async function generateAIPosterImage({ prompt }) {
  if (!process.env.POSTER_AI_API_KEY) {
    throw new Error('POSTER_AI_API_KEY 未配置')
  }

  const response = await getClient().images.generate({
    model: getModel(),
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
    model: getModel(),
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
