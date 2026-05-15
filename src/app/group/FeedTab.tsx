'use client'
import { useState, useEffect } from 'react'

type FeedItem =
  | { type: 'session'; userId: string; displayName: string; avatarUrl: string | null; date: string; discipline: string; distanceMetres: number; durationSecs: number }
  | { type: 'milestone'; userId: string; displayName: string; avatarUrl: string | null; date: string; raceName: string; milestoneLabel: string }

const DISC_VERB: Record<string, string> = { swim: 'swam', bike: 'cycled', run: 'ran' }
const DISC_EMOJI: Record<string, string> = { swim: '🏊', bike: '🚴', run: '🏃' }

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) return <img src={url} alt={name} className="w-9 h-9 rounded-full object-cover border border-gray-700 flex-shrink-0" />
  return (
    <div className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-500 font-bold text-sm flex-shrink-0">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function FeedTab() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/group/feed')
      .then(r => r.json())
      .then((data: FeedItem[]) => setItems(data))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500 text-sm text-center py-8">Loading…</p>

  if (items.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">No activity yet. Ask your friends to share their training!</p>
  }

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        if (item.type === 'session') {
          const km = (item.distanceMetres / 1000).toFixed(1)
          const mins = Math.round(item.durationSecs / 60)
          const verb = DISC_VERB[item.discipline] ?? item.discipline
          const emoji = DISC_EMOJI[item.discipline] ?? '🏅'
          return (
            <div key={i} className="bg-gray-900/60 rounded-xl px-4 py-3 border border-white/5 flex items-start gap-3">
              <Avatar url={item.avatarUrl} name={item.displayName} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">
                  <span className="font-semibold">{item.displayName}</span> {verb} {emoji} <span className="font-semibold">{km}km</span> in {mins}min
                </p>
                <p className="text-xs text-gray-600 mt-0.5">{relativeTime(item.date)}</p>
              </div>
            </div>
          )
        }
        return (
          <div key={i} className="bg-gray-900/60 rounded-xl px-4 py-3 border border-orange-500/30 flex items-start gap-3">
            <Avatar url={item.avatarUrl} name={item.displayName} />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-200">
                🎯 <span className="font-semibold">{item.displayName}</span> hit a milestone — {item.milestoneLabel}
              </p>
              <p className="text-xs text-gray-600 mt-0.5">{relativeTime(item.date)}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
