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
        id: `-temp-${Date.now()}`,
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

  async function removeFavourite(id: string) {
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
