# Nutrition & Meal Planning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add weekly phase-aware meal planning using Claude API (structure) + Spoonacular API (real recipes), with a dashboard widget and a dedicated `/nutrition` page for plans and preferences.

**Architecture:** Claude generates a 7-day meal structure (search queries + calorie targets per slot) → Spoonacular resolves each slot to a real recipe with nutritional data → stored as JSON in a `MealPlan` DB row. All plan viewing is a DB read with no live API calls. A `NutritionProfile` row per user stores preferences, dietary restrictions, and calorie goals.

**Tech Stack:** Next.js 14 App Router, Prisma + Neon PostgreSQL, `@anthropic-ai/sdk` (already installed), Spoonacular REST API (fetch), Vitest

---

## File Map

| File | Status | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add NutritionProfile + MealPlan models |
| `src/lib/config.ts` | Modify | Add `spoonacularApiKey` |
| `src/lib/nutrition.ts` | Create | Calorie estimation, slot helpers, Spoonacular client, plan generator |
| `__tests__/lib/nutrition.test.ts` | Create | Unit tests for pure functions |
| `src/app/api/nutrition/profile/route.ts` | Create | GET/PATCH NutritionProfile |
| `src/app/api/nutrition/plan/route.ts` | Create | GET plan (auto-generate if stale) |
| `src/app/api/nutrition/plan/regenerate/route.ts` | Create | POST force-regenerate |
| `src/app/nutrition/page.tsx` | Create | Server component, auth + profile fetch |
| `src/app/nutrition/NutritionClient.tsx` | Create | Tab manager client component |
| `src/app/nutrition/MealPlanTab.tsx` | Create | Day picker + recipe cards |
| `src/app/nutrition/PreferencesTab.tsx` | Create | Preferences form |
| `src/components/NutritionWidget.tsx` | Create | Dashboard widget |
| `src/app/page.tsx` | Modify | Add NutritionWidget |
| `src/components/Nav.tsx` | Modify | Add Nutrition nav link |

---

## Task 1: Schema, config, and env setup

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/lib/config.ts`
- Modify: `.env.local` (manual step — instructions below)

- [ ] **Step 1: Add NutritionProfile and MealPlan models to schema**

Open `prisma/schema.prisma`. At the end of the file, after the `GroupChallenge` model, add:

```prisma
model NutritionProfile {
  id           String   @id @default(cuid())
  userId       String   @unique
  calorieGoal  Int      @default(3000)
  weightKg     Float?
  diet         String   @default("none")   // "none"|"vegetarian"|"vegan"|"glutenFree"|"dairyFree"
  intolerances String   @default("")       // comma-separated UI keys: "nuts,shellfish,eggs,soy"
  mealsPerDay  Int      @default(5)        // 3–6
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model MealPlan {
  id          String   @id @default(cuid())
  userId      String
  weekStart   DateTime
  content     String   // JSON: MealPlanContent
  generatedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([userId])
}
```

- [ ] **Step 2: Add User relations for new models**

In `prisma/schema.prisma`, find the `model User` block. It ends with `groupChallenges GroupChallenge[]`. Add two more relation fields after that line:

```prisma
  nutritionProfile  NutritionProfile?
  mealPlans         MealPlan[]
```

- [ ] **Step 3: Run migration**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npx prisma migrate dev --name add_nutrition_models
```

Expected: migration created and applied, Prisma client regenerated. You should see `✓ Generated Prisma Client`.

- [ ] **Step 4: Add spoonacularApiKey to config**

In `src/lib/config.ts`, find the `export const config = {` block. Add `spoonacularApiKey` after `anthropicApiKey`:

```typescript
export const config = {
  dashboardSecret: process.env.DASHBOARD_SECRET ?? '',
  cronSecret: process.env.CRON_SECRET ?? '',
  raceDate: new Date(process.env.RACE_DATE ?? '2026-09-01'),
  weeklyTargets: JSON.parse(process.env.WEEKLY_TARGETS ?? '{"swim":5000,"bike":150000,"run":30000}') as {
    swim: number
    bike: number
    run: number
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? '',
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  spoonacularApiKey: process.env.SPOONACULAR_API_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
}
```

- [ ] **Step 5: Add SPOONACULAR_API_KEY to .env.local**

Open `.env.local` and add:

```
SPOONACULAR_API_KEY=230115a569d54025ac2a5a2d845aa6ec
```

- [ ] **Step 6: Build to verify no TypeScript errors**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/config.ts
git commit -m "feat: add NutritionProfile and MealPlan schema + spoonacular config"
```

---

## Task 2: Core nutrition library + tests

**Files:**
- Create: `src/lib/nutrition.ts`
- Create: `__tests__/lib/nutrition.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/lib/nutrition.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  estimateCalories,
  toDiet,
  toSpoonacularIntolerances,
  getWeekStart,
  getCurrentMealSlot,
  MEAL_SLOTS,
  SLOT_EMOJIS,
} from '@/lib/nutrition'

