import RefreshIcon from '@mui/icons-material/Refresh';
import { Button, InputAdornment, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useMemo, useState } from 'react';
import { CardSection } from '../components/CardSection';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { InlineHelpText } from '../components/InlineHelpText';
import { LoadingState } from '../components/LoadingState';
import { PageContainer } from '../components/PageContainer';
import { CountryTable } from '../features/countries/CountryTable';
import { useCountriesQuery } from '../features/countries/hooks';

export function CountriesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const countriesQuery = useCountriesQuery();

  const filteredCountries = useMemo(() => {
    const value = searchTerm.trim().toLowerCase();
    const countries = countriesQuery.data ?? [];
    if (!value) {
      return countries;
    }
    return countries.filter(
      (country) =>
        country.name.toLowerCase().includes(value) ||
        country.iso2.toLowerCase().includes(value) ||
        country.region.toLowerCase().includes(value)
    );
  }, [countriesQuery.data, searchTerm]);

  if (countriesQuery.isLoading) {
    return <LoadingState message="Loading country portfolio..." minHeight={280} />;
  }

  if (countriesQuery.isError) {
    return (
      <ErrorState
        title="Country data unavailable"
        message={countriesQuery.error?.message ?? 'Unable to load countries.'}
        onRetry={() => void countriesQuery.refetch()}
      />
    );
  }

  if (!(countriesQuery.data ?? []).length) {
    return (
      <EmptyState
        title="No countries configured"
        description="Create your first onboarding request to populate country records."
        actionLabel="Reload"
        onAction={() => void countriesQuery.refetch()}
      />
    );
  }

  return (
    <PageContainer title="Countries" subtitle="Track country readiness and filter by ownership or region.">
      <CardSection
        title="Country Portfolio"
        subtitle="Operational country records used by onboarding workflows."
        actions={
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => void countriesQuery.refetch()}
            aria-label="Refresh countries"
          >
            Refresh
          </Button>
        }
      >
        <Stack spacing={2}>
          <TextField
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            label="Search countries"
            placeholder="Name, ISO code, or region"
            aria-label="Search countries"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              )
            }}
          />
          {filteredCountries.length ? (
            <CountryTable countries={filteredCountries} />
          ) : (
            <Stack sx={{ py: 4 }} spacing={1} alignItems="center">
              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                No matching countries
              </Typography>
              <InlineHelpText>Try a broader filter or reset the search field.</InlineHelpText>
            </Stack>
          )}
        </Stack>
      </CardSection>
    </PageContainer>
  );
}
