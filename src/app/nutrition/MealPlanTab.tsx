'use client'
import { useState } from 'react'

// Types inlined to avoid importing server-only @anthropic-ai/sdk via @/lib/nutrition
interface MealPlanContent {
  phase: string
  calorieGoal: number
  days: DayPlan[]
}

interface DayPlan {
  date: string
  totalCalories: number
  meals: Meal[]
}

interface Meal {
  slot: string
  recipeId: number
  title: string
  image: string
  sourceUrl: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
}

const SLOT_EMOJIS: Record<string, string> = {
  breakfast: '🌅',
  morningSnack: '🍎',
  lunch: '☀️',
  afternoonSnack: '🍌',
  dinner: '🌙',
  eveningSnack: '🌙',
}

const SLOT_LABELS: Record<string, string> = {
  breakfast: 'Breakfast',
  morningSnack: 'Morning Snack',
  lunch: 'Lunch',
  afternoonSnack: 'Afternoon Snack',
  dinner: 'Dinner',
  eveningSnack: 'Evening Snack',
}

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
        <div className="w-20 h-20 bg-gray-800 flex-shrink-0 text-3xl flex items-center justify-center">
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
