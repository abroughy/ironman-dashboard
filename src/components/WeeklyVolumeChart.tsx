'use client'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { WeeklyVolumePoint } from '@/lib/weeklyVolume'

interface Props {
  data: WeeklyVolumePoint[]
}

export default function WeeklyVolumeChart({ data }: Props) {
  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-4">
      <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Weekly Volume (last 12 weeks)</h2>
      {data.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-8">No session data yet.</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data} margin={{ top: 4, right: 4, left: -10, bottom: 0 }} barCategoryGap="20%">
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
              unit=" km"
            />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af', fontSize: 11 }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any, name: any) => {
                const labels: Record<string, string> = { swim: 'Swim', bike: 'Bike', run: 'Run' }
                return [typeof value === 'number' ? `${value.toFixed(1)} km` : value, labels[name] ?? name] as [string, string]
              }}
            />
            <Bar dataKey="swim" fill="#3b82f6" name="swim" radius={[2, 2, 0, 0]} />
            <Bar dataKey="bike" fill="#f97316" name="bike" radius={[2, 2, 0, 0]} />
            <Bar dataKey="run" fill="#22c55e" name="run" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
