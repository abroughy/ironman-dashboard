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
