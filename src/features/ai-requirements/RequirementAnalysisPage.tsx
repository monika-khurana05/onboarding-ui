import {
  Alert,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  Grid,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CountryCodeField } from '../../components/CountryCodeField';
import { SectionCard } from '../../components/SectionCard';
import { enrichmentCatalog } from '../../catalog/enrichmentCatalog';
import { validationCatalog } from '../../catalog/validationCatalog';
import { loadOnboardingDraft, saveOnboardingDraft } from '../../lib/storage/onboardingDraftStorage';
import {
  capabilityKeys,
  type CapabilityKey,
  type RulesConfig,
  type SnapshotCapability,
  validateCountryCodeUppercase
} from '../../models/snapshot';
import { capabilityCatalog } from '../onboarding-flow/capabilityCatalog';
import { loadRequirementsAnalysis as loadRequirementsAnalysisFromStorage, saveRequirementsAnalysis } from '../../ai/storage/aiSessionStorage';
import { mockAiService } from '../../ai/services/mockAiService';
import type { RequirementsAnalysis } from '../../ai/types';

const documentSources = [
  'Argentina Instant Payments Spec (Mock)',
  'Operational Circulars (Mock)'
] as const;

const capabilityLabelLookup = new Map<CapabilityKey, string>(capabilityCatalog.map((item) => [item.key, item.label]));
const validationLabelLookup = new Map(validationCatalog.map((item) => [item.id, item.className]));
const enrichmentLabelLookup = new Map(enrichmentCatalog.map((item) => [item.id, item.className]));
const validationCatalogIds = new Set(validationCatalog.map((item) => item.id));
const enrichmentCatalogIds = new Set(enrichmentCatalog.map((item) => item.id));
const capabilityKeySet = new Set(capabilityKeys);

function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase();
}

function mergeUnique(base: string[], extra: Iterable<string>) {
  const next = new Set(base);
  for (const value of extra) {
    if (value) {
      next.add(value);
    }
  }
  return Array.from(next);
}

function toggleSetValue<T>(prev: Set<T>, value: T) {
  const next = new Set(prev);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return next;
}

