import LaunchIcon from '@mui/icons-material/Launch';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Alert,
  Button,
  Chip,
  Grid,
  Stack,
  TextField
} from '@mui/material';
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { SectionCard } from '../components/SectionCard';
import { JsonPayloadCard } from '../features/onboarding-flow/JsonPayloadCard';
import { SnapshotVersionForm } from '../features/onboarding-flow/SnapshotVersionForm';
import { useCreateSnapshotVersionMutation, useSnapshotQuery } from '../features/onboarding-flow/hooks';
import { useGlobalError } from '../app/GlobalErrorContext';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Request failed.';
}

export function SnapshotDetailsPage() {
  const { snapshotId: routeSnapshotId } = useParams<{ snapshotId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showError } = useGlobalError();

  const snapshotId = routeSnapshotId ?? '';
  const [versionInput, setVersionInput] = useState(searchParams.get('version') ?? '');
  const [versionError, setVersionError] = useState<string | null>(null);

  const snapshotQuery = useSnapshotQuery(snapshotId, versionInput || undefined);
  const createVersionMutation = useCreateSnapshotVersionMutation(snapshotId);

  const effectiveVersion = useMemo(() => {
    if (versionInput) {
      return versionInput;
    }
    if (typeof snapshotQuery.data?.version === 'number') {
      return String(snapshotQuery.data.version);
    }
    return '';
  }, [snapshotQuery.data?.version, versionInput]);

  if (!snapshotId) {
    return (
      <ErrorState
        title="Snapshot ID missing"
        message="No snapshot ID was provided in the route."
      />
    );
  }

  return (
    <Stack spacing={2.25}>
      <SectionCard
        title="Snapshot Details"
        subtitle="Review snapshot payload, inspect versions, and prepare preview generation."
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void snapshotQuery.refetch()}
            aria-label="Reload snapshot"
          >
            Reload
          </Button>
        }
      >
        <Grid container spacing={1.5}>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField fullWidth label="Snapshot ID" value={snapshotId} InputProps={{ readOnly: true }} />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Version"
              placeholder="Latest if blank"
              value={versionInput}
              onChange={(event) => setVersionInput(event.target.value.trim())}
            />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title="Create Snapshot Version"
        subtitle="POST /snapshots/{snapshotId}/versions"
      >
        <SnapshotVersionForm
          disabled={false}
          loading={createVersionMutation.isPending}
          error={versionError}
          onSubmit={async (values) => {
            setVersionError(null);
            try {
              const result = await createVersionMutation.mutateAsync(values);
              if (typeof result.version === 'number') {
                setVersionInput(String(result.version));
              }
              void snapshotQuery.refetch();
            } catch (error) {
              const message = toErrorMessage(error);
              setVersionError(message);
              showError(message);
            }
          }}
        />
      </SectionCard>

      {snapshotQuery.isLoading ? (
        <LoadingState message="Loading snapshot..." minHeight={180} />
      ) : snapshotQuery.isError ? (
        <ErrorState
          title="Failed to load snapshot"
          message={snapshotQuery.error?.message ?? 'Snapshot request failed.'}
          onRetry={() => void snapshotQuery.refetch()}
        />
      ) : snapshotQuery.data ? (
        <Stack spacing={2}>
          <SectionCard
            title="Snapshot Metadata"
            subtitle="Backend snapshot identifiers and timestamps."
            actions={
              <Button
                variant="contained"
                startIcon={<LaunchIcon />}
                onClick={() => {
                  const params = new URLSearchParams();
                  params.set('snapshotId', snapshotId);
                  if (effectiveVersion) {
                    params.set('version', effectiveVersion);
                  }
                  navigate(`/generate/preview?${params.toString()}`);
                }}
                aria-label="Generate preview for snapshot"
              >
                Generate Preview
              </Button>
            }
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" alignItems="center">
              <Chip color="primary" size="small" label={`Snapshot: ${snapshotQuery.data.snapshotId}`} />
              {effectiveVersion ? (
                <Chip size="small" variant="outlined" label={`Version: ${effectiveVersion}`} />
              ) : null}
              {snapshotQuery.data.updatedAt ? (
                <Chip
                  size="small"
                  variant="outlined"
                  label={`Updated: ${new Date(snapshotQuery.data.updatedAt).toLocaleString()}`}
                />
              ) : null}
            </Stack>
            {!snapshotQuery.data.payload ? (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Snapshot payload was not present in response. Displaying raw response below.
              </Alert>
            ) : null}
          </SectionCard>

          <JsonPayloadCard
            title="Snapshot Payload"
            subtitle="Response body returned by GET snapshot endpoint."
            payload={snapshotQuery.data.payload ?? snapshotQuery.data.raw}
          />
        </Stack>
      ) : (
        <EmptyState
          title="Snapshot unavailable"
          description="No data was returned for this snapshot ID."
        />
      )}
    </Stack>
  );
}
