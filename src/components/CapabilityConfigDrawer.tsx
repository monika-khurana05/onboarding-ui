import CloseIcon from '@mui/icons-material/Close';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Alert,
  Box,
  Button,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type {
  AssemblyCapabilityConfig,
  ConfigStatus,
  KafkaBinding,
  KafkaPurpose,
  MongoCollectionConfig,
  MongoCollectionPurpose
} from '../models/assemblyConfig';
import { InlineHelpText } from './InlineHelpText';

type CapabilityConfigDrawerProps = {
  open: boolean;
  capability: AssemblyCapabilityConfig | null;
  context: {
    countryCode: string;
    direction?: string;
    environment?: string;
    snapshotVersion?: string;
  };
  canImportArtifacts?: boolean;
  onImportArtifacts?: () => void | Promise<void>;
  clusterAliases?: string[];
  saving?: boolean;
  saveError?: string | null;
  onUpdate: (patch: Partial<AssemblyCapabilityConfig>) => void;
  onSave: () => void | Promise<void>;
  onCancel: () => void;
  onClose: () => void;
};

const configStatusOptions: ConfigStatus[] = ['Pending', 'Submitted'];
const kafkaPurposeOptions: KafkaPurpose[] = ['INGRESS', 'EGRESS', 'RETRY', 'REF_DATA', 'DLQ', 'OTHER'];
const mongoCollectionPurposeOptions: MongoCollectionPurpose[] = [
  'TRANSACTION',
  'MEMBERSHIP',
  'PSP_DATA',
  'DUPCHECK',
  'OTHER'
];

