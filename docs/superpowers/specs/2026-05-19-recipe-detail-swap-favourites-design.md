# Recipe Detail, Meal Swap & Favourites Design

> **Status:** Approved — ready for implementation planning

## Goal

Enhance the nutrition dashboard so users can view full Claude-generated recipes in a slide-up drawer, swap out individual meals they dislike (choosing from 3 alternatives), and heart-favourite meals that influence future generated plans and appear in a browseable Favourites list.

## Architecture

On-demand lazy loading: recipe content and swap alternatives are fetched only when the user requests them, keeping plan generation fast (no change to the existing ~4s generation time). Favourites are stored in a new DB table and injected into the Claude prompt at plan generation time.

**Tech stack:** Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma + Neon PostgreSQL, Anthropic `claude-sonnet-4-5`

---

## Data Layer

### New Prisma model: `FavouriteMeal`

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

  @@unique([userId, title])
}
```

Unique constraint on `[userId, title]` prevents duplicate favourites. No foreign key to `User` — consistent with existing `NutritionProfile` / `MealPlan` pattern.

---

## API Routes

### `GET /api/nutrition/recipe`

Query params: `title`, `slot`, `calories`, `phase`

Calls Claude (`claude-sonnet-4-5`, max_tokens 800) to generate a structured recipe for the named meal. Returns:

```typescript
{
  title: string
  ingredients: string[]   // e.g. ["200g chicken breast", "1 tbsp olive oil"]
  steps: string[]         // numbered instructions
}
```

Claude prompt format (compact, JSON output):
```
Generate a recipe for: {title} ({slot}, {calories} kcal, {phase} phase triathlete).
Return ONLY valid JSON: {"ingredients":["..."],"steps":["..."]}
No markdown, no explanation.
```

Error: returns `{ error: string }` with appropriate HTTP status. Client falls back to Google search link.

---

### `POST /api/nutrition/plan/swap`

Body:
```typescript
{
  date: string       // "2026-05-19"
  slot: string       // "lunch"
  currentTitle: string
  phase: string
  calorieGoal: number
  mealsPerDay: number
  diet: string
  intolerances: string
}
```

Calls Claude to return 3 alternative meals for the same slot, avoiding `currentTitle`. Returns:

```typescript
{
  options: Array<{
    title: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }>
}
```

Claude prompt format (CSV, 3 rows):
```
Suggest 3 alternative {slot} meals for a triathlete in {phase} phase, ~{slotCalories} kcal each.
Avoid: {currentTitle}. Diet: {diet}. Avoid intolerances: {intolerances}.
Output ONLY 3 CSV rows: title,cal,pro,carb,fat
```

Slot calorie targets: breakfast 25%, snacks 9%, lunch 30%, dinner 30% of calorieGoal.

---

### `PUT /api/nutrition/plan/meal`

Body:
```typescript
{
  date: string
  slot: string
  meal: {
    title: string
    calories: number
    proteinG: number
    carbsG: number
    fatG: number
  }
}
```

Loads the user's current week's `MealPlan` from DB, parses the JSON content, replaces the meal at `[date][slot]` (matched by slot name), recalculates `totalCalories` for that day, and upserts back to DB.

Assigns a new `recipeId` (max existing id + 1). Sets `image: ''` and `sourceUrl` to Google search URL.

Returns the updated `MealPlanContent`.

---

### `GET /api/nutrition/favourites`

Returns the user's favourites ordered by `createdAt DESC`:

```typescript
FavouriteMeal[]
```

---

### `POST /api/nutrition/favourites`

Body: `{ title, slot, calories, proteinG, carbsG, fatG }`

Upserts by `[userId, title]`. Returns the saved `FavouriteMeal`.

---

### `DELETE /api/nutrition/favourites/[id]`

Deletes the favourite by `id` (validates it belongs to the session user). Returns `{ success: true }`.

---

## Types (`src/types/nutrition.ts` additions)

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

---

## UI Components

### `MealPlanTab.tsx` changes

- `RecipeCard` is no longer an `<a>` element — it becomes a `<button>` (or `<div role="button">`) that calls `onCardClick(meal)`
- A ♥ icon button is overlaid on the card (top-right corner), calls `onToggleFavourite(meal)`; filled red when favourite
- A ⇄ icon button is also on the card face (bottom-right), calls `onSwap(meal, date)` directly without opening the drawer

Props added to `MealPlanTab`:
```typescript
favouriteTitles: Set<string>
onCardClick: (meal: Meal, date: string) => void
onToggleFavourite: (meal: Meal) => void
onSwap: (meal: Meal, date: string) => void
```

### `RecipeDrawer.tsx` (new file: `src/app/nutrition/RecipeDrawer.tsx`)

Slide-up panel, ~80vh, dark background, rendered at the `NutritionClient` level (above the tab layout) so it overlays everything.

**States:**
1. **Loading** — skeleton lines while fetching recipe
2. **Recipe view** — ingredients list + numbered steps. Footer: ♥ Save/Remove button + ⇄ Swap button
3. **Swap view** — "⇄ Swap" header replaces recipe content with 3 `SwapOptionCard` components + a "← Back to recipe" link. Footer: hidden.
4. **Swap loading** — skeleton while fetching alternatives
5. **Error** — "Couldn't load recipe" + fallback Google link

Dismissal: tap the backdrop or the ✕ close button.

### `SwapOptionCard` (inline in `RecipeDrawer.tsx`)

Compact card: title, slot emoji, kcal + macro pills. Tapping fires `onSelectSwap(option)` which:
1. Calls `PUT /api/nutrition/plan/meal` 
2. Optimistically updates the meal in parent state
3. Closes the drawer

### `PreferencesTab.tsx` changes

New "Favourites" section rendered above the profile form:

- Section header: "Your Favourites"
- Empty state: *"Meals you ♥ will appear here and influence your next plan"*
- List: compact rows — slot emoji + title + kcal, with a ✕ remove button on the right
- Remove calls `DELETE /api/nutrition/favourites/[id]` and updates local state

---

## `NutritionClient.tsx` changes

New state:
```typescript
const [favourites, setFavourites] = useState<FavouriteMeal[]>([])
const [drawerMeal, setDrawerMeal] = useState<{ meal: Meal; date: string } | null>(null)
```

`favouriteTitles` derived: `useMemo(() => new Set(favourites.map(f => f.title)), [favourites])`

On mount: fetch favourites alongside plan (`Promise.all`).

`toggleFavourite(meal)` — optimistic update:
- If already favourite: remove from state, call `DELETE`; revert on failure
- If not favourite: add to state, call `POST`; revert on failure

`handleSelectSwap(option, date, slot)` — after user picks a swap option:
1. Calls `PUT /api/nutrition/plan/meal`
2. On success: updates `plan` state (replaces the meal in the relevant day)
3. Closes drawer

---

## `generateMealPlan` update (`src/lib/nutrition.ts`)

Signature change:
```typescript
export async function generateMealPlan(
  profile: NutritionProfileData,
  phase: string,
  favourites?: string[],   // meal titles, top 10 by recency
): Promise<MealPlanContent>
```

When `favourites` has entries, append to prompt:
```
Favourites (include some if they fit): ${favourites.slice(0, 10).join(', ')}.
```

Plan API routes (`/api/nutrition/plan/route.ts` and `/api/nutrition/plan/regenerate/route.ts`) fetch `FavouriteMeal` records before calling `generateMealPlan` and pass titles.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Recipe fetch fails | Drawer shows error state + "View on Google" fallback link |
| Swap fetch fails | Swap view shows inline error + "Try again" button |
| Swap persist fails | Meal reverts to original; brief error message in drawer |
| Favourite toggle fails | Heart icon reverts silently |
| Favourites list fetch fails | PreferencesTab shows empty state (non-blocking) |

---

## What Does Not Change

- Plan generation speed (favourites add ~50 tokens, negligible)
- `onRegenerate` / `onRetry` flow in `NutritionClient`
- `PreferencesTab` profile form layout (favourites section added above it)
- Existing `Meal`, `DayPlan`, `MealPlanContent` types
- All existing API routes
