import { Alert, List, ListItem, ListItemText, Stack, Typography } from '@mui/material';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '../components/EmptyState';
import { LoadingState } from '../components/LoadingState';
import { SectionCard } from '../components/SectionCard';
import { GeneratePreviewForm } from '../features/onboarding-flow/GeneratePreviewForm';
import { JsonPayloadCard } from '../features/onboarding-flow/JsonPayloadCard';
import { useGeneratePreviewMutation, useRepoDefaultsQuery } from '../features/onboarding-flow/hooks';
import { useGlobalError } from '../app/GlobalErrorContext';

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Preview generation failed.';
}

export function GeneratePreviewPage() {
  const [searchParams] = useSearchParams();
  const { showError } = useGlobalError();
  const repoDefaultsQuery = useRepoDefaultsQuery();
  const generatePreviewMutation = useGeneratePreviewMutation();

  const snapshotIdFromRoute = searchParams.get('snapshotId') ?? undefined;
  const versionFromRoute = searchParams.get('version');
  const defaultVersion = versionFromRoute && /^\d+$/.test(versionFromRoute) ? Number(versionFromRoute) : undefined;

  const repos = repoDefaultsQuery.data?.repos ?? [];

  if (repoDefaultsQuery.isLoading && !repoDefaultsQuery.data) {
    return <LoadingState message="Loading repository defaults..." minHeight={200} />;
  }

  return (
    <Stack spacing={2.25}>
      {repoDefaultsQuery.isError ? (
        <Alert severity="warning">
          Repository defaults could not be loaded. Manual repo input is still supported.
        </Alert>
      ) : null}

      <SectionCard
        title="Preview Generation"
        subtitle="Generate FSM/config preview artifacts before running commit automation."
      >
        <GeneratePreviewForm
          repos={repos}
          defaultSnapshotId={snapshotIdFromRoute}
          defaultVersion={defaultVersion}
          loading={generatePreviewMutation.isPending}
          error={generatePreviewMutation.isError ? toErrorMessage(generatePreviewMutation.error) : null}
          onSubmit={async (values) => {
            try {
              await generatePreviewMutation.mutateAsync(values);
            } catch (error) {
              showError(toErrorMessage(error));
            }
          }}
        />
      </SectionCard>

      {generatePreviewMutation.isPending ? <LoadingState message="Generating preview..." minHeight={140} /> : null}

      {generatePreviewMutation.data ? (
        <Stack spacing={2}>
          {generatePreviewMutation.data.generatedArtifacts?.length ? (
            <SectionCard title="Generated Artifacts" subtitle="FSM/config artifacts from preview run.">
              <List sx={{ py: 0, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                {generatePreviewMutation.data.generatedArtifacts.map((artifact, index) => (
                  <ListItem
                    key={`${artifact.filePath ?? artifact.domain ?? 'artifact'}-${index}`}
                    divider
                  >
                    <ListItemText
                      primary={`${artifact.domain ?? 'Domain'} - ${artifact.filePath ?? 'artifact'}`}
                      secondary={`repo: ${artifact.repository ?? 'n/a'} | status: ${artifact.status ?? 'unknown'}`}
                    />
                  </ListItem>
                ))}
              </List>
            </SectionCard>
          ) : (
            <EmptyState
              title="No artifacts returned"
              description="The preview response did not contain artifact details."
            />
          )}

          <JsonPayloadCard title="Preview Response" payload={generatePreviewMutation.data.raw} />
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary">
          Submit snapshot and repository targets to generate preview output.
        </Typography>
      )}
    </Stack>
  );
}
