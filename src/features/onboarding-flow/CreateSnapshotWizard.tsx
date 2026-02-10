import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import AccountBalanceOutlinedIcon from '@mui/icons-material/AccountBalanceOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import SaveIcon from '@mui/icons-material/Save';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  Grid,
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
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EditableRulesTable } from '../../components/EditableRulesTable';
import { JsonMonacoPanel } from '../../components/JsonMonacoPanel';
import { LoadingState } from '../../components/LoadingState';
import { ParamsEditorDrawer } from '../../components/ParamsEditorDrawer';
import { RepoTargetsTable, type RepoDefaultsEntry, type RepoTarget } from '../../components/RepoTargetsTable';
import { SectionCard } from '../../components/SectionCard';
import { WorkflowEditor } from '../../components/WorkflowEditor';
import { createSnapshot, createSnapshotVersion, getRepoDefaults, listRepoPacks } from '../../api/client';
import type { RepoDefaultsResponseDto, SnapshotDetailDto } from '../../api/types';
import { useGlobalError } from '../../app/GlobalErrorContext';
import {
  capabilityKeys,
  type CapabilityKey,
  type SnapshotModel,
  validateCountryCodeUppercase,
  validateNoDuplicateRuleKeys,
  validateTransitionsReferToValidStates
} from '../../models/snapshot';

type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  description: string;
  helper: string;
};

type CapabilityGroup = {
  id: string;
  title: string;
  helper: string;
  items: CapabilityDefinition[];
};

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
  'Repo Targets',
  'Review & Save Snapshot'
];

const stepSubtitles = [
  'Set the country identity and baseline routing details used across generated assets.',
  'Enable only the CPX capabilities required for this onboarding rollout.',
  'Define deterministic validation and enrichment rules before workflow execution.',
  'Model the state machine that State Manager will enforce at runtime.',
  'Map output packs to repos and branches for downstream delivery.',
  'Confirm snapshot scope, then persist the final payload.'
];

const capabilityGroups: CapabilityGroup[] = [
  {
    id: 'ingress',
    title: 'Ingress / Orchestration',
    helper: 'Entry-point services that kick off onboarding and drive orchestration in the CPX runtime.',
    items: [
      {
        key: 'PAYMENT_INITIATION',
        label: 'Payment Initiation',
        description: 'Accepts onboarding requests and triggers the initial lifecycle events.',
        helper: 'Controls how new country onboarding enters the CPX pipeline.'
      },
      {
        key: 'STATE_MANAGER',
        label: 'State Manager',
        description: 'Owns lifecycle state, transitions, and persistence checkpoints.',
        helper: 'Defines the canonical FSM for country onboarding state.'
      }
    ]
  },
  {
    id: 'checks',
    title: 'Checks',
    helper: 'Validation and screening blocks that gate flow before clearing and posting.',
    items: [
      {
        key: 'VALIDATION',
        label: 'Validation',
        description: 'Schema and business rule checks for incoming payloads.',
        helper: 'Aligns to the validation lane in the CPX runtime diagram.'
      },
      {
        key: 'ENRICHMENT',
        label: 'Enrichment',
        description: 'Adds reference data and context before downstream clearing.',
        helper: 'Maps to the enrichment lane in the CPX runtime diagram.'
      },
      {
        key: 'DUPLICATE_CHECK',
        label: 'Duplicate Check',
        description: 'Detects repeat onboarding attempts across identifiers.',
        helper: 'Prevents duplicate state creation in CPX orchestration.'
      },
      {
        key: 'SANCTIONS_SCREENING',
        label: 'Sanctions Screening',
        description: 'Screens country/party data against sanctions policies.',
        helper: 'Maps to the compliance checkpoint in the CPX flow.'
      }
    ]
  },
  {
    id: 'clearing',
    title: 'Clearing & Posting',
    helper: 'Clearing paths and posting integrations once validation is complete.',
    items: [
      {
        key: 'GLS_CLEARING',
        label: 'GLS Clearing',
        description: 'Clearing setup, participant mapping, and GLS routing.',
        helper: 'Drives clearing rules in the CPX runtime lane.'
      },
      {
        key: 'REGIONAL_ROUTING',
        label: 'Regional Routing',
        description: 'Routes traffic to regional processing clusters.',
        helper: 'Controls regional fork behavior in the CPX runtime.'
      },
      {
        key: 'FLEXCUBE_POSTING',
        label: 'Flexcube Posting',
        description: 'Posts onboarding outcomes to the Flexcube ledger.',
        helper: 'Aligns to the posting step in CPX clearing.'
      }
    ]
  },
  {
    id: 'observability',
    title: 'Observability / Outputs',
    helper: 'Outputs, data lake feeds, and error handling for runtime visibility.',
    items: [
      {
        key: 'NOTIFICATIONS',
        label: 'Notifications',
        description: 'Outbound messages to stakeholders and downstream systems.',
        helper: 'Ensures CPX emits notifications on lifecycle milestones.'
      },
      {
        key: 'BIGDATA',
        label: 'Big Data',
        description: 'Pushes onboarding telemetry to analytics sinks.',
        helper: 'Feeds the CPX data lake and audit trail.'
      },
      {
        key: 'ERROR_HANDLING',
        label: 'Error Handling',
        description: 'Captures and routes failure states for recovery.',
        helper: 'Defines remediation paths in the CPX runtime diagram.'
      }
    ]
  }
];

