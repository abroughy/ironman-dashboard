import Anthropic from '@anthropic-ai/sdk'
import { config } from '@/lib/config'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MealPlanContent {
  phase: string
  calorieGoal: number
  days: DayPlan[]
}

export interface DayPlan {
  date: string           // ISO "2026-05-19"
  totalCalories: number
  meals: Meal[]
}

export interface Meal {
  slot: string           // "breakfast" | "morningSnack" | "lunch" | "afternoonSnack" | "dinner" | "eveningSnack"
  recipeId: number
  title: string
  image: string
  sourceUrl: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

export interface NutritionProfileData {
  calorieGoal: number
  weightKg: number | null
  diet: string
  intolerances: string
  mealsPerDay: number
}

// ─── Slot constants ───────────────────────────────────────────────────────────

export const MEAL_SLOTS: Record<number, string[]> = {
  3: ['breakfast', 'lunch', 'dinner'],
  4: ['breakfast', 'lunch', 'afternoonSnack', 'dinner'],
  5: ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner'],
  6: ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner', 'eveningSnack'],
}

export const SLOT_EMOJIS: Record<string, string> = {
  breakfast: '🌅',
  morningSnack: '🍎',
  lunch: '☀️',
  afternoonSnack: '🍌',
  dinner: '🌙',
  eveningSnack: '🥛',
}

export const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  morningSnack: 'Morning Snack',
  lunch: 'Lunch',
  afternoonSnack: 'Afternoon Snack',
  dinner: 'Dinner',
  eveningSnack: 'Evening Snack',
}

// ─── Pure helpers ─────────────────────────────────────────────────────────────

// BMR formula: Mifflin-St Jeor, assumes 175cm height, age 30, male
const BMR_HEIGHT_CM = 175
const BMR_AGE_YEARS = 30

export function estimateCalories(weightKg: number, phase: string): number {
  const bmr = 10 * weightKg + 6.25 * BMR_HEIGHT_CM - 5 * BMR_AGE_YEARS + 5
  const multipliers: Record<string, number> = {
    Peak: 1.75,
    Build: 1.60,
    Taper: 1.45,
    Base: 1.55,
  }
  return Math.round(bmr * (multipliers[phase] ?? 1.55))
}

export function toDiet(diet: string): string | undefined {
  const map: Record<string, string> = {
    vegetarian: 'vegetarian',
    vegan: 'vegan',
    glutenFree: 'gluten free',
    dairyFree: 'dairy free',
  }
  return map[diet]
}

export function toSpoonacularIntolerances(intolerances: string): string {
  const map: Record<string, string> = {
    nuts: 'tree nut',
    shellfish: 'shellfish',
    eggs: 'egg',
    soy: 'soy',
  }
  return intolerances
    .split(',')
    .filter(Boolean)
    .map(i => map[i] ?? i)
    .join(',')
}

/** Returns Monday of current week at midnight UTC */
export function getWeekStart(): Date {
  const d = new Date()
  const day = d.getUTCDay()
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1))
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/**
 * Returns which meal slot is "current" based on hour (0–23).
 * Falls back to last slot if no match found.
 */
export function getCurrentMealSlot(slots: string[], hour?: number): string {
  const h = hour ?? new Date().getHours()
  if (h < 10) return slots.find(s => s === 'breakfast') ?? slots[0]
  if (h < 11 && slots.includes('morningSnack')) return 'morningSnack'
  if (h < 14) return slots.find(s => s === 'lunch') ?? slots[0]
  if (h < 17 && slots.includes('afternoonSnack')) return 'afternoonSnack'
  return slots[slots.length - 1]
}

// ─── Claude-only generation ───────────────────────────────────────────────────

/**
 * Generates a full weekly meal plan using Claude only — no external recipe API.
 * Claude produces recipe names, realistic macro estimates, and a Google recipe link.
 */
export async function generateMealPlan(
  profile: NutritionProfileData,
  phase: string,
): Promise<MealPlanContent> {
  const slots = MEAL_SLOTS[profile.mealsPerDay] ?? MEAL_SLOTS[5]
  const weekStart = getWeekStart()
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  })

  const phaseGuidance: Record<string, string> = {
    Peak: 'High carb focus: 60% carbs, 25% protein, 15% fat. Prioritise pasta, rice, potatoes, oats.',
    'Race Week': 'Carb-loading: 65% carbs, 20% protein, 15% fat. Easy-to-digest foods only.',
    Build: 'Balanced macros: 50% carbs, 30% protein, 20% fat. Good mix of whole foods.',
    Taper: `Reduced total calories (${Math.round(profile.calorieGoal * 0.85)} kcal/day). Maintain protein. 50% carbs, 30% protein, 20% fat.`,
  }
  const guidance = phaseGuidance[phase] ?? 'Balanced macros: 50% carbs, 30% protein, 20% fat.'

  const dietNote = profile.diet !== 'none' ? `Diet preference: ${profile.diet}.` : ''
  const intoleranceNote = profile.intolerances ? `Avoid these allergens: ${profile.intolerances}.` : ''

  const totalMeals = weekDates.length * slots.length

  const prompt = `You are a sports nutritionist creating a weekly meal plan for an endurance triathlete.

Training phase: ${phase}
Nutrition guidance: ${guidance}
Daily calorie goal: ${profile.calorieGoal} kcal
Meal slots per day: ${JSON.stringify(slots)}
Week dates (Mon–Sun): ${JSON.stringify(weekDates)}
${dietNote}
${intoleranceNote}

For each meal, provide:
- A specific, realistic recipe name (not generic — e.g. "Grilled salmon with sweet potato mash" not just "Salmon")
- Realistic macro estimates based on the recipe
- A recipeId (just use a unique integer 1–${totalMeals})
- image: empty string ""
- sourceUrl: a Google search URL like "https://www.google.com/search?q=recipe+name+recipe" (URL-encode the recipe name)

Distribute daily calories: breakfast ~25%, each snack ~8–10%, lunch ~30%, dinner ~30%.
Vary meals — do not repeat the same dish on consecutive days.

Respond with valid JSON only — no markdown, no explanation. Return an array of exactly ${totalMeals} objects:
[
  {
    "date": "2026-05-19",
    "slot": "breakfast",
    "recipeId": 1,
    "title": "Banana oat pancakes with honey",
    "image": "",
    "sourceUrl": "https://www.google.com/search?q=banana+oat+pancakes+recipe",
    "calories": 620,
    "proteinG": 18,
    "carbsG": 95,
    "fatG": 14
  }
]

Return exactly ${weekDates.length} × ${slots.length} = ${totalMeals} objects.`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  const message = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''

  // Strip any markdown code fences Claude might wrap around the JSON
  const cleaned = text.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()

  interface ClaudeMeal extends Meal { date: string }

  let parsed: ClaudeMeal[]
  try {
    parsed = JSON.parse(cleaned) as ClaudeMeal[]
  } catch {
    throw new Error(`Claude returned invalid JSON: ${cleaned.slice(0, 300)}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Claude returned unexpected structure (expected array): ${cleaned.slice(0, 300)}`)
  }

  // Group meals by date
  const dayMap = new Map<string, Meal[]>()
  for (const meal of parsed) {
    const { date, ...mealData } = meal
    if (!dayMap.has(date)) dayMap.set(date, [])
    dayMap.get(date)!.push(mealData)
  }

  const days: DayPlan[] = weekDates.map(date => {
    const meals = dayMap.get(date) ?? []
    return {
      date,
      totalCalories: meals.reduce((sum, m) => sum + m.calories, 0),
      meals,
    }
  })

  return { phase, calorieGoal: profile.calorieGoal, days }
}
