'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Meal, MealPlanContent, SLOT_EMOJIS, SLOT_LABELS } from '@/types/nutrition'

interface PlanResponse {
  weekStart: string
  generatedAt: string
  content: MealPlanContent
}

const PHASE_LABELS: Record<string, string> = {
  Peak: 'Peak Phase · High Carb',
  Build: 'Build Phase · Balanced',
  Taper: 'Taper Phase · Lower Cal',
  Base: 'Base Phase · Balanced',
}

function getCurrentMealSlot(slots: string[], hour: number): string {
  if (hour < 10) return slots.find(s => s === 'breakfast') ?? slots[0]
  if (hour < 11.5) return slots.find(s => s === 'morningSnack') ?? slots.find(s => s === 'lunch') ?? slots[0]
  if (hour < 14) return slots.find(s => s === 'lunch') ?? slots[0]
  if (hour < 17) return slots.find(s => s === 'afternoonSnack') ?? slots.find(s => s === 'dinner') ?? slots[0]
  if (hour < 20) return slots.find(s => s === 'dinner') ?? slots[slots.length - 1]
  return slots.find(s => s === 'eveningSnack') ?? slots[slots.length - 1]
}

function getSlotOrder(slot: string): number {
  const order = ['breakfast', 'morningSnack', 'lunch', 'afternoonSnack', 'dinner', 'eveningSnack']
  const idx = order.indexOf(slot)
  return idx === -1 ? 99 : idx
}

export default function NutritionWidget() {
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch('/api/nutrition/plan')
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json() as Promise<PlanResponse>
      })
      .then(data => {
        setPlan(data)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4 animate-pulse">
        <div className="flex items-center justify-between mb-4">
          <div className="h-4 bg-[#2a2a2a] rounded w-36" />
          <div className="h-5 bg-[#2a2a2a] rounded-full w-40" />
        </div>
        <div className="h-2 bg-[#2a2a2a] rounded-full mb-1" />
        <div className="h-3 bg-[#2a2a2a] rounded w-28 mb-4" />
        <div className="space-y-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-12 bg-[#2a2a2a] rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const todayStr = new Date().toISOString().slice(0, 10)
  const todayPlan = plan?.content.days.find(d => d.date === todayStr)

  if (error || !plan || !todayPlan) {
    return (
      <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">🥗 Today&apos;s Nutrition</p>
        <p className="text-gray-400 text-sm mt-3">No meal plan yet.</p>
        <Link href="/nutrition" className="text-orange-400 text-xs hover:underline mt-1 inline-block">
          Generate a meal plan →
        </Link>
      </div>
    )
  }

  const now = new Date()
  const currentHour = now.getHours() + now.getMinutes() / 60

  const sortedMeals: Meal[] = [...todayPlan.meals].sort(
    (a, b) => getSlotOrder(a.slot) - getSlotOrder(b.slot)
  )

  const slots = sortedMeals.map(m => m.slot)
  const currentSlot = getCurrentMealSlot(slots, currentHour)
  const currentSlotOrder = getSlotOrder(currentSlot)

  const plannedCalories = sortedMeals.reduce((sum, m) => sum + m.calories, 0)
  const calorieGoal = plan.content.calorieGoal
  const caloriePercent = Math.min(100, Math.round((plannedCalories / calorieGoal) * 100))

  const phaseLabel = PHASE_LABELS[plan.content.phase] ?? `${plan.content.phase} Phase`

  return (
    <div className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">🥗 Today&apos;s Nutrition</p>
        <span className="text-xs font-medium bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2.5 py-0.5">
          {phaseLabel}
        </span>
      </div>

      {/* Calorie progress */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Calories</span>
          <span className="text-xs text-gray-300 font-medium">
            {plannedCalories.toLocaleString()} / {calorieGoal.toLocaleString()} kcal
          </span>
        </div>
        <div className="bg-[#2a2a2a] rounded-full h-2">
          <div
            className="bg-orange-500 h-2 rounded-full transition-all"
            style={{ width: `${caloriePercent}%` }}
          />
        </div>
      </div>

      {/* Meal list */}
      <div className="space-y-1.5">
        {sortedMeals.map(meal => {
          const slotOrder = getSlotOrder(meal.slot)
          const isCurrent = meal.slot === currentSlot
          const isPast = slotOrder < currentSlotOrder
          const isFuture = slotOrder > currentSlotOrder

          const emoji = SLOT_EMOJIS[meal.slot] ?? '🍽️'
          const label = SLOT_LABELS[meal.slot] ?? meal.slot

          return (
            <div
              key={meal.slot}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-opacity ${
                isCurrent
                  ? 'bg-orange-500/10 border border-orange-500/40'
                  : isFuture
                  ? 'opacity-40'
                  : ''
              }`}
            >
              {/* Status icon */}
              <span className="text-sm shrink-0">
                {isPast ? (
                  <span className="text-green-400 font-bold text-xs">✓</span>
                ) : (
                  <span>{emoji}</span>
                )}
              </span>

              {/* Slot label + recipe */}
              <div className="flex-1 min-w-0">
                <span className={`text-xs font-medium ${isCurrent ? 'text-orange-400' : 'text-gray-400'}`}>
                  {label}
                </span>
                <p className={`text-xs truncate ${isCurrent ? 'text-orange-300' : 'text-gray-300'}`}>
                  {meal.title}
                </p>
              </div>

              {/* Calories */}
              <span className={`text-xs font-medium shrink-0 ${isCurrent ? 'text-orange-400' : 'text-gray-500'}`}>
                {meal.calories} kcal
              </span>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-[#2a2a2a]">
        <Link href="/nutrition" className="text-xs text-orange-400 hover:text-orange-300 transition-colors">
          View full meal plan →
        </Link>
      </div>
    </div>
  )
}
