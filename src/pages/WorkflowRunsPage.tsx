import FilterAltOffOutlinedIcon from '@mui/icons-material/FilterAltOffOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import { MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { useMemo, useState } from 'react';
import { CardSection } from '../components/CardSection';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PageContainer } from '../components/PageContainer';
import { SkeletonState } from '../components/SkeletonState';
import { StatusChip } from '../components/StatusChip';
import { useWorkflowRunsQuery } from '../features/countries/hooks';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
import { Card } from '@ui/Card';
type RunFilter = 'all' | 'running' | 'success' | 'failed';

export function WorkflowRunsPage() {
  const [statusFilter, setStatusFilter] = useState<RunFilter>('all');
  const runsQuery = useWorkflowRunsQuery();

  const filteredRuns = useMemo(() => {
    const runs = runsQuery.data ?? [];
    if (statusFilter === 'all') {
      return runs;
    }
    return runs.filter((run) => run.status === statusFilter);
  }, [runsQuery.data, statusFilter]);

  if (runsQuery.isLoading) {
    return (
      <PageContainer title="Workflow Runs" subtitle="Inspect execution status and failure points across onboarding pipelines.">
        <CardSection title="Execution Timeline" subtitle="Filter pipeline executions by current status.">
          <Stack spacing={2.5}>
            <SkeletonState variant="form" rows={2} />
            <SkeletonState variant="table" rows={8} />
          </Stack>
        </CardSection>
      </PageContainer>
    );
  }

  if (runsQuery.isError) {
    return (
      <ErrorState
        title="Workflow telemetry unavailable"
        message={runsQuery.error?.message ?? 'Unable to load workflow runs.'}
        onRetry={() => void runsQuery.refetch()}
      />
    );
  }

  if (!(runsQuery.data ?? []).length) {
    return (
      <EmptyState
        title="No workflow runs yet"
        description="Run onboarding once to start building execution history."
        icon={<FilterAltOffOutlinedIcon color="action" />}
        actionLabel="Refresh"
        onAction={() => void runsQuery.refetch()}
      />
    );
  }

  return (
    <PageContainer title="Workflow Runs" subtitle="Inspect execution status and failure points across onboarding pipelines.">
      <CardSection
        title="Execution Timeline"
        subtitle="Filter pipeline executions by current status."
        actions={
          <Stack direction="row" spacing={1}>
            <Input
              select
              size="small"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as RunFilter)}
              label="Status Filter"
              aria-label="Filter workflow runs by status"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="running">Running</MenuItem>
              <MenuItem value="success">Success</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Input>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => void runsQuery.refetch()}
              aria-label="Refresh workflow runs"
            >
              Refresh
            </Button>
          </Stack>
        }
      >
        {filteredRuns.length ? (
          <TableContainer component={Card} variant="outlined">
            <Table aria-label="Workflow runs table" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Run ID</TableCell>
                  <TableCell>Country</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Current Step</TableCell>
                  <TableCell>Initiated By</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>Completed</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRuns.map((run) => (
                  <TableRow key={run.id} hover>
                    <TableCell>{run.id}</TableCell>
                    <TableCell>{run.countryIso2}</TableCell>
                    <TableCell>
                      <StatusChip status={run.status} />
                    </TableCell>
                    <TableCell>{run.step}</TableCell>
                    <TableCell>{run.initiatedBy}</TableCell>
                    <TableCell>{new Date(run.startedAt).toLocaleString()}</TableCell>
                    <TableCell>
                      {run.completedAt ? new Date(run.completedAt).toLocaleString() : 'In progress'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No runs for this filter"
            description="Try another status or reset the filter to view all runs."
            icon={<FilterAltOffOutlinedIcon color="action" />}
            actionLabel="Reset Filter"
            onAction={() => setStatusFilter('all')}
          />
        )}
      </CardSection>
    </PageContainer>
  );
}


