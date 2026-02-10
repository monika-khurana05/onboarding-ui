import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FolderOffOutlinedIcon from '@mui/icons-material/FolderOffOutlined';
import PreviewIcon from '@mui/icons-material/Preview';
import { Accordion, AccordionDetails, AccordionSummary, Alert, AlertTitle, Box, Grid, IconButton, Stack, Tooltip, Typography } from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRepoDefaults, getSnapshot, previewGenerate } from '../api/client';
import type {
  PreviewArtifactDto,
  PreviewErrorDto,
  PreviewGenerateResponseDto,
  SnapshotDetailDto
} from '../api/types';
import { JsonMonacoPanel } from '../components/JsonMonacoPanel';
import { CardSection } from '../components/CardSection';
import { EmptyState } from '../components/EmptyState';
import { InlineHelpText } from '../components/InlineHelpText';
import { PageContainer } from '../components/PageContainer';
import { RepoTargetsTable } from '../components/RepoTargetsTable';
import { SkeletonState } from '../components/SkeletonState';
import type { RepoDefaultsEntry, RepoTarget } from '../components/RepoTargetsTable';
import { useGlobalError } from '../app/GlobalErrorContext';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
import { Card } from '@ui/Card';
import { Badge } from '@ui/Badge';
type PreviewFile = {
  path: string;
  sizeBytes?: number;
  sha256?: string;
  previewText?: string;
  status?: string;
};

type PreviewRepoResult = {
  repoSlug: string;
  packVersion?: string;
  status: 'SUCCESS' | 'FAILED' | 'UNKNOWN';
  files: PreviewFile[];
};

type PreviewErrorGroup = {
  repoSlug: string;
  errors: PreviewErrorDetail[];
};

type PreviewErrorDetail = {
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  code: string;
  summary: string;
  action: string;
  details?: string;
};

const baseRepoTargets: RepoTarget[] = [
  {
    id: 'state-manager',
    label: 'state-manager repo',
    repoSlug: '',
    baseBranch: 'main',
    packVersion: ''
  },
  {
    id: 'payment-initiation',
    label: 'payment-initiation repo',
    repoSlug: '',
    baseBranch: 'main',
    packVersion: ''
  },
  {
    id: 'country-container',
    label: 'country-container repo',
    repoSlug: '',
    baseBranch: 'main',
    packVersion: ''
  }
];

function normalizeRepoDefaults(
  data?: {
    repos?: { slug?: string; repoSlug?: string; name?: string; defaultRef?: string; ref?: string; branch?: string }[];
    repoDefaults?: { slug?: string; repoSlug?: string; name?: string; defaultRef?: string; ref?: string; branch?: string }[];
    defaultRef?: string;
  }
): RepoDefaultsEntry[] {
  if (!data) {
    return [];
  }
  const source = data.repos ?? data.repoDefaults ?? [];
  return source
    .map((repo) => {
      const slug = repo.slug ?? repo.repoSlug ?? repo.name;
      if (!slug) {
        return null;
      }
      return {
        slug,
        label: repo.name ?? slug,
        defaultRef: repo.defaultRef ?? repo.ref ?? repo.branch ?? data.defaultRef ?? 'main'
      };
    })
    .filter((repo): repo is { slug: string; defaultRef: string } => Boolean(repo));
}

function extractTemplatePacks(detail?: SnapshotDetailDto): Record<string, string> {
  if (!detail) {
    return {};
  }
  const raw = detail as Record<string, unknown>;
  const direct = raw.templatePacks ?? raw.template_packs;
  const payload = (raw.payload ?? raw.snapshot ?? raw.data) as Record<string, unknown> | undefined;
  const nested = payload?.templatePacks ?? payload?.template_packs;
  const source = direct ?? nested;

  if (!source || typeof source !== 'object') {
    return {};
  }
  const entries = Object.entries(source as Record<string, unknown>)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        return [key, value];
      }
      return null;
    })
    .filter((entry): entry is [string, string] => Boolean(entry));
  return Object.fromEntries(entries);
}