const defaultEnabledCapabilities = new Set<CapabilityKey>(['PAYMENT_INITIATION', 'STATE_MANAGER']);

const defaultWorkflow = {
  workflowKey: 'PAYMENT_INGRESS',
  states: ['RECEIVED', 'VALIDATED', 'CLEARED'],
  transitions: [
    { from: 'RECEIVED', to: 'VALIDATED', onEvent: 'VALIDATE' },
    { from: 'VALIDATED', to: 'CLEARED', onEvent: 'CLEAR' }
  ]
};

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

const repoTargetTemplates: RepoTarget[] = [
  {
    id: 'state-manager',
    label: 'State Manager',
    description: 'FSM yaml + service config + component tests',
    matchHints: ['state-manager', 'state_manager', 'fsm'],
    enabled: true,
    repoSlug: '',
    baseBranch: 'main',
    packVersion: '',
    packOptions: [],
    loadingPacks: false
  },
  {
    id: 'payment-initiation',
    label: 'Payment Initiation',
    description: 'Validation/enrichment pipeline yaml',
    matchHints: ['payment-initiation', 'initiation', 'payment'],
    enabled: true,
    repoSlug: '',
    baseBranch: 'main',
    packVersion: '',
    packOptions: [],
    loadingPacks: false
  },
  {
    id: 'country-container',
    label: 'Country Container',
    description: 'Deployment yaml/scripts/smoke tests',
    matchHints: ['country-container', 'country', 'container'],
    enabled: true,
    repoSlug: '',
    baseBranch: 'main',
    packVersion: '',
    packOptions: [],
    loadingPacks: false
  }
];

function getCapabilityIcon(key: CapabilityKey) {
  switch (key) {
    case 'GLS_CLEARING':
      return <StorageOutlinedIcon fontSize="small" />;
    case 'SANCTIONS_SCREENING':
      return <ShieldOutlinedIcon fontSize="small" />;
    case 'FLEXCUBE_POSTING':
      return <AccountBalanceOutlinedIcon fontSize="small" />;
    case 'REGIONAL_ROUTING':
      return <AccountTreeOutlinedIcon fontSize="small" />;
    case 'STATE_MANAGER':
      return <SchemaOutlinedIcon fontSize="small" />;
    default:
      return <BuildOutlinedIcon fontSize="small" />;
  }
}

function normalizeRepoDefaults(data?: RepoDefaultsResponseDto): RepoDefaultsEntry[] {
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
        label: repo.label ?? repo.name ?? slug,
        defaultRef: repo.defaultRef ?? repo.ref ?? repo.branch ?? data.defaultRef ?? 'main'
      };
    })
    .filter((repo): repo is { slug: string; label: string; defaultRef: string } => Boolean(repo));
}

function findRepoMatch(defaults: { slug: string; label: string; defaultRef: string }[], hints: string[]) {
  const lowerHints = hints.map((hint) => hint.toLowerCase());
  return defaults.find((repo) => lowerHints.some((hint) => repo.slug.toLowerCase().includes(hint)));
}

function getSnapshotIdFromResponse(response: SnapshotDetailDto) {
  return response.snapshotId ?? response.id ?? response.snapshot_id ?? null;
}

