interface LoadRingProps {
  discipline: 'swim' | 'bike' | 'run'
  currentMetres: number
  targetMetres: number
}

const colours = { swim: '#3b82f6', bike: '#f97316', run: '#22c55e' }
const glowColours = { swim: '#3b82f620', bike: '#f9731620', run: '#22c55e20' }
const labels = { swim: 'Swim', bike: 'Bike', run: 'Run' }
const labelColours = { swim: 'text-blue-400', bike: 'text-orange-400', run: 'text-green-400' }

function formatDistance(metres: number, discipline: string): string {
  return discipline === 'swim' ? `${(metres / 1000).toFixed(1)}km` : `${(metres / 1000).toFixed(0)}km`
}

export default function LoadRing({ discipline, currentMetres, targetMetres }: LoadRingProps) {
  const pct = Math.min(currentMetres / targetMetres, 1)
  const r = 40
  const circ = 2 * Math.PI * r
  const colour = colours[discipline]

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        {/* Glow ring */}
        <circle cx="50" cy="50" r={r} fill="none" stroke={glowColours[discipline]} strokeWidth="14" />
        {/* Track */}
        <circle cx="50" cy="50" r={r} fill="none" stroke="#1f2937" strokeWidth="7" />
        {/* Progress */}
        <circle
          cx="50" cy="50" r={r} fill="none"
          stroke={colour} strokeWidth="7"
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
        <text x="50" y="54" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span className={`text-xs font-medium ${labelColours[discipline]}`}>{labels[discipline]}</span>
      <span className="text-xs text-gray-400">
        {formatDistance(currentMetres, discipline)} / {formatDistance(targetMetres, discipline)}
      </span>
    </div>
  )
}