function normalizePreviewFiles(rawFiles: unknown[]): PreviewFile[] {
  return rawFiles.map((file, index) => {
    if (typeof file === 'string') {
      return { path: file };
    }
    if (!file || typeof file !== 'object') {
      return { path: `file-${index + 1}` };
    }
    const record = file as Record<string, unknown>;
    const path =
      (typeof record.path === 'string' && record.path) ||
      (typeof record.filePath === 'string' && record.filePath) ||
      (typeof record.name === 'string' && record.name) ||
      `file-${index + 1}`;
    return {
      path,
      sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : undefined,
      sha256: typeof record.sha256 === 'string' ? record.sha256 : undefined,
      previewText:
        typeof record.previewText === 'string'
          ? record.previewText
          : typeof record.preview === 'string'
          ? record.preview
          : typeof record.content === 'string'
          ? record.content
          : undefined,
      status: typeof record.status === 'string' ? record.status : undefined
    };
  });
}

function normalizePreviewResponse(
  raw: PreviewGenerateResponseDto | null,
  submittedTargets: RepoTarget[]
): {
  repoResults: PreviewRepoResult[];
  errorGroups: PreviewErrorGroup[];
} {
  const repoSlugs = submittedTargets.map((target) => target.repoSlug).filter(Boolean);
  const repoMap = new Map<string, PreviewRepoResult>();

  submittedTargets.forEach((target) => {
    const slug = target.repoSlug.trim();
    if (!slug) {
      return;
    }
    repoMap.set(slug, {
      repoSlug: slug,
      packVersion: target.packVersion.trim() || undefined,
      status: 'UNKNOWN',
      files: []
    });
  });

  const repoEntries = raw && Array.isArray(raw.repos) ? raw.repos : [];
  repoEntries.forEach((repo) => {
    if (!repo || typeof repo !== 'object') {
      return;
    }
    const record = repo as Record<string, unknown>;
    const slug =
      (typeof record.repoSlug === 'string' && record.repoSlug) ||
      (typeof record.slug === 'string' && record.slug) ||
      (typeof record.repository === 'string' && record.repository) ||
      (typeof record.name === 'string' && record.name) ||
      '';
    if (!slug) {
      return;
    }
    const filesSource =
      (Array.isArray(record.files) && record.files) ||
      (Array.isArray(record.generatedFiles) && record.generatedFiles) ||
      (Array.isArray(record.artifacts) && record.artifacts) ||
      [];
    const files = normalizePreviewFiles(filesSource as unknown[]);
    const status =
      typeof record.status === 'string'
        ? record.status.toUpperCase() === 'FAILED'
          ? 'FAILED'
          : 'SUCCESS'
        : files.length
        ? 'SUCCESS'
        : 'UNKNOWN';
    const packVersion =
      typeof record.packVersion === 'string' ? record.packVersion : typeof record.pack === 'string' ? record.pack : undefined;

    repoMap.set(slug, {
      repoSlug: slug,
      packVersion: packVersion ?? repoMap.get(slug)?.packVersion,
      status,
      files
    });
  });

  const artifactList = raw?.generatedArtifacts ?? raw?.artifacts ?? [];
  if (Array.isArray(artifactList) && artifactList.length) {
    const artifactsByRepo = new Map<string, PreviewArtifactDto[]>();
    artifactList.forEach((artifact) => {
      if (!artifact) {
        return;
      }
      const repoSlug = artifact.repository ?? 'unknown-repo';
      const list = artifactsByRepo.get(repoSlug) ?? [];
      list.push(artifact);
      artifactsByRepo.set(repoSlug, list);
    });
    artifactsByRepo.forEach((artifacts, repoSlug) => {
      const files = artifacts.map((artifact) => ({
        path: artifact.filePath ?? artifact.domain ?? 'artifact',
        previewText: artifact.summary
      }));
      const existing = repoMap.get(repoSlug);
      repoMap.set(repoSlug, {
        repoSlug,
        packVersion: existing?.packVersion,
        status: existing?.status ?? 'SUCCESS',
        files: existing?.files?.length ? existing.files : files
      });
    });
  }

  const errors = Array.isArray(raw?.errors) ? raw?.errors : raw?.errors ? [raw.errors] : [];
  const errorGroups = groupErrorsByRepo(errors, repoSlugs);
  const reposWithErrors = new Set(errorGroups.map((group) => group.repoSlug).filter((slug) => slug !== 'Unassigned'));

  repoMap.forEach((value, key) => {
    if (reposWithErrors.has(key)) {
      repoMap.set(key, { ...value, status: 'FAILED' });
    }
  });

  return { repoResults: Array.from(repoMap.values()), errorGroups };
}

