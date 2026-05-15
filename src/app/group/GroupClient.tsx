'use client'
import { useState, useEffect } from 'react'
import LeaderboardTab from './LeaderboardTab'
import ChallengesTab from './ChallengesTab'
import FeedTab from './FeedTab'

interface LeaderboardEntry {
  userId: string
  displayName: string
  avatarUrl: string | null
  isCurrentUser: boolean
  score: number
  swimKm: number
  bikeKm: number
  runKm: number
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
  participants: { userId: string; displayName: string; avatarUrl: string | null; progressKm: number; progressPct: number; isCurrentUser: boolean }[]
}

interface GroupClientProps {
  currentUserId: string
  isAdmin: boolean
}

type Tab = 'leaderboard' | 'challenges' | 'feed'

export default function GroupClient({ currentUserId, isAdmin }: GroupClientProps) {
  const [tab, setTab] = useState<Tab>('leaderboard')
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [sharing, setSharing] = useState(false)
  const [challenges, setChallenges] = useState<Challenge[] | null>(null)
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(true)

  useEffect(() => {
    fetch('/api/group/leaderboard')
      .then(r => r.json())
      .then((data: { leaderboard: LeaderboardEntry[]; currentUserSharing: boolean }) => {
        setLeaderboard(data.leaderboard)
        setSharing(data.currentUserSharing)
      })
      .finally(() => setLoadingLeaderboard(false))
  }, [])

  async function refreshLeaderboard() {
    const res = await fetch('/api/group/leaderboard')
    const data = await res.json() as { leaderboard: LeaderboardEntry[]; currentUserSharing: boolean }
    setLeaderboard(data.leaderboard)
    setSharing(data.currentUserSharing)
  }

  async function handleShareToggle() {
    const next = !sharing
    await fetch('/api/profile/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share: next }),
    })
    setSharing(next)
    await refreshLeaderboard()
  }

  async function loadChallenges() {
    if (challenges !== null) return
    const res = await fetch('/api/group/challenges')
    const data = await res.json() as Challenge[]
    setChallenges(data)
  }

  async function refreshChallenges() {
    const res = await fetch('/api/group/challenges')
    const data = await res.json() as Challenge[]
    setChallenges(data)
  }

  function handleTabClick(t: Tab) {
    setTab(t)
    if (t === 'challenges') loadChallenges()
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'leaderboard', label: '🏆 Leaderboard' },
    { key: 'challenges', label: '⚡ Challenges' },
    { key: 'feed', label: '📰 Feed' },
  ]

  return (
    <div className="space-y-4">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-900/60 rounded-xl p-1 border border-white/5">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => handleTabClick(t.key)}
            className={`flex-1 text-xs font-medium py-2 rounded-lg transition-colors ${tab === t.key ? 'bg-orange-500 text-white' : 'text-gray-500 hover:text-gray-300'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'leaderboard' && (
        loadingLeaderboard
          ? <p className="text-gray-500 text-sm text-center py-8">Loading…</p>
          : <LeaderboardTab
              entries={leaderboard}
              currentUserSharing={sharing}
              onShareToggle={handleShareToggle}
            />
      )}
      {tab === 'challenges' && (
        <ChallengesTab
          challenges={challenges ?? []}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          onRefresh={refreshChallenges}
        />
      )}
      {tab === 'feed' && <FeedTab />}
    </div>
  )
}
