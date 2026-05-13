'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import type { WeekCompletion } from '@/lib/completion'

interface Props {
  data: WeekCompletion[]
}

function barColour(rate: number): string {
  if (rate >= 80) return '#22c55e'
  if (rate >= 50) return '#f59e0b'
  return '#ef4444'
}

export default function CompletionChart({ data }: Props) {
  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Past 8 Weeks — Completion</h2>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No plan data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }}>
            <XAxis
              dataKey="weekLabel"
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 9, fill: '#6b7280' }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              unit="%"
              label={{ value: 'Completion %', angle: -90, position: 'insideLeft', offset: 14, style: { fontSize: 9, fill: '#6b7280' } }}
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af', fontSize: 11 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, _name: any, props: any) => {
                const entry = props?.payload as WeekCompletion | undefined
                if (entry) {
                  return [`${entry.completed} of ${entry.planned} sessions — ${entry.rate}%`, ''] as [string, string]
                }
                return [typeof value === 'number' ? `${value}%` : value, ''] as [string, string]
              }}
            />
            <Bar dataKey="rate" radius={[2, 2, 0, 0]} name="rate">
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={barColour(entry.rate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
