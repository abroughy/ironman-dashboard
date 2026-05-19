# Recipe Detail, Meal Swap & Favourites Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a slide-up recipe drawer with Claude-generated instructions, per-meal swap (3 alternatives), and heart-favouriting that persists liked meals and influences future plan generation.

**Architecture:** On-demand lazy loading — recipe content and swap options are fetched only when requested, keeping plan generation time unchanged. Favourites are stored in a new `FavouriteMeal` DB table, fetched on page load alongside the plan, and injected into the Claude prompt at generation time. All new state lives in `NutritionClient` and is passed down as props.

**Tech Stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma + Neon PostgreSQL, Anthropic `claude-sonnet-4-5`, Vitest

---

## File Map

**Create:**
- `src/app/nutrition/RecipeDrawer.tsx` — slide-up drawer: recipe view + swap view
- `src/app/api/nutrition/recipe/route.ts` — GET: Claude generates recipe detail
- `src/app/api/nutrition/plan/swap/route.ts` — POST: Claude returns 3 swap alternatives
- `src/app/api/nutrition/plan/meal/route.ts` — PUT: persists chosen swap to DB
- `src/app/api/nutrition/favourites/route.ts` — GET + POST favourites
- `src/app/api/nutrition/favourites/[id]/route.ts` — DELETE favourite

**Modify:**
- `prisma/schema.prisma` — add `FavouriteMeal` model + `favouriteMeals` relation on `User`
- `src/types/nutrition.ts` — add `RecipeDetail`, `FavouriteMeal`, `SwapOption` interfaces
- `src/lib/nutrition.ts` — add `buildFavouriteNote` helper; add `favourites` param to `generateMealPlan`
- `src/app/api/nutrition/plan/route.ts` — fetch favourites, pass to `generateMealPlan`
- `src/app/api/nutrition/plan/regenerate/route.ts` — fetch favourites, pass to `generateMealPlan`
- `src/app/nutrition/MealPlanTab.tsx` — cards → tappable buttons, add ♥ + ⇄ icon buttons, new props
- `src/app/nutrition/NutritionClient.tsx` — add drawer state, favourites state, all handlers
- `src/app/nutrition/PreferencesTab.tsx` — add favourites section above calorie card, new props

**Test:**
- `__tests__/lib/nutrition.test.ts` — add tests for `buildFavouriteNote`

---

## Task 1: DB Schema — FavouriteMeal model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `FavouriteMeal` model and `favouriteMeals` relation to `prisma/schema.prisma`**

  In `prisma/schema.prisma`, add this model at the end of the file:

  ```prisma
  model FavouriteMeal {
    id        Int      @id @default(autoincrement())
    userId    String
    title     String
    slot      String
    calories  Int
    proteinG  Int
    carbsG    Int
    fatG      Int
    createdAt DateTime @default(now())

    user User @relation(fields: [userId], references: [id], onDelete: Cascade)

    @@unique([userId, title])
    @@index([userId])
  }
  ```

  Also add `favouriteMeals FavouriteMeal[]` to the `User` model (after the `mealPlans MealPlan[]` line):

  ```prisma
  model User {
    // ... existing fields ...
    mealPlans         MealPlan[]
    favouriteMeals    FavouriteMeal[]   // add this line
  }
  ```

- [ ] **Step 2: Push schema to DB and regenerate client**

  ```bash
  cd /Users/arranbrough/ironman-dashboard
  npx prisma db push
  npx prisma generate
  ```

  Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Verify Prisma client recognises the new model**

  ```bash
  node -e "const { PrismaClient } = require('@prisma/client'); const p = new PrismaClient(); console.log(typeof p.favouriteMeal.findMany)"
  ```

  Expected: `function`

- [ ] **Step 4: Commit**

  ```bash
  git add prisma/schema.prisma
  git commit -m "feat: add FavouriteMeal schema model"
  ```

---

## Task 2: New Type Definitions

**Files:**
- Modify: `src/types/nutrition.ts`

