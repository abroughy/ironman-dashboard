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
