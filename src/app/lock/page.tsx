'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LockPage() {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    document.cookie = `dashboard_secret=${value}; path=/; max-age=2592000`
    // Verify by trying to load home
    const res = await fetch('/', { headers: { 'x-dashboard-secret': value } })
    if (res.ok && !res.url.includes('/lock')) {
      router.push('/')
    } else {
      setError(true)
      document.cookie = 'dashboard_secret=; path=/; max-age=0'
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-white text-2xl font-bold text-center">Training Dashboard</h1>
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter access secret"
          className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-orange-500"
        />
        {error && <p className="text-red-400 text-sm">Incorrect secret</p>}
        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600"
        >
          Enter
        </button>
      </form>
    </main>
  )
}
