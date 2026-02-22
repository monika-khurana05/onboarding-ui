import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
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
  Tooltip,
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
import { MOCK_DOCS } from '../ai/requirements/mockDocs';
import { runMockAnalysis } from '../ai/requirements/mockAnalysis';
import type { ExtractedRequirement, RequirementDocSource } from '../ai/requirements/types';
import { setStage } from '../../status/onboardingStatusStorage';

const capabilityLabelLookup = new Map<CapabilityId, string>(CAPABILITIES.map((item) => [item.id, item.label]));
const validationLabelLookup = new Map(validationCatalog.map((item) => [item.id, item.className]));
const enrichmentLabelLookup = new Map(enrichmentCatalog.map((item) => [item.id, item.className]));
const validationCatalogIds = new Set(validationCatalog.map((item) => item.id));
const enrichmentCatalogIds = new Set(enrichmentCatalog.map((item) => item.id));
const capabilityIdSet = new Set(CAPABILITIES.map((item) => item.id));
const mockDocById = new Map(MOCK_DOCS.map((doc) => [doc.id, doc]));
const mockDocIdSet = new Set(MOCK_DOCS.map((doc) => doc.id));
const requirementsCountryKey = 'ai.requirements.v1.countryCode';
const requirementsDocIdsKey = 'ai.requirements.v1.selectedDocIds';
const requirementsResultKey = 'ai.requirements.v1.lastResult';
const requirementsSelectedCapabilitiesKey = 'ai.requirements.v1.selectedCapabilities';
const localDocContentKey = 'local_file_stub';
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

type RequirementsInputState = {
  countryCode: string;
  selectedDocIds: string[];
};

function mergeDocSources(docs: RequirementDocSource[]) {
  const seen = new Set<string>();
  const result: RequirementDocSource[] = [];
  docs.forEach((doc) => {
    if (!doc?.id || seen.has(doc.id)) {
      return;
    }
    seen.add(doc.id);
    result.push(doc);
  });
  return result;
}

function resolveDocSource(doc: RequirementDocSource): RequirementDocSource {
  return mockDocById.get(doc.id) ?? doc;
}

function hydrateSelectedDocs(selectedDocIds: string[]) {
  const docs = selectedDocIds
    .map((id) => mockDocById.get(id))
    .filter((doc): doc is RequirementDocSource => Boolean(doc));
  return mergeDocSources(docs);
}

function loadRequirementsInputs(): RequirementsInputState | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const countryCode = sessionStorage.getItem(requirementsCountryKey) ?? '';
    const rawDocIds = sessionStorage.getItem(requirementsDocIdsKey);
    if (!countryCode && !rawDocIds) {
      return null;
    }
    const parsed = rawDocIds ? (JSON.parse(rawDocIds) as unknown) : [];
    const selectedDocIds = Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
      : [];
    return { countryCode, selectedDocIds };
  } catch (error) {
    console.warn('Failed to load requirements input state.', error);
    return null;
  }
}

function saveRequirementsInputs(state: RequirementsInputState) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(requirementsCountryKey, state.countryCode);
    sessionStorage.setItem(requirementsDocIdsKey, JSON.stringify(state.selectedDocIds));
  } catch (error) {
    console.warn('Failed to save requirements input state.', error);
  }
}

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

function isLocalDoc(doc: RequirementDocSource) {
  return doc.mockContentKey === localDocContentKey;
}

function deriveDocTypeFromFileName(fileName: string): RequirementDocSource['type'] {
  const extension = fileName.trim().split('.').pop()?.toLowerCase() ?? '';
  switch (extension) {
    case 'pdf':
      return 'PDF';
    case 'doc':
    case 'docx':
      return 'DOCX';
    case 'msg':
    case 'eml':
      return 'EMAIL';
    case 'html':
    case 'htm':
      return 'HTML';
    case 'txt':
    default:
      return 'TEXT';
  }
}

