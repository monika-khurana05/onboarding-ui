import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { Alert, Button, Stack, Typography } from '@mui/material';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SectionCard } from '../components/SectionCard';
import { SnapshotRequestForm } from '../features/onboarding-flow/SnapshotRequestForm';
import { useCreateSnapshotMutation } from '../features/onboarding-flow/hooks';
import { useGlobalError } from '../app/GlobalErrorContext';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Snapshot creation failed.';
}

export function CreateSnapshotPage() {
  const navigate = useNavigate();
  const { showError } = useGlobalError();
  const createSnapshotMutation = useCreateSnapshotMutation();
  const [submitError, setSubmitError] = useState<string | null>(null);

  return (
    <Stack spacing={2}>
      <SectionCard
        title="Create Snapshot Wizard"
        subtitle="Capture source-of-truth input for FSM/config generation and downstream repo commits."
        actions={
          <Button
            variant="text"
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/generate/preview')}
            aria-label="Go to preview generation"
          >
            Skip to Preview
          </Button>
        }
      >
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            Complete the form to create a snapshot payload. You can also switch to advanced JSON mode.
          </Typography>
          <Alert severity="info">
            After snapshot creation, you will be redirected to snapshot details for versioning and review.
          </Alert>
        </Stack>
      </SectionCard>

      <SnapshotRequestForm
        submitting={createSnapshotMutation.isPending}
        submitError={submitError}
        onSubmit={async (values) => {
          setSubmitError(null);
          try {
            const result = await createSnapshotMutation.mutateAsync(values);
            const encodedId = encodeURIComponent(result.snapshotId);
            const versionQuery = typeof result.version === 'number' ? `?version=${result.version}` : '';
            navigate(`/snapshots/${encodedId}${versionQuery}`);
          } catch (error) {
            const message = toErrorMessage(error);
            setSubmitError(message);
            showError(message);
          }
        }}
      />
    </Stack>
  );
}
