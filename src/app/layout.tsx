import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import Nav from '@/components/Nav'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '70.3 Training Dashboard',
  description: 'Ironman 70.3 training tracker',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} bg-gray-950 text-white min-h-screen`}>
        <Nav />
        <main className="max-w-5xl mx-auto px-4 py-6 pb-20 md:pb-6">
          {children}
        </main>
      </body>
    </html>
  )
}
