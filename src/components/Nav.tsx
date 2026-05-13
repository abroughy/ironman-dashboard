'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const TrophyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8M12 17v4" />
    <path d="M7 4H4a2 2 0 0 0-2 2v2a4 4 0 0 0 4 4h.5" />
    <path d="M17 4h3a2 2 0 0 1 2 2v2a4 4 0 0 1-4 4h-.5" />
    <path d="M7 4a5 5 0 0 0 10 0V2H7v2z" />
  </svg>
)

const links = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/sessions', label: 'Sessions', icon: '🏊' },
  { href: '/plan', label: 'Plan', icon: <CalendarIcon /> },
  { href: '/progress', label: 'Progress', icon: '📈' },
  { href: '/pbs', label: 'PBs', icon: <TrophyIcon /> },
  { href: '/suggestions', label: 'Coaching', icon: '🧠' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center gap-6 px-6 py-3 bg-gray-900 border-b border-gray-800">
        <span className="text-orange-500 font-bold text-lg mr-4">70.3 Dashboard</span>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium ${pathname === l.href ? 'text-orange-400' : 'text-gray-400 hover:text-white'}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs ${pathname === l.href ? 'text-orange-400' : 'text-gray-400'}`}
          >
            <span className="text-xl">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
