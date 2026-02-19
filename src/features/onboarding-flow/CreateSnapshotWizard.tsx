import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import CloseIcon from '@mui/icons-material/Close';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Badge,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  Grid,
  IconButton,
  Link,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JsonMonacoPanel } from '../../components/JsonMonacoPanel';
import { CatalogSelector, type CatalogColumn } from '../../components/CatalogSelector';
import { ParamsEditorDrawer } from '../../components/ParamsEditorDrawer';
import { SectionCard } from '../../components/SectionCard';
import { WorkflowDefinitionFields, WorkflowTabPanels, type WorkflowTabKey } from '../../components/WorkflowEditor';
import { createSnapshot, createSnapshotVersion } from '../../api/client';
import type { SnapshotDetailDto } from '../../api/types';
import { useGlobalError } from '../../app/GlobalErrorContext';
import { enrichmentCatalog, type EnrichmentCatalogItem } from '../../catalog/enrichmentCatalog';
import { validationCatalog, type ValidationCatalogItem } from '../../catalog/validationCatalog';
import {
  capabilityKeys,
  type CapabilityKey,
  type DupCheckStaticParams,
  type SnapshotCapability,
  type RulesConfig,
  type SnapshotModel,
  type WorkflowSpec,
  type StateSpec,
  type TransitionSpec,
  type WorkflowLintIssue,
  listAllTransitions,
  lintWorkflowSpec,
  migrateLegacyTransitions,
  validateCountryCodeUppercase
} from '../../models/snapshot';
import { loadOnboardingDraft, saveOnboardingDraft } from '../../lib/storage/onboardingDraftStorage';
import { capabilityCatalog } from './capabilityCatalog';

type CatalogTab = 'validations' | 'enrichments';

type ParamsDrawerContext = {
  title: string;
  description?: string;
  params?: Record<string, any>;
  staticParams?: Record<string, string>;
  staticParamFields?: ReadonlyArray<{ key: string; label: string }>;
  onSaveStaticParams?: (params: Record<string, string>) => void;
  onReset?: () => void;
  onSave: (params: Record<string, any>) => void;
} | null;

const stepLabels = [
  'Country & Snapshot Basics',
  'CPX Capability Selection',
  'Validation & Enrichment',
  'State Manager / Workflow',
  'Review & Save Snapshot'
];

const stepSubtitles = [
  'Set the country identity and baseline routing details used across generated assets.',
  'Enable only the CPX capabilities required for this onboarding rollout.',
  'Define deterministic validation and enrichment rules before workflow execution.',
  'Model the state machine that State Manager will enforce at runtime.',
  'Confirm snapshot scope, then persist the final payload.'
];

const defaultEnabledCapabilities = new Set<CapabilityKey>([
  'PAYMENT_INITIATION',
  'PAYMENT_ORCHESTRATION',
  'CLEARING',
  'POSTING',
  'SANCTIONS',
  'PLATFORM_RESILIENCY'
]);

const dupCheckStaticParamFields = [
  { key: 'bankSettlementType', label: 'Bank Settlement Type' },
  { key: 'paymentID', label: 'Payment ID' },
  { key: 'debitAcctID', label: 'Debit Account ID' },
  { key: 'creditAcctID', label: 'Credit Account ID' },
  { key: 'clearingSystemMemId', label: 'Clearing System Member ID' },
  { key: 'ccy', label: 'Currency (CCY)' }
] as const;

type DupCheckStaticParamKey = (typeof dupCheckStaticParamFields)[number]['key'];
const dupCheckStaticParamKeys: DupCheckStaticParamKey[] = dupCheckStaticParamFields.map((field) => field.key);

const capabilityLabelLookup = new Map<CapabilityKey, string>(
  capabilityCatalog.map((item) => [item.key, item.label])
);

function getCapabilityIcon(_: CapabilityKey) {
  return <BuildOutlinedIcon fontSize="small" />;
}

const validationCatalogIds = new Set(validationCatalog.map((item) => item.id));
const enrichmentCatalogIds = new Set(enrichmentCatalog.map((item) => item.id));
const validationLabelLookup = new Map(validationCatalog.map((item) => [item.id, item.className]));
const enrichmentLabelLookup = new Map(enrichmentCatalog.map((item) => [item.id, item.className]));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function normalizeSelectedIds(value: unknown, allowedIds: Set<string>): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  value.forEach((entry) => {
    if (typeof entry !== 'string') {
      return;
    }
    const trimmed = entry.trim();
    if (!trimmed || seen.has(trimmed) || !allowedIds.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    result.push(trimmed);
  });
  return result;
}

function orderSelection(ids: string[], catalog: Array<{ id: string }>): string[] {
  const selected = new Set(ids);
  return catalog.filter((item) => selected.has(item.id)).map((item) => item.id);
}

function toggleSelection(ids: string[], id: string, catalog: Array<{ id: string }>): string[] {
  const next = new Set(ids);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  return orderSelection(Array.from(next), catalog);
}

const defaultWorkflow: WorkflowSpec = {
  workflowKey: 'PAYMENT_INGRESS',
  statesClass: 'com.citi.cpx.statemanager.fsm.State',
  eventsClass: 'com.citi.cpx.statemanager.fsm.Event',
  startState: 'RECEIVED',
  states: [
    {
      name: 'RECEIVED',
      onEvent: {
        VALIDATE: { target: 'VALIDATED', actions: [] }
      }
    },
    {
      name: 'VALIDATED',
      onEvent: {
        CLEAR: { target: 'CLEARED', actions: [] }
      }
    },
    {
      name: 'CLEARED',
      onEvent: {}
    }
  ]
};

function buildEmptyDupCheckStaticParams(): DupCheckStaticParams {
  return dupCheckStaticParamKeys.reduce<DupCheckStaticParams>((acc, key) => {
    acc[key] = '';
    return acc;
  }, {});
}

