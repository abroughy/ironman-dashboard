import { getSession } from '@/lib/auth'
import { weeksToRaceFromDate, currentPhaseFromWeeks } from '@/lib/config'
import { getRaceConfig } from '@/lib/raceConfig'

export default async function PhaseBanner() {
  const session = await getSession()
  const raceDate = session?.raceDate ? new Date(session.raceDate) : new Date('2026-09-01')
  const raceType = session?.raceType ?? '70.3'
  const weeks = weeksToRaceFromDate(raceDate)
  const phase = currentPhaseFromWeeks(weeks)
  const raceLabel = getRaceConfig(raceType).label
  const raceDateStr = raceDate.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border border-orange-500/20 px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-orange-400/70 uppercase tracking-widest mb-0.5">Current Phase</p>
          <p className="text-xl font-bold text-white">{phase} Phase</p>
          <p className="text-xs text-gray-500 mt-0.5">{raceLabel}</p>
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