function toSeverity(value: unknown): 'error' | 'warning' | 'info' | 'success' {
  if (typeof value === 'string') {
    const lowered = value.toLowerCase();
    if (lowered === 'warning' || lowered === 'warn') {
      return 'warning';
    }
    if (lowered === 'info') {
      return 'info';
    }
    if (lowered === 'success') {
      return 'success';
    }
  }
  return 'error';
}

type ErrorPattern = {
  test: (message: string) => boolean;
  code: string;
  summary: string;
  action: string;
};

const errorPatterns: ErrorPattern[] = [
  {
    test: (message) =>
      message.includes('template pack') && (message.includes('missing') || message.includes('not found')),
    code: 'PACK_MISSING',
    summary: 'Template pack missing in repository.',
    action: 'Check pack version or repo access.'
  },
  {
    test: (message) => message.includes('pack version') && (message.includes('invalid') || message.includes('not found')),
    code: 'PACK_VERSION_INVALID',
    summary: 'Pack version is unavailable for this repository.',
    action: 'Select a valid pack version and retry.'
  },
  {
    test: (message) => message.includes('snapshot') && (message.includes('missing') || message.includes('not found')),
    code: 'SNAPSHOT_NOT_FOUND',
    summary: 'Snapshot reference was not found.',
    action: 'Verify snapshot ID and version, then retry.'
  },
  {
    test: (message) => (message.includes('repo') || message.includes('repository')) && message.includes('not found'),
    code: 'REPO_NOT_FOUND',
    summary: 'Repository target could not be resolved.',
    action: 'Confirm repo slug and access permissions.'
  },
  {
    test: (message) =>
      message.includes('permission') ||
      message.includes('unauthorized') ||
      message.includes('forbidden') ||
      message.includes('access denied'),
    code: 'ACCESS_DENIED',
    summary: 'Access denied for repository or pack.',
    action: 'Check credentials and repository access.'
  },
  {
    test: (message) => message.includes('timeout') || message.includes('timed out'),
    code: 'REQUEST_TIMEOUT',
    summary: 'Preview generation timed out.',
    action: 'Retry the request or reduce repo scope.'
  },
  {
    test: (message) => message.includes('validation') || message.includes('invalid'),
    code: 'INVALID_INPUT',
    summary: 'Input validation failed.',
    action: 'Review snapshot ID, repo targets, and pack versions.'
  },
  {
    test: (message) =>
      message.includes('network') ||
      message.includes('connection') ||
      message.includes('econn') ||
      message.includes('enotfound'),
    code: 'NETWORK_ERROR',
    summary: 'Network error during preview.',
    action: 'Check connectivity and retry.'
  }
];

function buildErrorPresentation(message: string): Pick<PreviewErrorDetail, 'code' | 'summary' | 'action' | 'details'> {
  const normalized = message.replace(/\s+/g, ' ').trim();
  const lower = normalized.toLowerCase();
  const matched = errorPatterns.find((pattern) => pattern.test(lower));
  const codeMatch = normalized.match(/\b[A-Z]{2,}(?:_[A-Z0-9]{2,})+\b/);

  if (matched) {
    return {
      code: matched.code,
      summary: matched.summary,
      action: matched.action,
      details: normalized && normalized !== matched.summary ? normalized : undefined
    };
  }

  if (codeMatch) {
    return {
      code: codeMatch[0],
      summary: 'Preview error reported.',
      action: 'Review the details and retry the preview.',
      details: normalized || undefined
    };
  }

  return {
    code: 'PREVIEW_ERROR',
    summary: 'Unexpected preview error.',
    action: 'Retry the preview or inspect the payload JSON.',
    details: normalized || undefined
  };
}

