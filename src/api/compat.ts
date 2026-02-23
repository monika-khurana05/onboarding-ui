import type {
  PreviewGenerateResponseDto,
  RepoDefaultDto,
  RepoDefaultsResponseDto,
  SnapshotContextDto
} from './types';

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toTrimmedString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function toNumberMaybe(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function readString(record: RecordValue, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = toTrimmedString(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
}

export function normalizeRepoDefaults(raw: unknown): RepoDefaultsResponseDto {
  const record = isRecord(raw) ? raw : undefined;
  const defaultRef = record ? readString(record, ['defaultRef']) : undefined;

  let source: unknown[] = [];
  if (record) {
    const repoList = record.repos ?? record.targets ?? record.repoDefaults;
    if (Array.isArray(repoList)) {
      source = repoList;
    }
  } else if (Array.isArray(raw)) {
    source = raw;
  }

  const repos = source
    .map((entry) => {
      if (!isRecord(entry)) {
        return null;
      }
      const slug = readString(entry, ['slug', 'repoSlug', 'repository', 'name']);
      if (!slug) {
        return null;
      }
      const label = readString(entry, ['label', 'name']) ?? slug;
      const repoDefaultRef =
        readString(entry, ['defaultRef', 'ref', 'branch', 'baseBranch']) ?? defaultRef ?? 'main';

      return {
        slug,
        label,
        defaultRef: repoDefaultRef
      } satisfies RepoDefaultDto;
    })
    .filter((repo): repo is RepoDefaultDto => Boolean(repo));

  return { repos, defaultRef };
}

export function normalizeSnapshotContext(raw: unknown): SnapshotContextDto {
  if (!isRecord(raw)) {
    return { snapshotVersion: undefined };
  }

  const snapshotRecord = isRecord(raw.snapshot) ? raw.snapshot : undefined;
  const snapshotVersion =
    toNumberMaybe(raw.snapshotVersion) ??
    toNumberMaybe(raw.version) ??
    toNumberMaybe(snapshotRecord?.currentVersion ?? snapshotRecord?.version);

  return {
    ...(raw as SnapshotContextDto),
    snapshotVersion
  };
}

function normalizeMessageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean);
  }
  const single = toTrimmedString(value);
  return single ? [single] : [];
}

export function normalizeGenerateResponse(raw: unknown): PreviewGenerateResponseDto & {
  status: string;
  messages: string[];
  jobId?: string;
} {
  if (!isRecord(raw)) {
    return {
      status: 'UNKNOWN',
      messages: typeof raw === 'string' && raw.trim() ? [raw.trim()] : [],
      jobId: undefined
    };
  }

  const status =
    readString(raw, ['status', 'state']) ??
    (typeof raw.ok === 'boolean' ? (raw.ok ? 'SUCCESS' : 'FAILED') : undefined) ??
    'UNKNOWN';

  const messages = [
    ...normalizeMessageList(raw.messages),
    ...normalizeMessageList(raw.message),
    ...normalizeMessageList(raw.error)
  ];

  const jobId =
    readString(raw, ['jobId', 'job_id', 'executionId', 'id']) ??
    (typeof raw.previewId === 'string' ? raw.previewId : undefined);

  return {
    ...(raw as PreviewGenerateResponseDto),
    status,
    messages,
    jobId
  };
}
