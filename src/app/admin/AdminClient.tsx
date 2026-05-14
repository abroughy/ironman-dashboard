'use client'
import { useEffect, useState, useCallback } from 'react'
import { RACE_CONFIGS } from '@/lib/raceConfig'

interface AdminUser {
  id: string
  username: string
  displayName: string
  raceType: string
  raceDate: string | null
  isAdmin: boolean
  onboarded: boolean
  createdAt: string
  _count: { sessions: number }
}

interface CreateForm {
  username: string
  password: string
  displayName: string
  isAdmin: boolean
}

const EMPTY_FORM: CreateForm = { username: '', password: '', displayName: '', isAdmin: false }

function raceLabel(raceType: string) {
  return RACE_CONFIGS[raceType as keyof typeof RACE_CONFIGS]?.label ?? raceType
}

function timeAgo(dateStr: string) {
  const d = new Date(dateStr)
  const diff = Date.now() - d.getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export default function AdminClient({ currentUserId }: { currentUserId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState('')

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/users')
    const data = await res.json()
    setUsers(data)
    setLoading(false)
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  async function createUser() {
    setCreateError('')
    if (!form.username.trim() || !form.password.trim()) {
      setCreateError('Username and password are required')
      return
    }
    setCreating(true)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setCreating(false)
    if (!res.ok) {
      setCreateError(data.error ?? 'Failed to create user')
      return
    }
    setForm(EMPTY_FORM)
    setShowCreate(false)
    showToast(`✓ Created account for ${data.username}`)
    fetchUsers()
  }

  async function deleteUser(id: string) {
    setActionLoading(id)
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    setActionLoading(null)
    setDeleteConfirm(null)
    if (res.ok) {
      showToast('User deleted')
      fetchUsers()
    }
  }

  async function resetOnboarding(id: string) {
    setActionLoading(id + '-reset')
    await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarded: false }),
    })
    setActionLoading(null)
    showToast('Onboarding reset — user will be prompted on next login')
    fetchUsers()
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Admin</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage user accounts</p>
        </div>
        <button
          onClick={() => { setShowCreate(true); setCreateError('') }}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add user
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-lg shadow-lg animate-fade-in">
          {toast}
        </div>
      )}

      {/* Create user modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold">Create account</h2>
            <p className="text-xs text-gray-400">The user will set up their race type on first login.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. johndoe"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Display name <span className="text-gray-600">(optional)</span></label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={e => setForm(f => ({ ...f, displayName: e.target.value }))}
                  placeholder="e.g. John Doe"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Temporary password</label>
                <input
                  type="text"
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  className="w-full bg-gray-800 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-orange-500"
                  autoComplete="new-password"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isAdmin}
                  onChange={e => setForm(f => ({ ...f, isAdmin: e.target.checked }))}
                  className="w-4 h-4 accent-orange-500"
                />
                <span className="text-sm text-gray-300">Admin access</span>
              </label>
            </div>

            {createError && <p className="text-sm text-red-400">{createError}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => { setShowCreate(false); setCreateError('') }}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={createUser}
                disabled={creating}
                className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-red-500/30 rounded-2xl p-6 w-full max-w-sm space-y-4">
            <h2 className="text-base font-semibold text-red-400">Delete user?</h2>
            <p className="text-sm text-gray-300">
              This will permanently delete the account and <strong>all their training sessions</strong>. This cannot be undone.
            </p>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm py-2 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(deleteConfirm)}
                disabled={actionLoading === deleteConfirm}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                {actionLoading === deleteConfirm ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User list */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading…</div>
      ) : (
        <div className="space-y-3">
          {users.map(user => (
            <div key={user.id} className="bg-gray-900 border border-white/5 rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-white">
                      {user.displayName || user.username}
                    </span>
                    {user.username !== user.displayName && user.displayName && (
                      <span className="text-xs text-gray-500">@{user.username}</span>
                    )}
                    {!user.displayName && (
                      <span className="text-xs text-gray-500">@{user.username}</span>
                    )}
                    {user.isAdmin && (
                      <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full font-medium">admin</span>
                    )}
                    {!user.onboarded && (
                      <span className="text-xs bg-yellow-500/15 text-yellow-400 px-1.5 py-0.5 rounded-full">not onboarded</span>
                    )}
                    {user.id === currentUserId && (
                      <span className="text-xs bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-full">you</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                    <span>{raceLabel(user.raceType)}</span>
                    <span>·</span>
                    <span>{user._count.sessions} sessions</span>
                    <span>·</span>
                    <span>Joined {timeAgo(user.createdAt)}</span>
                    {user.raceDate && (
                      <>
                        <span>·</span>
                        <span>Race {new Date(user.raceDate).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </div>

                {user.id !== currentUserId && (
                  <div className="flex items-center gap-2 shrink-0">
                    {user.onboarded && (
                      <button
                        onClick={() => resetOnboarding(user.id)}
                        disabled={actionLoading === user.id + '-reset'}
                        title="Reset onboarding — user will redo race setup on next login"
                        className="text-xs text-gray-500 hover:text-gray-300 px-2 py-1 rounded-lg border border-white/5 hover:border-white/10 transition-colors disabled:opacity-50"
                      >
                        {actionLoading === user.id + '-reset' ? '…' : 'Reset setup'}
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteConfirm(user.id)}
                      title="Delete user"
                      className="text-xs text-red-500 hover:text-red-400 px-2 py-1 rounded-lg border border-red-500/20 hover:border-red-500/40 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="text-center text-xs text-gray-600 pt-2">
        {users.length} {users.length === 1 ? 'user' : 'users'} total
      </div>
    </div>
  )
}
