export type Flow = 'INCOMING' | 'OUTGOING';

export type StageKey =
  | 'REQUIREMENTS'
  | 'PAYLOAD_MAPPING'
  | 'SNAPSHOT_CREATION'
  | 'ASSEMBLY_CREATION'
  | 'TESTING';

export type StageStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
export type Lifecycle = 'DRAFT' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';

export type OnboardingStatus = {
  countryCode: string; // e.g. AR, BR
  flow: Flow;

  lifecycle: Lifecycle;
  currentStage: StageKey;

  stages: Record<StageKey, { status: StageStatus; updatedAt?: string; note?: string }>;
  percentComplete: number; // derived

  blockers?: string[];
  owner?: string;
  updatedAt: string;

  links?: {
    requirementsSessionKey?: string; // ai.requirements.<cc>
    mappingSessionKey?: string; // ai.mapping.<sheetId>
    snapshotId?: string;
    assemblyPrUrl?: string;
    testPackKey?: string; // ai.tests.<cc>
  };
};

export const STAGE_ORDER: StageKey[] = [
  'REQUIREMENTS',
  'PAYLOAD_MAPPING',
  'SNAPSHOT_CREATION',
  'ASSEMBLY_CREATION',
  'TESTING'
];
