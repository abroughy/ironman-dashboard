import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { Pool } from 'pg'
import bcrypt from 'bcryptjs'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

const username = process.env.ADMIN_USERNAME ?? 'arran'
const password = process.env.ADMIN_PASSWORD ?? 'changeme123'

const existing = await prisma.user.findUnique({ where: { username } })
if (existing) {
  console.log(`User "${username}" already exists (id: ${existing.id})`)
  await prisma.$disconnect()
  process.exit(0)
}

const passwordHash = await bcrypt.hash(password, 12)
const user = await prisma.user.create({
  data: {
    username,
    passwordHash,
    displayName: 'Arran',
    isAdmin: true,
    onboarded: false, // will go through onboarding to add first race
  },
})

console.log(`✓ Created admin user:`)
console.log(`  Username : ${username}`)
console.log(`  Password : ${password}`)
console.log(`  ID       : ${user.id}`)
console.log(`\nLog in at your dashboard, then add your races at /races`)
await prisma.$disconnect()
