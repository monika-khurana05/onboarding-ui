import type { SelectedCapability } from '../../models/snapshot';

export type RulesDraftProducer = {
  system: 'payment-initiation';
  artifact: string;
  version: string;
};

export type RulesDraft = {
  schemaVersion: '1.0';
  producer: RulesDraftProducer;
  countryCode: string;
  updatedAt: string;
  validations: SelectedCapability[];
  enrichments: SelectedCapability[];
};

const STORAGE_PREFIX = 'cpx.rulesDraft.v1.';

function getStorageKey(countryCode: string) {
  return `${STORAGE_PREFIX}${countryCode}`;
}

function isRulesDraft(value: unknown): value is RulesDraft {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as RulesDraft;
  return (
    typeof record.schemaVersion === 'string' &&
    typeof record.countryCode === 'string' &&
    typeof record.updatedAt === 'string' &&
    Boolean(record.producer) &&
    typeof record.producer.system === 'string' &&
    Array.isArray(record.validations) &&
    Array.isArray(record.enrichments)
  );
}

export function loadRulesDraft(countryCode: string): RulesDraft | null {
  const key = getStorageKey(countryCode);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isRulesDraft(parsed)) {
      console.warn('Rules draft has invalid shape. Clearing stored draft.');
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse rules draft. Clearing stored draft.', error);
    localStorage.removeItem(key);
    return null;
  }
}

export function saveRulesDraft(draft: RulesDraft): void {
  const key = getStorageKey(draft.countryCode);
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.warn('Failed to persist rules draft.', error);
  }
}

export function clearRulesDraft(countryCode: string): void {
  const key = getStorageKey(countryCode);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear rules draft.', error);
  }
}
