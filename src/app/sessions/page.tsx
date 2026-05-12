'use client'
import { useEffect, useState, useCallback } from 'react'
import SessionCard from '@/components/SessionCard'
import ManualEntryForm from '@/components/ManualEntryForm'
import FileImport from '@/components/FileImport'

type Tab = 'manual' | 'import'

interface Session {
  id: string; discipline: string; date: string; durationSecs: number
  distanceMetres: number; avgHeartRate?: number | null; perceivedEffort?: number | null
  notes?: string | null; source: string
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [total, setTotal] = useState(0)
  const [discipline, setDiscipline] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<Tab>('manual')

  const fetchSessions = useCallback(async () => {
    const params = new URLSearchParams({ discipline, page: String(page) })
    const res = await fetch(`/api/sessions?${params}`)
    const data = await res.json()
    setSessions(data.sessions)
    setTotal(data.total)
  }, [discipline, page])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  function onSaved() { setModalOpen(false); fetchSessions() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
        <button onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
          + Add swim
        </button>
      </div>

      {/* Discipline filter */}
      <div className="flex gap-2">
        {['all', 'swim', 'bike', 'run'].map(d => (
          <button key={d} onClick={() => { setDiscipline(d); setPage(1) }}
            className={`px-3 py-1 rounded-full text-sm capitalize ${discipline === d ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
            {d}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="space-y-2">
        {sessions.map(s => <SessionCard key={s.id} session={s} />)}
        {sessions.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No sessions found.</p>}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex gap-2 justify-center">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-40">← Prev</button>
          <span className="text-gray-400 text-sm self-center">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-40">Next →</button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Add swim session</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="flex gap-2 border-b border-gray-800 pb-2">
              <button onClick={() => setModalTab('manual')}
                className={`text-sm pb-2 border-b-2 -mb-[9px] ${modalTab === 'manual' ? 'border-orange-500 text-white' : 'border-transparent text-gray-400'}`}>
                Manual entry
              </button>
              <button onClick={() => setModalTab('import')}
                className={`text-sm pb-2 border-b-2 -mb-[9px] ${modalTab === 'import' ? 'border-orange-500 text-white' : 'border-transparent text-gray-400'}`}>
                File import
              </button>
            </div>
            {modalTab === 'manual' ? <ManualEntryForm onSaved={onSaved} /> : <FileImport onSaved={onSaved} />}
          </div>
        </div>
      )}
    </div>
  )
}
