import OpenAI from 'openai'

let _client = null

function getClient() {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY || 'placeholder',
      baseURL: process.env.DEEPSEEK_API_BASE_URL || 'https://api.deepseek.com'
    })
  }
  return _client
}

export async function generateAlbumDetails(album) {
  if (!process.env.DEEPSEEK_API_KEY) {
    throw new Error('DEEPSEEK_API_KEY not configured')
  }

  const prompt = buildAlbumPrompt(album)

  try {
    const response = await getClient().chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一位严谨的音乐百科编辑。你只提供经过验证的、真实存在的信息。
规则：
- 只写你确定真实存在的事实，绝不编造或推测
- 曲目列表必须完整且准确，包含专辑的全部曲目
- 如果你不确定某项信息，返回 null 而不是编造内容
- 奖项必须是真实获得的，不确定就返回 null
- 乐评必须基于真实的媒体评价，不确定就返回 null`
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4000
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

function buildAlbumPrompt(album) {
  let context = ''
  if (album.existingData) {
    const d = album.existingData
    if (d.tracks && d.tracks.length > 0) {
      context += `\n已知曲目列表（来自网易云音乐，可作为参考验证）：\n${d.tracks.map(t => `${t.index}. ${t.name} ${t.durationText || ''}`).join('\n')}\n`
    }
    if (d.artistBio) context += `\n已有艺术家简介（可补充完善）：\n${d.artistBio.slice(0, 500)}\n`
    if (d.creationBackground) context += `\n已有创作背景（可补充完善）：\n${d.creationBackground.slice(0, 500)}\n`
  }

  return `请为以下专辑提供准确的百科级信息（中文回答）：

专辑名称：${album.title}
艺术家：${album.artist}
发行日期：${album.releaseDate || '未知'}
${context}
请以 JSON 格式返回：
{
  "artistBio": "艺术家简介（200-500字，包含出道经历、音乐风格、代表作品）",
  "creationBackground": "专辑创作背景（200-600字，包含创作动机、录制过程、音乐风格特点）",
  "mediaReviews": "专业乐评摘要（200-400字，引用真实媒体评价，注明来源）",
  "awards": "奖项与荣誉（仅列出真实获得的奖项，不确定则返回 null）",
  "genres": ["风格标签1", "风格标签2"],
  "tracklist": [
    {"index": 1, "name": "曲目名称", "duration": "3:45"},
    {"index": 2, "name": "曲目名称", "duration": "4:20"}
  ]
}

严格要求：
1. 只提供你确定真实的信息，不确定的字段返回 null
2. 曲目列表必须是该专辑真实的完整曲目，不可编造
3. 时长格式统一为"分:秒"
4. 奖项必须是真实获得的
5. 只返回 JSON，不要有其他文字`
}

function parseGeneratedContent(content) {
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('AI 返回格式错误：未找到 JSON')
  }

  try {
    const parsed = JSON.parse(jsonMatch[0])

    const result = {
      artistBio: sanitizeAIField(parsed.artistBio),
      creationBackground: sanitizeAIField(parsed.creationBackground),
      mediaReviews: sanitizeAIField(parsed.mediaReviews),
      awards: sanitizeAIField(parsed.awards),
      genres: Array.isArray(parsed.genres) ? parsed.genres : null,
      tracklist: Array.isArray(parsed.tracklist) ? parsed.tracklist : null
    }

    return result
  } catch (e) {
    throw new Error('AI 返回 JSON 解析失败')
  }
}

function sanitizeAIField(value) {
  if (!value || typeof value !== 'string') return null
  const s = value.trim()
  if (!s) return null
  if (/^暂无/.test(s) || /^无相关/.test(s) || /^未找到/.test(s)) return null
  return s
}

export function isDeepSeekConfigured() {
  return !!process.env.DEEPSEEK_API_KEY
}
