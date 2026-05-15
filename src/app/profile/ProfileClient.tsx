'use client'
import { useState, useRef } from 'react'

interface ProfileClientProps {
  username: string
  displayName: string
  avatarUrl: string | null
  shareWithGroup: boolean
}

export default function ProfileClient({ username, displayName: initialDisplayName, avatarUrl: initialAvatar, shareWithGroup: initialShare }: ProfileClientProps) {
  const [displayName, setDisplayName] = useState(initialDisplayName)
  const [avatarUrl, setAvatarUrl] = useState(initialAvatar)
  const [sharing, setSharing] = useState(initialShare)
  const [savingName, setSavingName] = useState(false)
  const [savingAvatar, setSavingAvatar] = useState(false)
  const [nameMsg, setNameMsg] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleSaveName() {
    setSavingName(true)
    setNameMsg('')
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })
      setNameMsg(res.ok ? 'Saved!' : 'Failed to save')
    } finally {
      setSavingName(false)
    }
  }

  async function handleShareToggle() {
    const next = !sharing
    setSharing(next)
    await fetch('/api/profile/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ share: next }),
    })
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const img = new Image()
      img.onload = async () => {
        // Resize to max 300x300 using canvas
        const canvas = document.createElement('canvas')
        const size = Math.min(img.width, img.height)
        canvas.width = 300
        canvas.height = 300
        const ctx = canvas.getContext('2d')!
        // Center-crop
        const sx = (img.width - size) / 2
        const sy = (img.height - size) / 2
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 300, 300)
        const base64 = canvas.toDataURL('image/jpeg', 0.8)
        setSavingAvatar(true)
        try {
          const res = await fetch('/api/profile/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ avatar: base64 }),
          })
          if (res.ok) setAvatarUrl(base64)
        } finally {
          setSavingAvatar(false)
        }
      }
      img.src = ev.target?.result as string
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="space-y-6">
      {/* Avatar */}
      <div className="bg-gray-900/60 rounded-2xl p-5 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Photo</p>
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-full bg-gray-800 border-2 border-gray-700 overflow-hidden flex items-center justify-center cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
            ) : (
              <svg className="w-10 h-10 text-gray-600" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
              </svg>
            )}
          </div>
          <div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={savingAvatar}
              className="text-sm text-orange-400 hover:text-orange-300 disabled:opacity-40 font-medium"
            >
              {savingAvatar ? 'Uploading…' : 'Change photo'}
            </button>
            <p className="text-xs text-gray-600 mt-1">Resized to 300×300 JPEG</p>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </div>
      </div>

      {/* Display name */}
      <div className="bg-gray-900/60 rounded-2xl p-5 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Display Name</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={displayName}
            onChange={e => { setDisplayName(e.target.value); setNameMsg('') }}
            maxLength={50}
            className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2"
          />
          <button
            onClick={handleSaveName}
            disabled={savingName || !displayName.trim()}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {savingName ? 'Saving…' : 'Save'}
          </button>
        </div>
        {nameMsg && <p className="text-xs text-green-400 mt-2">{nameMsg}</p>}
        <p className="text-xs text-gray-600 mt-2">Username: <span className="text-gray-500">{username}</span></p>
      </div>

      {/* Share with group */}
      <div className="bg-gray-900/60 rounded-2xl p-5 border border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-white">Share with group</p>
            <p className="text-xs text-gray-500 mt-0.5">Let friends see your training on the Group page</p>
          </div>
          <button
            onClick={handleShareToggle}
            className={`relative w-12 h-6 rounded-full transition-colors ${sharing ? 'bg-orange-500' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${sharing ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
    </div>
  )
}
