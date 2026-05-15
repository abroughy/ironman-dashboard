import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ProfileClient from './ProfileClient'

export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { displayName: true, username: true, avatarUrl: true, shareWithGroup: true },
  })
  if (!user) redirect('/login')

  return (
    <div className="space-y-4 max-w-md mx-auto">
      <h1 className="text-xl font-bold">Profile</h1>
      <ProfileClient
        username={user.username}
        displayName={user.displayName ?? ''}
        avatarUrl={user.avatarUrl ?? null}
        shareWithGroup={user.shareWithGroup}
      />
    </div>
  )
}
