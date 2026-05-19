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
  eveningSnack: '🌙',
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

/** Population-typical placeholders used in Mifflin-St Jeor formula */
const BMR_HEIGHT_CM = 175
const BMR_AGE_YEARS = 30

/** Mifflin-St Jeor BMR × phase activity multiplier */
export function estimateCalories(weightKg: number, phase: string): number {
  const bmr = (10 * weightKg) + (6.25 * BMR_HEIGHT_CM) - (5 * BMR_AGE_YEARS) + 5
  const multipliers: Record<string, number> = {
    'Peak': 1.75,
    'Race Week': 1.75,
    'Build': 1.60,
    'Taper': 1.45,
  }
  const multiplier = multipliers[phase] ?? 1.55
  return Math.round(bmr * multiplier)
}

/** Map DB diet value → Spoonacular diet param (undefined = omit) */
export function toDiet(diet: string): string | undefined {
  const map: Record<string, string> = {
    vegetarian: 'vegetarian',
    vegan: 'vegan',
    glutenFree: 'gluten free',
    dairyFree: 'dairy free',
  }
  return map[diet]
}

/** Map comma-separated UI intolerance keys → Spoonacular comma-separated values */
export function toSpoonacularIntolerances(intolerances: string): string {
  if (!intolerances) return ''
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

// ─── Spoonacular ──────────────────────────────────────────────────────────────

interface SpoonacularNutrient {
  name: string
  amount: number
  unit: string
}

interface SpoonacularResult {
  id: number
  title: string
  image: string
  sourceUrl?: string
  nutrition?: { nutrients: SpoonacularNutrient[] }
}

interface SpoonacularSearchResponse {
  results: SpoonacularResult[]
}

function extractNutrient(nutrients: SpoonacularNutrient[], name: string): number {
  return Math.round(nutrients.find(n => n.name === name)?.amount ?? 0)
}

function mapResult(result: SpoonacularResult, slot: string): Meal {
  const nutrients = result.nutrition?.nutrients ?? []
  return {
    slot,
    recipeId: result.id,
    title: result.title,
    image: result.image,
    sourceUrl: result.sourceUrl ?? `https://spoonacular.com/recipes/${result.title.toLowerCase().replace(/\s+/g, '-')}-${result.id}`,
    calories: extractNutrient(nutrients, 'Calories'),
    proteinG: extractNutrient(nutrients, 'Protein'),
    carbsG: extractNutrient(nutrients, 'Carbohydrates'),
    fatG: extractNutrient(nutrients, 'Fat'),
  }
}

async function spoonacularSearch(
  query: string,
  diet: string | undefined,
  intolerances: string,
  minCalories?: number,
  maxCalories?: number,
): Promise<SpoonacularResult | null> {
  const params = new URLSearchParams({
    query,
    addRecipeNutrition: 'true',
    addRecipeInformation: 'true',
    number: '1',
    apiKey: config.spoonacularApiKey,
  })
  if (diet) params.set('diet', diet)
  if (intolerances) params.set('intolerances', intolerances)
  if (minCalories != null) params.set('minCalories', String(minCalories))
  if (maxCalories != null) params.set('maxCalories', String(maxCalories))

  const res = await fetch(`https://api.spoonacular.com/recipes/complexSearch?${params}`)
  if (!res.ok) throw new Error(`Spoonacular ${res.status}: ${await res.text()}`)
  const data = await res.json() as SpoonacularSearchResponse
  return data.results[0] ?? null
}

async function fetchRecipeForSlot(
  slot: string,
  searchQuery: string,
  targetCalories: number,
  diet: string | undefined,
  intolerances: string,
): Promise<Meal | null> {
  const min = Math.round(targetCalories * 0.85)
  const max = Math.round(targetCalories * 1.15)

  // Try with calorie bounds first
  let result = await spoonacularSearch(searchQuery, diet, intolerances, min, max)

  // Retry without calorie bounds if no result
  if (!result) {
    result = await spoonacularSearch(searchQuery, diet, intolerances)
  }

  // Final fallback: generic healthy meal for this slot
  if (!result) {
    result = await spoonacularSearch(`healthy ${SLOT_LABELS[slot] ?? slot} meal`, diet, intolerances)
  }

  return result ? mapResult(result, slot) : null
}

// ─── Claude prompt ────────────────────────────────────────────────────────────

interface ClaudeMealSlot {
  date: string
  slot: string
  targetCalories: number
  searchQuery: string
}

async function buildMealStructureWithClaude(
  phase: string,
  calorieGoal: number,
  slots: string[],
  weekDates: string[],
  diet: string,
  intolerances: string,
): Promise<ClaudeMealSlot[]> {
  const phaseGuidance: Record<string, string> = {
    Peak: 'High carb focus: 60% carbs, 25% protein, 15% fat. Prioritise pasta, rice, potatoes, oats.',
    'Race Week': 'Carb-loading: 65% carbs, 20% protein, 15% fat. Easy-to-digest foods only.',
    Build: 'Balanced macros: 50% carbs, 30% protein, 20% fat. Good mix of whole foods.',
    Taper: `Reduced total calories (${Math.round(calorieGoal * 0.85)} kcal/day target). Maintain protein. 50% carbs, 30% protein, 20% fat.`,
  }
  const guidance = phaseGuidance[phase] ?? 'Balanced macros: 50% carbs, 30% protein, 20% fat.'

  const slotsJson = JSON.stringify(slots)
  const datesJson = JSON.stringify(weekDates)
  const dietNote = diet !== 'none' ? `Diet: ${diet}.` : ''
  const intoleranceNote = intolerances ? `Avoid: ${intolerances}.` : ''

  const prompt = `You are a sports nutritionist creating a weekly meal plan for an endurance triathlete.

Training phase: ${phase}
Nutrition guidance: ${guidance}
Daily calorie goal: ${calorieGoal} kcal
Meal slots per day: ${slotsJson}
Week dates: ${datesJson}
${dietNote} ${intoleranceNote}

For each day and meal slot, provide a Spoonacular recipe search query and a calorie target.
Vary the meals — do not repeat the same dish on consecutive days.
Distribute calories roughly: breakfast 25%, each snack 8–10%, lunch 30%, dinner 30%.

Respond with valid JSON only — no markdown, no explanation. Return an array of objects:
[
  {
    "date": "2026-05-19",
    "slot": "breakfast",
    "targetCalories": 650,
    "searchQuery": "high carb oatmeal banana honey"
  }
]

Return exactly ${weekDates.length * slots.length} objects (${weekDates.length} days × ${slots.length} slots).`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  let parsed: ClaudeMealSlot[]
  try {
    parsed = JSON.parse(text) as ClaudeMealSlot[]
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 300)}`)
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Claude returned unexpected structure (expected array): ${text.slice(0, 300)}`)
  }
  return parsed
}

