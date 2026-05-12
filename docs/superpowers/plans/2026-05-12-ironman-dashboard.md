# Ironman 70.3 Training Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal Next.js 14 web dashboard that syncs training sessions from Strava/Zwift, accepts manual swim entry and file import, visualises progress over time, and delivers hybrid AI coaching (rule-based alerts + Claude weekly summaries).

**Architecture:** Next.js 14 App Router with API routes for Strava OAuth/webhook, session CRUD, file import, and Claude coaching. Prisma manages a SQLite (dev) / Postgres (prod) database. Pure TypeScript utility modules handle the rule engine and projection calculations, making them trivially testable without mocking.

**Tech Stack:** Next.js 14, TypeScript, Prisma, Tailwind CSS, Recharts, Anthropic SDK (`@anthropic-ai/sdk`), `fast-xml-parser` (GPX), Vitest (unit tests), Vercel (deployment + cron).

---

## File Map

```
ironman-dashboard/
├── prisma/
│   └── schema.prisma                         # DB schema (Session, StravaToken, CoachingSummary)
├── src/
│   ├── middleware.ts                          # Dashboard secret guard on all routes
│   ├── app/
│   │   ├── layout.tsx                        # Root layout, Nav
│   │   ├── page.tsx                          # Dashboard page
│   │   ├── sessions/page.tsx                 # Sessions list + import modal
│   │   ├── progress/page.tsx                 # Charts + finish projection
│   │   ├── suggestions/page.tsx              # Rule alerts + coaching summary
│   │   ├── lock/page.tsx                     # Shown when DASHBOARD_SECRET missing
│   │   └── api/
│   │       ├── strava/
│   │       │   ├── connect/route.ts          # Redirect to Strava OAuth
│   │       │   ├── callback/route.ts         # Exchange code, store tokens, register webhook
│   │       │   ├── webhook/route.ts          # Receive Strava push events
│   │       │   └── sync/route.ts             # Manual full sync
│   │       ├── sessions/
│   │       │   ├── route.ts                  # GET (list, filter) POST (manual create)
│   │       │   └── [id]/route.ts             # GET session detail
│   │       ├── import/route.ts               # POST CSV/GPX file, returns parsed rows
│   │       ├── coaching/
│   │       │   ├── route.ts                  # GET latest summary
│   │       │   └── regenerate/route.ts       # POST trigger Claude call
│   │       └── cron/
│   │           └── weekly-summary/route.ts   # Vercel cron — auto Monday generation
│   ├── components/
│   │   ├── Nav.tsx                           # Bottom nav bar (mobile) + top nav (desktop)
│   │   ├── PhaseBanner.tsx                   # "Build Phase · N weeks to race"
│   │   ├── LoadRing.tsx                      # Circular progress ring per discipline
│   │   ├── SessionCard.tsx                   # Single session row/card
│   │   ├── SessionDetail.tsx                 # Expanded session view
│   │   ├── ManualEntryForm.tsx               # Swim manual entry form
│   │   ├── FileImport.tsx                    # Drag-drop + confirm table
│   │   ├── DisciplineChart.tsx               # Line chart for one discipline
│   │   ├── LoadChart.tsx                     # Weekly hours bar chart
│   │   ├── FinishProjection.tsx              # Range display card
│   │   ├── AlertBanner.tsx                   # Red/amber/green rule alert
│   │   └── CoachingCard.tsx                  # Claude summary display + regenerate
│   └── lib/
│       ├── db.ts                             # Prisma client singleton
│       ├── config.ts                         # Typed env var accessors
│       ├── strava.ts                         # Strava API client, token refresh, activity mapper
│       ├── rules.ts                          # Pure rule engine — no DB calls
│       ├── projection.ts                     # Pure 70.3 finish time calculator
│       ├── import.ts                         # CSV + GPX parser — returns ParsedSession[]
│       └── coaching.ts                       # Claude API call + prompt builder
├── __tests__/
│   ├── lib/rules.test.ts
│   ├── lib/projection.test.ts
│   └── lib/import.test.ts
├── vercel.json                               # Cron schedule definition
├── .env.local                                # Local env vars (gitignored)
└── next.config.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `.env.local`, `.gitignore`, `vercel.json`

- [ ] **Step 1: Bootstrap Next.js app**

```bash
cd /Users/arranbrough/ironman-dashboard
npx create-next-app@14 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --no-git
```

Expected: Project files created, `npm run dev` starts on port 3000.

- [ ] **Step 2: Install dependencies**

```bash
npm install @prisma/client @anthropic-ai/sdk recharts fast-xml-parser papaparse
npm install --save-dev prisma vitest @vitejs/plugin-react vite-tsconfig-paths @types/papaparse
```

- [ ] **Step 3: Configure Vitest**

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: 'node',
    globals: true,
  },
})
```

- [ ] **Step 4: Create `.env.local`**

```env
DATABASE_URL="file:./dev.db"
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_WEBHOOK_VERIFY_TOKEN=replace-me
ANTHROPIC_API_KEY=
DASHBOARD_SECRET=dev-secret
CRON_SECRET=dev-cron-secret
RACE_DATE=2026-09-01
WEEKLY_TARGETS={"swim":5000,"bike":150000,"run":30000}
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 5: Create `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/weekly-summary",
      "schedule": "0 8 * * 1"
    }
  ]
}
```

- [ ] **Step 6: Add `.superpowers/` to `.gitignore`**

Append to `.gitignore`:
```
.superpowers/
.env.local
dev.db
dev.db-journal
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 14 project with deps"
```

---

## Task 2: Database Schema

**Files:**
- Create: `prisma/schema.prisma`
- Run: `npx prisma migrate dev`

- [ ] **Step 1: Write schema**

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Session {
  id               String     @id @default(cuid())
  discipline       String     // "swim" | "bike" | "run"
  date             DateTime
  durationSecs     Int
  distanceMetres   Float
  avgHeartRate     Int?
  perceivedEffort  Int?
  notes            String?
  source           String     // "strava" | "zwift" | "manual" | "import"
  stravaActivityId String?    @unique
  rawData          String?    // JSON string (SQLite has no JSON type)
  createdAt        DateTime   @default(now())
}

model StravaToken {
  id           String   @id @default("singleton")
  accessToken  String
  refreshToken String
  expiresAt    DateTime
}

model CoachingSummary {
  id          String   @id @default(cuid())
  weekStart   DateTime @unique
  content     String   // JSON string
  generatedAt DateTime @default(now())
}
```

- [ ] **Step 2: Run initial migration**

```bash
npx prisma migrate dev --name init
```

Expected output: `✔  Generated Prisma Client`

- [ ] **Step 3: Commit**

```bash
git add prisma/
git commit -m "feat: add Prisma schema and initial migration"
```

---

## Task 3: Config & DB Singleton

**Files:**
- Create: `src/lib/config.ts`, `src/lib/db.ts`

- [ ] **Step 1: Write `src/lib/config.ts`**

```typescript
export const config = {
  dashboardSecret: process.env.DASHBOARD_SECRET ?? '',
  cronSecret: process.env.CRON_SECRET ?? '',
  raceDate: new Date(process.env.RACE_DATE ?? '2026-09-01'),
  weeklyTargets: JSON.parse(process.env.WEEKLY_TARGETS ?? '{"swim":5000,"bike":150000,"run":30000}') as {
    swim: number
    bike: number
    run: number
  },
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID ?? '',
    clientSecret: process.env.STRAVA_CLIENT_SECRET ?? '',
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN ?? '',
  },
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
}

export function weeksToRace(): number {
  const now = new Date()
  const ms = config.raceDate.getTime() - now.getTime()
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24 * 7)))
}

export function currentPhase(): string {
  const weeks = weeksToRace()
  if (weeks > 12) return 'Build'
  if (weeks > 6) return 'Peak'
  if (weeks > 2) return 'Taper'
  return 'Race Week'
}
```

