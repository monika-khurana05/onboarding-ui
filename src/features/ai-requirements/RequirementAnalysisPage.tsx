import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Checkbox,
  Chip,
  Divider,
  Drawer,
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
import * as mammoth from 'mammoth';
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
import { detectCapabilityFromStylusDoc } from '../ai/requirements/capabilityFromStylusDoc';
import { fingerprintEpic } from '../ai/requirements/jiraFingerprint';
import { findByFingerprint, upsertDraft } from '../ai/requirements/jiraDraftRegistry';
import { diffLines, type TextDiff } from '../ai/requirements/simpleDiff';
import { buildJiraEpicFromStylusDoc } from '../ai/requirements/stylusDocToJiraEpic';
import { parseStylusTemplateText, type StylusTemplateSections } from '../ai/requirements/stylusTemplateParser';
import { extractTextFromFile } from '../ai/requirements/fileTextExtractors';
import {
  createEmptyBundle,
  detectArtifactKind,
  parseMappingSummaryJson,
  parseOpenQuestionsMarkdown
} from '../ai/requirements/workspaceArtifactsParser';
import type { MappingSummaryItem, WorkspaceArtifactsBundle } from '../ai/requirements/workspaceArtifactsTypes';
import { generateJiraEpicsFromArtifacts } from '../ai/requirements/jiraFromWorkspaceArtifacts';
import {
  buildJiraDraftExport,
  buildJiraDraftExportFromMany,
  copyToClipboard,
  downloadJson
} from '../ai/requirements/jiraDraftExport';

const capabilityLabelLookup = new Map<CapabilityId, string>(CAPABILITIES.map((item) => [item.id, item.label]));
const validationLabelLookup = new Map(validationCatalog.map((item) => [item.id, item.className]));
const enrichmentLabelLookup = new Map(enrichmentCatalog.map((item) => [item.id, item.className]));
const validationCatalogIds = new Set(validationCatalog.map((item) => item.id));
const enrichmentCatalogIds = new Set(enrichmentCatalog.map((item) => item.id));
const capabilityIdSet = new Set(CAPABILITIES.map((item) => item.id));
const requirementsResultKey = 'ai.requirements.v1.lastResult';
const requirementsSelectedCapabilitiesKey = 'ai.requirements.v1.selectedCapabilities';
const openQuestionAnswersKey = 'ai.requirements.v1.openQuestionAnswers';
const workspaceOutputAccept = '.json,.md,.markdown,.txt,.docx';
const stylusDocAccept = '.docx,.txt,.md,.markdown,.json';
const ASK_WORKSPACES_URL = '<<PUT_YOUR_INTERNAL_URL_HERE>>';
type FlowSelection = 'INCOMING' | 'OUTGOING' | '';
type UploadMode = 'WORKSPACE' | 'STYLUS';
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

