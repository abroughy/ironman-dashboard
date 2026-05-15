# Group & Social Features — Design Spec

**Date:** 2026-05-15
**Status:** Approved

---

## Overview

Add a private group social layer to the Ironman Training Dashboard for a closed group of ~10 friends. Features include a weekly training leaderboard, group challenges, an activity feed, profile photos, and a sharing opt-in toggle. All social data is derived on-the-fly from existing Sessions and Race milestone data — no event store needed at this scale.

---

## Data Model

### Schema additions to `prisma/schema.prisma`

**User model — two new fields:**
```prisma
shareWithGroup  Boolean  @default(false)
avatarUrl       String?  // base64 data URL, client-compressed to ≤100KB
```

**New model:**
```prisma
model GroupChallenge {
  id          String   @id @default(cuid())
  createdBy   String
  name        String
  discipline  String   // 'swim' | 'bike' | 'run' | 'any'
  targetKm    Float
  startDate   DateTime
  endDate     DateTime
  createdAt   DateTime @default(now())

  creator User @relation(fields: [createdBy], references: [id], onDelete: Cascade)

  @@index([createdBy])
  @@index([endDate])
}
```

User model gains `groupChallenges GroupChallenge[]`.

### Avatar storage

Stored as a base64 data URL string in `User.avatarUrl`. No external storage service required — this is a private app with ~10 users. The client resizes images to max 300×300px using a `<canvas>` element and compresses to JPEG at 80% quality before sending. The API validates the string is ≤100KB after encoding.

### Leaderboard score formula

```
score = round((swimKm × 1.5 + bikeKm × 0.2 + runKm × 1.0) × 10)
```

Swim and run weighted higher per km (harder effort-per-km), bike lower (distances are much larger by nature). Per-discipline km shown alongside the combined score.

---

## API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| `GET` | `/api/group/leaderboard` | Required | Weekly scores for all opted-in users |
| `GET` | `/api/group/feed` | Required | Sessions + milestones for opted-in users, last 30 days |
| `GET` | `/api/group/challenges` | Required | List active + upcoming challenges |
| `POST` | `/api/group/challenges` | Required | Create a challenge (any user) |
| `DELETE` | `/api/group/challenges/[id]` | Required | Delete challenge (admin or creator only) |
| `POST` | `/api/profile/share` | Required | Toggle `shareWithGroup` on/off |
| `POST` | `/api/profile/avatar` | Required | Upload avatar (base64, max 100KB) |
| `PATCH` | `/api/profile` | Required | Update display name |

### GET /api/group/leaderboard

- Computes current week (Mon–Sun) start
- Fetches all users where `shareWithGroup = true`
- For each user, sums session distances for the current week by discipline
- Computes combined score using formula above
- Returns array sorted by score desc, includes: `userId`, `displayName`, `avatarUrl`, `score`, `swimKm`, `bikeKm`, `runKm`
- Current user's `shareWithGroup` status also returned so the client can show the opt-in prompt

### GET /api/group/feed

- Fetches sessions from the last 30 days for all users where `shareWithGroup = true`
- Fetches Race milestone hits (races with `milestones` JSON and a `goalTime`) for the same users
- Merges and sorts by date desc
- Returns array of feed items: `{ type: 'session' | 'milestone', userId, displayName, avatarUrl, date, ... }`
- Session items include: `discipline`, `distanceMetres`, `durationSecs`
- Milestone items include: `raceName`, `milestoneLabel` (e.g. "3-month checkpoint: sub-2:04 half")

### GET /api/group/challenges

- Returns all GroupChallenge records where `endDate >= today`
- For each challenge, computes each opted-in user's progress (sum of relevant sessions within the date range)
- Returns challenges with embedded `participants: [{ userId, displayName, avatarUrl, progressKm, progressPct }]`

### POST /api/group/challenges

- Body: `{ name, discipline, targetKm, startDate, endDate }`
- Validates: name non-empty, discipline valid, targetKm > 0, endDate > startDate, endDate within 90 days
- Creates GroupChallenge with `createdBy = session.userId`

### DELETE /api/group/challenges/[id]

- Verifies requester is admin (`isAdmin = true`) or the challenge creator
- Returns 403 if neither

### POST /api/profile/share

- Body: `{ share: boolean }`
- Updates `User.shareWithGroup`

### POST /api/profile/avatar

- Body: `{ avatar: string }` — base64 data URL
- Validates: string starts with `data:image/`, byte length ≤ 100,000
- Updates `User.avatarUrl`

---

## Pages & Components

### `/group` — Group page

**File:** `src/app/group/page.tsx` (server component) + `src/app/group/GroupClient.tsx` (client)

Server component:
- Fetches initial leaderboard data + current user's `shareWithGroup` status
- Passes to GroupClient

GroupClient:
- Three tabs: **Leaderboard**, **Challenges**, **Feed**
- Tab selection stored in local state (no URL param needed)
- Each tab is a separate sub-component loaded lazily via client-side fetch on first tab switch (except Leaderboard which is pre-fetched server-side)

#### LeaderboardTab (`src/app/group/LeaderboardTab.tsx`)

- Ranked list with: medal emoji (🥇🥈🥉 for top 3), avatar circle, display name, combined score, three discipline km pills
- Current user's row has orange border highlight
- Non-sharing users shown as a greyed-out row: avatar placeholder + "Private" label
- If current user is not sharing: amber banner at top — "Your training is private. Share with the group?" with toggle button

#### ChallengesTab (`src/app/group/ChallengesTab.tsx`)

- Cards for each active challenge showing: name, discipline, end date countdown, progress bars per participant (user's own bar highlighted in orange)
- "Create challenge" button opens an inline form at the top: name input, discipline selector, target km, date range
- Admin and challenge creator see a trash icon on their challenges

#### FeedTab (`src/app/group/FeedTab.tsx`)

- Chronological cards, newest first
- Session card: avatar + "[Name] ran/swam/cycled Xkm in Ymin" + relative timestamp
- Milestone card: orange border + 🎯 + "[Name] hit a milestone — [label]"
- "No activity yet" empty state if no opted-in users have sessions
- Fetches from `/api/group/feed` on first render

### `/profile` — Profile page

**File:** `src/app/profile/page.tsx` (server component) + `src/app/profile/ProfileClient.tsx` (client)

Contents:
- **Avatar upload** — circular avatar preview (placeholder silhouette if none), "Change photo" button triggers hidden file input, client resizes to 300×300 JPEG using canvas, POSTs base64 to `/api/profile/avatar`
- **Display name** — editable text field (updates `User.displayName` via existing user update or new PATCH `/api/profile` route)
- **Share with group** — toggle switch, POSTs to `/api/profile/share`
- **Username** — read-only display

### Navigation updates

- `src/components/Nav.tsx`: add **Group** link (PeopleIcon) and **Profile** link (UserCircleIcon) to `BASE_LINKS`

---

## Privacy Rules

- Only users with `shareWithGroup = true` appear on the leaderboard, in the feed, and in challenge progress bars
- Non-sharing users are shown as "Private" on the leaderboard (so you know they exist but can't see their data)
- Non-sharing users can still see everyone else's data (viewing is always allowed; only sharing is opt-in)
- Admin can see all users regardless of sharing status (for admin panel purposes only — not surfaced in the group UI)

---

## Out of Scope

- Real-time updates / WebSockets (page refresh or tab-switch refetch is sufficient)
- Direct messaging between users
- Reactions or comments on feed items
- Push notifications for challenge completions
- Public profiles or external sharing
