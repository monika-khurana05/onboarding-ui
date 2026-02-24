import {
  Alert,
  Badge,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  Grid,
  ListItemText,
  MenuItem,
  Paper,
  Snackbar,
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
import type { SelectChangeEvent } from '@mui/material/Select';
import { useCallback, useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CountryCodeField } from '../../components/CountryCodeField';
import { SectionCard } from '../../components/SectionCard';
import { enrichmentCatalog } from '../../catalog/enrichmentCatalog';
import { validationCatalog } from '../../catalog/validationCatalog';
import { loadOnboardingDraft, saveOnboardingDraft } from '../../lib/storage/onboardingDraftStorage';
import {
  type RulesConfig,
  type SnapshotCapability,
  validateCountryCodeUppercase
} from '../../models/snapshot';
import { CAPABILITIES, type CapabilityId } from '../ai/requirements/capabilities';
import type { JiraEpicDraft, RequirementAnalysisResult } from '../ai/requirements/analysisTypes';
import type { ExtractedRequirement } from '../ai/requirements/types';
import { parseWorkspaceOutputToAnalysisResult } from '../ai/requirements/workspaceOutputParser';
import { buildJiraDraftExport, copyToClipboard, downloadJson } from '../ai/requirements/jiraDraftExport';
import { setStage } from '../../status/onboardingStatusStorage';

const capabilityLabelLookup = new Map<CapabilityId, string>(CAPABILITIES.map((item) => [item.id, item.label]));
const validationLabelLookup = new Map(validationCatalog.map((item) => [item.id, item.className]));
const enrichmentLabelLookup = new Map(enrichmentCatalog.map((item) => [item.id, item.className]));
const validationCatalogIds = new Set(validationCatalog.map((item) => item.id));
const enrichmentCatalogIds = new Set(enrichmentCatalog.map((item) => item.id));
const capabilityIdSet = new Set(CAPABILITIES.map((item) => item.id));
const requirementsResultKey = 'ai.requirements.v1.lastResult';
const requirementsSelectedCapabilitiesKey = 'ai.requirements.v1.selectedCapabilities';
const workspaceOutputAccept = '.json,.md,.markdown,.txt,.pdf,.csv';
const ASK_WORKSPACES_URL = '<<PUT_YOUR_INTERNAL_URL_HERE>>';
const requirementCategories: ExtractedRequirement['category'][] = [
  'Validation',
  'Enrichment',
  'Workflow',
  'Routing',
  'Compliance',
  'Data',
  'Other'
];
const jiraScopeColorLookup: Record<JiraEpicDraft['scope'], 'success' | 'warning' | 'info'> = {
  CONFIG_ONLY: 'success',
  CODE_CHANGE: 'warning',
  MIXED: 'info'
};

function normalizeCountryCode(value: string) {
  return value.trim().toUpperCase();
}

type WorkspaceUploadMeta = {
  fileName: string;
  uploadedAt: string;
  warnings: string[];
};

function loadRequirementsResult(): RequirementAnalysisResult | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = sessionStorage.getItem(requirementsResultKey);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as RequirementAnalysisResult;
  } catch (error) {
    console.warn('Failed to load requirements analysis result.', error);
    return null;
  }
}

function saveRequirementsResult(result: RequirementAnalysisResult) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(requirementsResultKey, JSON.stringify(result));
  } catch (error) {
    console.warn('Failed to save requirements analysis result.', error);
  }
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

