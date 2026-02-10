import { Button, Stack } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { CardSection } from '../components/CardSection';
import { InlineHelpText } from '../components/InlineHelpText';
import { PageContainer } from '../components/PageContainer';

export function NotFoundPage() {
  return (
    <PageContainer title="Page Not Found" subtitle="The requested route does not exist in this onboarding console.">
      <CardSection title="Route Unavailable" subtitle="Use primary navigation to return to a valid workflow.">
        <Stack spacing={2}>
          <InlineHelpText>Check the URL or return to the dashboard.</InlineHelpText>
          <Button component={RouterLink} to="/" variant="contained" aria-label="Return to dashboard">
            Back to Dashboard
          </Button>
        </Stack>
      </CardSection>
    </PageContainer>
  );
}
