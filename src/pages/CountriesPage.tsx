import PublicOffOutlinedIcon from '@mui/icons-material/PublicOffOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import { InputAdornment, Stack } from '@mui/material';
import { useMemo, useState } from 'react';
import { CardSection } from '../components/CardSection';
import { EmptyState } from '../components/EmptyState';
import { ErrorState } from '../components/ErrorState';
import { PageContainer } from '../components/PageContainer';
import { SkeletonState } from '../components/SkeletonState';
import { CountryTable } from '../features/countries/CountryTable';
import { useCountriesQuery } from '../features/countries/hooks';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
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
    return (
      <PageContainer title="Countries" subtitle="Track country readiness and filter by ownership or region.">
        <CardSection title="Country Portfolio" subtitle="Operational country records used by onboarding workflows.">
          <Stack spacing={2.5}>
            <SkeletonState variant="form" rows={2} />
            <SkeletonState variant="table" rows={7} />
          </Stack>
        </CardSection>
      </PageContainer>
    );
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
        title="No countries configured yet"
        description="Country records will appear after your first onboarding submission."
        icon={<PublicOffOutlinedIcon color="action" />}
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
          <Input
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
            <EmptyState
              title="No matching countries"
              description="Try a broader filter or clear the search."
              icon={<SearchOffOutlinedIcon color="action" />}
              actionLabel="Clear Search"
              onAction={() => setSearchTerm('')}
            />
          )}
        </Stack>
      </CardSection>
    </PageContainer>
  );
}


