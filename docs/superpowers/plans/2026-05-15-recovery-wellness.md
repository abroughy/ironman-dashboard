# Recovery & Wellness Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a daily wellness check-in (sleep, soreness, energy) that computes a recovery score, shows it on the dashboard, trends it on a dedicated Recovery page, and feeds it into the AI coaching prompt.

**Architecture:** New `WellnessLog` Prisma model stores one row per user per day. A score utility function computes the composite 0–100 score on write. The dashboard server component fetches today's log and the last 2 logs to determine warning state, passes them as props to the `WellnessWidget` client component. A new `/recovery` page shows 14-day history. The existing `generateWeeklySummary` function in `src/lib/coaching.ts` is updated to include the last 7 days of wellness data in its Claude prompt.

**Tech Stack:** Next.js 14 App Router, Prisma 7 + Neon PostgreSQL, TypeScript, Tailwind CSS, Anthropic SDK (existing pattern in `src/lib/coaching.ts`)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `WellnessLog` model and `wellnessLogs` relation on `User` |
| `src/lib/wellness.ts` | Create | `computeScore()` utility — pure function, easy to test |
| `src/app/api/wellness/route.ts` | Create | `POST` (upsert log) and `GET` (last N days) endpoints |
| `src/components/WellnessWidget.tsx` | Create | Client component — check-in form or score display |
| `src/app/page.tsx` | Modify | Fetch today's log + last 2 logs, pass to `WellnessWidget` |
| `src/app/recovery/page.tsx` | Create | Server component — fetches 14-day logs |
| `src/app/recovery/RecoveryClient.tsx` | Create | Client component — bar chart + metric averages |
| `src/components/Nav.tsx` | Modify | Add Recovery link with heart icon |
| `src/lib/coaching.ts` | Modify | Include last 7 days of wellness logs in Claude prompt |

---

## Task 1: Prisma Schema — Add WellnessLog Model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add WellnessLog model and User relation**

Open `prisma/schema.prisma`. Add the following model at the end of the file:

```prisma
model WellnessLog {
  id         String   @id @default(cuid())
  userId     String
  date       DateTime // midnight UTC — represents the calendar day
  sleepHours Float
  soreness   Int      // 1–5 (1 = no soreness, 5 = very sore)
  energy     Int      // 1–5 (1 = exhausted, 5 = great)
  score      Int      // computed composite 0–100
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId])
  @@index([userId, date])
}
```

Also add `wellnessLogs WellnessLog[]` to the `User` model's relation list (alongside `sessions`, `stravaToken`, etc.):

```prisma
model User {
  // ... existing fields ...
  sessions          Session[]
  stravaToken       StravaToken?
  coachingSummaries CoachingSummary[]
  races             Race[]
  wellnessLogs      WellnessLog[]     // ADD THIS LINE
}
```

- [ ] **Step 2: Push schema to Neon**

```bash
cd /Users/arranbrough/ironman-dashboard
npx prisma db push
```

Expected output includes:
```
Your database is now in sync with your Prisma schema.
```

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` (or "already up to date").

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add WellnessLog model to schema"
```

---

## Task 2: Score Utility Function

**Files:**
- Create: `src/lib/wellness.ts`

- [ ] **Step 1: Create the utility with score computation**

Create `src/lib/wellness.ts`:

```typescript
/**
 * Compute a composite recovery score from wellness inputs.
 *
 * Weights:
 *   sleep  40% — normalised from 4h (0) to 9h (100)
 *   energy 35% — 1→0, 5→100
 *   soreness 25% (inverted) — 1→100, 5→0
 *
 * Returns an integer 0–100.
 */
export function computeScore(sleepHours: number, soreness: number, energy: number): number {
  const sleepNorm = Math.min(1, Math.max(0, (sleepHours - 4) / 5)) * 100
  const energyNorm = ((energy - 1) / 4) * 100
  const sorenessInv = ((5 - soreness) / 4) * 100
  return Math.round(sleepNorm * 0.4 + energyNorm * 0.35 + sorenessInv * 0.25)
}

/**
 * Map a score to a human-readable label and colour class.
 */
export function scoreLabel(score: number): { label: string; colour: string; emoji: string } {
  if (score >= 70) return { label: 'Good', colour: 'text-green-400', emoji: '🟢' }
  if (score >= 45) return { label: 'Fair', colour: 'text-yellow-400', emoji: '🟡' }
  return { label: 'Poor', colour: 'text-red-400', emoji: '🔴' }
}
```

- [ ] **Step 2: Verify the score formula manually**

