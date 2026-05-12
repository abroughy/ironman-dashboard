import path from 'node:path'
import { defineConfig } from 'prisma/config'
import * as dotenv from 'dotenv'

// Load .env so DATABASE_URL is available during Prisma CLI operations
dotenv.config({ path: path.resolve(__dirname, '.env') })
// Also load .env.local for Next.js convention (values in .env take precedence if already set)
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL!,
  },
})
