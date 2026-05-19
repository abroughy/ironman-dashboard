# Nutrition & Meal Planning — Design Spec

## Goal

Add a nutrition feature that generates a personalised weekly meal plan using Claude API (for structure and phase-awareness) and Spoonacular API (for real recipes with nutritional data). Users configure dietary preferences, allergens, and a daily calorie goal; the plan refreshes each week and adapts to their current training phase.

## Architecture

**Pattern:** Dashboard widget (daily glance) + dedicated `/nutrition` page (full plan + preferences). Matches the existing recovery widget + `/recovery` page pattern.

**Generation pipeline:** Claude → Spoonacular → DB. Claude produces a meal structure per day (meal slot, macro targets, search query). Spoonacular resolves each slot to a real recipe. The combined result is stored as JSON; viewing the plan is a DB read with no live API calls.

**Tech stack:** Next.js 14 App Router, Prisma + Neon PostgreSQL, Claude API (claude-3-5-haiku for speed/cost), Spoonacular Recipe API.

---

## Data Models

### NutritionProfile
One per user. Created with defaults on first visit to `/nutrition`.

```prisma
model NutritionProfile {
  id           String   @id @default(cuid())
  userId       String   @unique
  calorieGoal  Int      @default(3000)   // user's daily kcal target (estimated or overridden)
  weightKg     Float?                    // used for calorie estimation
  diet         String   @default("none") // "none" | "vegetarian" | "vegan" | "glutenFree" | "dairyFree"
  intolerances String   @default("")     // comma-separated: "peanut,shellfish,egg,soy"
  mealsPerDay  Int      @default(5)      // 3–6
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### MealPlan
One per user per week. Regenerated weekly or on demand.

```prisma
model MealPlan {
  id          String   @id @default(cuid())
  userId      String
  weekStart   DateTime // Monday 00:00 UTC
  content     String   // JSON: MealPlanContent
  generatedAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, weekStart])
  @@index([userId])
}
```

### MealPlanContent JSON shape

```typescript
interface MealPlanContent {
  phase: string          // "Build" | "Peak" | "Taper" | "Base"
  calorieGoal: number
  days: DayPlan[]
}

interface DayPlan {
  date: string           // ISO date "2026-05-19"
  totalCalories: number
  meals: Meal[]
}

interface Meal {
  slot: string           // "breakfast" | "morningSnack" | "lunch" | "afternoonSnack" | "dinner" | "eveningSnack"
  recipeId: number       // Spoonacular recipe ID
  title: string
  image: string          // Spoonacular image URL
  sourceUrl: string      // link to full recipe
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}
```

---

## API Routes

### `GET /api/nutrition/profile`
Returns the current user's NutritionProfile. Creates one with defaults if none exists.

**Response:** `{ id, calorieGoal, weightKg, diet, intolerances, mealsPerDay }`

### `PATCH /api/nutrition/profile`
Updates one or more profile fields. Accepts partial body.

**Body:** `{ calorieGoal?, weightKg?, diet?, intolerances?, mealsPerDay? }`

**Response:** Updated profile object.

### `GET /api/nutrition/plan`
Returns the current week's MealPlan. If none exists or `generatedAt` is older than 7 days, triggers generation before responding.

**Response:** `{ weekStart, generatedAt, content: MealPlanContent }`

### `POST /api/nutrition/plan/regenerate`
Force-regenerates the current week's plan regardless of age. Used by the Regenerate button.

**Response:** `{ weekStart, generatedAt, content: MealPlanContent }`

---

## Generation Flow

### Step 1 — Claude API (meal structure)

**Model:** claude-3-5-haiku (fast, cheap, sufficient for structured JSON output)

**Input prompt includes:**
- Current training phase (Build / Peak / Taper / Base)
- Daily calorie goal
- Meals per day and their slot names
- Diet preference and intolerances
- Week dates (Mon–Sun)
- Phase-specific guidance:
  - Peak: high carb (60% carbs), moderate protein (25%), low fat (15%)
  - Build: balanced (50% carbs, 30% protein, 20% fat)
  - Taper: reduced total calories (×0.85), maintain protein
  - Base: balanced, no phase multiplier

**Output:** JSON array of 7 days × N meals, each with:
```json
{
  "date": "2026-05-19",
  "slot": "breakfast",
  "targetCalories": 650,
  "searchQuery": "high carb oatmeal banana",
  "macroFocus": "carb"
}
```

### Step 2 — Spoonacular API (recipe resolution)

For each meal slot, call `GET https://api.spoonacular.com/recipes/complexSearch` with:
- `query`: Claude's searchQuery
- `diet`: user's diet preference mapped to Spoonacular format: `"vegetarian"` → `"vegetarian"`, `"vegan"` → `"vegan"`, `"glutenFree"` → `"gluten free"`, `"dairyFree"` → `"dairy free"`, `"none"` → omit parameter
- `intolerances`: user's intolerances mapped to Spoonacular values: UI "Nuts" → `"tree nut"`, "Shellfish" → `"shellfish"`, "Eggs" → `"egg"`, "Soy" → `"soy"`
- `minCalories` / `maxCalories`: targetCalories ± 15%
- `addRecipeNutrition=true`
- `number=1` (take first result)
- `apiKey`: from `SPOONACULAR_API_KEY` env var

