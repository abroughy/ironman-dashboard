'use client'
import { useState, useEffect } from 'react'
import { FavouriteMeal, SLOT_EMOJIS } from '@/types/nutrition'

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
  favourites: FavouriteMeal[]
  onRemoveFavourite: (id: string) => void
}

// BMR formula: Mifflin-St Jeor, assumes 175cm height, age 30, male
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

async function patchProfile(data: Partial<Omit<Profile, 'id'>>) {
  const res = await fetch('/api/nutrition/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error('Failed to save')
}

export default function PreferencesTab({ phase, favourites, onRemoveFavourite }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [calorieInput, setCalorieInput] = useState('')
  const [weightInput, setWeightInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [retryCount, setRetryCount] = useState(0)

  useEffect(() => {
    setLoading(true)
    const load = async () => {
      try {
        const res = await fetch('/api/nutrition/profile')
        if (!res.ok) throw new Error('Failed to load')
        const data: Profile = await res.json()
        setProfile(data)
        setCalorieInput(String(data.calorieGoal))
        setWeightInput(data.weightKg != null ? String(data.weightKg) : '')
      } catch {
        setFetchError('Failed to load preferences. Please try again.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [retryCount])

  if (fetchError) return (
    <div className="p-4 text-center">
      <p className="text-red-400 text-sm mb-3">{fetchError}</p>
      <button
        onClick={() => { setFetchError(null); setRetryCount(c => c + 1) }}
        className="text-orange-400 text-sm underline"
      >Retry</button>
    </div>
  )

  if (loading || !profile) {
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
    if (saving) return
    const prev = profile
    setProfile(p => p ? { ...p, diet: value } : p)
    setSaveError(null)
    setSaving(true)
    try {
      await patchProfile({ diet: value })
    } catch {
      setProfile(prev)
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAllergenToggle(value: string) {
    if (saving) return
    const prev = profile
    const current = activeAllergens.includes(value)
      ? activeAllergens.filter(a => a !== value)
      : [...activeAllergens, value]
    const intolerances = current.join(',')
    setProfile(p => p ? { ...p, intolerances } : p)
    setSaveError(null)
    setSaving(true)
    try {
      await patchProfile({ intolerances })
    } catch {
      setProfile(prev)
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleMealsChange(value: number) {
    if (saving) return
    const prev = profile
    setProfile(p => p ? { ...p, mealsPerDay: value } : p)
    setSaveError(null)
    setSaving(true)
    try {
      await patchProfile({ mealsPerDay: value })
    } catch {
      setProfile(prev)
      setSaveError('Failed to save. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCalorieBlur() {
    const val = parseInt(calorieInput, 10)
    if (!isNaN(val) && val >= 1000 && val <= 10000) {
      const prev = profile
      const prevInput = String(currentProfile.calorieGoal)
      setProfile(p => p ? { ...p, calorieGoal: val } : p)
      setSaveError(null)
      try {
        await patchProfile({ calorieGoal: val })
      } catch {
        setProfile(prev)
        setCalorieInput(prevInput)
        setSaveError('Failed to save. Please try again.')
      }
    } else {
      setCalorieInput(String(currentProfile.calorieGoal))
    }
  }

  async function handleWeightBlur() {
    const val = parseFloat(weightInput)
    if (weightInput === '') {
      const prev = profile
      const prevInput = currentProfile.weightKg != null ? String(currentProfile.weightKg) : ''
      setProfile(p => p ? { ...p, weightKg: null } : p)
      setSaveError(null)
      try {
        await patchProfile({ weightKg: null })
      } catch {
        setProfile(prev)
        setWeightInput(prevInput)
        setSaveError('Failed to save. Please try again.')
      }
    } else if (!isNaN(val) && val > 0 && val < 300) {
      const prev = profile
      const prevInput = currentProfile.weightKg != null ? String(currentProfile.weightKg) : ''
      setProfile(p => p ? { ...p, weightKg: val } : p)
      setSaveError(null)
      try {
        await patchProfile({ weightKg: val })
      } catch {
        setProfile(prev)
        setWeightInput(prevInput)
        setSaveError('Failed to save. Please try again.')
      }
    } else {
      setWeightInput(currentProfile.weightKg != null ? String(currentProfile.weightKg) : '')
    }
  }

  const cardClass = 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-4'
  const labelClass = 'text-xs text-gray-500 uppercase tracking-wide mb-3'
  const inputClass = 'bg-[#2a2a2a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500'

  return (
    <div className="space-y-3">
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
              onChange={e => { setCalorieInput(e.target.value); setSaveError(null) }}
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
              onChange={e => { setWeightInput(e.target.value); setSaveError(null) }}
              onBlur={handleWeightBlur}
              placeholder="e.g. 75"
              min={30}
              max={300}
            />
          </div>
        </div>
        {saveError && <p className="text-red-400 text-xs mt-2">{saveError}</p>}
      </div>

      {/* Diet */}
      <div className={cardClass}>
        <p className={labelClass}>Diet</p>
        <div className="flex flex-wrap gap-2">
          {DIET_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleDietChange(opt.value)}
              disabled={saving}
              className={`${pillBase} ${currentProfile.diet === opt.value ? pillActive : pillInactive}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {saveError && <p className="text-red-400 text-xs mt-2">{saveError}</p>}
      </div>

      {/* Allergens */}
      <div className={cardClass}>
        <p className={labelClass}>Allergens</p>
        <div className="flex flex-wrap gap-2">
          {ALLERGEN_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleAllergenToggle(opt.value)}
              disabled={saving}
              className={`${pillBase} ${activeAllergens.includes(opt.value) ? pillActive : pillInactive}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {saveError && <p className="text-red-400 text-xs mt-2">{saveError}</p>}
      </div>

      {/* Meals per day */}
      <div className={cardClass}>
        <p className={labelClass}>Meals per Day</p>
        <div className="flex flex-wrap gap-2">
          {MEALS_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => handleMealsChange(n)}
              disabled={saving}
              className={`${pillBase} ${currentProfile.mealsPerDay === n ? pillActive : pillInactive}`}
            >
              {n}
            </button>
          ))}
        </div>
        {saveError && <p className="text-red-400 text-xs mt-2">{saveError}</p>}
      </div>
    </div>
  )
}
