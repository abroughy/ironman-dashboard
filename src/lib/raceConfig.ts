export const RACE_CONFIGS = {
  '70.3': {
    label: 'Half Ironman 70.3',
    swim: 1900,
    bike: 90000,
    run: 21097,
    hasSwim: true,
    hasBike: true,
    hasRun: true,
  },
  '140.6': {
    label: 'Full Ironman 140.6',
    swim: 3800,
    bike: 180000,
    run: 42195,
    hasSwim: true,
    hasBike: true,
    hasRun: true,
  },
  'olympic': {
    label: 'Olympic Triathlon',
    swim: 1500,
    bike: 40000,
    run: 10000,
    hasSwim: true,
    hasBike: true,
    hasRun: true,
  },
  'sprint': {
    label: 'Sprint Triathlon',
    swim: 750,
    bike: 20000,
    run: 5000,
    hasSwim: true,
    hasBike: true,
    hasRun: true,
  },
  'marathon': {
    label: 'Marathon',
    swim: 0,
    bike: 0,
    run: 42195,
    hasSwim: false,
    hasBike: false,
    hasRun: true,
  },
  'half-marathon': {
    label: 'Half Marathon',
    swim: 0,
    bike: 0,
    run: 21097,
    hasSwim: false,
    hasBike: false,
    hasRun: true,
  },
  'fitness': {
    label: 'General Fitness',
    swim: 0,
    bike: 0,
    run: 0,
    hasSwim: true,
    hasBike: true,
    hasRun: true,
  },
}

export type RaceType = keyof typeof RACE_CONFIGS

export function getRaceConfig(raceType: string) {
  return RACE_CONFIGS[raceType as RaceType] ?? RACE_CONFIGS['70.3']
}
