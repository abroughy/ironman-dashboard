'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint { date: string; primary: number; secondary?: number }

interface Props {
  title: string
  data: DataPoint[]
  primaryLabel: string
  secondaryLabel?: string
  colour: string
}

export default function DisciplineChart({ title, data, primaryLabel, colour }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      {data.length < 2 ? (
        <p className="text-gray-500 text-xs text-center py-8">Not enough data yet — keep training!</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af', fontSize: 11 }}
              itemStyle={{ color: colour, fontSize: 12 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(v: any) => [typeof v === 'number' ? `${v.toFixed(1)} ${primaryLabel}` : String(v ?? ''), ''] as [string, string]}
            />
            <Line type="monotone" dataKey="primary" stroke={colour} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
