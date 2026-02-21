import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import LaunchIcon from '@mui/icons-material/Launch';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import {
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import type { StepIconProps } from '@mui/material/StepIcon';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { CardSection } from '../components/CardSection';
import { CountryCodeField } from '../components/CountryCodeField';
import { EmptyState } from '../components/EmptyState';
import { InlineHelpText } from '../components/InlineHelpText';
import { PageContainer } from '../components/PageContainer';
import { ensureStatus, listStatuses, setStage } from '../status/onboardingStatusStorage';
import type { Flow, StageStatus } from '../status/types';
import { STAGE_ORDER } from '../status/types';

type RecentSnapshot = {
  snapshotId: string;
  countryCode: string;
  version?: number;
  createdAt: string;
};

const DEFAULT_REPOS = ['state-manager', 'payment-initiation', 'country-container'];

type StatusStepIconProps = StepIconProps & { status: StageStatus };

function StatusStepIcon({ status, className }: StatusStepIconProps) {
  const color =
    status === 'DONE'
      ? 'success.main'
      : status === 'BLOCKED'
        ? 'error.main'
        : status === 'IN_PROGRESS'
          ? 'primary.main'
          : 'text.disabled';
  const icon =
    status === 'DONE' ? (
      <CheckCircleIcon fontSize="small" />
    ) : status === 'BLOCKED' ? (
      <ErrorOutlineIcon fontSize="small" />
    ) : (
      <RadioButtonUncheckedIcon fontSize="small" />
    );

  return (
    <Box className={className} sx={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {icon}
    </Box>
  );
}

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
  const [statusRefresh, setStatusRefresh] = useState(0);
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedFlow, setSelectedFlow] = useState<Flow>('INCOMING');
  const [blockerNote, setBlockerNote] = useState('');
  const [blockerError, setBlockerError] = useState('');
  const snapshots = useMemo(() => loadRecentSnapshots(), []);
  const statuses = useMemo(() => listStatuses(), [statusRefresh]);
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

  const normalizedCountry = selectedCountry.trim().toUpperCase();
  const activeStatus = useMemo(
    () =>
      statuses.find((status) => status.countryCode === normalizedCountry && status.flow === selectedFlow) ?? null,
    [normalizedCountry, selectedFlow, statuses]
  );
  const knownCountries = useMemo(() => {
    const set = new Set<string>();
    statuses.forEach((status) => set.add(status.countryCode));
    snapshots.forEach((snapshot) => set.add(snapshot.countryCode));
    return Array.from(set.values()).sort();
  }, [snapshots, statuses]);

  useEffect(() => {
    if (!normalizedCountry) {
      const fallback = statuses[0]?.countryCode ?? snapshots[0]?.countryCode ?? '';
      if (fallback) {
        setSelectedCountry(fallback);
      }
    }
  }, [normalizedCountry, snapshots, statuses]);

  useEffect(() => {
    if (!normalizedCountry) {
      return;
    }
    const flows = statuses
      .filter((status) => status.countryCode === normalizedCountry)
      .map((status) => status.flow);
    if (flows.length > 0 && !flows.includes(selectedFlow)) {
      setSelectedFlow(flows[0]);
    }
  }, [normalizedCountry, selectedFlow, statuses]);

  useEffect(() => {
    setBlockerNote('');
    setBlockerError('');
  }, [activeStatus?.countryCode, activeStatus?.flow, activeStatus?.currentStage]);

  const refreshStatuses = () => setStatusRefresh((prev) => prev + 1);
  const handleStartTracking = () => {
    if (!normalizedCountry) {
      return;
    }
    ensureStatus(normalizedCountry, selectedFlow);
    refreshStatuses();
  };

  const handleMarkBlocked = () => {
    if (!activeStatus) {
      return;
    }
    const note = blockerNote.trim();
    if (!note) {
      setBlockerError('Blocker note is required.');
      return;
    }
    setStage(activeStatus.countryCode, activeStatus.flow, activeStatus.currentStage, 'BLOCKED', note);
    refreshStatuses();
    setBlockerNote('');
    setBlockerError('');
  };

  const handleMarkDone = () => {
    if (!activeStatus) {
      return;
    }
    setStage(activeStatus.countryCode, activeStatus.flow, activeStatus.currentStage, 'DONE');
    refreshStatuses();
  };

  const trackerQuery = activeStatus
    ? new URLSearchParams({ country: activeStatus.countryCode, flow: activeStatus.flow }).toString()
    : '';

  return (
    <PageContainer title="Dashboard" subtitle="Monitor recent snapshots and launch onboarding workflows.">
      <CardSection
        title="Onboarding Status Tracker"
        subtitle="Track onboarding stages per country and flow."
      >
        <Stack spacing={2}>
          <Grid container spacing={2} alignItems="center">
            <Grid size={{ xs: 12, md: 4 }}>
              <CountryCodeField
                value={selectedCountry}
                onChange={setSelectedCountry}
                helperText={
                  knownCountries.length
                    ? `Known countries: ${knownCountries.join(', ')}`
                    : 'Enter a country code to begin tracking.'
                }
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack spacing={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Flow
                </Typography>
                <ToggleButtonGroup
                  value={selectedFlow}
                  exclusive
                  onChange={(_, value) => {
                    if (value) {
                      setSelectedFlow(value);
                    }
                  }}
                  size="small"
                >
                  <ToggleButton value="OUTGOING">OUTGOING</ToggleButton>
                  <ToggleButton value="INCOMING">INCOMING</ToggleButton>
                </ToggleButtonGroup>
              </Stack>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                {!activeStatus ? (
                  <Button
                    variant="contained"
                    onClick={handleStartTracking}
                    disabled={!normalizedCountry}
                  >
                    Start Tracking
                  </Button>
                ) : null}
                <Button variant="text" onClick={refreshStatuses}>
                  Refresh
                </Button>
              </Stack>
            </Grid>
          </Grid>

          {activeStatus ? (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                <Stack spacing={2}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
                    <Chip
                      label={`${activeStatus.percentComplete}% Complete`}
                      color={activeStatus.percentComplete === 100 ? 'success' : 'default'}
                      variant="outlined"
                    />
                    <Typography variant="body2" color="text.secondary">
                      Current Stage: {activeStatus.currentStage}
                    </Typography>
                  </Stack>
                  <Stepper
                    alternativeLabel
                    activeStep={Math.max(STAGE_ORDER.indexOf(activeStatus.currentStage), 0)}
                    sx={{
                      '& .MuiStepLabel-root': {
                        flexDirection: 'column-reverse'
                      },
                      '& .MuiStepLabel-label': {
                        mb: 1
                      },
                      '& .MuiStepLabel-iconContainer': {
                        mb: 0
                      }
                    }}
                  >
                    {STAGE_ORDER.map((stageKey) => {
                      const stage = activeStatus.stages[stageKey];
                      const status = stage.status;
                      return (
                        <Step key={stageKey} completed={status === 'DONE'} disabled={status === 'NOT_STARTED'}>
                          <StepLabel
                            StepIconComponent={(props) => <StatusStepIcon {...props} status={status} />}
                            optional={
                              status === 'BLOCKED' ? (
                                <Typography variant="caption" color="error">
                                  {stage.note?.trim() || 'Blocked'}
                                </Typography>
                              ) : undefined
                            }
                            sx={{
                              '& .MuiStepLabel-label': {
                                color: status === 'IN_PROGRESS' ? 'primary.main' : undefined,
                                fontWeight: status === 'IN_PROGRESS' ? 600 : undefined
                              }
                            }}
                          >
                            {stageKey}
                          </StepLabel>
                        </Step>
                      );
                    })}
                  </Stepper>
                </Stack>
              </Paper>

              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                    <Stack spacing={0.5}>
                      <Typography variant="caption" color="text.secondary">
                        Lifecycle
                      </Typography>
                      <Typography variant="subtitle2">{activeStatus.lifecycle}</Typography>
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="caption" color="text.secondary">
                        Updated
                      </Typography>
                      <Typography variant="body2">
                        {activeStatus.updatedAt ? new Date(activeStatus.updatedAt).toLocaleString() : 'n/a'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Owner
                      </Typography>
                      <Typography variant="body2">{activeStatus.owner ?? 'Unassigned'}</Typography>
                    </Stack>
                  </Paper>
                </Grid>
                <Grid size={{ xs: 12, md: 8 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                    <Stack spacing={1}>
                      <Typography variant="subtitle2">Action Shortcuts</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} useFlexGap flexWrap="wrap">
                        <Button component={RouterLink} to={`/ai/requirements${trackerQuery ? `?${trackerQuery}` : ''}`} size="small" variant="outlined">
                          Open Requirements
                        </Button>
                        <Button component={RouterLink} to={`/ai/mapping${trackerQuery ? `?${trackerQuery}` : ''}`} size="small" variant="outlined">
                          Open Payload Mapping
                        </Button>
                        <Button component={RouterLink} to={`/snapshots/new${trackerQuery ? `?${trackerQuery}` : ''}`} size="small" variant="outlined">
                          Open Snapshot Wizard
                        </Button>
                        {activeStatus.links?.assemblyPrUrl ? (
                          <Button
                            component="a"
                            href={activeStatus.links.assemblyPrUrl}
                            target="_blank"
                            rel="noreferrer"
                            size="small"
                            variant="outlined"
                          >
                            Open Assembly
                          </Button>
                        ) : (
                          <Button size="small" variant="outlined" disabled>
                            Open Assembly
                          </Button>
                        )}
                        <Button component={RouterLink} to={`/ai/testing${trackerQuery ? `?${trackerQuery}` : ''}`} size="small" variant="outlined">
                          Open Testing
                        </Button>
                      </Stack>
                      {!activeStatus.links?.assemblyPrUrl ? (
                        <InlineHelpText>Assembly PR URL not set yet.</InlineHelpText>
                      ) : null}
                    </Stack>
                  </Paper>
                </Grid>
              </Grid>

              {activeStatus.blockers?.length ? (
                <Paper
                  variant="outlined"
                  sx={{ p: 2, borderRadius: 1, borderColor: 'error.light', backgroundColor: 'action.hover' }}
                >
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2" color="error">
                      Blockers
                    </Typography>
                    {activeStatus.blockers.map((blocker, index) => (
                      <Typography key={`${blocker}-${index}`} variant="body2">
                        - {blocker}
                      </Typography>
                    ))}
                  </Stack>
                </Paper>
              ) : null}

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 1 }}>
                <Stack spacing={1}>
                  <Typography variant="subtitle2">Manual Overrides</Typography>
                  <TextField
                    label="Blocker note"
                    value={blockerNote}
                    onChange={(event) => {
                      setBlockerNote(event.target.value);
                      if (blockerError) {
                        setBlockerError('');
                      }
                    }}
                    error={Boolean(blockerError)}
                    helperText={blockerError || 'Required when marking the current stage as blocked.'}
                    size="small"
                    fullWidth
                  />
                  <Stack direction="row" spacing={1}>
                    <Button size="small" variant="outlined" onClick={handleMarkBlocked}>
                      Mark Blocked
                    </Button>
                    <Button size="small" variant="contained" onClick={handleMarkDone}>
                      Mark Done
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            </Stack>
          ) : (
            <EmptyState
              title="No status tracked yet"
              description="Choose a country and start tracking its onboarding stages."
              action={
                <Button variant="contained" onClick={handleStartTracking} disabled={!normalizedCountry}>
                  Start Tracking
                </Button>
              }
            />
          )}
        </Stack>
      </CardSection>

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
        title="Onboarding Portfolio"
        subtitle="All tracked statuses across countries and flows."
      >
        {statuses.length ? (
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
                    Flow
                  </TableCell>
                  <TableCell
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                  >
                    Current Stage
                  </TableCell>
                  <TableCell
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                  >
                    %
                  </TableCell>
                  <TableCell
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                  >
                    Lifecycle
                  </TableCell>
                  <TableCell
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                  >
                    Blocked?
                  </TableCell>
                  <TableCell
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                  >
                    Updated
                  </TableCell>
                  <TableCell
                    sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.72rem', color: 'text.secondary' }}
                  >
                    Owner
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
                {statuses.map((status) => (
                  <TableRow key={`${status.countryCode}-${status.flow}`} hover>
                    <TableCell>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {status.countryCode}
                      </Typography>
                    </TableCell>
                    <TableCell>{status.flow}</TableCell>
                    <TableCell>{status.currentStage}</TableCell>
                    <TableCell>{status.percentComplete}%</TableCell>
                    <TableCell>{status.lifecycle}</TableCell>
                    <TableCell>
                      <Chip
                        label={status.blockers?.length ? 'Yes' : 'No'}
                        color={status.blockers?.length ? 'error' : 'success'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      {status.updatedAt ? new Date(status.updatedAt).toLocaleString() : 'n/a'}
                    </TableCell>
                    <TableCell>{status.owner ?? '—'}</TableCell>
                    <TableCell align="right">
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => {
                          setSelectedCountry(status.countryCode);
                          setSelectedFlow(status.flow);
                        }}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <EmptyState
            title="No onboarding statuses yet"
            description="Statuses appear here after you start tracking a country."
            action={
              <Button variant="contained" onClick={handleStartTracking} disabled={!normalizedCountry}>
                Start Tracking
              </Button>
            }
          />
        )}
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
