import pkg from 'pg'
const { Pool } = pkg
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const updated = await prisma.user.updateMany({
  where: { username: { not: { equals: 'username' }, mode: 'insensitive' } },
  // update all users whose username has uppercase chars
  data: {},
})

// Just target the specific broken user by ID
await prisma.user.update({
  where: { id: 'cmp55t59s003d04josw2h82dv' },
  data: { username: 'louis' },
})

console.log('✓ Fixed: Louis → louis')

const users = await prisma.user.findMany({ select: { username: true, displayName: true } })
console.table(users)
await prisma.$disconnect()
