import { z } from 'zod';
import { apiFetch } from '../../lib/apiClient';
import type { GeneratePreviewValues, SnapshotFormValues, SnapshotVersionValues } from './schema';
import type {
  GeneratePreviewResult,
  HealthResponse,
  RepoDefault,
  RepoDefaultsResponse,
  RepoPack,
  SnapshotDetail,
  SnapshotSummary,
  SnapshotVersionResult
} from './types';

const healthSchema = z
  .object({
    status: z.string(),
    service: z.string().optional(),
    version: z.string().optional(),
    timestamp: z.string().optional(),
    checks: z.record(z.string(), z.unknown()).optional()
  })
  .passthrough();

const repoDefaultsSchema = z
  .object({
    repos: z
      .array(
        z
          .object({
            slug: z.string().optional(),
            repoSlug: z.string().optional(),
            name: z.string().optional(),
            label: z.string().optional(),
            defaultRef: z.string().optional(),
            ref: z.string().optional(),
            branch: z.string().optional()
          })
          .passthrough()
      )
      .optional(),
    repoDefaults: z
      .array(
        z
          .object({
            slug: z.string().optional(),
            repoSlug: z.string().optional(),
            name: z.string().optional(),
            label: z.string().optional(),
            defaultRef: z.string().optional(),
            ref: z.string().optional(),
            branch: z.string().optional()
          })
          .passthrough()
      )
      .optional(),
    defaultRef: z.string().optional()
  })
  .passthrough();

const snapshotDetailSchema = z
  .object({
    snapshotId: z.string().optional(),
    id: z.string().optional(),
    snapshot_id: z.string().optional(),
    version: z.number().optional(),
    currentVersion: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    payload: z.unknown().optional(),
    snapshot: z.unknown().optional(),
    data: z.unknown().optional(),
    versions: z.array(z.number()).optional()
  })
  .passthrough();

function getSnapshotId(record: z.infer<typeof snapshotDetailSchema>): string {
  return record.snapshotId ?? record.id ?? record.snapshot_id ?? 'unknown-snapshot';
}

function getSnapshotPayload(record: z.infer<typeof snapshotDetailSchema>): unknown {
  return record.payload ?? record.snapshot ?? record.data;
}

function toRepoDefaults(payload: z.infer<typeof repoDefaultsSchema>): RepoDefaultsResponse {
  const source = payload.repos ?? payload.repoDefaults ?? [];
  const defaults: RepoDefault[] = source
    .map((repo) => {
      const slug = repo.slug ?? repo.repoSlug ?? repo.name;
      if (!slug) {
        return null;
      }
      return {
        slug,
        label: repo.label ?? repo.name ?? slug,
        defaultRef: repo.defaultRef ?? repo.ref ?? repo.branch ?? payload.defaultRef ?? 'main'
      };
    })
    .filter((repo): repo is RepoDefault => Boolean(repo));

  return { repos: defaults };
}

function mapSnapshotDetail(raw: unknown): SnapshotDetail {
  const parsed = snapshotDetailSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      snapshotId: 'unknown-snapshot',
      raw
    };
  }
  const data = parsed.data;
  return {
    snapshotId: getSnapshotId(data),
    version: data.version ?? data.currentVersion,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    payload: getSnapshotPayload(data),
    versions: data.versions,
    raw
  };
}

function mapVersionResult(raw: unknown): SnapshotVersionResult {
  const parsed = snapshotDetailSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      snapshotId: 'unknown-snapshot',
      raw
    };
  }

  return {
    snapshotId: getSnapshotId(parsed.data),
    version: parsed.data.version ?? parsed.data.currentVersion,
    raw
  };
}

export async function getHealth(): Promise<HealthResponse> {
  try {
    const raw = await apiFetch<unknown>('/health');
    const parsed = healthSchema.safeParse(raw);
    if (!parsed.success) {
      return { status: 'unknown' };
    }
    const checks = parsed.data.checks
      ? Object.fromEntries(
          Object.entries(parsed.data.checks).filter((entry): entry is [string, string | number | boolean] => {
            return (
              typeof entry[1] === 'string' || typeof entry[1] === 'number' || typeof entry[1] === 'boolean'
            );
          })
        )
      : undefined;

    return {
      status: parsed.data.status,
      service: parsed.data.service,
      version: parsed.data.version,
      timestamp: parsed.data.timestamp,
      checks
    };
  } catch {
    return { status: 'unknown' };
  }
}

export async function getRepoDefaults(): Promise<RepoDefaultsResponse> {
  const raw = await apiFetch<unknown>('/repo-defaults');
  const parsed = repoDefaultsSchema.safeParse(raw);
  if (!parsed.success) {
    return { repos: [] };
  }
  return toRepoDefaults(parsed.data);
}

