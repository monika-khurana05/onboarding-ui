import type { SnapshotModel } from '../models/snapshot';

export type ApiErrorResponseDto = {
  error?: string;
  message?: string;
};

export type HealthResponseDto = {
  status: string;
  service?: string;
  version?: string;
  timestamp?: string;
  checks?: Record<string, string | number | boolean>;
};

export type RepoDefaultDto = {
  slug?: string;
  repoSlug?: string;
  name?: string;
  label?: string;
  defaultRef?: string;
  ref?: string;
  branch?: string;
};

export type RepoDefaultsResponseDto = {
  repos?: RepoDefaultDto[];
  repoDefaults?: RepoDefaultDto[];
  defaultRef?: string;
};

export type CreateSnapshotRequestDto = {
  countryCode: string;
  snapshot: SnapshotModel;
  templatePacks?: Record<string, string>;
};

export type SnapshotDetailDto = {
  snapshotId?: string;
  id?: string;
  snapshot_id?: string;
  version?: number;
  currentVersion?: number;
  createdAt?: string;
  updatedAt?: string;
  payload?: unknown;
  snapshot?: unknown;
  data?: unknown;
  versions?: number[];
  templatePacks?: Record<string, string>;
  template_packs?: Record<string, string>;
};

export type CreateSnapshotResponseDto = SnapshotDetailDto;

export type SnapshotVersionRequestDto = {
  countryCode?: string;
  snapshot: SnapshotModel;
  templatePacks?: Record<string, string>;
};

export type SnapshotVersionResponseDto = SnapshotDetailDto;

export type PreviewGenerateRequestDto = {
  snapshotId: string;
  version?: number;
  repos?: string[];
  repoTargets?: {
    repoSlug: string;
    baseBranch?: string;
    packVersion?: string;
  }[];
};

export type PreviewArtifactDto = {
  domain?: string;
  filePath?: string;
  repository?: string;
  status?: string;
  summary?: string;
};

export type PreviewFileDto = {
  path?: string;
  filePath?: string;
  name?: string;
  sizeBytes?: number;
  sha256?: string;
  previewText?: string;
  preview?: string;
  content?: string;
  status?: string;
};

export type PreviewRepoResultDto = {
  repoSlug?: string;
  slug?: string;
  repository?: string;
  name?: string;
  packVersion?: string;
  pack?: string;
  status?: string;
  files?: PreviewFileDto[];
  generatedFiles?: PreviewFileDto[];
  artifacts?: PreviewArtifactDto[];
};

export type PreviewErrorDto = {
  message?: string;
  error?: string;
  severity?: string;
  repoSlug?: string;
  repository?: string;
  repo?: string;
};

export type PreviewGenerateResponseDto = {
  previewId?: string;
  generatedArtifacts?: PreviewArtifactDto[];
  artifacts?: PreviewArtifactDto[];
  repos?: PreviewRepoResultDto[];
  errors?: Array<PreviewErrorDto | string> | PreviewErrorDto | string;
};

export type RepoPackDto = {
  packName?: string;
  name?: string;
  slug?: string;
  ref?: string;
  updatedAt?: string;
};

export type RepoPacksResponseDto = {
  packs?: RepoPackDto[];
};
