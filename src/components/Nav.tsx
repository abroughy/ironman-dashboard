'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import LogoutButton from '@/components/LogoutButton'

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

const HomeIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
    <polyline points="9 22 9 12 15 12 15 22"/>
  </svg>
)
const ListIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
    <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
  </svg>
)
const ChartIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
  </svg>
)
const BrainIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
)
const AdminIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="8" r="4"/><path d="M6 20v-1a6 6 0 0 1 12 0v1"/>
    <path d="M17 14l1.5 1.5L21 13"/>
  </svg>
)
const FlagIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
    <line x1="4" y1="22" x2="4" y2="15"/>
  </svg>
)

const HeartIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)

const BASE_LINKS = [
  { href: '/', label: 'Dashboard', icon: <HomeIcon /> },
  { href: '/sessions', label: 'Sessions', icon: <ListIcon /> },
  { href: '/races', label: 'Races', icon: <FlagIcon /> },
  { href: '/plan', label: 'Plan', icon: <CalendarIcon /> },
  { href: '/progress', label: 'Progress', icon: <ChartIcon /> },
  { href: '/pbs', label: 'PBs', icon: <TrophyIcon /> },
  { href: '/suggestions', label: 'Coaching', icon: <BrainIcon /> },
  { href: '/recovery', label: 'Recovery', icon: <HeartIcon /> },
]

const ADMIN_LINK = { href: '/admin', label: 'Admin', icon: <AdminIcon /> }

export default function Nav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const links = isAdmin ? [...BASE_LINKS, ADMIN_LINK] : BASE_LINKS

  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center gap-1 px-6 py-0 bg-gray-900/80 backdrop-blur-sm border-b border-white/5 sticky top-0 z-40">
        <span className="text-orange-400 font-bold text-base tracking-tight mr-6 py-4">⚡ 70.3</span>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`px-3 py-4 text-sm font-medium transition-colors duration-150 border-b-2 ${pathname === l.href ? 'text-white border-orange-400' : 'text-gray-500 hover:text-gray-200 border-transparent'}`}
          >
            {l.label}
          </Link>
        ))}
        <div className="ml-auto">
          <LogoutButton />
        </div>
      </nav>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900/90 backdrop-blur-md border-t border-white/5 flex z-50">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs ${pathname === l.href ? 'text-orange-400' : 'text-gray-500'}`}
          >
            {l.icon}
            {pathname === l.href && (
              <span className="w-1 h-1 rounded-full bg-orange-400 mx-auto mt-0.5" />
            )}
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
