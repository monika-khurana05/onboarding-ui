import { ApiError, httpRequest } from './http';
import type {
  CapabilityMetadataDto,
  CreateSnapshotRequestDto,
  CreateSnapshotResponseDto,
  PreviewGenerateRequestDto,
  PreviewGenerateResponseDto,
  RepoDefaultsResponseDto,
  RepoPacksResponseDto,
  RepoPackDto,
  SnapshotDetailDto,
  SnapshotVersionRequestDto,
  SnapshotVersionResponseDto
} from './types';

export async function getRepoDefaults(): Promise<RepoDefaultsResponseDto> {
  return httpRequest<RepoDefaultsResponseDto>('/repo-defaults');
}

export async function createSnapshot(req: CreateSnapshotRequestDto): Promise<CreateSnapshotResponseDto> {
  return httpRequest<CreateSnapshotResponseDto>('/snapshots', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function getSnapshot(snapshotId: string, version?: number): Promise<SnapshotDetailDto> {
  const encodedId = encodeURIComponent(snapshotId);
  const query = typeof version === 'number' ? `?version=${encodeURIComponent(String(version))}` : '';
  return httpRequest<SnapshotDetailDto>(`/snapshots/${encodedId}${query}`);
}

export async function createSnapshotVersion(
  snapshotId: string,
  req: SnapshotVersionRequestDto
): Promise<SnapshotVersionResponseDto> {
  const encodedId = encodeURIComponent(snapshotId);
  return httpRequest<SnapshotVersionResponseDto>(`/snapshots/${encodedId}/versions`, {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

export async function previewGenerate(req: PreviewGenerateRequestDto): Promise<PreviewGenerateResponseDto> {
  return httpRequest<PreviewGenerateResponseDto>('/generate/preview', {
    method: 'POST',
    body: JSON.stringify(req)
  });
}

function normalizeRepoPacks(raw: RepoPacksResponseDto | RepoPackDto[] | null): RepoPackDto[] {
  if (!raw) {
    return [];
  }
  if (Array.isArray(raw)) {
    return raw;
  }
  return raw.packs ?? [];
}

export async function listRepoPacks(repoSlug: string, ref?: string): Promise<RepoPackDto[]> {
  const encodedSlug = encodeURIComponent(repoSlug);
  const query = ref ? `?ref=${encodeURIComponent(ref)}` : '';

  try {
    const raw = await httpRequest<RepoPacksResponseDto | RepoPackDto[]>(`/repos/${encodedSlug}/packs${query}`);
    return normalizeRepoPacks(raw);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return [];
    }
    throw error;
  }
}

export async function getPaymentInitiationCapabilityMetadata(): Promise<CapabilityMetadataDto> {
  const query = '?system=payment-initiation';

  try {
    return await httpRequest<CapabilityMetadataDto>(`/capabilities/metadata${query}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return { capabilities: [] };
    }
    throw error;
  }
}
