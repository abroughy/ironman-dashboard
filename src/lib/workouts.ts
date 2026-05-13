export type Discipline = 'swim' | 'bike' | 'run' | 'gym'
export type WorkoutType = 'technique' | 'intervals' | 'tempo' | 'long' | 'recovery' | 'strength' | 'endurance'

export interface Workout {
  id: string
  discipline: Discipline
  type: WorkoutType
  title: string
  description: string
  targetDurationMins: number
  targetDistanceMetres?: number
  effortLevel: 'easy' | 'moderate' | 'hard' | 'max'
}

export const WORKOUTS: Record<string, Workout> = {
  // ── SWIM ──────────────────────────────────────────────────────────────────
  'swim-catch-up': {
    id: 'swim-catch-up',
    discipline: 'swim',
    type: 'technique',
    title: 'Catch-Up Drill',
    description:
      'Arms alternate: one hand must touch the other at full extension before the opposite arm starts its pull. ' +
      'Focus on long, slow strokes and body rotation.\n\n' +
      '• 400m easy warm-up\n' +
      '• 8×50m catch-up drill with 20s rest between each\n' +
      '• 200m easy cool-down\n\n' +
      'Builds stroke timing and reach.',
    targetDurationMins: 40,
    effortLevel: 'easy',
  },
  'swim-fingertip-drag': {
    id: 'swim-fingertip-drag',
    discipline: 'swim',
    type: 'technique',
    title: 'Fingertip Drag Drill',
    description:
      'During the recovery phase, drag your fingertips lightly along the water surface from hip to entry point. ' +
      'Encourages a high-elbow recovery and relaxed arm swing.\n\n' +
      '• 300m easy warm-up\n' +
      '• 6×75m fingertip drag drill with 20s rest\n' +
      '• 150m easy cool-down\n\n' +
      'Builds high elbow recovery.',
    targetDurationMins: 40,
    effortLevel: 'easy',
  },
  'swim-fist-drill': {
    id: 'swim-fist-drill',
    discipline: 'swim',
    type: 'technique',
    title: 'Fist Drill',
    description:
      'Swim with closed fists for 25m so you feel the water with your forearm, then open your hands for the next 25m and notice the improved catch.\n\n' +
      '• 300m easy warm-up\n' +
      '• 8×50m (25m fists closed / 25m open hands) with 20s rest\n' +
      '• 200m easy cool-down\n\n' +
      'Improves catch feel and forearm awareness.',
    targetDurationMins: 45,
    effortLevel: 'easy',
  },
  'swim-pull-buoy': {
    id: 'swim-pull-buoy',
    discipline: 'swim',
    type: 'endurance',
    title: 'Pull Buoy Endurance',
    description:
      'Place a pull buoy between your thighs and swim using arms only — no kicking. Removes leg fatigue so you can focus on stroke mechanics and arm endurance.\n\n' +
      '• 400m warm-up (no buoy)\n' +
      '• 4×200m with pull buoy, 30s rest between each\n' +
      '• 200m cool-down (no buoy)\n\n' +
      'Builds arm endurance and catch strength.',
    targetDurationMins: 50,
    targetDistanceMetres: 2000,
    effortLevel: 'moderate',
  },
  'swim-bilateral': {
    id: 'swim-bilateral',
    discipline: 'swim',
    type: 'technique',
    title: 'Bilateral Breathing',
    description:
      'Breathe every 3 strokes throughout the entire session — alternating sides. Builds balanced muscle development and helps in open-water sighting.\n\n' +
      '• 300m warm-up (breathe every 2 strokes)\n' +
      '• 6×100m bilateral (every 3 strokes) with 20s rest\n' +
      '• 200m cool-down\n\n' +
      'Builds balanced strength and breath control.',
    targetDurationMins: 50,
    targetDistanceMetres: 1700,
    effortLevel: 'easy',
  },
  'swim-progressive': {
    id: 'swim-progressive',
    discipline: 'swim',
    type: 'endurance',
    title: 'Progressive Sets',
    description:
      'Each set is longer than the last — challenge yourself to maintain form as fatigue builds.\n\n' +
      '• 4×100m with 30s rest\n' +
      '• 2×200m with 30s rest\n' +
      '• 1×400m\n\n' +
      'Focus on maintaining stroke length and body rotation as distance increases. Race-pace effort on the 400m.',
    targetDurationMins: 55,
    targetDistanceMetres: 2000,
    effortLevel: 'moderate',
  },
  'swim-kick-drill': {
    id: 'swim-kick-drill',
    discipline: 'swim',
    type: 'technique',
    title: '6-1-6 Kick Drill',
    description:
      'On your side with bottom arm extended: kick 6 times, take 1 full stroke, rotate to the other side, kick 6 times, repeat.\n\n' +
      '• 200m warm-up\n' +
      '• 8×50m 6-1-6 kick drill with 20s rest\n' +
      '• 200m cool-down\n\n' +
      'Improves body rotation, balance, and kick timing.',
    targetDurationMins: 40,
    effortLevel: 'easy',
  },
  'swim-endurance': {
    id: 'swim-endurance',
    discipline: 'swim',
    type: 'endurance',
    title: 'Long Endurance Set',
    description:
      'Race-simulation endurance block. Aim to hold race pace throughout the 750m efforts.\n\n' +
      '• 400m warm-up (easy)\n' +
      '• 2×750m at race pace with 2min rest between\n' +
      '• 400m cool-down\n\n' +
      'Race-pace effort. Focus on consistent stroke rate and breathing rhythm.',
    targetDurationMins: 65,
    targetDistanceMetres: 2300,
    effortLevel: 'hard',
  },

  // ── BIKE ──────────────────────────────────────────────────────────────────
  'bike-long': {
    id: 'bike-long',
    discipline: 'bike',
    type: 'long',
    title: 'Long Ride',
    description:
      '60–90km at moderate zone 2 effort — you should be able to hold a conversation but feel like you\'re working.\n\n' +
      '• Fuel every 30 minutes (gel, bar, or drink mix)\n' +
      '• Maintain cadence 85–95rpm throughout\n' +
      '• Flat or gently rolling route preferred\n' +
      '• Practise race nutrition strategy\n\n' +
      'This is your most important weekly session — do not skip it.',
    targetDurationMins: 180,
    targetDistanceMetres: 75000,
    effortLevel: 'moderate',
  },
  'bike-hiit': {
    id: 'bike-hiit',
    discipline: 'bike',
    type: 'intervals',
    title: 'HIIT Intervals',
    description:
      'High-intensity interval session designed to boost VO2max and anaerobic threshold.\n\n' +
      '• 10km warm-up at easy pace\n' +
      '• 10×(1 min MAX effort / 1 min complete rest — freewheel or stop)\n' +
      '• 5km cool-down\n\n' +
      'Log watts if you have a power meter. The rest intervals must be full rest — do not pedal.',
    targetDurationMins: 75,
    targetDistanceMetres: 30000,
    effortLevel: 'max',
  },
  'bike-endurance': {
    id: 'bike-endurance',
    discipline: 'bike',
    type: 'endurance',
    title: 'Endurance Fill Ride',
    description:
      '30–50km at a conscious, controlled zone 2–3 effort. This is not a junk mile ride — stay present and deliberate.\n\n' +
      '• Seek hilly routes to build climbing strength\n' +
      '• Maintain steady power output on the hills\n' +
      '• Focus on smooth pedal stroke\n\n' +
      'Builds aerobic base and climbing-specific leg strength.',
    targetDurationMins: 90,
    targetDistanceMetres: 40000,
    effortLevel: 'moderate',
  },
  'bike-hilly': {
    id: 'bike-hilly',
    discipline: 'bike',
    type: 'endurance',
    title: 'Hilly Route',
    description:
      '40–60km targeting routes with 500m+ elevation gain. Effort will naturally vary — that\'s the point.\n\n' +
      '• Push hard on the climbs (zone 4–5)\n' +
      '• Recover fully on the descents\n' +
      '• Eat and drink on the descents\n\n' +
      'Builds climbing strength and the ability to recover quickly after efforts.',
    targetDurationMins: 120,
    targetDistanceMetres: 50000,
    effortLevel: 'hard',
  },

  // ── RUN ───────────────────────────────────────────────────────────────────
  'run-long': {
    id: 'run-long',
    discipline: 'run',
    type: 'long',
    title: 'Long Run',
    description:
      '16–21km at conversational pace (zone 2). You should be able to say full sentences without gasping.\n\n' +
      '• Walk 1 min every 5km if needed — this is not cheating\n' +
      '• Focus on time on feet, not pace\n' +
      '• Carry water and gel for anything over 75 min\n\n' +
      'The most important run of the week. Builds aerobic base and mental resilience.',
    targetDurationMins: 110,
    targetDistanceMetres: 18000,
    effortLevel: 'moderate',
  },
  'run-intervals': {
    id: 'run-intervals',
    discipline: 'run',
    type: 'intervals',
    title: 'Speed Intervals',
    description:
      'Classic VO2max interval session.\n\n' +
      '• 10min easy warm-up\n' +
      '• 5×(1km at your current 5K pace / 1min complete standing rest)\n' +
      '• 10min easy cool-down\n\n' +
      'The kilometre reps should feel hard but sustainable — not an all-out sprint. Walk or stand still on the rest.',
    targetDurationMins: 65,
    targetDistanceMetres: 12000,
    effortLevel: 'hard',
  },
  'run-tempo': {
    id: 'run-tempo',
    discipline: 'run',
    type: 'tempo',
    title: 'HM Pace Tempo',
    description:
      'Lactate threshold session at half marathon target pace.\n\n' +
      '• 10min easy warm-up\n' +
      '• 3×(5km at half marathon goal pace / 5min easy jog rest)\n' +
      '• 10min easy cool-down\n\n' +
      'This should feel comfortably hard — you can speak a word or two but not hold a conversation. Very similar to race-day run effort.',
    targetDurationMins: 105,
    targetDistanceMetres: 18000,
    effortLevel: 'hard',
  },
  'run-recovery': {
    id: 'run-recovery',
    discipline: 'run',
    type: 'recovery',
    title: 'Recovery Run',
    description:
      '5–8km at a very easy pace — slow enough that you could comfortably hold a full conversation.\n\n' +
      '• Heart rate under 140bpm throughout\n' +
      '• If in doubt, go slower\n' +
      '• Focus on relaxed form — soft knees, light foot strike\n\n' +
      'Active recovery. Flushes legs without adding meaningful stress.',
    targetDurationMins: 40,
    targetDistanceMetres: 6000,
    effortLevel: 'easy',
  },
  'run-easy': {
    id: 'run-easy',
    discipline: 'run',
    type: 'endurance',
    title: 'Easy Aerobic Run',
    description:
      '8–12km at easy effort, zone 2. Consistent pace throughout — resist the urge to push.\n\n' +
      '• Maintain the same effort on hills (slow down if needed)\n' +
      '• Stay in zone 2 — HR roughly 130–150bpm depending on fitness\n\n' +
      'Builds aerobic engine without significant fatigue cost.',
    targetDurationMins: 60,
    targetDistanceMetres: 10000,
    effortLevel: 'easy',
  },

  // ── GYM ───────────────────────────────────────────────────────────────────
  'gym-legs': {
    id: 'gym-legs',
    discipline: 'gym',
    type: 'strength',
    title: 'Leg Strength Circuit',
    description:
      'Addresses late-race leg fatigue and improves run economy off the bike.\n\n' +
      '3 sets of:\n' +
      '• Squats ×15\n' +
      '• Reverse lunges ×12 each leg\n' +
      '• Single-leg press ×10 each\n' +
      '• Calf raises ×20\n' +
      '• Glute bridges ×15\n' +
      '• Hip flexor stretch (30s each side)\n\n' +
      'Rest 60s between sets. Use a weight that makes the last 3 reps challenging.',
    targetDurationMins: 45,
    effortLevel: 'moderate',
  },
  'gym-core': {
    id: 'gym-core',
    discipline: 'gym',
    type: 'strength',
    title: 'Core & Stability',
    description:
      'Supports swim posture, bike power transfer, and run form — the glue that holds the whole race together.\n\n' +
      '3 sets of:\n' +
      '• Plank — 45s\n' +
      '• Side plank — 30s each side\n' +
      '• Dead bugs ×12\n' +
      '• Bird dogs ×12\n' +
      '• Superman ×15\n\n' +
      'Focus on quality over speed. No rest between exercises, 90s between sets.',
    targetDurationMins: 30,
    effortLevel: 'easy',
  },
}
