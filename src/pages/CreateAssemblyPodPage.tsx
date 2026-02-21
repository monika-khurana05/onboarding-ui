import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import {
  Alert,
  Button,
  Grid,
  IconButton,
  MenuItem,
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
import { useMutation, useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { getSnapshotContext, persistAssemblyConfig } from '../api/client';
import { getErrorMessage } from '../api/http';
import type { AssemblyConfigRequestDto, SnapshotContextDto } from '../api/types';
import { CapabilityConfigDrawer } from '../components/CapabilityConfigDrawer';
import { CardSection } from '../components/CardSection';
import { InlineHelpText } from '../components/InlineHelpText';
import { JsonMonacoPanel } from '../components/JsonMonacoPanel';
import { PageContainer } from '../components/PageContainer';
import { StatusChip } from '../components/StatusChip';
import { getAssemblyPodAccessRoles, hasAssemblyPodAccess } from '../lib/accessControl';
import {
  loadAssemblyConfigDraft,
  saveAssemblyConfigDraft,
  type AssemblyConfigDraftCapability
} from '../lib/storage/assemblyConfigDraftStorage';
import {
  type AssemblyCapabilityConfig,
  type ConfigStatus,
  type KafkaBinding,
  type KafkaPurpose,
  type MongoCollectionConfig,
  type MongoCollectionPurpose
} from '../models/assemblyConfig';

type ReadinessStatus = 'success' | 'pending' | 'blocked';
type DirectionOption = 'Incoming' | 'Outgoing';
type EnvironmentOption = 'DEV' | 'SIT' | 'UAT' | 'PROD';
type SnapshotReference = {
  snapshotId: string;
  countryCode: string;
  version?: number;
  createdAt: string;
};

type PrStatusRow = {
  capability: string;
  owner: string;
  prStatus: ReadinessStatus;
  prNotes: string;
};

const prStatusRows: PrStatusRow[] = [
  {
    capability: 'Payment Initiation',
    owner: 'Payments Platform',
    prStatus: 'pending',
    prNotes: 'Waiting on final pack validation.'
  },
  {
    capability: 'State Manager',
    owner: 'Core Infrastructure',
    prStatus: 'blocked',
    prNotes: 'PR requires compliance sign-off.'
  },
  {
    capability: 'Routing',
    owner: 'Network Ops',
    prStatus: 'success',
    prNotes: 'Merged to main, release ready.'
  }
];

const directionOptions: DirectionOption[] = ['Incoming', 'Outgoing'];
const environmentOptions: EnvironmentOption[] = ['DEV', 'SIT', 'UAT', 'PROD'];
const configStatusOptions: ConfigStatus[] = ['Pending', 'Submitted'];
const mongoCollectionPurposeOptions: MongoCollectionPurpose[] = [
  'TRANSACTION',
  'MEMBERSHIP',
  'PSP_DATA',
  'DUPCHECK',
  'OTHER'
];

function createRowId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `cap-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function cloneConfigRow(row: AssemblyCapabilityConfig): AssemblyCapabilityConfig {
  return {
    ...row,
    primaryArtifact: { ...row.primaryArtifact },
    additionalArtifacts: row.additionalArtifacts.map((entry) => ({ ...entry })),
    pipelineKey: row.pipelineKey,
    kafkaBindings: row.kafkaBindings.map((binding) => ({ ...binding })),
    mongoEnabled: row.mongoEnabled,
    mongoSslEnable: row.mongoSslEnable,
    mongoServers: [...row.mongoServers],
    mongoUsername: row.mongoUsername,
    mongoPasswordRef: row.mongoPasswordRef,
    mongoAuthDb: row.mongoAuthDb,
    trustStoreLocation: row.trustStoreLocation,
    trustStoreType: row.trustStoreType,
    trustStorePasswordRef: row.trustStorePasswordRef,
    mongoCollections: row.mongoCollections.map((collection) => ({ ...collection })),
    batchingMongoWriterSize: row.batchingMongoWriterSize,
    threadCount: row.threadCount,
    configFiles: [...row.configFiles],
    configPaths: [...row.configPaths],
    capabilityParams: row.capabilityParams.map((param) => ({ ...param }))
  };
}

function buildDefaultConfigRows(): AssemblyCapabilityConfig[] {
  const defaults = [
    'Payment Initiation',
    'State Manager',
    'Posting',
    'Liquidity',
    'Clearing',
    'Sanctions - Data'
  ];
  return defaults.map((capabilityName) => ({
    id: createRowId(),
    capabilityName,
    primaryArtifact: {
      groupId: '',
      artifactId: '',
      version: ''
    },
    additionalArtifacts: [],
    ownerName: '',
    status: 'Pending',
    pipelineKey: '',
    kafkaBindings: [],
    mongoEnabled: false,
    mongoSslEnable: false,
    mongoServers: [],
    mongoDatabase: '',
    mongoUsername: '',
    mongoPasswordRef: '',
    mongoAuthDb: '',
    trustStoreLocation: '',
    trustStoreType: '',
    trustStorePasswordRef: '',
    mongoCollections: [],
    batchingMongoWriterSize: undefined,
    threadCount: undefined,
    configFiles: [],
    configPaths: [],
    capabilityParams: [],
    lastUpdated: new Date().toISOString()
  }));
}

function normalizeCountryCode(value: string): string {
  return value.trim().toUpperCase();
}

function loadSnapshotReferences(): SnapshotReference[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const stored = window.localStorage.getItem('cpx.snapshot.refs');
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as SnapshotReference[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.countryCode === 'string' && typeof item.snapshotId === 'string')
      .map((item) => ({
        snapshotId: item.snapshotId,
        countryCode: normalizeCountryCode(item.countryCode),
        version: typeof item.version === 'number' ? item.version : undefined,
        createdAt: item.createdAt ?? ''
      }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

function toSnapshotVersion(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

function normalizeDirection(value: unknown): DirectionOption | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (['incoming', 'inbound', 'in'].includes(normalized)) {
    return 'Incoming';
  }
  if (['outgoing', 'outbound', 'out'].includes(normalized)) {
    return 'Outgoing';
  }
  return undefined;
}

function normalizeEnvironment(value: unknown): EnvironmentOption | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const normalized = value.trim().toUpperCase();
  if (environmentOptions.includes(normalized as EnvironmentOption)) {
    return normalized as EnvironmentOption;
  }
  return undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((entry): entry is string => typeof entry === 'string')
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n]/)
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeMongoCollections(value: unknown): MongoCollectionConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const collections: MongoCollectionConfig[] = [];
  value.forEach((entry) => {
    if (typeof entry === 'string') {
      const name = entry.trim();
      if (!name) {
        return;
      }
      collections.push({
        id: createRowId(),
        name,
        purpose: 'OTHER',
        retentionDays: undefined,
        indexesNotes: ''
      });
      return;
    }
    if (entry && typeof entry === 'object') {
      const record = entry as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name : '';
      const rawPurpose = typeof record.purpose === 'string' ? record.purpose.toUpperCase() : '';
      const purpose = mongoCollectionPurposeOptions.includes(rawPurpose as MongoCollectionPurpose)
        ? (rawPurpose as MongoCollectionPurpose)
        : 'OTHER';
      const retentionRaw = record.retentionDays;
      const retentionValue =
        typeof retentionRaw === 'number'
          ? retentionRaw
          : typeof retentionRaw === 'string' && retentionRaw.trim()
            ? Number(retentionRaw)
            : undefined;
      collections.push({
        id: typeof record.id === 'string' ? record.id : createRowId(),
        name,
        purpose,
        retentionDays: Number.isFinite(retentionValue) ? retentionValue : undefined,
        indexesNotes: typeof record.indexesNotes === 'string' ? record.indexesNotes : ''
      });
    }
  });
  return collections;
}

function normalizeSnapshotContext(raw: SnapshotContextDto) {
  const record = raw as Record<string, unknown>;
  const snapshotRecord = record.snapshot && typeof record.snapshot === 'object' ? (record.snapshot as Record<string, unknown>) : undefined;
  const snapshotVersion =
    toSnapshotVersion(record.snapshotVersion) ??
    toSnapshotVersion(record.version) ??
    (snapshotRecord ? toSnapshotVersion(snapshotRecord.version ?? snapshotRecord.currentVersion) : undefined);
  const direction =
    normalizeDirection(record.direction) ??
    normalizeDirection(record.flowDirection) ??
    normalizeDirection(record.trafficDirection);
  const environment =
    normalizeEnvironment(record.environment) ??
    normalizeEnvironment(record.env) ??
    normalizeEnvironment(record.targetEnvironment);

  return { snapshotVersion, direction, environment };
}

function normalizeDraftCapability(capability: AssemblyConfigDraftCapability): AssemblyCapabilityConfig {
  const primaryArtifact =
    capability.primaryArtifact ??
    (capability.artifactVersion || capability.versionArtifact || capability.artifactName || capability.artifactRepo
      ? {
          groupId: capability.artifactRepo ?? '',
          artifactId: capability.artifactName ?? '',
          version: capability.artifactVersion ?? capability.versionArtifact ?? ''
        }
      : undefined);
  const additionalArtifacts = Array.isArray(capability.additionalArtifacts)
    ? capability.additionalArtifacts.map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : createRowId(),
        groupId: typeof entry.groupId === 'string' ? entry.groupId : '',
        artifactId: typeof entry.artifactId === 'string' ? entry.artifactId : '',
        version: typeof entry.version === 'string' ? entry.version : '',
        notes: typeof entry.notes === 'string' ? entry.notes : ''
      }))
    : [];
  const kafkaBindings: KafkaBinding[] = Array.isArray(capability.kafkaBindings)
    ? capability.kafkaBindings.map((entry) => ({
        id: typeof entry.id === 'string' ? entry.id : createRowId(),
        purpose: (entry.purpose as KafkaPurpose) ?? 'OTHER',
        topicName: typeof entry.topicName === 'string' ? entry.topicName : '',
        clusterAlias: typeof entry.clusterAlias === 'string' ? entry.clusterAlias : '',
        consumerGroup: typeof entry.consumerGroup === 'string' ? entry.consumerGroup : '',
        keySchema: typeof entry.keySchema === 'string' ? entry.keySchema : '',
        valueSchema: typeof entry.valueSchema === 'string' ? entry.valueSchema : '',
        partitionCount: typeof entry.partitionCount === 'number' ? entry.partitionCount : undefined,
        replicationFactor: typeof entry.replicationFactor === 'number' ? entry.replicationFactor : undefined,
        notes: typeof entry.notes === 'string' ? entry.notes : ''
      }))
    : Array.isArray(capability.kafkaTopics)
      ? capability.kafkaTopics.map((topic) => ({
          id: createRowId(),
          purpose: 'OTHER' as KafkaPurpose,
          topicName: typeof topic === 'string' ? topic : '',
          clusterAlias: '',
          consumerGroup: '',
          keySchema: '',
          valueSchema: '',
          partitionCount: undefined,
          replicationFactor: undefined,
          notes: ''
        }))
      : [];
  const mongoServers = normalizeStringList(capability.mongoServers);
  const mongoCollections = normalizeMongoCollections(capability.mongoCollections);
  const mongoDatabase = typeof capability.mongoDatabase === 'string' ? capability.mongoDatabase : '';
  const mongoEnabled =
    typeof capability.mongoEnabled === 'boolean'
      ? capability.mongoEnabled
      : Boolean(mongoDatabase.trim() || mongoServers.length || mongoCollections.length);
  const batchingMongoWriterSize =
    typeof capability.batchingMongoWriterSize === 'number'
      ? capability.batchingMongoWriterSize
      : typeof capability.batchingMongoWriterSize === 'string' && capability.batchingMongoWriterSize.trim()
        ? Number(capability.batchingMongoWriterSize)
        : undefined;
  const threadCount =
    typeof capability.threadCount === 'number'
      ? capability.threadCount
      : typeof capability.threadCount === 'string' && capability.threadCount.trim()
        ? Number(capability.threadCount)
        : undefined;
  return {
    id: capability.id || createRowId(),
    capabilityName: capability.capabilityName,
    primaryArtifact: primaryArtifact ?? { groupId: '', artifactId: '', version: '' },
    additionalArtifacts,
    ownerName: capability.ownerName ?? '',
    status: configStatusOptions.includes(capability.status as ConfigStatus)
      ? (capability.status as ConfigStatus)
      : 'Pending',
    pipelineKey: capability.pipelineKey ?? '',
    kafkaBindings,
    mongoEnabled,
    mongoSslEnable: Boolean(capability.mongoSslEnable),
    mongoServers,
    mongoDatabase,
    mongoUsername: typeof capability.mongoUsername === 'string' ? capability.mongoUsername : '',
    mongoPasswordRef: typeof capability.mongoPasswordRef === 'string' ? capability.mongoPasswordRef : '',
    mongoAuthDb: typeof capability.mongoAuthDb === 'string' ? capability.mongoAuthDb : '',
    trustStoreLocation: typeof capability.trustStoreLocation === 'string' ? capability.trustStoreLocation : '',
    trustStoreType: typeof capability.trustStoreType === 'string' ? capability.trustStoreType : '',
    trustStorePasswordRef: typeof capability.trustStorePasswordRef === 'string' ? capability.trustStorePasswordRef : '',
    mongoCollections,
    batchingMongoWriterSize: Number.isFinite(batchingMongoWriterSize) ? batchingMongoWriterSize : undefined,
    threadCount: Number.isFinite(threadCount) ? threadCount : undefined,
    configFiles: Array.isArray(capability.configFiles) ? capability.configFiles : [],
    configPaths: Array.isArray(capability.configPaths) ? capability.configPaths : [],
    capabilityParams: Array.isArray(capability.capabilityParams)
      ? capability.capabilityParams.map((entry) => ({
          id: typeof entry.id === 'string' ? entry.id : createRowId(),
          key: typeof entry.key === 'string' ? entry.key : '',
          value: typeof entry.value === 'string' ? entry.value : ''
        }))
      : [],
    lastUpdated: capability.lastUpdated ?? new Date().toISOString()
  };
}

function mapCapabilityToDto(row: AssemblyCapabilityConfig) {
  return {
    capability: row.capabilityName,
    primaryArtifact: {
      groupId: row.primaryArtifact.groupId || undefined,
      artifactId: row.primaryArtifact.artifactId || undefined,
      version: row.primaryArtifact.version || undefined
    },
    additionalArtifacts: row.additionalArtifacts.length
      ? row.additionalArtifacts.map((entry) => ({
          groupId: entry.groupId || undefined,
          artifactId: entry.artifactId || undefined,
          version: entry.version || undefined,
          notes: entry.notes || undefined
        }))
      : undefined,
    ownerName: row.ownerName || undefined,
    status: row.status,
    pipelineKey: row.pipelineKey || undefined,
    kafkaBindings: row.kafkaBindings.length
      ? row.kafkaBindings.map((binding) => ({
          purpose: binding.purpose,
          topicName: binding.topicName || undefined,
          clusterAlias: binding.clusterAlias || undefined,
          consumerGroup: binding.consumerGroup || undefined,
          keySchema: binding.keySchema || undefined,
          valueSchema: binding.valueSchema || undefined,
          partitionCount: typeof binding.partitionCount === 'number' ? binding.partitionCount : undefined,
          replicationFactor: typeof binding.replicationFactor === 'number' ? binding.replicationFactor : undefined,
          notes: binding.notes || undefined
        }))
      : undefined,
    mongoEnabled: row.mongoEnabled,
    mongoSslEnable: row.mongoSslEnable,
    mongoServers: row.mongoServers.length ? row.mongoServers : undefined,
    mongoDatabase: row.mongoDatabase || undefined,
    mongoUsername: row.mongoUsername || undefined,
    mongoPasswordRef: row.mongoPasswordRef || undefined,
    mongoAuthDb: row.mongoAuthDb || undefined,
    trustStoreLocation: row.trustStoreLocation || undefined,
    trustStoreType: row.trustStoreType || undefined,
    trustStorePasswordRef: row.trustStorePasswordRef || undefined,
    mongoCollections: row.mongoCollections.length
      ? row.mongoCollections.map((collection) => ({
          name: collection.name || undefined,
          purpose: collection.purpose,
          retentionDays: typeof collection.retentionDays === 'number' ? collection.retentionDays : undefined,
          indexesNotes: collection.indexesNotes || undefined
        }))
      : undefined,
    batchingMongoWriterSize:
      typeof row.batchingMongoWriterSize === 'number' ? row.batchingMongoWriterSize : undefined,
    threadCount: typeof row.threadCount === 'number' ? row.threadCount : undefined,
    configFiles: row.configFiles.length ? row.configFiles : undefined,
    configPaths: row.configPaths.length ? row.configPaths : undefined,
    capabilityParams: row.capabilityParams.length
      ? row.capabilityParams.map((param) => ({ key: param.key, value: param.value }))
      : undefined,
    lastUpdated: row.lastUpdated
  };
}

export function CreateAssemblyPodPage() {
  const snapshotReferences = useMemo(() => loadSnapshotReferences(), []);
  const countryOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: string[] = [];
    snapshotReferences.forEach((entry) => {
      if (!seen.has(entry.countryCode)) {
        seen.add(entry.countryCode);
        options.push(entry.countryCode);
      }
    });
    return options;
  }, [snapshotReferences]);
  const latestVersionByCountry = useMemo(() => {
    const map = new Map<string, number>();
    snapshotReferences.forEach((entry) => {
      if (typeof entry.version === 'number' && !map.has(entry.countryCode)) {
        map.set(entry.countryCode, entry.version);
      }
    });
    return map;
  }, [snapshotReferences]);

  const [countryCode, setCountryCode] = useState(() => countryOptions[0] ?? '');
  const [direction, setDirection] = useState<DirectionOption | ''>('');
  const [environment, setEnvironment] = useState<EnvironmentOption | ''>('');
  const [snapshotVersion, setSnapshotVersion] = useState(() => {
    const version = countryOptions[0] ? latestVersionByCountry.get(countryOptions[0]) : undefined;
    return typeof version === 'number' ? String(version) : '';
  });
  const [configRows, setConfigRows] = useState<AssemblyCapabilityConfig[]>(() => buildDefaultConfigRows());
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [originalRowSnapshot, setOriginalRowSnapshot] = useState<AssemblyCapabilityConfig | null>(null);

  const hasAccess = hasAssemblyPodAccess();
  const pendingPrs = prStatusRows.filter((row) => row.prStatus !== 'success');
  const allReady = pendingPrs.length === 0;
  const ownerList = useMemo(() => {
    const owners = configRows.map((row) => row.ownerName.trim()).filter(Boolean);
    const fallbackOwners = prStatusRows.map((row) => row.owner);
    return Array.from(new Set(owners.length ? owners : fallbackOwners));
  }, [configRows]);

  const snapshotContextQuery = useQuery({
    queryKey: ['snapshot-context', countryCode],
    queryFn: () => getSnapshotContext(countryCode),
    enabled: Boolean(countryCode),
    meta: { suppressGlobalError: true }
  });

  const persistMutation = useMutation({
    mutationFn: (payload: AssemblyConfigRequestDto) => persistAssemblyConfig(payload),
    meta: { suppressGlobalError: true }
  });

  useEffect(() => {
    if (!countryCode) {
      setSnapshotVersion('');
      return;
    }
    const fallbackVersion = latestVersionByCountry.get(countryCode);
    if (typeof fallbackVersion === 'number') {
      setSnapshotVersion(String(fallbackVersion));
    } else {
      setSnapshotVersion('');
    }
  }, [countryCode, latestVersionByCountry]);

  useEffect(() => {
    if (!countryCode) {
      setConfigRows(buildDefaultConfigRows());
      return;
    }
    const draft = loadAssemblyConfigDraft(countryCode);
    if (draft?.capabilities?.length) {
      setConfigRows(draft.capabilities.map(normalizeDraftCapability));
      if (draft.direction) {
        setDirection(normalizeDirection(draft.direction) ?? '');
      }
      if (draft.environment) {
        setEnvironment(normalizeEnvironment(draft.environment) ?? '');
      }
      if (draft.snapshotVersion) {
        setSnapshotVersion(draft.snapshotVersion);
      }
      return;
    }
    setConfigRows(buildDefaultConfigRows());
  }, [countryCode]);

  useEffect(() => {
    if (!snapshotContextQuery.data) {
      return;
    }
    const normalized = normalizeSnapshotContext(snapshotContextQuery.data);
    if (typeof normalized.snapshotVersion === 'number') {
      setSnapshotVersion(String(normalized.snapshotVersion));
    }
    if (normalized.direction) {
      setDirection(normalized.direction);
    }
    if (normalized.environment) {
      setEnvironment(normalized.environment);
    }
  }, [snapshotContextQuery.data]);

  useEffect(() => {
    if (!countryCode) {
      return;
    }
    const timeout = window.setTimeout(() => {
      saveAssemblyConfigDraft({
        schemaVersion: '1.0',
        countryCode,
        updatedAt: new Date().toISOString(),
        direction: direction || undefined,
        environment: environment || undefined,
        snapshotVersion: snapshotVersion || undefined,
        capabilities: configRows
      });
      setDraftSavedAt(new Date().toLocaleTimeString());
    }, 600);
    return () => window.clearTimeout(timeout);
  }, [countryCode, configRows, direction, environment, snapshotVersion]);

  const handleConfigUpdate = (index: number, patch: Partial<AssemblyCapabilityConfig>) => {
    const now = new Date().toISOString();
    setConfigRows((prev) =>
      prev.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch, lastUpdated: now } : row))
    );
  };

  const handleAddCapability = () => {
    setConfigRows((prev) => [
      ...prev,
      {
        id: createRowId(),
        capabilityName: '',
        primaryArtifact: {
          groupId: '',
          artifactId: '',
          version: ''
        },
        additionalArtifacts: [],
        ownerName: '',
        status: 'Pending',
        pipelineKey: '',
        kafkaBindings: [],
        mongoEnabled: false,
        mongoSslEnable: false,
        mongoServers: [],
        mongoDatabase: '',
        mongoUsername: '',
        mongoPasswordRef: '',
        mongoAuthDb: '',
        trustStoreLocation: '',
        trustStoreType: '',
        trustStorePasswordRef: '',
        mongoCollections: [],
        batchingMongoWriterSize: undefined,
        threadCount: undefined,
        configFiles: [],
        configPaths: [],
        capabilityParams: [],
        lastUpdated: new Date().toISOString()
      }
    ]);
  };

  const handleRemoveCapability = (index: number) => {
    setConfigRows((prev) => prev.filter((_, rowIndex) => rowIndex !== index));
    if (activeRowId && configRows[index]?.id === activeRowId) {
      setDrawerOpen(false);
      setActiveRowId(null);
    }
  };

  const handleDuplicateCapability = (index: number) => {
    setConfigRows((prev) => {
      const target = prev[index];
      if (!target) {
        return prev;
      }
      const clone = {
        ...target,
        primaryArtifact: { ...target.primaryArtifact },
        additionalArtifacts: target.additionalArtifacts.map((entry) => ({ ...entry, id: createRowId() })),
        pipelineKey: target.pipelineKey,
        kafkaBindings: target.kafkaBindings.map((binding) => ({ ...binding, id: createRowId() })),
        mongoEnabled: target.mongoEnabled,
        mongoSslEnable: target.mongoSslEnable,
        mongoServers: [...target.mongoServers],
        mongoUsername: target.mongoUsername,
        mongoPasswordRef: target.mongoPasswordRef,
        mongoAuthDb: target.mongoAuthDb,
        trustStoreLocation: target.trustStoreLocation,
        trustStoreType: target.trustStoreType,
        trustStorePasswordRef: target.trustStorePasswordRef,
        mongoCollections: target.mongoCollections.map((collection) => ({ ...collection, id: createRowId() })),
        batchingMongoWriterSize: target.batchingMongoWriterSize,
        threadCount: target.threadCount,
        configFiles: [...target.configFiles],
        configPaths: [...target.configPaths],
        capabilityParams: target.capabilityParams.map((param) => ({ ...param, id: createRowId() })),
        id: createRowId(),
        lastUpdated: new Date().toISOString()
      };
      return [...prev.slice(0, index + 1), clone, ...prev.slice(index + 1)];
    });
  };

  const handleOpenDrawer = (rowId: string) => {
    const row = configRows.find((item) => item.id === rowId);
    setOriginalRowSnapshot(row ? cloneConfigRow(row) : null);
    persistMutation.reset();
    setActiveRowId(rowId);
    setDrawerOpen(true);
  };

  const handleCancelDrawer = () => {
    if (activeRowId && originalRowSnapshot) {
      setConfigRows((prev) =>
        prev.map((row) => (row.id === activeRowId ? cloneConfigRow(originalRowSnapshot) : row))
      );
    }
    setDrawerOpen(false);
    setActiveRowId(null);
    setOriginalRowSnapshot(null);
    persistMutation.reset();
  };

  const handleCloseDrawer = () => {
    handleCancelDrawer();
  };

  const activeRow = useMemo(
    () => (activeRowId ? configRows.find((row) => row.id === activeRowId) ?? null : null),
    [activeRowId, configRows]
  );
  const activeRowIndex = useMemo(
    () => (activeRowId ? configRows.findIndex((row) => row.id === activeRowId) : -1),
    [activeRowId, configRows]
  );
  const updateActiveRow = (patch: Partial<AssemblyCapabilityConfig>) => {
    if (activeRowIndex < 0) {
      return;
    }
    handleConfigUpdate(activeRowIndex, patch);
  };

  const buildPersistPayloadForRow = (row: AssemblyCapabilityConfig): AssemblyConfigRequestDto | null => {
    if (!countryCode) {
      return null;
    }
    const versionValue = snapshotVersion ? Number.parseInt(snapshotVersion, 10) : undefined;
    return {
      countryCode,
      snapshotVersion: Number.isNaN(versionValue ?? Number.NaN) ? undefined : versionValue,
      direction: direction || undefined,
      environment: environment || undefined,
      capabilities: [mapCapabilityToDto(row)]
    };
  };

  const handleSaveDrawer = async () => {
    if (!activeRow) {
      return;
    }
    const payload = buildPersistPayloadForRow(activeRow);
    if (!payload) {
      return;
    }
    await persistMutation.mutateAsync(payload);
    handleConfigUpdate(activeRowIndex, { status: 'Submitted' });
    setOriginalRowSnapshot(null);
    setDrawerOpen(false);
    setActiveRowId(null);
  };

  const buildPersistPayload = (): AssemblyConfigRequestDto | null => {
    if (!countryCode) {
      return null;
    }
    const versionValue = snapshotVersion ? Number.parseInt(snapshotVersion, 10) : undefined;
    return {
      countryCode,
      snapshotVersion: Number.isNaN(versionValue ?? Number.NaN) ? undefined : versionValue,
      direction: direction || undefined,
      environment: environment || undefined,
      capabilities: configRows.map(mapCapabilityToDto)
    };
  };

  const handlePersist = async () => {
    const payload = buildPersistPayload();
    if (!payload) {
      return;
    }
    await persistMutation.mutateAsync(payload);
  };

  const canPersist = Boolean(countryCode) && configRows.length > 0;

  const metadataPreview = useMemo(
    () => ({
      assemblyPodId: 'ap-2026-02-21-001',
      countryCode: countryCode || 'n/a',
      snapshotVersion: snapshotVersion ? Number(snapshotVersion) : undefined,
      direction: direction || undefined,
      environment: environment || undefined,
      releaseWindow: '2026-03-05',
      owners: ownerList,
      artifacts: {
        configurationBundle: 'cpx-gb-assembly-pod-v3',
        automationJob: 'assembly-pr-automation'
      }
    }),
    [countryCode, direction, environment, ownerList, snapshotVersion]
  );

  if (!hasAccess) {
    return (
      <PageContainer
        title="Create Assembly Pod"
        subtitle="Aggregate capability owner configuration and package assembly PR bundles."
      >
        <CardSection
          title="Access Restricted"
          subtitle="This workflow is limited to onboarding admins and capability owners."
        >
          <Alert severity="warning">
            Your current role does not permit access to assembly pod configuration. Required roles:{' '}
            {getAssemblyPodAccessRoles().join(', ')}.
          </Alert>
        </CardSection>
      </PageContainer>
    );
  }

  return (
    <PageContainer
      title="Create Assembly Pod"
      subtitle="Collect capability configuration and generate assembly deployment once all PRs are merged."
    >
      <CardSection
        title="Country Context"
        subtitle="Capture the onboarding context that anchors assembly pod metadata."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="Country Code"
              value={countryCode}
              onChange={(event) => setCountryCode(event.target.value)}
              SelectProps={{ displayEmpty: true }}
              helperText={countryOptions.length === 0 ? 'No snapshots available yet.' : ' '}
            >
              <MenuItem value="">
                <em>Select country</em>
              </MenuItem>
              {countryOptions.map((code) => (
                <MenuItem key={code} value={code}>
                  {code}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              fullWidth
              label="Direction"
              value={direction}
              onChange={(event) => setDirection(event.target.value as DirectionOption)}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Select direction</em>
              </MenuItem>
              {directionOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Snapshot Version"
              value={snapshotVersion}
              InputProps={{ readOnly: true }}
              helperText={snapshotVersion ? 'Auto-filled from snapshot context.' : ' '}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              select
              fullWidth
              label="Environment"
              value={environment}
              onChange={(event) => setEnvironment(event.target.value as EnvironmentOption)}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">
                <em>Select environment</em>
              </MenuItem>
              {environmentOptions.map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={0.5}>
              {snapshotContextQuery.isFetching ? (
                <InlineHelpText>Loading snapshot metadata...</InlineHelpText>
              ) : null}
              {snapshotContextQuery.isError ? (
                <Alert severity="warning">
                  Snapshot context failed to load. {getErrorMessage(snapshotContextQuery.error)}
                </Alert>
              ) : null}
            </Stack>
          </Grid>
        </Grid>
      </CardSection>

      <CardSection
        title="Capability Summary Table"
        subtitle="Review one row per capability and open the drawer to configure details."
        actions={
          <Stack spacing={0.5} alignItems={{ xs: 'stretch', md: 'flex-end' }}>
            <Button
              variant="outlined"
              onClick={() => void handlePersist()}
              disabled={!canPersist || persistMutation.isPending}
            >
              {persistMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
            <InlineHelpText>
              {persistMutation.isSuccess ? 'Saved to backend.' : ' '}
            </InlineHelpText>
          </Stack>
        }
      >
        <TableContainer>
          <Table size="small" aria-label="Capability configuration summary table" sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell>Capability</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Config Status</TableCell>
                <TableCell>Artifact Version</TableCell>
                <TableCell>Kafka Topics</TableCell>
                <TableCell>Mongo</TableCell>
                <TableCell>Last Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configRows.map((row, index) => {
                const kafkaTopicList = row.kafkaBindings.map((binding) => binding.topicName).filter(Boolean);
                const kafkaTooltipItems = kafkaTopicList.slice(0, 3);
                const kafkaTooltip =
                  kafkaTooltipItems.length === 0
                    ? 'No topics'
                    : `${kafkaTooltipItems.join(', ')}${kafkaTopicList.length > 3 ? ', …' : ''}`;
                const mongoCollectionNames = row.mongoCollections.map((collection) => collection.name).filter(Boolean);
                const mongoCollectionCount = row.mongoCollections.length;
                const mongoLabel = row.mongoEnabled
                  ? `${row.mongoDatabase || 'Mongo'} (${mongoCollectionCount} collections)`
                  : '—';
                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Typography variant="subtitle2">{row.capabilityName || 'Untitled capability'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.ownerName || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.status}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{row.primaryArtifact.version || '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Tooltip title={kafkaTooltip}>
                        <Typography variant="body2">
                          {row.kafkaBindings.length ? `${row.kafkaBindings.length} topics` : '—'}
                        </Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Tooltip
                        title={
                          row.mongoEnabled
                            ? mongoCollectionNames.length
                              ? mongoCollectionNames.join(', ')
                              : 'No collections'
                            : 'Mongo not enabled'
                        }
                      >
                        <Typography variant="body2">{mongoLabel}</Typography>
                      </Tooltip>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {row.lastUpdated ? new Date(row.lastUpdated).toLocaleString() : '—'}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button size="small" variant="text" onClick={() => handleOpenDrawer(row.id)}>
                          Configure
                        </Button>
                        <Tooltip title="Duplicate row">
                          <IconButton aria-label="Duplicate capability" onClick={() => handleDuplicateCapability(index)}>
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Remove row">
                          <IconButton aria-label="Remove capability" onClick={() => handleRemoveCapability(index)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <Stack spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AddCircleOutlineIcon />}
            onClick={handleAddCapability}
          >
            Add Capability
          </Button>
          <InlineHelpText>
            {draftSavedAt ? `Draft saved locally at ${draftSavedAt}.` : 'Drafts are saved automatically.'}
          </InlineHelpText>
          {persistMutation.isError ? (
            <Alert severity="warning">
              Failed to save configuration. {getErrorMessage(persistMutation.error)}
            </Alert>
          ) : null}
        </Stack>
      </CardSection>

      <CapabilityConfigDrawer
        open={drawerOpen}
        capability={activeRow}
        context={{
          countryCode,
          direction: direction || undefined,
          environment: environment || undefined,
          snapshotVersion: snapshotVersion || undefined
        }}
        saving={persistMutation.isPending}
        saveError={persistMutation.isError ? getErrorMessage(persistMutation.error) : null}
        onUpdate={updateActiveRow}
        onSave={handleSaveDrawer}
        onCancel={handleCancelDrawer}
        onClose={handleCloseDrawer}
      />

      <CardSection
        title="PR Status Tracker"
        subtitle="Track PR merge readiness across capability owners."
      >
        <TableContainer>
          <Table size="small" aria-label="PR status tracker table">
            <TableHead>
              <TableRow>
                <TableCell>Capability</TableCell>
                <TableCell>PR Status</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Notes</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {prStatusRows.map((row) => (
                <TableRow key={`${row.capability}-pr`} hover>
                  <TableCell>
                    <Typography variant="subtitle2">{row.capability}</Typography>
                  </TableCell>
                  <TableCell>
                    <StatusChip status={row.prStatus} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.owner}</Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{row.prNotes}</Typography>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </CardSection>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <CardSection
            title="Configuration Summary Panel"
            subtitle="Central metadata summary for the assembly pod bundle."
          >
            <Stack spacing={2}>
              <TextField
                fullWidth
                multiline
                minRows={3}
                label="Release Notes"
                defaultValue="Capture final configuration context for the assembly PR bundle."
              />
              <JsonMonacoPanel
                ariaLabel="Assembly pod metadata preview"
                value={metadataPreview}
                readOnly
                helperText="Preview of metadata that will be stored alongside the assembly bundle."
              />
            </Stack>
          </CardSection>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <CardSection
            title="Generate PR Section"
            subtitle="Trigger backend automation to create the assembly PR and configuration bundle."
          >
            <Stack spacing={1.5}>
              <Stack spacing={0.25}>
                <Typography variant="subtitle2">Ready Capabilities</Typography>
                <Typography variant="body2">
                  {prStatusRows.length - pendingPrs.length} / {prStatusRows.length}
                </Typography>
              </Stack>
              <InlineHelpText>
                The Generate PR action is enabled once every capability owner marks configuration and PRs as ready.
              </InlineHelpText>
              {allReady ? (
                <Alert severity="success">All capabilities are ready. You can generate the assembly PR bundle.</Alert>
              ) : (
                <Alert severity="warning">
                  Waiting on {pendingPrs.length} capability owner{pendingPrs.length === 1 ? '' : 's'} to
                  finalize configuration and PR readiness.
                </Alert>
              )}
              <Button variant="contained" disabled={!allReady}>
                Generate PR
              </Button>
            </Stack>
          </CardSection>
        </Grid>
      </Grid>
    </PageContainer>
  );
}