function normalizeParams(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function RequirementAnalysisPage() {
  const navigate = useNavigate();
  const [countryCode, setCountryCode] = useState('AR');
  const [documentSource, setDocumentSource] = useState<(typeof documentSources)[number]>(documentSources[0]);
  const [analysis, setAnalysis] = useState<RequirementsAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<'storage' | 'mock' | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRequirementId, setActiveRequirementId] = useState<string | null>(null);
  const [openQuestionText, setOpenQuestionText] = useState('');
  const [appliedCapabilities, setAppliedCapabilities] = useState<Set<CapabilityKey>>(new Set());
  const [appliedValidations, setAppliedValidations] = useState<Set<string>>(new Set());
  const [appliedEnrichments, setAppliedEnrichments] = useState<Set<string>>(new Set());

  useEffect(() => {
    const normalized = normalizeCountryCode(countryCode);
    if (!normalized) {
      setAnalysis(null);
      setLoadSource(null);
      return;
    }
    const cached = loadRequirementsAnalysisFromStorage(normalized);
    if (cached) {
      setAnalysis(cached);
      setLoadSource('storage');
    }
  }, [countryCode]);

  useEffect(() => {
    setAppliedCapabilities(new Set());
    setAppliedValidations(new Set());
    setAppliedEnrichments(new Set());
  }, [analysis?.meta.generatedAt, analysis?.meta.countryCode]);

  const capabilitySuggestions = useMemo(
    () => analysis?.suggestedDomainCapabilities ?? [],
    [analysis]
  );

  const validationSuggestions = useMemo(() => {
    const unique = new Map<string, RequirementsAnalysis['requirements'][number]['suggestions']['validations'][number]>();
    analysis?.requirements.forEach((req) => {
      req.suggestions.validations.forEach((suggestion) => {
        if (!unique.has(suggestion.catalogId)) {
          unique.set(suggestion.catalogId, suggestion);
        }
      });
    });
    return Array.from(unique.values());
  }, [analysis]);

  const enrichmentSuggestions = useMemo(() => {
    const unique = new Map<string, RequirementsAnalysis['requirements'][number]['suggestions']['enrichments'][number]>();
    analysis?.requirements.forEach((req) => {
      req.suggestions.enrichments.forEach((suggestion) => {
        if (!unique.has(suggestion.catalogId)) {
          unique.set(suggestion.catalogId, suggestion);
        }
      });
    });
    return Array.from(unique.values());
  }, [analysis]);

  const requirementCount = analysis?.requirements.length ?? 0;
  const openQuestionCount = useMemo(
    () => analysis?.requirements.reduce((sum, req) => sum + req.openQuestions.length, 0) ?? 0,
    [analysis]
  );

  const activeRequirement = useMemo(
    () => analysis?.requirements.find((req) => req.id === activeRequirementId) ?? null,
    [analysis, activeRequirementId]
  );

  const handleOpenRequirement = useCallback((id: string) => {
    setActiveRequirementId(id);
    setOpenQuestionText('');
    setDrawerOpen(true);
  }, []);

  const handleRunAnalysis = useCallback(async () => {
    const normalized = normalizeCountryCode(countryCode);
    const errors = validateCountryCodeUppercase(normalized);
    if (errors.length > 0) {
      setError(errors[0]?.message ?? 'Country code is required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await mockAiService.getRequirementsAnalysis(normalized);
      setAnalysis(data);
      saveRequirementsAnalysis(normalized, data);
      setLoadSource('mock');
    } catch (fetchError) {
      console.warn('Failed to load requirement analysis.', fetchError);
      setError('Failed to load mock requirement analysis.');
    } finally {
      setLoading(false);
    }
  }, [countryCode]);

  const handleCreateOpenQuestion = useCallback(() => {
    if (!analysis || !activeRequirementId) {
      return;
    }
    const trimmed = openQuestionText.trim();
    if (!trimmed) {
      return;
    }
    const next = {
      ...analysis,
      requirements: analysis.requirements.map((req) =>
        req.id === activeRequirementId
          ? {
              ...req,
              openQuestions: [
                ...req.openQuestions,
                { id: `Q-LOCAL-${Date.now()}`, text: trimmed, status: 'OPEN' }
              ]
            }
          : req
      )
    };
    setAnalysis(next);
    saveRequirementsAnalysis(normalizeCountryCode(countryCode), next);
    setOpenQuestionText('');
  }, [activeRequirementId, analysis, countryCode, openQuestionText]);

  const downloadBlob = useCallback((data: string, fileName: string, mimeType: string) => {
    const blob = new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleExportJson = useCallback(() => {
    if (!analysis) {
      return;
    }
    const token = normalizeCountryCode(analysis.meta.countryCode ?? countryCode) || 'requirements';
    downloadBlob(JSON.stringify(analysis, null, 2), `${token}-requirements-analysis.json`, 'application/json;charset=utf-8');
  }, [analysis, countryCode, downloadBlob]);

  const handleExportCsv = useCallback(() => {
    if (!analysis) {
      return;
    }
    const headers = [
      'Requirement ID',
      'Category',
      'Priority',
      'Suggested Capability',
      'Confidence',
      'Evidence',
      'Open Questions'
    ];
    const suggestedCapabilityText = capabilitySuggestions
      .map((cap) => cap.capabilityKey)
      .join('; ');
    const escapeCsv = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const rows = analysis.requirements.map((req) => {
      const evidence = req.evidence
        .map((entry) => `${entry.docId}${entry.pageHint ? ` ${entry.pageHint}` : ''}: ${entry.excerpt}`)
        .join(' | ');
      const questions = req.openQuestions.map((q) => q.text).join(' | ');
      return [
        req.id,
        req.category,
        req.priority,
        suggestedCapabilityText || 'N/A',
        `${Math.round(req.confidence * 100)}%`,
        evidence,
        questions
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsv(String(value))).join(',')).join('\n');
    const token = normalizeCountryCode(analysis.meta.countryCode ?? countryCode) || 'requirements';
    downloadBlob(csv, `${token}-requirements-table.csv`, 'text/csv;charset=utf-8');
  }, [analysis, capabilitySuggestions, countryCode, downloadBlob]);

  const handleSendToWizard = useCallback(() => {
    if (!analysis) {
      setError('Run requirement analysis before sending to the wizard.');
      return;
    }
    const normalized = normalizeCountryCode(countryCode);
    const errors = validateCountryCodeUppercase(normalized);
    if (errors.length > 0) {
      setError(errors[0]?.message ?? 'Country code is required.');
      return;
    }
    const draft = loadOnboardingDraft() ?? { selectedValidations: [], selectedEnrichments: [] };
    const validAppliedValidations = Array.from(appliedValidations).filter((id) => validationCatalogIds.has(id));
    const validAppliedEnrichments = Array.from(appliedEnrichments).filter((id) => enrichmentCatalogIds.has(id));
    const nextSelectedValidations = mergeUnique(draft.selectedValidations ?? [], validAppliedValidations);
    const nextSelectedEnrichments = mergeUnique(draft.selectedEnrichments ?? [], validAppliedEnrichments);

    const appliedValidationConfigs = validationSuggestions
      .filter((suggestion) => validAppliedValidations.includes(suggestion.catalogId))
      .map((suggestion) => ({
        id: suggestion.catalogId,
        enabled: true,
        params: normalizeParams(suggestion.proposedConfig)
      }));
    const appliedEnrichmentConfigs = enrichmentSuggestions
      .filter((suggestion) => validAppliedEnrichments.includes(suggestion.catalogId))
      .map((suggestion) => ({
        id: suggestion.catalogId,
        enabled: true,
        params: normalizeParams(suggestion.proposedConfig)
      }));

    let nextRulesConfig: RulesConfig | undefined = draft.rulesConfig;
    if (appliedValidationConfigs.length || appliedEnrichmentConfigs.length) {
      const validationMap = new Map(
        (draft.rulesConfig?.validations ?? []).map((entry) => [entry.id, entry])
      );
      const enrichmentMap = new Map(
        (draft.rulesConfig?.enrichments ?? []).map((entry) => [entry.id, entry])
      );
      appliedValidationConfigs.forEach((entry) => validationMap.set(entry.id, entry));
      appliedEnrichmentConfigs.forEach((entry) => enrichmentMap.set(entry.id, entry));
      nextRulesConfig = {
        metadata: draft.rulesConfig?.metadata,
        validations: Array.from(validationMap.values()),
        enrichments: Array.from(enrichmentMap.values())
      };
    }

    let nextCapabilities: SnapshotCapability[] | undefined = draft.capabilities;
    if (appliedCapabilities.size > 0) {
      const applied = Array.from(appliedCapabilities).filter((key) => capabilityKeySet.has(key));
      if (nextCapabilities && Array.isArray(nextCapabilities)) {
        const updated = nextCapabilities.map((cap) =>
          appliedCapabilities.has(cap.capabilityKey) ? { ...cap, enabled: true } : cap
        );
        applied.forEach((key) => {
          if (!updated.some((cap) => cap.capabilityKey === key)) {
            updated.push({ capabilityKey: key, enabled: true });
          }
        });
        nextCapabilities = updated;
      } else {
        nextCapabilities = applied.map((key) => ({ capabilityKey: key, enabled: true }));
      }
    }

    saveOnboardingDraft({
      ...draft,
      selectedValidations: nextSelectedValidations,
      selectedEnrichments: nextSelectedEnrichments,
      capabilities: nextCapabilities ?? draft.capabilities,
      rulesConfig: nextRulesConfig
    });
    navigate('/snapshots/new');
  }, [
    analysis,
    appliedCapabilities,
    appliedEnrichments,
    appliedValidations,
    countryCode,
    enrichmentSuggestions,
    navigate,
    validationSuggestions
  ]);

  return (
    <Stack spacing={3}>
      <Alert severity="warning">Preview / Demo Mode (R2D2 Pending)</Alert>

      <Typography variant="h4">Requirement Analysis</Typography>

      <SectionCard title="Inputs" subtitle="Upload or select requirement sources for AI extraction.">
        <Stack spacing={2}>
          <CountryCodeField
            value={countryCode}
            onChange={setCountryCode}
            required
            helperText="Two-letter ISO code used to load mock analysis."
          />
          <TextField
            select
            label="Document Source (Demo)"
            value={documentSource}
            onChange={(event) => setDocumentSource(event.target.value as (typeof documentSources)[number])}
            helperText="Mock inputs representing uploaded regulatory documents."
            fullWidth
          >
            {documentSources.map((source) => (
              <MenuItem key={source} value={source}>
                {source}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Button variant="contained" onClick={handleRunAnalysis} disabled={loading}>
              {loading ? 'Running...' : '✨ Run Requirement Analysis (Preview)'}
            </Button>
            {loadSource ? (
              <Typography variant="caption" color="text.secondary">
                Loaded from {loadSource === 'storage' ? 'session storage' : 'mock JSON'}.
              </Typography>
            ) : null}
          </Stack>
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </SectionCard>

      <SectionCard title="Results" subtitle="AI extraction, capability mapping, and open questions.">
        {analysis ? (
          <Stack spacing={3}>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Requirements Found
                  </Typography>
                  <Typography variant="h5">{requirementCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {analysis.summary.headline}
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Reuse Opportunity
                  </Typography>
                  <Typography variant="h5">{analysis.summary.impact.reuseOpportunityPct}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Discovery time reduction: {analysis.summary.impact.discoveryTimeReductionPct}%
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Ambiguities / Open Questions
                  </Typography>
                  <Typography variant="h5">{openQuestionCount}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Manual error reduction: {analysis.summary.impact.manualErrorReductionPct}%
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Mapped Capabilities (Apply to Wizard)</Typography>
                {capabilitySuggestions.length ? (
                  <Stack spacing={1}>
                    {capabilitySuggestions.map((capability) => {
                      const key = capability.capabilityKey as CapabilityKey;
                      const label = capabilityLabelLookup.get(key) ?? capability.capabilityKey;
                      return (
                        <Stack key={capability.capabilityKey} direction="row" spacing={1} alignItems="center">
                          <Checkbox
                            checked={appliedCapabilities.has(key)}
                            onChange={() => setAppliedCapabilities((prev) => toggleSetValue(prev, key))}
                          />
                          <Stack spacing={0.25}>
                            <Typography variant="body2">
                              {label} ({Math.round(capability.confidence * 100)}%)
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {capability.reason}
                            </Typography>
                          </Stack>
                        </Stack>
                      );
                    })}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No capability suggestions available.
                  </Typography>
                )}
              </Stack>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">Validation Suggestions (Apply)</Typography>
                    {validationSuggestions.length ? (
                      <Stack spacing={0.5}>
                        {validationSuggestions.map((suggestion) => {
                          const label = validationLabelLookup.get(suggestion.catalogId) ?? suggestion.catalogId;
                          const disabled = !suggestion.existsInCatalog;
                          return (
                            <FormControlLabel
                              key={suggestion.catalogId}
                              control={
                                <Checkbox
                                  checked={appliedValidations.has(suggestion.catalogId)}
                                  onChange={() =>
                                    setAppliedValidations((prev) => toggleSetValue(prev, suggestion.catalogId))
                                  }
                                  disabled={disabled}
                                />
                              }
                              label={
                                <Stack spacing={0.25}>
                                  <Typography variant="body2">
                                    {label}
                                    {!suggestion.existsInCatalog ? ' (NEW)' : ''}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {suggestion.changeType}
                                  </Typography>
                                </Stack>
                              }
                            />
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No validation suggestions available.
                      </Typography>
                    )}
                  </Stack>
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Stack spacing={1}>
                    <Typography variant="subtitle1">Enrichment Suggestions (Apply)</Typography>
                    {enrichmentSuggestions.length ? (
                      <Stack spacing={0.5}>
                        {enrichmentSuggestions.map((suggestion) => {
                          const label = enrichmentLabelLookup.get(suggestion.catalogId) ?? suggestion.catalogId;
                          const disabled = !suggestion.existsInCatalog;
                          return (
                            <FormControlLabel
                              key={suggestion.catalogId}
                              control={
                                <Checkbox
                                  checked={appliedEnrichments.has(suggestion.catalogId)}
                                  onChange={() =>
                                    setAppliedEnrichments((prev) => toggleSetValue(prev, suggestion.catalogId))
                                  }
                                  disabled={disabled}
                                />
                              }
                              label={
                                <Stack spacing={0.25}>
                                  <Typography variant="body2">
                                    {label}
                                    {!suggestion.existsInCatalog ? ' (NEW)' : ''}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {suggestion.changeType}
                                  </Typography>
                                </Stack>
                              }
                            />
                          );
                        })}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No enrichment suggestions available.
                      </Typography>
                    )}
                  </Stack>
                </Grid>
              </Grid>
            </Paper>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Requirements Table</Typography>
                <TableContainer>
                  <Table size="small" aria-label="Requirements table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Requirement ID</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Suggested Capability</TableCell>
                        <TableCell>Confidence</TableCell>
                        <TableCell>Evidence</TableCell>
                        <TableCell>Open Questions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {analysis.requirements.map((req) => {
                        const firstEvidence = req.evidence[0];
                        return (
                          <TableRow
                            key={req.id}
                            hover
                            sx={{ cursor: 'pointer' }}
                            onClick={() => handleOpenRequirement(req.id)}
                          >
                            <TableCell>{req.id}</TableCell>
                            <TableCell>
                              <Chip label={req.category} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Chip label={req.priority} size="small" color="warning" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                                {capabilitySuggestions.length ? (
                                  capabilitySuggestions.map((capability) => (
                                    <Chip
                                      key={`${req.id}-${capability.capabilityKey}`}
                                      label={capability.capabilityKey}
                                      size="small"
                                      variant="outlined"
                                    />
                                  ))
                                ) : (
                                  <Typography variant="caption" color="text.secondary">
                                    N/A
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>{Math.round(req.confidence * 100)}%</TableCell>
                            <TableCell>
                              <Stack spacing={0.25}>
                                <Typography variant="caption" color="text.secondary">
                                  {firstEvidence ? `${firstEvidence.docId} ${firstEvidence.pageHint ?? ''}` : 'No evidence'}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {firstEvidence?.excerpt ?? '—'}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>{req.openQuestions.length}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Typography variant="caption" color="text.secondary">
                  Click any row to view the full requirement and evidence.
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        ) : (
          <Alert severity="info">Run requirement analysis to view results.</Alert>
        )}
      </SectionCard>

      <SectionCard title="Outputs" subtitle="Export results or prefill the snapshot wizard.">
        <Stack spacing={2}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
            <Button variant="outlined" onClick={handleExportJson} disabled={!analysis}>
              Export JSON
            </Button>
            <Button variant="outlined" onClick={handleExportCsv} disabled={!analysis}>
              Export CSV (requirements table)
            </Button>
            <Button variant="contained" onClick={handleSendToWizard} disabled={!analysis}>
              Send to Snapshot Wizard (prefill only)
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Prefill applies only the selections you checked above. AI analysis data is not embedded into snapshots.
          </Typography>
        </Stack>
      </SectionCard>

      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Typography variant="subtitle1">Requirement Details</Typography>
          {activeRequirement ? (
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">{activeRequirement.text}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={activeRequirement.category} size="small" variant="outlined" />
                  <Chip label={activeRequirement.priority} size="small" color="warning" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Confidence: {Math.round(activeRequirement.confidence * 100)}%
                  </Typography>
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Evidence</Typography>
                {activeRequirement.evidence.length ? (
                  <Stack spacing={1}>
                    {activeRequirement.evidence.map((evidence, index) => (
                      <Paper key={`${evidence.docId}-${index}`} variant="outlined" sx={{ p: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {evidence.docId} {evidence.pageHint ?? ''}
                        </Typography>
                        <Typography variant="body2">{evidence.excerpt}</Typography>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No evidence provided.
                  </Typography>
                )}
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Open Questions</Typography>
                {activeRequirement.openQuestions.length ? (
                  <Stack spacing={0.5}>
                    {activeRequirement.openQuestions.map((question) => (
                      <Typography key={question.id} variant="body2" color="text.secondary">
                        {question.text} ({question.status})
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No open questions yet.
                  </Typography>
                )}
              </Stack>

              <Divider />

              <Stack spacing={1}>
                <TextField
                  label="New Open Question"
                  value={openQuestionText}
                  onChange={(event) => setOpenQuestionText(event.target.value)}
                  placeholder="Add an open question for SMEs..."
                  fullWidth
                  multiline
                  minRows={2}
                />
                <Button variant="outlined" onClick={handleCreateOpenQuestion}>
                  Create Open Question
                </Button>
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a requirement to view details.
            </Typography>
          )}
        </Stack>
      </Drawer>
    </Stack>
  );
}
