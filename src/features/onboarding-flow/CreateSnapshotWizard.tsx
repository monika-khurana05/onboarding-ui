import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SearchIcon from '@mui/icons-material/Search';
import SaveIcon from '@mui/icons-material/Save';
import {
  Alert,
  Box,
  Button,
  Badge,
  Chip,
  Divider,
  FormControlLabel,
  Grid,
  InputAdornment,
  Link,
  MenuItem,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { useMutation } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { JsonMonacoPanel } from '../../components/JsonMonacoPanel';
import { ParamsEditorDrawer } from '../../components/ParamsEditorDrawer';
import { SectionCard } from '../../components/SectionCard';
import { WorkflowDefinitionFields, WorkflowTabPanels, type WorkflowTabKey } from '../../components/WorkflowEditor';
import { createSnapshot, createSnapshotVersion } from '../../api/client';
import type { SnapshotDetailDto } from '../../api/types';
import { useGlobalError } from '../../app/GlobalErrorContext';
import {
  capabilityKeys,
  type CapabilityKey,
  type RulesConfig,
  type SelectedCapability,
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
import { capabilityCatalog } from './capabilityCatalog';
import paymentInitiationCapabilityMetadata from './mock/paymentInitiationCapabilityMetadata.json';
import { CapabilityConfigDrawer } from './rules/CapabilityConfigDrawer';
import type { CapabilityDto, CapabilityMetadataDto } from './rules/types';
import { buildDefaultParams } from './rules/utils';
import { clearRulesDraft, loadRulesDraft, saveRulesDraft, type RulesDraft } from '../../lib/storage/rulesDraftStorage';
import { useRulesDraftAutosave } from '../../hooks/useRulesDraftAutosave';

type RuleType = 'validations' | 'enrichments';

type ParamsDrawerContext = {
  title: string;
  description?: string;
  params?: Record<string, any>;
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

const capabilityLabelLookup = new Map<CapabilityKey, string>(
  capabilityCatalog.map((item) => [item.key, item.label])
);

function getCapabilityIcon(_: CapabilityKey) {
  return <BuildOutlinedIcon fontSize="small" />;
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

const capabilityMetadata = paymentInitiationCapabilityMetadata as CapabilityMetadataDto;
const rulesMetadata = {
  schemaVersion: capabilityMetadata.schemaVersion,
  producer: capabilityMetadata.producer
};

function normalizeCapabilityList(metadata: CapabilityMetadataDto): CapabilityDto[] {
  return Array.isArray(metadata.capabilities) ? metadata.capabilities : [];
}

function sortCapabilities(capabilities: CapabilityDto[]): CapabilityDto[] {
  return [...capabilities].sort((left, right) => {
    const leftOrder = left.orderHint ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.orderHint ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.name.localeCompare(right.name);
  });
}

function buildSelectedCapabilities(capabilities: CapabilityDto[], kind: CapabilityDto['kind']): SelectedCapability[] {
  return sortCapabilities(capabilities.filter((capability) => capability.kind === kind)).map((capability) => ({
    id: capability.id,
    enabled: false,
    params: buildDefaultParams(capability.params ?? [])
  }));
}

function buildRulesConfigFromMetadata(metadata: CapabilityMetadataDto): RulesConfig {
  const capabilities = normalizeCapabilityList(metadata);
  return {
    metadata: {
      schemaVersion: metadata.schemaVersion,
      producer: metadata.producer
    },
    validations: buildSelectedCapabilities(capabilities, 'VALIDATION'),
    enrichments: buildSelectedCapabilities(capabilities, 'ENRICHMENT')
  };
}

function mergeSelectedCapabilities(
  defaults: SelectedCapability[],
  draft?: SelectedCapability[],
  existing?: SelectedCapability[]
): SelectedCapability[] {
  const byId = new Map<string, SelectedCapability>();
  defaults.forEach((item) => {
    byId.set(item.id, { ...item, params: { ...item.params } });
  });

  const apply = (items?: SelectedCapability[]) => {
    items?.forEach((item) => {
      const base = byId.get(item.id) ?? { id: item.id, enabled: false, params: {} };
      byId.set(item.id, {
        ...base,
        ...item,
        params: { ...base.params, ...(item.params ?? {}) }
      });
    });
  };

  apply(draft);
  apply(existing);

  const ordered = defaults.map((item) => byId.get(item.id) ?? item);
  const defaultIds = new Set(defaults.map((item) => item.id));
  byId.forEach((value, id) => {
    if (!defaultIds.has(id)) {
      ordered.push(value);
    }
  });
  return ordered;
}

function mergeRulesConfig(defaultConfig: RulesConfig, draft: RulesDraft | null, existing?: RulesConfig): RulesConfig {
  return {
    metadata: existing?.metadata ?? defaultConfig.metadata,
    validations: mergeSelectedCapabilities(defaultConfig.validations, draft?.validations, existing?.validations),
    enrichments: mergeSelectedCapabilities(defaultConfig.enrichments, draft?.enrichments, existing?.enrichments)
  };
}

const defaultSnapshot: SnapshotModel = {
  countryCode: '',
  region: undefined,
  capabilities: capabilityKeys.map((key) => ({
    capabilityKey: key,
    enabled: defaultEnabledCapabilities.has(key)
  })),
  validations: [],
  enrichments: [],
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

  const rawCapabilities = Array.isArray(raw.capabilities) ? raw.capabilities : [];
  const capabilityMap = new Map(rawCapabilities.map((cap) => [cap.capabilityKey, cap]));
  const normalizedCapabilities = capabilityKeys.map((key) => {
    const existing = capabilityMap.get(key);
    return {
      capabilityKey: key,
      enabled: existing?.enabled ?? defaultEnabledCapabilities.has(key),
      params: existing?.params
    };
  });

  return {
    countryCode: raw.countryCode ?? '',
    region: raw.region,
    capabilities: normalizedCapabilities,
    validations: Array.isArray(raw.validations) ? raw.validations : [],
    enrichments: Array.isArray(raw.enrichments) ? raw.enrichments : [],
    rulesConfig: normalizedRulesConfig,
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    workflow: mergedWorkflow,
    integrationConfig: raw.integrationConfig ?? {},
    deploymentOverrides: raw.deploymentOverrides ?? {}
  };
}

const workflowDraftStorageKey = 'onboarding:draft:v1';

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
  const rulesInitRef = useRef<string | null>(null);
  const isVersionMode = mode === 'version';

  const resolvedInitialSnapshot = useMemo(
    () => normalizeSnapshotInput(initialSnapshot ?? defaultSnapshot),
    [initialSnapshot]
  );

  const [snapshot, setSnapshot] = useState<SnapshotModel>(resolvedInitialSnapshot);
  const [jsonValue, setJsonValue] = useState(JSON.stringify(resolvedInitialSnapshot, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [paramsDrawerContext, setParamsDrawerContext] = useState<ParamsDrawerContext>(null);
  const [ruleTab, setRuleTab] = useState<RuleType>('validations');
  const [ruleSearch, setRuleSearch] = useState('');
  const [showEnabledOnly, setShowEnabledOnly] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [workflowTab, setWorkflowTab] = useState<WorkflowTabKey>('transitions');
  const [workflowFocus, setWorkflowFocus] = useState<{ issue: WorkflowLintIssue; nonce: number } | null>(null);
  const [rulesDrawerState, setRulesDrawerState] = useState<{
    capability: CapabilityDto;
    kind: RuleType;
  } | null>(null);

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


  const updateSnapshot = (
    updater: (prev: SnapshotModel) => SnapshotModel,
    source: 'form' | 'editor' = 'form'
  ) => {
    jsonUpdateSource.current = source;
    setSnapshot(updater);
  };

  useEffect(() => {
    const raw = localStorage.getItem(workflowDraftStorageKey);
    if (!raw) {
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      const draft = normalizeWorkflowDraft(parsed);
      if (!draft) {
        return;
      }
      updateSnapshot((prev) => ({ ...prev, workflow: draft }));
    } catch {
      // Ignore invalid drafts.
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(workflowDraftStorageKey, JSON.stringify(snapshot.workflow));
    } catch {
      // Ignore storage errors (e.g., quota exceeded).
    }
  }, [snapshot.workflow]);

  useEffect(() => {
    const countryCode = snapshot.countryCode.trim();
    if (!countryCode) {
      return;
    }
    if (rulesInitRef.current === countryCode) {
      return;
    }

    const defaults = buildRulesConfigFromMetadata(capabilityMetadata);
    const draft = loadRulesDraft(countryCode);

    updateSnapshot((prev) => ({
      ...prev,
      rulesConfig: mergeRulesConfig(defaults, draft, prev.rulesConfig)
    }));

    setDraftSavedAt(draft?.updatedAt ?? null);
    rulesInitRef.current = countryCode;
  }, [snapshot.countryCode]);

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

  const rulesConfig = snapshot.rulesConfig;
  const validationSelections = rulesConfig?.validations ?? [];
  const enrichmentSelections = rulesConfig?.enrichments ?? [];
  const enabledValidations = validationSelections.filter((rule) => rule.enabled);
  const enabledEnrichments = enrichmentSelections.filter((rule) => rule.enabled);
  const allCapabilities = useMemo(() => normalizeCapabilityList(capabilityMetadata), []);
  const defaultParamsById = useMemo(
    () =>
      new Map(
        allCapabilities.map((capability) => [
          capability.id,
          buildDefaultParams(capability.params ?? [])
        ])
      ),
    [allCapabilities]
  );
  const formattedDraftSavedAt = useMemo(
    () => (draftSavedAt ? new Date(draftSavedAt).toLocaleString() : null),
    [draftSavedAt]
  );

  const capabilityStateByKey = useMemo(
    () => new Map(snapshot.capabilities.map((capability) => [capability.capabilityKey, capability])),
    [snapshot.capabilities]
  );

  const enabledCapabilities = snapshot.capabilities.filter((capability) => capability.enabled);
  const hasCapabilitiesEnabled = enabledCapabilities.length > 0;

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
    Boolean(rulesConfig),
    workflowKeyValid &&
      statesValid &&
      workflowLint.errors.length === 0 &&
      transitionsValid &&
      transitionUniquenessValid,
    true
  ];

  const canProceed = stepValidations[activeStep] && !(advancedJson && jsonError);

  const rulesDraftCountry = snapshot.countryCode.trim();
  const buildRulesDraft = useCallback((): RulesDraft | null => {
    if (!rulesDraftCountry || !rulesConfig) {
      return null;
    }
    if (rulesInitRef.current !== rulesDraftCountry) {
      return null;
    }
    const metadata = rulesConfig.metadata ?? rulesMetadata;
    return {
      schemaVersion: (metadata.schemaVersion ?? '1.0') as RulesDraft['schemaVersion'],
      producer: {
        system: 'payment-initiation',
        artifact: metadata.producer?.artifact ?? 'payment-initiation-core',
        version: metadata.producer?.version ?? '0.0.0-local'
      },
      countryCode: rulesDraftCountry,
      updatedAt: new Date().toISOString(),
      validations: rulesConfig.validations,
      enrichments: rulesConfig.enrichments
    };
  }, [rulesDraftCountry, rulesConfig]);

  useRulesDraftAutosave({
    enabled: Boolean(rulesConfig) && Boolean(rulesDraftCountry),
    countryCode: rulesDraftCountry,
    buildDraft: buildRulesDraft,
    onSaved: (draft) => setDraftSavedAt(draft.updatedAt)
  });

  const handleSaveDraft = () => {
    const draft = buildRulesDraft();
    if (!draft) {
      return;
    }
    saveRulesDraft(draft);
    setDraftSavedAt(draft.updatedAt);
  };

  const handleResetDraft = () => {
    if (!rulesDraftCountry) {
      return;
    }
    clearRulesDraft(rulesDraftCountry);
    const defaults = buildRulesConfigFromMetadata(capabilityMetadata);
    updateSnapshot((prev) => ({
      ...prev,
      rulesConfig: defaults
    }));
    setDraftSavedAt(null);
  };

  const updateRulesConfig = (kind: RuleType, updater: (prev: SelectedCapability[]) => SelectedCapability[]) => {
    updateSnapshot((prev) => {
      const current = prev.rulesConfig ?? buildRulesConfigFromMetadata(capabilityMetadata);
      return {
        ...prev,
        rulesConfig: {
          ...current,
          metadata: current.metadata ?? rulesMetadata,
          [kind]: updater(current[kind])
        }
      };
    });
  };

  const handleToggleAll = (kind: RuleType, enabled: boolean) => {
    updateRulesConfig(kind, (prev) => prev.map((rule) => ({ ...rule, enabled })));
  };

  const handleToggleRule = (kind: RuleType, capability: CapabilityDto, enabled: boolean) => {
    updateRulesConfig(kind, (prev) => {
      const existing = prev.find((rule) => rule.id === capability.id);
      if (!existing) {
        const defaults = defaultParamsById.get(capability.id) ?? {};
        return [...prev, { id: capability.id, enabled, params: defaults }];
      }
      return prev.map((rule) => {
        if (rule.id !== capability.id) {
          return rule;
        }
        if (!enabled) {
          return { ...rule, enabled };
        }
        const defaults = defaultParamsById.get(rule.id) ?? {};
        const hasParams = Object.keys(rule.params ?? {}).length > 0;
        return {
          ...rule,
          enabled,
          params: hasParams ? rule.params : defaults
        };
      });
    });
  };

  const openCapabilityDrawer = (kind: RuleType, capability: CapabilityDto) => {
    setRulesDrawerState({ kind, capability });
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

  const openParamsDrawer = (
    title: string,
    params: Record<string, any> | undefined,
    onSave: (next: Record<string, any>) => void,
    description?: string
  ) => {
    setParamsDrawerContext({ title, params, onSave, description });
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
                                  openParamsDrawer(
                                    `${item.label} Params`,
                                    capability?.params,
                                    (params) =>
                                      updateSnapshot((prev) => ({
                                        ...prev,
                                        capabilities: prev.capabilities.map((cap) =>
                                          cap.capabilityKey === item.key ? { ...cap, params } : cap
                                        )
                                      })),
                                    item.description
                                  )
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
        {
          const activeKind = ruleTab === 'validations' ? 'VALIDATION' : 'ENRICHMENT';
          const selections = ruleTab === 'validations' ? validationSelections : enrichmentSelections;
          const selectionMap = new Map(selections.map((rule) => [rule.id, rule]));
          const searchable = ruleSearch.trim().toLowerCase();

          const filteredCapabilities = sortCapabilities(
            allCapabilities.filter((capability) => capability.kind === activeKind)
          ).filter((capability) => {
            const selected = selectionMap.get(capability.id);
            if (showEnabledOnly && !selected?.enabled) {
              return false;
            }
            if (!searchable) {
              return true;
            }
            const haystack = `${capability.id} ${capability.name} ${capability.description}`.toLowerCase();
            return haystack.includes(searchable);
          });

          return (
            <Stack spacing={3}>
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={2}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">Rule Scope</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Choose which rule set to edit and keep each set focused on one purpose.
                    </Typography>
                  </Stack>
                  <Tabs
                    value={ruleTab}
                    onChange={(_, value) => setRuleTab(value as RuleType)}
                    aria-label="Rule type tabs"
                  >
                    <Tab value="validations" label="Validations" />
                    <Tab value="enrichments" label="Enrichments" />
                  </Tabs>
                </Stack>
              </Paper>
              <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
                <Stack spacing={2.5}>
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle1">
                      {ruleTab === 'validations' ? 'Validation Rules' : 'Enrichment Rules'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Why this matters: CPX validation and enrichment rules must be deterministic to preserve flow
                      integrity.
                    </Typography>
                  </Stack>
                  <Stack spacing={1.5}>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      alignItems={{ xs: 'stretch', md: 'center' }}
                    >
                      <TextField
                        size="small"
                        value={ruleSearch}
                        onChange={(event) => setRuleSearch(event.target.value)}
                        placeholder="Search rules..."
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <SearchIcon fontSize="small" />
                            </InputAdornment>
                          )
                        }}
                        sx={{ flex: 1, minWidth: { xs: '100%', md: 280 } }}
                      />
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button size="small" variant="outlined" onClick={() => handleToggleAll(ruleTab, true)}>
                          Enable all
                        </Button>
                        <Button size="small" variant="text" onClick={() => handleToggleAll(ruleTab, false)}>
                          Disable all
                        </Button>
                        <FormControlLabel
                          control={
                            <Switch
                              checked={showEnabledOnly}
                              onChange={(_, checked) => setShowEnabledOnly(checked)}
                            />
                          }
                          label="Show enabled only"
                        />
                      </Stack>
                    </Stack>
                    <Stack
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1.5}
                      alignItems={{ xs: 'stretch', md: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<SaveIcon />}
                          onClick={handleSaveDraft}
                          disabled={!rulesDraftCountry}
                        >
                          Save Draft
                        </Button>
                        <Button
                          size="small"
                          variant="text"
                          startIcon={<RestartAltIcon />}
                          onClick={handleResetDraft}
                          disabled={!rulesDraftCountry}
                        >
                          Reset
                        </Button>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        Draft saved locally{formattedDraftSavedAt ? ` · ${formattedDraftSavedAt}` : ''}
                      </Typography>
                    </Stack>
                  </Stack>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small" stickyHeader aria-label="Capability rules table">
                      <TableHead>
                        <TableRow>
                          <TableCell>Key</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="center">Enabled</TableCell>
                          <TableCell align="right">Params</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredCapabilities.map((capability) => {
                          const selection = selectionMap.get(capability.id);
                          const enabled = selection?.enabled ?? false;
                          const paramCount = capability.params?.length ?? 0;

                          return (
                            <TableRow key={capability.id} hover>
                              <TableCell>{capability.id}</TableCell>
                              <TableCell>{capability.name}</TableCell>
                              <TableCell>
                                <Typography variant="body2" color="text.secondary">
                                  {capability.description}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Switch
                                  checked={enabled}
                                  onChange={(_, checked) => handleToggleRule(ruleTab, capability, checked)}
                                  inputProps={{
                                    'aria-label': `Enable ${capability.id}`
                                  }}
                                />
                              </TableCell>
                              <TableCell align="right">
                                <Button
                                  size="small"
                                  variant="text"
                                  startIcon={<BuildOutlinedIcon fontSize="small" />}
                                  onClick={() => openCapabilityDrawer(ruleTab, capability)}
                                  disabled={paramCount === 0}
                                >
                                  Configure {paramCount} param{paramCount === 1 ? '' : 's'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {filteredCapabilities.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5}>
                              <Typography variant="body2" color="text.secondary">
                                No rules match the current filters.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : null}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </Paper>
            </Stack>
          );
        }
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
                  <Grid size={{ xs: 12, lg: 8 }}>
                    <Stack spacing={2}>
                      <WorkflowDefinitionFields
                        value={snapshot.workflow}
                        onChange={(workflow) => updateSnapshot((prev) => ({ ...prev, workflow }))}
                        helperText="Define a clean lifecycle path with explicit states and events."
                      />
                      <Tabs value={workflowTab} onChange={(_, value) => setWorkflowTab(value as WorkflowTabKey)}>
                        <Tab
                          value="transitions"
                          label={renderWorkflowTabLabel('Transitions', workflowLintCounts.transitions)}
                        />
                        <Tab value="state" label={renderWorkflowTabLabel('State View', workflowLintCounts.state)} />
                        <Tab value="yaml" label={renderWorkflowTabLabel('YAML Preview', workflowLintCounts.yaml)} />
                      </Tabs>
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
                  <Grid size={{ xs: 12, lg: 4 }}>
                    <Stack spacing={2}>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={1.5}>
                          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                            <Typography variant="subtitle2">Lint Checks</Typography>
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
                          </Stack>
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
                      </Paper>
                      <Paper variant="outlined" sx={{ p: 2 }}>
                        <Stack spacing={1}>
                          <Typography variant="subtitle2">Quick Help</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Events map to runtime triggers (ex: `VALIDATE`, `CLEAR`, `OnRetry`).
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Actions run on transition and can be chained in order. Keep them deterministic.
                          </Typography>
                        </Stack>
                      </Paper>
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
                        {enabledValidations.length + enabledEnrichments.length}
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
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Enabled Rules</Typography>
                <Typography variant="body2" color="text.secondary">
                  Validations and enrichments enabled for payment initiation.
                </Typography>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Validations ({enabledValidations.length})
                  </Typography>
                  {enabledValidations.length ? (
                    <Typography variant="body2">
                      {enabledValidations.map((rule) => rule.id).join(', ')}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No validations enabled.
                    </Typography>
                  )}
                </Stack>
                <Stack spacing={1}>
                  <Typography variant="caption" color="text.secondary">
                    Enrichments ({enabledEnrichments.length})
                  </Typography>
                  {enabledEnrichments.length ? (
                    <Typography variant="body2">
                      {enabledEnrichments.map((rule) => rule.id).join(', ')}
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No enrichments enabled.
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
        onSave={(params) => paramsDrawerContext?.onSave(params)}
        onClose={() => setParamsDrawerContext(null)}
      />
      <CapabilityConfigDrawer
        open={Boolean(rulesDrawerState)}
        capability={rulesDrawerState?.capability}
        selected={
          rulesDrawerState?.kind === 'validations'
            ? validationSelections.find((rule) => rule.id === rulesDrawerState?.capability.id) ?? null
            : enrichmentSelections.find((rule) => rule.id === rulesDrawerState?.capability.id) ?? null
        }
        onClose={() => setRulesDrawerState(null)}
        onSave={(params) => {
          if (!rulesDrawerState) {
            return;
          }
          updateRulesConfig(rulesDrawerState.kind, (prev) => {
            const exists = prev.some((rule) => rule.id === rulesDrawerState.capability.id);
            const next = prev.map((rule) =>
              rule.id === rulesDrawerState.capability.id ? { ...rule, params } : rule
            );
            if (exists) {
              return next;
            }
            return [
              ...next,
              {
                id: rulesDrawerState.capability.id,
                enabled: true,
                params
              }
            ];
          });
        }}
      />
    </Stack>
  );
}