Run a quick sanity check in your head (no test runner needed for pure maths):
- `computeScore(8, 1, 5)` → sleep=(8-4)/5=0.8 → 80; energy=(5-1)/4=1 → 100; sorenessInv=(5-1)/4=1 → 100. Score = round(80*0.4 + 100*0.35 + 100*0.25) = round(32+35+25) = **92** ✓ (Good)
- `computeScore(5, 4, 2)` → sleep=0.2→20; energy=0.25→25; sorenessInv=0.25→25. Score = round(8+8.75+6.25) = **23** ✓ (Poor)
- `computeScore(7, 3, 3)` → sleep=0.6→60; energy=0.5→50; sorenessInv=0.5→50. Score = round(24+17.5+12.5) = **54** ✓ (Fair)

- [ ] **Step 3: Commit**

```bash
git add src/lib/wellness.ts
git commit -m "feat: add computeScore and scoreLabel wellness utilities"
```

---

## Task 3: API Routes — POST and GET /api/wellness

**Files:**
- Create: `src/app/api/wellness/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/wellness/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getSessionFromRequest } from '@/lib/auth'
import { computeScore } from '@/lib/wellness'

export const dynamic = 'force-dynamic'

/** POST /api/wellness — upsert today's wellness log */
export async function POST(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { sleepHours?: number; soreness?: number; energy?: number }
  const { sleepHours, soreness, energy } = body

  if (
    typeof sleepHours !== 'number' || sleepHours < 0 || sleepHours > 24 ||
    typeof soreness !== 'number' || soreness < 1 || soreness > 5 ||
    typeof energy !== 'number' || energy < 1 || energy > 5
  ) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  // Today at midnight UTC
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const score = computeScore(sleepHours, soreness, energy)

  const log = await prisma.wellnessLog.upsert({
    where: { userId_date: { userId: session.userId, date: today } },
    update: { sleepHours, soreness, energy, score },
    create: { userId: session.userId, date: today, sleepHours, soreness, energy, score },
  })

  return NextResponse.json(log)
}

/** GET /api/wellness?days=14 — fetch recent logs */
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const days = parseInt(request.nextUrl.searchParams.get('days') ?? '14', 10)
  const since = new Date()
  since.setDate(since.getDate() - days)
  since.setUTCHours(0, 0, 0, 0)

  const logs = await prisma.wellnessLog.findMany({
    where: { userId: session.userId, date: { gte: since } },
    orderBy: { date: 'desc' },
  })

  return NextResponse.json(logs)
}
```

- [ ] **Step 2: Smoke-test with curl (optional but quick)**

With your dev server running (`npm run dev`), open a browser to the dashboard to get a session cookie, then in DevTools run:

```js
fetch('/api/wellness', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ sleepHours: 7.5, soreness: 2, energy: 4 })
}).then(r => r.json()).then(console.log)
```

Expected: JSON object with `score` field (should be around 73).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/wellness/route.ts
git commit -m "feat: add POST and GET /api/wellness endpoints"
```

---

## Task 4: WellnessWidget Client Component

**Files:**
- Create: `src/components/WellnessWidget.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/WellnessWidget.tsx`:

```typescript
'use client'
import { useState } from 'react'
import { scoreLabel } from '@/lib/wellness'

interface WellnessLog {
  sleepHours: number
  soreness: number
  energy: number
  score: number
}

interface WellnessWidgetProps {
  todayLog: WellnessLog | null
  showWarning: boolean
}

