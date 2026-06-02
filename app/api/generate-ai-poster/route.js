import { NextResponse } from 'next/server'
import { generateAIPosterImage } from '@/lib/posterAiService'
import { buildPosterPrompt } from '@/lib/posterPromptBuilder'

export async function GET() {
  const allKeys = Object.keys(process.env).filter(k => k.includes('POSTER') || k.includes('302') || k.includes('AI'))
  return NextResponse.json({
    envKeysFound: allKeys,
    posterAiKeySet: !!process.env.POSTER_AI_API_KEY,
    posterAiKeyLen: (process.env.POSTER_AI_API_KEY || '').length,
  })
}

export async function POST(request) {
  const diagnostic = {
    envKeysFound: Object.keys(process.env).filter(k => k.includes('POSTER')),
    keySet: !!process.env.POSTER_AI_API_KEY,
    keyLen: (process.env.POSTER_AI_API_KEY || '').length,
  }

  try {
    const body = await request.json()
    const { album, artist, year, tags, review, accentColor, style } = body

    if (!album || !artist) {
      return NextResponse.json({ error: '缺少专辑名称或艺人名称' }, { status: 400 })
    }

    const prompt = buildPosterPrompt({
      album,
      artist,
      year: year || '',
      tags: Array.isArray(tags) ? tags : [],
      review: review || '',
      accentColor: accentColor || '',
      style: style || 'glass',
    })

    const result = await generateAIPosterImage({ prompt })

    return NextResponse.json({
      success: true,
      imageBase64: result.base64,
      revisedPrompt: result.revisedPrompt,
    })
  } catch (e) {
    console.error('AI poster generation error:', e?.message || e)

    return NextResponse.json({
      error: e?.message || 'AI 海报生成失败',
      diagnostic,
      hint: diagnostic.keySet
        ? 'API Key 已设置，以下模型均调用失败。请检查 302ai 账户余额及模型可用性。'
        : 'POSTER_AI_API_KEY 环境变量未设置，请在 Vercel Dashboard > Settings > Environment Variables 中添加',
    }, { status: 500 })
  }
}
