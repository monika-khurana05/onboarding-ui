import { zodResolver } from '@hookform/resolvers/zod';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveIcon from '@mui/icons-material/Save';
import { Alert, CircularProgress, FormControlLabel, Grid, MenuItem, Stack, Switch, Tab, Tabs, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { JsonAdvancedEditor } from '../../components/JsonAdvancedEditor';
import { SectionCard } from '../../components/SectionCard';
import { capabilityDomains } from './domains';
import { snapshotFormDefaults } from './defaultValues';
import { snapshotFormSchema, type SnapshotFormValues } from './schema';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
type SnapshotRequestFormProps = {
  submitting: boolean;
  submitError?: string | null;
  onSubmit: (values: SnapshotFormValues) => Promise<void> | void;
};

export function SnapshotRequestForm({ submitting, submitError, onSubmit }: SnapshotRequestFormProps) {
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');
  const [jsonValue, setJsonValue] = useState(JSON.stringify(snapshotFormDefaults, null, 2));
  const [jsonError, setJsonError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<SnapshotFormValues>({
    resolver: zodResolver(snapshotFormSchema),
    defaultValues: snapshotFormDefaults,
    mode: 'onChange',
    reValidateMode: 'onChange'
  });

  const values = watch();

  useEffect(() => {
    if (editorMode === 'form') {
      setJsonValue(JSON.stringify(values, null, 2));
      setJsonError(null);
    }
  }, [editorMode, values]);

  const helperText = (errorMessage: string | undefined, guidance: string) => errorMessage ?? guidance;

  const domainRows = useMemo(
    () =>
      capabilityDomains.map((domain) => (
        <Grid key={domain.slug} size={{ xs: 12, md: 6 }}>
          <Controller
            name={`domains.${domain.slug}`}
            control={control}
            render={({ field }) => (
              <Stack className="border border-border rounded-[var(--radius-sm)] p-1.5" spacing={0.75}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={field.value}
                      onChange={(_, checked) => field.onChange(checked)}
                      aria-label={`Enable ${domain.label}`}
                    />
                  }
                  label={domain.label}
                />
                <Typography variant="caption" color="text.secondary">
                  {domain.description}
                </Typography>
              </Stack>
            )}
          />
        </Grid>
      )),
    [control]
  );

  const handleJsonChange = (next: string) => {
    setJsonValue(next);
    try {
      const parsed = JSON.parse(next) as unknown;
      const result = snapshotFormSchema.safeParse(parsed);
      if (!result.success) {
        setJsonError(result.error.issues[0]?.message ?? 'Payload is invalid.');
        return;
      }
      reset(result.data);
      setJsonError(null);
    } catch {
      setJsonError('JSON parse error. Check commas, quotes, and brackets.');
    }
  };

  return (
    <Stack
      component="form"
      spacing={2}
      noValidate
      onSubmit={handleSubmit(async (formValues) => {
        if (editorMode === 'json' && jsonError) {
          return;
        }
        await onSubmit(formValues);
      })}
      aria-label="Snapshot request form"
    >
      {submitError ? <Alert severity="error">{submitError}</Alert> : null}

      <SectionCard
        title="Snapshot Input"
        subtitle="Build the country snapshot that drives FSM/config generation and repository commits."
        actions={
          <Tabs
            value={editorMode}
            onChange={(_, value: 'form' | 'json') => setEditorMode(value)}
            aria-label="Snapshot editor mode"
          >
            <Tab value="form" label="Form Mode" />
            <Tab value="json" label="Advanced JSON" />
          </Tabs>
        }
      >
        {editorMode === 'form' ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 2 }}>
              <Input
                fullWidth
                label="Country Code"
                placeholder="GB, SG, AE"
                inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
                error={Boolean(errors.countryCode)}
                helperText={helperText(errors.countryCode?.message, 'Used in routing, IDs, and generated repo payloads.')}
                {...register('countryCode', { setValueAs: (value: string) => value.toUpperCase() })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Input
                fullWidth
                label="Country Name"
                placeholder="United Kingdom"
                error={Boolean(errors.countryName)}
                helperText={helperText(errors.countryName?.message, 'Display name used in onboarding records and review screens.')}
                {...register('countryName')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Input
                fullWidth
                label="Legal Entity"
                placeholder="CPX Markets Ltd"
                error={Boolean(errors.legalEntity)}
                helperText={helperText(errors.legalEntity?.message, 'Entity name used in generated approvals and config metadata.')}
                {...register('legalEntity')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Controller
                name="region"
                control={control}
                render={({ field }) => (
                  <Input
                    fullWidth
                    select
                    label="Region"
                    value={field.value}
                    onChange={field.onChange}
                    error={Boolean(errors.region)}
                    helperText={helperText(errors.region?.message, 'Controls regional defaults and operational ownership.')}
                  >
                    <MenuItem value="Americas">Americas</MenuItem>
                    <MenuItem value="EMEA">EMEA</MenuItem>
                    <MenuItem value="APAC">APAC</MenuItem>
                  </Input>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Input
                fullWidth
                label="Requested By"
                placeholder="onboarding.ops@cpx.com"
                error={Boolean(errors.requestedBy)}
                helperText={helperText(errors.requestedBy?.message, 'Audit contact for approvals and follow-up questions.')}
                {...register('requestedBy')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <Controller
                name="commitStrategy"
                control={control}
                render={({ field }) => (
                  <Input
                    fullWidth
                    select
                    label="Commit Strategy"
                    value={field.value}
                    onChange={field.onChange}
                    error={Boolean(errors.commitStrategy)}
                    helperText={helperText(errors.commitStrategy?.message, 'Defines how generated output is grouped for commits.')}
                  >
                    <MenuItem value="mono-repo">Mono Repo</MenuItem>
                    <MenuItem value="multi-repo">Multi Repo</MenuItem>
                  </Input>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 5 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1 }}>
                <Controller
                  name="generateFsm"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(_, checked) => field.onChange(checked)}
                          aria-label="Generate FSM"
                        />
                      }
                      label="Generate FSM"
                    />
                  )}
                />
                <Controller
                  name="generateConfigs"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={field.value}
                          onChange={(_, checked) => field.onChange(checked)}
                          aria-label="Generate configs"
                        />
                      }
                      label="Generate Configs"
                    />
                  )}
                />
              </Stack>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Input
                fullWidth
                multiline
                minRows={3}
                label="Notes"
                placeholder="Optional context for approvers and commit pipeline."
                error={Boolean(errors.notes)}
                helperText={helperText(errors.notes?.message, 'Context shared with reviewers and deployment operators.')}
                {...register('notes')}
              />
            </Grid>
          </Grid>
        ) : (
          <Stack spacing={1.5}>
            <JsonAdvancedEditor ariaLabel="Snapshot payload JSON editor" value={jsonValue} onChange={handleJsonChange} />
            {jsonError ? <Alert severity="warning">{jsonError}</Alert> : null}
          </Stack>
        )}
      </SectionCard>

      <SectionCard
        title="Capability Domain Mapping"
        subtitle="Enable the capability domains included in generated FSM/config outputs."
      >
        <Grid container spacing={1.5}>
          {domainRows}
        </Grid>
      </SectionCard>

      <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" gap={1.25}>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          onClick={() => {
            reset(snapshotFormDefaults);
            setEditorMode('form');
            setJsonError(null);
          }}
          aria-label="Reset snapshot form"
        >
          Reset
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={
            submitting ? <CircularProgress size={16} color="inherit" /> : <SaveIcon fontSize="small" />
          }
          disabled={submitting || Boolean(jsonError)}
          aria-label="Create snapshot"
        >
          {submitting ? 'Creating Snapshot...' : 'Create Snapshot'}
        </Button>
      </Stack>

      <Alert icon={<AutoFixHighIcon />} severity="info">
        Snapshot creation is non-destructive. You can version and regenerate previews without losing prior state.
      </Alert>
    </Stack>
  );
}


