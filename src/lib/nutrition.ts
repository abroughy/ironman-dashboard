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

/** Exported for testing. Builds the favourites clause appended to the meal plan prompt. */
export function buildFavouriteNote(favourites: string[]): string {
  if (favourites.length === 0) return ''
  return `\nFavourites to include or draw inspiration from: ${favourites.slice(0, 10).join(', ')}.`
}

/**
 * Generates a full weekly meal plan using Claude only — no external recipe API.
 * Claude produces recipe names, realistic macro estimates, and a Google recipe link.
 */
export async function generateMealPlan(
  profile: NutritionProfileData,
  phase: string,
  favourites: string[] = [],
): Promise<MealPlanContent> {
  const slots = MEAL_SLOTS[profile.mealsPerDay] ?? MEAL_SLOTS[5]
  const weekStart = getWeekStart()
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setUTCDate(d.getUTCDate() + i)
    return d.toISOString().split('T')[0]
  })

  const phaseGuidance: Record<string, string> = {
    Peak: 'high carb (60% carbs, 25% protein, 15% fat)',
    'Race Week': 'carb-loading (65% carbs, 20% protein, 15% fat)',
    Build: 'balanced (50% carbs, 30% protein, 20% fat)',
    Taper: `reduced calories ~${Math.round(profile.calorieGoal * 0.85)} kcal (50% carbs, 30% protein, 20% fat)`,
  }
  const guidance = phaseGuidance[phase] ?? 'balanced (50% carbs, 30% protein, 20% fat)'
  const dietNote = profile.diet !== 'none' ? ` Diet: ${profile.diet}.` : ''
  const intoleranceNote = profile.intolerances ? ` Avoid: ${profile.intolerances}.` : ''
  const totalMeals = weekDates.length * slots.length

  const favouriteNote = buildFavouriteNote(favourites)

  // Single compact call — CSV output is tiny so response is fast (under 5s on Sonnet)
  const prompt = `Triathlete meal plan. Phase: ${phase} — ${guidance}. ${profile.calorieGoal} kcal/day.${dietNote}${intoleranceNote}${favouriteNote}
Slots per day: ${slots.join(', ')}. Calories: breakfast 25%, snacks 8-10%, lunch 30%, dinner 30%.
Vary meals daily. Specific recipe names (not generic).

Output ONLY ${totalMeals} CSV rows, no header, no markdown:
date,slot,id,title,cal,pro,carb,fat

Dates: ${weekDates.join(', ')}`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 3000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  // Parse CSV rows into meals grouped by date
  const dayMap = new Map<string, Meal[]>()
  let id = 1
  for (const line of text.split('\n')) {
    const cols = line.trim().split(',')
    if (cols.length < 8) continue
    const [date, slot, , title, cal, pro, carb, fat] = cols
    if (!weekDates.includes(date.trim())) continue
    const d = date.trim()
    if (!dayMap.has(d)) dayMap.set(d, [])
    dayMap.get(d)!.push({
      slot: slot.trim(),
      recipeId: id++,
      title: title.trim(),
      image: '',
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(title.trim())}+recipe`,
      calories: Math.round(Number(cal) || 0),
      proteinG: Math.round(Number(pro) || 0),
      carbsG: Math.round(Number(carb) || 0),
      fatG: Math.round(Number(fat) || 0),
    })
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
