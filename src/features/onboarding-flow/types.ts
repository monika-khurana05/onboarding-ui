export type CapabilityDomainSlug =
  | 'glsClearing'
  | 'sanctions'
  | 'posting'
  | 'routing'
  | 'initiation'
  | 'stateManager'
  | 'notificationsBigdata';

export type CapabilityDomainDefinition = {
  slug: CapabilityDomainSlug;
  label: string;
  description: string;
  repositoryHint: string;
};

export type SnapshotPayload = {
  country: {
    code: string;
    name: string;
    legalEntity: string;
    region: 'Americas' | 'EMEA' | 'APAC';
  };
  requestedBy: string;
  capabilityDomains: Record<CapabilityDomainSlug, { enabled: boolean; notes?: string }>;
  generation: {
    generateFsm: boolean;
    generateConfigs: boolean;
    commitStrategy: 'mono-repo' | 'multi-repo';
  };
  notes?: string;
};

export type HealthResponse = {
  status: string;
  service?: string;
  version?: string;
  timestamp?: string;
  checks?: Record<string, string | boolean | number>;
};

export type RepoDefault = {
  slug: string;
  label: string;
  defaultRef: string;
};

export type RepoDefaultsResponse = {
  repos: RepoDefault[];
};

export type SnapshotSummary = {
  snapshotId: string;
  version?: number;
};

export type SnapshotDetail = {
  snapshotId: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  payload?: unknown;
  versions?: number[];
  raw: unknown;
};

export type SnapshotVersionResult = {
  snapshotId: string;
  version?: number;
  raw: unknown;
};

export type GeneratePreviewResult = {
  previewId?: string;
  generatedArtifacts?: {
    domain?: string;
    filePath?: string;
    repository?: string;
    status?: string;
    summary?: string;
  }[];
  raw: unknown;
};

export type RepoPack = {
  packName: string;
  ref?: string;
  updatedAt?: string;
  raw: unknown;
};
