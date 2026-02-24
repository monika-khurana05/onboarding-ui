import type { JiraEpicDraft } from './analysisTypes';

const STORAGE_KEY = 'jiraDraftRegistry.v1';

type RegistryStore = Record<string, JiraEpicDraft>;

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage;
}

export function loadRegistry(): RegistryStore {
  const storage = getStorage();
  if (!storage) {
    return {};
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as RegistryStore;
  } catch (error) {
    console.warn('Failed to load Jira draft registry.', error);
    return {};
  }
}

export function saveRegistry(registry: RegistryStore): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (error) {
    console.warn('Failed to save Jira draft registry.', error);
  }
}

export function findByFingerprint(fingerprint: string): JiraEpicDraft | null {
  const registry = loadRegistry();
  return registry[fingerprint] ?? null;
}

export function upsertDraft(draft: JiraEpicDraft, mode: 'create' | 'update'): RegistryStore {
  const registry = loadRegistry();
  if (!draft.fingerprint) {
    console.warn('Draft fingerprint missing; skipping registry update.', { mode });
    return registry;
  }
  registry[draft.fingerprint] = draft;
  saveRegistry(registry);
  return registry;
}
