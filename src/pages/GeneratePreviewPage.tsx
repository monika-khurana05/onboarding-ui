import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PreviewIcon from '@mui/icons-material/Preview';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getRepoDefaults, getSnapshot, previewGenerate } from '../api/client';
import type { PreviewErrorDto, PreviewGenerateResponseDto, SnapshotDetailDto } from '../api/types';
import { JsonMonacoPanel } from '../components/JsonMonacoPanel';
import { LoadingState } from '../components/LoadingState';
import { RepoTargetsTable, type RepoDefaultsEntry, type RepoTarget } from '../components/RepoTargetsTable';
import { SectionCard } from '../components/SectionCard';
import { useGlobalError } from '../app/GlobalErrorContext';

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
  errors: { message: string; severity: 'error' | 'warning' | 'info' | 'success' }[];
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

function groupErrorsByRepo(errors: (PreviewErrorDto | string)[], repoSlugs: string[]): PreviewErrorGroup[] {
  const grouped = new Map<string, PreviewErrorGroup>();

  errors.forEach((error) => {
    if (typeof error === 'string') {
      const repoSlug = guessRepoFromMessage(error, repoSlugs);
      const entry = grouped.get(repoSlug) ?? { repoSlug, errors: [] };
      entry.errors.push({ message: error, severity: 'error' });
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
    entry.errors.push({ message, severity: toSeverity(record.severity) });
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
    <Stack spacing={2.5}>
      <SectionCard
        title="Preview Generation"
        subtitle="Run a pre-commit preview to validate what CPX automation will generate."
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
        <Stack spacing={2}>
          <Typography variant="body2" color="text.secondary">
            Enter a snapshot and repo targets to render the generated files before PR automation exists.
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Snapshot ID"
                value={snapshotId}
                onChange={(event) => {
                  setSnapshotId(event.target.value.trim());
                  lastPrefilledSnapshotId.current = null;
                }}
                error={Boolean(snapshotError)}
                helperText={snapshotError || ' '}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <TextField
                fullWidth
                label="Version (optional)"
                value={version}
                onChange={(event) => setVersion(event.target.value.trim())}
                error={Boolean(versionError)}
                helperText={versionError || ' '}
              />
            </Grid>
          </Grid>
          {snapshotQuery.isFetching ? (
            <Alert severity="info">Loading snapshot to prefill template packs...</Alert>
          ) : snapshotQuery.isError ? (
            <Alert severity="warning">Snapshot could not be loaded. Repo targets can be filled manually.</Alert>
          ) : null}
        </Stack>
      </SectionCard>

      <SectionCard title="Repository Targets" subtitle="Review or override repo targets for preview generation.">
        <Stack spacing={2}>
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
          {!repoTargetsValid ? (
            <Alert severity="warning">Add at least one repo slug before generating preview.</Alert>
          ) : null}
        </Stack>
      </SectionCard>

      {previewMutation.isPending ? <LoadingState message="Generating preview..." minHeight={160} /> : null}

      {previewMutation.data ? (
        <Stack spacing={2.5}>
          <SectionCard
            title="Preview Results"
            subtitle="Each repo card shows the generated files and status for the preview run."
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
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Stack spacing={1.5}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack spacing={0.5}>
                            <Typography variant="subtitle1">{repo.repoSlug}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              Pack: {repo.packVersion ?? 'n/a'} | Files: {repo.files.length}
                            </Typography>
                          </Stack>
                          <Chip
                            label={repo.status}
                            color={repo.status === 'FAILED' ? 'error' : repo.status === 'SUCCESS' ? 'success' : 'default'}
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
                                  <Paper key={`${repo.repoSlug}-${file.path}-${fileIndex}`} variant="outlined" sx={{ p: 1.5 }}>
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
                                        <Typography variant="caption" color="text.secondary">
                                          Size: {file.sizeBytes ?? 'n/a'}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                          SHA256: {file.sha256 ?? 'n/a'}
                                        </Typography>
                                      </Stack>
                                      {file.previewText ? (
                                        <Accordion>
                                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                            <Typography variant="caption">Preview</Typography>
                                          </AccordionSummary>
                                          <AccordionDetails>
                                            <Stack spacing={1}>
                                              <Stack direction="row" justifyContent="flex-end">
                                                <Button
                                                  size="small"
                                                  variant="text"
                                                  startIcon={<ContentCopyIcon fontSize="small" />}
                                                  onClick={async () => {
                                                    try {
                                                      await navigator.clipboard.writeText(file.previewText ?? '');
                                                    } catch {
                                                      showError('Copy failed for preview text.');
                                                    }
                                                  }}
                                                >
                                                  Copy Preview
                                                </Button>
                                              </Stack>
                                              <Box
                                                component="pre"
                                                sx={{
                                                  m: 0,
                                                  p: 1.5,
                                                  backgroundColor: (theme) =>
                                                    theme.palette.mode === 'dark'
                                                      ? 'rgba(15, 23, 42, 0.6)'
                                                      : 'grey.100',
                                                  border: '1px solid',
                                                  borderColor: 'divider',
                                                  borderRadius: 1,
                                                  fontSize: 12,
                                                  fontFamily: '"IBM Plex Mono", "Courier New", monospace',
                                                  whiteSpace: 'pre-wrap'
                                                }}
                                              >
                                                {file.previewText}
                                              </Box>
                                            </Stack>
                                          </AccordionDetails>
                                        </Accordion>
                                      ) : (
                                        <Typography variant="caption" color="text.secondary">
                                          No preview text returned.
                                        </Typography>
                                      )}
                                    </Stack>
                                  </Paper>
                                ))
                              ) : (
                                <Typography variant="body2" color="text.secondary">
                                  No files returned for this repo.
                                </Typography>
                              )}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      </Stack>
                    </Paper>
                  </Grid>
                ))
              ) : (
                <Grid size={{ xs: 12 }}>
                  <Alert severity="info">No repo outputs were returned in the preview response.</Alert>
                </Grid>
              )}
            </Grid>
          </SectionCard>

          <SectionCard title="Errors" subtitle="Backend errors grouped by repo when possible.">
            {normalizedPreview.errorGroups.length ? (
              <Stack spacing={1.5}>
                {normalizedPreview.errorGroups.map((group) => (
                  <Paper key={group.repoSlug} variant="outlined" sx={{ p: 1.5 }}>
                    <Typography variant="subtitle2">{group.repoSlug}</Typography>
                    <Stack spacing={1} sx={{ mt: 1 }}>
                      {group.errors.map((error, index) => (
                        <Alert key={`${group.repoSlug}-${index}`} severity={error.severity}>
                          {error.message}
                        </Alert>
                      ))}
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            ) : (
              <Alert severity="success">No errors reported in preview response.</Alert>
            )}
          </SectionCard>

          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1">Preview JSON</Typography>
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
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Run a preview generation to see repo-by-repo outputs and file manifests.
        </Typography>
      )}
    </Stack>
  );
}
