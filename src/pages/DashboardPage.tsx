import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LaunchIcon from '@mui/icons-material/Launch';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import { Grid, InputAdornment, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CardSection } from '../components/CardSection';
import { EmptyState } from '../components/EmptyState';
import { InlineHelpText } from '../components/InlineHelpText';
import { PageContainer } from '../components/PageContainer';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
import { Card } from '@ui/Card';
type RecentSnapshot = {
  snapshotId: string;
  countryCode: string;
  version?: number;
  createdAt: string;
};

const DEFAULT_REPOS = ['state-manager', 'payment-initiation', 'country-container'];

function loadRecentSnapshots(): RecentSnapshot[] {
  try {
    const stored = localStorage.getItem('cpx.snapshot.refs');
    if (!stored) {
      return [];
    }
    const parsed = JSON.parse(stored) as RecentSnapshot[];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter((item) => item && typeof item.snapshotId === 'string')
      .map((item) => ({
        snapshotId: item.snapshotId,
        countryCode: item.countryCode ?? 'Unknown',
        version: typeof item.version === 'number' ? item.version : undefined,
        createdAt: item.createdAt ?? ''
      }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  } catch {
    return [];
  }
}

export function DashboardPage() {
  const [search, setSearch] = useState('');
  const snapshots = useMemo(() => loadRecentSnapshots(), []);
  const totalSnapshots = snapshots.length;
  const recentWindowDays = 7;
  const recentCutoff = new Date();
  recentCutoff.setDate(recentCutoff.getDate() - recentWindowDays);
  const recentActivityCount = snapshots.filter((snapshot) => {
    if (!snapshot.createdAt) {
      return false;
    }
    const timestamp = Date.parse(snapshot.createdAt);
    return !Number.isNaN(timestamp) && timestamp >= recentCutoff.getTime();
  }).length;
  const filteredSnapshots = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return snapshots;
    }
    return snapshots.filter((snapshot) => {
      return (
        snapshot.snapshotId.toLowerCase().includes(query) ||
        snapshot.countryCode.toLowerCase().includes(query) ||
        String(snapshot.version ?? '').includes(query)
      );
    });
  }, [search, snapshots]);

  return (
    <PageContainer title="Dashboard" subtitle="Monitor recent snapshots and launch onboarding workflows.">
      <CardSection title="Summary" subtitle="Snapshot activity at a glance.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              variant="outlined"
              className="bg-surface border-border"
              sx={{ p: 2, borderRadius: 1 }}
            >
              <Stack spacing={0.5}>
                <Typography variant="overline" className="text-muted tracking-[0.08em]">
                  Total snapshots
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {totalSnapshots}
                </Typography>
                <InlineHelpText>Stored locally</InlineHelpText>
              </Stack>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              variant="outlined"
              className="bg-surface border-border"
              sx={{ p: 2, borderRadius: 1 }}
            >
              <Stack spacing={0.5}>
                <Typography variant="overline" className="text-muted tracking-[0.08em]">
                  Recent onboarding activity
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {recentActivityCount}
                </Typography>
                <InlineHelpText>Last {recentWindowDays} days</InlineHelpText>
              </Stack>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              variant="outlined"
              className="bg-surface border-border"
              sx={{ p: 2, borderRadius: 1 }}
            >
              <Stack spacing={0.5}>
                <Typography variant="overline" className="text-muted tracking-[0.08em]">
                  Repos impacted
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {DEFAULT_REPOS.length}
                </Typography>
                <InlineHelpText>{DEFAULT_REPOS.join(', ')}</InlineHelpText>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </CardSection>

      <CardSection title="Quick Start" subtitle="Create, preview, then automate.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" className="bg-surface border-border" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" className="text-muted tracking-[0.08em]">
                  Step 1
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Create Snapshot
                </Typography>
                <InlineHelpText>
                  Capture country, capabilities, and workflow into a versioned snapshot.
                </InlineHelpText>
              </Stack>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" className="bg-surface border-border" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" className="text-muted tracking-[0.08em]">
                  Step 2
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Preview Generation
                </Typography>
                <InlineHelpText>
                  Validate generated files repo-by-repo before automation.
                </InlineHelpText>
              </Stack>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" className="bg-surface border-border" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" className="text-muted tracking-[0.08em]">
                  Step 3
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Create PR (future)
                </Typography>
                <InlineHelpText>Open PRs, approvals, and deploy when automation ships.</InlineHelpText>
              </Stack>
            </Card>
          </Grid>
        </Grid>
      </CardSection>

      <CardSection
        title="Recent Snapshots"
        subtitle="Snapshots stored locally from recent onboarding work."
        actions={
          <Button
            component={RouterLink}
            to="/snapshots/new"
            variant="contained"
            startIcon={<AddCircleOutlineIcon />}
          >
            Create Snapshot
          </Button>
        }
      >
        <Stack spacing={2}>
          <Input
            fullWidth
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by country code, snapshot ID, or version"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />

          {snapshots.length === 0 ? (
            <EmptyState
              title="No snapshots yet"
              description="Create one to start onboarding."
              action={
                <Button component={RouterLink} to="/snapshots/new" variant="primary">
                  Create Snapshot
                </Button>
              }
            />
          ) : filteredSnapshots.length === 0 ? (
            <EmptyState
              title="No snapshots match this search"
              description="Try a broader keyword or clear the filter."
              icon={<SearchOffOutlinedIcon color="action" />}
              actionLabel="Clear Search"
              onAction={() => setSearch('')}
            />
          ) : (
            <TableContainer component={Card} variant="outlined" className="border border-border" sx={{ borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell className="text-muted uppercase tracking-[0.08em] text-[0.72rem]">
                      Country
                    </TableCell>
                    <TableCell className="text-muted uppercase tracking-[0.08em] text-[0.72rem]">
                      Snapshot
                    </TableCell>
                    <TableCell className="text-muted uppercase tracking-[0.08em] text-[0.72rem]">
                      Created
                    </TableCell>
                    <TableCell
                      align="right"
                      className="text-muted uppercase tracking-[0.08em] text-[0.72rem]"
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSnapshots.map((snapshot) => (
                    <TableRow key={snapshot.snapshotId} hover className="hover:bg-surface2">
                      <TableCell>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {snapshot.countryCode}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {snapshot.snapshotId}
                          </Typography>
                          <InlineHelpText>
                            Version {typeof snapshot.version === 'number' ? snapshot.version : 'n/a'}
                          </InlineHelpText>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : 'n/a'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            component={RouterLink}
                            to={`/snapshots/${encodeURIComponent(snapshot.snapshotId)}`}
                            size="small"
                            variant="outlined"
                            startIcon={<LaunchIcon />}
                          >
                            View Snapshot
                          </Button>
                          <Button
                            component={RouterLink}
                            to={`/generate/preview?snapshotId=${encodeURIComponent(snapshot.snapshotId)}${
                              typeof snapshot.version === 'number' ? `&version=${snapshot.version}` : ''
                            }`}
                            size="small"
                            variant="text"
                            startIcon={<PlayArrowOutlinedIcon />}
                          >
                            Preview Generation
                          </Button>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </CardSection>
    </PageContainer>
  );
}


