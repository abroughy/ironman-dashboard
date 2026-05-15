'use client'

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

interface LeaderboardTabProps {
  entries: LeaderboardEntry[]
  currentUserSharing: boolean
  onShareToggle: () => void
}

const MEDALS = ['🥇', '🥈', '🥉']

function Avatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="w-10 h-10 rounded-full object-cover border border-gray-700" />
  }
  return (
    <div className="w-10 h-10 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-500 font-bold text-sm">
      {name[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

export default function LeaderboardTab({ entries, currentUserSharing, onShareToggle }: LeaderboardTabProps) {
  return (
    <div className="space-y-3">
      {!currentUserSharing && (
        <div className="bg-yellow-950/40 border border-yellow-800/50 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
          <p className="text-yellow-300 text-xs">Your training is private. Share with the group?</p>
          <button
            onClick={onShareToggle}
            className="text-xs bg-orange-500 hover:bg-orange-600 text-white font-medium px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            Share
          </button>
        </div>
      )}

      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">This week · Combined Score</p>

      {entries.map((entry, i) => (
        <div
          key={entry.userId}
          className={`bg-gray-900/60 rounded-xl px-4 py-3 border flex items-center gap-3 ${entry.isCurrentUser ? 'border-orange-500/50' : 'border-white/5'}`}
        >
          <span className="text-xl w-7 text-center">{MEDALS[i] ?? `${i + 1}`}</span>
          <Avatar url={entry.avatarUrl} name={entry.displayName} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-sm text-white truncate">{entry.displayName}{entry.isCurrentUser && <span className="text-gray-500 font-normal"> (you)</span>}</span>
              <span className={`text-base font-bold ${entry.isCurrentUser ? 'text-orange-400' : 'text-gray-300'}`}>{entry.score} pts</span>
            </div>
            <div className="flex gap-1.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300">🏊 {entry.swimKm}km</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300">🚴 {entry.bikeKm}km</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300">🏃 {entry.runKm}km</span>
            </div>
          </div>
        </div>
      ))}

      {entries.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-8">No one is sharing yet. Be the first!</p>
      )}
    </div>
  )
}
