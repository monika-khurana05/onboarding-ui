import { Button, Stack, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { SectionCard } from '../components/SectionCard';

export function NotFoundPage() {
  return (
    <SectionCard title="Page Not Found" subtitle="The route does not exist in the onboarding console.">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Check the URL or return to the dashboard.
        </Typography>
        <Button component={RouterLink} to="/" variant="contained" aria-label="Return to dashboard">
          Back to Dashboard
        </Button>
      </Stack>
    </SectionCard>
  );
}
