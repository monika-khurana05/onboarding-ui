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
type FlowSelection = 'INCOMING' | 'OUTGOING' | '';
const COUNTRY_OPTIONS = [
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'AR', label: 'Argentina' },
  { code: 'AU', label: 'Australia' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CA', label: 'Canada' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'CN', label: 'China' },
  { code: 'DE', label: 'Germany' },
  { code: 'ES', label: 'Spain' },
  { code: 'FR', label: 'France' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'HK', label: 'Hong Kong' },
  { code: 'ID', label: 'Indonesia' },
  { code: 'IN', label: 'India' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
  { code: 'MX', label: 'Mexico' },
  { code: 'MY', label: 'Malaysia' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'PH', label: 'Philippines' },
  { code: 'SG', label: 'Singapore' },
  { code: 'TH', label: 'Thailand' },
  { code: 'US', label: 'United States' },
  { code: 'ZA', label: 'South Africa' }
];
const REGION_OPTIONS = ['NAM', 'APAC', 'EMEA'] as const;
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

function isValidFlow(value: FlowSelection): value is Exclude<FlowSelection, ''> {
  return value === 'INCOMING' || value === 'OUTGOING';
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

function buildWorkspaceOutputFileName(
  countryCode: string,
  region: string,
  flow: Exclude<FlowSelection, ''>,
  uploadedAt: string
) {
  const safeTimestamp = uploadedAt.replace(/[:.]/g, '-');
  const parts = ['workspace-output', countryCode || 'UNKNOWN', region || 'REGION', flow, safeTimestamp];
  return `${parts.filter(Boolean).join('-')}.json`;
}

function buildWorkspaceOutputArchive(args: {
  fileName: string;
  uploadedAt: string;
  countryCode: string;
  region: string;
  flow: Exclude<FlowSelection, ''>;
  content: string;
  analysis: RequirementAnalysisResult;
}) {
  return {
    meta: {
      fileName: args.fileName,
      uploadedAt: args.uploadedAt,
      countryCode: args.countryCode,
      region: args.region,
      flow: args.flow
    },
    rawContent: args.content,
    analysis: args.analysis
  };
}

export function RequirementAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flowParam = searchParams.get('flow');
  const initialFlow: FlowSelection =
    flowParam === 'OUTGOING' ? 'OUTGOING' : flowParam === 'INCOMING' ? 'INCOMING' : '';
  const initialResult = useMemo(() => loadRequirementsResult(), []);
  const [analysis, setAnalysis] = useState<RequirementAnalysisResult | null>(initialResult ?? null);
  const [countryCode, setCountryCode] = useState(() => initialResult?.countryCode ?? '');
  const [region, setRegion] = useState<(typeof REGION_OPTIONS)[number] | ''>('');
  const [flowSelection, setFlowSelection] = useState<FlowSelection>(initialFlow);
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
    if (analysis?.countryCode && analysis.countryCode !== 'UNKNOWN') {
      setCountryCode(analysis.countryCode);
    }
  }, [analysis?.countryCode]);

  useEffect(() => {
    if (analysis) {
      saveRequirementsResult(analysis);
    }
  }, [analysis]);

  const effectiveCountryCode = useMemo(() => {
    const manualCode = normalizeCountryCode(countryCode);
    if (manualCode) {
      return manualCode;
    }
    const analysisCode = analysis?.countryCode?.toUpperCase() ?? '';
    if (analysisCode && analysisCode !== 'UNKNOWN') {
      return analysisCode;
    }
    return '';
  }, [analysis?.countryCode, countryCode]);
  const isFlowReady = isValidFlow(flowSelection);
  const countrySelectValue = effectiveCountryCode && effectiveCountryCode !== 'UNKNOWN' ? effectiveCountryCode : '';
  const isUploadReady = Boolean(countrySelectValue && region && isFlowReady);
  const hasAnalysis = Boolean(analysis);
  const countryOptions = useMemo(() => {
    const next = [...COUNTRY_OPTIONS];
    const extraCodes = [analysis?.countryCode, countryCode]
      .map((value) => normalizeCountryCode(value ?? ''))
      .filter((value) => value && value !== 'UNKNOWN');
    extraCodes.forEach((code) => {
      if (!next.some((option) => option.code === code)) {
        next.unshift({ code, label: code });
      }
    });
    return next;
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
  }, [initialFlow]);

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
      if (!isUploadReady) {
        setError('Select country, region, and flow before uploading.');
        event.target.value = '';
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const text = await file.text();
        const parsed = parseWorkspaceOutputToAnalysisResult({ fileName: file.name, content: text });
        const resolvedCountry = normalizeCountryCode(effectiveCountryCode || parsed.countryCode || 'UNKNOWN');
        const nextAnalysis = { ...parsed, countryCode: resolvedCountry };
        const uploadedAt = new Date().toISOString();
        setAnalysis(nextAnalysis);
        setCountryCode(resolvedCountry);
        setUploadMeta({
          fileName: file.name,
          uploadedAt,
          warnings: []
        });
        if (isValidFlow(flowSelection)) {
          const archive = buildWorkspaceOutputArchive({
            fileName: file.name,
            uploadedAt,
            countryCode: resolvedCountry,
            region,
            flow: flowSelection,
            content: text,
            analysis: nextAnalysis
          });
          const archiveFileName = buildWorkspaceOutputFileName(resolvedCountry, region, flowSelection, uploadedAt);
          downloadJson(archiveFileName, archive);
          setToast({ message: `Ask AI output saved as ${archiveFileName}.`, severity: 'success' });
        }
        saveRequirementsResult(nextAnalysis);
        if (resolvedCountry && resolvedCountry !== 'UNKNOWN' && isValidFlow(flowSelection)) {
          setStage(resolvedCountry, flowSelection, 'REQUIREMENTS', 'DONE', undefined, {
            requirementsSessionKey: requirementsResultKey
          });
          setStage(resolvedCountry, flowSelection, 'PAYLOAD_MAPPING', 'IN_PROGRESS');
        }
      } catch (parseError) {
        console.warn('Failed to parse Ask AI output.', parseError);
        setError(parseError instanceof Error ? parseError.message : 'Failed to parse Ask AI output.');
      } finally {
        setLoading(false);
        event.target.value = '';
      }
    },
    [effectiveCountryCode, flowSelection, isUploadReady]
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
    setRegion('');
    setFlowSelection(initialFlow);
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
    setToast({ message: 'Ask AI output cleared.', severity: 'success' });
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
      setError('Upload Ask AI output before sending to the wizard.');
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
      <Typography variant="h4">Requirement Analysis</Typography>
      <SectionCard
        title="Overview"
        subtitle="Use Ask AI to analyze PDFs/Word/Jira exports and generate structured capability output."
      >
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            Upload the Ask AI output file and we’ll generate capability-wise Jira epics. Required metadata is captured for
            future persistence.
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Chip
              label={isUploadReady ? 'Setup complete' : 'Setup required'}
              color={isUploadReady ? 'success' : 'warning'}
              variant="outlined"
              size="small"
            />
            <Chip
              label={analysis ? 'Ask AI output loaded' : 'No output yet'}
              color={analysis ? 'success' : 'default'}
              variant="outlined"
              size="small"
            />
            {uploadMeta ? (
              <Chip
                label={`Last upload: ${new Date(uploadMeta.uploadedAt).toLocaleString()}`}
                variant="outlined"
                size="small"
              />
            ) : null}
            <Chip
              label={`Country: ${countrySelectValue || '—'}`}
              variant="outlined"
              size="small"
              color={countrySelectValue ? 'default' : 'warning'}
            />
            <Chip
              label={`Region: ${region || '—'}`}
              variant="outlined"
              size="small"
              color={region ? 'default' : 'warning'}
            />
            <Chip
              label={`Flow: ${isFlowReady ? flowSelection : '—'}`}
              variant="outlined"
              size="small"
              color={isFlowReady ? 'default' : 'warning'}
            />
          </Stack>
          {hasAnalysis ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Requirements Found
                  </Typography>
                  <Typography variant="h5">{analysis?.kpis.requirementsFound ?? 0}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Mapped Capabilities
                  </Typography>
                  <Typography variant="h5">{analysis?.mappedCapabilities.length ?? 0}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Jira Drafts
                  </Typography>
                  <Typography variant="h5">{analysis?.jiraEpics.length ?? 0}</Typography>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info" variant="outlined">
              Upload Ask AI output to see the summary and Jira drafts.
            </Alert>
          )}
        </Stack>
      </SectionCard>

      <SectionCard title="Required Setup" subtitle="These fields will be stored with the Ask AI output.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="Country"
              required
              value={countrySelectValue}
              onChange={(event) => setCountryCode(event.target.value.toUpperCase())}
              helperText={
                analysis?.countryCode && analysis.countryCode !== 'UNKNOWN'
                  ? 'Loaded from Ask AI output; you can override if needed.'
                  : 'Required: select a country code before upload.'
              }
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Select country</em>
              </MenuItem>
              {countryOptions.map((option) => (
                <MenuItem key={option.code} value={option.code}>
                  {option.label} ({option.code})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="Region"
              required
              value={region}
              onChange={(event) => setRegion(event.target.value as (typeof REGION_OPTIONS)[number] | '')}
              helperText="Required: tag the analysis to a region."
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Select region</em>
              </MenuItem>
              {REGION_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="Flow"
              required
              value={flowSelection}
              onChange={(event) => setFlowSelection(event.target.value as FlowSelection)}
              helperText="Required: pick the processing flow."
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Select flow</em>
              </MenuItem>
              <MenuItem value="INCOMING">Incoming</MenuItem>
              <MenuItem value="OUTGOING">Outgoing</MenuItem>
            </TextField>
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard title="Ask AI" subtitle="Run Ask AI and upload the structured output file.">
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">Ask AI</Typography>
            </Stack>
            <Button variant="contained" href={ASK_WORKSPACES_URL} target="_blank" rel="noreferrer">
              Open Ask AI
            </Button>
          </Stack>
          <Paper variant="outlined" sx={{ p: 2, borderStyle: 'dashed' }}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              alignItems={{ sm: 'center' }}
              justifyContent="space-between"
            >
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Upload Output</Typography>
                <Typography variant="body2" color="text.secondary">
                  {isUploadReady ? 'Ready to upload structured output.' : 'Complete required setup to enable uploads.'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Accepted: JSON, Markdown, TXT, PDF, CSV.
                </Typography>
              </Stack>
              <Button variant="outlined" component="label" disabled={loading || !isUploadReady}>
                {loading ? 'Parsing...' : 'Upload Workspace Output'}
                <input
                  hidden
                  type="file"
                  accept={workspaceOutputAccept}
                  onChange={handleUploadWorkspaceOutput}
                  disabled={loading || !isUploadReady}
                />
              </Button>
            </Stack>
          </Paper>
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

      <SectionCard title="Analysis Output" subtitle="Jira draft epics generated from the parsed output.">
        {analysis ? (
          <Stack spacing={2}>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <Stack spacing={0.25}>
                  <Typography variant="subtitle1">Jira Epic Drafts</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {analysis.jiraEpics.length} draft{analysis.jiraEpics.length === 1 ? '' : 's'} generated.
                  </Typography>
                </Stack>
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
              {analysis.jiraEpics.length ? (
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
                              <Chip
                                label={epic.scope}
                                size="small"
                                color={jiraScopeColorLookup[epic.scope]}
                                variant="outlined"
                              />
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
              )}
            </Stack>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Upload Ask AI output to generate Jira drafts.
          </Typography>
        )}
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
