import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import LaunchIcon from '@mui/icons-material/Launch';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Alert,
  Button,
  Grid,
  InputAdornment,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CardSection } from '../components/CardSection';
import { InlineHelpText } from '../components/InlineHelpText';
import { PageContainer } from '../components/PageContainer';

type RecentSnapshot = {
  snapshotId: string;
  countryCode: string;
  version?: number;
  createdAt: string;
};

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
      <CardSection title="Quick Start" subtitle="Three-step CPX onboarding flow.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                1) Create snapshot
              </Typography>
              <InlineHelpText>
                Capture country, capabilities, and workflow into a versioned snapshot.
              </InlineHelpText>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                2) Preview generation
              </Typography>
              <InlineHelpText>
                Validate generated files repo-by-repo before automation.
              </InlineHelpText>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={1}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                3) (Later) Create PRs + deploy
              </Typography>
              <InlineHelpText>
                Future phase: open PRs, approvals, and deploy.
              </InlineHelpText>
            </Stack>
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
            <Stack spacing={1.5} sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: '8px' }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                No snapshots yet
              </Typography>
              <InlineHelpText>
                Start by creating a snapshot to capture country, capability, and workflow details.
              </InlineHelpText>
              <Button component={RouterLink} to="/snapshots/new" variant="contained">
                Create Snapshot
              </Button>
            </Stack>
          ) : filteredSnapshots.length === 0 ? (
            <Alert severity="warning">No snapshots match your search.</Alert>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Country Code</TableCell>
                  <TableCell>Snapshot ID</TableCell>
                  <TableCell>Version</TableCell>
                  <TableCell>Created At</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredSnapshots.map((snapshot) => (
                  <TableRow key={snapshot.snapshotId}>
                    <TableCell>{snapshot.countryCode}</TableCell>
                    <TableCell>{snapshot.snapshotId}</TableCell>
                    <TableCell>{typeof snapshot.version === 'number' ? snapshot.version : '-'}</TableCell>
                    <TableCell>
                      {snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString() : 'n/a'}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={1}>
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
          )}
        </Stack>
      </CardSection>
    </PageContainer>
  );
}