- [ ] **Step 2: Write `src/lib/db.ts`**

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['error'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/
git commit -m "feat: add db singleton and config helpers"
```

---

## Task 4: Middleware (Dashboard Secret Guard)

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: Write middleware**

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const secret = process.env.DASHBOARD_SECRET
  if (!secret) return NextResponse.next()

  const { pathname } = request.nextUrl

  // Always allow the lock page and its assets
  if (pathname.startsWith('/lock')) return NextResponse.next()
  // Allow API routes through (they validate separately where needed)
  if (pathname.startsWith('/api')) return NextResponse.next()

  const cookie = request.cookies.get('dashboard_secret')?.value
  const header = request.headers.get('x-dashboard-secret')

  if (cookie === secret || header === secret) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/lock'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

- [ ] **Step 2: Create lock page `src/app/lock/page.tsx`**

```tsx
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LockPage() {
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    document.cookie = `dashboard_secret=${value}; path=/; max-age=2592000`
    // Verify by trying to load home
    const res = await fetch('/', { headers: { 'x-dashboard-secret': value } })
    if (res.ok && !res.url.includes('/lock')) {
      router.push('/')
    } else {
      setError(true)
      document.cookie = 'dashboard_secret=; path=/; max-age=0'
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-950 p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-white text-2xl font-bold text-center">Training Dashboard</h1>
        <input
          type="password"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter access secret"
          className="w-full px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-orange-500"
        />
        {error && <p className="text-red-400 text-sm">Incorrect secret</p>}
        <button
          type="submit"
          className="w-full py-2 rounded-lg bg-orange-500 text-white font-semibold hover:bg-orange-600"
        >
          Enter
        </button>
      </form>
    </main>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts src/app/lock/
git commit -m "feat: add dashboard secret middleware and lock page"
```

---

## Task 5: Rule Engine (TDD)

**Files:**
- Create: `src/lib/rules.ts`, `__tests__/lib/rules.test.ts`

- [ ] **Step 1: Define types and write failing tests**

Create `__tests__/lib/rules.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { runRules, type RuleInput, type Alert } from '@/lib/rules'

function makeSession(overrides: Partial<RuleInput['sessions'][0]>): RuleInput['sessions'][0] {
  return {
    discipline: 'run',
    date: new Date(),
    durationSecs: 3600,
    distanceMetres: 10000,
    perceivedEffort: 5,
    source: 'strava',
    ...overrides,
  }
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

describe('runRules', () => {
  it('returns green when no issues', () => {
    const alerts = runRules({
      sessions: [
        makeSession({ discipline: 'swim', date: daysAgo(2) }),
        makeSession({ discipline: 'bike', date: daysAgo(4) }),
        makeSession({ discipline: 'run', date: daysAgo(1) }),
      ],
      weeksToRace: 20,
      currentWeekVolume: { swim: 4000, bike: 100000, run: 25000 },
      lastWeekVolume: { swim: 4000, bike: 100000, run: 25000 },
    })
    expect(alerts.some(a => a.severity === 'green')).toBe(true)
    expect(alerts.every(a => a.severity !== 'red' && a.severity !== 'amber')).toBe(true)
  })

  it('flags discipline neglect when no swim in 11 days', () => {
    const alerts = runRules({
      sessions: [makeSession({ discipline: 'swim', date: daysAgo(11) })],
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const neglect = alerts.find(a => a.rule === 'discipline_neglect')
    expect(neglect).toBeDefined()
    expect(neglect?.severity).toBe('amber')
    expect(neglect?.message).toContain('swim')
  })

  it('flags overtraining for 3+ consecutive hard efforts', () => {
    const alerts = runRules({
      sessions: [
        makeSession({ date: daysAgo(1), perceivedEffort: 8 }),
        makeSession({ date: daysAgo(2), perceivedEffort: 9 }),
        makeSession({ date: daysAgo(3), perceivedEffort: 7 }),
      ],
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const overtraining = alerts.find(a => a.rule === 'overtraining')
    expect(overtraining).toBeDefined()
    expect(overtraining?.severity).toBe('red')
  })

  it('flags rest deficit when all 7 days have sessions', () => {
    const sessions = Array.from({ length: 7 }, (_, i) =>
      makeSession({ date: daysAgo(i) })
    )
    const alerts = runRules({
      sessions,
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const rest = alerts.find(a => a.rule === 'rest_deficit')
    expect(rest).toBeDefined()
    expect(rest?.severity).toBe('amber')
  })

  it('flags volume drop when current week is 31% below last week', () => {
    const alerts = runRules({
      sessions: [],
      weeksToRace: 20,
      currentWeekVolume: { swim: 0, bike: 69000, run: 0 },
      lastWeekVolume: { swim: 0, bike: 100000, run: 0 },
    })
    const drop = alerts.find(a => a.rule === 'volume_drop')
    expect(drop).toBeDefined()
    expect(drop?.message).toContain('bike')
  })

  it('flags taper reminder when 5 weeks to race', () => {
    const alerts = runRules({
      sessions: [],
      weeksToRace: 5,
      currentWeekVolume: { swim: 0, bike: 0, run: 0 },
      lastWeekVolume: { swim: 0, bike: 0, run: 0 },
    })
    const taper = alerts.find(a => a.rule === 'taper_reminder')
    expect(taper).toBeDefined()
    expect(taper?.severity).toBe('phase')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- __tests__/lib/rules.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/rules'`

- [ ] **Step 3: Implement `src/lib/rules.ts`**

```typescript
export type Discipline = 'swim' | 'bike' | 'run'
export type Severity = 'red' | 'amber' | 'green' | 'phase'

export interface SessionSummary {
  discipline: Discipline | string
  date: Date
  durationSecs: number
  distanceMetres: number
  perceivedEffort?: number | null
  source: string
}

export interface RuleInput {
  sessions: SessionSummary[]
  weeksToRace: number
  currentWeekVolume: Record<Discipline, number>
  lastWeekVolume: Record<Discipline, number>
}

export interface Alert {
  rule: string
  severity: Severity
  message: string
}

const DISCIPLINES: Discipline[] = ['swim', 'bike', 'run']

function daysBetween(a: Date, b: Date): number {
  return Math.abs(a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24)
}

export function runRules(input: RuleInput): Alert[] {
  const alerts: Alert[] = []
  const now = new Date()

  // Discipline neglect: no session of a discipline in 10+ days
  for (const disc of DISCIPLINES) {
    const last = input.sessions
      .filter(s => s.discipline === disc)
      .sort((a, b) => b.date.getTime() - a.date.getTime())[0]
    if (!last || daysBetween(last.date, now) >= 10) {
      alerts.push({
        rule: 'discipline_neglect',
        severity: 'amber',
        message: `No ${disc} session in ${last ? Math.floor(daysBetween(last.date, now)) : 'many'} days`,
      })
    }
  }

  // Overtraining: 3+ consecutive sessions with effort >= 7
  const hardSessions = [...input.sessions]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, 10)
  let consecutive = 0
  for (const s of hardSessions) {
    if ((s.perceivedEffort ?? 0) >= 7) {
      consecutive++
      if (consecutive >= 3) {
        alerts.push({
          rule: 'overtraining',
          severity: 'red',
          message: `${consecutive} hard sessions in a row — rest tomorrow`,
        })
        break
      }
    } else {
      break
    }
  }

  // Rest deficit: all 7 of the last 7 days have sessions
  const last7Days = new Set(
    input.sessions
      .filter(s => daysBetween(s.date, now) < 7)
      .map(s => s.date.toDateString())
  )
  if (last7Days.size >= 7) {
    alerts.push({
      rule: 'rest_deficit',
      severity: 'amber',
      message: 'No rest day in the last 7 days',
    })
  }

  // Volume drop: any discipline down >30% vs last week
  for (const disc of DISCIPLINES) {
    const curr = input.currentWeekVolume[disc]
    const prev = input.lastWeekVolume[disc]
    if (prev > 0 && curr < prev * 0.7) {
      alerts.push({
        rule: 'volume_drop',
        severity: 'amber',
        message: `${disc} volume down ${Math.round((1 - curr / prev) * 100)}% vs last week`,
      })
    }
  }

  // Taper reminder
  if (input.weeksToRace > 0 && input.weeksToRace <= 6) {
    alerts.push({
      rule: 'taper_reminder',
      severity: 'phase',
      message: `Race in ${input.weeksToRace} week${input.weeksToRace === 1 ? '' : 's'} — consider starting taper`,
    })
  }

  // Green if no red/amber
  if (!alerts.some(a => a.severity === 'red' || a.severity === 'amber')) {
    alerts.push({
      rule: 'on_track',
      severity: 'green',
      message: 'On track across all disciplines this week',
    })
  }

  return alerts
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- __tests__/lib/rules.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/rules.ts __tests__/lib/rules.test.ts
git commit -m "feat: add rule engine with tests"
```

---

## Task 6: Projection Calculator (TDD)

**Files:**
- Create: `src/lib/projection.ts`, `__tests__/lib/projection.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/projection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calculateProjection, formatDuration, type ProjectionInput } from '@/lib/projection'

describe('calculateProjection', () => {
  it('calculates a round-trip estimate from known paces', () => {
    // Swim: 2:00/100m → 1.9km = 38 mins
    // Bike: 30km/h → 90km = 180 mins
    // Run: 6:00/km → 21.1km = 126.6 mins
    // Total + 10 transition = 354.6 mins ≈ 5h 54m
    const result = calculateProjection({
      swimSessions: [{ distanceMetres: 1000, durationSecs: 1200 }], // 2:00/100m
      bikeSessions: [{ distanceMetres: 30000, durationSecs: 3600 }], // 30 km/h
      runSessions: [{ distanceMetres: 10000, durationSecs: 3600 }],  // 6:00/km
    })
    expect(result.avgMins).toBeCloseTo(354.6, 0)
  })

  it('returns null when a discipline has no sessions', () => {
    const result = calculateProjection({
      swimSessions: [],
      bikeSessions: [{ distanceMetres: 30000, durationSecs: 3600 }],
      runSessions: [{ distanceMetres: 10000, durationSecs: 3600 }],
    })
    expect(result.avgMins).toBeNull()
    expect(result.bestMins).toBeNull()
  })

  it('best estimate uses best pace per discipline', () => {
    const result = calculateProjection({
      swimSessions: [
        { distanceMetres: 1000, durationSecs: 1200 }, // 2:00/100m
        { distanceMetres: 1000, durationSecs: 1000 }, // 1:40/100m (best)
      ],
      bikeSessions: [{ distanceMetres: 30000, durationSecs: 3600 }],
      runSessions: [{ distanceMetres: 10000, durationSecs: 3600 }],
    })
    expect(result.bestMins).toBeLessThan(result.avgMins!)
  })
})

describe('formatDuration', () => {
  it('formats minutes to h:mm', () => {
    expect(formatDuration(354.6)).toBe('5h 54m')
    expect(formatDuration(60)).toBe('1h 00m')
    expect(formatDuration(90)).toBe('1h 30m')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- __tests__/lib/projection.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/projection.ts`**

```typescript
export interface SessionPace {
  distanceMetres: number
  durationSecs: number
}

export interface ProjectionInput {
  swimSessions: SessionPace[]
  bikeSessions: SessionPace[]
  runSessions: SessionPace[]
}

export interface ProjectionResult {
  avgMins: number | null
  bestMins: number | null
  breakdown: {
    avg: { swimMins: number | null; bikeMins: number | null; runMins: number | null }
    best: { swimMins: number | null; bikeMins: number | null; runMins: number | null }
  }
}

const TRANSITION_MINS = 10

function avgPaceSecsPerUnit(sessions: SessionPace[], unitMetres: number): number | null {
  if (sessions.length === 0) return null
  const paces = sessions.map(s => (s.durationSecs / s.distanceMetres) * unitMetres)
  return paces.reduce((a, b) => a + b, 0) / paces.length
}

function bestPaceSecsPerUnit(sessions: SessionPace[], unitMetres: number): number | null {
  if (sessions.length === 0) return null
  return Math.min(...sessions.map(s => (s.durationSecs / s.distanceMetres) * unitMetres))
}

export function calculateProjection(input: ProjectionInput): ProjectionResult {
  // Swim: pace per 100m, target 1900m
  const avgSwimSecs = avgPaceSecsPerUnit(input.swimSessions, 100)
  const bestSwimSecs = bestPaceSecsPerUnit(input.swimSessions, 100)
  const avgSwimMins = avgSwimSecs != null ? (avgSwimSecs * 19) / 60 : null
  const bestSwimMins = bestSwimSecs != null ? (bestSwimSecs * 19) / 60 : null

  // Bike: speed in m/s, target 90000m
  const avgBikeSpeedMs = input.bikeSessions.length > 0
    ? input.bikeSessions.reduce((sum, s) => sum + s.distanceMetres / s.durationSecs, 0) / input.bikeSessions.length
    : null
  const bestBikeSpeedMs = input.bikeSessions.length > 0
    ? Math.max(...input.bikeSessions.map(s => s.distanceMetres / s.durationSecs))
    : null
  const avgBikeMins = avgBikeSpeedMs != null ? 90000 / avgBikeSpeedMs / 60 : null
  const bestBikeMins = bestBikeSpeedMs != null ? 90000 / bestBikeSpeedMs / 60 : null

  // Run: pace per km, target 21.1km
  const avgRunSecs = avgPaceSecsPerUnit(input.runSessions, 1000)
  const bestRunSecs = bestPaceSecsPerUnit(input.runSessions, 1000)
  const avgRunMins = avgRunSecs != null ? (avgRunSecs * 21.1) / 60 : null
  const bestRunMins = bestRunSecs != null ? (bestRunSecs * 21.1) / 60 : null

  const canCalculate = (v: number | null): v is number => v != null

  const avgMins = [avgSwimMins, avgBikeMins, avgRunMins].every(canCalculate)
    ? avgSwimMins! + avgBikeMins! + avgRunMins! + TRANSITION_MINS
    : null

  const bestMins = [bestSwimMins, bestBikeMins, bestRunMins].every(canCalculate)
    ? bestSwimMins! + bestBikeMins! + bestRunMins! + TRANSITION_MINS
    : null

  return {
    avgMins,
    bestMins,
    breakdown: {
      avg: { swimMins: avgSwimMins, bikeMins: avgBikeMins, runMins: avgRunMins },
      best: { swimMins: bestSwimMins, bikeMins: bestBikeMins, runMins: bestRunMins },
    },
  }
}

export function formatDuration(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return `${h}h ${m.toString().padStart(2, '0')}m`
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- __tests__/lib/projection.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/projection.ts __tests__/lib/projection.test.ts
git commit -m "feat: add 70.3 finish time projection with tests"
```

---

## Task 7: CSV/GPX Import Parser (TDD)

**Files:**
- Create: `src/lib/import.ts`, `__tests__/lib/import.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/lib/import.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { parseCSV, parseGPX, type ParsedSession } from '@/lib/import'

describe('parseCSV', () => {
  it('parses a valid CSV row', () => {
    const csv = `date,duration_mins,distance_m,avg_hr,notes
2026-05-10,45,1800,145,bilateral breathing drills`
    const rows = parseCSV(csv)
    expect(rows).toHaveLength(1)
    expect(rows[0].distanceMetres).toBe(1800)
    expect(rows[0].durationSecs).toBe(45 * 60)
    expect(rows[0].avgHeartRate).toBe(145)
    expect(rows[0].notes).toBe('bilateral breathing drills')
    expect(rows[0].date.toISOString().startsWith('2026-05-10')).toBe(true)
  })

  it('handles optional fields being absent', () => {
    const csv = `date,duration_mins,distance_m,avg_hr,notes
2026-05-10,30,1000,,`
    const rows = parseCSV(csv)
    expect(rows[0].avgHeartRate).toBeNull()
    expect(rows[0].notes).toBeNull()
  })

  it('throws on missing required fields', () => {
    const csv = `date,duration_mins
2026-05-10,30`
    expect(() => parseCSV(csv)).toThrow()
  })
})

describe('parseGPX', () => {
  it('extracts total distance and duration from GPX', () => {
    const gpx = `<?xml version="1.0"?>
<gpx xmlns="http://www.topografix.com/GPX/1/1">
  <trk>
    <trkseg>
      <trkpt lat="51.5" lon="-0.1"><time>2026-05-10T08:00:00Z</time></trkpt>
      <trkpt lat="51.501" lon="-0.1"><time>2026-05-10T08:10:00Z</time></trkpt>
      <trkpt lat="51.502" lon="-0.1"><time>2026-05-10T08:20:00Z</time></trkpt>
    </trkseg>
  </trk>
</gpx>`
    const result = parseGPX(gpx)
    expect(result).not.toBeNull()
    expect(result!.durationSecs).toBe(20 * 60)
    expect(result!.distanceMetres).toBeGreaterThan(0)
    expect(result!.date.toISOString().startsWith('2026-05-10')).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npm test -- __tests__/lib/import.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/import.ts`**

```typescript
import Papa from 'papaparse'
import { XMLParser } from 'fast-xml-parser'

export interface ParsedSession {
  date: Date
  durationSecs: number
  distanceMetres: number
  avgHeartRate: number | null
  notes: string | null
}

export function parseCSV(csvText: string): ParsedSession[] {
  const result = Papa.parse<Record<string, string>>(csvText.trim(), {
    header: true,
    skipEmptyLines: true,
  })

  return result.data.map((row, i) => {
    if (!row.date || !row.duration_mins || !row.distance_m) {
      throw new Error(`Row ${i + 1} is missing required fields (date, duration_mins, distance_m)`)
    }
    return {
      date: new Date(row.date),
      durationSecs: parseFloat(row.duration_mins) * 60,
      distanceMetres: parseFloat(row.distance_m),
      avgHeartRate: row.avg_hr && row.avg_hr.trim() !== '' ? parseInt(row.avg_hr) : null,
      notes: row.notes && row.notes.trim() !== '' ? row.notes.trim() : null,
    }
  })
}

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function parseGPX(gpxText: string): ParsedSession | null {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const doc = parser.parse(gpxText)
  const trkseg = doc?.gpx?.trk?.trkseg
  if (!trkseg) return null

  const points: Array<{ lat: number; lon: number; time: Date }> = (
    Array.isArray(trkseg.trkpt) ? trkseg.trkpt : [trkseg.trkpt]
  ).map((pt: Record<string, string>) => ({
    lat: parseFloat(pt['@_lat']),
    lon: parseFloat(pt['@_lon']),
    time: new Date(pt.time),
  }))

  if (points.length < 2) return null

  let distanceMetres = 0
  for (let i = 1; i < points.length; i++) {
    distanceMetres += haversineMetres(
      points[i - 1].lat, points[i - 1].lon,
      points[i].lat, points[i].lon
    )
  }

  const durationSecs = (points[points.length - 1].time.getTime() - points[0].time.getTime()) / 1000

  return {
    date: points[0].time,
    durationSecs,
    distanceMetres,
    avgHeartRate: null,
    notes: null,
  }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npm test -- __tests__/lib/import.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/import.ts __tests__/lib/import.test.ts
git commit -m "feat: add CSV and GPX import parser with tests"
```

---

## Task 8: Strava Client & Token Management

**Files:**
- Create: `src/lib/strava.ts`

- [ ] **Step 1: Write `src/lib/strava.ts`**

```typescript
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'

const STRAVA_BASE = 'https://www.strava.com/api/v3'

export function stravaAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: config.strava.clientId,
    redirect_uri: `${config.appUrl}/api/strava/callback`,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: 'activity:read_all',
  })
  return `https://www.strava.com/oauth/authorize?${params}`
}

export async function exchangeCode(code: string) {
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error(`Strava OAuth exchange failed: ${res.status}`)
  return res.json() as Promise<{ access_token: string; refresh_token: string; expires_at: number }>
}

export async function getValidToken(): Promise<string | null> {
  const token = await prisma.stravaToken.findUnique({ where: { id: 'singleton' } })
  if (!token) return null
  if (token.expiresAt > new Date()) return token.accessToken

  // Refresh
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      refresh_token: token.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  if (!res.ok) return null
  const data = await res.json() as { access_token: string; refresh_token: string; expires_at: number }
  await prisma.stravaToken.update({
    where: { id: 'singleton' },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
    },
  })
  return data.access_token
}

export async function registerWebhook() {
  const res = await fetch(`${STRAVA_BASE}/push_subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: config.strava.clientId,
      client_secret: config.strava.clientSecret,
      callback_url: `${config.appUrl}/api/strava/webhook`,
      verify_token: config.strava.webhookVerifyToken,
    }),
  })
  // 409 means already registered — that's fine
  if (!res.ok && res.status !== 409) {
    console.error('Webhook registration failed', await res.text())
  }
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  start_date: string
  elapsed_time: number
  distance: number
  average_heartrate?: number
  average_watts?: number
}

export function mapActivityToSession(activity: StravaActivity) {
  const typeMap: Record<string, { discipline: string; source: string }> = {
    Run: { discipline: 'run', source: 'strava' },
    Ride: { discipline: 'bike', source: 'strava' },
    VirtualRide: { discipline: 'bike', source: activity.name.toLowerCase().includes('zwift') ? 'zwift' : 'strava' },
  }
  const mapped = typeMap[activity.type]
  if (!mapped) return null

  return {
    discipline: mapped.discipline,
    source: mapped.source,
    date: new Date(activity.start_date),
    durationSecs: activity.elapsed_time,
    distanceMetres: activity.distance,
    avgHeartRate: activity.average_heartrate ? Math.round(activity.average_heartrate) : null,
    stravaActivityId: String(activity.id),
    rawData: JSON.stringify(activity),
    notes: null,
    perceivedEffort: null,
  }
}

export async function syncAllActivities() {
  const token = await getValidToken()
  if (!token) throw new Error('No Strava token')

  let page = 1
  let synced = 0
  while (true) {
    const res = await fetch(`${STRAVA_BASE}/athlete/activities?per_page=100&page=${page}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) break
    const activities: StravaActivity[] = await res.json()
    if (activities.length === 0) break

    for (const activity of activities) {
      const mapped = mapActivityToSession(activity)
      if (!mapped) continue
      await prisma.session.upsert({
        where: { stravaActivityId: mapped.stravaActivityId },
        update: {},
        create: mapped,
      })
      synced++
    }
    page++
  }
  return synced
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/strava.ts
git commit -m "feat: add Strava client with OAuth, token refresh, and activity sync"
```

---

## Task 9: Strava API Routes

**Files:**
- Create: `src/app/api/strava/connect/route.ts`
- Create: `src/app/api/strava/callback/route.ts`
- Create: `src/app/api/strava/webhook/route.ts`
- Create: `src/app/api/strava/sync/route.ts`

- [ ] **Step 1: Create `src/app/api/strava/connect/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { stravaAuthUrl } from '@/lib/strava'

export function GET() {
  return NextResponse.redirect(stravaAuthUrl())
}
```

- [ ] **Step 2: Create `src/app/api/strava/callback/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { exchangeCode, registerWebhook, syncAllActivities } from '@/lib/strava'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ error: 'Missing code' }, { status: 400 })

  const tokens = await exchangeCode(code)
  await prisma.stravaToken.upsert({
    where: { id: 'singleton' },
    update: {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expires_at * 1000),
    },
    create: {
      id: 'singleton',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: new Date(tokens.expires_at * 1000),
    },
  })

  await registerWebhook()
  await syncAllActivities()

  return NextResponse.redirect(new URL('/', request.url))
}
```

- [ ] **Step 3: Create `src/app/api/strava/webhook/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'
import { getValidToken, mapActivityToSession } from '@/lib/strava'

// Strava webhook verification handshake
export function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('hub.mode')
  const token = request.nextUrl.searchParams.get('hub.verify_token')
  const challenge = request.nextUrl.searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === config.strava.webhookVerifyToken) {
    return NextResponse.json({ 'hub.challenge': challenge })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    object_type: string
    object_id: number
    aspect_type: string
    updates?: Record<string, unknown>
  }

  if (body.object_type !== 'activity') return NextResponse.json({ ok: true })

  if (body.aspect_type === 'delete') {
    await prisma.session.deleteMany({
      where: { stravaActivityId: String(body.object_id) },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.aspect_type === 'create' || body.aspect_type === 'update') {
    const token = await getValidToken()
    if (!token) return NextResponse.json({ error: 'No token' }, { status: 500 })

    const res = await fetch(`https://www.strava.com/api/v3/activities/${body.object_id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 502 })

    const activity = await res.json()
    const mapped = mapActivityToSession(activity)
    if (!mapped) return NextResponse.json({ ok: true })

    await prisma.session.upsert({
      where: { stravaActivityId: mapped.stravaActivityId },
      update: mapped,
      create: mapped,
    })
  }

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 4: Create `src/app/api/strava/sync/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { syncAllActivities } from '@/lib/strava'

export async function POST() {
  try {
    const synced = await syncAllActivities()
    return NextResponse.json({ synced })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/strava/
git commit -m "feat: add Strava OAuth callback, webhook, and manual sync routes"
```

---

## Task 10: Sessions API Routes

**Files:**
- Create: `src/app/api/sessions/route.ts`
- Create: `src/app/api/sessions/[id]/route.ts`

- [ ] **Step 1: Create `src/app/api/sessions/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const discipline = params.get('discipline')
  const from = params.get('from')
  const to = params.get('to')
  const page = parseInt(params.get('page') ?? '1')
  const pageSize = 20

  const where = {
    ...(discipline && discipline !== 'all' ? { discipline } : {}),
    ...(from || to
      ? {
          date: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
  }

  const [sessions, total] = await Promise.all([
    prisma.session.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true, discipline: true, date: true, durationSecs: true,
        distanceMetres: true, avgHeartRate: true, perceivedEffort: true,
        notes: true, source: true, stravaActivityId: true, createdAt: true,
      },
    }),
    prisma.session.count({ where }),
  ])

  return NextResponse.json({ sessions, total, page, pageSize })
}

export async function POST(request: NextRequest) {
  const body = await request.json() as {
    discipline: string
    date: string
    durationSecs: number
    distanceMetres: number
    avgHeartRate?: number
    perceivedEffort?: number
    notes?: string
    source?: string
  }

  const session = await prisma.session.create({
    data: {
      discipline: body.discipline,
      date: new Date(body.date),
      durationSecs: body.durationSecs,
      distanceMetres: body.distanceMetres,
      avgHeartRate: body.avgHeartRate ?? null,
      perceivedEffort: body.perceivedEffort ?? null,
      notes: body.notes ?? null,
      source: body.source ?? 'manual',
    },
  })

  return NextResponse.json(session, { status: 201 })
}
```

- [ ] **Step 2: Create `src/app/api/sessions/[id]/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(_: NextRequest, { params }: { params: { id: string } }) {
  const session = await prisma.session.findUnique({ where: { id: params.id } })
  if (!session) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(session)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/sessions/
git commit -m "feat: add sessions API routes (list, create, detail)"
```

---

## Task 11: File Import API Route

**Files:**
- Create: `src/app/api/import/route.ts`

- [ ] **Step 1: Create `src/app/api/import/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { parseCSV, parseGPX } from '@/lib/import'

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 })

  const text = await file.text()
  const filename = file.name.toLowerCase()

  try {
    if (filename.endsWith('.csv')) {
      const rows = parseCSV(text)
      return NextResponse.json({ rows })
    }
    if (filename.endsWith('.gpx')) {
      const row = parseGPX(text)
      if (!row) return NextResponse.json({ error: 'Could not parse GPX' }, { status: 422 })
      return NextResponse.json({ rows: [row] })
    }
    return NextResponse.json({ error: 'Unsupported file type — use .csv or .gpx' }, { status: 415 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 422 })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/import/
git commit -m "feat: add CSV/GPX file import API route"
```

---

## Task 12: Claude Coaching Integration

**Files:**
- Create: `src/lib/coaching.ts`
- Create: `src/app/api/coaching/route.ts`
- Create: `src/app/api/coaching/regenerate/route.ts`
- Create: `src/app/api/cron/weekly-summary/route.ts`

- [ ] **Step 1: Write `src/lib/coaching.ts`**

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { prisma } from '@/lib/db'
import { config, currentPhase, weeksToRace } from '@/lib/config'
import { runRules } from '@/lib/rules'

export interface CoachingSummaryContent {
  wentWell: string
  weakness: string
  nextFocus: string
  projectedFinish: { avg: string; best: string } | null
}

function startOfWeek(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  d.setHours(0, 0, 0, 0)
  return d
}

export async function generateWeeklySummary(): Promise<CoachingSummaryContent> {
  const fourWeeksAgo = new Date()
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

  const sessions = await prisma.session.findMany({
    where: { date: { gte: fourWeeksAgo } },
    orderBy: { date: 'desc' },
  })

  // Personal bests
  const bests: Record<string, { pace: number | null; distance: number }> = {
    swim: { pace: null, distance: 0 },
    bike: { pace: null, distance: 0 },
    run: { pace: null, distance: 0 },
  }
  for (const s of sessions) {
    const disc = s.discipline as 'swim' | 'bike' | 'run'
    if (!bests[disc]) continue
    if (s.distanceMetres > bests[disc].distance) bests[disc].distance = s.distanceMetres
    const pace = s.durationSecs / s.distanceMetres
    if (bests[disc].pace === null || pace < bests[disc].pace!) bests[disc].pace = pace
  }

  // Rule alerts
  const now = new Date()
  const weekStart = startOfWeek(now)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  function weekVolume(from: Date, to: Date) {
    return { swim: 0, bike: 0, run: 0, ...Object.fromEntries(
      ['swim', 'bike', 'run'].map(d => [
        d,
        sessions
          .filter(s => s.discipline === d && s.date >= from && s.date < to)
          .reduce((sum, s) => sum + s.distanceMetres, 0),
      ])
    )} as { swim: number; bike: number; run: number }
  }

  const alerts = runRules({
    sessions: sessions.map(s => ({ ...s, date: s.date })),
    weeksToRace: weeksToRace(),
    currentWeekVolume: weekVolume(weekStart, now),
    lastWeekVolume: weekVolume(lastWeekStart, weekStart),
  })

  const alertSummary = alerts.map(a => `[${a.severity.toUpperCase()}] ${a.message}`).join('\n')
  const sessionSummary = sessions
    .slice(0, 20)
    .map(s => `${s.date.toISOString().split('T')[0]} ${s.discipline} ${(s.distanceMetres / 1000).toFixed(1)}km ${Math.round(s.durationSecs / 60)}min effort=${s.perceivedEffort ?? '?'} notes="${s.notes ?? ''}"`)
    .join('\n')

  const prompt = `You are a triathlon coach. Analyse the athlete's last 4 weeks of training and provide a structured weekly summary. Respond with valid JSON only — no markdown, no explanation.

ATHLETE CONTEXT:
- Race: Ironman 70.3 (1.9km swim, 90km bike, 21.1km run)
- Race date: September 2026 (${weeksToRace()} weeks away)
- Current phase: ${currentPhase()}

RECENT SESSIONS (newest first):
${sessionSummary}

AUTOMATED ALERTS:
${alertSummary}

PERSONAL BESTS (last 4 weeks):
- Swim: ${bests.swim.distance}m, pace ${bests.swim.pace ? (bests.swim.pace * 100).toFixed(0) + 's/100m' : 'n/a'}
- Bike: ${bests.bike.distance}m, pace ${bests.bike.pace ? (1 / bests.bike.pace * 3.6).toFixed(1) + 'km/h' : 'n/a'}
- Run: ${bests.run.distance}m, pace ${bests.run.pace ? (bests.run.pace / 60).toFixed(2) + 'min/km' : 'n/a'}

Respond with this exact JSON structure:
{
  "wentWell": "2-3 sentences on what the athlete did well this week",
  "weakness": "1-2 sentences on the main area needing attention",
  "nextFocus": "1 specific, actionable recommendation for next week",
  "projectedFinish": { "avg": "Xh XXm", "best": "Xh XXm" }
}`

  const client = new Anthropic({ apiKey: config.anthropicApiKey })
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const parsed = JSON.parse(text) as CoachingSummaryContent

  const weekStartDate = startOfWeek(now)
  await prisma.coachingSummary.upsert({
    where: { weekStart: weekStartDate },
    update: { content: JSON.stringify(parsed), generatedAt: new Date() },
    create: { weekStart: weekStartDate, content: JSON.stringify(parsed) },
  })

  return parsed
}
```

- [ ] **Step 2: Create `src/app/api/coaching/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET() {
  const latest = await prisma.coachingSummary.findFirst({
    orderBy: { generatedAt: 'desc' },
  })
  if (!latest) return NextResponse.json(null)
  return NextResponse.json({
    ...latest,
    content: JSON.parse(latest.content),
  })
}
```

- [ ] **Step 3: Create `src/app/api/coaching/regenerate/route.ts`**

```typescript
import { NextResponse } from 'next/server'
import { generateWeeklySummary } from '@/lib/coaching'

export async function POST() {
  try {
    const summary = await generateWeeklySummary()
    return NextResponse.json(summary)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

- [ ] **Step 4: Create `src/app/api/cron/weekly-summary/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { config } from '@/lib/config'
import { generateWeeklySummary } from '@/lib/coaching'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${config.cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const summary = await generateWeeklySummary()
  return NextResponse.json(summary)
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/coaching.ts src/app/api/coaching/ src/app/api/cron/
git commit -m "feat: add Claude coaching integration and cron route"
```

---

## Task 13: Root Layout & Navigation

**Files:**
- Modify: `src/app/layout.tsx`
- Create: `src/components/Nav.tsx`
- Create: `src/components/PhaseBanner.tsx`

- [ ] **Step 1: Write `src/components/Nav.tsx`**

```tsx
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const links = [
  { href: '/', label: 'Dashboard', icon: '📊' },
  { href: '/sessions', label: 'Sessions', icon: '🏊' },
  { href: '/progress', label: 'Progress', icon: '📈' },
  { href: '/suggestions', label: 'Coaching', icon: '🧠' },
]

export default function Nav() {
  const pathname = usePathname()
  return (
    <>
      {/* Desktop top nav */}
      <nav className="hidden md:flex items-center gap-6 px-6 py-3 bg-gray-900 border-b border-gray-800">
        <span className="text-orange-500 font-bold text-lg mr-4">70.3 Dashboard</span>
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`text-sm font-medium ${pathname === l.href ? 'text-orange-400' : 'text-gray-400 hover:text-white'}`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex z-50">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={`flex-1 flex flex-col items-center py-2 text-xs ${pathname === l.href ? 'text-orange-400' : 'text-gray-400'}`}
          >
            <span className="text-xl">{l.icon}</span>
            {l.label}
          </Link>
        ))}
      </nav>
    </>
  )
}
```

- [ ] **Step 2: Write `src/components/PhaseBanner.tsx`**

```tsx
import { weeksToRace, currentPhase } from '@/lib/config'

export default function PhaseBanner() {
  const weeks = weeksToRace()
  const phase = currentPhase()
  return (
    <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg px-4 py-2 text-sm text-orange-300">
      <span className="font-semibold">{phase} Phase</span>
      {' · '}
      {weeks > 0 ? `${weeks} weeks to race` : 'Race week!'} · September 2026
    </div>
  )
}
```

- [ ] **Step 3: Update `src/app/layout.tsx`**

```tsx
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
```

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/components/Nav.tsx src/components/PhaseBanner.tsx
git commit -m "feat: add root layout, navigation, and phase banner"
```

---

## Task 14: Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`
- Create: `src/components/LoadRing.tsx`
- Create: `src/components/CoachingCard.tsx`

- [ ] **Step 1: Write `src/components/LoadRing.tsx`**

```tsx
interface LoadRingProps {
  discipline: 'swim' | 'bike' | 'run'
  currentMetres: number
  targetMetres: number
}

const colours = { swim: '#3b82f6', bike: '#f97316', run: '#22c55e' }
const labels = { swim: 'Swim', bike: 'Bike', run: 'Run' }

function formatDistance(metres: number, discipline: string): string {
  return discipline === 'swim' ? `${(metres / 1000).toFixed(1)}km` : `${(metres / 1000).toFixed(0)}km`
}

export default function LoadRing({ discipline, currentMetres, targetMetres }: LoadRingProps) {
  const pct = Math.min(currentMetres / targetMetres, 1)
  const r = 36
  const circ = 2 * Math.PI * r
  const colour = colours[discipline]

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="#374151" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={colour} strokeWidth="8"
          strokeDasharray={`${pct * circ} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 44 44)"
        />
        <text x="44" y="48" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
          {Math.round(pct * 100)}%
        </text>
      </svg>
      <span className="text-xs text-gray-400">{labels[discipline]}</span>
      <span className="text-xs text-gray-500">
        {formatDistance(currentMetres, discipline)} / {formatDistance(targetMetres, discipline)}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/CoachingCard.tsx`**

```tsx
'use client'
import { useState } from 'react'
import type { CoachingSummaryContent } from '@/lib/coaching'

interface Props {
  summary: (CoachingSummaryContent & { generatedAt: string }) | null
}

export default function CoachingCard({ summary: initial }: Props) {
  const [summary, setSummary] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  async function handleRegenerate() {
    setLoading(true)
    setConfirming(false)
    const res = await fetch('/api/coaching/regenerate', { method: 'POST' })
    const data = await res.json()
    setSummary({ ...data, generatedAt: new Date().toISOString() })
    setLoading(false)
  }

  if (!summary) {
    return (
      <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
        <p className="text-gray-400 text-sm mb-3">No coaching summary yet.</p>
        <button
          onClick={() => setConfirming(true)}
          className="text-sm text-orange-400 hover:text-orange-300"
        >
          Generate now
        </button>
        {confirming && (
          <div className="mt-2 text-sm text-gray-300">
            This will call the Claude API.{' '}
            <button onClick={handleRegenerate} className="text-orange-400 underline">Confirm</button>
            {' '}·{' '}
            <button onClick={() => setConfirming(false)} className="text-gray-400 underline">Cancel</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-white">Weekly Coaching Summary</h3>
        <button
          onClick={() => setConfirming(true)}
          disabled={loading}
          className="text-xs text-gray-400 hover:text-orange-400"
        >
          {loading ? 'Generating…' : 'Regenerate'}
        </button>
      </div>
      {confirming && !loading && (
        <p className="text-xs text-gray-400">
          This calls the Claude API.{' '}
          <button onClick={handleRegenerate} className="text-orange-400 underline">Confirm</button>
          {' '}·{' '}
          <button onClick={() => setConfirming(false)} className="text-gray-400 underline">Cancel</button>
        </p>
      )}
      <div className="space-y-2 text-sm">
        <div><span className="text-green-400 font-medium">✓ Went well: </span><span className="text-gray-300">{summary.wentWell}</span></div>
        <div><span className="text-amber-400 font-medium">⚠ Watch: </span><span className="text-gray-300">{summary.weakness}</span></div>
        <div><span className="text-blue-400 font-medium">→ Focus: </span><span className="text-gray-300">{summary.nextFocus}</span></div>
        {summary.projectedFinish && (
          <div className="pt-2 border-t border-gray-800 text-gray-400 text-xs">
            Projected finish: <span className="text-white font-mono">{summary.projectedFinish.best} – {summary.projectedFinish.avg}</span>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-600">Generated {new Date(summary.generatedAt).toLocaleDateString()}</p>
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/page.tsx`**

```tsx
import { prisma } from '@/lib/db'
import { config } from '@/lib/config'
import PhaseBanner from '@/components/PhaseBanner'
import LoadRing from '@/components/LoadRing'
import CoachingCard from '@/components/CoachingCard'
import type { CoachingSummaryContent } from '@/lib/coaching'

async function getWeekVolume() {
  const weekStart = new Date()
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + (weekStart.getDay() === 0 ? -6 : 1))
  weekStart.setHours(0, 0, 0, 0)
  const sessions = await prisma.session.findMany({ where: { date: { gte: weekStart } } })
  const vol = { swim: 0, bike: 0, run: 0 }
  for (const s of sessions) {
    if (s.discipline in vol) vol[s.discipline as keyof typeof vol] += s.distanceMetres
  }
  return vol
}

async function getRecentSessions() {
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return prisma.session.findMany({
    where: { date: { gte: sevenDaysAgo } },
    orderBy: { date: 'desc' },
    select: { id: true, discipline: true, date: true, durationSecs: true, distanceMetres: true, source: true },
  })
}

const disciplineColour = { swim: 'bg-blue-500/20 text-blue-300', bike: 'bg-orange-500/20 text-orange-300', run: 'bg-green-500/20 text-green-300' }

export default async function DashboardPage() {
  const [weekVol, recentSessions, stravaToken, latestSummary] = await Promise.all([
    getWeekVolume(),
    getRecentSessions(),
    prisma.stravaToken.findUnique({ where: { id: 'singleton' } }),
    prisma.coachingSummary.findFirst({ orderBy: { generatedAt: 'desc' } }),
  ])

  const summaryContent = latestSummary
    ? { ...(JSON.parse(latestSummary.content) as CoachingSummaryContent), generatedAt: latestSummary.generatedAt.toISOString() }
    : null

  return (
    <div className="space-y-6">
      <PhaseBanner />

      {!stravaToken && (
        <div className="bg-gray-900 rounded-xl p-4 border border-dashed border-gray-700 text-center">
          <p className="text-gray-400 text-sm mb-2">Connect Strava to sync your bike and run sessions</p>
          <a href="/api/strava/connect" className="inline-block px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
            Connect Strava
          </a>
        </div>
      )}

      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3">This week</h2>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800 flex justify-around">
          <LoadRing discipline="swim" currentMetres={weekVol.swim} targetMetres={config.weeklyTargets.swim} />
          <LoadRing discipline="bike" currentMetres={weekVol.bike} targetMetres={config.weeklyTargets.bike} />
          <LoadRing discipline="run" currentMetres={weekVol.run} targetMetres={config.weeklyTargets.run} />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-3">Recent sessions</h2>
        <div className="space-y-2">
          {recentSessions.length === 0 && <p className="text-gray-500 text-sm">No sessions in the last 7 days.</p>}
          {recentSessions.map(s => (
            <div key={s.id} className="bg-gray-900 rounded-lg px-4 py-3 border border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${disciplineColour[s.discipline as keyof typeof disciplineColour] ?? ''}`}>
                  {s.discipline}
                </span>
                <span className="text-sm text-gray-300">{(s.distanceMetres / 1000).toFixed(1)}km</span>
                <span className="text-sm text-gray-500">{Math.round(s.durationSecs / 60)}min</span>
              </div>
              <span className="text-xs text-gray-600">{new Date(s.date).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      </section>

      <CoachingCard summary={summaryContent} />
    </div>
  )
}
```

- [ ] **Step 4: Start dev server and verify dashboard loads**

```bash
npm run dev
```

Open http://localhost:3000. Expected: phase banner, three load rings, recent sessions list, coaching card with generate button.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx src/components/LoadRing.tsx src/components/CoachingCard.tsx
git commit -m "feat: add dashboard page with load rings and coaching card"
```

---

## Task 15: Sessions Page

**Files:**
- Create: `src/app/sessions/page.tsx`
- Create: `src/components/SessionCard.tsx`
- Create: `src/components/ManualEntryForm.tsx`
- Create: `src/components/FileImport.tsx`

- [ ] **Step 1: Write `src/components/SessionCard.tsx`**

```tsx
const sourceLabel: Record<string, string> = { strava: 'Strava', zwift: 'Zwift', manual: 'Manual', import: 'Import' }
const disciplineColour: Record<string, string> = {
  swim: 'text-blue-400', bike: 'text-orange-400', run: 'text-green-400',
}

interface Session {
  id: string; discipline: string; date: string; durationSecs: number
  distanceMetres: number; avgHeartRate?: number | null; perceivedEffort?: number | null
  notes?: string | null; source: string
}

function paceLabel(s: Session): string {
  if (s.discipline === 'swim') {
    const secsPerHundred = (s.durationSecs / s.distanceMetres) * 100
    const m = Math.floor(secsPerHundred / 60)
    const sec = Math.round(secsPerHundred % 60)
    return `${m}:${sec.toString().padStart(2, '0')}/100m`
  }
  if (s.discipline === 'bike') {
    const kmh = (s.distanceMetres / 1000) / (s.durationSecs / 3600)
    return `${kmh.toFixed(1)} km/h`
  }
  const secsPerKm = (s.durationSecs / s.distanceMetres) * 1000
  const m = Math.floor(secsPerKm / 60)
  const sec = Math.round(secsPerKm % 60)
  return `${m}:${sec.toString().padStart(2, '0')}/km`
}

export default function SessionCard({ session, onClick }: { session: Session; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-gray-900 rounded-xl px-4 py-3 border border-gray-800 hover:border-gray-700 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`font-medium text-sm capitalize ${disciplineColour[session.discipline] ?? 'text-white'}`}>
            {session.discipline}
          </span>
          <span className="text-white font-mono text-sm">{(session.distanceMetres / 1000).toFixed(2)}km</span>
          <span className="text-gray-400 text-sm">{Math.floor(session.durationSecs / 60)}min</span>
          <span className="text-gray-500 text-xs hidden sm:block">{paceLabel(session)}</span>
        </div>
        <div className="flex items-center gap-2">
          {session.avgHeartRate && <span className="text-xs text-gray-500">♥ {session.avgHeartRate}</span>}
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
            {sourceLabel[session.source] ?? session.source}
          </span>
          <span className="text-xs text-gray-600">{new Date(session.date).toLocaleDateString()}</span>
        </div>
      </div>
      {session.notes && <p className="text-xs text-gray-500 mt-1 truncate">{session.notes}</p>}
    </button>
  )
}
```

- [ ] **Step 2: Write `src/components/ManualEntryForm.tsx`**

```tsx
'use client'
import { useState } from 'react'

interface Props { onSaved: () => void }

export default function ManualEntryForm({ onSaved }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    date: today, durationMins: '', durationSecs: '', distanceMetres: '',
    avgHeartRate: '', perceivedEffort: '5', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const durationSecs = parseInt(form.durationMins) * 60 + parseInt(form.durationSecs || '0')
    const body = {
      discipline: 'swim',
      date: form.date,
      durationSecs,
      distanceMetres: parseFloat(form.distanceMetres),
      avgHeartRate: form.avgHeartRate ? parseInt(form.avgHeartRate) : undefined,
      perceivedEffort: parseInt(form.perceivedEffort),
      notes: form.notes || undefined,
      source: 'manual',
    }
    const res = await fetch('/api/sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (res.ok) { onSaved() } else { setError('Failed to save session') }
    setSaving(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">Date</label>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" required />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Distance (metres)</label>
          <input type="number" value={form.distanceMetres} onChange={e => set('distanceMetres', e.target.value)}
            placeholder="e.g. 1800" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" required />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Duration (mm:ss)</label>
          <div className="flex gap-1">
            <input type="number" value={form.durationMins} onChange={e => set('durationMins', e.target.value)}
              placeholder="mm" min="0" className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" required />
            <span className="text-gray-400 self-center">:</span>
            <input type="number" value={form.durationSecs} onChange={e => set('durationSecs', e.target.value)}
              placeholder="ss" min="0" max="59" className="w-16 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Avg HR (optional)</label>
          <input type="number" value={form.avgHeartRate} onChange={e => set('avgHeartRate', e.target.value)}
            placeholder="e.g. 145" className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white" />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Perceived effort: {form.perceivedEffort}/10</label>
        <input type="range" min="1" max="10" value={form.perceivedEffort} onChange={e => set('perceivedEffort', e.target.value)}
          className="w-full accent-orange-500" />
      </div>
      <div>
        <label className="text-xs text-gray-400 block mb-1">Notes / stroke focus</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
          placeholder="e.g. bilateral breathing drills, focused on catch"
          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white resize-none h-20" />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      <button type="submit" disabled={saving}
        className="w-full py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 disabled:opacity-50">
        {saving ? 'Saving…' : 'Save swim session'}
      </button>
    </form>
  )
}
```

- [ ] **Step 3: Write `src/components/FileImport.tsx`**

```tsx
'use client'
import { useState, useRef } from 'react'
import type { ParsedSession } from '@/lib/import'

interface Props { onSaved: () => void }

export default function FileImport({ onSaved }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<(ParsedSession & { discipline: string })[]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleFile(file: File) {
    setError('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch('/api/import', { method: 'POST', body: formData })
    if (!res.ok) { setError((await res.json()).error ?? 'Parse failed'); return }
    const { rows: parsed } = await res.json() as { rows: ParsedSession[] }
    setRows(parsed.map(r => ({ ...r, discipline: 'swim' })))
  }

  async function handleConfirm() {
    setSaving(true)
    for (const row of rows) {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...row, source: 'import', date: new Date(row.date).toISOString() }),
      })
    }
    setSaving(false)
    setRows([])
    onSaved()
  }

  return (
    <div className="space-y-4">
      <div
        className="border-2 border-dashed border-gray-700 rounded-xl p-8 text-center cursor-pointer hover:border-gray-500"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
      >
        <p className="text-gray-400 text-sm">Drop a .csv or .gpx file here, or <span className="text-orange-400">browse</span></p>
        <p className="text-gray-600 text-xs mt-1">CSV format: date, duration_mins, distance_m, avg_hr, notes</p>
        <input ref={inputRef} type="file" accept=".csv,.gpx" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </div>
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {rows.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-gray-300">Review {rows.length} session{rows.length > 1 ? 's' : ''} before saving:</p>
          {rows.map((r, i) => (
            <div key={i} className="bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-300">
              {new Date(r.date).toLocaleDateString()} · {r.distanceMetres}m · {Math.round(r.durationSecs / 60)}min
              {r.avgHeartRate ? ` · HR ${r.avgHeartRate}` : ''}
              {r.notes ? ` · "${r.notes}"` : ''}
            </div>
          ))}
          <button onClick={handleConfirm} disabled={saving}
            className="w-full py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50">
            {saving ? 'Saving…' : `Save ${rows.length} session${rows.length > 1 ? 's' : ''}`}
          </button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Write `src/app/sessions/page.tsx`**

```tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import SessionCard from '@/components/SessionCard'
import ManualEntryForm from '@/components/ManualEntryForm'
import FileImport from '@/components/FileImport'

type Tab = 'manual' | 'import'

interface Session {
  id: string; discipline: string; date: string; durationSecs: number
  distanceMetres: number; avgHeartRate?: number | null; perceivedEffort?: number | null
  notes?: string | null; source: string
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [total, setTotal] = useState(0)
  const [discipline, setDiscipline] = useState('all')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<Tab>('manual')

  const fetchSessions = useCallback(async () => {
    const params = new URLSearchParams({ discipline, page: String(page) })
    const res = await fetch(`/api/sessions?${params}`)
    const data = await res.json()
    setSessions(data.sessions)
    setTotal(data.total)
  }, [discipline, page])

  useEffect(() => { fetchSessions() }, [fetchSessions])

  function onSaved() { setModalOpen(false); fetchSessions() }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Sessions</h1>
        <button onClick={() => setModalOpen(true)}
          className="px-4 py-2 bg-orange-500 text-white rounded-lg text-sm font-medium hover:bg-orange-600">
          + Add swim
        </button>
      </div>

      {/* Discipline filter */}
      <div className="flex gap-2">
        {['all', 'swim', 'bike', 'run'].map(d => (
          <button key={d} onClick={() => { setDiscipline(d); setPage(1) }}
            className={`px-3 py-1 rounded-full text-sm capitalize ${discipline === d ? 'bg-orange-500 text-white' : 'bg-gray-800 text-gray-400'}`}>
            {d}
          </button>
        ))}
      </div>

      {/* Session list */}
      <div className="space-y-2">
        {sessions.map(s => <SessionCard key={s.id} session={s} />)}
        {sessions.length === 0 && <p className="text-gray-500 text-sm text-center py-8">No sessions found.</p>}
      </div>

      {/* Pagination */}
      {total > 20 && (
        <div className="flex gap-2 justify-center">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-40">← Prev</button>
          <span className="text-gray-400 text-sm self-center">Page {page} of {Math.ceil(total / 20)}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(total / 20)}
            className="px-3 py-1 bg-gray-800 rounded text-sm disabled:opacity-40">Next →</button>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-end md:items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-2xl w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-lg">Add swim session</h2>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="flex gap-2 border-b border-gray-800 pb-2">
              <button onClick={() => setModalTab('manual')}
                className={`text-sm pb-2 border-b-2 -mb-[9px] ${modalTab === 'manual' ? 'border-orange-500 text-white' : 'border-transparent text-gray-400'}`}>
                Manual entry
              </button>
              <button onClick={() => setModalTab('import')}
                className={`text-sm pb-2 border-b-2 -mb-[9px] ${modalTab === 'import' ? 'border-orange-500 text-white' : 'border-transparent text-gray-400'}`}>
                File import
              </button>
            </div>
            {modalTab === 'manual' ? <ManualEntryForm onSaved={onSaved} /> : <FileImport onSaved={onSaved} />}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Verify sessions page in browser**

Navigate to http://localhost:3000/sessions. Expected: discipline filter tabs, empty state message, "+ Add swim" button opens modal with Manual/File Import tabs.

- [ ] **Step 6: Commit**

```bash
git add src/app/sessions/ src/components/SessionCard.tsx src/components/ManualEntryForm.tsx src/components/FileImport.tsx
git commit -m "feat: add sessions page with manual entry and file import"
```

---

## Task 16: Progress Page

**Files:**
- Create: `src/app/progress/page.tsx`
- Create: `src/components/DisciplineChart.tsx`
- Create: `src/components/FinishProjection.tsx`

- [ ] **Step 1: Write `src/components/DisciplineChart.tsx`**

```tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface DataPoint { date: string; primary: number; secondary?: number }

interface Props {
  title: string
  data: DataPoint[]
  primaryLabel: string
  secondaryLabel?: string
  colour: string
}

export default function DisciplineChart({ title, data, primaryLabel, colour }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-3">{title}</h3>
      {data.length < 2 ? (
        <p className="text-gray-500 text-xs text-center py-8">Not enough data yet — keep training!</p>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af', fontSize: 11 }}
              itemStyle={{ color: colour, fontSize: 12 }}
              formatter={(v: number) => [`${v.toFixed(1)} ${primaryLabel}`, '']}
            />
            <Line type="monotone" dataKey="primary" stroke={colour} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Write `src/components/FinishProjection.tsx`**

```tsx
import { formatDuration } from '@/lib/projection'

interface Props {
  avgMins: number | null
  bestMins: number | null
}

export default function FinishProjection({ avgMins, bestMins }: Props) {
  return (
    <div className="bg-gray-900 rounded-xl p-4 border border-gray-800">
      <h3 className="text-sm font-medium text-gray-300 mb-1">Projected 70.3 finish</h3>
      <p className="text-xs text-gray-500 mb-3">Based on recent sessions · includes 10min transition</p>
      {avgMins == null || bestMins == null ? (
        <p className="text-gray-500 text-sm">Need sessions in all three disciplines to project a finish time.</p>
      ) : (
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono text-white">{formatDuration(bestMins)}</span>
          <span className="text-gray-400 text-sm">–</span>
          <span className="text-xl font-mono text-gray-300">{formatDuration(avgMins)}</span>
          <span className="text-gray-500 text-xs ml-1">(best → avg)</span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Write `src/app/progress/page.tsx`**

```tsx
import { prisma } from '@/lib/db'
import { calculateProjection } from '@/lib/projection'
import DisciplineChart from '@/components/DisciplineChart'
import FinishProjection from '@/components/FinishProjection'

async function getSessionsForProgress() {
  return prisma.session.findMany({
    orderBy: { date: 'asc' },
    select: { discipline: true, date: true, durationSecs: true, distanceMetres: true },
  })
}

type S = { discipline: string; date: Date; durationSecs: number; distanceMetres: number }

function swimDataPoints(sessions: S[]) {
  return sessions
    .filter(s => s.discipline === 'swim' && s.distanceMetres > 0)
    .map(s => ({
      date: s.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      primary: parseFloat(((s.durationSecs / s.distanceMetres) * 100 / 60).toFixed(2)),
    }))
}

function bikeDataPoints(sessions: S[]) {
  return sessions
    .filter(s => s.discipline === 'bike' && s.durationSecs > 0)
    .map(s => ({
      date: s.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      primary: parseFloat(((s.distanceMetres / 1000) / (s.durationSecs / 3600)).toFixed(1)),
    }))
}

function runDataPoints(sessions: S[]) {
  return sessions
    .filter(s => s.discipline === 'run' && s.distanceMetres > 0)
    .map(s => ({
      date: s.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
      primary: parseFloat(((s.durationSecs / s.distanceMetres) * 1000 / 60).toFixed(2)),
    }))
}

export default async function ProgressPage() {
  const sessions = await getSessionsForProgress()

  const last8 = (disc: string) => sessions.filter(s => s.discipline === disc).slice(-8)
  const projection = calculateProjection({
    swimSessions: last8('swim'),
    bikeSessions: last8('bike'),
    runSessions: last8('run'),
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Progress</h1>
      <FinishProjection avgMins={projection.avgMins} bestMins={projection.bestMins} />
      <DisciplineChart title="Swim — pace per 100m (min)" data={swimDataPoints(sessions)} primaryLabel="min/100m" colour="#3b82f6" />
      <DisciplineChart title="Bike — avg speed (km/h)" data={bikeDataPoints(sessions)} primaryLabel="km/h" colour="#f97316" />
      <DisciplineChart title="Run — pace per km (min)" data={runDataPoints(sessions)} primaryLabel="min/km" colour="#22c55e" />
    </div>
  )
}
```

- [ ] **Step 4: Verify progress page in browser**

Navigate to http://localhost:3000/progress. Expected: projection card (shows "need sessions" message), three chart panels each with "Not enough data yet" until sessions are added.

- [ ] **Step 5: Commit**

```bash
git add src/app/progress/ src/components/DisciplineChart.tsx src/components/FinishProjection.tsx
git commit -m "feat: add progress page with discipline charts and finish projection"
```

---

## Task 17: Suggestions Page

**Files:**
- Create: `src/app/suggestions/page.tsx`
- Create: `src/components/AlertBanner.tsx`

- [ ] **Step 1: Write `src/components/AlertBanner.tsx`**

```tsx
import type { Alert } from '@/lib/rules'

const styles: Record<string, string> = {
  red: 'bg-red-500/10 border-red-500/30 text-red-300',
  amber: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
  green: 'bg-green-500/10 border-green-500/30 text-green-300',
  phase: 'bg-blue-500/10 border-blue-500/30 text-blue-300',
}
const icons: Record<string, string> = { red: '🔴', amber: '🟠', green: '🟢', phase: '⏰' }

export default function AlertBanner({ alert }: { alert: Alert }) {
  return (
    <div className={`border rounded-xl px-4 py-3 text-sm flex items-start gap-2 ${styles[alert.severity] ?? styles.amber}`}>
      <span>{icons[alert.severity]}</span>
      <span>{alert.message}</span>
    </div>
  )
}
```

- [ ] **Step 2: Write `src/app/suggestions/page.tsx`**

```tsx
import { prisma } from '@/lib/db'
import { runRules } from '@/lib/rules'
import { weeksToRace } from '@/lib/config'
import { config } from '@/lib/config'
import AlertBanner from '@/components/AlertBanner'
import CoachingCard from '@/components/CoachingCard'
import type { CoachingSummaryContent } from '@/lib/coaching'

async function getSuggestionData() {
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  weekStart.setHours(0, 0, 0, 0)
  const lastWeekStart = new Date(weekStart)
  lastWeekStart.setDate(lastWeekStart.getDate() - 7)

  const sessions = await prisma.session.findMany({ orderBy: { date: 'desc' }, take: 100 })

  function weekVol(from: Date, to: Date) {
    return ['swim', 'bike', 'run'].reduce((acc, d) => ({
      ...acc,
      [d]: sessions.filter(s => s.discipline === d && s.date >= from && s.date < to)
        .reduce((sum, s) => sum + s.distanceMetres, 0),
    }), { swim: 0, bike: 0, run: 0 })
  }

  const alerts = runRules({
    sessions: sessions.map(s => ({ ...s, date: s.date })),
    weeksToRace: weeksToRace(),
    currentWeekVolume: weekVol(weekStart, now),
    lastWeekVolume: weekVol(lastWeekStart, weekStart),
  })

  const latestSummary = await prisma.coachingSummary.findFirst({ orderBy: { generatedAt: 'desc' } })
  const summaryContent = latestSummary
    ? { ...(JSON.parse(latestSummary.content) as CoachingSummaryContent), generatedAt: latestSummary.generatedAt.toISOString() }
    : null

  // Per-discipline stats
  const discStats = ['swim', 'bike', 'run'].map(d => {
    const disc = sessions.filter(s => s.discipline === d)
    const thisWeek = sessions.filter(s => s.discipline === d && s.date >= weekStart)
    return {
      discipline: d,
      totalSessions: disc.length,
      thisWeekKm: thisWeek.reduce((sum, s) => sum + s.distanceMetres, 0) / 1000,
      weeklyTargetKm: config.weeklyTargets[d as keyof typeof config.weeklyTargets] / 1000,
    }
  })

  return { alerts, summaryContent, discStats }
}

export default async function SuggestionsPage() {
  const { alerts, summaryContent, discStats } = await getSuggestionData()

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Coaching</h1>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-gray-400">Alerts</h2>
        {alerts.map((a, i) => <AlertBanner key={i} alert={a} />)}
      </section>

      <CoachingCard summary={summaryContent} />

      <section>
        <h2 className="text-sm font-medium text-gray-400 mb-2">This week by discipline</h2>
        <div className="grid grid-cols-3 gap-3">
          {discStats.map(d => (
            <div key={d.discipline} className="bg-gray-900 rounded-xl p-3 border border-gray-800 text-center">
              <p className="text-xs text-gray-400 capitalize mb-1">{d.discipline}</p>
              <p className="text-lg font-bold text-white">{d.thisWeekKm.toFixed(1)}<span className="text-xs text-gray-500">km</span></p>
              <p className="text-xs text-gray-600">target {d.weeklyTargetKm.toFixed(0)}km</p>
              <p className="text-xs text-gray-500 mt-1">{d.totalSessions} sessions total</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Verify suggestions page in browser**

Navigate to http://localhost:3000/suggestions. Expected: alert banners (discipline neglect for swim/bike/run since DB is empty), coaching card, discipline stats grid.

- [ ] **Step 4: Commit**

```bash
git add src/app/suggestions/ src/components/AlertBanner.tsx
git commit -m "feat: add suggestions page with rule alerts and coaching summary"
```

---

## Task 18: Run Full Test Suite

- [ ] **Step 1: Run all tests**

```bash
npm test
```

Expected: All tests in `__tests__/lib/` pass (rules, projection, import).

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 4: Commit if any fixes were needed**

```bash
git add -A
git commit -m "fix: resolve type errors and lint warnings"
```

---

## Task 19: Deploy to Vercel

- [ ] **Step 1: Push repo to GitHub**

Create a new repo on GitHub (via the GitHub UI), then:

```bash
git remote add origin https://github.com/<your-username>/ironman-dashboard.git
git push -u origin main
```

- [ ] **Step 2: Import project in Vercel**

Go to https://vercel.com/new, import the GitHub repo. Vercel auto-detects Next.js.

- [ ] **Step 3: Add environment variables in Vercel dashboard**

Add all variables from `.env.local` — replace `DATABASE_URL` with your Postgres connection string (Vercel Postgres or Neon.tech both work). Set `NEXT_PUBLIC_APP_URL` to your Vercel deployment URL (e.g. `https://ironman-dashboard.vercel.app`).

- [ ] **Step 4: Run Prisma migration on prod DB**

```bash
DATABASE_URL="<your-postgres-url>" npx prisma migrate deploy
```

- [ ] **Step 5: Register Strava app**

Go to https://www.strava.com/settings/api. Create an app. Set the callback domain to your Vercel URL. Copy `Client ID` and `Client Secret` into Vercel env vars.

- [ ] **Step 6: Connect Strava**

Visit your deployed dashboard. Click "Connect Strava". Authorise. This triggers the initial full sync of all activities.

- [ ] **Step 7: Verify cron is registered**

In the Vercel dashboard → your project → Settings → Cron Jobs. Expected: one cron at `0 8 * * 1` pointing to `/api/cron/weekly-summary`.

---

## Definition of Done

- [ ] All unit tests pass (`npm test`)
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Dashboard page shows load rings and phase banner
- [ ] Strava OAuth connects and syncs activities
- [ ] Swim sessions can be added via manual form
- [ ] CSV/GPX import works with confirmation step
- [ ] Progress charts render with session data
- [ ] Rule engine alerts appear on suggestions page
- [ ] Claude coaching summary generates on demand
- [ ] App is deployed and accessible on Vercel
