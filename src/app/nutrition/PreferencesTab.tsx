'use client'
import { useState, useEffect } from 'react'

interface Profile {
  id: string
  calorieGoal: number
  weightKg: number | null
  diet: string
  intolerances: string
  mealsPerDay: number
}

interface Props {
  phase: string
}

function estimateCalories(weightKg: number, phase: string): number {
  const bmr = 10 * weightKg + 6.25 * 175 - 5 * 30 + 5
  const multipliers: Record<string, number> = {
    Peak: 1.75, Build: 1.60, Taper: 1.45, Base: 1.55,
  }
  return Math.round(bmr * (multipliers[phase] ?? 1.55))
}

const DIET_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'glutenFree', label: 'Gluten-free' },
  { value: 'dairyFree', label: 'Dairy-free' },
]

const ALLERGEN_OPTIONS = [
  { value: 'nuts', label: 'Nuts' },
  { value: 'shellfish', label: 'Shellfish' },
  { value: 'eggs', label: 'Eggs' },
  { value: 'soy', label: 'Soy' },
]

const MEALS_OPTIONS = [3, 4, 5, 6]

const pillBase = 'px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors border'
const pillActive = 'bg-orange-500/20 border-orange-500 text-orange-400'
const pillInactive = 'bg-[#2a2a2a] border-[#3a3a3a] text-gray-400'

async function patchProfile(data: Partial<Profile>) {
  await fetch('/api/nutrition/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export default function PreferencesTab({ phase }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [calorieInput, setCalorieInput] = useState('')
  const [weightInput, setWeightInput] = useState('')

  useEffect(() => {
    fetch('/api/nutrition/profile')
      .then(r => r.json())
      .then((p: Profile) => {
        setProfile(p)
        setCalorieInput(String(p.calorieGoal))
        setWeightInput(p.weightKg != null ? String(p.weightKg) : '')
      })
  }, [])

  if (!profile) {
    return <div className="text-gray-500 text-sm p-4 animate-pulse">Loading preferences…</div>
  }

  const currentProfile = profile

  const estimated = currentProfile.weightKg != null
    ? estimateCalories(currentProfile.weightKg, phase)
    : null

  const activeAllergens = currentProfile.intolerances
    ? currentProfile.intolerances.split(',').filter(Boolean)
    : []

  async function handleDietChange(value: string) {
    setProfile(p => p ? { ...p, diet: value } : p)
    await patchProfile({ diet: value })
  }

  async function handleAllergenToggle(value: string) {
    const current = activeAllergens.includes(value)
      ? activeAllergens.filter(a => a !== value)
      : [...activeAllergens, value]
    const intolerances = current.join(',')
    setProfile(p => p ? { ...p, intolerances } : p)
    await patchProfile({ intolerances })
  }

  async function handleMealsChange(value: number) {
    setProfile(p => p ? { ...p, mealsPerDay: value } : p)
    await patchProfile({ mealsPerDay: value })
  }

  async function handleCalorieBlur() {
    const val = parseInt(calorieInput, 10)
    if (!isNaN(val) && val >= 1000 && val <= 10000) {
      setProfile(p => p ? { ...p, calorieGoal: val } : p)
      await patchProfile({ calorieGoal: val })
    } else {
      setCalorieInput(String(currentProfile.calorieGoal))
    }
  }

  async function handleWeightBlur() {
    const val = parseFloat(weightInput)
    if (weightInput === '') {
      setProfile(p => p ? { ...p, weightKg: null } : p)
      await patchProfile({ weightKg: null })
    } else if (!isNaN(val) && val > 0 && val < 300) {
      setProfile(p => p ? { ...p, weightKg: val } : p)
      await patchProfile({ weightKg: val })
    } else {
      setWeightInput(currentProfile.weightKg != null ? String(currentProfile.weightKg) : '')
    }
  }

  const cardClass = 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4'
  const labelClass = 'text-xs text-gray-500 uppercase tracking-wide mb-3'
  const inputClass = 'bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500'

  return (
    <div className="space-y-3">
      {/* Calorie goal */}
      <div className={cardClass}>
        <p className={labelClass}>Calorie Goal</p>
        {estimated != null && (
          <p className="text-xs text-gray-500 mb-3">
            Estimated based on {currentProfile.weightKg}kg bodyweight, {phase} phase: {estimated.toLocaleString()} kcal
          </p>
        )}
        <div className="flex gap-3 items-center flex-wrap">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-600 uppercase tracking-wide">Override (kcal)</span>
            <input
              type="number"
              className={`${inputClass} w-32`}
              value={calorieInput}
              onChange={e => setCalorieInput(e.target.value)}
              onBlur={handleCalorieBlur}
              min={1000}
              max={10000}
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-600 uppercase tracking-wide">Weight (kg)</span>
            <input
              type="number"
              className={`${inputClass} w-24`}
              value={weightInput}
              onChange={e => setWeightInput(e.target.value)}
              onBlur={handleWeightBlur}
              placeholder="e.g. 75"
              min={30}
              max={300}
            />
          </div>
        </div>
      </div>

      {/* Diet */}
      <div className={cardClass}>
        <p className={labelClass}>Diet</p>
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleDietChange(opt.value)}
              className={`${pillBase} ${currentProfile.diet === opt.value ? pillActive : pillInactive}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Allergens */}
      <div className={cardClass}>
        <p className={labelClass}>Allergens</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleAllergenToggle(opt.value)}
              className={`${pillBase} ${activeAllergens.includes(opt.value) ? pillActive : pillInactive}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Meals per day */}
      <div className={cardClass}>
        <p className={labelClass}>Meals per Day</p>
        <div className="flex flex-wrap gap-2">
          {MEALS_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => handleMealsChange(n)}
              className={`${pillBase} ${currentProfile.mealsPerDay === n ? pillActive : pillInactive}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
