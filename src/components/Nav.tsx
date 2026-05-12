'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/sessions', label: 'Sessions', icon: '🏊' },
  { href: '/progress', label: 'Progress', icon: '📈' },
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
