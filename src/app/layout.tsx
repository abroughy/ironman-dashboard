import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'
import { getSession } from '@/lib/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '70.3 Training Dashboard',
  description: 'Ironman 70.3 training tracker',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  const isAdmin = session?.isAdmin ?? false

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gradient-to-br from-gray-950 via-gray-950 to-slate-900 text-white min-h-screen`}>
        <Nav isAdmin={isAdmin} />
        <main className="max-w-5xl mx-auto px-4 py-6 pt-20 md:pt-6">
          {children}
        </main>
      </body>
    </html>
  )
}