function createArtifactId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `artifact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createParamId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `param-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function createCollectionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `collection-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

function formatList(values: string[]): string {
  return values.join(', ');
}

function parseList(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function CapabilityConfigDrawer({
  open,
  capability,
  context,
  canImportArtifacts = false,
  onImportArtifacts,
  clusterAliases,
  saving = false,
  saveError,
  onUpdate,
  onSave,
  onCancel,
  onClose
}: CapabilityConfigDrawerProps) {
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (open) {
      setActiveTab(0);
    }
  }, [open, capability?.id]);

  const params = capability?.capabilityParams ?? [];
  const primaryArtifact = capability?.primaryArtifact;
  const additionalArtifacts = capability?.additionalArtifacts ?? [];
  const kafkaBindings = capability?.kafkaBindings ?? [];
  const mongoCollections = capability?.mongoCollections ?? [];
  const mongoServers = capability?.mongoServers ?? [];
  const hasClusterAliases = Boolean(clusterAliases && clusterAliases.length > 0);

  const validation = useMemo(() => {
    if (!capability) {
      return { hasErrors: true, errors: {} as Record<string, string> };
    }
    const errors: Record<string, string> = {};
    if (!capability.capabilityName.trim()) {
      errors.capabilityName = 'Capability name is required.';
    }
    if (!capability.ownerName.trim()) {
      errors.ownerName = 'Owner name is required.';
    }
    if (!primaryArtifact?.artifactId.trim()) {
      errors.primaryArtifactId = 'Artifact ID is required.';
    }
    if (!primaryArtifact?.version.trim()) {
      errors.primaryArtifactVersion = 'Version is required.';
    }
    const invalidArtifact = additionalArtifacts.find((artifact) => {
      return !artifact.artifactId.trim() || !artifact.version.trim();
    });
    if (invalidArtifact) {
      errors.additionalArtifacts = 'Artifact ID and version are required for each additional artifact.';
    }
    const invalidBinding = kafkaBindings.find((binding) => {
      return !binding.purpose || !binding.topicName.trim() || !binding.clusterAlias.trim();
    });
    if (invalidBinding) {
      errors.kafkaBindings = 'Purpose, topic name, and cluster alias are required for each binding.';
    }
    const hasMongoServers = mongoServers.some((server) => server.trim());
    if (capability.mongoEnabled && !hasMongoServers) {
      errors.mongoServers = 'Mongo servers are required when Mongo is enabled.';
    }
    if (capability.mongoEnabled && !capability.mongoDatabase.trim()) {
      errors.mongoDatabase = 'Mongo database is required when Mongo is enabled.';
    }
    if (capability.mongoEnabled) {
      const invalidCollection = mongoCollections.find((collection) => !collection.name.trim());
      if (invalidCollection) {
        errors.mongoCollections = 'Collection name is required for each collection.';
      }
    }
    const invalidParam = params.find((param) => {
      const key = param.key.trim();
      const value = param.value.trim();
      return (key && !value) || (!key && value);
    });
    if (invalidParam) {
      errors.capabilityParams = 'Each parameter requires both key and value.';
    }
    return { hasErrors: Object.keys(errors).length > 0, errors };
  }, [additionalArtifacts, capability, kafkaBindings, mongoCollections, mongoServers, params, primaryArtifact]);

  const handleArtifactAdd = () => {
    if (!capability) {
      return;
    }
    onUpdate({
      additionalArtifacts: [
        ...additionalArtifacts,
        { id: createArtifactId(), groupId: '', artifactId: '', version: '', notes: '' }
      ]
    });
  };

  const handleArtifactUpdate = (
    index: number,
    patch: { groupId?: string; artifactId?: string; version?: string; notes?: string }
  ) => {
    if (!capability) {
      return;
    }
    const next = additionalArtifacts.map((artifact, rowIndex) =>
      rowIndex === index ? { ...artifact, ...patch } : artifact
    );
    onUpdate({ additionalArtifacts: next });
  };

  const handleArtifactRemove = (index: number) => {
    if (!capability) {
      return;
    }
    const next = additionalArtifacts.filter((_, rowIndex) => rowIndex !== index);
    onUpdate({ additionalArtifacts: next });
  };

  const handleBindingAdd = () => {
    if (!capability) {
      return;
    }
    const next: KafkaBinding[] = [
      ...kafkaBindings,
      {
        id: createArtifactId(),
        purpose: 'INGRESS',
        topicName: '',
        clusterAlias: '',
        consumerGroup: '',
        keySchema: '',
        valueSchema: '',
        partitionCount: undefined,
        replicationFactor: undefined,
        notes: ''
      }
    ];
    onUpdate({ kafkaBindings: next });
  };

  const handleBindingUpdate = (index: number, patch: Partial<KafkaBinding>) => {
    if (!capability) {
      return;
    }
    const next = kafkaBindings.map((binding, rowIndex) =>
      rowIndex === index ? { ...binding, ...patch } : binding
    );
    onUpdate({ kafkaBindings: next });
  };

  const handleBindingRemove = (index: number) => {
    if (!capability) {
      return;
    }
    const next = kafkaBindings.filter((_, rowIndex) => rowIndex !== index);
    onUpdate({ kafkaBindings: next });
  };

  const handleCollectionAdd = () => {
    if (!capability) {
      return;
    }
    const next: MongoCollectionConfig[] = [
      ...mongoCollections,
      {
        id: createCollectionId(),
        name: '',
        purpose: 'OTHER',
        retentionDays: undefined,
        indexesNotes: ''
      }
    ];
    onUpdate({ mongoCollections: next });
  };

  const handleCollectionUpdate = (
    index: number,
    patch: Partial<Pick<MongoCollectionConfig, 'name' | 'purpose' | 'retentionDays' | 'indexesNotes'>>
  ) => {
    if (!capability) {
      return;
    }
    const next = mongoCollections.map((collection, rowIndex) =>
      rowIndex === index ? { ...collection, ...patch } : collection
    );
    onUpdate({ mongoCollections: next });
  };

  const handleCollectionRemove = (index: number) => {
    if (!capability) {
      return;
    }
    const next = mongoCollections.filter((_, rowIndex) => rowIndex !== index);
    onUpdate({ mongoCollections: next });
  };

  const handleParamAdd = () => {
    if (!capability) {
      return;
    }
    onUpdate({
      capabilityParams: [...params, { id: createParamId(), key: '', value: '' }]
    });
  };

  const handleParamUpdate = (index: number, patch: { key?: string; value?: string }) => {
    if (!capability) {
      return;
    }
    const next = params.map((param, rowIndex) =>
      rowIndex === index ? { ...param, ...patch } : param
    );
    onUpdate({ capabilityParams: next });
  };

  const handleParamRemove = (index: number) => {
    if (!capability) {
      return;
    }
    const next = params.filter((_, rowIndex) => rowIndex !== index);
    onUpdate({ capabilityParams: next });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: '100%', sm: 420, md: 560 } } }}
    >
      <Stack spacing={2} sx={{ p: 3 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">
            {capability ? `Configure ${capability.capabilityName || 'Capability'}` : 'Configure Capability'}
          </Typography>
          <IconButton aria-label="Close configuration drawer" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
        <Stack spacing={0.25}>
          <InlineHelpText>
            Country: {context.countryCode || '—'} · Direction: {context.direction || '—'}
          </InlineHelpText>
          <InlineHelpText>
            Environment: {context.environment || '—'} · Snapshot: {context.snapshotVersion || '—'}
          </InlineHelpText>
        </Stack>
        <Divider />
        <Tabs value={activeTab} onChange={(_, value) => setActiveTab(value)} aria-label="Configuration tabs">
          <Tab label="Artifactory / Dependencies" />
          <Tab label="Kafka Topics" />
          <Tab label="Mongo DB" />
          <Tab label="Config Files & Paths" />
          <Tab label="Capability Params" />
        </Tabs>

        <Box role="tabpanel" hidden={activeTab !== 0}>
          {capability ? (
            <Stack spacing={2} sx={{ pt: 2 }}>
              <TextField
                fullWidth
                label="Capability Name"
                value={capability.capabilityName}
                onChange={(event) => onUpdate({ capabilityName: event.target.value })}
                error={Boolean(validation.errors.capabilityName)}
                helperText={validation.errors.capabilityName ?? ' '}
              />
              <TextField
                fullWidth
                label="Owner Name"
                value={capability.ownerName}
                onChange={(event) => onUpdate({ ownerName: event.target.value })}
                error={Boolean(validation.errors.ownerName)}
                helperText={validation.errors.ownerName ?? ' '}
              />
              <TextField
                select
                fullWidth
                label="Config Status"
                value={capability.status}
                onChange={(event) => onUpdate({ status: event.target.value as ConfigStatus })}
              >
                {configStatusOptions.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Primary Capability Artifact</Typography>
                <Stack spacing={1.5}>
                  <TextField
                    fullWidth
                    label="Group ID"
                    value={capability.primaryArtifact.groupId}
                    onChange={(event) =>
                      onUpdate({
                        primaryArtifact: { ...capability.primaryArtifact, groupId: event.target.value }
                      })
                    }
                  />
                  <TextField
                    fullWidth
                    label="Artifact ID"
                    value={capability.primaryArtifact.artifactId}
                    onChange={(event) =>
                      onUpdate({
                        primaryArtifact: { ...capability.primaryArtifact, artifactId: event.target.value }
                      })
                    }
                    error={Boolean(validation.errors.primaryArtifactId)}
                    helperText={validation.errors.primaryArtifactId ?? ' '}
                  />
                  <TextField
                    fullWidth
                    label="Version"
                    value={capability.primaryArtifact.version}
                    onChange={(event) =>
                      onUpdate({
                        primaryArtifact: { ...capability.primaryArtifact, version: event.target.value }
                      })
                    }
                    error={Boolean(validation.errors.primaryArtifactVersion)}
                    helperText={validation.errors.primaryArtifactVersion ?? ' '}
                  />
                </Stack>
              </Stack>
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Additional Artifacts</Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => void onImportArtifacts?.()}
                      disabled={!canImportArtifacts || !onImportArtifacts}
                    >
                      Import from Snapshot
                    </Button>
                    <Button variant="outlined" size="small" onClick={handleArtifactAdd}>
                      Add Artifact
                    </Button>
                  </Stack>
                </Stack>
                {additionalArtifacts.length === 0 ? (
                  <InlineHelpText>No additional artifacts added.</InlineHelpText>
                ) : null}
                {additionalArtifacts.map((artifact, index) => {
                  const artifactIdError = !artifact.artifactId.trim() ? 'Artifact ID required.' : '';
                  const versionError = !artifact.version.trim() ? 'Version required.' : '';
                  return (
                    <Stack key={artifact.id} spacing={1} sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          fullWidth
                          label="Group ID"
                          value={artifact.groupId}
                          onChange={(event) => handleArtifactUpdate(index, { groupId: event.target.value })}
                        />
                        <TextField
                          fullWidth
                          label="Artifact ID"
                          value={artifact.artifactId}
                          onChange={(event) => handleArtifactUpdate(index, { artifactId: event.target.value })}
                          error={Boolean(artifactIdError)}
                          helperText={artifactIdError || ' '}
                        />
                        <TextField
                          fullWidth
                          label="Version"
                          value={artifact.version}
                          onChange={(event) => handleArtifactUpdate(index, { version: event.target.value })}
                          error={Boolean(versionError)}
                          helperText={versionError || ' '}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                        <TextField
                          fullWidth
                          label="Notes"
                          value={artifact.notes ?? ''}
                          onChange={(event) => handleArtifactUpdate(index, { notes: event.target.value })}
                        />
                        <IconButton
                          aria-label="Remove artifact"
                          onClick={() => handleArtifactRemove(index)}
                          sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  );
                })}
                {validation.errors.additionalArtifacts ? (
                  <InlineHelpText>{validation.errors.additionalArtifacts}</InlineHelpText>
                ) : null}
              </Stack>
            </Stack>
          ) : null}
        </Box>

        <Box role="tabpanel" hidden={activeTab !== 1}>
          {capability ? (
            <Stack spacing={2} sx={{ pt: 2 }}>
              <Stack spacing={0.5}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="subtitle2">Pipeline Key</Typography>
                  <Tooltip title="Derived by consumer based on countryCode_direction_msgType_sourceSystem_schemeName">
                    <IconButton size="small" aria-label="Pipeline key info">
                      <InfoOutlinedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              </Stack>
              <TextField
                fullWidth
                label="Pipeline Key"
                value={capability.pipelineKey}
                onChange={(event) => onUpdate({ pipelineKey: event.target.value })}
                placeholder="AR_OUTGOING_AOCASHOUTPENDIENTE_COELSA_COELSA"
              />
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Kafka Bindings</Typography>
                  <Button variant="outlined" size="small" onClick={handleBindingAdd}>
                    Add Binding
                  </Button>
                </Stack>
                {kafkaBindings.length === 0 ? (
                  <InlineHelpText>No Kafka bindings added.</InlineHelpText>
                ) : null}
                {kafkaBindings.map((binding, index) => {
                  const purposeError = !binding.purpose ? 'Purpose required.' : '';
                  const topicError = !binding.topicName.trim() ? 'Topic name required.' : '';
                  const clusterError = !binding.clusterAlias.trim() ? 'Cluster alias required.' : '';
                  return (
                    <Stack key={binding.id} spacing={1.5} sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          select
                          fullWidth
                          label="Purpose"
                          value={binding.purpose}
                          onChange={(event) => handleBindingUpdate(index, { purpose: event.target.value as KafkaPurpose })}
                          error={Boolean(purposeError)}
                          helperText={purposeError || ' '}
                        >
                          {kafkaPurposeOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          fullWidth
                          label="Topic Name"
                          value={binding.topicName}
                          onChange={(event) => handleBindingUpdate(index, { topicName: event.target.value })}
                          error={Boolean(topicError)}
                          helperText={topicError || ' '}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        {hasClusterAliases ? (
                          <TextField
                            select
                            fullWidth
                            label="Cluster / Bootstrap Alias"
                            value={binding.clusterAlias}
                            onChange={(event) => handleBindingUpdate(index, { clusterAlias: event.target.value })}
                            error={Boolean(clusterError)}
                            helperText={clusterError || ' '}
                          >
                            {(clusterAliases ?? []).map((alias) => (
                              <MenuItem key={alias} value={alias}>
                                {alias}
                              </MenuItem>
                            ))}
                          </TextField>
                        ) : (
                          <TextField
                            fullWidth
                            label="Cluster / Bootstrap Alias"
                            value={binding.clusterAlias}
                            onChange={(event) => handleBindingUpdate(index, { clusterAlias: event.target.value })}
                            error={Boolean(clusterError)}
                            helperText={clusterError || ' '}
                          />
                        )}
                        <TextField
                          fullWidth
                          label="Consumer Group"
                          value={binding.consumerGroup}
                          onChange={(event) => handleBindingUpdate(index, { consumerGroup: event.target.value })}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          fullWidth
                          label="Key Schema"
                          value={binding.keySchema}
                          onChange={(event) => handleBindingUpdate(index, { keySchema: event.target.value })}
                        />
                        <TextField
                          fullWidth
                          label="Value Schema"
                          value={binding.valueSchema}
                          onChange={(event) => handleBindingUpdate(index, { valueSchema: event.target.value })}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          fullWidth
                          type="number"
                          label="Partition Count"
                          value={binding.partitionCount ?? ''}
                          onChange={(event) =>
                            handleBindingUpdate(index, {
                              partitionCount: event.target.value ? Number(event.target.value) : undefined
                            })
                          }
                        />
                        <TextField
                          fullWidth
                          type="number"
                          label="Replication Factor"
                          value={binding.replicationFactor ?? ''}
                          onChange={(event) =>
                            handleBindingUpdate(index, {
                              replicationFactor: event.target.value ? Number(event.target.value) : undefined
                            })
                          }
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                        <TextField
                          fullWidth
                          label="Notes"
                          value={binding.notes ?? ''}
                          onChange={(event) => handleBindingUpdate(index, { notes: event.target.value })}
                        />
                        <IconButton
                          aria-label="Remove binding"
                          onClick={() => handleBindingRemove(index)}
                          sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  );
                })}
                {validation.errors.kafkaBindings ? (
                  <InlineHelpText>{validation.errors.kafkaBindings}</InlineHelpText>
                ) : null}
              </Stack>
            </Stack>
          ) : null}
        </Box>

        <Box role="tabpanel" hidden={activeTab !== 2}>
          {capability ? (
            <Stack spacing={2} sx={{ pt: 2 }}>
              <Stack spacing={1}>
                <Typography variant="subtitle2">Mongo Connection</Typography>
                <FormControlLabel
                  control={
                    <Switch
                      checked={capability.mongoEnabled}
                      onChange={(event) => onUpdate({ mongoEnabled: event.target.checked })}
                    />
                  }
                  label="Mongo Enabled"
                />
                {!capability.mongoEnabled ? (
                  <InlineHelpText>Enable Mongo to capture connection and collection details.</InlineHelpText>
                ) : null}
                <FormControlLabel
                  control={
                    <Switch
                      checked={capability.mongoSslEnable}
                      onChange={(event) => onUpdate({ mongoSslEnable: event.target.checked })}
                      disabled={!capability.mongoEnabled}
                    />
                  }
                  label="SSL Enabled"
                />
                <TextField
                  fullWidth
                  label="Mongo Servers"
                  multiline
                  minRows={2}
                  value={formatList(mongoServers)}
                  onChange={(event) => onUpdate({ mongoServers: parseList(event.target.value) })}
                  helperText={validation.errors.mongoServers ?? 'Comma-separated or newline list.'}
                  error={Boolean(validation.errors.mongoServers)}
                  disabled={!capability.mongoEnabled}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    fullWidth
                    label="Mongo Database"
                    value={capability.mongoDatabase}
                    onChange={(event) => onUpdate({ mongoDatabase: event.target.value })}
                    helperText={validation.errors.mongoDatabase ?? ' '}
                    error={Boolean(validation.errors.mongoDatabase)}
                    disabled={!capability.mongoEnabled}
                  />
                  <TextField
                    fullWidth
                    label="Mongo Username"
                    value={capability.mongoUsername}
                    onChange={(event) => onUpdate({ mongoUsername: event.target.value })}
                    disabled={!capability.mongoEnabled}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    fullWidth
                    label="Mongo Password Ref"
                    value={capability.mongoPasswordRef}
                    onChange={(event) => onUpdate({ mongoPasswordRef: event.target.value })}
                    helperText="Use vault/secret key reference."
                    disabled={!capability.mongoEnabled}
                  />
                  <TextField
                    fullWidth
                    label="Mongo Auth DB"
                    value={capability.mongoAuthDb}
                    onChange={(event) => onUpdate({ mongoAuthDb: event.target.value })}
                    disabled={!capability.mongoEnabled}
                  />
                </Stack>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    fullWidth
                    label="Trust Store Location"
                    value={capability.trustStoreLocation}
                    onChange={(event) => onUpdate({ trustStoreLocation: event.target.value })}
                    disabled={!capability.mongoEnabled}
                  />
                  <TextField
                    fullWidth
                    label="Trust Store Type"
                    value={capability.trustStoreType}
                    onChange={(event) => onUpdate({ trustStoreType: event.target.value })}
                    disabled={!capability.mongoEnabled}
                  />
                </Stack>
                <TextField
                  fullWidth
                  label="Trust Store Password Ref"
                  value={capability.trustStorePasswordRef}
                  onChange={(event) => onUpdate({ trustStorePasswordRef: event.target.value })}
                  helperText="Use vault/secret key reference."
                  disabled={!capability.mongoEnabled}
                />
              </Stack>
              <Divider />
              <Stack spacing={1}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle2">Collections</Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={handleCollectionAdd}
                    disabled={!capability.mongoEnabled}
                  >
                    Add Collection
                  </Button>
                </Stack>
                {mongoCollections.length === 0 ? (
                  <InlineHelpText>No collections defined.</InlineHelpText>
                ) : null}
                {mongoCollections.map((collection, index) => {
                  const nameError =
                    capability.mongoEnabled && !collection.name.trim() ? 'Name required.' : '';
                  return (
                    <Stack
                      key={collection.id}
                      spacing={1.5}
                      sx={{ p: 1.5, borderRadius: 1, border: '1px solid', borderColor: 'divider' }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField
                          fullWidth
                          label="Name"
                          value={collection.name}
                          onChange={(event) => handleCollectionUpdate(index, { name: event.target.value })}
                          error={Boolean(nameError)}
                          helperText={nameError || ' '}
                          disabled={!capability.mongoEnabled}
                        />
                        <TextField
                          select
                          fullWidth
                          label="Purpose"
                          value={collection.purpose}
                          onChange={(event) =>
                            handleCollectionUpdate(index, {
                              purpose: event.target.value as MongoCollectionPurpose
                            })
                          }
                          disabled={!capability.mongoEnabled}
                        >
                          {mongoCollectionPurposeOptions.map((option) => (
                            <MenuItem key={option} value={option}>
                              {option}
                            </MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          fullWidth
                          type="number"
                          label="Retention Days"
                          value={collection.retentionDays ?? ''}
                          onChange={(event) =>
                            handleCollectionUpdate(index, {
                              retentionDays: event.target.value ? Number(event.target.value) : undefined
                            })
                          }
                          disabled={!capability.mongoEnabled}
                        />
                      </Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
                        <TextField
                          fullWidth
                          label="Indexes Notes"
                          value={collection.indexesNotes ?? ''}
                          onChange={(event) => handleCollectionUpdate(index, { indexesNotes: event.target.value })}
                          disabled={!capability.mongoEnabled}
                        />
                        <IconButton
                          aria-label="Remove collection"
                          onClick={() => handleCollectionRemove(index)}
                          sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                          disabled={!capability.mongoEnabled}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Stack>
                    </Stack>
                  );
                })}
                {validation.errors.mongoCollections ? (
                  <InlineHelpText>{validation.errors.mongoCollections}</InlineHelpText>
                ) : null}
              </Stack>
              <Divider />
              <Stack spacing={1}>
                <Typography variant="subtitle2">Batching / Writer</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Batching Mongo Writer Size"
                    value={capability.batchingMongoWriterSize ?? ''}
                    onChange={(event) =>
                      onUpdate({
                        batchingMongoWriterSize: event.target.value ? Number(event.target.value) : undefined
                      })
                    }
                    disabled={!capability.mongoEnabled}
                  />
                  <TextField
                    fullWidth
                    type="number"
                    label="Thread Count"
                    value={capability.threadCount ?? ''}
                    onChange={(event) =>
                      onUpdate({ threadCount: event.target.value ? Number(event.target.value) : undefined })
                    }
                    disabled={!capability.mongoEnabled}
                  />
                </Stack>
              </Stack>
            </Stack>
          ) : null}
        </Box>

        <Box role="tabpanel" hidden={activeTab !== 3}>
          {capability ? (
            <Stack spacing={2} sx={{ pt: 2 }}>
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Config Files"
                value={formatList(capability.configFiles)}
                onChange={(event) => onUpdate({ configFiles: parseList(event.target.value) })}
                helperText="Enter config files separated by commas or new lines."
              />
              <TextField
                fullWidth
                multiline
                minRows={4}
                label="Config Paths"
                value={formatList(capability.configPaths)}
                onChange={(event) => onUpdate({ configPaths: parseList(event.target.value) })}
                helperText="Enter config paths separated by commas or new lines."
              />
            </Stack>
          ) : null}
        </Box>

        <Box role="tabpanel" hidden={activeTab !== 4}>
          {capability ? (
            <Stack spacing={2} sx={{ pt: 2 }}>
              {params.length === 0 ? (
                <InlineHelpText>No capability parameters defined yet.</InlineHelpText>
              ) : null}
              {params.map((param, index) => {
                const keyError = (!param.key.trim() && param.value.trim()) ? 'Key required.' : '';
                const valueError = (param.key.trim() && !param.value.trim()) ? 'Value required.' : '';
                return (
                  <Stack key={param.id} direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <TextField
                      fullWidth
                      label="Key"
                      value={param.key}
                      onChange={(event) => handleParamUpdate(index, { key: event.target.value })}
                      error={Boolean(keyError)}
                      helperText={keyError || ' '}
                    />
                    <TextField
                      fullWidth
                      label="Value"
                      value={param.value}
                      onChange={(event) => handleParamUpdate(index, { value: event.target.value })}
                      error={Boolean(valueError)}
                      helperText={valueError || ' '}
                    />
                    <IconButton
                      aria-label="Remove parameter"
                      onClick={() => handleParamRemove(index)}
                      sx={{ alignSelf: { xs: 'flex-end', sm: 'center' } }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                );
              })}
              {validation.errors.capabilityParams ? (
                <InlineHelpText>{validation.errors.capabilityParams}</InlineHelpText>
              ) : null}
              <Button variant="outlined" onClick={handleParamAdd}>
                Add Parameter
              </Button>
            </Stack>
          ) : null}
        </Box>

        {saveError ? <Alert severity="warning">{saveError}</Alert> : null}

        <Divider />
        <Stack direction={{ xs: 'column-reverse', sm: 'row' }} spacing={1} justifyContent="flex-end">
          <Button variant="outlined" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={!capability || validation.hasErrors || saving}
          >
            {saving ? 'Saving...' : 'Save Config'}
          </Button>
        </Stack>
      </Stack>
    </Drawer>
  );
}
