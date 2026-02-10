import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { Alert, Stack } from '@mui/material';
import { CardSection } from '../components/CardSection';
import { InlineHelpText } from '../components/InlineHelpText';
import { PageContainer } from '../components/PageContainer';

export function JobsPage() {
  return (
    <PageContainer title="Jobs" subtitle="Track asynchronous onboarding work and automation pipeline status.">
      <CardSection title="Job Orchestration" subtitle="Phase 3 placeholder for PR automation and approvals.">
        <Stack spacing={1.5}>
          <InlineHelpText>
            This section will host asynchronous job tracking for PR automation, approvals, and merge status.
          </InlineHelpText>
          <Alert icon={<AccessTimeIcon />} severity="info">
            Placeholder page: Phase 3 automation UI not yet implemented.
          </Alert>
        </Stack>
      </CardSection>
    </PageContainer>
  );
}


