'use client'
import { useState, useRef } from 'react'
import type { ParsedSession } from '@/lib/import'

interface Props { onSaved: () => void }

export default function FileImport({ onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<(ParsedSession & { discipline: string })[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleFile(file: File) {
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/import', { method: 'POST', body: formData })
    if (!res.ok) { setError((await res.json()).error ?? 'Parse failed'); return }
    const { rows: parsed } = await res.json() as { rows: ParsedSession[] }
    setRows(parsed.map(r => ({ ...r, discipline: 'swim' })))
  }

  async function handleConfirm() {
    setSaving(true)
    for (const row of rows) {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row, source: 'import', date: new Date(row.date).toISOString() }),
      })
    }
    setSaving(false)
    setRows([])
    onSaved()
  }

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-gray-500"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <p className="text-gray-400 text-sm">Drop a .csv or .gpx file here, or <span className="text-orange-400">browse</span></p>
        <p className="text-gray-600 text-xs mt-1">CSV format: date, duration_mins, distance_m, avg_hr, notes</p>
        <input ref={inputRef} type="file" accept=".csv,.gpx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">Review {rows.length} session{rows.length > 1 ? 's' : ''} before saving:</p>
          {rows.map((r, i) => (
            <div key={i} className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300">
              {new Date(r.date).toLocaleDateString()} · {r.distanceMetres}m · {Math.round(r.durationSecs / 60)}min
              {r.avgHeartRate ? ` · HR ${r.avgHeartRate}` : ''}
              {r.notes ? ` · "${r.notes}"` : ''}
            </div>
          ))}
          <button onClick={handleConfirm} disabled={saving}
            className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {saving ? 'Saving…' : `Save ${rows.length} session${rows.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
