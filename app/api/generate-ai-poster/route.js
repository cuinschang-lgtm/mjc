import { NextResponse } from 'next/server'
import { generateAIPosterImage } from '@/lib/posterAiService'
import { buildPosterPrompt } from '@/lib/posterPromptBuilder'

export async function POST(request) {
  try {
    const body = await request.json()
    const { album, artist, year, tags, review, accentColor, style, coverImageUrl } = body

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

    let coverBase64 = null
    if (coverImageUrl) {
      try {
        const imgRes = await fetch(coverImageUrl, { signal: AbortSignal.timeout(15000) })
        if (imgRes.ok) {
          const buf = await imgRes.arrayBuffer()
          coverBase64 = Buffer.from(buf).toString('base64')
        }
      } catch { /* 下载失败不影响主流程 */ }
    }

    const base64 = await generateAIPosterImage({ prompt, imageBase64: coverBase64 })

    return NextResponse.json({ success: true, imageBase64: base64 })
  } catch (e) {
    console.error('AI poster generation error:', e?.message || e)

    const keySet = !!process.env.POSTER_AI_API_KEY
    return NextResponse.json({
      error: e?.message || 'AI 海报生成失败',
      diagnostic: { keySet },
      hint: keySet ? 'API Key 已设置，但模型调用失败。' : 'POSTER_AI_API_KEY 环境变量未设置',
    }, { status: 500 })
  }
}