export async function createSnapshot(payload: SnapshotFormValues): Promise<SnapshotSummary> {
  const requestPayload = {
    country: {
      code: payload.countryCode,
      name: payload.countryName,
      legalEntity: payload.legalEntity,
      region: payload.region
    },
    requestedBy: payload.requestedBy,
    capabilityDomains: {
      glsClearing: { enabled: payload.domains.glsClearing },
      sanctions: { enabled: payload.domains.sanctions },
      posting: { enabled: payload.domains.posting },
      routing: { enabled: payload.domains.routing },
      initiation: { enabled: payload.domains.initiation },
      stateManager: { enabled: payload.domains.stateManager },
      notificationsBigdata: { enabled: payload.domains.notificationsBigdata }
    },
    generation: {
      generateFsm: payload.generateFsm,
      generateConfigs: payload.generateConfigs,
      commitStrategy: payload.commitStrategy
    },
    notes: payload.notes || undefined
  };

  const raw = await apiFetch<unknown>('/snapshots', {
    method: 'POST',
    body: JSON.stringify(requestPayload)
  });
  const detail = mapSnapshotDetail(raw);
  return {
    snapshotId: detail.snapshotId,
    version: detail.version
  };
}

export async function getSnapshot(snapshotId: string, version?: string): Promise<SnapshotDetail> {
  const encodedId = encodeURIComponent(snapshotId);
  const query = version ? `?version=${encodeURIComponent(version)}` : '';
  const raw = await apiFetch<unknown>(`/snapshots/${encodedId}${query}`);
  return mapSnapshotDetail(raw);
}

export async function createSnapshotVersion(
  snapshotId: string,
  payload: SnapshotVersionValues
): Promise<SnapshotVersionResult> {
  const encodedId = encodeURIComponent(snapshotId);
  const raw = await apiFetch<unknown>(`/snapshots/${encodedId}/versions`, {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  return mapVersionResult(raw);
}

export async function generatePreview(
  payload: GeneratePreviewValues
): Promise<GeneratePreviewResult> {
  const raw = await apiFetch<unknown>('/generate/preview', {
    method: 'POST',
    body: JSON.stringify({
      snapshotId: payload.snapshotId,
      version: payload.version ? Number(payload.version) : undefined,
      repos: payload.repos
    })
  });

  if (raw && typeof raw === 'object') {
    const typed = raw as {
      previewId?: string;
      generatedArtifacts?: {
        domain?: string;
        filePath?: string;
        repository?: string;
        status?: string;
        summary?: string;
      }[];
      artifacts?: {
        domain?: string;
        filePath?: string;
        repository?: string;
        status?: string;
        summary?: string;
      }[];
    };
    return {
      previewId: typed.previewId,
      generatedArtifacts: typed.generatedArtifacts ?? typed.artifacts,
      raw
    };
  }

  return { raw };
}

function readPackName(record: Record<string, unknown>, fallback: string): string {
  const fromPackName = typeof record.packName === 'string' ? record.packName : undefined;
  const fromName = typeof record.name === 'string' ? record.name : undefined;
  const fromSlug = typeof record.slug === 'string' ? record.slug : undefined;
  return fromPackName ?? fromName ?? fromSlug ?? fallback;
}

export async function getRepoPacks(repoSlug: string, ref = 'main'): Promise<RepoPack[]> {
  const encodedSlug = encodeURIComponent(repoSlug);
  const encodedRef = encodeURIComponent(ref);
  const raw = await apiFetch<unknown>(`/repos/${encodedSlug}/packs?ref=${encodedRef}`);

  if (Array.isArray(raw)) {
    const items = raw as unknown[];
    return items.map((item, index) => {
      if (!item || typeof item !== 'object') {
        return { packName: `pack-${index + 1}`, raw: item };
      }
      const record = item as Record<string, unknown>;
      const packName = readPackName(record, `pack-${index + 1}`);
      return {
        packName,
        ref: typeof record.ref === 'string' ? record.ref : undefined,
        updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
        raw: item
      };
    });
  }

  if (raw && typeof raw === 'object') {
    const record = raw as { packs?: unknown[] };
    if (Array.isArray(record.packs)) {
      return record.packs.map((item, index) => {
        if (!item || typeof item !== 'object') {
          return { packName: `pack-${index + 1}`, raw: item };
        }
        const packRecord = item as Record<string, unknown>;
        const packName = readPackName(packRecord, `pack-${index + 1}`);
        return {
          packName,
          ref: typeof packRecord.ref === 'string' ? packRecord.ref : undefined,
          updatedAt: typeof packRecord.updatedAt === 'string' ? packRecord.updatedAt : undefined,
          raw: item
        };
      });
    }
  }

  return [];
}