function formatDocChipLabel(doc: RequirementDocSource) {
  return `${doc.label} (${doc.type})`;
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
  const queryCountry = searchParams.get('country');
  const initialInputs = useMemo(() => loadRequirementsInputs(), []);
  const initialResult = useMemo(() => loadRequirementsResult(), []);
  const [countryCode, setCountryCode] = useState(
    () => queryCountry?.toUpperCase() ?? initialInputs?.countryCode ?? initialResult?.countryCode ?? 'AR'
  );
  const [selectedDocs, setSelectedDocs] = useState<RequirementDocSource[]>(() => {
    if (initialInputs?.selectedDocIds?.length) {
      return hydrateSelectedDocs(initialInputs.selectedDocIds);
    }
    if (initialResult?.inputDocs?.length) {
      return mergeDocSources(
        initialResult.inputDocs
          .map(resolveDocSource)
          .filter((doc) => mockDocIdSet.has(doc.id))
      );
    }
    return MOCK_DOCS.slice(0, 1);
  });
  const [analysis, setAnalysis] = useState<RequirementAnalysisResult | null>(initialResult ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadSource, setLoadSource] = useState<'storage' | 'mock' | null>(initialResult ? 'storage' : null);
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
  const normalizedCountry = useMemo(() => normalizeCountryCode(countryCode), [countryCode]);
  const availableDocs = useMemo(
    () => MOCK_DOCS.filter((doc) => doc.countryCode === normalizedCountry),
    [normalizedCountry]
  );
  const availableDocMap = useMemo(() => new Map(availableDocs.map((doc) => [doc.id, doc])), [availableDocs]);
  const availableDocIdSet = useMemo(() => new Set(availableDocs.map((doc) => doc.id)), [availableDocs]);
  const selectedMockDocIds = useMemo(
    () => selectedDocs.filter((doc) => availableDocIdSet.has(doc.id)).map((doc) => doc.id),
    [availableDocIdSet, selectedDocs]
  );
  const uploadedDocs = useMemo(() => selectedDocs.filter((doc) => isLocalDoc(doc)), [selectedDocs]);

  useEffect(() => {
    if (queryCountry) {
      setCountryCode(queryCountry.toUpperCase());
    }
  }, [queryCountry]);

  useEffect(() => {
    setSelectedDocs((prev) => {
      const locals = prev.filter(isLocalDoc);
      const retained = prev.filter((doc) => !isLocalDoc(doc) && doc.countryCode === normalizedCountry);
      return mergeDocSources([...retained, ...locals]);
    });
  }, [normalizedCountry]);

  useEffect(() => {
    const selectedDocIds = selectedDocs.map((doc) => doc.id);
    saveRequirementsInputs({ countryCode: normalizedCountry, selectedDocIds });
  }, [normalizedCountry, selectedDocs]);

  useEffect(() => {
    if (!normalizedCountry) {
      setAnalysis(null);
      setLoadSource(null);
      return;
    }
    if (analysis && analysis.countryCode !== normalizedCountry) {
      setAnalysis(null);
      setLoadSource(null);
    }
  }, [analysis, normalizedCountry]);

  useEffect(() => {
    setAppliedCapabilities(new Set());
    setAppliedValidations(new Set());
    setAppliedEnrichments(new Set());
    setRequirementsOverrideMap({});
  }, [analysis?.countryCode, analysis?.requirements.length]);

  useEffect(() => {
    if (analysis) {
      saveRequirementsResult(analysis);
    }
  }, [analysis]);

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
  const jiraEpicsByCapability = useMemo(() => {
    const groups = new Map<CapabilityId, JiraEpicDraft[]>();
    analysis?.jiraEpics.forEach((epic) => {
      const list = groups.get(epic.capabilityId) ?? [];
      list.push(epic);
      groups.set(epic.capabilityId, list);
    });
    return Array.from(groups.entries());
  }, [analysis]);
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

  const handleDocumentSelectionChange = useCallback(
    (event: SelectChangeEvent) => {
      const value = event.target.value as string | string[];
      const nextIds = Array.isArray(value) ? value : value ? value.split(',') : [];
      const nextDocs = nextIds
        .map((id) => availableDocMap.get(id))
        .filter((doc): doc is RequirementDocSource => Boolean(doc));
      setSelectedDocs((prev) => mergeDocSources([...nextDocs, ...prev.filter(isLocalDoc)]));
    },
    [availableDocMap]
  );

  const handleCapabilityFilterChange = useCallback((event: SelectChangeEvent) => {
    const value = event.target.value as CapabilityId | 'ALL';
    setCapabilityFilter(value);
  }, []);

  const handleCategoryFilterChange = useCallback((event: SelectChangeEvent) => {
    const value = event.target.value as ExtractedRequirement['category'] | 'ALL';
    setCategoryFilter(value);
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedDocs((prev) => mergeDocSources([...availableDocs, ...prev.filter(isLocalDoc)]));
  }, [availableDocs]);

  const handlePaymentsOnly = useCallback(() => {
    const paymentDoc = mockDocById.get('AR-REG-001');
    if (!paymentDoc) {
      return;
    }
    setSelectedDocs((prev) => mergeDocSources([paymentDoc, ...prev.filter(isLocalDoc)]));
  }, []);

  const handleFullPack = useCallback(() => {
    const arDocs = MOCK_DOCS.filter((doc) => doc.countryCode === 'AR');
    setSelectedDocs((prev) => mergeDocSources([...arDocs, ...prev.filter(isLocalDoc)]));
  }, []);

  const handleUploadFiles = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) {
        return;
      }
      const timestamp = Date.now();
      const nextDocs = files.map((file, index) => {
        return {
          id: `UP-${timestamp}-${index}`,
          label: file.name,
          countryCode: normalizedCountry || 'AR',
          type: deriveDocTypeFromFileName(file.name),
          tags: ['uploaded'],
          mockContentKey: localDocContentKey,
          origin: 'UPLOADED'
        };
      });
      setSelectedDocs((prev) => mergeDocSources([...prev, ...nextDocs]));
      event.target.value = '';
    },
    [normalizedCountry]
  );

  const handleRunAnalysis = useCallback(() => {
    const errors = validateCountryCodeUppercase(normalizedCountry);
    if (errors.length > 0) {
      setError(errors[0]?.message ?? 'Country code is required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = runMockAnalysis(normalizedCountry, selectedDocs);
      setAnalysis(data);
      saveRequirementsResult(data);
      setStage(normalizedCountry, flow, 'REQUIREMENTS', 'DONE', undefined, {
        requirementsSessionKey: requirementsResultKey
      });
      setStage(normalizedCountry, flow, 'PAYLOAD_MAPPING', 'IN_PROGRESS');
      setLoadSource('mock');
    } catch (fetchError) {
      console.warn('Failed to load requirement analysis.', fetchError);
      setError('Failed to run mock requirement analysis.');
    } finally {
      setLoading(false);
    }
  }, [flow, normalizedCountry, selectedDocs]);

  const handleResetDemo = useCallback(() => {
    try {
      sessionStorage.removeItem(requirementsCountryKey);
      sessionStorage.removeItem(requirementsDocIdsKey);
      sessionStorage.removeItem(requirementsResultKey);
      sessionStorage.removeItem(requirementsSelectedCapabilitiesKey);
    } catch (error) {
      console.warn('Failed to clear demo session storage.', error);
    }
    setCountryCode('AR');
    const defaultDoc = MOCK_DOCS.find((doc) => doc.id === 'AR-REG-001') ?? MOCK_DOCS[0];
    setSelectedDocs(defaultDoc ? [defaultDoc] : []);
    setAnalysis(null);
    setLoadSource(null);
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
    setToast({ message: 'Demo state reset.', severity: 'success' });
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
    const token = normalizeCountryCode(analysis.countryCode ?? countryCode) || 'requirements';
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
    const token = normalizeCountryCode(analysis.countryCode ?? countryCode) || 'requirements';
    downloadBlob(csv, `${token}-requirements-table.csv`, 'text/csv;charset=utf-8');
  }, [analysis, countryCode, downloadBlob]);

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
    const token = normalizeCountryCode(analysis.countryCode ?? countryCode) || 'requirements';
    const payload = {
      countryCode: token,
      generatedAt: new Date().toISOString(),
      epics: analysis.jiraEpics
    };
    downloadBlob(
      JSON.stringify(payload, null, 2),
      `jira-epics-${token}.json`,
      'application/json;charset=utf-8'
    );
  }, [analysis, countryCode, downloadBlob]);

  const handleCopyEpicDrafts = useCallback(async () => {
    if (!analysis) {
      return;
    }
    if (!navigator?.clipboard?.writeText) {
      setToast({ message: 'Clipboard access is unavailable.', severity: 'error' });
      return;
    }
    const groups = new Map<CapabilityId, JiraEpicDraft[]>();
    analysis.jiraEpics.forEach((epic) => {
      const list = groups.get(epic.capabilityId) ?? [];
      list.push(epic);
      groups.set(epic.capabilityId, list);
    });
    const lines: string[] = [];
    Array.from(groups.entries()).forEach(([capabilityId, epics]) => {
      const label = capabilityLabelLookup.get(capabilityId) ?? capabilityId;
      lines.push(`## ${label}`);
      epics.forEach((epic) => {
        lines.push(`### ${epic.title}`);
        lines.push(`Summary: ${epic.summary}`);
        lines.push(`Scope: ${epic.scope}`);
        const dependencyLabels = epic.dependencies.map((dep) => capabilityLabelLookup.get(dep) ?? dep);
        lines.push(`Dependencies: ${dependencyLabels.length ? dependencyLabels.join(', ') : 'None'}`);
        lines.push(
          `Linked Requirements: ${epic.linkedRequirements.length ? epic.linkedRequirements.join(', ') : 'None'}`
        );
        lines.push('Acceptance Criteria:');
        epic.acceptanceCriteria.forEach((item) => lines.push(`- ${item}`));
        lines.push('');
      });
      lines.push('');
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n').trim());
      setToast({ message: 'Copied epic drafts to clipboard.', severity: 'success' });
    } catch (error) {
      console.warn('Failed to copy epic drafts.', error);
      setToast({ message: 'Failed to copy epic drafts.', severity: 'error' });
    }
  }, [analysis]);

  const handleToastClose = useCallback(() => {
    setToast(null);
  }, []);

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
  }, [
    analysis,
    appliedCapabilities,
    appliedEnrichments,
    appliedValidations,
    countryCode,
    navigate
  ]);

  return (
    <Stack spacing={3}>
      <Alert
        severity="warning"
        action={
          <Tooltip title="This screen uses mock extraction to demonstrate the UX. Backend LLM integration will replace this.">
            <span>
              <InfoOutlinedIcon fontSize="small" />
            </span>
          </Tooltip>
        }
      >
        <Stack spacing={0.5}>
          <Typography variant="subtitle2">Preview / Demo Mode (R2D2 Pending)</Typography>
          <Typography variant="caption" color="text.secondary">
            Mock extraction used for demo wiring; backend LLM integration will replace this.
          </Typography>
        </Stack>
      </Alert>

      <Typography variant="h4">Requirement Analysis</Typography>

      <SectionCard title="Inputs" subtitle="Upload or select requirement sources for AI extraction.">
        <Stack spacing={2}>
          <CountryCodeField
            value={countryCode}
            onChange={setCountryCode}
            required
            helperText="Two-letter ISO code used to load mock analysis."
          />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'flex-start' }}>
            <TextField
              select
              label="Requirement Documents (Demo)"
              value={selectedMockDocIds}
              onChange={handleDocumentSelectionChange}
              helperText="Mock inputs representing uploaded regulatory documents."
              fullWidth
              SelectProps={{
                multiple: true,
                renderValue: (selected) => {
                  const ids = selected as string[];
                  return ids.length ? `${ids.length} selected` : 'None selected';
                }
              }}
              sx={{ flex: 1 }}
            >
              {availableDocs.map((doc) => (
                <MenuItem key={doc.id} value={doc.id}>
                  <Checkbox checked={selectedMockDocIds.includes(doc.id)} />
                  <ListItemText primary={doc.label} secondary={`${doc.type} · ${doc.tags.join(', ')}`} />
                </MenuItem>
              ))}
            </TextField>
            <Stack spacing={0.5} sx={{ minWidth: { md: 240 } }}>
              <Typography variant="caption" color="text.secondary">
                Quick actions
              </Typography>
              <Stack spacing={0.5}>
                <Button size="small" variant="text" onClick={handleSelectAll}>
                  Select All
                </Button>
                <Button size="small" variant="text" onClick={handlePaymentsOnly}>
                  Payments Only
                </Button>
                <Button size="small" variant="text" onClick={handleFullPack}>
                  Full Pack
                </Button>
              </Stack>
            </Stack>
          </Stack>
          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Typography variant="caption" color="text.secondary">
                Selected documents
              </Typography>
            </Stack>
            {selectedDocs.length ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {selectedDocs.map((doc) => (
                  <Chip key={doc.id} label={formatDocChipLabel(doc)} size="small" variant="outlined" />
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                No documents selected yet.
              </Typography>
            )}
          </Stack>
          <Stack spacing={1}>
            <Typography variant="subtitle2">Upload Unstructured Docs (Preview)</Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Button variant="outlined" component="label">
                Upload Unstructured Docs (Preview)
                <input
                  hidden
                  multiple
                  type="file"
                  accept=".pdf,.doc,.docx,.txt,.eml,.msg"
                  onChange={handleUploadFiles}
                />
              </Button>
              <Tooltip title="Preview mode: files are not parsed; used for demo wiring.">
                <span>
                  <InfoOutlinedIcon fontSize="small" color="action" />
                </span>
              </Tooltip>
            </Stack>
            {uploadedDocs.length ? (
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {uploadedDocs.map((doc) => (
                  <Chip key={doc.id} label={formatDocChipLabel(doc)} size="small" variant="outlined" />
                ))}
              </Stack>
            ) : (
              <Typography variant="caption" color="text.secondary">
                No uploaded documents yet.
              </Typography>
            )}
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
            <Button variant="contained" onClick={handleRunAnalysis} disabled={loading || selectedDocs.length === 0}>
              {loading ? 'Running...' : '✨ Run Requirement Analysis (Preview)'}
            </Button>
            <Button variant="text" onClick={handleResetDemo}>
              Reset Demo
            </Button>
            {loadSource ? (
              <Typography variant="caption" color="text.secondary">
                {loadSource === 'storage' ? 'Loaded from session storage.' : 'Generated from mock analysis rules.'}
              </Typography>
            ) : null}
            {selectedDocs.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Select one or more documents
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
                    Documents analyzed: {analysis.inputDocs.length}
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Reuse Opportunity
                  </Typography>
                  <Typography variant="h5">{analysis.kpis.reuseOpportunityPct}%</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Discovery time reduction: {analysis.kpis.discoveryTimeReductionPct}%
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
                    Manual error reduction: {analysis.kpis.manualErrorReductionPct}%
                  </Typography>
                </Paper>
              </Grid>
            </Grid>

            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={1.5}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Typography variant="subtitle1">Mapped Capabilities (Apply to Wizard)</Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleApplyCapabilitiesToWizard}
                    disabled={appliedCapabilities.size === 0}
                  >
                    Apply Selected to Wizard (Preview)
                  </Button>
                </Stack>
                {capabilitySuggestions.length ? (
                  <Stack spacing={1}>
                    {capabilitySuggestions.map((capability) => {
                      const key = capability.capabilityId;
                      const label = capabilityLabelLookup.get(key) ?? key;
                      return (
                        <Stack key={capability.capabilityId} direction="row" spacing={1} alignItems="center">
                          <Checkbox
                            checked={appliedCapabilities.has(key)}
                            onChange={() => setAppliedCapabilities((prev) => toggleSetValue(prev, key))}
                          />
                          <Stack spacing={0.25}>
                            <Typography variant="body2">
                              {label} ({Math.round(capability.confidence)}%)
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {capability.notes}
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
                          const label = suggestion.label || validationLabelLookup.get(suggestion.key) || suggestion.key;
                          const disabled = !validationCatalogIds.has(suggestion.key);
                          return (
                            <FormControlLabel
                              key={suggestion.key}
                              control={
                                <Checkbox
                                  checked={appliedValidations.has(suggestion.key)}
                                  onChange={() => setAppliedValidations((prev) => toggleSetValue(prev, suggestion.key))}
                                  disabled={disabled}
                                />
                              }
                              label={
                                <Stack spacing={0.25}>
                                  <Typography variant="body2">
                                    {label}
                                    {disabled ? ' (NEW)' : ''}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {suggestion.impact}
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
                          const label = suggestion.label || enrichmentLabelLookup.get(suggestion.key) || suggestion.key;
                          const disabled = !enrichmentCatalogIds.has(suggestion.key);
                          return (
                            <FormControlLabel
                              key={suggestion.key}
                              control={
                                <Checkbox
                                  checked={appliedEnrichments.has(suggestion.key)}
                                  onChange={() => setAppliedEnrichments((prev) => toggleSetValue(prev, suggestion.key))}
                                  disabled={disabled}
                                />
                              }
                              label={
                                <Stack spacing={0.25}>
                                  <Typography variant="body2">
                                    {label}
                                    {disabled ? ' (NEW)' : ''}
                                  </Typography>
                                  <Typography variant="caption" color="text.secondary">
                                    {suggestion.impact}
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
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                  <TextField
                    select
                    label="Capability"
                    value={capabilityFilter}
                    onChange={handleCapabilityFilterChange}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="ALL">All</MenuItem>
                    {CAPABILITIES.map((capability) => (
                      <MenuItem key={capability.id} value={capability.id}>
                        {capability.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Category"
                    value={categoryFilter}
                    onChange={handleCategoryFilterChange}
                    sx={{ minWidth: 200 }}
                  >
                    <MenuItem value="ALL">All</MenuItem>
                    {categoryOptions.map((category) => (
                      <MenuItem key={category} value={category}>
                        {category}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by ID, title, description"
                    sx={{ minWidth: 240 }}
                  />
                </Stack>
                <TableContainer>
                  <Table size="small" aria-label="Requirements table">
                    <TableHead>
                      <TableRow>
                        <TableCell>Requirement ID</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Priority</TableCell>
                        <TableCell>Suggested Capabilities</TableCell>
                        <TableCell>Confidence</TableCell>
                        <TableCell>Evidence</TableCell>
                        <TableCell>Open Questions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredRequirements.map((req) => {
                        const effectiveCapabilities = requirementsOverrideMap[req.id] ?? req.suggestedCapabilities;
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
                                {effectiveCapabilities.length ? (
                                  effectiveCapabilities.map((capabilityId) => (
                                    <Chip
                                      key={`${req.id}-${capabilityId}`}
                                      label={capabilityLabelLookup.get(capabilityId) ?? capabilityId}
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
                            <TableCell>{Math.round(req.confidence)}%</TableCell>
                            <TableCell>
                              {req.evidence.length ? (
                                <Stack spacing={0.25}>
                                  <Typography variant="caption" color="text.secondary">
                                    {req.evidence[0].docId} {req.evidence[0].cite}
                                  </Typography>
                                  {req.evidence.length > 1 ? (
                                    <Typography variant="caption" color="text.secondary">
                                      +{req.evidence.length - 1} more
                                    </Typography>
                                  ) : null}
                                </Stack>
                              ) : (
                                <Typography variant="caption" color="text.secondary">
                                  No evidence
                                </Typography>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge color="warning" badgeContent={req.openQuestions.length} showZero>
                                <Chip label="Open Questions" size="small" variant="outlined" />
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                {!filteredRequirements.length ? (
                  <Typography variant="body2" color="text.secondary">
                    No requirements match the current filters.
                  </Typography>
                ) : null}
                <Typography variant="caption" color="text.secondary">
                  Click any row to view the full requirement and evidence.
                </Typography>
              </Stack>
            </Paper>
          </Stack>
        ) : (
          <Alert severity="info">Run analysis to see results.</Alert>
        )}
      </SectionCard>

      <SectionCard title="Jira Epics (Preview)" subtitle="Draft epic outputs derived from the selected documents.">
        {analysis ? (
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
                  disabled={!analysis.jiraEpics.length}
                >
                  Export JSON
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleCopyEpicDrafts}
                  disabled={!analysis.jiraEpics.length}
                >
                  Copy
                </Button>
              </Stack>
            </Stack>
            {jiraEpicsByCapability.length ? (
              <Stack spacing={1}>
                {jiraEpicsByCapability.map(([capabilityId, epics]) => {
                  const label = capabilityLabelLookup.get(capabilityId) ?? capabilityId;
                  return (
                    <Accordion key={capabilityId} defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography variant="subtitle2">{label}</Typography>
                          <Chip label={`${epics.length} epics`} size="small" variant="outlined" />
                        </Stack>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Stack spacing={1.5}>
                          {epics.map((epic, index) => (
                            <Paper key={`${capabilityId}-${index}`} variant="outlined" sx={{ p: 1.5 }}>
                              <Stack spacing={1}>
                                <Stack
                                  direction={{ xs: 'column', sm: 'row' }}
                                  spacing={1}
                                  alignItems={{ sm: 'center' }}
                                  justifyContent="space-between"
                                >
                                  <Typography variant="subtitle2">{epic.title}</Typography>
                                  <Chip
                                    label={epic.scope}
                                    size="small"
                                    color={jiraScopeColorLookup[epic.scope]}
                                    variant="outlined"
                                  />
                                </Stack>
                                <Typography variant="body2" color="text.secondary">
                                  {epic.summary}
                                </Typography>
                                <Stack spacing={0.5}>
                                  <Typography variant="caption" color="text.secondary">
                                    Dependencies
                                  </Typography>
                                  {epic.dependencies.length ? (
                                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                                      {epic.dependencies.map((dependency) => (
                                        <Chip
                                          key={`${epic.title}-${dependency}`}
                                          label={capabilityLabelLookup.get(dependency) ?? dependency}
                                          size="small"
                                          variant="outlined"
                                        />
                                      ))}
                                    </Stack>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      None
                                    </Typography>
                                  )}
                                </Stack>
                                <Stack spacing={0.5}>
                                  <Typography variant="caption" color="text.secondary">
                                    Linked Requirements
                                  </Typography>
                                  {epic.linkedRequirements.length ? (
                                    <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                                      {epic.linkedRequirements.map((reqId) => (
                                        <Chip key={`${epic.title}-${reqId}`} label={reqId} size="small" variant="outlined" />
                                      ))}
                                    </Stack>
                                  ) : (
                                    <Typography variant="body2" color="text.secondary">
                                      None
                                    </Typography>
                                  )}
                                </Stack>
                                <Stack spacing={0.5}>
                                  <Typography variant="caption" color="text.secondary">
                                    Acceptance Criteria
                                  </Typography>
                                  <Stack spacing={0.25}>
                                    {epic.acceptanceCriteria.map((item, itemIndex) => (
                                      <Typography key={`${epic.title}-ac-${itemIndex}`} variant="body2" color="text.secondary">
                                        - {item}
                                      </Typography>
                                    ))}
                                  </Stack>
                                </Stack>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </AccordionDetails>
                    </Accordion>
                  );
                })}
              </Stack>
            ) : (
              <Alert severity="info">No epic drafts generated yet.</Alert>
            )}
          </Stack>
        ) : (
          <Alert severity="info">Run requirement analysis to view Jira epic drafts.</Alert>
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
