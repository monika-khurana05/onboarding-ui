import { Alert, Chip, FormControlLabel, Grid, List, ListItem, ListItemText, Paper, Stack, Switch, Typography } from '@mui/material';
import { useThemeMode } from '../app/ThemeModeContext';
import { SectionCard } from '../components/SectionCard';
import { env } from '../lib/env';
import { deriveEnvironmentFromApiUrl } from '../lib/environment';

export function SettingsPage() {
  const deploymentEnvironment = deriveEnvironmentFromApiUrl(env.apiBaseUrl);
  const { mode, setMode } = useThemeMode();

  return (
    <Stack spacing={2}>
      <SectionCard title="Appearance" subtitle="Theme preferences for long working sessions.">
        <Stack spacing={1.5}>
          <FormControlLabel
            control={
              <Switch
                checked={mode === 'light'}
                onChange={(_, checked) => setMode(checked ? 'light' : 'dark')}
              />
            }
            label="Light mode"
          />
          <Typography variant="body2" color="text.secondary">
            Dark mode is the default for reduced eye strain, with a light option for bright environments.
          </Typography>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Environment Configuration"
        subtitle="These values are read from Vite environment variables."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                API Base URL
              </Typography>
              <Typography variant="body1">
                {env.apiBaseUrl ?? 'Not configured (sample-data mode active)'}
              </Typography>
            </Paper>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Auth Token
              </Typography>
              <Typography variant="body1">{env.authToken ? 'Configured' : 'Not configured'}</Typography>
            </Paper>
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard title="About" subtitle="Application identity and rollout posture.">
        <Stack spacing={1.25}>
          <Typography variant="body2">Application: CPX Country Onboarding</Typography>
          <Typography variant="body2">Build: Enterprise UI shell for snapshot and preview pipeline</Typography>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2">Environment:</Typography>
            <Chip size="small" label={deploymentEnvironment} color="primary" variant="outlined" />
          </Stack>
        </Stack>
      </SectionCard>

      <SectionCard
        title="Operational Guarantees"
        subtitle="Built-in guardrails aligned to enterprise onboarding standards."
      >
        <List disablePadding>
          <ListItem divider>
            <ListItemText
              primary="Accessible navigation"
              secondary="Keyboard-friendly drawer navigation, labeled controls, and semantic tables."
            />
          </ListItem>
          <ListItem divider>
            <ListItemText
              primary="Recoverable API failures"
              secondary="Every backend operation exposes retry actions without discarding in-progress form values."
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary="Runtime contract validation"
              secondary="Request payloads are Zod-validated and responses are safely parsed from unknown API schemas."
            />
          </ListItem>
        </List>
      </SectionCard>

      <Alert severity="info">
        Configure `VITE_API_BASE_URL` and optional `VITE_AUTH_TOKEN` in `.env` before calling backend endpoints.
      </Alert>
    </Stack>
  );
}
