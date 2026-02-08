import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import WorkOutlineIcon from '@mui/icons-material/WorkOutline';
import {
  Alert,
  Button,
  Chip,
  Grid,
  List,
  ListItem,
  ListItemText,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { ErrorState } from '../components/ErrorState';
import { LoadingState } from '../components/LoadingState';
import { SectionCard } from '../components/SectionCard';
import { useHealthQuery, useRepoDefaultsQuery } from '../features/onboarding-flow/hooks';

function MetricCard({ title, value, caption }: { title: string; value: string | number; caption: string }) {
  return (
    <Paper variant="outlined" sx={{ p: 2.25, height: '100%' }}>
      <Typography variant="body2" color="text.secondary">
        {title}
      </Typography>
      <Typography variant="h5" sx={{ mt: 0.5 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {caption}
      </Typography>
    </Paper>
  );
}

export function DashboardPage() {
  const healthQuery = useHealthQuery();
  const repoDefaultsQuery = useRepoDefaultsQuery();

  if (healthQuery.isLoading || repoDefaultsQuery.isLoading) {
    return <LoadingState message="Loading dashboard..." minHeight={260} />;
  }

  if (healthQuery.isError && repoDefaultsQuery.isError) {
    return (
      <ErrorState
        title="Dashboard unavailable"
        message="Health and repository defaults both failed. Retry to recover."
        onRetry={() => {
          void healthQuery.refetch();
          void repoDefaultsQuery.refetch();
        }}
      />
    );
  }

  const healthStatus = healthQuery.data?.status ?? 'unknown';
  const repoDefaults = repoDefaultsQuery.data?.repos ?? [];
  const checkCount = healthQuery.data?.checks ? Object.keys(healthQuery.data.checks).length : 0;

  return (
    <Stack spacing={2.5}>
      {healthQuery.isError ? (
        <Alert severity="warning">`GET /health` failed: {healthQuery.error?.message ?? 'Unknown error'}.</Alert>
      ) : null}
      {repoDefaultsQuery.isError ? (
        <Alert severity="warning">
          `GET /repo-defaults` failed: {repoDefaultsQuery.error?.message ?? 'Unknown error'}.
        </Alert>
      ) : null}

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 3 }}>
          <MetricCard title="Backend Health" value={healthStatus.toUpperCase()} caption="GET /health" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <MetricCard title="Health Checks" value={checkCount} caption="Sub-system status checks" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <MetricCard title="Repo Defaults" value={repoDefaults.length} caption="GET /repo-defaults" />
        </Grid>
        <Grid size={{ xs: 12, md: 3 }}>
          <MetricCard
            title="API Version"
            value={healthQuery.data?.version ?? 'n/a'}
            caption="Service version from health payload"
          />
        </Grid>
      </Grid>

      <SectionCard title="Onboarding Pipeline" subtitle="Primary workflow for country onboarding delivery.">
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25}>
          <Button
            component={RouterLink}
            to="/snapshots/new"
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
            aria-label="Go to create snapshot"
          >
            Create Snapshot
          </Button>
          <Button
            component={RouterLink}
            to="/generate/preview"
            variant="outlined"
            startIcon={<PlayArrowOutlinedIcon />}
            aria-label="Go to generate preview"
          >
            Generate Preview
          </Button>
          <Button
            component={RouterLink}
            to="/jobs"
            variant="outlined"
            startIcon={<WorkOutlineIcon />}
            aria-label="Go to jobs"
          >
            Jobs
          </Button>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Repository Defaults"
        subtitle="Repository targets and default refs used by generation/commit paths."
      >
        {repoDefaults.length ? (
          <List sx={{ py: 0 }}>
            {repoDefaults.map((repo) => (
              <ListItem key={repo.slug} divider>
                <ListItemText
                  primary={repo.label}
                  secondary={`slug: ${repo.slug} | default ref: ${repo.defaultRef}`}
                />
                <Chip size="small" label={repo.defaultRef} variant="outlined" />
              </ListItem>
            ))}
          </List>
        ) : (
          <Alert severity="info">No repository defaults were returned.</Alert>
        )}
      </SectionCard>
    </Stack>
  );
}