export default function WellnessWidget({ todayLog, showWarning }: WellnessWidgetProps) {
  const [sleep, setSleep] = useState('')
  const [soreness, setSoreness] = useState<number | null>(null)
  const [energy, setEnergy] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [logged, setLogged] = useState<WellnessLog | null>(todayLog)

  async function handleSubmit() {
    if (!sleep || soreness === null || energy === null) return
    const sleepHours = parseFloat(sleep)
    if (isNaN(sleepHours) || sleepHours < 0 || sleepHours > 24) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/wellness', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sleepHours, soreness, energy }),
      })
      const data = await res.json() as WellnessLog
      setLogged(data)
    } finally {
      setSubmitting(false)
    }
  }

  const RatingButtons = ({
    value, onChange, label,
  }: { value: number | null; onChange: (v: number) => void; label: string }) => (
    <div className="flex items-center justify-between">
      <span className="text-gray-300 text-xs">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-7 h-7 rounded text-xs font-medium transition-colors ${
              value === n
                ? 'bg-orange-500 text-white'
                : 'bg-gray-800 text-gray-400 border border-gray-700 hover:border-gray-500'
            }`}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )

  if (!logged) {
    return (
      <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">How are you feeling today?</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-xs">😴 Sleep</span>
            <input
              type="number"
              step="0.5"
              min="0"
              max="24"
              placeholder="7.5"
              value={sleep}
              onChange={e => setSleep(e.target.value)}
              className="w-20 bg-gray-800 border border-gray-700 text-white text-xs rounded-lg px-2 py-1.5 text-right"
            />
          </div>
          <RatingButtons value={soreness} onChange={setSoreness} label="💪 Soreness" />
          <RatingButtons value={energy} onChange={setEnergy} label="⚡ Energy" />
        </div>
        <button
          onClick={handleSubmit}
          disabled={submitting || !sleep || soreness === null || energy === null}
          className="mt-3 w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-semibold rounded-lg py-2 transition-colors"
        >
          {submitting ? 'Saving…' : 'Log check-in'}
        </button>
      </div>
    )
  }

  const { label, colour, emoji } = scoreLabel(logged.score)

  return (
    <div className="space-y-2">
      <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Recovery Score · Today</p>
        <div className="flex items-center gap-4">
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 ${
            logged.score >= 70 ? 'border-green-500 bg-green-500/10 text-green-400' :
            logged.score >= 45 ? 'border-yellow-500 bg-yellow-500/10 text-yellow-400' :
            'border-red-500 bg-red-500/10 text-red-400'
          }`}>
            {logged.score}
          </div>
          <div>
            <p className={`font-semibold text-sm ${colour}`}>{emoji} {label}</p>
            <p className="text-gray-500 text-xs mt-0.5">
              Sleep {logged.sleepHours}h · Soreness {logged.soreness} · Energy {logged.energy}
            </p>
          </div>
        </div>
      </div>

      {showWarning && (
        <div className="bg-red-950/40 border border-red-800/50 rounded-xl px-4 py-3 flex items-start gap-2">
          <span className="text-base mt-0.5">⚠️</span>
          <p className="text-red-300 text-xs">Recovery has been low for 2 days. Consider an easy session or rest day today.</p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/WellnessWidget.tsx
git commit -m "feat: add WellnessWidget client component"
```

---

## Task 5: Update Dashboard Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add wellness data fetching**

At the top of `src/app/page.tsx`, add the import for `WellnessWidget`:

```typescript
import WellnessWidget from '@/components/WellnessWidget'
```

In the `DashboardPage` server component, add a helper to fetch wellness data. Add this function after `getRecentSessions`:

```typescript
async function getWellnessData(userId: string) {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const [todayLog, recentLogs] = await Promise.all([
    prisma.wellnessLog.findUnique({
      where: { userId_date: { userId, date: today } },
    }),
    prisma.wellnessLog.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 2,
    }),
  ])

  const showWarning =
    recentLogs.length === 2 &&
    recentLogs[0].score < 45 &&
    recentLogs[1].score < 45

  return { todayLog, showWarning }
}
```

- [ ] **Step 2: Call the helper and pass props to WellnessWidget**

In the `DashboardPage` async function body, add `getWellnessData` to the existing `Promise.all`:

```typescript
const [weekVol, recentSessions, stravaToken, latestSummary, nextRace, wellnessData] = await Promise.all([
  getWeekVolume(session.userId),
  getRecentSessions(session.userId),
  prisma.stravaToken.findUnique({ where: { userId: session.userId } }),
  prisma.coachingSummary.findFirst({ where: { userId: session.userId }, orderBy: { generatedAt: 'desc' } }),
  getNextRace(session.userId),
  getWellnessData(session.userId),
])
```

- [ ] **Step 3: Render WellnessWidget in JSX**

In the return JSX, add `<WellnessWidget>` just below `<PhaseBanner />` and above the Strava connect prompt / "This week" section:

```tsx
<PhaseBanner />

<WellnessWidget
  todayLog={wellnessData.todayLog ? {
    sleepHours: wellnessData.todayLog.sleepHours,
    soreness: wellnessData.todayLog.soreness,
    energy: wellnessData.todayLog.energy,
    score: wellnessData.todayLog.score,
  } : null}
  showWarning={wellnessData.showWarning}
/>
```

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev
```

Open `http://localhost:3000`. You should see the "How are you feeling today?" check-in card below the phase banner. Fill it in and submit — it should flip to show the score ring.

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: add wellness widget to dashboard"
```

---

## Task 6: Recovery Page

**Files:**
- Create: `src/app/recovery/page.tsx`
- Create: `src/app/recovery/RecoveryClient.tsx`

- [ ] **Step 1: Create the server component**

Create `src/app/recovery/page.tsx`:

```typescript
import { prisma } from '@/lib/db'
import { getSession } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RecoveryClient from './RecoveryClient'

