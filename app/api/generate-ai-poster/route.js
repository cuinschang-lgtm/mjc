import { NextResponse } from 'next/server'
import { generateAIPosterImage } from '@/lib/posterAiService'
import { buildPosterPrompt } from '@/lib/posterPromptBuilder'

export async function POST(request) {
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

    if (e?.status === 401) {
      return NextResponse.json({ error: 'POSTER_AI_API_KEY 无效，请检查配置' }, { status: 401 })
    }
    if (e?.status === 429) {
      return NextResponse.json({ error: 'API 调用频率过高，请稍后重试' }, { status: 429 })
    }
    if (e?.code === 'billing_hard_limit_reached' || e?.message?.includes('billing')) {
      return NextResponse.json({ error: '302ai 账户余额不足，请充值' }, { status: 402 })
    }

    return NextResponse.json({ error: e?.message || 'AI 海报生成失败' }, { status: 500 })
  }
}
