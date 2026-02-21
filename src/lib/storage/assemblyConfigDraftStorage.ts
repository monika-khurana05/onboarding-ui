export type AssemblyConfigDraftCapability = {
  id: string;
  capabilityName: string;
  versionArtifact?: string;
  artifactVersion?: string;
  primaryArtifact?: {
    groupId?: string;
    artifactId?: string;
    version?: string;
  };
  additionalArtifacts?: Array<{
    id?: string;
    groupId?: string;
    artifactId?: string;
    version?: string;
    notes?: string;
  }>;
  ownerName?: string;
  status?: string;
  pipelineKey?: string;
  kafkaTopics?: string[];
  kafkaBindings?: Array<{
    id?: string;
    purpose?: string;
    topicName?: string;
    clusterAlias?: string;
    consumerGroup?: string;
    keySchema?: string;
    valueSchema?: string;
    partitionCount?: number;
    replicationFactor?: number;
    notes?: string;
  }>;
  mongoEnabled?: boolean;
  mongoSslEnable?: boolean;
  mongoServers?: string[] | string;
  mongoDatabase?: string;
  mongoUsername?: string;
  mongoPasswordRef?: string;
  mongoAuthDb?: string;
  trustStoreLocation?: string;
  trustStoreType?: string;
  trustStorePasswordRef?: string;
  mongoCollections?: Array<{
    id?: string;
    name?: string;
    purpose?: string;
    retentionDays?: number;
    indexesNotes?: string;
  }> | string[];
  batchingMongoWriterSize?: number;
  threadCount?: number;
  configFiles?: string[];
  configPaths?: string[];
  capabilityParams?: Array<{ id?: string; key?: string; value?: string }>;
  lastUpdated?: string;
};

export type AssemblyConfigDraft = {
  schemaVersion: '1.0';
  countryCode: string;
  updatedAt: string;
  direction?: string;
  environment?: string;
  snapshotVersion?: string;
  capabilities: AssemblyConfigDraftCapability[];
};

const STORAGE_PREFIX = 'cpx.assemblyConfig.v1.';

function getStorageKey(countryCode: string) {
  return `${STORAGE_PREFIX}${countryCode}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isDraftCapability(value: unknown): value is AssemblyConfigDraftCapability {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.id === 'string' && typeof value.capabilityName === 'string';
}

function isAssemblyConfigDraft(value: unknown): value is AssemblyConfigDraft {
  if (!isRecord(value)) {
    return false;
  }
  const record = value as AssemblyConfigDraft;
  return (
    typeof record.schemaVersion === 'string' &&
    typeof record.countryCode === 'string' &&
    typeof record.updatedAt === 'string' &&
    Array.isArray(record.capabilities) &&
    record.capabilities.every(isDraftCapability)
  );
}

export function loadAssemblyConfigDraft(countryCode: string): AssemblyConfigDraft | null {
  const key = getStorageKey(countryCode);
  const raw = localStorage.getItem(key);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!isAssemblyConfigDraft(parsed)) {
      console.warn('Assembly config draft has invalid shape. Clearing stored draft.');
      localStorage.removeItem(key);
      return null;
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse assembly config draft. Clearing stored draft.', error);
    localStorage.removeItem(key);
    return null;
  }
}

export function saveAssemblyConfigDraft(draft: AssemblyConfigDraft): void {
  const key = getStorageKey(draft.countryCode);
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (error) {
    console.warn('Failed to persist assembly config draft.', error);
  }
}

export function clearAssemblyConfigDraft(countryCode: string): void {
  const key = getStorageKey(countryCode);
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to clear assembly config draft.', error);
  }
}
