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
import { SectionCard } from '../components/SectionCard';

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
    <Stack spacing={2.5}>
      <SectionCard title="Quick Start" subtitle="The 3-step CPX onboarding flow.">
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={0.75}>
              <Typography variant="subtitle1">1) Create snapshot</Typography>
              <Typography variant="body2" color="text.secondary">
                Capture country, capabilities, and workflow into a versioned snapshot.
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={0.75}>
              <Typography variant="subtitle1">2) Preview generation</Typography>
              <Typography variant="body2" color="text.secondary">
                Validate generated files repo-by-repo before automation.
              </Typography>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={0.75}>
              <Typography variant="subtitle1">3) (Later) Create PRs + deploy</Typography>
              <Typography variant="body2" color="text.secondary">
                Future phase: open PRs, approvals, and deploy.
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
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
            <Stack spacing={1.5} sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="subtitle1">No snapshots yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Start by creating a snapshot to capture country, capability, and workflow details.
              </Typography>
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
      </SectionCard>
    </Stack>
  );
}
