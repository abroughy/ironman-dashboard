'use client'
import { useState } from 'react'

interface Participant {
  userId: string
  displayName: string
  avatarUrl: string | null
  progressKm: number
  progressPct: number
  isCurrentUser: boolean
}

interface Challenge {
  id: string
  name: string
  discipline: string
  targetKm: number
  startDate: string
  endDate: string
  createdBy: string
  creatorName: string
  participants: Participant[]
}

interface ChallengesTabProps {
  challenges: Challenge[]
  currentUserId: string
  isAdmin: boolean
  onRefresh: () => void
}

const DISC_LABELS: Record<string, string> = { swim: '🏊 Swim', bike: '🚴 Bike', run: '🏃 Run', any: '⚡ Any' }

function daysLeft(endDate: string): string {
  const diff = new Date(endDate).getTime() - Date.now()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
  if (days <= 0) return 'Ended'
  return `${days}d left`
}

export default function ChallengesTab({ challenges, currentUserId, isAdmin, onRefresh }: ChallengesTabProps) {
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', discipline: 'run', targetKm: '', startDate: '', endDate: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setError('')
    if (!form.name || !form.targetKm || !form.startDate || !form.endDate) {
      setError('All fields are required')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/group/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, targetKm: parseFloat(form.targetKm) }),
      })
      if (!res.ok) {
        const data = await res.json() as { error: string }
        setError(data.error)
        return
      }
      setForm({ name: '', discipline: 'run', targetKm: '', startDate: '', endDate: '' })
      setShowForm(false)
      onRefresh()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this challenge?')) return
    await fetch(`/api/group/challenges/${id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Challenges</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="text-xs text-orange-400 hover:text-orange-300 font-medium"
        >
          {showForm ? 'Cancel' : '+ Create'}
        </button>
      </div>

      {showForm && (
        <div className="bg-gray-900/60 rounded-2xl p-4 border border-orange-500/30 space-y-3">
          <input
            type="text"
            placeholder="Challenge name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
          />
          <div className="grid grid-cols-2 gap-2">
            <select
              value={form.discipline}
              onChange={e => setForm(f => ({ ...f, discipline: e.target.value }))}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            >
              <option value="swim">🏊 Swim</option>
              <option value="bike">🚴 Bike</option>
              <option value="run">🏃 Run</option>
              <option value="any">⚡ Any</option>
            </select>
            <input
              type="number"
              placeholder="Target km"
              value={form.targetKm}
              onChange={e => setForm(f => ({ ...f, targetKm: e.target.value }))}
              className="bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Start date</p>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
              />
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-1">End date</p>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
              />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            onClick={handleCreate}
            disabled={submitting}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
          >
            {submitting ? 'Creating…' : 'Create Challenge'}
          </button>
        </div>
      )}

      {challenges.map(challenge => (
        <div key={challenge.id} className="bg-gray-900/60 rounded-2xl p-4 border border-white/5 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-white">{challenge.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {DISC_LABELS[challenge.discipline] ?? challenge.discipline} · {challenge.targetKm}km · {daysLeft(challenge.endDate)}
              </p>
            </div>
            {(isAdmin || challenge.createdBy === currentUserId) && (
              <button onClick={() => handleDelete(challenge.id)} className="text-gray-600 hover:text-red-400 transition-colors text-xs">✕</button>
            )}
          </div>
          <div className="space-y-2">
            {challenge.participants.map(p => (
              <div key={p.userId}>
                <div className="flex justify-between text-xs mb-1">
                  <span className={p.isCurrentUser ? 'text-orange-300 font-medium' : 'text-gray-400'}>{p.displayName}{p.isCurrentUser && ' (you)'}</span>
                  <span className="text-gray-500">{p.progressKm}km · {p.progressPct}%</span>
                </div>
                <div className="bg-gray-800 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-all ${p.isCurrentUser ? 'bg-orange-500' : 'bg-gray-600'}`}
                    style={{ width: `${p.progressPct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {challenges.length === 0 && !showForm && (
        <p className="text-gray-500 text-sm text-center py-8">No active challenges. Create one!</p>
      )}
    </div>
  )
}