If a slot returns no results (too restrictive), retry without calorie bounds. If still no result, fall back to a generic healthy meal for that slot.

### Step 3 — Store

Combine Claude's structure with Spoonacular's recipe data into `MealPlanContent` JSON. Upsert into `MealPlan` table (`@@unique([userId, weekStart])`).

---

## Calorie Estimation

Uses Mifflin-St Jeor BMR formula with weight (kg), fixed age 30, male (conservative for endurance athletes):

```
BMR = (10 × weightKg) + (6.25 × 175) - (5 × 30) + 5
```

Activity multiplier per phase:
- Peak: BMR × 1.75
- Build: BMR × 1.60
- Taper: BMR × 1.45
- Base / no phase: BMR × 1.55

Displayed as a suggestion. User can override.

---

## UI Components

### New files

**`src/app/nutrition/page.tsx`** — Server component. Auth check (`getSession()`). Fetches NutritionProfile via Prisma. Passes to NutritionClient.

**`src/app/nutrition/NutritionClient.tsx`** — Client tab manager. Two tabs: "This Week" and "Preferences". Fetches meal plan via `GET /api/nutrition/plan` on mount.

**`src/app/nutrition/MealPlanTab.tsx`** — Client component.
- Day picker: horizontal scroll row of 7 day pills (Mon–Sun), selected day in orange
- Recipe cards per meal slot: slot label + emoji, recipe title, calories, protein/carbs/fat pills, tappable → opens `sourceUrl` in new tab
- "Regenerate" button top-right → POST `/api/nutrition/plan/regenerate`, shows loading state
- Phase badge top-left (e.g. "Peak Phase · High Carb")

**`src/app/nutrition/PreferencesTab.tsx`** — Client component.
- Calorie goal section: shows estimated calories with weight input, editable override field. PATCH on blur.
- Diet section: pill toggles (None / Vegetarian / Vegan / Gluten-free / Dairy-free), single-select
- Allergens section: pill toggles (Nuts / Shellfish / Eggs / Soy), multi-select
- Meals per day: pill options 3 / 4 / 5 / 6, single-select
- All changes auto-save via PATCH `/api/nutrition/profile`

**`src/components/NutritionWidget.tsx`** — Client component for home dashboard.
- Header: "🥗 Today's Nutrition" + phase badge
- Calorie progress bar: planned calories for today's meals (sum of all meal slots) vs daily goal
- Meal list: today's slots, current meal highlighted in orange (determined by time of day — breakfast <10:00, morningSnack <11:30, lunch <14:00, afternoonSnack <17:00, dinner ≥17:00), past meals with ✓, future meals dimmed
- "View full meal plan →" link to `/nutrition`
- Fetches plan from GET `/api/nutrition/plan` (cached in browser, same request as nutrition page)

### Modified files

**`src/app/page.tsx`** — Add `<NutritionWidget />` below the wellness widget.

**`src/components/Nav.tsx`** — Add `{ href: '/nutrition', label: 'Nutrition', emoji: '🥗' }` to the nav links array.

**`prisma/schema.prisma`** — Add NutritionProfile and MealPlan models; add relations to User model.

---

## Environment Variables

Add to `.env.local` and production environment:
```
SPOONACULAR_API_KEY=230115a569d54025ac2a5a2d845aa6ec
```

---

## Error Handling

- **Spoonacular quota exceeded (402/429):** Return cached plan if available; surface a banner "Plan may be outdated — API limit reached"
- **Claude API error:** Return 500; client shows "Failed to generate plan — try again"
- **No recipes found for slot:** Fall back to generic query (`"healthy {slot} meal"`); if still nothing, omit the slot and note it in the response
- **No NutritionProfile exists:** Auto-create with defaults on first GET `/api/nutrition/profile`

---

## Out of Scope (v1)

- Logging what you actually ate (vs planned)
- Shopping list generation
- Custom recipe input
- Calorie tracking via barcode scanner
- Per-meal swap/replace functionality (can be added in v2)
