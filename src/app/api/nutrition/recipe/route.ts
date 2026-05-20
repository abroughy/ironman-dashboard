import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromRequest } from '@/lib/auth'
import { config } from '@/lib/config'
import Anthropic from '@anthropic-ai/sdk'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title')
  const slot = searchParams.get('slot') ?? 'meal'
  const calories = searchParams.get('calories') ?? '500'
  const phase = searchParams.get('phase') ?? 'Base'

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })

  const prompt = `Generate a recipe for: "${title}" (triathlete meal, ${slot}, ~${calories} kcal, ${phase} phase).
Return ONLY valid JSON with no markdown, no code fences, no explanation:
{"ingredients":["200g chicken breast","1 tbsp olive oil"],"steps":["Step 1.","Step 2."]}
Use 5-8 ingredients and 4-6 steps. Be specific with quantities.`

  try {
    const client = new Anthropic({ apiKey: config.anthropicApiKey })
    const message = await client.messages.create({
      model: 'claude-3-5-haiku-20241022',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
    // Strip any accidental markdown fences
    const jsonText = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim()
    const recipe = JSON.parse(jsonText)

    return NextResponse.json({
      title,
      ingredients: Array.isArray(recipe.ingredients) ? recipe.ingredients : [],
      steps: Array.isArray(recipe.steps) ? recipe.steps : [],
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('Recipe fetch failed:', message)
    return NextResponse.json({ error: 'Failed to generate recipe' }, { status: 500 })
  }
}