type StylusDocState = {
  fileName: string;
  uploadedAt: string;
  sections: StylusTemplateSections;
  detectedCapabilityId: CapabilityId | null;
  detectedConfidence: number;
  detectedReason: string;
  selectedCapabilityId: CapabilityId | null;
  warnings: string[];
  epic?: JiraEpicDraft;
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

function loadOpenQuestionAnswers(): Record<string, string> {
  if (typeof window === 'undefined') {
    return {};
  }
  try {
    const raw = sessionStorage.getItem(openQuestionAnswersKey);
    if (!raw) {
      return {};
    }
    return JSON.parse(raw) as Record<string, string>;
  } catch (error) {
    console.warn('Failed to load open question answers.', error);
    return {};
  }
}

function saveOpenQuestionAnswers(answers: Record<string, string>) {
  if (typeof window === 'undefined') {
    return;
  }
  try {
    sessionStorage.setItem(openQuestionAnswersKey, JSON.stringify(answers));
  } catch (error) {
    console.warn('Failed to save open question answers.', error);
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

function getFileExtension(fileName: string) {
  const parts = fileName.toLowerCase().split('.');
  return parts.length > 1 ? parts[parts.length - 1] : '';
}

function appendWarning(warnings: string[], warning: string) {
  if (!warning) {
    return warnings;
  }
  if (warnings.includes(warning)) {
    return warnings;
  }
  return [...warnings, warning];
}

async function extractStylusTextFromFile(file: File): Promise<{ text: string; warnings: string[] }> {
  const extension = getFileExtension(file.name);
  if (extension === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });
    const messages = (result as { messages?: Array<{ message: string }> }).messages ?? [];
    const warnings = messages.map((message) => `DOCX: ${message.message}`);
    return { text: result.value ?? '', warnings };
  }
  if (extension === 'pdf') {
    return { text: '', warnings: ['PDF extraction is not supported yet. Upload DOCX, TXT, or Markdown files.'] };
  }
  if (extension === 'json' || extension === 'md' || extension === 'markdown' || extension === 'txt' || !extension) {
    const text = await file.text();
    return { text, warnings: [] };
  }
  const text = await file.text();
  return { text, warnings: [`Unrecognized file type ".${extension}" read as plain text.`] };
}

function buildStylusAnalysisResult(args: {
  countryCode: string;
  epic: JiraEpicDraft;
}): RequirementAnalysisResult {
  return {
    countryCode: args.countryCode,
    inputDocs: [],
    kpis: {
      requirementsFound: 0,
      reuseOpportunityPct: 0,
      discoveryTimeReductionPct: 0,
      ambiguitiesCount: 0,
      manualErrorReductionPct: 0
    },
    mappedCapabilities: [],
    validationSuggestions: [],
    enrichmentSuggestions: [],
    requirements: [],
    jiraEpics: [args.epic]
  };
}

export function RequirementAnalysisPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const flowParam = searchParams.get('flow');
  const initialFlow: FlowSelection =
    flowParam === 'OUTGOING' ? 'OUTGOING' : flowParam === 'INCOMING' ? 'INCOMING' : '';
  const initialResult = useMemo(() => loadRequirementsResult(), []);
  const initialAnswers = useMemo(() => loadOpenQuestionAnswers(), []);
  const [analysis, setAnalysis] = useState<RequirementAnalysisResult | null>(initialResult ?? null);
  const [uploadMode, setUploadMode] = useState<UploadMode>('WORKSPACE');
  const [countryCode, setCountryCode] = useState(() => initialResult?.countryCode ?? '');
  const [region, setRegion] = useState<(typeof REGION_OPTIONS)[number] | ''>('');
  const [flowSelection, setFlowSelection] = useState<FlowSelection>(initialFlow);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadMeta, setUploadMeta] = useState<WorkspaceUploadMeta | null>(null);
  const [bundle, setBundle] = useState<WorkspaceArtifactsBundle | null>(null);
  const [openQuestionAnswers, setOpenQuestionAnswers] = useState<Record<string, string>>(initialAnswers);
  const [activeTab, setActiveTab] = useState<'MAPPING' | 'SUMMARY' | 'GAP' | 'QUESTIONS' | 'JIRA'>('MAPPING');
  const [jiraCreated, setJiraCreated] = useState(false);
  const [stylusDocs, setStylusDocs] = useState<StylusDocState[]>([]);
  const [stylusResults, setStylusResults] = useState<RequirementAnalysisResult[]>([]);
  const [registryNotice, setRegistryNotice] = useState<string[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null);
  const [isEpicDrawerOpen, setIsEpicDrawerOpen] = useState(false);
  const [selectedEpicIndex, setSelectedEpicIndex] = useState<number | null>(null);
  const [isMappingDrawerOpen, setIsMappingDrawerOpen] = useState(false);
  const [selectedMappingItem, setSelectedMappingItem] = useState<MappingSummaryItem | null>(null);
  const [openQuestionText, setOpenQuestionText] = useState('');
  const [appliedCapabilities, setAppliedCapabilities] = useState<Set<CapabilityId>>(new Set());
  const [appliedValidations, setAppliedValidations] = useState<Set<string>>(new Set());
  const [appliedEnrichments, setAppliedEnrichments] = useState<Set<string>>(new Set());
  const [requirementsOverrideMap, setRequirementsOverrideMap] = useState<Record<string, CapabilityId[]>>({});
  const [toast, setToast] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityId | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<ExtractedRequirement['category'] | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [classificationFilter, setClassificationFilter] = useState<string>('ALL');
  const [minConfidence, setMinConfidence] = useState(0);

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

  useEffect(() => {
    setError(null);
    setIsDrawerOpen(false);
    setIsEpicDrawerOpen(false);
    setIsMappingDrawerOpen(false);
    setSelectedEpicIndex(null);
    setSelectedRequirementId(null);
    setSelectedMappingItem(null);
    setRegistryNotice([]);
    setBundle(null);
    setJiraCreated(false);
    setActiveTab('MAPPING');
  }, [uploadMode]);

  const isWorkspaceMode = uploadMode === 'WORKSPACE';
  const isStylusMode = uploadMode === 'STYLUS';
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
  const isWorkspaceUploadReady = Boolean(countrySelectValue && region && isFlowReady);
  const isStylusUploadReady = Boolean(countrySelectValue);
  const isUploadReady = isWorkspaceMode ? isWorkspaceUploadReady : isStylusUploadReady;
  const hasWorkspaceAnalysis = Boolean(analysis);
  const hasBundle = Boolean(bundle);
  const hasStylusDocs = stylusDocs.length > 0;
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

  const categoryOptions = requirementCategories;
  const mappingItems = useMemo(
    () => bundle?.files.mappingSummary?.json.classification_results ?? [],
    [bundle]
  );
  const openQuestions = useMemo(() => bundle?.files.openQuestions?.questions ?? [], [bundle]);
  const mappingCounts = useMemo(() => {
    return mappingItems.reduce<Record<string, number>>((acc, item) => {
      const key = (item.classification || 'UNSPECIFIED').toUpperCase();
      acc[key] = (acc[key] ?? 0) + 1;
      return acc;
    }, {});
  }, [mappingItems]);
  const classificationOptions = useMemo(
    () => ['ALL', ...Object.keys(mappingCounts).sort()],
    [mappingCounts]
  );
  const filteredMappingItems = useMemo(() => {
    return mappingItems.filter((item) => {
      const classification = (item.classification || '').toUpperCase();
      if (classificationFilter !== 'ALL' && classification !== classificationFilter) {
        return false;
      }
      const confidence = item.confidence_score ?? 0;
      return confidence >= minConfidence;
    });
  }, [mappingItems, classificationFilter, minConfidence]);
  const unansweredOpenQuestions = useMemo(
    () =>
      openQuestions.filter((question) => {
        const answer = openQuestionAnswers[question.id];
        return !answer || !answer.trim();
      }),
    [openQuestions, openQuestionAnswers]
  );
  const allQuestionsAnswered = openQuestions.length === 0 || unansweredOpenQuestions.length === 0;
  const canCreateJira = Boolean(bundle?.files.mappingSummary) && allQuestionsAnswered;
  const jiraEpics = analysis?.jiraEpics ?? [];
  const highImpactDeltas = useMemo(() => {
    const text = bundle?.files.gapAnalysis?.markdown ?? '';
    if (!text) {
      return [] as Array<{ id?: string; line: string }>;
    }
    return text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => /classification:\s*(net_new|global_modify)/i.test(line))
      .map((line) => {
        const idMatch = line.match(/([A-Z]{2,3}-[A-Z0-9_-]+)/);
        return { id: idMatch?.[1], line };
      });
  }, [bundle]);

  const activeRequirement = useMemo(
    () => analysis?.requirements.find((req) => req.id === selectedRequirementId) ?? null,
    [analysis, selectedRequirementId]
  );
  const stylusEpics = useMemo(() => stylusResults.flatMap((result) => result.jiraEpics), [stylusResults]);
  const stylusSelectedCount = useMemo(
    () => stylusDocs.filter((doc) => Boolean(doc.selectedCapabilityId)).length,
    [stylusDocs]
  );
  const activeEpicList = useMemo(
    () => (isStylusMode ? stylusEpics : analysis?.jiraEpics ?? []),
    [analysis?.jiraEpics, isStylusMode, stylusEpics]
  );
  const activeEpic = useMemo(() => {
    if (selectedEpicIndex === null) {
      return null;
    }
    return activeEpicList[selectedEpicIndex] ?? null;
  }, [activeEpicList, selectedEpicIndex]);
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
  const handleOpenEpicDetails = useCallback((index: number) => {
    setSelectedEpicIndex(index);
    setIsEpicDrawerOpen(true);
  }, []);
  const handleOpenMappingDetails = useCallback((item: MappingSummaryItem) => {
    setSelectedMappingItem(item);
    setIsMappingDrawerOpen(true);
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

  const handleClassificationFilterChange = useCallback((event: SelectChangeEvent) => {
    setClassificationFilter(event.target.value);
  }, []);

  const handleMinConfidenceChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const value = Number(event.target.value);
    setMinConfidence(Number.isFinite(value) ? value : 0);
  }, []);

  const handleOpenQuestionAnswerChange = useCallback((id: string, value: string) => {
    setOpenQuestionAnswers((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSaveOpenQuestionAnswers = useCallback(() => {
    saveOpenQuestionAnswers(openQuestionAnswers);
    setToast({ message: 'Open question answers saved.', severity: 'success' });
  }, [openQuestionAnswers]);

  const handleUploadWorkspaceArtifacts = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) {
        return;
      }
      if (!isWorkspaceUploadReady || !isValidFlow(flowSelection)) {
        setError('Select country, region, and flow before uploading.');
        event.target.value = '';
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const uploadedAtIso = new Date().toISOString();
        const countryCode = normalizeCountryCode(countrySelectValue || effectiveCountryCode || 'UNKNOWN');
        const nextBundle = createEmptyBundle({
          countryCode,
          region,
          flow: flowSelection,
          uploadedAtIso
        });
        const warnings: string[] = [];

        for (const file of files) {
          const { text, warnings: fileWarnings } = await extractTextFromFile(file);
          fileWarnings.forEach((warning) => warnings.push(`${file.name}: ${warning}`));
          const kind = detectArtifactKind(file.name, text);
          if (!text) {
            warnings.push(`${file.name}: No text extracted.`);
            continue;
          }
          if (kind === 'unknown') {
            warnings.push(`${file.name}: Unrecognized workspace artifact.`);
            continue;
          }
          try {
            if (kind === 'mappingSummary') {
              const json = parseMappingSummaryJson(text);
              nextBundle.files.mappingSummary = { fileName: file.name, raw: text, json };
            } else if (kind === 'overallSummary') {
              nextBundle.files.overallSummary = { fileName: file.name, raw: text, markdown: text };
            } else if (kind === 'gapAnalysis') {
              nextBundle.files.gapAnalysis = { fileName: file.name, raw: text, markdown: text };
            } else if (kind === 'openQuestions') {
              const questions = parseOpenQuestionsMarkdown(text);
              nextBundle.files.openQuestions = {
                fileName: file.name,
                raw: text,
                markdown: text,
                questions
              };
            }
          } catch (parseError) {
            warnings.push(
              `${file.name}: ${parseError instanceof Error ? parseError.message : 'Failed to parse file.'}`
            );
          }
        }

        setClassificationFilter('ALL');
        setMinConfidence(0);
        setBundle(nextBundle);
        setAnalysis(null);
        setJiraCreated(false);
        setActiveTab('MAPPING');
        setUploadMeta({
          fileName: `Bundle (${files.length} files)`,
          uploadedAt: uploadedAtIso,
          warnings
        });

        if (nextBundle.files.openQuestions?.questions?.length) {
          const saved = loadOpenQuestionAnswers();
          const nextAnswers: Record<string, string> = {};
          nextBundle.files.openQuestions.questions.forEach((question) => {
            nextAnswers[question.id] = openQuestionAnswers[question.id] ?? saved[question.id] ?? '';
          });
          setOpenQuestionAnswers(nextAnswers);
        } else {
          setOpenQuestionAnswers({});
        }
      } catch (parseError) {
        console.warn('Failed to parse workspace artifacts.', parseError);
        setError(parseError instanceof Error ? parseError.message : 'Failed to parse workspace artifacts.');
      } finally {
        setLoading(false);
        event.target.value = '';
      }
    },
    [
      countrySelectValue,
      effectiveCountryCode,
      flowSelection,
      isWorkspaceUploadReady,
      openQuestionAnswers,
      region
    ]
  );

  const handleUploadStylusDocs = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      if (!files.length) {
        return;
      }
      if (!isStylusUploadReady) {
        setError('Select a country code before uploading template docs.');
        event.target.value = '';
        return;
      }
      setError(null);
      setLoading(true);
      try {
        const nextDocs: StylusDocState[] = [];
        for (const file of files) {
          const extracted = await extractStylusTextFromFile(file);
          const sections = parseStylusTemplateText(extracted.text);
          const detection = detectCapabilityFromStylusDoc(sections);
          const warnings = [...sections.warnings, ...extracted.warnings];
          nextDocs.push({
            fileName: file.name,
            uploadedAt: new Date().toISOString(),
            sections,
            detectedCapabilityId: detection.capabilityId,
            detectedConfidence: detection.confidence,
            detectedReason: detection.reason,
            selectedCapabilityId: detection.capabilityId,
            warnings
          });
        }
        setStylusDocs((prev) => [...prev, ...nextDocs]);
        setStylusResults([]);
        setRegistryNotice([]);
        setToast({
          message: `Parsed ${nextDocs.length} template doc${nextDocs.length === 1 ? '' : 's'}.`,
          severity: 'success'
        });
      } catch (parseError) {
        console.warn('Failed to parse template docs.', parseError);
        setError(parseError instanceof Error ? parseError.message : 'Failed to parse template docs.');
      } finally {
        setLoading(false);
        event.target.value = '';
      }
    },
    [isStylusUploadReady]
  );

  const handleClearWorkspaceOutput = useCallback(() => {
    try {
      sessionStorage.removeItem(requirementsResultKey);
      sessionStorage.removeItem(requirementsSelectedCapabilitiesKey);
      sessionStorage.removeItem(openQuestionAnswersKey);
    } catch (error) {
      console.warn('Failed to clear workspace session storage.', error);
    }
    setAnalysis(null);
    setBundle(null);
    setOpenQuestionAnswers({});
    setJiraCreated(false);
    setActiveTab('MAPPING');
    setCountryCode('');
    setRegion('');
    setFlowSelection(initialFlow);
    setUploadMeta(null);
    setError(null);
    setIsDrawerOpen(false);
    setIsEpicDrawerOpen(false);
    setIsMappingDrawerOpen(false);
    setSelectedRequirementId(null);
    setSelectedEpicIndex(null);
    setSelectedMappingItem(null);
    setOpenQuestionText('');
    setAppliedCapabilities(new Set());
    setAppliedValidations(new Set());
    setAppliedEnrichments(new Set());
    setRequirementsOverrideMap({});
    setCapabilityFilter('ALL');
    setCategoryFilter('ALL');
    setSearchQuery('');
    setClassificationFilter('ALL');
    setMinConfidence(0);
    setToast({ message: 'Ask AI output cleared.', severity: 'success' });
  }, []);

  const handleClearStylusOutput = useCallback(() => {
    setStylusDocs([]);
    setStylusResults([]);
    setError(null);
    setIsEpicDrawerOpen(false);
    setSelectedEpicIndex(null);
    setRegistryNotice([]);
    setToast({ message: 'Template docs cleared.', severity: 'success' });
  }, []);

  const handleStylusCapabilityOverride = useCallback((index: number, value: string) => {
    setStylusDocs((prev) =>
      prev.map((doc, docIndex) =>
        docIndex === index
          ? { ...doc, selectedCapabilityId: value ? (value as CapabilityId) : null, epic: undefined }
          : doc
      )
    );
    setStylusResults([]);
  }, []);

  const buildInScopeTextFromEpic = useCallback((epic: JiraEpicDraft) => {
    if (!epic.children?.length) {
      return '';
    }
    return epic.children
      .map((child) => child.description?.split('\n')[0]?.trim() ?? '')
      .filter((line) => line.length > 0)
      .join('\n');
  }, []);

  const handleGenerateStylusDrafts = useCallback(() => {
    if (!stylusDocs.length) {
      return;
    }
    const countryToken = effectiveCountryCode || 'UNKNOWN';
    let missingSelections = 0;
    const updateNotices: string[] = [];
    const epicByFingerprint = new Map<string, JiraEpicDraft>();
    const nextDocs = stylusDocs.map((doc) => {
      const warnings = doc.warnings;
      if (!doc.selectedCapabilityId) {
        missingSelections += 1;
        return {
          ...doc,
          warnings: appendWarning(warnings, 'Select a capability to generate a Jira epic.')
        };
      }
      const epic = buildJiraEpicFromStylusDoc({
        sections: doc.sections,
        capabilityId: doc.selectedCapabilityId,
        countryCode: countryToken,
        sourceFileName: doc.fileName,
        detectedCapabilityConfidence: doc.detectedConfidence
      });
      const fingerprint = fingerprintEpic({
        countryCode: countryToken,
        capabilityId: epic.capabilityId,
        epicTitle: epic.title
      });
      const existing = findByFingerprint(fingerprint);
      const updatedEpic: JiraEpicDraft = {
        ...epic,
        fingerprint,
        updatedFromFingerprint: existing ? fingerprint : undefined,
        diff: existing
          ? {
              description: diffLines(existing.descriptionText ?? '', epic.descriptionText ?? ''),
              acceptance: diffLines(existing.acceptanceCriteriaText ?? '', epic.acceptanceCriteriaText ?? ''),
              inScope: diffLines(buildInScopeTextFromEpic(existing), doc.sections.inScopeText ?? '')
            }
          : undefined
      };
      if (existing) {
        const capabilityLabel = capabilityLabelLookup.get(epic.capabilityId) ?? epic.capabilityId;
        updateNotices.push(`Duplicate found: will UPDATE existing draft for ${capabilityLabel} / ${countryToken}`);
        upsertDraft(updatedEpic, 'update');
      } else {
        upsertDraft(updatedEpic, 'create');
      }
      epicByFingerprint.set(fingerprint, updatedEpic);
      return { ...doc, epic: updatedEpic };
    });

    const nextResults = Array.from(epicByFingerprint.values()).map((epic) =>
      buildStylusAnalysisResult({ countryCode: countryToken, epic })
    );

    setStylusDocs(nextDocs);
    setStylusResults(nextResults);
    setRegistryNotice(updateNotices);

    if (missingSelections > 0) {
      setError(`Select a capability for ${missingSelections} doc${missingSelections === 1 ? '' : 's'} to generate drafts.`);
    } else {
      setError(null);
      setToast({
        message: `Generated ${nextResults.length} Jira draft${nextResults.length === 1 ? '' : 's'}.`,
        severity: 'success'
      });
    }
  }, [buildInScopeTextFromEpic, effectiveCountryCode, stylusDocs]);

  const handleCreateJiraFromBundle = useCallback(() => {
    if (!bundle?.files.mappingSummary) {
      setError('Upload mapping_summary.json before creating Jira drafts.');
      return;
    }
    if (!allQuestionsAnswered) {
      setError('Answer all open questions before creating Jira drafts.');
      return;
    }
    const generatedEpics = generateJiraEpicsFromArtifacts({ bundle, openQuestionAnswers });
    const nextAnalysis: RequirementAnalysisResult = {
      countryCode: bundle.meta.countryCode,
      inputDocs: [],
      kpis: {
        requirementsFound: mappingItems.length,
        reuseOpportunityPct: 0,
        discoveryTimeReductionPct: 0,
        ambiguitiesCount: openQuestions.length,
        manualErrorReductionPct: 0
      },
      mappedCapabilities: [],
      validationSuggestions: [],
      enrichmentSuggestions: [],
      requirements: [],
      jiraEpics: generatedEpics
    };
    setError(null);
    setAnalysis(nextAnalysis);
    setCountryCode(bundle.meta.countryCode);
    setJiraCreated(true);
    setActiveTab('JIRA');
    setToast({ message: 'Jira drafts created (UI-only).', severity: 'success' });
  }, [allQuestionsAnswered, bundle, mappingItems.length, openQuestionAnswers, openQuestions.length]);

  const renderDiffSection = useCallback((label: string, diff?: TextDiff) => {
    if (!diff) {
      return null;
    }
    const hasChanges = diff.added.length > 0 || diff.removed.length > 0;
    if (!hasChanges) {
      return null;
    }
    return (
      <Stack spacing={0.5}>
        <Typography variant="subtitle2">{label}</Typography>
        {diff.added.length ? (
          <Stack spacing={0.25}>
            <Chip label={`Added (${diff.added.length})`} color="success" size="small" />
            {diff.added.map((line, index) => (
              <Typography key={`${label}-added-${index}`} variant="body2" color="text.secondary">
                + {line}
              </Typography>
            ))}
          </Stack>
        ) : null}
        {diff.removed.length ? (
          <Stack spacing={0.25}>
            <Chip label={`Removed (${diff.removed.length})`} color="error" size="small" />
            {diff.removed.map((line, index) => (
              <Typography key={`${label}-removed-${index}`} variant="body2" color="text.secondary">
                - {line}
              </Typography>
            ))}
          </Stack>
        ) : null}
      </Stack>
    );
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
    const token = effectiveCountryCode || 'requirements';
    if (isStylusMode) {
      if (!stylusResults.length) {
        return;
      }
      const payload = buildJiraDraftExportFromMany(
        stylusResults.map((result) => ({ ...result, countryCode: token }))
      );
      downloadJson(`jira-epics-${token}.json`, payload);
      return;
    }
    if (!analysis) {
      return;
    }
    const payload = buildJiraDraftExport({ ...analysis, countryCode: token });
    downloadJson(`jira-epics-${token}.json`, payload);
  }, [analysis, effectiveCountryCode, isStylusMode, stylusResults]);

  const handleCopyEpicDrafts = useCallback(async () => {
    try {
      const token = effectiveCountryCode || 'requirements';
      if (isStylusMode) {
        if (!stylusResults.length) {
          return;
        }
        const payload = buildJiraDraftExportFromMany(
          stylusResults.map((result) => ({ ...result, countryCode: token }))
        );
        await copyToClipboard(payload);
        setToast({ message: 'Copied Jira draft payload to clipboard.', severity: 'success' });
        return;
      }
      if (!analysis) {
        return;
      }
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
  }, [analysis, effectiveCountryCode, isStylusMode, stylusResults]);

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
        subtitle={
          isWorkspaceMode
            ? 'Use Ask AI to analyze PDFs/Word/Jira exports and generate structured artifacts.'
            : 'Upload Stylus template docs and generate Jira epics per capability.'
        }
      >
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            {isWorkspaceMode
              ? 'Upload the Ask AI artifact bundle and we’ll generate capability-wise Jira epics. Required metadata is captured for future persistence.'
              : 'Upload template docs and we’ll extract sections, detect capabilities, and build Jira drafts per capability.'}
          </Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
            <Chip
              label={isUploadReady ? 'Setup complete' : 'Setup required'}
              color={isUploadReady ? 'success' : 'warning'}
              variant="outlined"
              size="small"
            />
            <Chip
              label={
                isWorkspaceMode
                  ? hasBundle
                    ? 'Workspace artifacts loaded'
                    : analysis
                      ? 'Jira drafts ready'
                      : 'No output yet'
                  : hasStylusDocs
                    ? `${stylusDocs.length} template doc${stylusDocs.length === 1 ? '' : 's'} loaded`
                    : 'No template docs yet'
              }
              color={
                isWorkspaceMode ? (hasBundle || analysis ? 'success' : 'default') : hasStylusDocs ? 'success' : 'default'
              }
              variant="outlined"
              size="small"
            />
            <Chip
              label={`Mode: ${isWorkspaceMode ? 'Workspace JSON output' : 'Stylus Template Doc output'}`}
              variant="outlined"
              size="small"
            />
            {isWorkspaceMode && uploadMeta ? (
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
              color={region ? 'default' : isWorkspaceMode ? 'warning' : 'default'}
            />
            <Chip
              label={`Flow: ${isFlowReady ? flowSelection : '—'}`}
              variant="outlined"
              size="small"
              color={isFlowReady ? 'default' : isWorkspaceMode ? 'warning' : 'default'}
            />
          </Stack>
          {isWorkspaceMode ? (
            hasBundle ? (
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Mapping Items
                    </Typography>
                    <Typography variant="h5">{mappingItems.length}</Typography>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="caption" color="text.secondary">
                      Open Questions
                    </Typography>
                    <Typography variant="h5">{openQuestions.length}</Typography>
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
            ) : hasWorkspaceAnalysis ? (
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
                Upload workspace artifacts to see the summary and Jira drafts.
              </Alert>
            )
          ) : hasStylusDocs ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Template Docs
                  </Typography>
                  <Typography variant="h5">{stylusDocs.length}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Capabilities Selected
                  </Typography>
                  <Typography variant="h5">{stylusSelectedCount}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Jira Drafts
                  </Typography>
                  <Typography variant="h5">{stylusEpics.length}</Typography>
                </Paper>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info" variant="outlined">
              Upload template docs to see the summary and Jira drafts.
            </Alert>
          )}
        </Stack>
      </SectionCard>

      <SectionCard
        title="Required Setup"
        subtitle={
          isWorkspaceMode
            ? 'These fields will be stored with the Ask AI output.'
            : 'These fields are used to tag template doc exports.'
        }
      >
        <Stack spacing={2}>
          <TextField
            select
            fullWidth
            label="Mode"
            value={uploadMode}
            onChange={(event) => setUploadMode(event.target.value as UploadMode)}
            helperText="Choose the input type you are uploading."
          >
            <MenuItem value="WORKSPACE">Workspace JSON output</MenuItem>
            <MenuItem value="STYLUS">Stylus Template Doc output</MenuItem>
          </TextField>
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
                  isWorkspaceMode
                    ? analysis?.countryCode && analysis.countryCode !== 'UNKNOWN'
                      ? 'Loaded from Ask AI output; you can override if needed.'
                      : 'Required: select a country code before upload.'
                    : 'Required: used in Jira summaries and exports.'
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
                required={isWorkspaceMode}
                disabled={!isWorkspaceMode}
                value={region}
                onChange={(event) => setRegion(event.target.value as (typeof REGION_OPTIONS)[number] | '')}
                helperText={isWorkspaceMode ? 'Required: tag the analysis to a region.' : 'Optional for template docs.'}
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
                required={isWorkspaceMode}
                disabled={!isWorkspaceMode}
                value={flowSelection}
                onChange={(event) => setFlowSelection(event.target.value as FlowSelection)}
                helperText={isWorkspaceMode ? 'Required: pick the processing flow.' : 'Optional for template docs.'}
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
        </Stack>
      </SectionCard>

      <SectionCard
        title={isWorkspaceMode ? 'Ask AI' : 'Stylus Template Docs'}
        subtitle={
          isWorkspaceMode
            ? 'Run Ask AI and upload the artifact bundle.'
            : 'Upload Stylus template docs and generate per-capability Jira drafts.'
        }
      >
        <Stack spacing={2}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
            justifyContent="space-between"
          >
            <Stack spacing={0.5}>
              <Typography variant="subtitle1">{isWorkspaceMode ? 'Ask AI' : 'Template Docs'}</Typography>
            </Stack>
            {isWorkspaceMode ? (
              <Button variant="contained" href={ASK_WORKSPACES_URL} target="_blank" rel="noreferrer">
                Open Ask AI
              </Button>
            ) : null}
          </Stack>
          {isWorkspaceMode ? (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, borderStyle: 'dashed' }}>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  alignItems={{ sm: 'center' }}
                  justifyContent="space-between"
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Workspace Artifact Bundle Upload (recommended)</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Upload mapping summary, overall summary, gap analysis, and open questions together.
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Accepted: JSON, Markdown, TXT, DOCX. Multiple files supported.
                    </Typography>
                  </Stack>
                  <Button variant="outlined" component="label" disabled={loading || !isUploadReady}>
                    {loading ? 'Parsing...' : 'Upload Workspace Artifact Bundle'}
                    <input
                      hidden
                      type="file"
                      accept={workspaceOutputAccept}
                      multiple
                      onChange={handleUploadWorkspaceArtifacts}
                      disabled={loading || !isUploadReady}
                    />
                  </Button>
                </Stack>
              </Paper>
            </Stack>
          ) : (
            <Paper variant="outlined" sx={{ p: 2, borderStyle: 'dashed' }}>
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                alignItems={{ sm: 'center' }}
                justifyContent="space-between"
              >
                <Stack spacing={0.5}>
                  <Typography variant="subtitle2">Upload Template Docs</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isUploadReady ? 'Ready to upload template docs.' : 'Select a country to enable uploads.'}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Accepted: DOCX, TXT, Markdown, JSON. Multiple files supported.
                  </Typography>
                </Stack>
                <Button variant="outlined" component="label" disabled={loading || !isUploadReady}>
                  {loading ? 'Parsing...' : 'Upload Template Docs'}
                  <input
                    hidden
                    type="file"
                    accept={stylusDocAccept}
                    multiple
                    onChange={handleUploadStylusDocs}
                    disabled={loading || !isUploadReady}
                  />
                </Button>
              </Stack>
            </Paper>
          )}
          {isWorkspaceMode && uploadMeta ? (
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
          {isWorkspaceMode && bundle ? (
            <Stack spacing={0.5}>
              <Typography variant="caption" color="text.secondary">
                Artifacts loaded
              </Typography>
              <Stack direction="row" spacing={0.5} useFlexGap flexWrap="wrap">
                {bundle.files.mappingSummary ? (
                  <Chip label={`Mapping: ${bundle.files.mappingSummary.fileName}`} size="small" variant="outlined" />
                ) : null}
                {bundle.files.overallSummary ? (
                  <Chip label={`Summary: ${bundle.files.overallSummary.fileName}`} size="small" variant="outlined" />
                ) : null}
                {bundle.files.gapAnalysis ? (
                  <Chip label={`Gap: ${bundle.files.gapAnalysis.fileName}`} size="small" variant="outlined" />
                ) : null}
                {bundle.files.openQuestions ? (
                  <Chip
                    label={`Open Questions: ${bundle.files.openQuestions.fileName}`}
                    size="small"
                    variant="outlined"
                  />
                ) : null}
              </Stack>
            </Stack>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </SectionCard>

      {isWorkspaceMode ? (
        <SectionCard title="Workspace Outputs" subtitle="Review uploaded artifacts and validate content.">
          {hasBundle ? (
            <Stack spacing={2}>
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                {(['MAPPING', 'SUMMARY', 'GAP', 'QUESTIONS', 'JIRA'] as const).map((tab) => (
                  <Button
                    key={tab}
                    size="small"
                    variant={activeTab === tab ? 'contained' : 'outlined'}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab === 'MAPPING'
                      ? 'Mapping Summary'
                      : tab === 'SUMMARY'
                        ? 'Overall Summary'
                        : tab === 'GAP'
                          ? 'Gap Analysis'
                          : tab === 'QUESTIONS'
                            ? 'Open Questions'
                            : 'Jira Blotter'}
                  </Button>
                ))}
              </Stack>

              {activeTab === 'MAPPING' ? (
                bundle.files.mappingSummary ? (
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
                      {Object.entries(mappingCounts).map(([key, value]) => (
                        <Chip key={key} label={`${key}: ${value}`} size="small" variant="outlined" />
                      ))}
                      {!Object.keys(mappingCounts).length ? (
                        <Chip label="No classifications found" size="small" variant="outlined" />
                      ) : null}
                    </Stack>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
                      <TextField
                        select
                        label="Classification"
                        size="small"
                        value={classificationFilter}
                        onChange={handleClassificationFilterChange}
                        sx={{ minWidth: 200 }}
                      >
                        {classificationOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </TextField>
                      <TextField
                        label="Min Confidence"
                        size="small"
                        type="number"
                        value={minConfidence}
                        onChange={handleMinConfidenceChange}
                        sx={{ minWidth: 160 }}
                        inputProps={{ min: 0 }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Showing {filteredMappingItems.length} of {mappingItems.length}
                      </Typography>
                    </Stack>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small" aria-label="Mapping summary">
                        <TableHead>
                          <TableRow>
                            <TableCell>Requirement Id</TableCell>
                            <TableCell>Matched Global Capability</TableCell>
                            <TableCell>Classification</TableCell>
                            <TableCell>Confidence</TableCell>
                            <TableCell>Requirement Description</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredMappingItems.map((item, index) => {
                            const description = item.country_requirement_description || '';
                            const short =
                              description.length > 110 ? `${description.slice(0, 107)}...` : description;
                            return (
                              <TableRow
                                key={`${item.country_requirement_id}-${index}`}
                                hover
                                onClick={() => handleOpenMappingDetails(item)}
                                sx={{ cursor: 'pointer' }}
                              >
                                <TableCell>{item.country_requirement_id}</TableCell>
                                <TableCell>{item.matched_global_capability_id ?? '—'}</TableCell>
                                <TableCell>{item.classification ?? '—'}</TableCell>
                                <TableCell>
                                  {item.confidence_score !== undefined ? item.confidence_score : 'n/a'}
                                </TableCell>
                                <TableCell>{short || '—'}</TableCell>
                              </TableRow>
                            );
                          })}
                          {!filteredMappingItems.length ? (
                            <TableRow>
                              <TableCell colSpan={5}>No mapping rows match the current filters.</TableCell>
                            </TableRow>
                          ) : null}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Stack>
                ) : (
                  <Alert severity="info" variant="outlined">
                    Upload mapping_summary.json to view mapping details.
                  </Alert>
                )
              ) : null}

              {activeTab === 'SUMMARY' ? (
                bundle.files.overallSummary ? (
                  <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: 'auto' }}>
                    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                      {bundle.files.overallSummary.markdown}
                    </Typography>
                  </Paper>
                ) : (
                  <Alert severity="info" variant="outlined">
                    Upload overall_result_summary.md to view the summary.
                  </Alert>
                )
              ) : null}

              {activeTab === 'GAP' ? (
                <Stack spacing={2}>
                  {bundle.files.gapAnalysis ? (
                    <Paper variant="outlined" sx={{ p: 2, maxHeight: 360, overflow: 'auto' }}>
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                        {bundle.files.gapAnalysis.markdown}
                      </Typography>
                    </Paper>
                  ) : (
                    <Alert severity="info" variant="outlined">
                      Upload gap_analysis.md to view the analysis.
                    </Alert>
                  )}
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2">High Impact Deltas</Typography>
                    {highImpactDeltas.length ? (
                      <Table size="small" aria-label="High impact deltas">
                        <TableHead>
                          <TableRow>
                            <TableCell>Requirement Id</TableCell>
                            <TableCell>Line</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {highImpactDeltas.map((delta, index) => (
                            <TableRow key={`${delta.id ?? 'delta'}-${index}`}>
                              <TableCell>{delta.id ?? '—'}</TableCell>
                              <TableCell>{delta.line}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No NET_NEW or GLOBAL_MODIFY lines detected.
                      </Typography>
                    )}
                  </Paper>
                </Stack>
              ) : null}

              {activeTab === 'QUESTIONS' ? (
                openQuestions.length ? (
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
                      <Chip
                        label={allQuestionsAnswered ? 'All answered' : `${unansweredOpenQuestions.length} unanswered`}
                        color={allQuestionsAnswered ? 'success' : 'warning'}
                        size="small"
                        variant="outlined"
                      />
                      <Button size="small" variant="outlined" onClick={handleSaveOpenQuestionAnswers}>
                        Save Answers
                      </Button>
                    </Stack>
                    {openQuestions.map((question) => {
                      const answer = openQuestionAnswers[question.id] ?? '';
                      const isMissing = !answer.trim();
                      return (
                        <Paper key={question.id} variant="outlined" sx={{ p: 2 }}>
                          <Stack spacing={1}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle2">
                                {question.id}: {question.question}
                              </Typography>
                              <Chip
                                label={isMissing ? 'Unanswered' : 'Answered'}
                                size="small"
                                color={isMissing ? 'warning' : 'success'}
                                variant="outlined"
                              />
                            </Stack>
                            {question.context ? (
                              <Typography variant="body2" color="text.secondary">
                                Context: {question.context}
                              </Typography>
                            ) : null}
                            <TextField
                              label="Answer"
                              value={answer}
                              onChange={(event) => handleOpenQuestionAnswerChange(question.id, event.target.value)}
                              fullWidth
                              multiline
                              minRows={2}
                              error={isMissing}
                              helperText={isMissing ? 'Answer required to create Jira drafts.' : ' '}
                            />
                          </Stack>
                        </Paper>
                      );
                    })}
                  </Stack>
                ) : (
                  <Alert severity="info" variant="outlined">
                    Upload open_questions.md to review and answer questions.
                  </Alert>
                )
              ) : null}

              {activeTab === 'JIRA' ? (
                jiraEpics.length ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" aria-label="Jira blotter">
                      <TableHead>
                        <TableRow>
                          <TableCell>Capability</TableCell>
                          <TableCell>Epic Summary</TableCell>
                          <TableCell>Scope</TableCell>
                          <TableCell>#Stories</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {jiraEpics.map((epic, index) => {
                          const capabilityLabel = capabilityLabelLookup.get(epic.capabilityId) ?? epic.capabilityId;
                          return (
                            <TableRow
                              key={`${epic.capabilityId}-${index}`}
                              hover
                              onClick={() => handleOpenEpicDetails(index)}
                              sx={{ cursor: 'pointer' }}
                            >
                              <TableCell>{capabilityLabel}</TableCell>
                              <TableCell>{epic.summary}</TableCell>
                              <TableCell>
                                <Chip
                                  label={epic.scope}
                                  size="small"
                                  color={jiraScopeColorLookup[epic.scope]}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>{epic.children?.length ?? 0}</TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenEpicDetails(index);
                                    }}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopySingleEpic(epic);
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Alert severity="info" variant="outlined">
                    Create Jira drafts to populate the blotter.
                  </Alert>
                )
              ) : null}
            </Stack>
          ) : (
            <Alert severity="info" variant="outlined">
              Upload workspace artifact bundle to preview the outputs.
            </Alert>
          )}
        </SectionCard>
      ) : null}

      {isWorkspaceMode ? (
        <SectionCard title="Actions" subtitle="Generate Jira drafts from the uploaded artifacts.">
          <Stack spacing={1}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
              <Button variant="contained" onClick={handleCreateJiraFromBundle} disabled={!canCreateJira}>
                Create Jira Drafts
              </Button>
              {jiraCreated ? <Chip label="Drafts created" size="small" color="success" variant="outlined" /> : null}
              {!bundle?.files.mappingSummary ? (
                <Chip label="Upload mapping_summary.json" size="small" variant="outlined" color="warning" />
              ) : null}
              {bundle?.files.openQuestions && !allQuestionsAnswered ? (
                <Chip
                  label={`${unansweredOpenQuestions.length} open question${unansweredOpenQuestions.length === 1 ? '' : 's'} unanswered`}
                  size="small"
                  variant="outlined"
                  color="warning"
                />
              ) : null}
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Jira drafts are generated in the UI only and can be exported as JSON.
            </Typography>
          </Stack>
        </SectionCard>
      ) : null}

      <SectionCard title="Analysis Output" subtitle="Jira draft epics generated from the parsed output.">
        {isWorkspaceMode ? (
          analysis ? (
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
                    <Table size="small" aria-label="Jira blotter">
                      <TableHead>
                        <TableRow>
                          <TableCell>Capability</TableCell>
                          <TableCell>Epic Summary</TableCell>
                          <TableCell>Scope</TableCell>
                          <TableCell>#Stories</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {analysis.jiraEpics.map((epic, index) => {
                          const capabilityLabel = capabilityLabelLookup.get(epic.capabilityId) ?? epic.capabilityId;
                          return (
                            <TableRow
                              key={`${epic.capabilityId}-${index}`}
                              hover
                              onClick={() => handleOpenEpicDetails(index)}
                              sx={{ cursor: 'pointer' }}
                            >
                              <TableCell>{capabilityLabel}</TableCell>
                              <TableCell>{epic.summary}</TableCell>
                              <TableCell>
                                <Chip
                                  label={epic.scope}
                                  size="small"
                                  color={jiraScopeColorLookup[epic.scope]}
                                  variant="outlined"
                                />
                              </TableCell>
                              <TableCell>{epic.children?.length ?? 0}</TableCell>
                              <TableCell align="right">
                                <Stack direction="row" spacing={1} justifyContent="flex-end">
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleOpenEpicDetails(index);
                                    }}
                                  >
                                    View
                                  </Button>
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleCopySingleEpic(epic);
                                    }}
                                  >
                                    Copy
                                  </Button>
                                </Stack>
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
            Create Jira drafts from workspace artifacts to populate this table.
          </Typography>
        )
      ) : stylusDocs.length ? (
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
                  {stylusEpics.length} draft{stylusEpics.length === 1 ? '' : 's'} generated.
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                <Button
                  variant="contained"
                  size="small"
                  onClick={handleGenerateStylusDrafts}
                  disabled={!stylusDocs.length}
                >
                  Generate Jira Drafts
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleExportJiraPayload}
                  disabled={!stylusEpics.length}
                >
                  Download Jira Draft JSON
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={handleCopyEpicDrafts}
                  disabled={!stylusEpics.length}
                >
                  Copy Jira Draft JSON
                </Button>
                <Button
                  variant="text"
                  size="small"
                  onClick={handleClearStylusOutput}
                  disabled={!stylusDocs.length}
                >
                  Reset
                </Button>
              </Stack>
            </Stack>
            {registryNotice.length ? (
              <Alert severity="info" variant="outlined">
                <Stack spacing={0.25}>
                  <Typography variant="subtitle2">Duplicate detection</Typography>
                  {registryNotice.map((notice, index) => (
                    <Typography key={`registry-notice-${index}`} variant="caption" color="text.secondary">
                      {notice}
                    </Typography>
                  ))}
                </Stack>
              </Alert>
            ) : null}
            <Stack spacing={2}>
              {stylusDocs.map((doc, index) => {
                const detectedLabel = doc.detectedCapabilityId
                  ? capabilityLabelLookup.get(doc.detectedCapabilityId) ?? doc.detectedCapabilityId
                  : 'Unknown';
                const selectedLabel = doc.selectedCapabilityId
                  ? capabilityLabelLookup.get(doc.selectedCapabilityId) ?? doc.selectedCapabilityId
                  : 'Unassigned';
                const confidencePct = Math.round(doc.detectedConfidence * 100);
                const diff = doc.epic?.diff;
                const addedCount =
                  (diff?.description?.added.length ?? 0) +
                  (diff?.acceptance?.added.length ?? 0) +
                  (diff?.inScope?.added.length ?? 0);
                const removedCount =
                  (diff?.description?.removed.length ?? 0) +
                  (diff?.acceptance?.removed.length ?? 0) +
                  (diff?.inScope?.removed.length ?? 0);
                const hasDiff = addedCount + removedCount > 0;
                return (
                  <Paper key={`${doc.fileName}-${index}`} variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={2}
                        alignItems={{ sm: 'center' }}
                        justifyContent="space-between"
                      >
                        <Stack spacing={0.25}>
                          <Typography variant="subtitle2">{doc.fileName}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            Epic: {doc.sections.epicTitle || 'Untitled'}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Detected capability: {detectedLabel} · Confidence {confidencePct}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Selected: {selectedLabel}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {doc.detectedReason}
                          </Typography>
                        </Stack>
                        <Stack spacing={1} alignItems={{ sm: 'flex-end' }}>
                          <TextField
                            select
                            label="Capability (override)"
                            value={doc.selectedCapabilityId ?? ''}
                            onChange={(event) => handleStylusCapabilityOverride(index, event.target.value)}
                            size="small"
                            SelectProps={{ displayEmpty: true }}
                            sx={{ minWidth: 220 }}
                          >
                            <MenuItem value="">
                              <em>Unassigned</em>
                            </MenuItem>
                            {CAPABILITIES.map((capability) => (
                              <MenuItem key={capability.id} value={capability.id}>
                                {capability.label}
                              </MenuItem>
                            ))}
                          </TextField>
                          <Chip
                            label={doc.epic ? 'Draft ready' : 'Not generated'}
                            size="small"
                            color={doc.epic ? 'success' : 'default'}
                            variant="outlined"
                          />
                        </Stack>
                      </Stack>
                      {doc.warnings.length ? (
                        <Alert severity="warning" variant="outlined">
                          <Stack spacing={0.25}>
                            <Typography variant="subtitle2">Parsing notes</Typography>
                            {doc.warnings.map((warning, warningIndex) => (
                              <Typography
                                key={`${doc.fileName}-warning-${warningIndex}`}
                                variant="caption"
                                color="text.secondary"
                              >
                                {warning}
                              </Typography>
                            ))}
                          </Stack>
                        </Alert>
                      ) : null}
                      {hasDiff ? (
                        <Accordion variant="outlined">
                          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Stack direction="row" spacing={1} alignItems="center">
                              <Typography variant="subtitle2">Changes</Typography>
                              <Chip label={`+${addedCount}`} color="success" size="small" />
                              <Chip label={`-${removedCount}`} color="error" size="small" />
                            </Stack>
                          </AccordionSummary>
                          <AccordionDetails>
                            <Stack spacing={1}>
                              {renderDiffSection('Description', diff?.description)}
                              {renderDiffSection('Acceptance Criteria', diff?.acceptance)}
                              {renderDiffSection('In Scope', diff?.inScope)}
                            </Stack>
                          </AccordionDetails>
                        </Accordion>
                      ) : null}
                    </Stack>
                  </Paper>
                );
              })}
            </Stack>
            {stylusEpics.length ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small" aria-label="Jira blotter">
                  <TableHead>
                    <TableRow>
                      <TableCell>Capability</TableCell>
                      <TableCell>Epic Summary</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>#Stories</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stylusEpics.map((epic, index) => {
                      const capabilityLabel = capabilityLabelLookup.get(epic.capabilityId) ?? epic.capabilityId;
                      return (
                        <TableRow
                          key={`${epic.capabilityId}-${index}`}
                          hover
                          onClick={() => handleOpenEpicDetails(index)}
                          sx={{ cursor: 'pointer' }}
                        >
                          <TableCell>{capabilityLabel}</TableCell>
                          <TableCell>{epic.summary}</TableCell>
                          <TableCell>
                            <Chip
                              label={epic.scope}
                              size="small"
                              color={jiraScopeColorLookup[epic.scope]}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{epic.children?.length ?? 0}</TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={1} justifyContent="flex-end">
                              <Button
                                size="small"
                                variant="text"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleOpenEpicDetails(index);
                                }}
                              >
                                View
                              </Button>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleCopySingleEpic(epic);
                                }}
                              >
                                Copy
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Alert severity="info">Generate Jira drafts to view and export the JSON payload.</Alert>
            )}
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Upload template docs to generate Jira drafts.
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

      <Drawer
        anchor="right"
        open={isMappingDrawerOpen}
        onClose={() => setIsMappingDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Mapping Summary Detail</Typography>
            <Button size="small" variant="text" onClick={() => setIsMappingDrawerOpen(false)}>
              Close
            </Button>
          </Stack>
          {selectedMappingItem ? (
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  {selectedMappingItem.country_requirement_id}
                </Typography>
                <Typography variant="subtitle2">{selectedMappingItem.country_requirement_description}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={selectedMappingItem.classification ?? '—'} size="small" variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Confidence: {selectedMappingItem.confidence_score ?? 'n/a'}
                  </Typography>
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Matched Global Capability</Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedMappingItem.matched_global_capability_id ?? '—'}
                </Typography>
                {selectedMappingItem.matched_global_capability_description ? (
                  <Typography variant="body2" color="text.secondary">
                    {selectedMappingItem.matched_global_capability_description}
                  </Typography>
                ) : null}
              </Stack>

              {selectedMappingItem.reasoning ? (
                <>
                  <Divider />
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Reasoning</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {selectedMappingItem.reasoning}
                    </Typography>
                  </Stack>
                </>
              ) : null}

              {selectedMappingItem.comparison_breakdown ? (
                <>
                  <Divider />
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">Comparison Breakdown</Typography>
                    {Object.entries(selectedMappingItem.comparison_breakdown).map(([key, value]) => (
                      <Typography key={key} variant="body2" color="text.secondary">
                        {key}: {value}
                      </Typography>
                    ))}
                  </Stack>
                </>
              ) : null}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a mapping row to view details.
            </Typography>
          )}
        </Stack>
      </Drawer>

      <Drawer
        anchor="right"
        open={isEpicDrawerOpen}
        onClose={() => setIsEpicDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 420 } } }}
      >
        <Stack spacing={2} sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography variant="subtitle1">Jira Epic Details</Typography>
            <Button size="small" variant="text" onClick={() => setIsEpicDrawerOpen(false)}>
              Close
            </Button>
          </Stack>
          {activeEpic ? (
            <Stack spacing={1.5}>
              <Stack spacing={0.5}>
                <Typography variant="subtitle2">{activeEpic.title}</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip label={activeEpic.scope} size="small" color={jiraScopeColorLookup[activeEpic.scope]} variant="outlined" />
                  <Typography variant="caption" color="text.secondary">
                    Capability: {capabilityLabelLookup.get(activeEpic.capabilityId) ?? activeEpic.capabilityId}
                  </Typography>
                </Stack>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Metadata</Typography>
                <Typography variant="body2" color="text.secondary">
                  Owner: {activeEpic.owner?.team ?? '—'} {activeEpic.owner?.name ? `(${activeEpic.owner.name})` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Components: {activeEpic.components?.length ? activeEpic.components.join(', ') : '—'}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Labels: {activeEpic.labels?.length ? activeEpic.labels.join(', ') : '—'}
                </Typography>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Description</Typography>
                <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 240, overflow: 'auto' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                    {activeEpic.descriptionText || activeEpic.summary}
                  </Typography>
                </Paper>
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Acceptance Criteria</Typography>
                {activeEpic.acceptanceCriteriaText ? (
                  <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 220, overflow: 'auto' }}>
                    <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
                      {activeEpic.acceptanceCriteriaText}
                    </Typography>
                  </Paper>
                ) : activeEpic.acceptanceCriteria.length ? (
                  <Stack spacing={0.5}>
                    {activeEpic.acceptanceCriteria.map((criteria, index) => (
                      <Typography key={`epic-criteria-${index}`} variant="body2" color="text.secondary">
                        • {criteria}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No acceptance criteria provided.
                  </Typography>
                )}
              </Stack>

              <Divider />

              <Stack spacing={0.5}>
                <Typography variant="subtitle2">Children</Typography>
                {activeEpic.children?.length ? (
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" aria-label="Child stories">
                      <TableHead>
                        <TableRow>
                          <TableCell>Type</TableCell>
                          <TableCell>Summary</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {activeEpic.children.map((child, index) => (
                          <TableRow key={`epic-child-${index}`}>
                            <TableCell>{child.type}</TableCell>
                            <TableCell>{child.summary}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No child stories generated.
                  </Typography>
                )}
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select an epic to view details.
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
