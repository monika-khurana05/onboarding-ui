import { zodResolver } from '@hookform/resolvers/zod';
import CheckIcon from '@mui/icons-material/Check';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import {
  Alert,
  Button,
  CircularProgress,
  FormControlLabel,
  Grid,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { JsonAdvancedEditor } from '../../components/JsonAdvancedEditor';
import { SectionCard } from '../../components/SectionCard';
import type { OnboardingTemplate } from '../countries/types';
import { onboardingDefaultValues } from './defaultValues';
import {
  countryOnboardingSchema,
  type CountryOnboardingInput,
  workflowConfigSchema
} from './schema';

type CountryOnboardingFormProps = {
  templates: OnboardingTemplate[];
  submitting: boolean;
  submitError?: string | null;
  onSubmit: (values: CountryOnboardingInput) => void | Promise<void>;
};

export function CountryOnboardingForm({
  templates,
  submitting,
  submitError,
  onSubmit
}: CountryOnboardingFormProps) {
  const [editorMode, setEditorMode] = useState<'form' | 'json'>('form');
  const [jsonEditorValue, setJsonEditorValue] = useState(
    JSON.stringify(onboardingDefaultValues.workflowConfig, null, 2)
  );
  const [jsonEditorError, setJsonEditorError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');

  const {
    register,
    control,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors }
  } = useForm<CountryOnboardingInput>({
    resolver: zodResolver(countryOnboardingSchema),
    defaultValues: onboardingDefaultValues,
    mode: 'onBlur'
  });

  const workflowConfig = watch('workflowConfig');

  useEffect(() => {
    if (editorMode === 'form') {
      setJsonEditorValue(JSON.stringify(workflowConfig, null, 2));
      setJsonEditorError(null);
    }
  }, [editorMode, workflowConfig]);

  const templateMap = useMemo(() => {
    const map = new Map<string, OnboardingTemplate>();
    for (const template of templates) {
      map.set(template.id, template);
    }
    return map;
  }, [templates]);

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templateMap.get(templateId);
    if (!template) {
      return;
    }
    setValue('region', template.defaultRegion, { shouldValidate: true, shouldDirty: true });
    setValue('regulatoryTier', template.defaultTier, { shouldValidate: true, shouldDirty: true });
    setValue('riskThreshold', template.defaultRiskThreshold, {
      shouldValidate: true,
      shouldDirty: true
    });
  };

  const handleJsonEditorChange = (nextText: string) => {
    setJsonEditorValue(nextText);
    try {
      const parsed = JSON.parse(nextText) as unknown;
      const result = workflowConfigSchema.safeParse(parsed);
      if (!result.success) {
        setJsonEditorError(result.error.issues[0]?.message ?? 'Invalid workflow JSON');
        return;
      }
      setValue('workflowConfig', result.data, { shouldDirty: true, shouldValidate: true });
      setJsonEditorError(null);
    } catch {
      setJsonEditorError('JSON parsing failed. Ensure valid JSON syntax.');
    }
  };

  return (
    <Stack
      component="form"
      spacing={2}
      noValidate
      onSubmit={handleSubmit(async (values) => {
        if (editorMode === 'json' && jsonEditorError) {
          return;
        }
        await onSubmit(values);
      })}
      aria-label="Country onboarding form"
    >
      {submitError ? <Alert severity="error">{submitError}</Alert> : null}

      <SectionCard
        title="Country Profile"
        subtitle="Define jurisdiction, launch timeline, and settlement defaults."
      >
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Country Name"
              error={Boolean(errors.countryName)}
              helperText={errors.countryName?.message}
              {...register('countryName')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="ISO Code"
              error={Boolean(errors.iso2)}
              helperText={errors.iso2?.message}
              inputProps={{ maxLength: 2, style: { textTransform: 'uppercase' } }}
              {...register('iso2', {
                setValueAs: (value: string) => value.toUpperCase()
              })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Controller
              name="region"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  select
                  label="Region"
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(errors.region)}
                  helperText={errors.region?.message}
                >
                  <MenuItem value="Americas">Americas</MenuItem>
                  <MenuItem value="EMEA">EMEA</MenuItem>
                  <MenuItem value="APAC">APAC</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 3 }}>
            <Controller
              name="regulatoryTier"
              control={control}
              render={({ field }) => (
                <TextField
                  fullWidth
                  select
                  label="Regulatory Tier"
                  value={field.value}
                  onChange={field.onChange}
                  error={Boolean(errors.regulatoryTier)}
                  helperText={errors.regulatoryTier?.message}
                >
                  <MenuItem value="Tier 1">Tier 1</MenuItem>
                  <MenuItem value="Tier 2">Tier 2</MenuItem>
                  <MenuItem value="Tier 3">Tier 3</MenuItem>
                </TextField>
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              type="date"
              label="Target Launch Date"
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.launchDate)}
              helperText={errors.launchDate?.message}
              {...register('launchDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Settlement Currency"
              error={Boolean(errors.settlementCurrency)}
              helperText={errors.settlementCurrency?.message}
              inputProps={{ maxLength: 3, style: { textTransform: 'uppercase' } }}
              {...register('settlementCurrency', {
                setValueAs: (value: string) => value.toUpperCase()
              })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              type="number"
              label="Risk Threshold"
              error={Boolean(errors.riskThreshold)}
              helperText={errors.riskThreshold?.message ?? 'Scale: 1 (low risk) to 100 (high risk)'}
              inputProps={{ min: 1, max: 100 }}
              {...register('riskThreshold', { valueAsNumber: true })}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <TextField
              fullWidth
              select
              label="Template"
              value={selectedTemplateId}
              onChange={(event) => applyTemplate(event.target.value)}
              helperText="Choose a template to prefill region, tier, and risk controls."
            >
              <MenuItem value="">No template</MenuItem>
              {templates.map((template) => (
                <MenuItem key={template.id} value={template.id}>
                  {template.name}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Controller
              name="enableSanctionsScreening"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} />}
                  label="Sanctions"
                />
              )}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <Controller
              name="goLiveChecklistComplete"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} />}
                  label="Checklist"
                />
              )}
            />
          </Grid>
        </Grid>
      </SectionCard>

      <SectionCard
        title="Workflow Controls"
        subtitle="Fine-tune approval, escalation, and notification behavior."
        actions={
          <Tabs
            value={editorMode}
            onChange={(_, value: 'form' | 'json') => setEditorMode(value)}
            aria-label="Workflow editor mode"
          >
            <Tab label="Form Editor" value="form" />
            <Tab label="Advanced JSON" value="json" />
          </Tabs>
        }
      >
        {editorMode === 'form' ? (
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 4 }}>
              <Controller
                name="workflowConfig.approvalMode"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    label="Approval Mode"
                    value={field.value}
                    onChange={field.onChange}
                    error={Boolean(errors.workflowConfig?.approvalMode)}
                    helperText={errors.workflowConfig?.approvalMode?.message}
                  >
                    <MenuItem value="single">Single approver</MenuItem>
                    <MenuItem value="dual">Dual control</MenuItem>
                    <MenuItem value="committee">Committee</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Controller
                name="workflowConfig.alertChannel"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    fullWidth
                    label="Alert Channel"
                    value={field.value}
                    onChange={field.onChange}
                    error={Boolean(errors.workflowConfig?.alertChannel)}
                    helperText={errors.workflowConfig?.alertChannel?.message}
                  >
                    <MenuItem value="email">Email</MenuItem>
                    <MenuItem value="slack">Slack</MenuItem>
                    <MenuItem value="service-desk">Service Desk</MenuItem>
                  </TextField>
                )}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                label="Settlement Cutoff"
                placeholder="17:00"
                error={Boolean(errors.workflowConfig?.settlementCutoff)}
                helperText={errors.workflowConfig?.settlementCutoff?.message ?? '24h format HH:MM'}
                {...register('workflowConfig.settlementCutoff')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="number"
                label="Escalation Hours"
                error={Boolean(errors.workflowConfig?.escalationHours)}
                helperText={errors.workflowConfig?.escalationHours?.message}
                inputProps={{ min: 1, max: 72 }}
                {...register('workflowConfig.escalationHours', { valueAsNumber: true })}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 8 }}>
              <Controller
                name="workflowConfig.autoProvision"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={<Switch checked={field.value} onChange={(_, checked) => field.onChange(checked)} />}
                    label="Auto-provision downstream routing and permissions"
                  />
                )}
              />
            </Grid>
          </Grid>
        ) : (
          <Stack spacing={1.5}>
            <JsonAdvancedEditor
              ariaLabel="Workflow JSON editor"
              value={jsonEditorValue}
              onChange={handleJsonEditorChange}
            />
            {jsonEditorError ? <Alert severity="warning">{jsonEditorError}</Alert> : null}
          </Stack>
        )}
      </SectionCard>

      <Stack direction={{ xs: 'column-reverse', sm: 'row' }} justifyContent="space-between" gap={1.5}>
        <Button
          variant="outlined"
          startIcon={<RestartAltIcon />}
          aria-label="Reset form"
          onClick={() => {
            reset(onboardingDefaultValues);
            setSelectedTemplateId('');
            setEditorMode('form');
            setJsonEditorError(null);
          }}
        >
          Reset
        </Button>
        <Button
          type="submit"
          variant="contained"
          startIcon={
            submitting ? <CircularProgress size={16} color="inherit" /> : <CheckIcon fontSize="small" />
          }
          aria-label="Start onboarding workflow"
          disabled={submitting || Boolean(jsonEditorError)}
        >
          {submitting ? 'Submitting...' : 'Start Onboarding Run'}
        </Button>
      </Stack>
    </Stack>
  );
}
