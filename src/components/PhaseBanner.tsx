import { getSession } from '@/lib/auth'
import { getNextRace } from '@/lib/races'
import { weeksToRaceFromDate, currentPhaseFromWeeks } from '@/lib/config'
import { getRaceConfig } from '@/lib/raceConfig'

export default async function PhaseBanner() {
  const session = await getSession()
  if (!session) return null
  const nextRace = await getNextRace(session.userId)

  if (!nextRace) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent border border-green-500/20 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-green-400/70 uppercase tracking-widest mb-0.5">General Fitness</p>
            <p className="text-xl font-bold text-white">Build Phase</p>
            <p className="text-xs text-gray-500 mt-0.5">Steady progress — <a href="/races" className="text-orange-400 hover:underline">add a race</a> when you have one</p>
          </div>
          <div className="text-right">
            <p className="text-3xl">💪</p>
          </div>
        </div>
      </div>
    )
  }

  const weeks = weeksToRaceFromDate(nextRace.date)
  const phase = currentPhaseFromWeeks(weeks)
  const raceLabel = getRaceConfig(nextRace.raceType).label
  const raceDateStr = nextRace.date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border border-orange-500/20 px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-orange-400/70 uppercase tracking-widest mb-0.5">Next race · {nextRace.priority}-priority</p>
          <p className="text-xl font-bold text-white">{nextRace.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">{raceLabel} · {phase} Phase</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-orange-400">{weeks > 0 ? weeks : '🏁'}</p>
          <p className="text-xs text-gray-400">weeks to race</p>
          <p className="text-xs text-gray-500">{raceDateStr}</p>
        </div>
      </div>
    </div>
  )
}