- [ ] **Step 1: Add three new interfaces to `src/types/nutrition.ts`** (append after the existing `SLOT_LABELS` constant)

  ```typescript
  export interface RecipeDetail {
    title: string
    ingredients: string[]
    steps: string[]
  }

  export interface FavouriteMeal {
    id: number
    title: string
    slot: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }

  export interface SwapOption {
    title: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  cd /Users/arranbrough/ironman-dashboard
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no errors (or same pre-existing errors as before).

- [ ] **Step 3: Commit**

  ```bash
  git add src/types/nutrition.ts
  git commit -m "feat: add RecipeDetail, FavouriteMeal, SwapOption types"
  ```

---

## Task 3: Favourites API Routes

**Files:**
- Create: `src/app/api/nutrition/favourites/route.ts`
- Create: `src/app/api/nutrition/favourites/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/nutrition/favourites/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { prisma } from '@/lib/db'
  import { getSessionFromRequest } from '@/lib/auth'

  export const dynamic = 'force-dynamic'

  export async function GET(request: NextRequest) {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const favourites = await prisma.favouriteMeal.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json(favourites)
  }

  export async function POST(request: NextRequest) {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { title, slot, calories, proteinG, carbsG, fatG } = body as {
      title: string; slot: string; calories: number
      proteinG: number; carbsG: number; fatG: number
    }

    if (!title || !slot) {
      return NextResponse.json({ error: 'title and slot are required' }, { status: 400 })
    }

    const favourite = await prisma.favouriteMeal.upsert({
      where: { userId_title: { userId: session.userId, title } },
      update: { slot, calories, proteinG, carbsG, fatG },
      create: { userId: session.userId, title, slot, calories, proteinG, carbsG, fatG },
    })
    return NextResponse.json(favourite)
  }
  ```

- [ ] **Step 2: Create `src/app/api/nutrition/favourites/[id]/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { prisma } from '@/lib/db'
  import { getSessionFromRequest } from '@/lib/auth'

  export const dynamic = 'force-dynamic'

  export async function DELETE(
    request: NextRequest,
    { params }: { params: { id: string } },
  ) {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const id = parseInt(params.id, 10)
    if (isNaN(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

    const existing = await prisma.favouriteMeal.findUnique({ where: { id } })
    if (!existing || existing.userId !== session.userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await prisma.favouriteMeal.delete({ where: { id } })
    return NextResponse.json({ success: true })
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

  Expected: no new errors.

- [ ] **Step 4: Smoke-test with the dev server**

  Start the dev server in one terminal: `npm run dev`

  In another terminal (replace `<YOUR_SESSION_COOKIE>` with the value from browser DevTools → Application → Cookies → `session`):

  ```bash
  # GET — should return []
  curl -s -H "Cookie: session=<YOUR_SESSION_COOKIE>" http://localhost:3000/api/nutrition/favourites

  # POST — should return saved object with id
  curl -s -X POST -H "Content-Type: application/json" -H "Cookie: session=<YOUR_SESSION_COOKIE>" \
    -d '{"title":"Test Meal","slot":"breakfast","calories":400,"proteinG":30,"carbsG":45,"fatG":12}' \
    http://localhost:3000/api/nutrition/favourites

  # GET again — should return the saved object
  curl -s -H "Cookie: session=<YOUR_SESSION_COOKIE>" http://localhost:3000/api/nutrition/favourites
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/nutrition/favourites/
  git commit -m "feat: add favourites GET, POST, DELETE API routes"
  ```

---

## Task 4: Recipe Fetch API

**Files:**
- Create: `src/app/api/nutrition/recipe/route.ts`

- [ ] **Step 1: Create `src/app/api/nutrition/recipe/route.ts`**

  ```typescript
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
        model: 'claude-sonnet-4-5',
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
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 3: Smoke-test**

  ```bash
  curl -s -G "http://localhost:3000/api/nutrition/recipe" \
    -H "Cookie: session=<YOUR_SESSION_COOKIE>" \
    --data-urlencode "title=Grilled Salmon with Quinoa" \
    --data-urlencode "slot=dinner" \
    --data-urlencode "calories=650" \
    --data-urlencode "phase=Build"
  ```

  Expected: JSON with `ingredients` array and `steps` array.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/api/nutrition/recipe/route.ts
  git commit -m "feat: add on-demand recipe fetch API route"
  ```

---

## Task 5: Swap API Routes

**Files:**
- Create: `src/app/api/nutrition/plan/swap/route.ts`
- Create: `src/app/api/nutrition/plan/meal/route.ts`

- [ ] **Step 1: Create `src/app/api/nutrition/plan/swap/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { prisma } from '@/lib/db'
  import { getSessionFromRequest } from '@/lib/auth'
  import { config } from '@/lib/config'
  import { getNextRace } from '@/lib/races'
  import { currentPhaseFromWeeks, weeksToRaceFromDate } from '@/lib/config'
  import Anthropic from '@anthropic-ai/sdk'

  export const dynamic = 'force-dynamic'
  export const maxDuration = 30

  const SLOT_CALORIE_PCT: Record<string, number> = {
    breakfast: 0.25,
    morningSnack: 0.09,
    lunch: 0.30,
    afternoonSnack: 0.09,
    dinner: 0.30,
    eveningSnack: 0.07,
  }

  export async function POST(request: NextRequest) {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { slot, currentTitle } = body as { slot: string; currentTitle: string }

    if (!slot || !currentTitle) {
      return NextResponse.json({ error: 'slot and currentTitle are required' }, { status: 400 })
    }

    const profile = await prisma.nutritionProfile.findUnique({ where: { userId: session.userId } })
    const calorieGoal = profile?.calorieGoal ?? 3000
    const diet = profile?.diet ?? 'none'
    const intolerances = profile?.intolerances ?? ''

    const nextRace = await getNextRace(session.userId)
    const phase = nextRace ? currentPhaseFromWeeks(weeksToRaceFromDate(nextRace.date)) : 'Base'

    const slotCalories = Math.round(calorieGoal * (SLOT_CALORIE_PCT[slot] ?? 0.20))

    const phaseGuidance: Record<string, string> = {
      Peak: 'high carb (60% carbs)',
      'Race Week': 'carb-loading (65% carbs)',
      Build: 'balanced (50% carbs, 30% protein)',
      Taper: 'reduced calories (50% carbs, 30% protein)',
    }
    const guidance = phaseGuidance[phase] ?? 'balanced'
    const dietNote = diet !== 'none' ? ` Diet: ${diet}.` : ''
    const intoleranceNote = intolerances ? ` Avoid intolerances: ${intolerances}.` : ''

    const prompt = `Suggest 3 alternative ${slot} meals for a triathlete in ${phase} phase (${guidance}), ~${slotCalories} kcal each.
  Avoid: ${currentTitle}.${dietNote}${intoleranceNote}
  Specific recipe names (not generic). Output ONLY 3 CSV rows, no header, no markdown:
  title,cal,pro,carb,fat`

    try {
      const client = new Anthropic({ apiKey: config.anthropicApiKey })
      const message = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      })

      const text = message.content[0].type === 'text' ? message.content[0].text.trim() : ''
      const options = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map(line => {
          const [title, cal, pro, carb, fat] = line.split(',')
          return {
            title: (title ?? '').trim(),
            calories: Math.round(Number(cal) || 0),
            proteinG: Math.round(Number(pro) || 0),
            carbsG: Math.round(Number(carb) || 0),
            fatG: Math.round(Number(fat) || 0),
          }
        })
        .filter(o => o.title.length > 0)

      return NextResponse.json({ options })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('Swap generation failed:', msg)
      return NextResponse.json({ error: 'Failed to generate alternatives' }, { status: 500 })
    }
  }
  ```

- [ ] **Step 2: Create `src/app/api/nutrition/plan/meal/route.ts`**

  ```typescript
  import { NextRequest, NextResponse } from 'next/server'
  import { prisma } from '@/lib/db'
  import { getSessionFromRequest } from '@/lib/auth'
  import { getWeekStart } from '@/lib/nutrition'
  import type { MealPlanContent, Meal } from '@/lib/nutrition'

  export const dynamic = 'force-dynamic'

  export async function PUT(request: NextRequest) {
    const session = await getSessionFromRequest(request)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await request.json()
    const { date, slot, meal } = body as {
      date: string
      slot: string
      meal: { title: string; calories: number; proteinG: number; carbsG: number; fatG: number }
    }

    if (!date || !slot || !meal?.title) {
      return NextResponse.json({ error: 'date, slot, and meal are required' }, { status: 400 })
    }

    const weekStart = getWeekStart()
    const existing = await prisma.mealPlan.findUnique({
      where: { userId_weekStart: { userId: session.userId, weekStart } },
    })
    if (!existing) {
      return NextResponse.json({ error: 'No plan found for this week' }, { status: 404 })
    }

    const content: MealPlanContent = JSON.parse(existing.content)

    const dayIndex = content.days.findIndex(d => d.date === date)
    if (dayIndex === -1) return NextResponse.json({ error: 'Day not found in plan' }, { status: 404 })

    const mealIndex = content.days[dayIndex].meals.findIndex(m => m.slot === slot)
    if (mealIndex === -1) return NextResponse.json({ error: 'Slot not found in day' }, { status: 404 })

    const maxId = content.days
      .flatMap(d => d.meals)
      .reduce((max, m) => Math.max(max, m.recipeId), 0)

    const newMeal: Meal = {
      slot,
      recipeId: maxId + 1,
      title: meal.title,
      image: '',
      sourceUrl: `https://www.google.com/search?q=${encodeURIComponent(meal.title)}+recipe`,
      calories: meal.calories,
      proteinG: meal.proteinG,
      carbsG: meal.carbsG,
      fatG: meal.fatG,
    }

    content.days[dayIndex].meals[mealIndex] = newMeal
    content.days[dayIndex].totalCalories = content.days[dayIndex].meals
      .reduce((sum, m) => sum + m.calories, 0)

    await prisma.mealPlan.update({
      where: { userId_weekStart: { userId: session.userId, weekStart } },
      data: { content: JSON.stringify(content) },
    })

    return NextResponse.json({ success: true, meal: newMeal })
  }
  ```

- [ ] **Step 3: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 4: Smoke-test swap route**

  ```bash
  curl -s -X POST -H "Content-Type: application/json" \
    -H "Cookie: session=<YOUR_SESSION_COOKIE>" \
    -d '{"slot":"lunch","currentTitle":"Chicken Caesar Salad"}' \
    http://localhost:3000/api/nutrition/plan/swap
  ```

  Expected: `{"options":[{"title":"...","calories":...},{"title":"..."},{"title":"..."}]}`

- [ ] **Step 5: Commit**

  ```bash
  git add src/app/api/nutrition/plan/swap/route.ts src/app/api/nutrition/plan/meal/route.ts
  git commit -m "feat: add meal swap and meal update API routes"
  ```

---

## Task 6: Update generateMealPlan + Plan Routes

**Files:**
- Modify: `src/lib/nutrition.ts`
- Modify: `src/app/api/nutrition/plan/route.ts`
- Modify: `src/app/api/nutrition/plan/regenerate/route.ts`
- Test: `__tests__/lib/nutrition.test.ts`

- [ ] **Step 1: Write failing tests for `buildFavouriteNote` in `__tests__/lib/nutrition.test.ts`**

  Append this describe block to the existing test file:

  ```typescript
  import {
    // existing imports...
    buildFavouriteNote,
  } from '@/lib/nutrition'

  describe('buildFavouriteNote', () => {
    it('returns empty string for empty favourites', () => {
      expect(buildFavouriteNote([])).toBe('')
    })

    it('includes favourite titles in the note', () => {
      const note = buildFavouriteNote(['Chicken Tikka Masala', 'Salmon Pasta'])
      expect(note).toContain('Chicken Tikka Masala')
      expect(note).toContain('Salmon Pasta')
    })

    it('limits to 10 favourites even when given more', () => {
      const many = Array.from({ length: 15 }, (_, i) => `Meal ${i}`)
      const note = buildFavouriteNote(many)
      expect(note).toContain('Meal 9')
      expect(note).not.toContain('Meal 10')
    })
  })
  ```

- [ ] **Step 2: Run tests to confirm they fail**

  ```bash
  npm test 2>&1 | tail -20
  ```

  Expected: `buildFavouriteNote is not a function` or similar.

- [ ] **Step 3: Export `buildFavouriteNote` from `src/lib/nutrition.ts`**

  Add this function just before the `generateMealPlan` function (around line 128):

  ```typescript
  /** Exported for testing. Builds the favourites clause appended to the meal plan prompt. */
  export function buildFavouriteNote(favourites: string[]): string {
    if (favourites.length === 0) return ''
    return `\nFavourites to include or draw inspiration from: ${favourites.slice(0, 10).join(', ')}.`
  }
  ```

- [ ] **Step 4: Update `generateMealPlan` signature and prompt in `src/lib/nutrition.ts`**

  Change the function signature from:
  ```typescript
  export async function generateMealPlan(
    profile: NutritionProfileData,
    phase: string,
  ): Promise<MealPlanContent> {
  ```
  To:
  ```typescript
  export async function generateMealPlan(
    profile: NutritionProfileData,
    phase: string,
    favourites: string[] = [],
  ): Promise<MealPlanContent> {
  ```

  Then inside the function, replace the `const prompt = ` line with:

  ```typescript
  const favouriteNote = buildFavouriteNote(favourites)

  const prompt = `Triathlete meal plan. Phase: ${phase} — ${guidance}. ${profile.calorieGoal} kcal/day.${dietNote}${intoleranceNote}${favouriteNote}
  Slots per day: ${slots.join(', ')}. Calories: breakfast 25%, snacks 8-10%, lunch 30%, dinner 30%.
  Vary meals daily. Specific recipe names (not generic).

  Output ONLY ${totalMeals} CSV rows, no header, no markdown:
  date,slot,id,title,cal,pro,carb,fat

  Dates: ${weekDates.join(', ')}`
  ```

- [ ] **Step 5: Run tests to confirm they pass**

  ```bash
  npm test 2>&1 | tail -20
  ```

  Expected: all tests pass including the 3 new `buildFavouriteNote` tests.

- [ ] **Step 6: Update `src/app/api/nutrition/plan/route.ts` to fetch favourites and pass them**

  Inside `getOrGeneratePlan`, after the profile upsert and before calling `generateMealPlan`, add:

  ```typescript
  const favRecords = await prisma.favouriteMeal.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { title: true },
  })
  const favouriteTitles = favRecords.map(f => f.title)
  ```

  Then update the `generateMealPlan` call to pass `favouriteTitles`:

  ```typescript
  const content = await generateMealPlan(
    {
      calorieGoal: profile.calorieGoal,
      weightKg: profile.weightKg,
      diet: profile.diet,
      intolerances: profile.intolerances,
      mealsPerDay: profile.mealsPerDay,
    },
    phase,
    favouriteTitles,   // ← add this
  )
  ```

- [ ] **Step 7: Update `src/app/api/nutrition/plan/regenerate/route.ts` the same way**

  After the profile upsert and before `generateMealPlan`, add:

  ```typescript
  const favRecords = await prisma.favouriteMeal.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { title: true },
  })
  const favouriteTitles = favRecords.map(f => f.title)
  ```

  Then update the `generateMealPlan` call:

  ```typescript
  const content = await generateMealPlan(
    {
      calorieGoal: profile.calorieGoal,
      weightKg: profile.weightKg,
      diet: profile.diet,
      intolerances: profile.intolerances,
      mealsPerDay: profile.mealsPerDay,
    },
    phase,
    favouriteTitles,   // ← add this
  )
  ```

- [ ] **Step 8: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add src/lib/nutrition.ts src/app/api/nutrition/plan/route.ts src/app/api/nutrition/plan/regenerate/route.ts __tests__/lib/nutrition.test.ts
  git commit -m "feat: inject favourites into meal plan generation prompt"
  ```

