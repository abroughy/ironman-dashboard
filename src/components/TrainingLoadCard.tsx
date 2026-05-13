'use client'
import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { TrainingLoadPoint } from '@/lib/trainingLoad'

function formColour(form: number): string {
  if (form > 5) return 'text-green-400'
  if (form >= -10) return 'text-blue-400'
  return 'text-red-400'
}

function formBorderColour(form: number): string {
  if (form > 5) return 'border-l-green-400'
  if (form >= -10) return 'border-l-blue-400'
  return 'border-l-red-400'
}

function formLabel(form: number): string {
  if (form > 5) return 'Fresh'
  if (form >= -10) return 'Optimal'
  return 'Fatigued'
}

export default function TrainingLoadCard() {
  const [data, setData] = useState<TrainingLoadPoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/training-load')
      .then(r => r.json())
      .then((d: TrainingLoadPoint[]) => setData(d))
      .finally(() => setLoading(false))
  }, [])

  const current = data[data.length - 1]
  // Last 42 days for the chart
  const chartData = data.slice(-42)

  // Show every 2 weeks on x-axis
  const xTickFormatter = (val: string, index: number) => {
    if (index % 14 === 0) {
      const d = new Date(val)
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    }
    return ''
  }

  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4"><div className="w-2 h-2 rounded-full bg-blue-400"/><h2 className="text-sm font-semibold text-gray-300">Training Load</h2></div>

      {loading && (
        <div className="flex justify-center py-8">
          <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && current && (
        <>
          {/* Stat boxes */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-gray-800/40 border border-white/5 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Fitness</p>
              <p className="text-2xl font-bold text-blue-400">{current.ctl.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-0.5">CTL</p>
            </div>
            <div className="bg-gray-800/40 border border-white/5 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">Fatigue</p>
              <p className="text-2xl font-bold text-orange-400">{current.atl.toFixed(1)}</p>
              <p className="text-xs text-gray-500 mt-0.5">ATL</p>
            </div>
            <div className={`bg-gray-800/40 border border-white/5 border-l-2 ${formBorderColour(current.form)} rounded-lg p-3 text-center`}>
              <p className="text-xs text-gray-500 mb-1">Form</p>
              <p className={`text-2xl font-bold ${formColour(current.form)}`}>{current.form.toFixed(1)}</p>
              <p className={`text-xs mt-0.5 ${formColour(current.form)}`}>{formLabel(current.form)}</p>
            </div>
          </div>

          {/* Chart */}
          <ResponsiveContainer width="100%" height={120}>
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 9, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                tickFormatter={xTickFormatter}
              />
              <Tooltip
                contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
                labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any, name: any) => {
                  const labels: Record<string, string> = { ctl: 'Fitness (CTL)', atl: 'Fatigue (ATL)', form: 'Form' }
                  return [typeof value === 'number' ? value.toFixed(1) : value, labels[name] ?? name] as [string, string]
                }}
              />
              <Line type="monotone" dataKey="ctl" stroke="#3b82f6" strokeWidth={2} dot={false} name="ctl" />
              <Line type="monotone" dataKey="atl" stroke="#f97316" strokeWidth={2} dot={false} name="atl" />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {!loading && !current && (
        <p className="text-gray-500 text-sm text-center py-8">No session data yet.</p>
      )}
    </div>
  )
}
