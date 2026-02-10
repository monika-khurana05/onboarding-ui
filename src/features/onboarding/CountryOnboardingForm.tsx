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
import { countryOnboardingSchema, workflowConfigSchema } from './schema';
import type { CountryOnboardingInput } from './schema';

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
    mode: 'onChange',
    reValidateMode: 'onChange'
  });

  const workflowConfig = watch('workflowConfig');

  useEffect(() => {
    if (editorMode === 'form') {
      setJsonEditorValue(JSON.stringify(workflowConfig, null, 2));
      setJsonEditorError(null);
    }
  }, [editorMode, workflowConfig]);

  const helperText = (errorMessage: string | undefined, guidance: string) => errorMessage ?? guidance;

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
              placeholder="United Kingdom"
              error={Boolean(errors.countryName)}
              helperText={helperText(errors.countryName?.message, 'Used in operations dashboards and approval records.')}
              {...register('countryName')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 2 }}>
            <TextField
              fullWidth
              label="ISO Code"
              placeholder="GB, SG, AE"
              error={Boolean(errors.iso2)}
              helperText={helperText(errors.iso2?.message, 'Primary key for country routing and generated configs.')}
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
                  helperText={helperText(errors.region?.message, 'Determines regulatory routing defaults and ownership.')}
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
                  helperText={helperText(errors.regulatoryTier?.message, 'Sets baseline compliance controls and review depth.')}
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
              helperText={helperText(errors.launchDate?.message, 'Target date used for launch readiness and tracking.')}
              {...register('launchDate')}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              fullWidth
              label="Settlement Currency"
              placeholder="USD, EUR, AED"
              error={Boolean(errors.settlementCurrency)}
              helperText={helperText(errors.settlementCurrency?.message, 'Default currency for settlement and posting flows.')}
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
              placeholder="40"
              error={Boolean(errors.riskThreshold)}
              helperText={helperText(
                errors.riskThreshold?.message,
                'Scale: 1 (low risk) to 100 (high risk) for escalation logic.'
              )}
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
                    helperText={helperText(
                      errors.workflowConfig?.approvalMode?.message,
                      'Defines how many approvals are needed before progression.'
                    )}
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
                    helperText={helperText(
                      errors.workflowConfig?.alertChannel?.message,
                      'Primary channel used for escalation and status alerts.'
                    )}
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
                helperText={helperText(
                  errors.workflowConfig?.settlementCutoff?.message,
                  '24h format HH:MM used by settlement windows and handoffs.'
                )}
                {...register('workflowConfig.settlementCutoff')}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <TextField
                fullWidth
                type="number"
                label="Escalation Hours"
                placeholder="12"
                error={Boolean(errors.workflowConfig?.escalationHours)}
                helperText={helperText(
                  errors.workflowConfig?.escalationHours?.message,
                  'Time limit before escalation when a workflow step stalls.'
                )}
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
