// Competition math and vocabulary (spec §11). Pure logic, fully tested.

export const MATCH_TYPES = [
  'USPSA Level 1 (club match)',
  'USPSA Level 2',
  'USPSA Level 3',
  'USPSA Section Championship',
  'USPSA State Championship',
  'USPSA Area Championship',
  'USPSA Nationals',
  'IDPA Match',
  'IDPA Sanctioned (Tier 2+)',
  'Steel Challenge',
  'Local / Outlaw',
  'Other'
];

export const DIVISIONS = [
  'Carry Optics', 'Open', 'Limited', 'Limited Optics', 'Production',
  'Single Stack', 'Revolver', 'PCC', 'Other'
];

export const POWER_FACTORS = ['Minor', 'Major'];

/** Stage hit factor: points per second. */
export function hitFactor(points: number | null, time: number | null): number | null {
  if (points === null || time === null || !(time > 0) || points < 0) return null;
  return Math.round((points / time) * 10000) / 10000;
}

/** USPSA classification bands. */
export const USPSA_CLASSES = [
  { name: 'GM', min: 95 },
  { name: 'M', min: 85 },
  { name: 'A', min: 75 },
  { name: 'B', min: 60 },
  { name: 'C', min: 40 },
  { name: 'D', min: 0 }
] as const;

export function classFor(percent: number): string {
  for (const band of USPSA_CLASSES) {
    if (percent >= band.min) return band.name;
  }
  return 'D';
}

export interface ClassifierScore { date: string; percent: number | null; }

export interface ClassProgress {
  average: number | null;   // best 6 of the most recent 8 scores
  scoresUsed: number[];     // the percents that made the average
  scoresOnRecord: number;   // how many valid scores exist at all
  currentClass: string | null;
  next: { name: string; threshold: number } | null;
}

/** USPSA-style progress: best 6 of the most recent 8 valid scores. */
export function classificationProgress(scores: ClassifierScore[]): ClassProgress {
  const valid = scores
    .filter((s) => s.percent !== null && Number.isFinite(s.percent))
    .sort((a, b) => b.date.localeCompare(a.date));
  const recent = valid.slice(0, 8).map((s) => s.percent as number);
  const used = [...recent].sort((a, b) => b - a).slice(0, 6);
  if (used.length === 0) {
    return { average: null, scoresUsed: [], scoresOnRecord: 0, currentClass: null, next: null };
  }
  const average = Math.round((used.reduce((s, p) => s + p, 0) / used.length) * 100) / 100;
  const currentClass = classFor(average);
  const band = USPSA_CLASSES.findIndex((b) => b.name === currentClass);
  const next = band > 0
    ? { name: USPSA_CLASSES[band - 1].name, threshold: USPSA_CLASSES[band - 1].min }
    : null;
  return { average, scoresUsed: used, scoresOnRecord: valid.length, currentClass, next };
}
