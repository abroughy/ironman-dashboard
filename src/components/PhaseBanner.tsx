import { weeksToRace, currentPhase } from '@/lib/config'

export default function PhaseBanner() {
  const weeks = weeksToRace()
  const phase = currentPhase()
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent border border-orange-500/20 px-5 py-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-orange-400/70 uppercase tracking-widest mb-0.5">Current Phase</p>
          <p className="text-xl font-bold text-white">{phase} Phase</p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-orange-400">{weeks > 0 ? weeks : '🏁'}</p>
          <p className="text-xs text-gray-400">weeks to race</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">Ironman 70.3 · September 2026</p>
    </div>
  )
}