function groupErrorsByRepo(errors: (PreviewErrorDto | string)[], repoSlugs: string[]): PreviewErrorGroup[] {
  const grouped = new Map<string, PreviewErrorGroup>();

  errors.forEach((error) => {
    if (typeof error === 'string') {
      const repoSlug = guessRepoFromMessage(error, repoSlugs);
      const entry = grouped.get(repoSlug) ?? { repoSlug, errors: [] };
      const presentation = buildErrorPresentation(error);
      entry.errors.push({ message: error, severity: 'error', ...presentation });
      grouped.set(repoSlug, entry);
      return;
    }
    const record = error as PreviewErrorDto;
    const message = record.message ?? record.error ?? 'Unknown error';
    const repoSlug =
      record.repoSlug ??
      record.repository ??
      record.repo ??
      guessRepoFromMessage(message, repoSlugs);
    const entry = grouped.get(repoSlug) ?? { repoSlug, errors: [] };
    const presentation = buildErrorPresentation(message);
    entry.errors.push({ message, severity: toSeverity(record.severity), ...presentation });
    grouped.set(repoSlug, entry);
  });

  return Array.from(grouped.values());
}

function guessRepoFromMessage(message: string, repoSlugs: string[]): string {
  const match = repoSlugs.find((slug) => message.toLowerCase().includes(slug.toLowerCase()));
  return match ?? 'Unassigned';
}

