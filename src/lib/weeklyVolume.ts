export interface WeeklyVolumePoint {
  weekLabel: string // "12 May", "19 May" etc — Monday of that week
  swim: number      // km
  bike: number      // km
  run: number       // km
  total: number     // km
}

function mondayOf(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const day = d.getDay() // 0=Sun
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return d
}

function toWeekKey(monday: Date): string {
  return monday.toISOString().slice(0, 10)
}

function weekLabel(monday: Date): string {
  return monday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function calculateWeeklyVolume(
  sessions: { date: Date | string; discipline: string; distanceMetres: number }[],
  weeks: number
): WeeklyVolumePoint[] {
  // Determine the start Monday (weeks-1 weeks ago from this week's Monday)
  const now = new Date()
  const thisMonday = mondayOf(now)

  const weekMap = new Map<string, WeeklyVolumePoint>()

  // Pre-populate all weeks (including empty ones)
  for (let i = weeks - 1; i >= 0; i--) {
    const monday = new Date(thisMonday)
    monday.setDate(thisMonday.getDate() - i * 7)
    const key = toWeekKey(monday)
    weekMap.set(key, { weekLabel: weekLabel(monday), swim: 0, bike: 0, run: 0, total: 0 })
  }

  for (const s of sessions) {
    const d = typeof s.date === 'string' ? new Date(s.date) : s.date
    const monday = mondayOf(d)
    const key = toWeekKey(monday)

    const entry = weekMap.get(key)
    if (!entry) continue // outside range

    const km = s.distanceMetres / 1000
    if (s.discipline === 'swim') entry.swim += km
    else if (s.discipline === 'bike') entry.bike += km
    else if (s.discipline === 'run') entry.run += km
    entry.total += km
  }

  // Return in chronological order
  return Array.from(weekMap.values())
}