describe('estimateCalories', () => {
  it('returns higher calories for Peak phase', () => {
    const peak = estimateCalories(75, 'Peak')
    const taper = estimateCalories(75, 'Taper')
    expect(peak).toBeGreaterThan(taper)
  })

  it('uses Mifflin-St Jeor formula with correct multipliers', () => {
    // BMR = (10 * 75) + (6.25 * 175) - (5 * 30) + 5 = 750 + 1093.75 - 150 + 5 = 1698.75
    // Build: 1698.75 * 1.60 = 2718.0
    expect(estimateCalories(75, 'Build')).toBe(2718)
  })

  it('falls back to 1.55 multiplier for unknown phase', () => {
    const bmr = (10 * 80) + (6.25 * 175) - (5 * 30) + 5 // 1748.75
    expect(estimateCalories(80, 'Unknown')).toBe(Math.round(1748.75 * 1.55))
  })
})

describe('toDiet', () => {
  it('maps none to undefined', () => {
    expect(toDiet('none')).toBeUndefined()
  })

  it('maps glutenFree to "gluten free"', () => {
    expect(toDiet('glutenFree')).toBe('gluten free')
  })

  it('maps dairyFree to "dairy free"', () => {
    expect(toDiet('dairyFree')).toBe('dairy free')
  })

  it('passes through vegetarian and vegan unchanged', () => {
    expect(toDiet('vegetarian')).toBe('vegetarian')
    expect(toDiet('vegan')).toBe('vegan')
  })
})

describe('toSpoonacularIntolerances', () => {
  it('returns empty string for empty input', () => {
    expect(toSpoonacularIntolerances('')).toBe('')
  })

  it('maps nuts to tree nut', () => {
    expect(toSpoonacularIntolerances('nuts')).toBe('tree nut')
  })

  it('maps eggs to egg', () => {
    expect(toSpoonacularIntolerances('eggs')).toBe('egg')
  })

  it('maps multiple intolerances', () => {
    const result = toSpoonacularIntolerances('nuts,shellfish,soy')
    expect(result).toBe('tree nut,shellfish,soy')
  })
})

describe('getWeekStart', () => {
  it('returns a Monday at midnight UTC', () => {
    const ws = getWeekStart()
    expect(ws.getUTCDay()).toBe(1) // 1 = Monday
    expect(ws.getUTCHours()).toBe(0)
    expect(ws.getUTCMinutes()).toBe(0)
    expect(ws.getUTCSeconds()).toBe(0)
  })
})

describe('getCurrentMealSlot', () => {
  it('returns first slot for 5-slot plan at 09:00', () => {
    const slots = MEAL_SLOTS[5]
    // breakfast is always first
    expect(getCurrentMealSlot(slots, 9)).toBe('breakfast')
  })

  it('returns dinner for hour >= 17', () => {
    const slots = MEAL_SLOTS[5]
    expect(getCurrentMealSlot(slots, 18)).toBe('dinner')
  })

  it('returns lunch for hour 12', () => {
    const slots = MEAL_SLOTS[5]
    expect(getCurrentMealSlot(slots, 12)).toBe('lunch')
  })
})