export function RequirementAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flow = searchParams.get('flow') === 'OUTGOING' ? 'OUTGOING' : 'INCOMING';
  const initialResult = useMemo(() => loadRequirementsResult(), []);
  const [analysis, setAnalysis] = useState<RequirementAnalysisResult | null>(initialResult ?? null);
  const [countryCode, setCountryCode] = useState(() => initialResult?.countryCode ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<WorkspaceUploadMeta | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [openQuestionText, setOpenQuestionText] = useState('');
  const [appliedCapabilities, setAppliedCapabilities] = useState<Set<CapabilityId>>(new Set());
  const [appliedValidations, setAppliedValidations] = useState<Set<string>>(new Set());
  const [appliedEnrichments, setAppliedEnrichments] = useState<Set<string>>(new Set());
  const [requirementsOverrideMap, setRequirementsOverrideMap] = useState<Record<string, CapabilityId[]>>({});
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityId | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<ExtractedRequirement['category'] | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setAppliedCapabilities(new Set());
    setAppliedValidations(new Set());
    setAppliedEnrichments(new Set());
    setRequirementsOverrideMap({});
  }, [analysis?.countryCode, analysis?.requirements.length]);

  useEffect(() => {
    if (analysis?.countryCode) {
      setCountryCode(analysis.countryCode);
    }
  }, [analysis?.countryCode]);

  useEffect(() => {
    if (analysis) {
      saveRequirementsResult(analysis);
    }
  }, [analysis]);

  const effectiveCountryCode = useMemo(() => {
    const analysisCode = analysis?.countryCode?.toUpperCase() ?? '';
    if (analysisCode && analysisCode !== 'UNKNOWN') {
      return analysisCode;
    }
    return normalizeCountryCode(countryCode);
  }, [analysis?.countryCode, countryCode]);
  const capabilitySuggestions = useMemo(() => analysis?.mappedCapabilities ?? [], [analysis]);
  const validationSuggestions = useMemo(() => analysis?.validationSuggestions ?? [], [analysis]);
  const enrichmentSuggestions = useMemo(() => analysis?.enrichmentSuggestions ?? [], [analysis]);

  const requirementCount = analysis?.kpis.requirementsFound ?? 0;
  const openQuestionCount = analysis?.kpis.ambiguitiesCount ?? 0;
  const categoryOptions = requirementCategories;

  const activeRequirement = useMemo(
    () => analysis?.requirements.find((req) => req.id === selectedRequirementId) ?? null,
    [analysis, selectedRequirementId]
  );
  const activeOverrideSelection = useMemo(() => {
    if (!activeRequirement) {
      return [] as CapabilityId[];
    }
    return requirementsOverrideMap[activeRequirement.id] ?? activeRequirement.suggestedCapabilities;
  }, [activeRequirement, requirementsOverrideMap]);
  const filteredRequirements = useMemo(() => {
    if (!analysis) {
      return [];
    }
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return analysis.requirements.filter((req) => {
      if (categoryFilter !== 'ALL' && req.category !== categoryFilter) {
        return false;
      }
      const effectiveCapabilities = requirementsOverrideMap[req.id] ?? req.suggestedCapabilities;
      if (capabilityFilter !== 'ALL' && !effectiveCapabilities.includes(capabilityFilter)) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }
      const haystack = `${req.id} ${req.title} ${req.description}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [analysis, capabilityFilter, categoryFilter, requirementsOverrideMap, searchQuery]);

  const handleOpenRequirement = useCallback((id: string) => {
    setSelectedRequirementId(id);
    setOpenQuestionText('');
    setIsDrawerOpen(true);
  }, []);

  const handleOverrideChange = useCallback(
    (event: SelectChangeEvent) => {
      if (!activeRequirement) {
        return;
      }
      const value = event.target.value as string | string[];
      const next = Array.isArray(value) ? value : value ? value.split(',') : [];
      setRequirementsOverrideMap((prev) => ({
        ...prev,
        [activeRequirement.id]: next as CapabilityId[]
      }));
    },
    [activeRequirement]
  );

  const handleCapabilityFilterChange = useCallback((event: SelectChangeEvent) => {
    const value = event.target.value as CapabilityId | 'ALL';
    setCapabilityFilter(value);
  }, []);

  const handleCategoryFilterChange = useCallback((event: SelectChangeEvent) => {
    const value = event.target.value as ExtractedRequirement['category'] | 'ALL';
    setCategoryFilter(value);
  }, []);

  const handleUploadWorkspaceOutput = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const [file] = Array.from(event.target.files ?? []);
      if (!file) {
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const text = await file.text();
        const parsed = parseWorkspaceOutputToAnalysisResult({ fileName: file.name, content: text });
        setAnalysis(parsed);
        if (parsed.countryCode && parsed.countryCode !== 'UNKNOWN') {
          setCountryCode(parsed.countryCode);
        }
        setUploadMeta({
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          warnings: []
        });
        saveRequirementsResult(parsed);
        const nextCountry = normalizeCountryCode(parsed.countryCode || countryCode);
        if (nextCountry && nextCountry !== 'UNKNOWN') {
          setStage(nextCountry, flow, 'REQUIREMENTS', 'DONE', undefined, {
            requirementsSessionKey: requirementsResultKey
          });
          setStage(nextCountry, flow, 'PAYLOAD_MAPPING', 'IN_PROGRESS');
        }
      } catch (parseError) {
        console.warn('Failed to parse workspace output.', parseError);
        setError(parseError instanceof Error ? parseError.message : 'Failed to parse workspace output.');
      } finally {
        setLoading(false);
        event.target.value = '';
      }
    },
    [countryCode, flow]
  );

  const handleClearWorkspaceOutput = useCallback(() => {
    try {
      sessionStorage.removeItem(requirementsResultKey);
      sessionStorage.removeItem(requirementsSelectedCapabilitiesKey);
    } catch (error) {
      console.warn('Failed to clear workspace session storage.', error);
    }
    setAnalysis(null);
    setCountryCode('');
    setUploadMeta(null);
    setError(null);
    setIsDrawerOpen(false);
    setSelectedRequirementId(null);
    setOpenQuestionText('');
    setAppliedCapabilities(new Set());
    setAppliedValidations(new Set());
    setAppliedEnrichments(new Set());
    setRequirementsOverrideMap({});
    setCapabilityFilter('ALL');
    setCategoryFilter('ALL');
    setSearchQuery('');
    setToast({ message: 'Workspace output cleared.', severity: 'success' });
  }, []);

  const handleCreateOpenQuestion = useCallback(() => {
    if (!analysis || !selectedRequirementId) {
      return;
    }
    const trimmed = openQuestionText.trim();
    if (!trimmed) {
      return;
    }
    const targetRequirement = analysis.requirements.find((req) => req.id === selectedRequirementId);
    if (!targetRequirement) {
      return;
    }
    const wasEmpty = targetRequirement.openQuestions.length === 0;
    const next = {
      ...analysis,
      kpis: {
        ...analysis.kpis,
        ambiguitiesCount: analysis.kpis.ambiguitiesCount + (wasEmpty ? 1 : 0)
      },
      requirements: analysis.requirements.map((req) =>
        req.id === selectedRequirementId
          ? {
              ...req,
              openQuestions: [...req.openQuestions, trimmed]
            }
          : req
      )
    };
    setAnalysis(next);
    setOpenQuestionText('');
  }, [selectedRequirementId, analysis, openQuestionText]);

  const handleExportJson = useCallback(() => {
    if (!analysis) {
      return;
    }
    const token = effectiveCountryCode || 'requirements';
    downloadJson(`${token}-requirements-analysis.json`, analysis);
  }, [analysis, effectiveCountryCode]);

  const handleExportCsv = useCallback(() => {
    if (!analysis) {
      return;
    }
    const headers = [
      'Requirement ID',
      'Category',
      'Priority',
      'Suggested Capabilities',
      'Confidence',
      'Evidence',
      'Open Questions'
    ];
    const escapeCsv = (value: string) => {
      if (/[",\n]/.test(value)) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    };
    const rows = analysis.requirements.map((req) => {
      const evidence = req.evidence
        .map((entry) => `${entry.docId} ${entry.cite}`)
        .join(' | ');
      const questions = req.openQuestions.join(' | ');
      const suggestedCapabilityText = req.suggestedCapabilities
        .map((capabilityId) => capabilityLabelLookup.get(capabilityId) ?? capabilityId)
        .join('; ');
      return [
        req.id,
        req.category,
        req.priority,
        suggestedCapabilityText || 'N/A',
        `${Math.round(req.confidence)}%`,
        evidence,
        questions
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((value) => escapeCsv(String(value))).join(',')).join('\n');
    const token = effectiveCountryCode || 'requirements';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${token}-requirements-table.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [analysis, effectiveCountryCode]);

  const handleApplyCapabilitiesToWizard = useCallback(() => {
    try {
      const selected = Array.from(appliedCapabilities);
      sessionStorage.setItem(requirementsSelectedCapabilitiesKey, JSON.stringify(selected));
      setToast({ message: 'Applied to onboarding wizard (preview)', severity: 'success' });
    } catch (error) {
      console.warn('Failed to store selected capabilities.', error);
      setToast({ message: 'Failed to store selected capabilities.', severity: 'error' });
    }
  }, [appliedCapabilities]);

  const handleExportJiraPayload = useCallback(() => {
    if (!analysis) {
      return;
    }
    const token = effectiveCountryCode || 'requirements';
    const payload = buildJiraDraftExport({ ...analysis, countryCode: token });
    downloadJson(`jira-epics-${token}.json`, payload);
  }, [analysis, effectiveCountryCode]);

  const handleCopyEpicDrafts = useCallback(async () => {
    if (!analysis) {
      return;
    }
    try {
      const token = effectiveCountryCode || 'requirements';
      const payload = buildJiraDraftExport({ ...analysis, countryCode: token });
      await copyToClipboard(payload);
      setToast({ message: 'Copied Jira draft payload to clipboard.', severity: 'success' });
    } catch (error) {
      console.warn('Failed to copy epic drafts.', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to copy epic drafts.',
        severity: 'error'
      });
    }
  }, [analysis, effectiveCountryCode]);

  const handleCopySingleEpic = useCallback(async (epic: JiraEpicDraft) => {
    try {
      await copyToClipboard(epic);
      setToast({ message: 'Copied epic draft JSON.', severity: 'success' });
    } catch (error) {
      console.warn('Failed to copy epic draft.', error);
      setToast({
        message: error instanceof Error ? error.message : 'Failed to copy epic draft.',
        severity: 'error'
      });
    }
  }, []);


  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

  const handleSendToWizard = useCallback(() => {
    if (!analysis) {
      setError('Upload workspace output before sending to the wizard.');
      return;
    }
    const normalized = effectiveCountryCode;
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

    const appliedValidationConfigs = validAppliedValidations.map((id) => ({
      id,
      enabled: true,
      params: {}
    }));
    const appliedEnrichmentConfigs = validAppliedEnrichments.map((id) => ({
      id,
      enabled: true,
      params: {}
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
      const applied = Array.from(appliedCapabilities).filter((key) => capabilityIdSet.has(key as CapabilityId));
      if (nextCapabilities && Array.isArray(nextCapabilities)) {
        const updated = nextCapabilities.map((cap) =>
          appliedCapabilities.has(cap.capabilityKey as CapabilityId) ? { ...cap, enabled: true } : cap
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
  }, [analysis, appliedCapabilities, appliedEnrichments, appliedValidations, effectiveCountryCode, navigate]);

  return (
    <Stack spacing={3}>
      <Alert severity="info">
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">
            This page integrates with Ask Workspaces for document analysis. Upload the Workspaces output file and we’ll generate
            capability-wise Jira epics.
          </Typography>
        </Stack>
      </Alert>

      <Typography variant="h4">Requirement Analysis</Typography>

      <SectionCard title="Workspace Output" subtitle="Generate requirement analysis in Ask Workspaces and upload the output here.">
        <Stack spacing={2}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack spacing={1} justifyContent="space-between" sx={{ height: '100%' }}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Step 1: Open Ask Workspaces</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Launch Ask Workspaces to run the requirement analysis on your documents.
                    </Typography>
                  </Stack>
                  <Button variant="contained" href={ASK_WORKSPACES_URL} target="_blank" rel="noreferrer">
                    Open Ask Workspaces
                  </Button>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Step 2: Generate structured output using preset</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Use the Workspace preset to export structured output (JSON, Markdown, or TXT).
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Step 3: Upload structured output here</Typography>
                  <Button variant="outlined" component="label" disabled={loading}>
                    {loading ? 'Parsing...' : 'Upload Workspace Output'}
                    <input hidden type="file" accept={workspaceOutputAccept} onChange={handleUploadWorkspaceOutput} />
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    Accepted: JSON, Markdown, TXT, PDF, CSV.
                  </Typography>
                </Stack>
              </Paper>
            </Grid>
          </Grid>
          <CountryCodeField
            value={effectiveCountryCode}
            onChange={setCountryCode}
            disabled={Boolean(analysis?.countryCode && analysis.countryCode !== 'UNKNOWN')}
            helperText={
              analysis?.countryCode && analysis.countryCode !== 'UNKNOWN'
                ? 'Country code loaded from workspace output.'
                : 'Optional: add a country code if the workspace output is missing one.'
            }
          />
          {uploadMeta ? (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Uploaded {uploadMeta.fileName} · {new Date(uploadMeta.uploadedAt).toLocaleString()}
              </Typography>
              {uploadMeta.warnings.length ? (
                <Alert severity="warning">
                  <Stack spacing={0.25}>
                    <Typography variant="subtitle2">Parsing notes</Typography>
                    {uploadMeta.warnings.map((warning, index) => (
                      <Typography key={`upload-warning-${index}`} variant="caption" color="text.secondary">
                        {warning}
                      </Typography>
                    ))}
                  </Stack>
                </Alert>
              ) : null}
            </Stack>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </SectionCard>

      <SectionCard title="Parsed Output Summary" subtitle="Snapshot of the uploaded workspace output.">
        {analysis ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Requirements Found
                </Typography>
                <Typography variant="h5">{analysis.kpis.requirementsFound}</Typography>
              </Paper>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  Mapped Capabilities
                </Typography>
                <Typography variant="h5">{analysis.mappedCapabilities.length}</Typography>
              </Paper>
            </Grid>
          </Grid>
        ) : (
          <Alert severity="info">Upload workspace output to view summary.</Alert>
        )}
      </SectionCard>

      <SectionCard title="Generated Jira Epics (Draft)" subtitle="Draft epics generated from the parsed workspace output.">
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
          >
            <Typography variant="subtitle1">Epic Drafts</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
              <Button
                variant="outlined"
                size="small"
                onClick={handleExportJiraPayload}
                disabled={!analysis?.jiraEpics.length}
              >
                Download Jira Draft JSON
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={handleCopyEpicDrafts}
                disabled={!analysis?.jiraEpics.length}
              >
                Copy Jira Draft JSON
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={handleClearWorkspaceOutput}
                disabled={!analysis && !uploadMeta}
              >
                Reset
              </Button>
            </Stack>
          </Stack>
          {analysis ? (
            analysis.jiraEpics.length ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-label="Jira epic drafts">
                  <TableHead>
                    <TableRow>
                      <TableCell>Capability</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Dependencies</TableCell>
                      <TableCell align="right">Copy</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.jiraEpics.map((epic, index) => {
                      const capabilityLabel = capabilityLabelLookup.get(epic.capabilityId) ?? epic.capabilityId;
                      const dependencyLabels = epic.dependencies.map((dep) => capabilityLabelLookup.get(dep) ?? dep);
                      return (
                        <TableRow key={`${epic.capabilityId}-${index}`} hover>
                          <TableCell>{capabilityLabel}</TableCell>
                          <TableCell>{epic.title}</TableCell>
                          <TableCell>
                            <Chip label={epic.scope} size="small" color={jiraScopeColorLookup[epic.scope]} variant="outlined" />
                          </TableCell>
                          <TableCell>{dependencyLabels.length ? dependencyLabels.join(', ') : 'None'}</TableCell>
                          <TableCell align="right">
                            <Button size="small" variant="outlined" onClick={() => handleCopySingleEpic(epic)}>
                              Copy
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">No Jira epic drafts found in the uploaded output.</Alert>
            )
          ) : (
            <Alert severity="info">Upload workspace output to view Jira epic drafts.</Alert>
          )}
        </Stack>
      </SectionCard>

      <Drawer
        anchor="right"
        open={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Requirement Details</Typography>
            <Button size="small" variant="text" onClick={() => setIsDrawerOpen(false)}>
              Close
            </Button>
          </Stack>
          {activeRequirement ? (
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {activeRequirement.id}
                </Typography>
                <Typography variant="subtitle2">{activeRequirement.title}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={activeRequirement.category} size="small" variant="outlined" />
                  <Chip label={activeRequirement.priority} size="small" color="warning" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Confidence: {Math.round(activeRequirement.confidence)}%
                  </Typography>
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Suggested Capabilities</Typography>
                {activeOverrideSelection.length ? (
                  <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                    {activeOverrideSelection.map((capabilityId) => (
                      <Chip
                        key={`${activeRequirement.id}-${capabilityId}-detail`}
                        label={capabilityLabelLookup.get(capabilityId) ?? capabilityId}
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No capabilities mapped yet.
                  </Typography>
                )}
              </Stack>

              <Typography variant="body2" color="text.secondary">
                {activeRequirement.description}
              </Typography>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Override Capabilities (Preview)</Typography>
                <TextField
                  select
                  label="Capability Overrides"
                  value={activeOverrideSelection}
                  onChange={handleOverrideChange}
                  fullWidth
                  SelectProps={{
                    multiple: true,
                    renderValue: (selected) => {
                      const ids = selected as string[];
                      return ids.length
                        ? ids.map((id) => capabilityLabelLookup.get(id as CapabilityId) ?? id).join(', ')
                        : 'None selected';
                    }
                  }}
                >
                  {CAPABILITIES.map((capability) => (
                    <MenuItem key={capability.id} value={capability.id}>
                      <Checkbox checked={activeOverrideSelection.includes(capability.id)} />
                      <ListItemText primary={capability.label} secondary={capability.description} />
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="caption" color="text.secondary">
                  Preview only; overrides are not persisted.
                </Typography>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Evidence</Typography>
                {activeRequirement.evidence.length ? (
                  <Stack spacing={1}>
                    {activeRequirement.evidence.map((evidence, index) => (
                      <Paper key={`${evidence.docId}-${index}`} variant="outlined" sx={{ p: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {evidence.docId} {evidence.cite}
                        </Typography>
                        {evidence.snippet ? (
                          <Typography variant="body2" color="text.secondary">
                            {evidence.snippet}
                          </Typography>
                        ) : null}
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
                    {activeRequirement.openQuestions.map((question, index) => (
                      <Typography key={`${activeRequirement.id}-q-${index}`} variant="body2" color="text.secondary">
                        • {question}
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

      <Snackbar
        open={Boolean(toast)}
        autoHideDuration={4000}
        onClose={handleToastClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? (
          <Alert onClose={handleToastClose} severity={toast.severity} variant="filled" sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Stack>
  );
}
