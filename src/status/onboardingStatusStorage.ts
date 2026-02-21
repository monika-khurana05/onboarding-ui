import type { Flow, Lifecycle, OnboardingStatus, StageKey, StageStatus } from './types';
import { STAGE_ORDER } from './types';

const STORAGE_KEY = 'onboarding_status_v1';

type StageEntry = { status: StageStatus; updatedAt?: string; note?: string };

function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

function isStageStatus(value: unknown): value is StageStatus {
  return value === 'NOT_STARTED' || value === 'IN_PROGRESS' || value === 'BLOCKED' || value === 'DONE';
}

function isLifecycle(value: unknown): value is Lifecycle {
  return value === 'DRAFT' || value === 'IN_PROGRESS' || value === 'BLOCKED' || value === 'DONE';
}

function buildDefaultStages(): Record<StageKey, StageEntry> {
  return STAGE_ORDER.reduce(
    (acc, key) => {
      acc[key] = { status: 'NOT_STARTED' };
      return acc;
    },
    {} as Record<StageKey, StageEntry>
  );
}

function deriveCurrentStage(stages: Record<StageKey, StageEntry>): StageKey {
  const blocked = STAGE_ORDER.find((key) => stages[key]?.status === 'BLOCKED');
  if (blocked) {
    return blocked;
  }
  const inProgress = STAGE_ORDER.find((key) => stages[key]?.status === 'IN_PROGRESS');
  if (inProgress) {
    return inProgress;
  }
  const notStarted = STAGE_ORDER.find((key) => stages[key]?.status === 'NOT_STARTED');
  if (notStarted) {
    return notStarted;
  }
  return STAGE_ORDER[STAGE_ORDER.length - 1];
}

function deriveLifecycle(stages: Record<StageKey, StageEntry>): Lifecycle {
  const allDone = STAGE_ORDER.every((key) => stages[key]?.status === 'DONE');
  if (allDone) {
    return 'DONE';
  }
  const anyBlocked = STAGE_ORDER.some((key) => stages[key]?.status === 'BLOCKED');
  if (anyBlocked) {
    return 'BLOCKED';
  }
  const anyActive = STAGE_ORDER.some((key) => {
    const status = stages[key]?.status;
    return status === 'IN_PROGRESS' || status === 'DONE';
  });
  if (anyActive) {
    return 'IN_PROGRESS';
  }
  return 'DRAFT';
}

function deriveBlockers(stages: Record<StageKey, StageEntry>): string[] | undefined {
  const blockers = STAGE_ORDER.filter((key) => stages[key]?.status === 'BLOCKED').map((key) => {
    const note = stages[key]?.note?.trim();
    return note || `${key} blocked`;
  });
  return blockers.length ? blockers : undefined;
}

function normalizeStatus(record: unknown): OnboardingStatus | null {
  if (!record || typeof record !== 'object') {
    return null;
  }
  const candidate = record as Partial<OnboardingStatus> & Record<string, unknown>;
  const countryCode = normalizeCountryCode(String(candidate.countryCode ?? ''));
  if (!countryCode) {
    return null;
  }
  const flow = candidate.flow === 'OUTGOING' ? 'OUTGOING' : candidate.flow === 'INCOMING' ? 'INCOMING' : null;
  if (!flow) {
    return null;
  }

  const stages = buildDefaultStages();
  if (candidate.stages && typeof candidate.stages === 'object') {
    const rawStages = candidate.stages as Record<string, unknown>;
    STAGE_ORDER.forEach((key) => {
      const entry = rawStages[key];
      if (!entry || typeof entry !== 'object') {
        return;
      }
      const rawEntry = entry as Record<string, unknown>;
      const status = isStageStatus(rawEntry.status) ? rawEntry.status : stages[key].status;
      const updatedAt = typeof rawEntry.updatedAt === 'string' ? rawEntry.updatedAt : undefined;
      const note = typeof rawEntry.note === 'string' ? rawEntry.note : undefined;
      stages[key] = { status, updatedAt, note };
    });
  }

  const derivedLifecycle = deriveLifecycle(stages);
  const lifecycle =
    candidate.lifecycle === 'DONE' ? 'DONE' : isLifecycle(candidate.lifecycle) ? candidate.lifecycle : derivedLifecycle;
  const updatedAt = typeof candidate.updatedAt === 'string' ? candidate.updatedAt : new Date().toISOString();
  const links =
    candidate.links && typeof candidate.links === 'object'
      ? (candidate.links as OnboardingStatus['links'])
      : undefined;

  const next: OnboardingStatus = {
    countryCode,
    flow,
    lifecycle,
    currentStage: deriveCurrentStage(stages),
    stages,
    percentComplete: 0,
    blockers: deriveBlockers(stages),
    owner: typeof candidate.owner === 'string' ? candidate.owner : undefined,
    updatedAt,
    links
  };
  next.percentComplete = recalcPercent(next);
  return next;
}

