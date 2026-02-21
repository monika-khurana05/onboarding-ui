import type { RulesConfig, SnapshotCapability } from '../../models/snapshot';

export type OnboardingDraft = {
  workflow?: Record<string, unknown>;
  selectedValidations: string[];
  selectedEnrichments: string[];
  capabilities?: SnapshotCapability[];
  rulesConfig?: RulesConfig;
};

const STORAGE_KEY = 'onboarding:draft:v1';

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
}

function normalizeCapabilities(value: unknown): SnapshotCapability[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value as SnapshotCapability[];
}

function normalizeRulesConfig(value: unknown): RulesConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const validations = Array.isArray(value.validations) ? value.validations : [];
  const enrichments = Array.isArray(value.enrichments) ? value.enrichments : [];
  const metadata = isRecord(value.metadata) ? (value.metadata as RulesConfig['metadata']) : undefined;
  return { metadata, validations, enrichments };
}

function extractWorkflow(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const workflowCandidate = value.workflow;
  if (isRecord(workflowCandidate)) {
    return workflowCandidate;
  }
  if ('workflowKey' in value || 'states' in value) {
    return value;
  }
  return undefined;
}

export function loadOnboardingDraft(): OnboardingDraft | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      workflow: extractWorkflow(parsed),
      selectedValidations: normalizeStringArray(parsed.selectedValidations),
      selectedEnrichments: normalizeStringArray(parsed.selectedEnrichments),
      capabilities: normalizeCapabilities(parsed.capabilities),
      rulesConfig: normalizeRulesConfig(parsed.rulesConfig)
    };
  } catch (error) {
    console.warn('Failed to parse onboarding draft. Clearing stored draft.', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function saveOnboardingDraft(draft: OnboardingDraft): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch (error) {
    console.warn('Failed to persist onboarding draft.', error);
  }
}
