# Ironman 70.3 Training Dashboard — Design Spec

**Date:** 2026-05-12
**Status:** Approved
**Race target:** 70.3 Half Ironman, September 2026
**Current phase:** Build

---

## Overview

A personal web-based training dashboard for monitoring Ironman 70.3 preparation. Tracks swim, bike, and run sessions separately, syncs with Strava and Zwift, supports manual swim entry, visualises improvement over time, and provides hybrid AI coaching (rule-based alerts + Claude weekly summaries).

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| Database | SQLite via Prisma (dev), Postgres on Vercel (prod) |
| Deployment | Vercel |
| Auth | None — single personal dashboard, protected by env secret |
| AI | Claude API (Anthropic SDK) for weekly summaries |
| Charts | Recharts or Chart.js |
| Styling | Tailwind CSS (mobile-first) |

---

## Data Model

All sessions share a common shape regardless of discipline:

```prisma
model Session {
  id               String     @id @default(cuid())
  discipline       Discipline // swim | bike | run
  date             DateTime
  durationSecs     Int
  distanceMetres   Float
  avgHeartRate     Int?
  perceivedEffort  Int?       // 1–10
  notes            String?    // e.g. "focused on crawl technique"
  source           Source     // strava | zwift | manual | import
  stravaActivityId String?    @unique
  rawData          Json?      // original Strava/GPX payload
  createdAt        DateTime   @default(now())
}

enum Discipline { swim bike run }
enum Source     { strava zwift manual import }
```

```prisma
model StravaToken {
  id           String   @id @default("singleton")
  accessToken  String
  refreshToken String
  expiresAt    DateTime
}

model CoachingSummary {
  id          String   @id @default(cuid())
  weekStart   DateTime
  content     Json     // structured: { wentWell, weakness, nextFocus, projectedFinish }
  generatedAt DateTime @default(now())
}
```

---

## Pages

### 1. Dashboard (`/`)

- **Phase banner:** "Build Phase · [N] weeks to race · September 2026" — weeks calculated dynamically from `RACE_DATE` env var
- **Training load rings:** Weekly volume vs. target for each discipline (swim / bike / run). Default weekly targets: swim 5km, bike 150km, run 30km — configurable via `WEEKLY_TARGETS` env var (JSON).
- **Recent sessions:** Last 7 days, colour-coded by discipline (blue = swim, orange = bike, green = run)
- **Weekly coaching summary card:** Latest Claude summary, with "Regenerate" button (confirms before calling API)
- **Quick-add swim button:** Opens manual entry form inline
- **Last synced timestamp:** Shows when Strava last pushed data

### 2. Sessions (`/sessions`)

- Full session history, paginated
- Filter bar: discipline tabs + date range picker
- Session card shows: date, discipline icon, distance, duration, pace/speed, avg HR, source badge (Strava / Zwift / Manual / Import)
- Tap/click → session detail view with all fields including notes
- **Import button:** Opens modal with two tabs — Manual Entry form and File Import

**Manual entry form fields:**
- Date (date picker, defaults to today)
- Duration (mm:ss)
- Distance (metres)
- Avg heart rate (optional)
- Perceived effort (1–10 slider)
- Notes / stroke focus (free text, e.g. "bilateral breathing drills")

**File import:** Drag-and-drop or file picker accepting `.csv` or `.gpx`. After parsing, user confirms values before saving.

CSV format: `date, duration_mins, distance_m, avg_hr (optional), notes (optional)`

### 3. Progress (`/progress`)

Per-discipline improvement charts (x-axis = date, y-axis = metric):

| Discipline | Primary metric | Secondary |
|---|---|---|
| Swim | Pace per 100m | Avg HR |
| Bike | Avg speed (km/h) | Power if available |
| Run | Pace per km | Avg HR |

- Combined weekly training load chart (total hours across all disciplines)
- **Projected 70.3 finish time** — calculated from avg and best session paces:
  - Swim 1.9km: pace/100m × 19
  - Bike 90km: 90 / avg_speed_kmh × 60 mins
  - Run 21.1km: pace/km × 21.1
  - Shown as a range (avg sessions → best sessions), not a single number

### 4. Suggestions (`/suggestions`)

