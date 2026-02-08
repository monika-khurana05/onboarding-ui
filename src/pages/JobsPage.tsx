import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Alert, Stack, Typography } from '@mui/material';
import { SectionCard } from '../components/SectionCard';

export function JobsPage() {
  return (
    <Stack spacing={2}>
      <SectionCard title="Jobs" subtitle="Phase 3 placeholder for PR automation and job orchestration.">
        <Stack spacing={1.5}>
          <Typography variant="body2" color="text.secondary">
            This section will host asynchronous job tracking for PR automation, approvals, and merge status.
          </Typography>
          <Alert icon={<AccessTimeIcon />} severity="info">
            Placeholder page: Phase 3 automation UI not yet implemented.
          </Alert>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
