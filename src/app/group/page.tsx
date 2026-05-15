import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import GroupClient from './GroupClient'

export const dynamic = 'force-dynamic'

export default async function GroupPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Group</h1>
      <GroupClient
        currentUserId={session.userId}
        isAdmin={session.isAdmin}
      />
    </div>
  )
}