- **Rule-based alert banners** (top of page):
  - 🔴 Red: "3+ hard sessions (effort ≥7) in a row — rest tomorrow"
  - 🟠 Amber: "No swim in 10+ days", "Less than 1 rest day this week", "Bike volume down 30%+ vs last week"
  - 🟢 Green: "On track across all disciplines this week"
  - ⏰ Phase: "Race in 6 weeks — consider starting taper"
- **Full weekly Claude coaching summary** (cached, refresh triggers API call)
- **Per-discipline breakdown cards** with specific notes

---

## Data Ingestion

### Strava OAuth + Webhook

1. "Connect Strava" button on first load → OAuth redirect → tokens stored in `StravaToken` table
2. Strava webhook registered on connect — new activities pushed within minutes of finishing
3. "Sync now" manual fallback button
4. Activity type mapping:
   - `Run` → `run / strava`
   - `Ride` → `bike / strava`
   - `VirtualRide` → `bike / zwift` (badge set to Zwift if activity name contains "Zwift")
   - All other types ignored

### Zwift

No separate integration needed. Zwift auto-uploads to Strava (user enables once in Zwift settings). Rides arrive as `VirtualRide` and are handled by the Strava sync path. Session cards show a "Zwift" source badge.

### Swim Import

Two paths, both produce the same `Session` record:
1. **Manual entry form** — fastest for regular logging
2. **CSV/GPX file** — for bulk historical imports or watch exports. User confirms parsed values before saving. No silent failures.

---

## AI Layer

### Rule Engine (instant, runs on every sync)

Implemented as pure TypeScript functions over the session DB. No API calls. Rules:

| Rule | Trigger | Severity |
|---|---|---|
| Discipline neglect | No sessions of a discipline in 10+ days | Amber |
| Overtraining | 3+ sessions with perceived effort ≥7 in a row | Red |
| Rest deficit | Fewer than 1 rest day in the last 7 days | Amber |
| Volume drop | Weekly volume for any discipline down >30% vs prior week | Amber |
| Taper reminder | Race date within 6 weeks | Phase alert |
| On track | No amber/red alerts | Green |

### Claude Weekly Coaching Summary

**Trigger:** Auto-generated each Monday via a Vercel cron job (`/api/cron/weekly-summary`, secured with `CRON_SECRET`), or on-demand via "Regenerate" button (user confirms before API call).

**Prompt context sent to Claude:**
- Last 4 weeks of sessions (all disciplines), including notes/stroke focus fields
- Race date (September 2026) and current phase (Build)
- Recent rule-based alerts triggered this week
- Personal bests per discipline (fastest pace, longest distance)

**Response structure (JSON):**
```json
{
  "wentWell": "string",
  "weakness": "string",
  "nextFocus": "string",
  "projectedFinish": { "avg": "5h 30m", "best": "5h 10m" }
}
```

Summary cached in `CoachingSummary` table. Regeneration costs one API call — user is shown a confirmation before triggering.

---

## Projected 70.3 Finish Time

Calculated from the last 8 sessions per discipline (or all sessions if fewer):

```
swim_time  = avg_pace_per_100m × 19
bike_time  = (90 / avg_speed_kmh) × 60  [minutes]
run_time   = avg_pace_per_km × 21.1
total_avg  = swim_time + bike_time + run_time + 10 [transition buffer mins]
```

Best-case uses best-session pace instead of average. Shown as a range: `5h 10m – 5h 40m`.

---

## Environment Variables

```env
DATABASE_URL=          # Postgres connection string (prod) or file path (dev)
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_WEBHOOK_VERIFY_TOKEN=
ANTHROPIC_API_KEY=
DASHBOARD_SECRET=      # Checked via Next.js middleware on all routes — redirect to /lock if missing
CRON_SECRET=           # Vercel cron auth header value
RACE_DATE=2026-09-01   # ISO date, used for countdown and phase calculation
WEEKLY_TARGETS=        # JSON: {"swim":5000,"bike":150000,"run":30000} (metres)
```

---

## Out of Scope (v1)

- **Multi-user support** — planned for a future version. To avoid painful rewrites later: use Prisma from day one (easy to add a `User` model), avoid hardcoding single-user assumptions in API routes, and keep auth logic isolated so it can be swapped in. When multi-user is added, Strava tokens and coaching summaries will move to per-user rows.
- **Nutrition tracking** — planned for a future version. No design decisions today depend on this.
- Heart rate zone analysis (may add later)
- Mobile native app
- Zwift direct API (not publicly available)