function normalizeDupCheckStaticParams(value: unknown): DupCheckStaticParams {
  const candidate = isRecord(value) ? value : {};
  return dupCheckStaticParamKeys.reduce<DupCheckStaticParams>((acc, key) => {
    const entry = candidate[key];
    acc[key] = typeof entry === 'string' ? entry : entry == null ? '' : String(entry);
    return acc;
  }, {});
}

function normalizeCapabilities(rawCapabilities: unknown): SnapshotCapability[] {
  const rawList = Array.isArray(rawCapabilities) ? rawCapabilities : [];
  const capabilityMap = new Map(rawList.map((cap) => [cap.capabilityKey, cap]));
  return capabilityKeys.map((key) => {
    const existing = capabilityMap.get(key) as SnapshotCapability | undefined;
    const base = {
      capabilityKey: key,
      enabled: existing?.enabled ?? defaultEnabledCapabilities.has(key),
      params: existing?.params
    };
    if (key === 'DUP_CHECK') {
      return {
        ...base,
        staticParams: normalizeDupCheckStaticParams(existing?.staticParams)
      };
    }
    return base;
  });
}

function normalizeTransitionSpec(value: unknown): TransitionSpec {
  if (!value || typeof value !== 'object') {
    return { target: '', actions: [] };
  }
  const candidate = value as { target?: unknown; actions?: unknown };
  return {
    target: typeof candidate.target === 'string' ? candidate.target : '',
    actions: Array.isArray(candidate.actions)
      ? candidate.actions.map((action) => String(action).trim()).filter(Boolean)
      : []
  };
}

function normalizeOnEventMap(value: unknown): Record<string, TransitionSpec> {
  if (!value || typeof value !== 'object') {
    return {};
  }
  return Object.entries(value as Record<string, unknown>).reduce<Record<string, TransitionSpec>>((acc, [key, transition]) => {
    acc[key] = normalizeTransitionSpec(transition);
    return acc;
  }, {});
}

function normalizeWorkflowSpec(raw: Partial<WorkflowSpec> & { transitions?: unknown } | undefined): WorkflowSpec {
  if (!raw || typeof raw !== 'object') {
    return defaultWorkflow;
  }

  const workflowKey = typeof raw.workflowKey === 'string' ? raw.workflowKey : defaultWorkflow.workflowKey;
  const statesClassCandidate = typeof raw.statesClass === 'string' ? raw.statesClass.trim() : '';
  const eventsClassCandidate = typeof raw.eventsClass === 'string' ? raw.eventsClass.trim() : '';
  const statesClass = statesClassCandidate ? raw.statesClass : defaultWorkflow.statesClass;
  const eventsClass = eventsClassCandidate ? raw.eventsClass : defaultWorkflow.eventsClass;
  const startStateCandidate = typeof raw.startState === 'string' ? raw.startState.trim() : '';
  const rawStates = raw.states ?? defaultWorkflow.states;
  const stateSpecs: StateSpec[] = Array.isArray(rawStates)
    ? rawStates
        .map((state) => {
          if (typeof state === 'string') {
            return { name: state, onEvent: {} };
          }
          if (!state || typeof state !== 'object') {
            return null;
          }
          const candidate = state as { name?: unknown; onEvent?: unknown };
          if (typeof candidate.name !== 'string') {
            return null;
          }
          return {
            name: candidate.name,
            onEvent: normalizeOnEventMap(candidate.onEvent)
          };
        })
        .filter((state): state is StateSpec => Boolean(state?.name))
    : defaultWorkflow.states;

  const hasStateObjects =
    Array.isArray(rawStates) &&
    rawStates.some((state) => state && typeof state === 'object' && 'name' in (state as Record<string, unknown>));
  const hasTransitions = Object.prototype.hasOwnProperty.call(raw as Record<string, unknown>, 'transitions');
  const nextStates = hasTransitions && !hasStateObjects
    ? migrateLegacyTransitions(
        stateSpecs.map((state) => state.name),
        (raw as { transitions?: unknown }).transitions
      )
    : stateSpecs;
  const resolvedStates = nextStates.length ? nextStates : defaultWorkflow.states;
  const nextStateNames = resolvedStates.map((state) => state.name);
  const resolvedStartState = nextStateNames.includes(startStateCandidate)
    ? startStateCandidate
    : nextStateNames[0] ?? defaultWorkflow.startState ?? '';

  return {
    workflowKey,
    statesClass,
    eventsClass,
    startState: resolvedStartState,
    states: resolvedStates
  };
}


const defaultSnapshot: SnapshotModel = {
  countryCode: '',
  region: undefined,
  capabilities: normalizeCapabilities([]),
  validations: [],
  enrichments: [],
  selectedValidations: [],
  selectedEnrichments: [],
  actions: [],
  workflow: defaultWorkflow,
  integrationConfig: {},
  deploymentOverrides: {}
};

function getSnapshotIdFromResponse(response: SnapshotDetailDto) {
  return response.snapshotId ?? response.id ?? response.snapshot_id ?? null;
}

function normalizeSnapshotInput(raw: Partial<SnapshotModel>): SnapshotModel {
  const workflow = raw.workflow ?? defaultWorkflow;
  const mergedWorkflow = {
    ...normalizeWorkflowSpec(workflow)
  };

  const rawRulesConfig = raw.rulesConfig as RulesConfig | undefined;
  const normalizedRulesConfig = rawRulesConfig
    ? {
        metadata: rawRulesConfig.metadata,
        validations: Array.isArray(rawRulesConfig.validations) ? rawRulesConfig.validations : [],
        enrichments: Array.isArray(rawRulesConfig.enrichments) ? rawRulesConfig.enrichments : []
      }
    : undefined;

  const normalizedCapabilities = normalizeCapabilities(raw.capabilities);
  const normalizedSelectedValidations = orderSelection(
    normalizeSelectedIds(raw.selectedValidations, validationCatalogIds),
    validationCatalog
  );
  const normalizedSelectedEnrichments = orderSelection(
    normalizeSelectedIds(raw.selectedEnrichments, enrichmentCatalogIds),
    enrichmentCatalog
  );

  return {
    countryCode: raw.countryCode ?? '',
    region: raw.region,
    capabilities: normalizedCapabilities,
    validations: Array.isArray(raw.validations) ? raw.validations : [],
    enrichments: Array.isArray(raw.enrichments) ? raw.enrichments : [],
    selectedValidations: normalizedSelectedValidations,
    selectedEnrichments: normalizedSelectedEnrichments,
    rulesConfig: normalizedRulesConfig,
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    workflow: mergedWorkflow,
    integrationConfig: raw.integrationConfig ?? {},
    deploymentOverrides: raw.deploymentOverrides ?? {}
  };
}

