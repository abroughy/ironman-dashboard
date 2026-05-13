'use client'
import { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
} from 'recharts'

interface PBEntry {
  sessionId: string
  date: string
  durationSecs: number
  distanceMetres: number
  pace: string
  displayTime: string
}

interface DistanceBracket {
  label: string
  metres: number
  tolerancePct: number
}

interface BracketResult {
  bracket: DistanceBracket
  current: PBEntry | null
  history: PBEntry[]
}

interface DisciplinePBs {
  discipline: 'swim' | 'bike' | 'run'
  brackets: BracketResult[]
}

const DISCIPLINE_CONFIG = {
  swim: {
    label: 'Swim',
    icon: '🏊',
    colour: '#3b82f6',
    textClass: 'text-blue-400',
    borderClass: 'border-blue-500/30',
    headingClass: 'text-blue-400',
  },
  bike: {
    label: 'Bike',
    icon: '🚴',
    colour: '#f97316',
    textClass: 'text-orange-400',
    borderClass: 'border-orange-500/30',
    headingClass: 'text-orange-400',
  },
  run: {
    label: 'Run',
    icon: '🏃',
    colour: '#22c55e',
    textClass: 'text-green-400',
    borderClass: 'border-green-500/30',
    headingClass: 'text-green-400',
  },
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function formatChartDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

// Converts pace string back to seconds for chart Y-axis
function paceToSecs(pace: string, discipline: 'swim' | 'bike' | 'run'): number {
  if (discipline === 'bike') {
    // "X.X km/h" — invert so lower is better (use 1/speed * 1000)
    const kmh = parseFloat(pace)
    return isNaN(kmh) || kmh === 0 ? 0 : Math.round((1 / kmh) * 10000)
  }
  // "M:SS /km" or "M:SS /100m"
  const match = pace.match(/^(\d+):(\d{2})/)
  if (!match) return 0
  return parseInt(match[1]) * 60 + parseInt(match[2])
}

interface PBChartProps {
  history: PBEntry[]
  discipline: 'swim' | 'bike' | 'run'
  colour: string
}

function PBChart({ history, discipline, colour }: PBChartProps) {
  const data = history.map(h => ({
    date: formatChartDate(h.date),
    rawDate: h.date,
    pace: h.pace,
    paceSecs: paceToSecs(h.pace, discipline),
  }))

  if (data.length === 1) {
    return (
      <ResponsiveContainer width="100%" height={80}>
        <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af', fontSize: 10 }}
            itemStyle={{ color: colour, fontSize: 11 }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(_v: any, _n: any, props: any) => [props?.payload?.pace ?? '', 'Pace'] as [string, string]}
          />
          <Line type="monotone" dataKey="paceSecs" stroke={colour} strokeWidth={2} dot={{ r: 4, fill: colour }} />
          <ReferenceDot x={data[0].date} y={data[0].paceSecs} r={4} fill={colour} />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={80}>
      <LineChart data={data} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
        <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#6b7280' }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#9ca3af', fontSize: 10 }}
          itemStyle={{ color: colour, fontSize: 11 }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(_v: any, _n: any, props: any) => [props?.payload?.pace ?? '', 'Pace'] as [string, string]}
        />
        <Line type="monotone" dataKey="paceSecs" stroke={colour} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

interface BracketCardProps {
  result: BracketResult
  discipline: 'swim' | 'bike' | 'run'
}

function BracketCard({ result, discipline }: BracketCardProps) {
  const cfg = DISCIPLINE_CONFIG[discipline]
  const hasPB = result.current !== null

  return (
    <div
      className={`bg-gray-900/60 border rounded-2xl p-4 ${hasPB ? cfg.borderClass : 'border-white/5'}`}
    >
      <p className={`text-xs font-medium uppercase tracking-wide mb-2 ${cfg.textClass}`}>
        {result.bracket.label}
      </p>

      {!hasPB ? (
        <p className="text-gray-600 text-sm py-4 text-center">No data yet</p>
      ) : (
        <>
          <p className="text-2xl font-bold text-white leading-tight">{result.current!.displayTime}</p>
          <p className={`text-sm mt-0.5 ${cfg.textClass}`}>{result.current!.pace}</p>
          <p className="text-xs text-gray-500 mt-1">{formatDate(result.current!.date)}</p>

          {result.history.length > 0 && (
            <div className="mt-3 -mx-1">
              <PBChart history={result.history} discipline={discipline} colour={cfg.colour} />
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default function PBsPage() {
  const [data, setData] = useState<DisciplinePBs[] | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pbs')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold">Personal Bests</h1>

      {loading && (
        <div className="space-y-8">
          {['swim', 'bike', 'run'].map(d => (
            <div key={d} className="space-y-3">
              <div className="h-6 w-24 bg-gray-800 rounded animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="bg-gray-900/60 border border-white/5 rounded-2xl p-4 h-32 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && data && data.map(disc => {
        const cfg = DISCIPLINE_CONFIG[disc.discipline]
        return (
          <section key={disc.discipline}>
            <h2 className={`text-lg font-semibold mb-3 flex items-center gap-2 ${cfg.headingClass}`}>
              <span>{cfg.icon}</span>
              {cfg.label}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {disc.brackets.map(result => (
                <BracketCard
                  key={result.bracket.label}
                  result={result}
                  discipline={disc.discipline}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