---

## Task 7: RecipeDrawer Component

**Files:**
- Create: `src/app/nutrition/RecipeDrawer.tsx`

- [ ] **Step 1: Create `src/app/nutrition/RecipeDrawer.tsx`**

  ```typescript
  'use client'
  import { useState, useEffect } from 'react'
  import { Meal, RecipeDetail, SwapOption, SLOT_EMOJIS, SLOT_LABELS } from '@/types/nutrition'

  interface Props {
    meal: Meal | null
    date: string | null
    phase: string
    initialView?: 'recipe' | 'swap'
    favouriteTitles: Set<string>
    onClose: () => void
    onToggleFavourite: (meal: Meal) => void
    onMealSwapped: (date: string, slot: string, newMeal: Meal) => void
  }

  function MacroPill({ label, value, colour }: { label: string; value: number; colour: string }) {
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${colour}`}>
        {label} {value}g
      </span>
    )
  }

  export default function RecipeDrawer({
    meal,
    date,
    phase,
    initialView = 'recipe',
    favouriteTitles,
    onClose,
    onToggleFavourite,
    onMealSwapped,
  }: Props) {
    const [view, setView] = useState<'recipe' | 'swap'>(initialView)
    const [recipe, setRecipe] = useState<RecipeDetail | null>(null)
    const [recipeLoading, setRecipeLoading] = useState(false)
    const [recipeError, setRecipeError] = useState<string | null>(null)
    const [swapOptions, setSwapOptions] = useState<SwapOption[]>([])
    const [swapFetched, setSwapFetched] = useState(false)
    const [swapLoading, setSwapLoading] = useState(false)
    const [swapError, setSwapError] = useState<string | null>(null)
    const [persistError, setPersistError] = useState<string | null>(null)
    const [selecting, setSelecting] = useState(false)

    // Reset all state when the meal changes (new card tapped)
    useEffect(() => {
      if (meal) {
        setView(initialView)
        setRecipe(null)
        setRecipeError(null)
        setSwapOptions([])
        setSwapFetched(false)
        setSwapError(null)
        setPersistError(null)
        setSelecting(false)
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meal?.recipeId, initialView])

    // Fetch recipe when in recipe view and not yet loaded
    useEffect(() => {
      if (!meal || view !== 'recipe' || recipe || recipeLoading) return
      setRecipeLoading(true)
      setRecipeError(null)
      fetch(
        `/api/nutrition/recipe?title=${encodeURIComponent(meal.title)}&slot=${meal.slot}&calories=${meal.calories}&phase=${phase}`,
      )
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error)
          setRecipe(data as RecipeDetail)
        })
        .catch(() => setRecipeError('Could not load recipe.'))
        .finally(() => setRecipeLoading(false))
    }, [meal, view, recipe, recipeLoading, phase])

    // Fetch swap options when in swap view and not yet fetched
    useEffect(() => {
      if (!meal || view !== 'swap' || swapFetched || swapLoading) return
      setSwapLoading(true)
      setSwapError(null)
      fetch('/api/nutrition/plan/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, slot: meal.slot, currentTitle: meal.title }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error)
          setSwapOptions(data.options ?? [])
          setSwapFetched(true)
        })
        .catch(() => setSwapError('Could not load alternatives.'))
        .finally(() => setSwapLoading(false))
    }, [meal, view, swapFetched, swapLoading, date])

    async function handleSelectSwap(option: SwapOption) {
      if (!meal || !date || selecting) return
      setSelecting(true)
      setPersistError(null)
      try {
        const res = await fetch('/api/nutrition/plan/meal', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, slot: meal.slot, meal: option }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Failed to save')
        onMealSwapped(date, meal.slot, data.meal as Meal)
        onClose()
      } catch (e) {
        setPersistError(e instanceof Error ? e.message : 'Failed to save swap')
      } finally {
        setSelecting(false)
      }
    }

    if (!meal) return null

    const isFav = favouriteTitles.has(meal.title)

    return (
      <>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} />

        {/* Drawer */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#111] rounded-t-2xl max-h-[82vh] flex flex-col">
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-10 h-1 rounded-full bg-gray-700" />
          </div>

          {/* Header */}
          <div className="flex items-start justify-between px-4 pt-2 pb-3 border-b border-white/5">
            <div className="flex-1 min-w-0 pr-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                {SLOT_EMOJIS[meal.slot]} {SLOT_LABELS[meal.slot] ?? meal.slot}
              </p>
              <p className="text-base font-semibold text-white leading-snug">{meal.title}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                <span className="text-[10px] text-gray-400">{meal.calories} kcal</span>
                <MacroPill label="C" value={meal.carbsG} colour="bg-orange-500/20 text-orange-300" />
                <MacroPill label="P" value={meal.proteinG} colour="bg-blue-500/20 text-blue-300" />
                <MacroPill label="F" value={meal.fatG} colour="bg-gray-700 text-gray-400" />
              </div>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none mt-0.5">
              ✕
            </button>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {/* ── Recipe view ── */}
            {view === 'recipe' && (
              <>
                {recipeLoading && (
                  <div className="space-y-3 animate-pulse">
                    {[80, 72, 88, 65, 76].map((w, i) => (
                      <div key={i} className="h-3 bg-gray-800 rounded" style={{ width: `${w}%` }} />
                    ))}
                  </div>
                )}
                {recipeError && (
                  <div className="text-center py-6">
                    <p className="text-red-400 text-sm mb-3">{recipeError}</p>
                    <a
                      href={meal.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 text-sm underline"
                    >
                      View on Google ↗
                    </a>
                  </div>
                )}
                {recipe && !recipeLoading && (
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Ingredients</p>
                      <ul className="space-y-1.5">
                        {recipe.ingredients.map((ing, i) => (
                          <li key={i} className="text-sm text-gray-300 flex gap-2">
                            <span className="text-orange-500 mt-0.5 flex-shrink-0">•</span>
                            {ing}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Method</p>
                      <ol className="space-y-2">
                        {recipe.steps.map((step, i) => (
                          <li key={i} className="text-sm text-gray-300 flex gap-3">
                            <span className="text-orange-500 font-medium flex-shrink-0">{i + 1}.</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Swap view ── */}
            {view === 'swap' && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <button
                    onClick={() => setView('recipe')}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    ← Back
                  </button>
                  <p className="text-sm font-medium text-white">Choose a replacement</p>
                </div>
                {swapLoading && (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="h-16 bg-gray-800 rounded-xl" />
                    ))}
                  </div>
                )}
                {swapError && (
                  <div className="text-center py-6">
                    <p className="text-red-400 text-sm mb-3">{swapError}</p>
                    <button
                      onClick={() => { setSwapFetched(false); setSwapError(null) }}
                      className="text-orange-400 text-sm underline"
                    >
                      Try again
                    </button>
                  </div>
                )}
                {!swapLoading && !swapError && swapOptions.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectSwap(opt)}
                    disabled={selecting}
                    className="w-full text-left bg-gray-900/60 border border-white/5 rounded-xl px-4 py-3 mb-2 hover:border-orange-500/40 transition-colors disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-white leading-snug mb-1">{opt.title}</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="text-[10px] text-gray-400">{opt.calories} kcal</span>
                      <MacroPill label="C" value={opt.carbsG} colour="bg-orange-500/20 text-orange-300" />
                      <MacroPill label="P" value={opt.proteinG} colour="bg-blue-500/20 text-blue-300" />
                      <MacroPill label="F" value={opt.fatG} colour="bg-gray-700 text-gray-400" />
                    </div>
                  </button>
                ))}
                {persistError && (
                  <p className="text-red-400 text-xs mt-2 text-center">{persistError}</p>
                )}
              </>
            )}
          </div>

          {/* Footer — only shown in recipe view when no error */}
          {view === 'recipe' && !recipeError && (
            <div className="flex gap-2 px-4 py-4 border-t border-white/5">
              <button
                onClick={() => onToggleFavourite(meal)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                  isFav
                    ? 'bg-red-500/20 border-red-500/40 text-red-300'
                    : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-600'
                }`}
              >
                {isFav ? '♥ Saved' : '♡ Save'}
              </button>
              <button
                onClick={() => setView('swap')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-orange-500/20 border border-orange-500/40 text-orange-300 hover:bg-orange-500/30 transition-colors"
              >
                ⇄ Swap meal
              </button>
            </div>
          )}
        </div>
      </>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/nutrition/RecipeDrawer.tsx
  git commit -m "feat: add RecipeDrawer slide-up component"
  ```

---

## Task 8: MealPlanTab Changes

**Files:**
- Modify: `src/app/nutrition/MealPlanTab.tsx`

- [ ] **Step 1: Replace the full contents of `src/app/nutrition/MealPlanTab.tsx`**

  The key changes: `RecipeCard` is no longer an `<a>` — it becomes a `<div>` with a tappable `<button>` for the main area, plus two icon buttons (♥ and ⇄). Four new props are added to `MealPlanTab`.

  ```typescript
  'use client'
  import { useState } from 'react'
  import { Meal, MealPlanContent, SLOT_EMOJIS, SLOT_LABELS } from '@/types/nutrition'

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
    onRetry: () => void
    favouriteTitles: Set<string>
    onCardClick: (meal: Meal, date: string) => void
    onToggleFavourite: (meal: Meal) => void
    onSwap: (meal: Meal, date: string) => void
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

  function RecipeCard({
    meal,
    date,
    isFav,
    onCardClick,
    onToggleFavourite,
    onSwap,
  }: {
    meal: Meal
    date: string
    isFav: boolean
    onCardClick: (meal: Meal, date: string) => void
    onToggleFavourite: (meal: Meal) => void
    onSwap: (meal: Meal, date: string) => void
  }) {
    return (
      <div className="relative flex bg-gray-900/60 border border-white/5 rounded-2xl overflow-hidden hover:border-white/10 transition-colors">
        {/* Main tappable area — opens recipe drawer */}
        <button
          onClick={() => onCardClick(meal, date)}
          className="flex flex-1 text-left min-w-0"
        >
          {meal.image ? (
            <img src={meal.image} alt={meal.title} className="w-20 h-20 object-cover flex-shrink-0" />
          ) : (
            <div className="w-20 h-20 bg-gray-800 flex-shrink-0 text-3xl flex items-center justify-center">
              {SLOT_EMOJIS[meal.slot] ?? '🍽️'}
            </div>
          )}
          <div className="px-3 py-2.5 flex flex-col justify-center gap-1 min-w-0 pr-20">
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
        </button>

        {/* Icon buttons — top-right corner */}
        <div className="absolute right-2 top-2 flex flex-col gap-1">
          <button
            onClick={e => { e.stopPropagation(); onToggleFavourite(meal) }}
            className={`w-7 h-7 rounded-full flex items-center justify-center text-xs transition-colors ${
              isFav
                ? 'text-red-400 bg-red-500/20'
                : 'text-gray-500 bg-gray-800 hover:text-gray-300'
            }`}
            title={isFav ? 'Remove from favourites' : 'Save to favourites'}
          >
            {isFav ? '♥' : '♡'}
          </button>
          <button
            onClick={e => { e.stopPropagation(); onSwap(meal, date) }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-gray-500 bg-gray-800 hover:text-orange-400 transition-colors"
            title="Swap this meal"
          >
            ⇄
          </button>
        </div>
      </div>
    )
  }

  export default function MealPlanTab({
    plan,
    loading,
    error,
    onRegenerate,
    onRetry,
    favouriteTitles,
    onCardClick,
    onToggleFavourite,
    onSwap,
  }: Props) {
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
            onClick={onRetry}
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
              Week of{' '}
              {new Date(
                (plan.content.days[0]?.date ?? plan.weekStart) + 'T00:00:00',
              ).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </p>
          </div>
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="text-xs text-orange-400 hover:text-orange-300 border border-orange-500/30 px-3 py-1.5 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ↺ Regenerate
          </button>
        </div>

        {/* Day picker */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {days.map(day => {
            const d = new Date(day.date + 'T00:00:00')
            const isActive = day.date === activeDateStr
            const isToday = day.date === today
            return (
              <button
                key={day.date}
                onClick={() => setSelectedDate(day.date)}
                className={`flex flex-col items-center px-3 py-1.5 rounded-xl text-xs flex-shrink-0 transition-colors ${
                  isActive ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <span className="font-medium">
                  {d.toLocaleDateString('en-GB', { weekday: 'short' })}
                </span>
                <span className={isActive ? 'text-orange-100' : 'text-gray-600'}>
                  {d.getDate()}
                </span>
                {isToday && !isActive && (
                  <span className="w-1 h-1 rounded-full bg-orange-500 mt-0.5" />
                )}
              </button>
            )
          })}
        </div>

        {/* Recipe cards */}
        {activeDay ? (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 text-right">{activeDay.totalCalories} kcal total</p>
            {activeDay.meals.map(meal => (
              <RecipeCard
                key={meal.recipeId}
                meal={meal}
                date={activeDay.date}
                isFav={favouriteTitles.has(meal.title)}
                onCardClick={onCardClick}
                onToggleFavourite={onToggleFavourite}
                onSwap={onSwap}
              />
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

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 3: Commit**

  ```bash
  git add src/app/nutrition/MealPlanTab.tsx
  git commit -m "feat: meal cards now tappable with heart and swap icon buttons"
  ```

---

## Task 9: NutritionClient Changes

**Files:**
- Modify: `src/app/nutrition/NutritionClient.tsx`

- [ ] **Step 1: Replace the full contents of `src/app/nutrition/NutritionClient.tsx`**

  ```typescript
  'use client'
  import { useState, useEffect, useCallback, useMemo } from 'react'
  import MealPlanTab from './MealPlanTab'
  import PreferencesTab from './PreferencesTab'
  import RecipeDrawer from './RecipeDrawer'
  import { MealPlanContent, Meal, FavouriteMeal } from '@/types/nutrition'

  interface PlanResponse {
    weekStart: string
    generatedAt: string
    content: MealPlanContent
  }

  type Tab = 'plan' | 'preferences'

  interface DrawerState {
    meal: Meal
    date: string
    initialView: 'recipe' | 'swap'
  }

  export default function NutritionClient() {
    const [tab, setTab] = useState<Tab>('plan')
    const [plan, setPlan] = useState<PlanResponse | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [favourites, setFavourites] = useState<FavouriteMeal[]>([])
    const [drawer, setDrawer] = useState<DrawerState | null>(null)

    const favouriteTitles = useMemo(
      () => new Set(favourites.map(f => f.title)),
      [favourites],
    )

    const fetchPlan = useCallback(async () => {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/nutrition/plan')
        if (!res.ok) throw new Error('Failed to load meal plan')
        const data = await res.json()
        setPlan(data)
      } catch {
        setError('Failed to load meal plan. Please try again.')
      } finally {
        setLoading(false)
      }
    }, [])

    const fetchFavourites = useCallback(async () => {
      try {
        const res = await fetch('/api/nutrition/favourites')
        if (!res.ok) return
        const data: FavouriteMeal[] = await res.json()
        setFavourites(data)
      } catch {
        // non-blocking — silently ignore
      }
    }, [])

    useEffect(() => {
      fetchPlan()
      fetchFavourites()
    }, [fetchPlan, fetchFavourites])

    async function regeneratePlan() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/nutrition/plan/regenerate', { method: 'POST' })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.detail ?? body.error ?? `HTTP ${res.status}`)
        }
        const data = await res.json() as PlanResponse
        setPlan(data)
      } catch (e) {
        setError(`Failed to regenerate: ${e instanceof Error ? e.message : 'unknown error'}`)
      } finally {
        setLoading(false)
      }
    }

    async function toggleFavourite(meal: Meal) {
      const isFav = favouriteTitles.has(meal.title)

      if (isFav) {
        const existing = favourites.find(f => f.title === meal.title)
        if (!existing) return
        // Optimistic remove
        setFavourites(prev => prev.filter(f => f.id !== existing.id))
        try {
          await fetch(`/api/nutrition/favourites/${existing.id}`, { method: 'DELETE' })
        } catch {
          setFavourites(prev => [...prev, existing]) // revert on failure
        }
      } else {
        // Optimistic add with temp id
        const temp: FavouriteMeal = {
          id: -Date.now(), // unique negative temp id
          title: meal.title,
          slot: meal.slot,
          calories: meal.calories,
          proteinG: meal.proteinG,
          carbsG: meal.carbsG,
          fatG: meal.fatG,
        }
        setFavourites(prev => [temp, ...prev])
        try {
          const res = await fetch('/api/nutrition/favourites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: meal.title,
              slot: meal.slot,
              calories: meal.calories,
              proteinG: meal.proteinG,
              carbsG: meal.carbsG,
              fatG: meal.fatG,
            }),
          })
          const saved: FavouriteMeal = await res.json()
          // Replace temp with real saved record
          setFavourites(prev => prev.map(f => f.id === temp.id ? saved : f))
        } catch {
          setFavourites(prev => prev.filter(f => f.id !== temp.id)) // revert
        }
      }
    }

    async function removeFavourite(id: number) {
      const existing = favourites.find(f => f.id === id)
      if (!existing) return
      setFavourites(prev => prev.filter(f => f.id !== id))
      try {
        await fetch(`/api/nutrition/favourites/${id}`, { method: 'DELETE' })
      } catch {
        setFavourites(prev => [existing, ...prev]) // revert
      }
    }

    function handleMealSwapped(date: string, slot: string, newMeal: Meal) {
      setPlan(prev => {
        if (!prev) return prev
        const newDays = prev.content.days.map(day => {
          if (day.date !== date) return day
          const newMeals = day.meals.map(m => m.slot === slot ? newMeal : m)
          return {
            ...day,
            meals: newMeals,
            totalCalories: newMeals.reduce((sum, m) => sum + m.calories, 0),
          }
        })
        return { ...prev, content: { ...prev.content, days: newDays } }
      })
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
            onRetry={fetchPlan}
            favouriteTitles={favouriteTitles}
            onCardClick={(meal, date) => setDrawer({ meal, date, initialView: 'recipe' })}
            onToggleFavourite={toggleFavourite}
            onSwap={(meal, date) => setDrawer({ meal, date, initialView: 'swap' })}
          />
        )}

        {tab === 'preferences' && (
          <PreferencesTab
            phase={plan?.content?.phase ?? 'Base'}
            favourites={favourites}
            onRemoveFavourite={removeFavourite}
          />
        )}

        <RecipeDrawer
          meal={drawer?.meal ?? null}
          date={drawer?.date ?? null}
          phase={plan?.content?.phase ?? 'Base'}
          initialView={drawer?.initialView}
          favouriteTitles={favouriteTitles}
          onClose={() => setDrawer(null)}
          onToggleFavourite={toggleFavourite}
          onMealSwapped={handleMealSwapped}
        />
      </div>
    )
  }
  ```

- [ ] **Step 2: Verify TypeScript compiles**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 3: Run tests to make sure nothing regressed**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 4: Commit**

  ```bash
  git add src/app/nutrition/NutritionClient.tsx
  git commit -m "feat: wire up drawer state, favourites fetch, and all meal action handlers"
  ```

---

## Task 10: PreferencesTab — Favourites Section

**Files:**
- Modify: `src/app/nutrition/PreferencesTab.tsx`

- [ ] **Step 1: Add imports and update Props interface in `src/app/nutrition/PreferencesTab.tsx`**

  Add the import at the top (after the existing `'use client'` line):

  ```typescript
  import { FavouriteMeal, SLOT_EMOJIS } from '@/types/nutrition'
  ```

  Change the `Props` interface from:

  ```typescript
  interface Props {
    phase: string
  }
  ```

  To:

  ```typescript
  interface Props {
    phase: string
    favourites: FavouriteMeal[]
    onRemoveFavourite: (id: number) => void
  }
  ```

  Update the function signature from:

  ```typescript
  export default function PreferencesTab({ phase }: Props) {
  ```

  To:

  ```typescript
  export default function PreferencesTab({ phase, favourites, onRemoveFavourite }: Props) {
  ```

- [ ] **Step 2: Add the Favourites section to the JSX in `src/app/nutrition/PreferencesTab.tsx`**

  In the `return` statement, add the favourites card as the **first item** inside `<div className="space-y-3">`, before the calorie goal card. Insert this block:

  ```tsx
  {/* Favourites */}
  <div className={cardClass}>
    <p className={labelClass}>Saved Favourites</p>
    {favourites.length === 0 ? (
      <p className="text-xs text-gray-500">
        Meals you ♥ will appear here and influence your next plan.
      </p>
    ) : (
      <>
        <div className="space-y-2">
          {favourites.map(fav => (
            <div key={fav.id} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm flex-shrink-0">
                  {SLOT_EMOJIS[fav.slot] ?? '🍽️'}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{fav.title}</p>
                  <p className="text-[10px] text-gray-500">{fav.calories} kcal</p>
                </div>
              </div>
              <button
                onClick={() => onRemoveFavourite(fav.id)}
                className="text-gray-600 hover:text-red-400 text-sm flex-shrink-0 transition-colors"
                title="Remove from favourites"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-gray-600 mt-3">
          These meals will influence your next generated plan.
        </p>
      </>
    )}
  </div>
  ```

- [ ] **Step 3: Verify TypeScript compiles with no new errors**

  ```bash
  npx tsc --noEmit 2>&1 | head -20
  ```

- [ ] **Step 4: Run full test suite**

  ```bash
  npm test
  ```

  Expected: all tests pass.

- [ ] **Step 5: Build to confirm no build errors**

  ```bash
  npm run build 2>&1 | tail -30
  ```

  Expected: `✓ Compiled successfully` (or similar success output).

- [ ] **Step 6: End-to-end verify in browser**

  Start `npm run dev`, then:
  1. Go to `/nutrition` — meal plan loads normally ✓
  2. Tap a meal card → recipe drawer slides up, skeleton shows, then recipe appears ✓
  3. Tap ♡ in footer → heart fills red in drawer and on card ✓
  4. Go to Preferences tab → saved meal appears in Favourites section ✓
  5. Tap ⇄ in drawer footer → swap view shows 3 alternatives ✓
  6. Tap one alternative → drawer closes, card updates in place ✓
  7. Tap ⇄ icon on a card directly → drawer opens straight to swap view ✓
  8. Tap ✕ on a favourite in Preferences → it disappears ✓

- [ ] **Step 7: Commit**

  ```bash
  git add src/app/nutrition/PreferencesTab.tsx
  git commit -m "feat: add favourites list to preferences tab"
  ```

- [ ] **Step 8: Push to deploy**

  ```bash
  git push
  ```
