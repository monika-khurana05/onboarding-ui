import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { Alert, Button, Snackbar, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import { SectionCard } from '../components/SectionCard';
import { useCreateOnboardingMutation, useTemplatesQuery } from '../features/countries/hooks';
import { CountryOnboardingForm } from '../features/onboarding/CountryOnboardingForm';
import type { CountryOnboardingInput } from '../features/onboarding/schema';
import { env } from '../lib/env';

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return 'Unable to submit onboarding request.';
}

export function OnboardingPage() {
  const templatesQuery = useTemplatesQuery();
  const createMutation = useCreateOnboardingMutation();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const templateLoadState = useMemo(() => {
    if (templatesQuery.isLoading) {
      return 'loading';
    }
    if (templatesQuery.isError) {
      return 'error';
    }
    return 'ready';
  }, [templatesQuery.isError, templatesQuery.isLoading]);

  const submit = async (payload: CountryOnboardingInput) => {
    setSubmitError(null);
    try {
      const result = await createMutation.mutateAsync(payload);
      setSuccessMessage(result.message);
    } catch (error) {
      setSubmitError(getErrorMessage(error));
    }
  };

  return (
    <Stack spacing={2}>
      {!env.apiBaseUrl ? (
        <Alert icon={<InfoOutlinedIcon />} severity="info">
          `VITE_API_BASE_URL` is not set. Running in local sample-data mode.
        </Alert>
      ) : null}

      {templateLoadState === 'error' ? (
        <Alert
          severity="warning"
          action={
            <Button color="inherit" size="small" onClick={() => void templatesQuery.refetch()}>
              Retry
            </Button>
          }
        >
          Templates failed to load. You can continue onboarding manually.
        </Alert>
      ) : null}

      {templateLoadState === 'loading' ? (
        <Alert severity="info">Loading template metadata. You can still fill the form now.</Alert>
      ) : null}

      <SectionCard
        title="Country Onboarding Request"
        subtitle="Create and validate onboarding payloads through guided fields or advanced JSON."
      >
        <CountryOnboardingForm
          templates={templatesQuery.data ?? []}
          submitting={createMutation.isPending}
          submitError={submitError}
          onSubmit={submit}
        />
      </SectionCard>

      <Snackbar
        open={Boolean(successMessage)}
        autoHideDuration={5000}
        onClose={() => setSuccessMessage(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert severity="success" onClose={() => setSuccessMessage(null)} sx={{ width: '100%' }}>
          {successMessage}
        </Alert>
      </Snackbar>
    </Stack>
  );
}