function normalizeWorkflowDraft(raw: unknown): WorkflowSpec | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  return normalizeWorkflowSpec(raw as Partial<WorkflowSpec> & { transitions?: unknown });
}

type CreateSnapshotWizardProps = {
  mode?: 'create' | 'version';
  snapshotId?: string;
  initialSnapshot?: SnapshotModel;
  onSaved?: (snapshotId: string, version?: number) => void;
};

export function CreateSnapshotWizard({
  mode = 'create',
  snapshotId,
  initialSnapshot,
  onSaved
}: CreateSnapshotWizardProps) {
  const navigate = useNavigate();
  const { showError } = useGlobalError();
  const [activeStep, setActiveStep] = useState(0);
  const [stepAnimationDirection, setStepAnimationDirection] = useState<'forward' | 'backward'>('forward');
  const [advancedJson, setAdvancedJson] = useState(false);
  const jsonUpdateSource = useRef<'form' | 'editor' | null>(null);
  const isVersionMode = mode === 'version';

  const resolvedInitialSnapshot = useMemo(
    () => normalizeSnapshotInput(initialSnapshot ?? defaultSnapshot),
    [initialSnapshot]
  );

  const [snapshot, setSnapshot] = useState<SnapshotModel>(resolvedInitialSnapshot);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(resolvedInitialSnapshot, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [paramsDrawerContext, setParamsDrawerContext] = useState<ParamsDrawerContext>(null);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>('validations');
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [workflowTab, setWorkflowTab] = useState<WorkflowTabKey>('transitions');
  const [workflowFocus, setWorkflowFocus] = useState<{ issue: WorkflowLintIssue; nonce: number } | null>(null);
  const [workflowSidePanel, setWorkflowSidePanel] = useState<'lint' | 'help' | null>(null);

  const createSnapshotMutation = useMutation({
    mutationFn: createSnapshot,
    meta: { suppressGlobalError: true }
  });

  const createSnapshotVersionMutation = useMutation({
    mutationFn: (payload: { countryCode?: string; snapshot: SnapshotModel; templatePacks?: Record<string, string> }) => {
      if (!snapshotId) {
        return Promise.reject(new Error('Snapshot ID is required to create a new version.'));
      }
      return createSnapshotVersion(snapshotId, payload);
    },
    meta: { suppressGlobalError: true }
  });

  useEffect(() => {
    setSnapshot(resolvedInitialSnapshot);
    setJsonValue(JSON.stringify(resolvedInitialSnapshot, null, 2));
  }, [resolvedInitialSnapshot]);

  useEffect(() => {
    if (!advancedJson) {
      setJsonError(null);
      return;
    }
    if (jsonUpdateSource.current === 'editor') {
      jsonUpdateSource.current = null;
      return;
    }
    setJsonValue(JSON.stringify(snapshot, null, 2));
  }, [advancedJson, snapshot]);

  useEffect(() => {
    if (activeStep !== 3 && workflowSidePanel) {
      setWorkflowSidePanel(null);
    }
  }, [activeStep, workflowSidePanel]);


  const updateSnapshot = (
    updater: (prev: SnapshotModel) => SnapshotModel,
    source: 'form' | 'editor' = 'form'
  ) => {
    jsonUpdateSource.current = source;
    setSnapshot(updater);
  };

  useEffect(() => {
    const draft = loadOnboardingDraft();
    if (draft) {
      const workflowDraft = normalizeWorkflowDraft(draft.workflow);
      const selectedValidations = orderSelection(
        normalizeSelectedIds(draft.selectedValidations, validationCatalogIds),
        validationCatalog
      );
      const selectedEnrichments = orderSelection(
        normalizeSelectedIds(draft.selectedEnrichments, enrichmentCatalogIds),
        enrichmentCatalog
      );
      const normalizedCapabilities = draft.capabilities ? normalizeCapabilities(draft.capabilities) : null;
      updateSnapshot((prev) => ({
        ...prev,
        workflow: workflowDraft ?? prev.workflow,
        selectedValidations,
        selectedEnrichments,
        capabilities: normalizedCapabilities ?? prev.capabilities
      }));
    }
    setDraftHydrated(true);
  }, []);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }
    saveOnboardingDraft({
      workflow: snapshot.workflow,
      selectedValidations: snapshot.selectedValidations,
      selectedEnrichments: snapshot.selectedEnrichments,
      capabilities: snapshot.capabilities
    });
  }, [draftHydrated, snapshot.workflow, snapshot.selectedValidations, snapshot.selectedEnrichments]);

  const handleJsonChange = (next: string) => {
    setJsonValue(next);
    try {
      const parsed = JSON.parse(next) as Partial<SnapshotModel>;
      const normalized = normalizeSnapshotInput(parsed);
      updateSnapshot(() => normalized, 'editor');
      setJsonError(null);
    } catch {
      setJsonError('JSON parse error. Check commas, quotes, and brackets.');
    }
  };

  const countryErrors = validateCountryCodeUppercase(snapshot.countryCode);
  const workflowLint = useMemo(() => lintWorkflowSpec(snapshot.workflow), [snapshot.workflow]);

  const selectedValidations = snapshot.selectedValidations;
  const selectedEnrichments = snapshot.selectedEnrichments;
  const selectedValidationLabels = useMemo(
    () => selectedValidations.map((id) => validationLabelLookup.get(id) ?? id),
    [selectedValidations]
  );
  const selectedEnrichmentLabels = useMemo(
    () => selectedEnrichments.map((id) => enrichmentLabelLookup.get(id) ?? id),
    [selectedEnrichments]
  );

  const capabilityStateByKey = useMemo(
    () => new Map(snapshot.capabilities.map((capability) => [capability.capabilityKey, capability])),
    [snapshot.capabilities]
  );

  const enabledCapabilities = snapshot.capabilities.filter((capability) => capability.enabled);
  const hasCapabilitiesEnabled = enabledCapabilities.length > 0;
  const dupCheckCapability = snapshot.capabilities.find((capability) => capability.capabilityKey === 'DUP_CHECK');
  const dupCheckStaticEntries = dupCheckCapability?.staticParams
    ? Object.entries(dupCheckCapability.staticParams).filter(([, value]) => Boolean(value && String(value).trim()))
    : [];

  const workflowKeyValid = snapshot.workflow.workflowKey.trim().length > 0;
  const stateNames = useMemo(
    () => snapshot.workflow.states.map((state) => state.name).filter(Boolean),
    [snapshot.workflow.states]
  );
  const statesValid = stateNames.length > 0;
  const transitionRows = useMemo(() => listAllTransitions(snapshot.workflow), [snapshot.workflow]);
  const workflowLintCounts = useMemo(() => {
    const base = {
      transitions: { errors: 0, warnings: 0 },
      state: { errors: 0, warnings: 0 },
      yaml: { errors: 0, warnings: 0 }
    };
    workflowLint.issues.forEach((issue) => {
      const bucket = base[issue.tab] ?? base.transitions;
      if (issue.level === 'error') {
        bucket.errors += 1;
      } else {
        bucket.warnings += 1;
      }
    });
    return base;
  }, [workflowLint]);

  const duplicateEventCount = useMemo(() => {
    const counts = new Map<string, number>();
    transitionRows.forEach((transition) => {
      const normalizedEvent = transition.eventName.trim().toUpperCase();
      if (!normalizedEvent) {
        return;
      }
      const key = `${transition.from}::${normalizedEvent}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return Array.from(counts.values()).filter((count) => count > 1).length;
  }, [transitionRows]);

  const transitionsValid = transitionRows.every(
    (transition) =>
      stateNames.includes(transition.from) &&
      stateNames.includes(transition.target) &&
      transition.eventName.trim().length > 0
  );
  const transitionUniquenessValid = duplicateEventCount === 0;
  const workflowTransitionCount = transitionRows.length;
  const workflowLintIssueCount = workflowLint.errors.length + workflowLint.warnings.length;
  const renderWorkflowTabLabel = (label: string, counts: { errors: number; warnings: number }) => (
    <Stack direction="row" spacing={1} alignItems="center">
      <Typography variant="body2">{label}</Typography>
      {counts.errors > 0 ? (
        <Badge color="error" badgeContent={counts.errors}>
          <Box sx={{ width: 6, height: 6 }} />
        </Badge>
      ) : null}
      {counts.warnings > 0 ? (
        <Badge color="warning" badgeContent={counts.warnings}>
          <Box sx={{ width: 6, height: 6 }} />
        </Badge>
      ) : null}
    </Stack>
  );
  const formatWorkflowIssueContext = (issue: WorkflowLintIssue) => {
    const parts: string[] = [];
    if (issue.stateName) {
      parts.push(`State: ${issue.stateName}`);
    }
    if (issue.eventName !== undefined) {
      const eventLabel = issue.eventName?.trim() ? issue.eventName : 'Unnamed';
      parts.push(`Event: ${eventLabel}`);
    }
    return parts.join(' • ');
  };
  const handleLintIssueClick = useCallback(
    (issue: WorkflowLintIssue) => {
      setWorkflowTab(issue.tab as WorkflowTabKey);
      setWorkflowFocus({ issue, nonce: Date.now() });
    },
    [setWorkflowTab]
  );

  const stepValidations = [
    countryErrors.length === 0,
    hasCapabilitiesEnabled,
    true,
    workflowKeyValid &&
      statesValid &&
      workflowLint.errors.length === 0 &&
      transitionsValid &&
      transitionUniquenessValid,
    true
  ];

  const canProceed = stepValidations[activeStep] && !(advancedJson && jsonError);


  const validationColumns = useMemo<CatalogColumn<ValidationCatalogItem>[]>(
    () => [
      {
        id: 'className',
        label: 'Class Name',
        render: (item) => item.className
      },
      {
        id: 'keyStatus',
        label: 'Key/Status',
        render: (item) => item.keyStatus
      },
      {
        id: 'description',
        label: 'Description',
        render: (item) => (
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        )
      }
    ],
    []
  );
  const enrichmentColumns = useMemo<CatalogColumn<EnrichmentCatalogItem>[]>(
    () => [
      {
        id: 'className',
        label: 'Class Name',
        render: (item) => item.className
      },
      {
        id: 'key',
        label: 'Key',
        render: (item) => item.key
      },
      {
        id: 'description',
        label: 'Description',
        render: (item) => (
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
        )
      }
    ],
    []
  );
  const validationSearchText = useCallback(
    (item: ValidationCatalogItem) => `${item.className} ${item.keyStatus} ${item.description}`,
    []
  );
  const enrichmentSearchText = useCallback(
    (item: EnrichmentCatalogItem) => `${item.className} ${item.key} ${item.description}`,
    []
  );

  const handleToggleValidation = (id: string) => {
    updateSnapshot((prev) => ({
      ...prev,
      selectedValidations: toggleSelection(prev.selectedValidations, id, validationCatalog)
    }));
  };

  const handleToggleEnrichment = (id: string) => {
    updateSnapshot((prev) => ({
      ...prev,
      selectedEnrichments: toggleSelection(prev.selectedEnrichments, id, enrichmentCatalog)
    }));
  };

  const handleClearValidations = () => {
    updateSnapshot((prev) => ({
      ...prev,
      selectedValidations: []
    }));
  };

  const handleClearEnrichments = () => {
    updateSnapshot((prev) => ({
      ...prev,
      selectedEnrichments: []
    }));
  };

  const goNext = () => {
    if (activeStep < stepLabels.length - 1) {
      setStepAnimationDirection('forward');
      setActiveStep((prev) => prev + 1);
    }
  };

  const goBack = () => {
    if (activeStep > 0) {
      setStepAnimationDirection('backward');
      setActiveStep((prev) => prev - 1);
    }
  };

  const openParamsDrawer = (context: ParamsDrawerContext) => {
    setParamsDrawerContext(context);
  };

  const handleSaveSnapshot = async () => {
    try {
      const payload = {
        countryCode: snapshot.countryCode,
        snapshot
      };

      if (isVersionMode) {
        const response = await createSnapshotVersionMutation.mutateAsync(payload);
        const resolvedSnapshotId = snapshotId ?? getSnapshotIdFromResponse(response);
        const version = response.version ?? response.currentVersion;
        if (resolvedSnapshotId) {
          onSaved?.(resolvedSnapshotId, version);
          if (!onSaved) {
            const params = new URLSearchParams();
            if (typeof version === 'number') {
              params.set('version', String(version));
            }
            const query = params.toString();
            navigate(`/snapshots/${encodeURIComponent(resolvedSnapshotId)}${query ? `?${query}` : ''}`);
          }
        } else {
          showError('Snapshot version created, but no snapshotId was returned.');
        }
        return;
      }

      const response = await createSnapshotMutation.mutateAsync(payload);
      const resolvedSnapshotId = getSnapshotIdFromResponse(response);
      if (!resolvedSnapshotId) {
        showError('Snapshot created, but no snapshotId was returned.');
        return;
      }
      const resolvedVersion = response.version ?? response.currentVersion;
      const stored = localStorage.getItem('cpx.snapshot.refs');
      const existing = stored
        ? (JSON.parse(stored) as {
            snapshotId: string;
            countryCode: string;
            version?: number;
            createdAt: string;
          }[])
        : [];
      const next = [
        {
          snapshotId: resolvedSnapshotId,
          countryCode: snapshot.countryCode,
          version: typeof resolvedVersion === 'number' ? resolvedVersion : undefined,
          createdAt: new Date().toISOString()
        },
        ...existing.filter((item) => item.snapshotId !== resolvedSnapshotId)
      ].slice(0, 10);
      localStorage.setItem('cpx.snapshot.refs', JSON.stringify(next));
      onSaved?.(resolvedSnapshotId, resolvedVersion);
      if (!onSaved) {
        navigate(`/snapshots/${encodeURIComponent(resolvedSnapshotId)}`);
      }
    } catch (error) {
      showError(error instanceof Error ? error.message : 'Snapshot creation failed.');
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2.5}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1">Country Identity</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Capture the values every generated artifact uses to identify this snapshot.
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Country Code"
                      placeholder="GB, SG, AE"
                      value={snapshot.countryCode}
                      onChange={(event) =>
                        updateSnapshot((prev) => ({
                          ...prev,
                          countryCode: event.target.value.toUpperCase()
                        }))
                      }
                      error={countryErrors.length > 0}
                      helperText={
                        countryErrors[0]?.message ??
                        'Two-letter ISO code used in snapshot IDs and runtime routing.'
                      }
                      inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
                      InputLabelProps={{ sx: { textAlign: 'left' } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <TextField
                      fullWidth
                      select
                      label="Region (optional)"
                      value={snapshot.region ?? ''}
                      onChange={(event) =>
                        updateSnapshot((prev) => ({
                          ...prev,
                          region: event.target.value || undefined
                        }))
                      }
                      helperText="Aligns to routing domains in CPX runtime."
                      InputLabelProps={{ sx: { textAlign: 'left' } }}
                    >
                      <MenuItem value="">Unspecified</MenuItem>
                      <MenuItem value="Americas">Americas</MenuItem>
                      <MenuItem value="EMEA">EMEA</MenuItem>
                      <MenuItem value="APAC">APAC</MenuItem>
                    </TextField>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Lifecycle Notes</Typography>
                <Alert severity="info">
                  Snapshot data is versioned and persisted so workflow changes can be audited without re-entry.
                </Alert>
              </Stack>
            </Paper>
          </Stack>
        );
      case 1:
        return (
          <Stack spacing={3}>
            <Typography variant="body2" color="text.secondary">
              Why this matters: capability blocks map directly to CPX runtime domains and drive generated pipelines.
            </Typography>
            {!hasCapabilitiesEnabled ? (
              <Alert severity="warning">Enable at least one CPX capability to proceed.</Alert>
            ) : null}
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1">Capability Catalog</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Toggle each capability to match the onboarding scope for this snapshot.
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  {capabilityCatalog.map((item) => {
                    const capability = capabilityStateByKey.get(item.key);
                    const enabled = capability?.enabled ?? false;
                    const icon = getCapabilityIcon(item.key);
                    return (
                      <Grid key={item.key} size={{ xs: 12, md: 6 }}>
                        <Paper
                          variant="outlined"
                          sx={(theme) => ({
                            p: 2,
                            height: '100%',
                            borderWidth: enabled ? 2 : 1,
                            borderColor: enabled ? theme.palette.primary.main : theme.palette.divider,
                            backgroundColor: enabled
                              ? alpha(theme.palette.primary.main, 0.06)
                              : theme.palette.background.paper,
                            transition: theme.transitions.create(
                              ['transform', 'box-shadow', 'border-color', 'background-color'],
                              { duration: theme.transitions.duration.shorter }
                            ),
                            '&:hover': {
                              transform: 'translateY(-2px)',
                              boxShadow: theme.shadows[3],
                              borderColor: theme.palette.primary.main
                            }
                          })}
                        >
                          <Stack spacing={2}>
                            <Stack direction="row" spacing={1.25} alignItems="flex-start">
                              <Stack
                                alignItems="center"
                                justifyContent="center"
                                sx={(theme) => ({
                                  width: 34,
                                  height: 34,
                                  borderRadius: 1,
                                  color: enabled ? theme.palette.primary.main : theme.palette.text.secondary,
                                  backgroundColor: enabled
                                    ? alpha(theme.palette.primary.main, 0.14)
                                    : alpha(theme.palette.text.secondary, 0.08),
                                  flexShrink: 0
                                })}
                              >
                                {icon}
                              </Stack>
                              <Stack spacing={0.5}>
                                <Typography variant="subtitle2">{item.label}</Typography>
                                <Typography variant="body2" color="text.secondary">
                                  {item.description}
                                </Typography>
                                {item.key === 'DUP_CHECK' ? (
                                  <Typography variant="caption" color="text.secondary">
                                    Static fields: bankSettlementType, paymentID, debitAcctID, creditAcctID,
                                    clearingSystemMemId, ccy
                                  </Typography>
                                ) : null}
                                <Link
                                  href={item.epicUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  underline="hover"
                                  color="primary"
                                  variant="caption"
                                  sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                                >
                                  About
                                  <OpenInNewIcon fontSize="inherit" />
                                </Link>
                              </Stack>
                            </Stack>
                            <Stack
                              direction={{ xs: 'column', sm: 'row' }}
                              alignItems={{ xs: 'flex-start', sm: 'center' }}
                              justifyContent="space-between"
                              spacing={1}
                            >
                              <FormControlLabel
                                sx={{
                                  m: 0,
                                  '& .MuiFormControlLabel-label': {
                                    textAlign: 'left',
                                    fontSize: 12,
                                    color: 'text.secondary'
                                  }
                                }}
                                control={
                                  <Switch
                                    checked={enabled}
                                    onChange={(_, checked) =>
                                      updateSnapshot((prev) => ({
                                        ...prev,
                                        capabilities: prev.capabilities.map((cap) =>
                                          cap.capabilityKey === item.key ? { ...cap, enabled: checked } : cap
                                        )
                                      }))
                                    }
                                    aria-label={`Enable ${item.label}`}
                                  />
                                }
                                label={enabled ? 'Enabled' : 'Disabled'}
                              />
                              <Button
                                size="small"
                                variant={enabled ? 'contained' : 'outlined'}
                                startIcon={<BuildOutlinedIcon />}
                                disabled={!enabled}
                                onClick={() =>
                                  openParamsDrawer({
                                    title: `${item.label} Params`,
                                    description: item.description,
                                    params: capability?.params,
                                    staticParams:
                                      item.key === 'DUP_CHECK'
                                        ? (capability?.staticParams as Record<string, string> | undefined)
                                        : undefined,
                                    staticParamFields:
                                      item.key === 'DUP_CHECK' ? dupCheckStaticParamFields : undefined,
                                    onSave: (params) =>
                                      updateSnapshot((prev) => ({
                                        ...prev,
                                        capabilities: prev.capabilities.map((cap) =>
                                          cap.capabilityKey === item.key ? { ...cap, params } : cap
                                        )
                                      })),
                                    onSaveStaticParams:
                                      item.key === 'DUP_CHECK'
                                        ? (staticParams) =>
                                            updateSnapshot((prev) => ({
                                              ...prev,
                                              capabilities: prev.capabilities.map((cap) =>
                                                cap.capabilityKey === 'DUP_CHECK'
                                                  ? { ...cap, staticParams }
                                                  : cap
                                              )
                                            }))
                                        : undefined,
                                    onReset:
                                      item.key === 'DUP_CHECK'
                                        ? () =>
                                            updateSnapshot((prev) => ({
                                              ...prev,
                                              capabilities: prev.capabilities.map((cap) =>
                                                cap.capabilityKey === 'DUP_CHECK'
                                                  ? { ...cap, params: {}, staticParams: buildEmptyDupCheckStaticParams() }
                                                  : cap
                                              )
                                            }))
                                        : undefined
                                  })
                                }
                              >
                                Configure
                              </Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      </Grid>
                    );
                  })}
                </Grid>
              </Stack>
            </Paper>
          </Stack>
        );
      case 2:
        return (
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1">Validation & Enrichment</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Select the validation and enrichment rules that should run before workflow execution.
                  </Typography>
                </Stack>
                <Tabs
                  value={catalogTab}
                  onChange={(_, value) => setCatalogTab(value as CatalogTab)}
                  aria-label="Validation and enrichment tabs"
                >
                  <Tab value="validations" label="Validations" />
                  <Tab value="enrichments" label="Enrichments" />
                </Tabs>
              </Stack>
            </Paper>
            {catalogTab === 'validations' ? (
              <CatalogSelector
                items={validationCatalog}
                selectedIds={selectedValidations}
                onToggle={handleToggleValidation}
                onClear={handleClearValidations}
                searchPlaceholder="Search validations..."
                columns={validationColumns}
                getSearchText={validationSearchText}
                tableAriaLabel="Validation catalog table"
              />
            ) : (
              <CatalogSelector
                items={enrichmentCatalog}
                selectedIds={selectedEnrichments}
                onToggle={handleToggleEnrichment}
                onClear={handleClearEnrichments}
                searchPlaceholder="Search enrichments..."
                columns={enrichmentColumns}
                getSearchText={enrichmentSearchText}
                tableAriaLabel="Enrichment catalog table"
              />
            )}
          </Stack>
        );
      case 3:
        return (
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2.5}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1">Workflow Definition</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Why this matters: the CPX State Manager uses this FSM to enforce lifecycle guarantees.
                  </Typography>
                </Stack>
                <Grid container spacing={2.5}>
                  <Grid size={{ xs: 12 }}>
                    <Stack spacing={2}>
                      <WorkflowDefinitionFields
                        value={snapshot.workflow}
                        onChange={(workflow) => updateSnapshot((prev) => ({ ...prev, workflow }))}
                        helperText="Define a clean lifecycle path with explicit states and events."
                      />
                      <Stack
                        direction={{ xs: 'column', md: 'row' }}
                        spacing={1}
                        alignItems={{ xs: 'stretch', md: 'center' }}
                        justifyContent="space-between"
                      >
                        <Tabs value={workflowTab} onChange={(_, value) => setWorkflowTab(value as WorkflowTabKey)}>
                          <Tab
                            value="transitions"
                            label={renderWorkflowTabLabel('Transitions', workflowLintCounts.transitions)}
                          />
                          <Tab value="state" label={renderWorkflowTabLabel('State View', workflowLintCounts.state)} />
                          <Tab value="yaml" label={renderWorkflowTabLabel('YAML Preview', workflowLintCounts.yaml)} />
                        </Tabs>
                        <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                          <Badge
                            color={workflowLint.errors.length > 0 ? 'error' : 'warning'}
                            badgeContent={workflowLintIssueCount}
                            invisible={workflowLintIssueCount === 0}
                          >
                            <Button
                              size="small"
                              variant={workflowSidePanel === 'lint' ? 'contained' : 'outlined'}
                              onClick={() =>
                                setWorkflowSidePanel((prev) => (prev === 'lint' ? null : 'lint'))
                              }
                            >
                              Lint Checks
                            </Button>
                          </Badge>
                          <Button
                            size="small"
                            variant={workflowSidePanel === 'help' ? 'contained' : 'outlined'}
                            onClick={() => setWorkflowSidePanel((prev) => (prev === 'help' ? null : 'help'))}
                          >
                            Quick Help
                          </Button>
                        </Stack>
                      </Stack>
                      <WorkflowTabPanels
                        value={snapshot.workflow}
                        onChange={(workflow) => updateSnapshot((prev) => ({ ...prev, workflow }))}
                        activeTab={workflowTab}
                        focusIssue={workflowFocus?.issue ?? null}
                        focusNonce={workflowFocus?.nonce ?? 0}
                        downloadFileName={(() => {
                          const country = snapshot.countryCode.trim();
                          const flow = snapshot.workflow.workflowKey.trim();
                          if (!country || !flow) {
                            return 'workflow-fsm.yaml';
                          }
                          const sanitize = (value: string) =>
                            value
                              .toLowerCase()
                              .replace(/[^a-z0-9]+/g, '-')
                              .replace(/(^-|-$)/g, '');
                          return `${sanitize(country)}-${sanitize(flow)}-fsm.yaml`;
                        })()}
                      />
                    </Stack>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
            {workflowLint.errors.length > 0 ? (
              <Alert severity="warning">
                Resolve workflow lint errors before proceeding to review.
              </Alert>
            ) : null}
            <Drawer
              anchor="right"
              open={Boolean(workflowSidePanel)}
              onClose={() => setWorkflowSidePanel(null)}
              ModalProps={{ keepMounted: true }}
              PaperProps={{ sx: { width: { xs: '100%', sm: 360 } } }}
            >
              <Stack spacing={2} sx={{ p: 2 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle1">
                      {workflowSidePanel === 'lint' ? 'Lint Checks' : 'Quick Help'}
                    </Typography>
                    {workflowSidePanel === 'lint' ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        {workflowLint.errors.length > 0 ? (
                          <Badge color="error" badgeContent={workflowLint.errors.length}>
                            <Box sx={{ width: 6, height: 6 }} />
                          </Badge>
                        ) : null}
                        {workflowLint.warnings.length > 0 ? (
                          <Badge color="warning" badgeContent={workflowLint.warnings.length}>
                            <Box sx={{ width: 6, height: 6 }} />
                          </Badge>
                        ) : null}
                      </Stack>
                    ) : null}
                  </Stack>
                  <IconButton aria-label="Close panel" onClick={() => setWorkflowSidePanel(null)}>
                    <CloseIcon />
                  </IconButton>
                </Stack>
                <Divider />
                {workflowSidePanel === 'lint' ? (
                  <Stack spacing={1.5}>
                    {workflowLint.issues.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No lint issues detected yet.
                      </Typography>
                    ) : (
                      <Stack spacing={1}>
                        {workflowLint.errors.length > 0 ? (
                          <Stack spacing={0.5}>
                            <Typography variant="caption" color="error">
                              Errors
                            </Typography>
                            <List dense>
                              {workflowLint.errors.map((issue) => (
                                <ListItemButton key={issue.id} onClick={() => handleLintIssueClick(issue)}>
                                  <ListItemText
                                    primary={issue.message}
                                    secondary={formatWorkflowIssueContext(issue) || undefined}
                                  />
                                </ListItemButton>
                              ))}
                            </List>
                          </Stack>
                        ) : null}
                        {workflowLint.warnings.length > 0 ? (
                          <Stack spacing={0.5}>
                            <Typography variant="caption" sx={{ color: 'warning.main' }}>
                              Warnings
                            </Typography>
                            <List dense>
                              {workflowLint.warnings.map((issue) => (
                                <ListItemButton key={issue.id} onClick={() => handleLintIssueClick(issue)}>
                                  <ListItemText
                                    primary={issue.message}
                                    secondary={formatWorkflowIssueContext(issue) || undefined}
                                  />
                                </ListItemButton>
                              ))}
                            </List>
                          </Stack>
                        ) : null}
                      </Stack>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Click any issue to jump to the related state or transition.
                    </Typography>
                  </Stack>
                ) : workflowSidePanel === 'help' ? (
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Events map to runtime triggers (ex: `VALIDATE`, `CLEAR`, `OnRetry`).
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Actions run on transition and can be chained in order. Keep them deterministic.
                    </Typography>
                  </Stack>
                ) : null}
              </Stack>
            </Drawer>
          </Stack>
        );
      case 4: {
        const requestPayload = {
          countryCode: snapshot.countryCode,
          snapshot
        };

        return (
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2.5}>
                <Stack spacing={0.5}>
                  <Typography variant="subtitle1">Snapshot Summary</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Why this matters: review aligns CPX runtime components with the saved snapshot before persisting.
                  </Typography>
                </Stack>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Enabled Capabilities
                      </Typography>
                      <Typography variant="h5">{enabledCapabilities.length}</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Rule Count
                      </Typography>
                      <Typography variant="h5">
                        {selectedValidations.length + selectedEnrichments.length}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Workflow
                      </Typography>
                      <Typography variant="h5">{snapshot.workflow.states.length} states</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {workflowTransitionCount} transitions
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Enabled Capabilities</Typography>
                <Typography variant="body2" color="text.secondary">
                  Selected CPX capabilities that will be persisted with this snapshot.
                </Typography>
                {enabledCapabilities.length ? (
                  <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                    {enabledCapabilities.map((capability) => {
                      const label =
                        capabilityLabelLookup.get(capability.capabilityKey) ?? capability.capabilityKey;
                      return <Chip key={capability.capabilityKey} label={label} color="primary" variant="outlined" />;
                    })}
                  </Stack>
                ) : (
                  <Alert severity="info">No capabilities are enabled.</Alert>
                )}
                {dupCheckCapability?.enabled ? (
                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary">
                      Dup Check Static Params
                    </Typography>
                    {dupCheckStaticEntries.length ? (
                      <Stack spacing={0.5}>
                        {dupCheckStaticEntries.map(([key, value]) => (
                          <Typography key={key} variant="body2">
                            <Box component="span" sx={{ fontWeight: 600 }}>
                              {key}
                            </Box>
                            : {String(value)}
                          </Typography>
                        ))}
                      </Stack>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        No static params configured.
                      </Typography>
                    )}
                  </Stack>
                ) : null}
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Selected Rules</Typography>
                <Typography variant="body2" color="text.secondary">
                  Validations and enrichments selected for payment initiation.
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Validations ({selectedValidations.length})
                  </Typography>
                  {selectedValidations.length ? (
                    <Typography variant="body2">
                      {selectedValidationLabels.join(', ')}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No validations selected.
                    </Typography>
                  )}
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Enrichments ({selectedEnrichments.length})
                  </Typography>
                  {selectedEnrichments.length ? (
                    <Typography variant="body2">
                      {selectedEnrichmentLabels.join(', ')}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No enrichments selected.
                    </Typography>
                  )}
                </Stack>
              </Stack>
            </Paper>
            <SectionCard title="Snapshot JSON Preview" subtitle="Payload that will be persisted to CPX backend.">
              <JsonMonacoPanel
                ariaLabel="Snapshot JSON preview"
                value={requestPayload}
                readOnly
                onCopyError={() => showError('Copy failed. Select the JSON and copy manually.')}
              />
            </SectionCard>
          </Stack>
        );
      }
      default:
        return null;
    }
  };

  return (
    <Stack spacing={3}>
      <SectionCard
        title="Create Snapshot Wizard"
        subtitle="Complete the CPX onboarding snapshot in guided steps with clear validation at each stage."
        actions={
          <FormControlLabel
            sx={{ m: 0, '& .MuiFormControlLabel-label': { textAlign: 'left' } }}
            control={<Switch checked={advancedJson} onChange={(_, checked) => setAdvancedJson(checked)} />}
            label="Advanced JSON"
          />
        }
      >
        <Typography variant="body2" color="text.secondary">
          Defaults are prefilled so a minimal snapshot can be completed quickly without dense manual entry.
        </Typography>
      </SectionCard>

      {advancedJson ? (
        <SectionCard
          title="Advanced JSON"
          subtitle="Edit the full snapshot payload; changes sync back into the wizard."
        >
          <Stack spacing={2}>
            <JsonMonacoPanel
              ariaLabel="Snapshot JSON editor"
              value={jsonValue}
              onChange={handleJsonChange}
              showCopy={false}
            />
            {jsonError ? <Alert severity="warning">{jsonError}</Alert> : null}
          </Stack>
        </SectionCard>
      ) : null}

      <SectionCard
        title={`Step ${activeStep + 1}: ${stepLabels[activeStep]}`}
        subtitle={stepSubtitles[activeStep]}
      >
        <Stack spacing={3}>
          <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 } }}>
            <Stepper activeStep={activeStep} alternativeLabel aria-label="Snapshot wizard steps">
              {stepLabels.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
          </Paper>

          <Box
            key={activeStep}
            sx={{
              animation: 'wizardStepIn 180ms ease-out',
              '@keyframes wizardStepIn': {
                from: {
                  opacity: 0,
                  transform: stepAnimationDirection === 'forward' ? 'translateX(10px)' : 'translateX(-10px)'
                },
                to: {
                  opacity: 1,
                  transform: 'translateX(0)'
                }
              }
            }}
          >
            {renderStepContent()}
          </Box>

          <Divider />
          <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={2} justifyContent="space-between">
            <Button variant="outlined" onClick={goBack} disabled={activeStep === 0}>
              Back
            </Button>
            {activeStep < stepLabels.length - 1 ? (
              <Button variant="contained" onClick={goNext} disabled={!canProceed}>
                Next
              </Button>
            ) : (
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                disabled={
                  !stepValidations.slice(0, 4).every(Boolean) ||
                  Boolean(jsonError) ||
                  (isVersionMode ? createSnapshotVersionMutation.isPending : createSnapshotMutation.isPending)
                }
                onClick={handleSaveSnapshot}
              >
                {isVersionMode
                  ? createSnapshotVersionMutation.isPending
                    ? 'Saving...'
                    : 'Save New Version'
                  : createSnapshotMutation.isPending
                  ? 'Saving...'
                  : 'Save Snapshot'}
              </Button>
            )}
          </Stack>
        </Stack>
      </SectionCard>

      <ParamsEditorDrawer
        open={Boolean(paramsDrawerContext)}
        title={paramsDrawerContext?.title}
        description={paramsDrawerContext?.description}
        params={paramsDrawerContext?.params}
        staticParams={paramsDrawerContext?.staticParams}
        staticParamFields={paramsDrawerContext?.staticParamFields}
        onSaveStaticParams={paramsDrawerContext?.onSaveStaticParams}
        onReset={paramsDrawerContext?.onReset}
        onSave={(params) => paramsDrawerContext?.onSave(params)}
        onClose={() => setParamsDrawerContext(null)}
      />
    </Stack>
  );
}