// ─── Main plan generator ──────────────────────────────────────────────────────

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

  const diet = toDiet(profile.diet)
  const spoonacularIntolerances = toSpoonacularIntolerances(profile.intolerances)

  // Step 1: Claude generates meal structure
  const structure = await buildMealStructureWithClaude(
    phase,
    profile.calorieGoal,
    slots,
    weekDates,
    profile.diet,
    profile.intolerances,
  )

  // Step 2: Resolve all meal slots via Spoonacular (parallel per day)
  const dayMap = new Map<string, ClaudeMealSlot[]>()
  for (const item of structure) {
    if (!dayMap.has(item.date)) dayMap.set(item.date, [])
    dayMap.get(item.date)!.push(item)
  }

  const days: DayPlan[] = await Promise.all(
    weekDates.map(async (date) => {
      const daySlots = dayMap.get(date) ?? []
      const meals = (
        await Promise.all(
          daySlots.map(s =>
            fetchRecipeForSlot(s.slot, s.searchQuery, s.targetCalories, diet, spoonacularIntolerances)
          )
        )
      ).filter((m): m is Meal => m !== null)

      return {
        date,
        totalCalories: meals.reduce((sum, m) => sum + m.calories, 0),
        meals,
      }
    })
  )

  return { phase, calorieGoal: profile.calorieGoal, days }
}
