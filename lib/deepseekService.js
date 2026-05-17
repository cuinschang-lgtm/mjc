import OpenAI from 'openai'

// DeepSeek API 客户端配置
const client = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com'
})

/**
 * 生成专辑详细信息
 * @param {Object} album - 专辑基本信息
 * @param {string} album.title - 专辑名称
 * @param {string} album.artist - 艺术家名称
 * @param {string} album.releaseDate - 发行日期
 * @returns {Promise<Object>} 生成的详细信息
 */
export async function generateAlbumDetails(album) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  const prompt = buildAlbumPrompt(album)

  try {
    const response = await client.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一位专业的音乐资料专家，擅长整理和撰写专辑信息。请基于已有信息生成准确的专辑资料。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('AI 返回内容为空')
    }

    return parseGeneratedContent(content)
  } catch (error) {
    if (error.status === 401) {
      throw new Error('DeepSeek API Key 无效')
    }
    if (error.status === 429) {
      throw new Error('DeepSeek API 速率限制')
    }
    throw error
  }
}

/**
 * 构建 AI 提示词
 */
function buildAlbumPrompt(album) {
  return `请为以下专辑生成详细信息（请用中文回答）：

专辑名称：${album.title}
艺术家：${album.artist}
发行日期：${album.releaseDate || '未知'}

请生成以下内容，以 JSON 格式返回：
{
  "artistBio": "艺术家简介（200-500字）",
  "creationBackground": "专辑创作背景（300-600字）",
  "mediaReviews": "专业乐评摘要（200-400字）",
  "awards": "奖项与荣誉（如有）",
  "genres": ["流行", "摇滚", "爵士"],
  "tracklist": [
    {"index": 1, "name": "曲目名称", "duration": "3:45"},
    {"index": 2, "name": "曲目名称", "duration": "4:20"}
  ]
}

要求：
1. 信息准确，避免虚构
2. 如果信息不足，请说明"暂无相关信息"
3. 曲目列表请尽可能完整准确，包含专辑全部曲目
4. 时长格式统一为"分:秒"
5. 只返回 JSON，不要有其他文字`
}

/**
 * 解析 AI 生成的内容
 */
function parseGeneratedContent(content) {
  // 提取 JSON 内容
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误：未找到 JSON')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    // 验证必需字段
    const result = {
      artistBio: parsed.artistBio || null,
      creationBackground: parsed.creationBackground || null,
      mediaReviews: parsed.mediaReviews || null,
      awards: parsed.awards || null,
      genres: Array.isArray(parsed.genres) ? parsed.genres : null,
      tracklist: Array.isArray(parsed.tracklist) ? parsed.tracklist : null
    }

    return result
  } catch (e) {
    throw new Error('AI 返回 JSON 解析失败')
  }
}

/**
 * 检查 API 是否已配置
 */
export function isDeepSeekConfigured() {
  return !!process.env.DEEPSEEK_API_KEY
}
