import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const users = await prisma.user.findMany({
  select: { id: true, username: true, displayName: true, isAdmin: true, onboarded: true }
})
console.log('Users in DB:')
console.table(users)
await prisma.$disconnect()
