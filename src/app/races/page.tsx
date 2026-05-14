import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RacesClient from './RacesClient'
export const dynamic = 'force-dynamic'
export default async function RacesPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  return <RacesClient />
}