function normalizeSnapshotInput(raw: Partial<SnapshotModel>): SnapshotModel {
  const workflow = raw.workflow ?? defaultWorkflow;
  const mergedWorkflow = {
    workflowKey: workflow.workflowKey ?? defaultWorkflow.workflowKey,
    states: Array.isArray(workflow.states) ? workflow.states : defaultWorkflow.states,
    transitions: Array.isArray(workflow.transitions) ? workflow.transitions : defaultWorkflow.transitions
  };

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
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    workflow: mergedWorkflow,
    integrationConfig: raw.integrationConfig ?? {},
    deploymentOverrides: raw.deploymentOverrides ?? {}
  };
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
  const [repoTargets, setRepoTargets] = useState<RepoTarget[]>(repoTargetTemplates);
  const [paramsDrawerContext, setParamsDrawerContext] = useState<ParamsDrawerContext>(null);
  const [ruleTab, setRuleTab] = useState<RuleType>('validations');

  const repoDefaultsQuery = useQuery({
    queryKey: ['repo-defaults-v2'],
    queryFn: getRepoDefaults
  });

  const repoDefaults = useMemo(() => normalizeRepoDefaults(repoDefaultsQuery.data), [repoDefaultsQuery.data]);

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
    if (!repoDefaults.length) {
      return;
    }
    setRepoTargets((prev) =>
      prev.map((target) => {
        if (target.repoSlug.trim()) {
          return target;
        }
        const match = findRepoMatch(repoDefaults, target.matchHints ?? []);
        if (!match) {
          return target;
        }
        return {
          ...target,
          repoSlug: match.slug,
          baseBranch: match.defaultRef
        };
      })
    );
  }, [repoDefaults]);

  const updateSnapshot = (
    updater: (prev: SnapshotModel) => SnapshotModel,
    source: 'form' | 'editor' = 'form'
  ) => {
    jsonUpdateSource.current = source;
    setSnapshot(updater);
  };

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
  const ruleKeyErrors = validateNoDuplicateRuleKeys(
    snapshot.validations,
    snapshot.enrichments,
    snapshot.actions
  );
  const transitionErrors = validateTransitionsReferToValidStates(snapshot.workflow);

  const enabledCapabilities = snapshot.capabilities.filter((capability) => capability.enabled);
  const hasCapabilitiesEnabled = enabledCapabilities.length > 0;

  const workflowKeyValid = snapshot.workflow.workflowKey.trim().length > 0;
  const statesValid = snapshot.workflow.states.length > 0;

  const transitionsValid = snapshot.workflow.transitions.every(
    (transition) =>
      snapshot.workflow.states.includes(transition.from) &&
      snapshot.workflow.states.includes(transition.to) &&
      transition.onEvent.trim().length > 0
  );

  const repoTargetsValid =
    repoTargets.filter((target) => target.enabled !== false).length > 0 &&
    repoTargets
      .filter((target) => target.enabled !== false)
      .every((target) => target.repoSlug.trim() && target.baseBranch.trim());

  const stepValidations = [
    countryErrors.length === 0,
    hasCapabilitiesEnabled,
    ruleKeyErrors.length === 0 &&
      snapshot.validations.every((rule) => rule.key.trim()) &&
      snapshot.enrichments.every((rule) => rule.key.trim()),
    workflowKeyValid &&
      statesValid &&
      transitionErrors.length === 0 &&
      transitionsValid,
    repoTargetsValid,
    true
  ];

  const canProceed = stepValidations[activeStep] && !(advancedJson && jsonError);

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
    const templatePacks = repoTargets
      .filter((target) => target.enabled !== false && target.repoSlug.trim())
      .reduce<Record<string, string>>((acc, target) => {
        const version = target.packVersion.trim();
        if (version) {
          acc[target.repoSlug] = version;
        }
        return acc;
      }, {});

    try {
      const payload = {
        countryCode: snapshot.countryCode,
        snapshot,
        templatePacks: Object.keys(templatePacks).length ? templatePacks : undefined
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
            <Stack spacing={2.5}>
              {capabilityGroups.map((group) => (
                <Paper key={group.id} variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
                  <Stack spacing={2}>
                    <Stack spacing={0.5}>
                      <Typography variant="subtitle1">{group.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {group.helper}
                      </Typography>
                    </Stack>
                    <Grid container spacing={2}>
                      {group.items.map((item) => {
                        const capability = snapshot.capabilities.find((cap) => cap.capabilityKey === item.key);
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
                                      borderRadius: 1.5,
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
                                        item.helper
                                      )
                                    }
                                  >
                                    Configure
                                  </Button>
                                </Stack>
                                <Typography variant="caption" color="text.secondary">
                                  {item.helper}
                                </Typography>
                              </Stack>
                            </Paper>
                          </Grid>
                        );
                      })}
                    </Grid>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          </Stack>
        );
      case 2:
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
                <Tabs value={ruleTab} onChange={(_, value) => setRuleTab(value as RuleType)}>
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
                {ruleTab === 'validations' ? (
                  <EditableRulesTable
                    title="Validations"
                    helperText="Validation rules gate onboarding before downstream processing."
                    rows={snapshot.validations}
                    showSeverity
                    addLabel="Add Validation"
                    onChange={(next) => updateSnapshot((prev) => ({ ...prev, validations: next }))}
                    onEditParams={(index, params) =>
                      openParamsDrawer(
                        'Validation Params',
                        params,
                        (next) =>
                          updateSnapshot((prev) => ({
                            ...prev,
                            validations: prev.validations.map((rule, ruleIndex) =>
                              ruleIndex === index ? { ...rule, params: next } : rule
                            )
                          })),
                        'Tune validation params aligned to the CPX checks lane.'
                      )
                    }
                  />
                ) : (
                  <EditableRulesTable
                    title="Enrichments"
                    helperText="Enrichment rules add contextual data to the CPX runtime payload."
                    rows={snapshot.enrichments}
                    addLabel="Add Enrichment"
                    onChange={(next) => updateSnapshot((prev) => ({ ...prev, enrichments: next }))}
                    onEditParams={(index, params) =>
                      openParamsDrawer(
                        'Enrichment Params',
                        params,
                        (next) =>
                          updateSnapshot((prev) => ({
                            ...prev,
                            enrichments: prev.enrichments.map((rule, ruleIndex) =>
                              ruleIndex === index ? { ...rule, params: next } : rule
                            )
                          })),
                        'Configure enrichment params that augment the CPX runtime payload.'
                      )
                    }
                  />
                )}
              </Stack>
            </Paper>
            {ruleKeyErrors.length ? (
              <Stack spacing={1}>
                {ruleKeyErrors.map((error) => (
                  <Alert key={error.path} severity="warning">
                    {error.message}
                  </Alert>
                ))}
              </Stack>
            ) : null}
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
                <WorkflowEditor
                  value={snapshot.workflow}
                  onChange={(workflow) => updateSnapshot((prev) => ({ ...prev, workflow }))}
                  helperText="Define a clean lifecycle path with explicit states and events."
                />
              </Stack>
            </Paper>
            {transitionErrors.length || !transitionsValid ? (
              <Alert severity="warning">Transitions must refer to valid states and include events.</Alert>
            ) : null}
          </Stack>
        );
      case 4:
        return (
          <Stack spacing={3}>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Targeting Guidance</Typography>
                <Typography variant="body2" color="text.secondary">
                  Why this matters: repo targets map CPX outputs to the correct delivery pipelines.
                </Typography>
                {repoDefaultsQuery.isLoading ? <LoadingState message="Loading repo defaults..." minHeight={120} /> : null}
                {repoDefaultsQuery.isError ? (
                  <Alert severity="warning">Repo defaults unavailable. Enter repo slugs manually.</Alert>
                ) : null}
              </Stack>
            </Paper>
            <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 } }}>
              <Stack spacing={2}>
                <Typography variant="subtitle1">Active Repo Targets</Typography>
                <Typography variant="body2" color="text.secondary">
                  Enable each destination repo and confirm branch + pack mapping before save.
                </Typography>
                <RepoTargetsTable
                  variant="wizard"
                  targets={repoTargets}
                  onChange={setRepoTargets}
                  repoDefaults={repoDefaults}
                  showValidationHint
                  showErrors
                  onDiscoverPacks={async (repoSlug, baseBranch) => {
                    const packs = await listRepoPacks(repoSlug, baseBranch);
                    return packs
                      .map((pack) => pack.packName ?? pack.name ?? pack.slug ?? '')
                      .filter(Boolean);
                  }}
                  onError={showError}
                />
              </Stack>
            </Paper>
          </Stack>
        );
      case 5: {
        const enabledTargets = repoTargets.filter((target) => target.enabled !== false);
        const templatePacks = enabledTargets.reduce<Record<string, string>>((acc, target) => {
          const version = target.packVersion.trim();
          if (target.repoSlug.trim() && version) {
            acc[target.repoSlug] = version;
          }
          return acc;
        }, {});
        const requestPayload = {
          countryCode: snapshot.countryCode,
          snapshot,
          templatePacks: Object.keys(templatePacks).length ? templatePacks : undefined
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
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Enabled Capabilities
                      </Typography>
                      <Typography variant="h5">{enabledCapabilities.length}</Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Rule Count
                      </Typography>
                      <Typography variant="h5">
                        {snapshot.validations.length + snapshot.enrichments.length}
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Workflow
                      </Typography>
                      <Typography variant="h5">{snapshot.workflow.states.length} states</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {snapshot.workflow.transitions.length} transitions
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                    <Paper variant="outlined" sx={{ p: 2.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        Target Repos
                      </Typography>
                      <Typography variant="h5">{enabledTargets.length}</Typography>
                    </Paper>
                  </Grid>
                </Grid>
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
            <Stepper activeStep={activeStep} alternativeLabel>
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
                  !stepValidations.slice(0, 5).every(Boolean) ||
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
    </Stack>
  );
}
