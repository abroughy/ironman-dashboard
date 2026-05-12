import { formatDuration } from '@/lib/projection'

interface Props {
  avgMins: number | null
  bestMins: number | null
}

export default function FinishProjection({ avgMins, bestMins }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Projected 70.3 finish</h3>
      <p className="text-xs text-gray-500 mb-3">Based on recent sessions · includes 10min transition</p>
      {avgMins == null || bestMins == null ? (
        <p className="text-gray-500 text-sm">Need sessions in all three disciplines to project a finish time.</p>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">{formatDuration(bestMins)}</span>
          <span className="text-gray-400 text-sm">–</span>
          <span className="text-xl font-mono text-gray-300">{formatDuration(avgMins)}</span>
          <span className="text-gray-500 text-xs ml-1">(best → avg)</span>
        </div>
      )}
    </div>
  )
}
