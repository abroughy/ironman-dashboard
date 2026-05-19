'use client'
import { useState, useEffect, useCallback } from 'react'
import MealPlanTab from './MealPlanTab'
import PreferencesTab from './PreferencesTab'
import { MealPlanContent } from '@/types/nutrition'

interface PlanResponse {
  weekStart: string
  generatedAt: string
  content: MealPlanContent
}

type Tab = 'plan' | 'preferences'

export default function NutritionClient() {
  const [tab, setTab] = useState<Tab>('plan')
  const [plan, setPlan] = useState<PlanResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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

  useEffect(() => {
    fetchPlan()
  }, [fetchPlan])

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
        />
      )}

      {tab === 'preferences' && (
        <PreferencesTab phase={plan?.content?.phase ?? 'Base'} />
      )}
    </div>
  )
}
