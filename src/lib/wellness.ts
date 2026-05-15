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
