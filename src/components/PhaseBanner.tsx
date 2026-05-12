import { weeksToRace, currentPhase } from '@/lib/config'

export default function PhaseBanner() {
  const weeks = weeksToRace()
  const phase = currentPhase()
  return (
    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2 text-sm text-orange-300">
      <span className="font-semibold">{phase} Phase</span>
      {' · '}
      {weeks > 0 ? `${weeks} weeks to race` : 'Race week!'} · September 2026
    </div>
  )
}