export const dynamic = 'force-dynamic'

export default async function RecoveryPage() {
  const session = await getSession()
  if (!session) redirect('/login')

  const since = new Date()
  since.setDate(since.getDate() - 14)
  since.setUTCHours(0, 0, 0, 0)

  const logs = await prisma.wellnessLog.findMany({
    where: { userId: session.userId, date: { gte: since } },
    orderBy: { date: 'asc' },
  })

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Recovery</h1>
      <RecoveryClient logs={logs.map(l => ({
        date: l.date.toISOString(),
        sleepHours: l.sleepHours,
        soreness: l.soreness,
        energy: l.energy,
        score: l.score,
      }))} />
    </div>
  )
}
```

- [ ] **Step 2: Create the client component**

Create `src/app/recovery/RecoveryClient.tsx`:

```typescript
'use client'
import { scoreLabel } from '@/lib/wellness'

interface LogEntry {
  date: string
  sleepHours: number
  soreness: number
  energy: number
  score: number
}

export default function RecoveryClient({ logs }: { logs: LogEntry[] }) {
  // Build a 14-day window (oldest first) with gaps for days not logged
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const days: { dateStr: string; label: string; log: LogEntry | null; isToday: boolean }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const iso = d.toISOString().split('T')[0]
    const log = logs.find(l => l.date.startsWith(iso)) ?? null
    const isToday = i === 0
    const label = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
    days.push({ dateStr: iso, label, log, isToday })
  }

  const logsWithData = logs
  const avgSleep = logsWithData.length ? (logsWithData.reduce((s, l) => s + l.sleepHours, 0) / logsWithData.length).toFixed(1) : '—'
  const avgSoreness = logsWithData.length ? (logsWithData.reduce((s, l) => s + l.soreness, 0) / logsWithData.length).toFixed(1) : '—'
  const avgEnergy = logsWithData.length ? (logsWithData.reduce((s, l) => s + l.energy, 0) / logsWithData.length).toFixed(1) : '—'

  const maxScore = 100

  function barColour(score: number) {
    if (score >= 70) return 'bg-green-500'
    if (score >= 45) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-4">
      {/* 14-day bar chart */}
      <div className="bg-gray-900/60 rounded-2xl p-4 border border-white/5">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Recovery Score — Last 14 Days</p>
        <div className="flex items-end gap-1 h-28">
          {days.map(({ dateStr, label, log, isToday }) => {
            const height = log ? `${(log.score / maxScore) * 100}%` : '4px'
            const colour = log ? barColour(log.score) : 'bg-gray-700'
            const border = isToday && !log ? 'border border-dashed border-gray-600' : ''
            return (
              <div key={dateStr} className="flex-1 flex flex-col items-center justify-end gap-1 group relative">
                {log && (
                  <div className="absolute bottom-full mb-1 hidden group-hover:flex bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 flex-col items-center">
                    <span>{scoreLabel(log.score).emoji} {log.score}</span>
                    <span className="text-gray-400">Sleep {log.sleepHours}h</span>
                  </div>
                )}
                <div
                  className={`w-full rounded-t transition-all ${colour} ${border}`}
                  style={{ height }}
                />
              </div>
            )
          })}
        </div>
        {/* x-axis labels — show every 7 days to avoid clutter */}
        <div className="flex mt-1">
          {days.map(({ dateStr, label }, i) => (
            <div key={dateStr} className="flex-1 text-center">
              {(i === 0 || i === 6 || i === 13) && (
                <span className="text-gray-600 text-[9px]">{label}</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Metric averages */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-900/60 rounded-xl p-3 border border-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">😴 Sleep avg</p>
          <p className="text-lg font-bold text-white">{avgSleep}<span className="text-xs text-gray-500">h</span></p>
        </div>
        <div className="bg-gray-900/60 rounded-xl p-3 border border-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">💪 Soreness</p>
          <p className="text-lg font-bold text-yellow-400">{avgSoreness}<span className="text-xs text-gray-500">/5</span></p>
        </div>
        <div className="bg-gray-900/60 rounded-xl p-3 border border-white/5 text-center">
          <p className="text-xs text-gray-500 mb-1">⚡ Energy</p>
          <p className="text-lg font-bold text-green-400">{avgEnergy}<span className="text-xs text-gray-500">/5</span></p>
        </div>
      </div>

      {logs.length === 0 && (
        <p className="text-gray-500 text-sm text-center py-4">No check-ins yet. Log your first one from the dashboard.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify the page loads**

With dev server running, navigate to `http://localhost:3000/recovery`. Should show the bar chart (empty if no logs) and the three averages showing `—`.

- [ ] **Step 4: Commit**

```bash
git add src/app/recovery/page.tsx src/app/recovery/RecoveryClient.tsx
git commit -m "feat: add Recovery page with 14-day chart and metric averages"
```

---

## Task 7: Add Recovery Link to Nav

**Files:**
- Modify: `src/components/Nav.tsx`

- [ ] **Step 1: Add HeartIcon and Recovery link**

In `src/components/Nav.tsx`, add the heart SVG icon alongside the other icon components (e.g. after `FlagIcon`):

```typescript
const HeartIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
```

In `BASE_LINKS`, add the Recovery entry between Coaching (`/suggestions`) and Races:

```typescript
const BASE_LINKS = [
  { href: '/', label: 'Dashboard', icon: <HomeIcon /> },
  { href: '/sessions', label: 'Sessions', icon: <ListIcon /> },
  { href: '/races', label: 'Races', icon: <FlagIcon /> },
  { href: '/plan', label: 'Plan', icon: <CalendarIcon /> },
  { href: '/progress', label: 'Progress', icon: <ChartIcon /> },
  { href: '/pbs', label: 'PBs', icon: <TrophyIcon /> },
  { href: '/suggestions', label: 'Coaching', icon: <BrainIcon /> },
  { href: '/recovery', label: 'Recovery', icon: <HeartIcon /> },  // ADD THIS
]
```

- [ ] **Step 2: Verify nav shows Recovery**

Check desktop nav and mobile bottom nav both show the Recovery link. Clicking it should load the Recovery page.

- [ ] **Step 3: Commit**

```bash
git add src/components/Nav.tsx
git commit -m "feat: add Recovery link to nav"
```

---

## Task 8: Enrich AI Coaching Prompt with Wellness Data

**Files:**
- Modify: `src/lib/coaching.ts`

- [ ] **Step 1: Add wellness fetch inside generateWeeklySummary**

In `src/lib/coaching.ts`, inside the `generateWeeklySummary` function, add a wellness log fetch after the existing `sessions` query:

```typescript
// Add after the existing sessions fetch
const sevenDaysAgo = new Date()
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
sevenDaysAgo.setUTCHours(0, 0, 0, 0)

const wellnessLogs = await prisma.wellnessLog.findMany({
  where: { userId, date: { gte: sevenDaysAgo } },
  orderBy: { date: 'desc' },
})
```

- [ ] **Step 2: Format wellness data and add to prompt**

After the existing `sessionSummary` string is built, add:

```typescript
const wellnessSummary = wellnessLogs.length > 0
  ? wellnessLogs.map(w => {
      const day = w.date.toLocaleDateString('en-GB', { weekday: 'short' })
      const status = w.score >= 70 ? 'Good' : w.score >= 45 ? 'Fair' : 'Poor'
      return `${day}: score ${w.score} (${status}) — sleep ${w.sleepHours}h, soreness ${w.soreness}/5, energy ${w.energy}/5`
    }).join('\n')
  : 'No wellness data logged this week.'
```

Then update the `prompt` string to include a `## Recent Recovery` section. Find the `PERSONAL BESTS` section in the prompt and add the recovery block before it:

```typescript
RECENT RECOVERY (last 7 days, newest first):
${wellnessSummary}

PERSONAL BESTS (last 4 weeks):
```

The full updated prompt section should look like:

```typescript
const prompt = `You are a triathlon coach. Analyse the athlete's last 4 weeks of training and provide a structured weekly summary. Respond with valid JSON only — no markdown, no explanation.

ATHLETE CONTEXT:
- Race: Ironman 70.3 (1.9km swim, 90km bike, 21.1km run)
- Race date: September 2026 (${weeksToRace()} weeks away)
- Current phase: ${currentPhase()}

RECENT SESSIONS (newest first):
${sessionSummary}

AUTOMATED ALERTS:
${alertSummary}

RECENT RECOVERY (last 7 days, newest first):
${wellnessSummary}

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
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/coaching.ts
git commit -m "feat: include wellness recovery data in AI coaching prompt"
```

---

## Task 9: Final Check and Push

- [ ] **Step 1: Run full build**

```bash
npm run build
```

Expected: `✓ Compiled successfully` with no errors.

- [ ] **Step 2: Manual end-to-end test**

1. Open dashboard — check-in form should appear
2. Fill in sleep, soreness, energy and submit
3. Score ring should appear with correct colour
4. Navigate to `/recovery` — bar chart should show today's bar
5. Navigate to `/suggestions` → click "Regenerate" on coaching card — new summary should mention recovery

- [ ] **Step 3: Push to main**

```bash
git push origin main
```