describe('MEAL_SLOTS', () => {
  it('has correct counts for each mealsPerDay value', () => {
    expect(MEAL_SLOTS[3]).toHaveLength(3)
    expect(MEAL_SLOTS[4]).toHaveLength(4)
    expect(MEAL_SLOTS[5]).toHaveLength(5)
    expect(MEAL_SLOTS[6]).toHaveLength(6)
  })

  it('always includes breakfast, lunch, dinner', () => {
    for (const slots of Object.values(MEAL_SLOTS)) {
      expect(slots).toContain('breakfast')
      expect(slots).toContain('lunch')
      expect(slots).toContain('dinner')
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npx vitest run __tests__/lib/nutrition.test.ts 2>&1 | tail -20
```

Expected: FAIL — `Cannot find module '@/lib/nutrition'`

- [ ] **Step 3: Create `src/lib/nutrition.ts`**

```typescript
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

/** Mifflin-St Jeor BMR × phase activity multiplier */
export function estimateCalories(weightKg: number, phase: string): number {
  const bmr = (10 * weightKg) + (6.25 * 175) - (5 * 30) + 5
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
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  let parsed: ClaudeMealSlot[]
  try {
    parsed = JSON.parse(text) as ClaudeMealSlot[]
  } catch {
    throw new Error(`Claude returned invalid JSON: ${text.slice(0, 300)}`)
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
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npx vitest run __tests__/lib/nutrition.test.ts 2>&1 | tail -20
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/lib/nutrition.ts __tests__/lib/nutrition.test.ts
git commit -m "feat: add nutrition core lib with calorie estimation, slot helpers, and plan generator"
```

---

## Task 3: NutritionProfile API

**Files:**
- Create: `src/app/api/nutrition/profile/route.ts`

- [ ] **Step 1: Create the profile API route**

Create `src/app/api/nutrition/profile/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/** GET /api/nutrition/profile — fetch or auto-create the current user's NutritionProfile */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const profile = await prisma.nutritionProfile.upsert({
    where: { userId: session.userId },
    update: {},
    create: {
      userId: session.userId,
      calorieGoal: 3000,
      diet: 'none',
      intolerances: '',
      mealsPerDay: 5,
    },
  })

  return NextResponse.json({
    id: profile.id,
    calorieGoal: profile.calorieGoal,
    weightKg: profile.weightKg,
    diet: profile.diet,
    intolerances: profile.intolerances,
    mealsPerDay: profile.mealsPerDay,
  })
}

/** PATCH /api/nutrition/profile — update one or more profile fields */
export async function PATCH(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    calorieGoal?: number
    weightKg?: number | null
    diet?: string
    intolerances?: string
    mealsPerDay?: number
  }

  const VALID_DIETS = ['none', 'vegetarian', 'vegan', 'glutenFree', 'dairyFree']
  const VALID_MEALS_PER_DAY = [3, 4, 5, 6]

  if (body.calorieGoal != null && (typeof body.calorieGoal !== 'number' || body.calorieGoal < 1000 || body.calorieGoal > 10000)) {
    return NextResponse.json({ error: 'calorieGoal must be 1000–10000' }, { status: 400 })
  }
  if (body.diet != null && !VALID_DIETS.includes(body.diet)) {
    return NextResponse.json({ error: `diet must be one of: ${VALID_DIETS.join(', ')}` }, { status: 400 })
  }
  if (body.mealsPerDay != null && !VALID_MEALS_PER_DAY.includes(body.mealsPerDay)) {
    return NextResponse.json({ error: 'mealsPerDay must be 3, 4, 5, or 6' }, { status: 400 })
  }

  const profile = await prisma.nutritionProfile.upsert({
    where: { userId: session.userId },
    update: {
      ...(body.calorieGoal != null ? { calorieGoal: body.calorieGoal } : {}),
      ...(body.weightKg !== undefined ? { weightKg: body.weightKg } : {}),
      ...(body.diet != null ? { diet: body.diet } : {}),
      ...(body.intolerances != null ? { intolerances: body.intolerances } : {}),
      ...(body.mealsPerDay != null ? { mealsPerDay: body.mealsPerDay } : {}),
    },
    create: {
      userId: session.userId,
      calorieGoal: body.calorieGoal ?? 3000,
      weightKg: body.weightKg ?? null,
      diet: body.diet ?? 'none',
      intolerances: body.intolerances ?? '',
      mealsPerDay: body.mealsPerDay ?? 5,
    },
  })

  return NextResponse.json({
    id: profile.id,
    calorieGoal: profile.calorieGoal,
    weightKg: profile.weightKg,
    diet: profile.diet,
    intolerances: profile.intolerances,
    mealsPerDay: profile.mealsPerDay,
  })
}
```

- [ ] **Step 2: Build to verify**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/nutrition/profile/route.ts
git commit -m "feat: add GET/PATCH /api/nutrition/profile"
```

---

## Task 4: Meal plan APIs

**Files:**
- Create: `src/app/api/nutrition/plan/route.ts`
- Create: `src/app/api/nutrition/plan/regenerate/route.ts`

- [ ] **Step 1: Create the plan GET route**

Create `src/app/api/nutrition/plan/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { generateMealPlan, getWeekStart } from '@/lib/nutrition'
import { getNextRace } from '@/lib/races'
import { currentPhaseFromWeeks, weeksToRaceFromDate } from '@/lib/config'

export const dynamic = 'force-dynamic'

async function getOrGeneratePlan(userId: string) {
  const weekStart = getWeekStart()

  // Try to return a fresh cached plan (generated within last 7 days)
  const existing = await prisma.mealPlan.findUnique({
    where: { userId_weekStart: { userId, weekStart } },
  })

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  if (existing && existing.generatedAt > sevenDaysAgo) {
    return existing
  }

  // Fetch profile (auto-create defaults if missing)
  const profile = await prisma.nutritionProfile.upsert({
    where: { userId },
    update: {},
    create: { userId, calorieGoal: 3000, diet: 'none', intolerances: '', mealsPerDay: 5 },
  })

  // Determine current training phase from next race
  const nextRace = await getNextRace(userId)
  const phase = nextRace
    ? currentPhaseFromWeeks(weeksToRaceFromDate(nextRace.date))
    : 'Base'

  const content = await generateMealPlan(
    {
      calorieGoal: profile.calorieGoal,
      weightKg: profile.weightKg,
      diet: profile.diet,
      intolerances: profile.intolerances,
      mealsPerDay: profile.mealsPerDay,
    },
    phase,
  )

  const plan = await prisma.mealPlan.upsert({
    where: { userId_weekStart: { userId, weekStart } },
    update: { content: JSON.stringify(content), generatedAt: new Date() },
    create: { userId, weekStart, content: JSON.stringify(content) },
  })

  return plan
}

export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const plan = await getOrGeneratePlan(session.userId)
    return NextResponse.json({
      weekStart: plan.weekStart,
      generatedAt: plan.generatedAt,
      content: JSON.parse(plan.content),
    })
  } catch (err) {
    console.error('Failed to generate meal plan:', err)
    return NextResponse.json({ error: 'Failed to generate meal plan' }, { status: 500 })
  }
}
```

- [ ] **Step 2: Create the regenerate route**

Create `src/app/api/nutrition/plan/regenerate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { generateMealPlan, getWeekStart } from '@/lib/nutrition'
import { getNextRace } from '@/lib/races'
import { currentPhaseFromWeeks, weeksToRaceFromDate } from '@/lib/config'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const profile = await prisma.nutritionProfile.upsert({
      where: { userId: session.userId },
      update: {},
      create: { userId: session.userId, calorieGoal: 3000, diet: 'none', intolerances: '', mealsPerDay: 5 },
    })

    const nextRace = await getNextRace(session.userId)
    const phase = nextRace
      ? currentPhaseFromWeeks(weeksToRaceFromDate(nextRace.date))
      : 'Base'

    const content = await generateMealPlan(
      {
        calorieGoal: profile.calorieGoal,
        weightKg: profile.weightKg,
        diet: profile.diet,
        intolerances: profile.intolerances,
        mealsPerDay: profile.mealsPerDay,
      },
      phase,
    )

    const weekStart = getWeekStart()
    const plan = await prisma.mealPlan.upsert({
      where: { userId_weekStart: { userId: session.userId, weekStart } },
      update: { content: JSON.stringify(content), generatedAt: new Date() },
      create: { userId: session.userId, weekStart, content: JSON.stringify(content) },
    })

    return NextResponse.json({
      weekStart: plan.weekStart,
      generatedAt: plan.generatedAt,
      content: JSON.parse(plan.content),
    })
  } catch (err) {
    console.error('Failed to regenerate meal plan:', err)
    return NextResponse.json({ error: 'Failed to regenerate meal plan' }, { status: 500 })
  }
}
```

- [ ] **Step 3: Build to verify**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/nutrition/plan/route.ts src/app/api/nutrition/plan/regenerate/route.ts
git commit -m "feat: add GET /api/nutrition/plan and POST /api/nutrition/plan/regenerate"
```

---

## Task 5: Nutrition page, NutritionClient, and MealPlanTab

**Files:**
- Create: `src/app/nutrition/page.tsx`
- Create: `src/app/nutrition/NutritionClient.tsx`
- Create: `src/app/nutrition/MealPlanTab.tsx`

- [ ] **Step 1: Create the server page component**

Create `src/app/nutrition/page.tsx`:

```typescript
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { prisma } from '@/lib/db'
import NutritionClient from './NutritionClient'

export const dynamic = 'force-dynamic'

export default async function NutritionPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const profile = await prisma.nutritionProfile.upsert({
    where: { userId: session.userId },
    update: {},
    create: {
      userId: session.userId,
      calorieGoal: 3000,
      diet: 'none',
      intolerances: '',
      mealsPerDay: 5,
    },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Nutrition</h1>
      <NutritionClient
        initialProfile={{
          id: profile.id,
          calorieGoal: profile.calorieGoal,
          weightKg: profile.weightKg,
          diet: profile.diet,
          intolerances: profile.intolerances,
          mealsPerDay: profile.mealsPerDay,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Create NutritionClient tab manager**

Create `src/app/nutrition/NutritionClient.tsx`:

```typescript
'use client'
import { useState, useEffect } from 'react'
import MealPlanTab from './MealPlanTab'
import PreferencesTab from './PreferencesTab'
import type { MealPlanContent } from '@/lib/nutrition'

interface Profile {
  id: string
  calorieGoal: number
  weightKg: number | null
  diet: string
  intolerances: string
  mealsPerDay: number
}

interface PlanResponse {
  weekStart: string
  generatedAt: string
  content: MealPlanContent
}

type Tab = 'plan' | 'preferences'

export default function NutritionClient({ initialProfile }: { initialProfile: Profile }) {
  const [tab, setTab] = useState<Tab>('plan')
  const [profile, setProfile] = useState<Profile>(initialProfile)
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchPlan()
  }, [])

  async function fetchPlan() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/nutrition/plan')
      if (!res.ok) throw new Error('Failed to load plan')
      const data = await res.json() as PlanResponse
      setPlan(data)
    } catch {
      setError('Failed to load meal plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function regeneratePlan() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/nutrition/plan/regenerate', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to regenerate')
      const data = await res.json() as PlanResponse
      setPlan(data)
    } catch {
      setError('Failed to regenerate plan. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-800 pb-2">
        {(['plan', 'preferences'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-sm pb-2 border-b-2 -mb-[9px] capitalize ${
              tab === t ? 'border-orange-500 text-white' : 'border-transparent text-gray-400'
            }`}
          >
            {t === 'plan' ? 'This Week' : 'Preferences'}
          </button>
        ))}
      </div>

      {tab === 'plan' && (
        <MealPlanTab
          plan={plan}
          loading={loading}
          error={error}
          onRegenerate={regeneratePlan}
        />
      )}

      {tab === 'preferences' && (
        <PreferencesTab
          profile={profile}
          onProfileChange={setProfile}
          onRegenerate={regeneratePlan}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Create MealPlanTab**

Create `src/app/nutrition/MealPlanTab.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { SLOT_EMOJIS, SLOT_LABELS } from '@/lib/nutrition'
import type { MealPlanContent, Meal } from '@/lib/nutrition'

interface PlanResponse {
  weekStart: string
  generatedAt: string
  content: MealPlanContent
}

interface Props {
  plan: PlanResponse | null
  loading: boolean
  error: string
  onRegenerate: () => void
}

const PHASE_LABELS: Record<string, string> = {
  Peak: '🔥 Peak Phase · High Carb',
  'Race Week': '🏁 Race Week · Carb Load',
  Build: '💪 Build Phase · Balanced',
  Taper: '⬇️ Taper · Reduced Calories',
  Base: '🌱 Base Phase',
}

function MacroPill({ label, value, colour }: { label: string; value: number; colour: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colour}`}>
      {label} {value}g
    </span>
  )
}

function RecipeCard({ meal }: { meal: Meal }) {
  return (
    <a
      href={meal.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-0 bg-gray-900/60 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors"
    >
      {meal.image ? (
        <img
          src={meal.image}
          alt={meal.title}
          className="w-20 h-20 object-cover flex-shrink-0"
        />
      ) : (
        <div className="w-20 h-20 bg-gray-800 flex items-center justify-content-center flex-shrink-0 text-3xl flex items-center justify-center">
          {SLOT_EMOJIS[meal.slot] ?? '🍽️'}
        </div>
      )}
      <div className="px-3 py-2.5 flex flex-col justify-center gap-1 min-w-0">
        <p className="text-[10px] text-gray-500 uppercase tracking-wide">
          {SLOT_EMOJIS[meal.slot]} {SLOT_LABELS[meal.slot] ?? meal.slot}
        </p>
        <p className="text-sm font-medium text-white leading-tight line-clamp-2">{meal.title}</p>
        <div className="flex flex-wrap gap-1 mt-0.5">
          <span className="text-[10px] text-gray-400">{meal.calories} kcal</span>
          <MacroPill label="C" value={meal.carbsG} colour="bg-orange-500/20 text-orange-300" />
          <MacroPill label="P" value={meal.proteinG} colour="bg-blue-500/20 text-blue-300" />
          <MacroPill label="F" value={meal.fatG} colour="bg-gray-700 text-gray-400" />
        </div>
      </div>
    </a>
  )
}

export default function MealPlanTab({ plan, loading, error, onRegenerate }: Props) {
  const days = plan?.content.days ?? []
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const today = new Date().toISOString().split('T')[0]
  const activeDateStr = selectedDate ?? today
  const activeDay = days.find(d => d.date === activeDateStr) ?? days[0]

  if (loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 text-sm animate-pulse">
          Generating your meal plan… this takes ~15 seconds ⏳
        </p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-400 text-sm mb-4">{error}</p>
        <button
          onClick={onRegenerate}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (!plan) return null

  const phase = plan.content.phase

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-gray-500">{PHASE_LABELS[phase] ?? phase}</p>
          <p className="text-xs text-gray-600">
            Week of {new Date(plan.content.days[0]?.date ?? plan.weekStart).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
          </p>
        </div>
        <button
          onClick={onRegenerate}
          className="text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 px-3 py-1.5 rounded-lg"
        >
          ↺ Regenerate
        </button>
      </div>

      {/* Day picker */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map(day => {
          const d = new Date(day.date)
          const isActive = day.date === activeDateStr
          const isToday = day.date === today
          return (
            <button
              key={day.date}
              onClick={() => setSelectedDate(day.date)}
              className={`flex flex-col items-center px-3 py-1.5 rounded-xl text-xs flex-shrink-0 transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              <span className="font-medium">
                {d.toLocaleDateString('en-GB', { weekday: 'short' })}
              </span>
              <span className={isActive ? 'text-orange-100' : 'text-gray-600'}>
                {d.getDate()}
              </span>
              {isToday && !isActive && <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5" />}
            </button>
          )
        })}
      </div>

      {/* Recipe cards */}
      {activeDay ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 text-right">{activeDay.totalCalories} kcal total</p>
          {activeDay.meals.map((meal, i) => (
            <RecipeCard key={i} meal={meal} />
          ))}
          {activeDay.meals.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-8">No meals for this day.</p>
          )}
        </div>
      ) : (
        <p className="text-gray-500 text-sm text-center py-8">Select a day to view meals.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Build to verify**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add src/app/nutrition/page.tsx src/app/nutrition/NutritionClient.tsx src/app/nutrition/MealPlanTab.tsx
git commit -m "feat: add /nutrition page with meal plan tab"
```

---

## Task 6: PreferencesTab

**Files:**
- Create: `src/app/nutrition/PreferencesTab.tsx`

- [ ] **Step 1: Create PreferencesTab**

Create `src/app/nutrition/PreferencesTab.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { estimateCalories } from '@/lib/nutrition'

interface Profile {
  id: string
  calorieGoal: number
  weightKg: number | null
  diet: string
  intolerances: string
  mealsPerDay: number
}

interface Props {
  profile: Profile
  onProfileChange: (p: Profile) => void
  onRegenerate: () => void
}

const DIETS = [
  { value: 'none', label: 'None' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'glutenFree', label: 'Gluten-free' },
  { value: 'dairyFree', label: 'Dairy-free' },
]

const ALLERGENS = [
  { value: 'nuts', label: 'Nuts' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'soy', label: 'Soy' },
]

const MEALS_PER_DAY = [3, 4, 5, 6]

async function patchProfile(body: Record<string, unknown>) {
  await fetch('/api/nutrition/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export default function PreferencesTab({ profile, onProfileChange, onRegenerate }: Props) {
  const [weightInput, setWeightInput] = useState(profile.weightKg ? String(profile.weightKg) : '')
  const [calorieInput, setCalorieInput] = useState(String(profile.calorieGoal))
  const [saved, setSaved] = useState(false)

  const selectedIntolerances = profile.intolerances
    ? profile.intolerances.split(',').filter(Boolean)
    : []

  const estimated = profile.weightKg
    ? estimateCalories(profile.weightKg, 'Build')
    : null

  async function handleWeightBlur() {
    const kg = parseFloat(weightInput)
    if (isNaN(kg) || kg < 30 || kg > 200) return
    const updated = { ...profile, weightKg: kg }
    onProfileChange(updated)
    await patchProfile({ weightKg: kg })
  }

  async function handleCalorieBlur() {
    const kcal = parseInt(calorieInput, 10)
    if (isNaN(kcal) || kcal < 1000 || kcal > 10000) return
    const updated = { ...profile, calorieGoal: kcal }
    onProfileChange(updated)
    await patchProfile({ calorieGoal: kcal })
  }

  async function handleDietChange(diet: string) {
    const updated = { ...profile, diet }
    onProfileChange(updated)
    await patchProfile({ diet })
  }

  async function handleIntoleranceToggle(value: string) {
    const current = selectedIntolerances
    const next = current.includes(value)
      ? current.filter(i => i !== value)
      : [...current, value]
    const intolerances = next.join(',')
    const updated = { ...profile, intolerances }
    onProfileChange(updated)
    await patchProfile({ intolerances })
  }

  async function handleMealsPerDayChange(n: number) {
    const updated = { ...profile, mealsPerDay: n }
    onProfileChange(updated)
    await patchProfile({ mealsPerDay: n })
  }

  async function handleSaveAndRegenerate() {
    setSaved(true)
    await onRegenerate()
    setTimeout(() => setSaved(false), 2000)
  }

  const pill = (active: boolean) =>
    `px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
      active
        ? 'bg-orange-500/20 border-orange-500 text-orange-300'
        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500'
    }`

  return (
    <div className="space-y-4">
      {/* Calorie goal */}
      <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
        <h3 className="text-sm font-semibold">Calorie Goal</h3>

        <div>
          <label className="text-xs text-gray-400 block mb-1">Your weight (kg)</label>
          <input
            type="number"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            onBlur={handleWeightBlur}
            placeholder="e.g. 75"
            min={30}
            max={200}
            className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
          />
        </div>

        {estimated && (
          <p className="text-xs text-gray-500">
            Estimated for Build phase:{' '}
            <span className="text-orange-400 font-medium">{estimated.toLocaleString()} kcal/day</span>
          </p>
        )}

        <div>
          <label className="text-xs text-gray-400 block mb-1">Daily calorie goal (kcal)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={calorieInput}
              onChange={e => setCalorieInput(e.target.value)}
              onBlur={handleCalorieBlur}
              min={1000}
              max={10000}
              className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
            />
            <span className="text-xs text-gray-500">kcal/day</span>
          </div>
        </div>
      </div>

      {/* Diet */}
      <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-semibold">Diet</h3>
        <div className="flex flex-wrap gap-2">
          {DIETS.map(d => (
            <button
              key={d.value}
              onClick={() => handleDietChange(d.value)}
              className={pill(profile.diet === d.value)}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergens */}
      <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-semibold">Allergens to Avoid</h3>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map(a => (
            <button
              key={a.value}
              onClick={() => handleIntoleranceToggle(a.value)}
              className={pill(selectedIntolerances.includes(a.value))}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meals per day */}
      <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 space-y-2">
        <h3 className="text-sm font-semibold">Meals Per Day</h3>
        <div className="flex gap-2">
          {MEALS_PER_DAY.map(n => (
            <button
              key={n}
              onClick={() => handleMealsPerDayChange(n)}
              className={pill(profile.mealsPerDay === n)}
            >
              {n}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-600">
          {profile.mealsPerDay === 3 && 'Breakfast · Lunch · Dinner'}
          {profile.mealsPerDay === 4 && 'Breakfast · Lunch · Afternoon Snack · Dinner'}
          {profile.mealsPerDay === 5 && 'Breakfast · Morning Snack · Lunch · Afternoon Snack · Dinner'}
          {profile.mealsPerDay === 6 && 'Breakfast · Morning Snack · Lunch · Afternoon Snack · Dinner · Evening Snack'}
        </p>
      </div>

      <button
        onClick={handleSaveAndRegenerate}
        className="w-full py-2.5 bg-orange-500 text-white rounded-xl font-medium hover:bg-orange-600 transition-colors text-sm"
      >
        {saved ? '✓ Generating new plan…' : 'Save & Regenerate Plan'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/app/nutrition/PreferencesTab.tsx
git commit -m "feat: add nutrition PreferencesTab with diet, allergens, and calorie goal"
```

---

## Task 7: NutritionWidget for dashboard

**Files:**
- Create: `src/components/NutritionWidget.tsx`

- [ ] **Step 1: Create NutritionWidget**

Create `src/components/NutritionWidget.tsx`:

```typescript
'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCurrentMealSlot, MEAL_SLOTS, SLOT_EMOJIS, SLOT_LABELS } from '@/lib/nutrition'
import type { MealPlanContent } from '@/lib/nutrition'

interface PlanResponse {
  weekStart: string
  generatedAt: string
  content: MealPlanContent
}

const PHASE_BADGE: Record<string, string> = {
  Peak: '🔥 Peak · High Carb',
  'Race Week': '🏁 Race Week',
  Build: '💪 Build',
  Taper: '⬇️ Taper',
  Base: '🌱 Base',
}

export default function NutritionWidget() {
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/nutrition/plan')
      .then(r => r.ok ? r.json() : null)
      .then((data: PlanResponse | null) => setPlan(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4">
        <p className="text-sm text-gray-500 animate-pulse">🥗 Loading nutrition plan…</p>
      </div>
    )
  }

  if (!plan) return null

  const today = new Date().toISOString().split('T')[0]
  const todayPlan = plan.content.days.find(d => d.date === today)
  if (!todayPlan) return null

  const slots = todayPlan.meals.map(m => m.slot)
  const currentSlot = getCurrentMealSlot(slots)
  const totalPlanned = todayPlan.totalCalories
  const calorieGoal = plan.content.calorieGoal
  const progressPct = Math.min(100, Math.round((totalPlanned / calorieGoal) * 100))
  const phase = plan.content.phase

  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">🥗 Today&apos;s Nutrition</span>
        {phase && (
          <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 px-2 py-0.5 rounded-full">
            {PHASE_BADGE[phase] ?? phase}
          </span>
        )}
      </div>

      {/* Calorie progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Planned calories</span>
          <span>{totalPlanned.toLocaleString()} / {calorieGoal.toLocaleString()} kcal</span>
        </div>
        <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Meal list */}
      <div className="space-y-1.5">
        {todayPlan.meals.map((meal, i) => {
          const isPast = slots.indexOf(meal.slot) < slots.indexOf(currentSlot)
          const isCurrent = meal.slot === currentSlot
          return (
            <div
              key={i}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-colors ${
                isCurrent
                  ? 'bg-orange-500/10 border border-orange-500/30'
                  : 'bg-gray-800/50'
              } ${isPast ? 'opacity-60' : ''}`}
            >
              <span className="text-base">{SLOT_EMOJIS[meal.slot] ?? '🍽️'}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium truncate ${isCurrent ? 'text-orange-300' : 'text-gray-300'}`}>
                  {meal.title}
                </p>
                <p className="text-[10px] text-gray-600">
                  {SLOT_LABELS[meal.slot]} · {meal.calories} kcal
                </p>
              </div>
              {isPast && <span className="text-green-500 text-xs flex-shrink-0">✓</span>}
              {isCurrent && <span className="text-orange-400 text-[10px] flex-shrink-0">Next</span>}
            </div>
          )
        })}
      </div>

      <Link
        href="/nutrition"
        className="block text-center text-xs text-orange-400 hover:text-orange-300 pt-1"
      >
        View full meal plan →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Build to verify**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add src/components/NutritionWidget.tsx
git commit -m "feat: add NutritionWidget dashboard component"
```

---

## Task 8: Wire up dashboard and nav

**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/components/Nav.tsx`

- [ ] **Step 1: Add NutritionWidget to the dashboard**

Open `src/app/page.tsx`. Find the import block at the top and add:

```typescript
import NutritionWidget from '@/components/NutritionWidget'
```

Then find where `<WellnessWidget ... />` is rendered in the JSX. Add `<NutritionWidget />` directly after it:

```tsx
<WellnessWidget todayLog={...} showWarning={...} />
<NutritionWidget />
```

The exact surrounding JSX will look like:

```tsx
        <WellnessWidget
          todayLog={wellnessData.todayLog ? {
            sleepHours: wellnessData.todayLog.sleepHours,
            soreness: wellnessData.todayLog.soreness,
            energy: wellnessData.todayLog.energy,
            score: wellnessData.todayLog.score,
          } : null}
          showWarning={wellnessData.showWarning}
        />
        <NutritionWidget />
```

- [ ] **Step 2: Add Nutrition link to Nav**

Open `src/components/Nav.tsx`. Find the `BASE_LINKS` array:

```typescript
const BASE_LINKS = [
  { href: '/', label: 'Dashboard', icon: <HomeIcon /> },
  { href: '/sessions', label: 'Sessions', icon: <ListIcon /> },
  { href: '/races', label: 'Races', icon: <FlagIcon /> },
  { href: '/plan', label: 'Plan', icon: <CalendarIcon /> },
  { href: '/progress', label: 'Progress', icon: <ChartIcon /> },
```

Add the Nutrition link. First add a NutritionIcon SVG component near the other icon components (before `const BASE_LINKS`):

```typescript
const NutritionIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2a10 10 0 1 0 10 10"/>
    <path d="M12 6v6l4 2"/>
    <path d="M20 2v6h-6"/>
  </svg>
)
```

Then add to BASE_LINKS after the Progress entry:

```typescript
  { href: '/nutrition', label: 'Nutrition', icon: <NutritionIcon /> },
```

- [ ] **Step 3: Build to verify**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```

Expected: `✓ Compiled successfully`

- [ ] **Step 4: Run all tests**

```bash
PATH="/Users/arranbrough/node22/dist/bin:$PATH" npx vitest run 2>&1 | tail -15
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/Nav.tsx
git commit -m "feat: wire up NutritionWidget to dashboard and add Nutrition nav link"
```

---

## Done

All 8 tasks complete. The nutrition feature is live:

- `/nutrition` — weekly meal plan (day picker + recipe cards with macros) and preferences (calorie goal, diet, allergens, meals per day)
- Dashboard — NutritionWidget shows today's meals with calorie progress bar
- Nav — Nutrition link in hamburger drawer (mobile) and top nav (desktop)
- Plan generation — Claude structures the week, Spoonacular resolves real recipes, stored in DB to avoid repeated API calls
