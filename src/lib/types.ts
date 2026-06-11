// FirearmLog data model — spec §5.
// Plain TypeScript types only (no enums/classes) so these files also run
// under Node's type-stripping for tests.

export type GunCategory = 'Pistol' | 'Rifle' | 'Shotgun' | 'PCC' | 'Revolver' | 'Other';

export const GUN_CATEGORIES: GunCategory[] = ['Pistol', 'Rifle', 'Shotgun', 'PCC', 'Revolver', 'Other'];

/** Every record carries these — spec §3.2.3. */
export interface BaseRecord {
  id: string;
  createdAt: number; // ms epoch
  updatedAt: number; // ms epoch
}

/**
 * Fields from an imported record that the current model doesn't formally map
 * yet are preserved verbatim here — the zero-loss guarantee (spec §6).
 */
export interface Imported {
  legacy?: Record<string, unknown>;
}

export interface Firearm extends BaseRecord, Imported {
  name: string;
  manufacturer: string;
  model: string;
  caliber: string;
  category: GunCategory;
  serialNumber: string | null;
  dateAcquired: string; // YYYY-MM-DD or ''
  startingRoundCount: number;
  recoilSpringInterval?: number | null;
  recoilSpringWeight?: string | null;
  barrelName?: string | null;
  barrelInstallDate?: string | null;
  barrelStartRounds?: number | null;
  photoIds: string[]; // Media records
  referenceId: string | null; // linked Reference (spec §9)
  notes: string;
}

export interface SessionGun {
  firearmId: string;
  rounds: number;
}

export interface DrillResult {
  name: string; // references DrillDef.name (old-app convention, kept on import)
  distance: string;
  time: number | null;
  score: number | null;
  maxScore: number | null;
  notes: string;
}

export interface Session extends BaseRecord, Imported {
  date: string; // YYYY-MM-DD
  type: string; // 'practice' | 'dry_fire' | 'class' (old values kept verbatim)
  guns: SessionGun[]; // one or more, with per-gun round splits (spec §5.2)
  location: string;
  distances: string;
  notes: string;
  ammoUsage: { ammoId: string; rounds: number }[];
  drills: DrillResult[];
  targetMediaIds: string[];
  malfunctions: unknown[]; // formalized in M2
  selfRating: Record<string, number> | null;
  rangeFee: number | null; // first-class cost source (spec §12.2)
  planned: boolean;
  checklist: unknown | null;
}

export interface DrillDef extends BaseRecord, Imported {
  name: string;
  gunCategories: GunCategory[]; // spec req. 19
  fire: 'live' | 'dry' | 'both'; // spec req. 19
  briefDescription: string;
  fullDescription: string; // expandable (req. 20)
  scoring: string;
  requiresHolster: boolean;
  tags: string[];
}

export interface Ammunition extends BaseRecord, Imported {
  brand: string;
  caliber: string;
  grain: string;
  bulletType: string;
  quantity: number;
  costPerRound: number;
  notes: string;
}

export interface Purchase extends BaseRecord, Imported {
  date: string;
  category: string;
  item: string;
  vendor: string;
  cost: number;
  notes: string;
}

export interface MaintenanceEntry extends BaseRecord, Imported {
  date: string;
  firearmId: string;
  type: string;
  performedBy: string;
  partsReplaced: string;
  notes: string;
}

export interface MalfunctionEntry extends BaseRecord, Imported {
  sessionId: string | null;
  date: string;
  firearmId: string;
  type: string;       // plain language, e.g. "Failure to feed"
  resolution: string; // what cleared it
  notes: string;
}

export interface Magazine extends BaseRecord, Imported {
  label: string;
  firearmIds: string[];
  active: boolean;
  totalRounds: number;
  springHistory: unknown[];
  notes: string;
}

export interface Optic extends BaseRecord, Imported {
  firearmId: string;
  make: string;
  model: string;
  installDate: string;
  dotSize: string;
  zeroDist: string;
  mountHeight: string;
  torqueSpec: string;
  settingsSnapshot: string;
  batteryLog: unknown[];
  notes: string;
}

export interface Part extends BaseRecord, Imported {
  firearmId: string;
  name: string;
  quantity: number;
  partNumber: string;
  datePurchased: string;
  notes: string;
}

export interface Goal extends BaseRecord, Imported {
  [key: string]: unknown;
}

export interface SkillAssessment extends BaseRecord, Imported {
  [key: string]: unknown;
}

export interface Match extends BaseRecord, Imported {
  [key: string]: unknown; // formalized in M5
}

export interface Classifier extends BaseRecord, Imported {
  [key: string]: unknown; // formalized in M5
}

export interface Reference extends BaseRecord {
  manufacturer: string;
  categories: GunCategory[];
  body: string;
}

/** Every image/video has a name and annotations — spec §5.15, req. 29. */
export interface Media extends BaseRecord {
  ownerType: 'firearm' | 'session' | 'match' | 'drill' | 'maintenance';
  ownerId: string;
  kind: 'image' | 'video';
  name: string;
  annotations: string[];
  mime: string;
  /** Raw image/video bytes. ArrayBuffer (not Blob) — iPhone Safari saves these reliably. */
  data: ArrayBuffer;
}

/** Old-app trash items, carried over so nothing is lost (Q7). */
export interface TrashItem extends BaseRecord {
  recordType: string;
  deletedAt: number | string | null;
  payload: unknown;
}

export interface AppSettings {
  ownerName: string;
  theme: string;
  checklistCustomItems: unknown;
  legacy?: Record<string, unknown>;
}

/** Everything the importer produces, keyed by object store. */
export interface DataSet {
  firearms: Firearm[];
  sessions: Session[];
  drills: DrillDef[];
  ammunition: Ammunition[];
  purchases: Purchase[];
  maintenance: MaintenanceEntry[];
  malfunctions: BaseRecord[];
  magazines: Magazine[];
  optics: Optic[];
  parts: Part[];
  goals: Goal[];
  skills: SkillAssessment[];
  matches: Match[];
  classifiers: Classifier[];
  references: Reference[];
  media: Media[];
  trash: TrashItem[];
}
