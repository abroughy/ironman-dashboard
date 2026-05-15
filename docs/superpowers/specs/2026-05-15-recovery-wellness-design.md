# Recovery & Wellness Tracking — Design Spec

**Date:** 2026-05-15  
**Status:** Approved

---

## Overview

Add a daily wellness check-in system to the Ironman Training Dashboard. Athletes log three metrics each morning — sleep hours, muscle soreness, and energy level. The app computes a composite recovery score, displays it on the dashboard, tracks trends on a dedicated Recovery page, and feeds the data into the AI coaching prompt for richer recommendations.

---

## Data Model

New Prisma model added to `prisma/schema.prisma`:

```prisma
model WellnessLog {
  id         String   @id @default(cuid())
  userId     String
  date       DateTime // stored at midnight UTC, represents the calendar day
  sleepHours Float
  soreness   Int      // 1–5 (1 = no soreness, 5 = very sore)
  energy     Int      // 1–5 (1 = exhausted, 5 = great)
  score      Int      // computed composite score 0–100
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, date])
  @@index([userId])
  @@index([userId, date])
}
```

User model gains `wellnessLogs WellnessLog[]`.

### Score Formula

Score is computed server-side on write and stored for fast reads.

| Metric | Weight | Normalisation |
|--------|--------|---------------|
| Sleep hours | 40% | `clamp((sleepHours - 4) / 5, 0, 1) * 100` — 4h = 0, 9h = 100 |
| Energy | 35% | `(energy - 1) / 4 * 100` — 1 = 0, 5 = 100 |
| Soreness (inverted) | 25% | `(5 - soreness) / 4 * 100` — 5 = 0, 1 = 100 |

**Final score** = `round(sleep * 0.4 + energy * 0.35 + sorenessInv * 0.25)`

**Thresholds:**
- 🟢 Good — score ≥ 70
- 🟡 Fair — score 45–69
- 🔴 Poor — score < 45

---

## API Routes

### `POST /api/wellness`
- Auth required
- Body: `{ sleepHours: number, soreness: number, energy: number }`
- Computes score server-side
- Upserts on `(userId, date)` — re-submitting today overwrites the earlier entry
- Returns the saved `WellnessLog`

### `GET /api/wellness`
- Auth required
- Query param: `?days=14` (default 14)
- Returns array of `WellnessLog` records ordered by date desc

---

## Components & Pages

### `WellnessWidget` (client component)
**Location:** `src/components/WellnessWidget.tsx`  
**Used on:** Dashboard (`src/app/page.tsx`), rendered just below `PhaseBanner` and above the weekly rings section.

**Two states:**

1. **Not yet logged today** — shows quick check-in form:
   - Sleep hours text input (placeholder "7.5")
   - Soreness tap-to-select 1–5 buttons
   - Energy tap-to-select 1–5 buttons
   - "Log check-in" submit button → POST /api/wellness

2. **Already logged today** — shows recovery score ring:
   - Circular score badge (colour-coded green/amber/red)
   - Label: 🟢 Good / 🟡 Fair / 🔴 Poor
   - Sub-text: "Sleep 7.5h · Soreness 3 · Energy 4"

**Warning banner:** If the last 2 completed days both have score < 45, a red alert banner is shown below the score ring: *"Recovery has been low for 2 days. Consider an easy session or rest day today."*  
This is determined server-side in the dashboard page and passed as a `showWarning: boolean` prop.

### Recovery Page
**Route:** `/recovery`  
**File:** `src/app/recovery/page.tsx` (server component) + `src/app/recovery/RecoveryClient.tsx` (client)

**Contents:**
- **14-day score bar chart** — colour-coded bars (green/amber/red) with dates along the x-axis. Today's bar shown with a dashed border if not yet logged.
- **Three metric average cards** — Sleep avg (hours), Soreness avg (/5), Energy avg (/5) for the 14-day window.
- No charting library needed — CSS flexbox bars (as per the mockup).

**Navigation:** Added to `Nav.tsx` between Coaching and Races links, with a heart icon.

---

## AI Coach Integration

`src/app/api/coaching/generate/route.ts` updated to:
1. Fetch the last 7 days of `WellnessLog` for the user alongside existing session data.
2. Format as a compact string: `"Mon: 78 (Good), Tue: 45 (Fair), Wed: 32 (Poor)..."`
3. Append to the existing Claude prompt context block under a `## Recent Recovery` heading.

No additional AI call — enriches the existing coaching summary generation.

---

## Warning Logic

Server-side in `src/app/page.tsx`:
- Fetch the 2 most recent `WellnessLog` entries for the user.
- If both exist and both have `score < 45`, pass `showWarning: true` to `WellnessWidget`.
- If fewer than 2 logs exist, no warning shown.

---

## Out of Scope

- Strava RPE sync (separate future task — data already exists in Strava API)
- Push/email notifications when recovery is low
- HRV logging
- Streak tracking / gamification
