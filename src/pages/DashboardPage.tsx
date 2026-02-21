import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LaunchIcon from '@mui/icons-material/Launch';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import {
  Button,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CardSection } from '../components/CardSection';
import { EmptyState } from '../components/EmptyState';
import { InlineHelpText } from '../components/InlineHelpText';
import { PageContainer } from '../components/PageContainer';

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
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 1,
                borderColor: 'divider',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.background.paper}, ${theme.palette.action.hover})`
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Total snapshots
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {totalSnapshots}
                </Typography>
                <InlineHelpText>Stored locally</InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 1,
                borderColor: 'divider',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.background.paper}, ${theme.palette.action.hover})`
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Recent onboarding activity
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {recentActivityCount}
                </Typography>
                <InlineHelpText>Last {recentWindowDays} days</InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 1,
                borderColor: 'divider',
                background: (theme) =>
                  `linear-gradient(135deg, ${theme.palette.background.paper}, ${theme.palette.action.hover})`
              }}
            >
              <Stack spacing={0.5}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Repos impacted
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  {DEFAULT_REPOS.length}
                </Typography>
                <InlineHelpText>{DEFAULT_REPOS.join(', ')}</InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </CardSection>

      <CardSection title="Quick Start" subtitle="Analyze requirements, map payloads, then build, preview, and test.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Step 1
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Requirement Analysis
                </Typography>
                <InlineHelpText>
                  Extract requirements, map capabilities, and capture open questions.
                </InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Step 2
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Payload Mapping
                </Typography>
                <InlineHelpText>
                  Review draft mapping grids and export ICD-ready drafts.
                </InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Step 3
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Create Snapshot
                </Typography>
                <InlineHelpText>
                  Capture country, capabilities, and workflow into a versioned snapshot.
                </InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Step 4
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Generate Preview
                </Typography>
                <InlineHelpText>
                  Validate generated files repo-by-repo before automation.
                </InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Step 5
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Jobs
                </Typography>
                <InlineHelpText>Track async runs, approvals, and automation status.</InlineHelpText>
              </Stack>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
              <Stack spacing={1}>
                <Typography variant="overline" sx={{ letterSpacing: '0.08em', color: 'text.secondary' }}>
                  Step 6
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Test Case Generation
                </Typography>
                <InlineHelpText>Generate scenario packs and test skeletons from payloads.</InlineHelpText>
              </Stack>
            </Paper>
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
          <TextField
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
                <Button component={RouterLink} to="/snapshots/new" variant="contained">
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
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 1 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                    >
                      Country
                    </TableCell>
                    <TableCell
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                    >
                      Snapshot
                    </TableCell>
                    <TableCell
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                    >
                      Created
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                    >
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredSnapshots.map((snapshot) => (
                    <TableRow key={snapshot.snapshotId} hover>
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
