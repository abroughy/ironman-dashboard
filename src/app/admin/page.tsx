import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminClient from './AdminClient'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const session = await getSession()
  if (!session?.isAdmin) redirect('/')

  return <AdminClient currentUserId={session.userId} />
}
