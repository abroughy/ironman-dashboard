// Client-safe nutrition types — no SDK imports here
export interface Meal {
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

export interface DayPlan {
  date: string // ISO date "2026-05-19"
  totalCalories: number
  meals: Meal[]
}

export interface MealPlanContent {
  phase: string // "Build" | "Peak" | "Taper" | "Base"
  calorieGoal: number
  days: DayPlan[]
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