export function GeneratePreviewPage() {
  const [searchParams] = useSearchParams();
  const { showError } = useGlobalError();
  const [snapshotId, setSnapshotId] = useState(searchParams.get('snapshotId') ?? '');
  const [version, setVersion] = useState(searchParams.get('version') ?? '');
  const [repoTargets, setRepoTargets] = useState<RepoTarget[]>(baseRepoTargets);
  const [submittedTargets, setSubmittedTargets] = useState<RepoTarget[]>([]);
  const lastPrefilledSnapshotId = useRef<string | null>(null);

  const repoDefaultsQuery = useQuery({
    queryKey: ['repo-defaults-v2'],
    queryFn: getRepoDefaults,
    meta: { suppressGlobalError: true }
  });

  const snapshotQuery = useQuery({
    queryKey: ['snapshot-preview', snapshotId],
    queryFn: () => getSnapshot(snapshotId),
    enabled: Boolean(snapshotId),
    meta: { suppressGlobalError: true }
  });

  const previewMutation = useMutation({
    mutationFn: previewGenerate,
    meta: { suppressGlobalError: true }
  });

  const repoDefaults = useMemo(() => normalizeRepoDefaults(repoDefaultsQuery.data), [repoDefaultsQuery.data]);
  const repoDefaultMap = useMemo(
    () => new Map(repoDefaults.map((repo) => [repo.slug, repo.defaultRef])),
    [repoDefaults]
  );

  const versionError = version && !/^\d+$/.test(version) ? 'Version must be numeric.' : '';
  const snapshotError = snapshotId.trim() ? '' : 'Snapshot ID is required.';
  const repoTargetsValid =
    repoTargets.some((target) => target.enabled !== false && target.repoSlug.trim()) &&
    repoTargets
      .filter((target) => target.enabled !== false && target.repoSlug.trim())
      .every((target) => target.baseBranch.trim());

  useEffect(() => {
    if (!snapshotId) {
      return;
    }
    if (!snapshotQuery.data) {
      return;
    }
    if (lastPrefilledSnapshotId.current === snapshotId) {
      return;
    }
    const templatePacks = extractTemplatePacks(snapshotQuery.data);
    if (Object.keys(templatePacks).length) {
      const targets = Object.entries(templatePacks).map(([repoSlug, packVersion]) => ({
        id: repoSlug,
        label: repoSlug,
        repoSlug,
        baseBranch: repoDefaultMap.get(repoSlug) ?? 'main',
        packVersion
      }));
      setRepoTargets(targets);
    }
    lastPrefilledSnapshotId.current = snapshotId;
  }, [repoDefaultMap, snapshotId, snapshotQuery.data]);

  useEffect(() => {
    if (!repoDefaultMap.size) {
      return;
    }
    setRepoTargets((prev) =>
      prev.map((row) => {
        if (!row.repoSlug.trim()) {
          return row;
        }
        const defaultBranch = repoDefaultMap.get(row.repoSlug.trim());
        if (!defaultBranch || row.baseBranch.trim() !== 'main') {
          return row;
        }
        return { ...row, baseBranch: defaultBranch };
      })
    );
  }, [repoDefaultMap]);

  const normalizedPreview = useMemo(() => {
    return normalizePreviewResponse(previewMutation.data ?? null, submittedTargets);
  }, [previewMutation.data, submittedTargets]);

  const handlePreview = async () => {
    if (!snapshotId.trim()) {
      return;
    }
    if (versionError) {
      return;
    }
    const targets = repoTargets.filter((target) => target.enabled !== false && target.repoSlug.trim());
    if (!targets.length) {
      showError('Add at least one repository target.');
      return;
    }
    if (targets.some((target) => !target.baseBranch.trim())) {
      showError('Each repo target must include a base branch.');
      return;
    }
    setSubmittedTargets(targets);

    try {
      await previewMutation.mutateAsync({
        snapshotId: snapshotId.trim(),
        version: version ? Number(version) : undefined,
        repos: targets.map((target) => target.repoSlug.trim()),
        repoTargets: targets.map((target) => ({
          repoSlug: target.repoSlug.trim(),
          baseBranch: target.baseBranch.trim() || 'main',
          packVersion: target.packVersion.trim() || undefined
        }))
      });
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Preview generation failed.');
    }
  };

  const handleExport = () => {
    if (!previewMutation.data) {
      return;
    }
    const blob = new Blob([JSON.stringify(previewMutation.data, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `preview-${snapshotId || 'snapshot'}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <PageContainer
      title="Generate Preview"
      subtitle="Run pre-commit generation and inspect repo-level artifacts before automation."
    >
      <CardSection
        title="Step 1: Snapshot Source"
        subtitle="Select the snapshot and optional version that preview generation should use."
        actions={
          <Button
            variant="contained"
            startIcon={<PreviewIcon />}
            onClick={handlePreview}
            disabled={Boolean(snapshotError || versionError) || !repoTargetsValid || previewMutation.isPending}
          >
            {previewMutation.isPending ? 'Generating...' : 'Preview Generation'}
          </Button>
        }
      >
        <Stack spacing={3}>
          <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2.5}>
              <Typography variant="subtitle1">Snapshot Reference</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Input
                    fullWidth
                    label="Snapshot ID"
                    placeholder="snap-gb-2026-01"
                    value={snapshotId}
                    onChange={(event) => {
                      setSnapshotId(event.target.value.trim());
                      lastPrefilledSnapshotId.current = null;
                    }}
                    error={Boolean(snapshotError)}
                    helperText={snapshotError || 'Snapshot reference used to load payload + default repo packs.'}
                    InputLabelProps={{ sx: { textAlign: 'left' } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }}>
                  <Input
                    fullWidth
                    label="Version (optional)"
                    placeholder="3"
                    value={version}
                    onChange={(event) => setVersion(event.target.value.trim())}
                    error={Boolean(versionError)}
                    helperText={versionError || 'Leave blank to preview against the latest saved version.'}
                    InputLabelProps={{ sx: { textAlign: 'left' } }}
                  />
                </Grid>
              </Grid>
            </Stack>
          </Card>
          <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={1.5}>
              <Typography variant="subtitle1">Purpose</Typography>
              <InlineHelpText>
                Enter a snapshot and repo targets to render generated files before PR automation exists.
              </InlineHelpText>
              {snapshotQuery.isFetching ? (
                <Alert severity="info">Loading snapshot to prefill template packs...</Alert>
              ) : snapshotQuery.isError ? (
                <Alert severity="warning">Snapshot could not be loaded. Repo targets can be filled manually.</Alert>
              ) : null}
            </Stack>
          </Card>
        </Stack>
      </CardSection>

      <CardSection
        title="Step 2: Repository Targets"
        subtitle="Map repository slugs, branches, and optional pack versions for this preview run."
      >
        <Stack spacing={3}>
          <Card variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
            <Stack spacing={2}>
              <Typography variant="subtitle1">Target Mapping</Typography>
              <Typography variant="body2" color="text.secondary">
                Each enabled row should point to one destination repo and base branch.
              </Typography>
              <RepoTargetsTable
                variant="simple"
                targets={repoTargets}
                onChange={setRepoTargets}
                repoDefaults={repoDefaults}
                allowAdd
                allowRemove
                addLabel="Add Repo Target"
                showErrors={false}
              />
            </Stack>
          </Card>
          {!repoTargetsValid ? (
            <Alert severity="warning">Add at least one repo slug before generating preview.</Alert>
          ) : null}
        </Stack>
      </CardSection>

      {previewMutation.isPending ? (
        <CardSection title="Step 3: Preview Results" subtitle="Preparing repository output and file manifests.">
          <Stack spacing={2.5}>
            <SkeletonState variant="card" />
            <SkeletonState variant="table" rows={6} />
          </Stack>
        </CardSection>
      ) : null}

      {previewMutation.data ? (
        <Stack spacing={3}>
          <CardSection
            title="Step 3: Preview Results"
            subtitle="Review generated files by repository before proceeding to automation."
            actions={
              <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleExport}>
                Export Preview JSON
              </Button>
            }
          >
            <Grid container spacing={2}>
              {normalizedPreview.repoResults.length ? (
                normalizedPreview.repoResults.map((repo) => (
                  <Grid key={repo.repoSlug} size={{ xs: 12, md: 6 }}>
                    <Card variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack spacing={0.5}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {repo.repoSlug}
                            </Typography>
                            <InlineHelpText>
                              Pack: {repo.packVersion ?? 'n/a'} | Files: {repo.files.length}
                            </InlineHelpText>
                          </Stack>
                          <Badge
                            label={repo.status}
                            tone={repo.status === 'FAILED' ? 'error' : repo.status === 'SUCCESS' ? 'success' : 'muted'}
                            variant={repo.status === 'UNKNOWN' ? 'outlined' : 'filled'}
                            size="small"
                          />
                        </Stack>
                        <Accordion>
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography variant="body2">Files</Typography>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1.5}>
                              {repo.files.length ? (
                                repo.files.map((file, fileIndex) => (
                                  <Card
                                    key={`${repo.repoSlug}-${file.path}-${fileIndex}`}
                                    variant="outlined"
                                    sx={{ p: 1.5, borderRadius: 1 }}
                                  >
                                    <Stack spacing={1}>
                                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                                        <Typography variant="body2" sx={{ wordBreak: 'break-all' }}>
                                          {file.path}
                                        </Typography>
                                        <Stack direction="row" spacing={1}>
                                          <IconButton
                                            size="small"
                                            aria-label="Copy file path"
                                            onClick={async () => {
                                              try {
                                                await navigator.clipboard.writeText(file.path);
                                              } catch {
                                                showError('Copy failed for file path.');
                                              }
                                            }}
                                          >
                                            <ContentCopyIcon fontSize="small" />
                                          </IconButton>
                                        </Stack>
                                      </Stack>
                                      <Stack direction="row" spacing={2} flexWrap="wrap">
                                        <InlineHelpText component="span">
                                          Size: {file.sizeBytes ?? 'n/a'}
                                        </InlineHelpText>
                                        <InlineHelpText component="span">
                                          SHA256: {file.sha256 ?? 'n/a'}
                                        </InlineHelpText>
                                      </Stack>
                                      {file.previewText ? (
                                        <Accordion>
                                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Typography variant="caption">Preview</Typography>
                                          </AccordionSummary>
                                          <AccordionDetails>
                                            <Stack spacing={1}>
                                              <Stack direction="row" justifyContent="flex-end">
                                                <Tooltip title="Copy preview text">
                                                  <IconButton
                                                    size="small"
                                                    aria-label={`Copy preview for ${file.path}`}
                                                    onClick={async () => {
                                                      try {
                                                        await navigator.clipboard.writeText(file.previewText ?? '');
                                                      } catch {
                                                        showError('Copy failed for preview text.');
                                                      }
                                                    }}
                                                  >
                                                    <ContentCopyIcon fontSize="small" />
                                                  </IconButton>
                                                </Tooltip>
                                              </Stack>
                                              <Box
                                                component="pre"
                                                sx={{
                                                  m: 0,
                                                  p: 1.5,
                                                  backgroundColor: 'var(--surface2)',
                                                  border: '1px solid var(--border)',
                                                  borderRadius: 1,
                                                  fontSize: 12,
                                                  fontFamily: '"IBM Plex Mono", "Courier New", monospace',
                                                  lineHeight: 1.5,
                                                  color: 'text.primary',
                                                  whiteSpace: 'pre-wrap'
                                                }}
                                              >
                                                {file.previewText}
                                              </Box>
                                            </Stack>
                                          </AccordionDetails>
                                        </Accordion>
                                      ) : (
                                        <InlineHelpText>No preview text returned.</InlineHelpText>
                                      )}
                                    </Stack>
                                  </Card>
                                ))
                              ) : (
                                <InlineHelpText>No files returned for this repo.</InlineHelpText>
                              )}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      </Stack>
                    </Card>
                  </Grid>
                ))
              ) : (
                <Grid size={{ xs: 12 }}>
                  <EmptyState
                    title="No repo outputs returned"
                    description="Run preview again after confirming repository targets."
                    icon={<FolderOffOutlinedIcon color="action" />}
                    actionLabel="Run Preview Again"
                    onAction={() => void handlePreview()}
                  />
                </Grid>
              )}
            </Grid>
          </CardSection>

          <CardSection title="Preview Errors" subtitle="Backend errors grouped by repository where possible.">
            {normalizedPreview.errorGroups.length ? (
              <Stack spacing={1.5}>
                {normalizedPreview.errorGroups.map((group) => (
                  <Card key={group.repoSlug} variant="outlined" sx={{ p: 1.5, borderRadius: 1 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {group.repoSlug}
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {group.errors.map((error, index) => (
                        <Alert
                          key={`${group.repoSlug}-${index}`}
                          severity={error.severity}
                          sx={{ alignItems: 'flex-start' }}
                        >
                          <AlertTitle>{error.code}</AlertTitle>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {error.summary}
                          </Typography>
                          <InlineHelpText>Next action: {error.action}</InlineHelpText>
                          {error.details ? <InlineHelpText>Details: {error.details}</InlineHelpText> : null}
                        </Alert>
                      ))}
                    </Stack>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Alert severity="success">No errors reported in preview response.</Alert>
            )}
          </CardSection>

          <CardSection title="Preview Payload JSON" subtitle="Raw preview response for deeper inspection or export.">
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  Preview JSON
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={1.5}>
                  <JsonMonacoPanel
                    ariaLabel="Preview JSON panel"
                    value={previewMutation.data}
                    readOnly
                    onCopyError={() => showError('Copy failed. Select the JSON and copy manually.')}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>
          </CardSection>
        </Stack>
      ) : (
        <EmptyState
          title="No preview yet"
          description="Run preview generation to inspect repo-by-repo outputs and file manifests."
          icon={<PreviewIcon color="action" />}
          actionLabel="Run Preview"
          onAction={() => void handlePreview()}
        />
      )}
    </PageContainer>
  );
}