function saveStatuses(statuses: OnboardingStatus[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses));
  } catch (error) {
    console.warn('Failed to save onboarding status list.', error);
  }
}

export function listStatuses(): OnboardingStatus[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .map((entry) => normalizeStatus(entry))
      .filter((entry): entry is OnboardingStatus => Boolean(entry))
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  } catch (error) {
    console.warn('Failed to load onboarding status list.', error);
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
}

export function recalcPercent(status: OnboardingStatus): number {
  const doneCount = STAGE_ORDER.filter((key) => status.stages[key]?.status === 'DONE').length;
  return Math.round((doneCount / STAGE_ORDER.length) * 100);
}

export function upsertStatus(status: OnboardingStatus): void {
  const normalized = normalizeStatus(status);
  if (!normalized) {
    return;
  }
  const existing = listStatuses();
  const next = [
    normalized,
    ...existing.filter((entry) => !(entry.countryCode === normalized.countryCode && entry.flow === normalized.flow))
  ].sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
  saveStatuses(next);
}

export function getStatus(countryCode: string, flow: Flow): OnboardingStatus | null {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) {
    return null;
  }
  return listStatuses().find((entry) => entry.countryCode === normalized && entry.flow === flow) ?? null;
}

export function ensureStatus(countryCode: string, flow: Flow): OnboardingStatus {
  const normalized = normalizeCountryCode(countryCode);
  const existing = getStatus(normalized, flow);
  if (existing) {
    return existing;
  }
  const stages = buildDefaultStages();
  const now = new Date().toISOString();
  const status: OnboardingStatus = {
    countryCode: normalized,
    flow,
    lifecycle: 'DRAFT',
    currentStage: 'REQUIREMENTS',
    stages,
    percentComplete: 0,
    updatedAt: now
  };
  status.percentComplete = recalcPercent(status);
  upsertStatus(status);
  return status;
}

export function setStage(
  countryCode: string,
  flow: Flow,
  stageKey: StageKey,
  stageStatus: StageStatus,
  note?: string,
  linksPatch?: OnboardingStatus['links']
): void {
  const normalized = normalizeCountryCode(countryCode);
  if (!normalized) {
    return;
  }
  const base = ensureStatus(normalized, flow);
  const now = new Date().toISOString();
  const stageNote = typeof note === 'string' ? note.trim() : undefined;
  const updatedStage: StageEntry = {
    status: stageStatus,
    updatedAt: now,
    note: stageNote || base.stages[stageKey]?.note
  };
  const nextStages = {
    ...base.stages,
    [stageKey]: updatedStage
  };
  const forceDone = stageKey === 'TESTING' && stageStatus === 'DONE';
  const next: OnboardingStatus = {
    ...base,
    stages: nextStages,
    currentStage: deriveCurrentStage(nextStages),
    lifecycle: forceDone ? 'DONE' : deriveLifecycle(nextStages),
    percentComplete: 0,
    blockers: deriveBlockers(nextStages),
    updatedAt: now,
    links: linksPatch ? { ...(base.links ?? {}), ...linksPatch } : base.links
  };
  next.percentComplete = recalcPercent(next);
  upsertStatus(next);
}
