import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  Stack,
  Typography
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getSnapshot } from '../api/client';
import type { SnapshotDetailDto } from '../api/types';
import { JsonMonacoPanel } from '../components/JsonMonacoPanel';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { SectionCard } from '../components/SectionCard';
import { useGlobalError } from '../app/GlobalErrorContext';
import type { SnapshotModel } from '../models/snapshot';
import { CreateSnapshotWizard } from '../features/onboarding-flow/CreateSnapshotWizard';

function extractSnapshotPayload(detail?: SnapshotDetailDto): SnapshotModel | null {
  if (!detail) {
    return null;
  }
  const payload = detail.payload ?? detail.snapshot ?? detail.data;
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  return payload as SnapshotModel;
}

export function SnapshotDetailsPage() {
  const { snapshotId: routeSnapshotId } = useParams<{ snapshotId: string }>();
  const navigate = useNavigate();
  const { showError } = useGlobalError();
  const [versionWizardOpen, setVersionWizardOpen] = useState(false);

  const snapshotId = routeSnapshotId ?? '';

  const snapshotQuery = useQuery({
    queryKey: ['snapshot-detail', snapshotId],
    queryFn: () => getSnapshot(snapshotId),
    enabled: Boolean(snapshotId)
  });

  const snapshotPayload = extractSnapshotPayload(snapshotQuery.data);

  const headerFields = useMemo(() => {
    return {
      snapshotId: snapshotId,
      countryCode: snapshotPayload?.countryCode ?? 'Unknown',
      version: snapshotQuery.data?.version ?? snapshotQuery.data?.currentVersion,
      createdAt: snapshotQuery.data?.createdAt
    };
  }, [snapshotId, snapshotPayload?.countryCode, snapshotQuery.data?.createdAt, snapshotQuery.data?.currentVersion, snapshotQuery.data?.version]);

  if (!snapshotId) {
    return <ErrorState title="Snapshot ID missing" message="No snapshot ID was provided in the route." />;
  }

  if (snapshotQuery.isLoading) {
    return <LoadingState message="Loading snapshot details..." minHeight={240} />;
  }

  if (snapshotQuery.isError) {
    return (
      <ErrorState
        title="Failed to load snapshot"
        message={snapshotQuery.error?.message ?? 'Snapshot request failed.'}
        onRetry={() => void snapshotQuery.refetch()}
      />
    );
  }

  if (!snapshotQuery.data) {
    return <EmptyState title="Snapshot unavailable" description="No data was returned for this snapshot ID." />;
  }

  const capabilities = snapshotPayload?.capabilities ?? [];
  const enabledCapabilities = capabilities.filter((capability) => capability.enabled);
  const validations = snapshotPayload?.validations ?? [];
  const enrichments = snapshotPayload?.enrichments ?? [];
  const actions = snapshotPayload?.actions ?? [];
  const workflow = snapshotPayload?.workflow ?? { workflowKey: 'N/A', states: [], transitions: [] };

  const previewParams = new URLSearchParams();
  previewParams.set('snapshotId', snapshotId);
  if (typeof headerFields.version === 'number') {
    previewParams.set('version', String(headerFields.version));
  }

  const jsonPayload = snapshotPayload ?? snapshotQuery.data;

  return (
    <Stack spacing={2.5}>
      <SectionCard
        title="Snapshot Details"
        subtitle="Review snapshot payload, generate previews, and create new versions."
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => void snapshotQuery.refetch()}
              aria-label="Reload snapshot"
            >
              Reload
            </Button>
            <Button
              variant="outlined"
              onClick={() => setVersionWizardOpen(true)}
              aria-label="Create new snapshot version"
            >
              Create New Version
            </Button>
            <Button
              variant="contained"
              startIcon={<LaunchIcon />}
              onClick={() => navigate(`/generate/preview?${previewParams.toString()}`)}
              aria-label="Preview generation"
            >
              Preview Generation
            </Button>
          </Stack>
        }
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Snapshot ID
            </Typography>
            <Typography variant="subtitle1">{headerFields.snapshotId}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Country Code
            </Typography>
            <Typography variant="subtitle1">{headerFields.countryCode}</Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Version
            </Typography>
            <Typography variant="subtitle1">
              {typeof headerFields.version === 'number' ? headerFields.version : 'Latest'}
            </Typography>
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Typography variant="caption" color="text.secondary">
              Created At
            </Typography>
            <Typography variant="subtitle1">
              {headerFields.createdAt ? new Date(headerFields.createdAt).toLocaleString() : 'n/a'}
            </Typography>
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title="Enabled Capabilities"
        subtitle="CPX runtime domains enabled for this snapshot."
      >
        {enabledCapabilities.length ? (
          <Stack direction="row" gap={1} flexWrap="wrap">
            {enabledCapabilities.map((capability) => (
              <Chip key={capability.capabilityKey} label={capability.capabilityKey} color="primary" />
            ))}
          </Stack>
        ) : (
          <Alert severity="info">No capabilities are enabled.</Alert>
        )}
      </SectionCard>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Validations" subtitle="Validation rules in the CPX checks lane.">
            <Typography variant="h5">{validations.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              {validations.map((rule) => rule.key).filter(Boolean).join(', ') || 'No validations configured.'}
            </Typography>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Enrichments" subtitle="Enrichment rules applied before clearing.">
            <Typography variant="h5">{enrichments.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              {enrichments.map((rule) => rule.key).filter(Boolean).join(', ') || 'No enrichments configured.'}
            </Typography>
          </SectionCard>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <SectionCard title="Actions" subtitle="Runtime actions attached to the workflow.">
            <Typography variant="h5">{actions.length}</Typography>
            <Typography variant="body2" color="text.secondary">
              {actions.map((action) => action.key).filter(Boolean).join(', ') || 'No actions configured.'}
            </Typography>
          </SectionCard>
        </Grid>
      </Grid>

      <SectionCard title="Workflow Summary" subtitle="State Manager FSM configured for this snapshot.">
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
            <Chip label={`Workflow: ${workflow.workflowKey || 'N/A'}`} variant="outlined" />
            <Chip label={`States: ${workflow.states.length}`} variant="outlined" />
            <Chip label={`Transitions: ${workflow.transitions.length}`} variant="outlined" />
          </Stack>
          {workflow.states.length ? (
            <Typography variant="body2" color="text.secondary">
              States: {workflow.states.join(', ')}
            </Typography>
          ) : null}
        </Stack>
      </SectionCard>

      <SectionCard title="What Will Be Generated?" subtitle="CPX outputs mapped to target repositories.">
        <Stack spacing={1}>
          <Typography variant="body2">
            state-manager repo: fsm.yaml + service cfg + component tests
          </Typography>
          <Typography variant="body2">payment-initiation repo: pipeline yaml</Typography>
          <Typography variant="body2">country-container repo: deployment + smoke</Typography>
        </Stack>
      </SectionCard>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle1">Snapshot JSON</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1.5}>
            <JsonMonacoPanel
              ariaLabel="Snapshot JSON panel"
              value={jsonPayload}
              readOnly
              onCopyError={() => showError('Copy failed. Select the JSON and copy manually.')}
            />
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Dialog open={versionWizardOpen} onClose={() => setVersionWizardOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Create New Snapshot Version</DialogTitle>
        <DialogContent dividers>
          <CreateSnapshotWizard
            mode="version"
            snapshotId={snapshotId}
            initialSnapshot={snapshotPayload ?? undefined}
            onSaved={() => {
              setVersionWizardOpen(false);
              void snapshotQuery.refetch();
            }}
          />
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
