import { zodResolver } from '@hookform/resolvers/zod';
import PreviewIcon from '@mui/icons-material/Preview';
import {
  Alert,
  Autocomplete,
  Button,
  CircularProgress,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import type { RepoDefault } from './types';
import { generatePreviewDefaults } from './defaultValues';
import { generatePreviewSchema, type GeneratePreviewValues } from './schema';

type GeneratePreviewFormProps = {
  repos: RepoDefault[];
  defaultSnapshotId?: string;
  defaultVersion?: number;
  loading: boolean;
  error?: string | null;
  onSubmit: (values: GeneratePreviewValues) => Promise<void> | void;
};

export function GeneratePreviewForm({
  repos,
  defaultSnapshotId,
  defaultVersion,
  loading,
  error,
  onSubmit
}: GeneratePreviewFormProps) {
  const {
    control,
    register,
    setValue,
    handleSubmit,
    formState: { errors }
  } = useForm<GeneratePreviewValues>({
    resolver: zodResolver(generatePreviewSchema),
    defaultValues: generatePreviewDefaults
  });

  useEffect(() => {
    if (defaultSnapshotId) {
      setValue('snapshotId', defaultSnapshotId, { shouldDirty: true });
    }
    if (typeof defaultVersion === 'number') {
      setValue('version', String(defaultVersion), { shouldDirty: true });
    }
  }, [defaultSnapshotId, defaultVersion, setValue]);

  return (
    <Stack
      component="form"
      spacing={1.5}
      onSubmit={handleSubmit(async (values) => onSubmit(values))}
      aria-label="Generate preview form"
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <TextField
        label="Snapshot ID"
        fullWidth
        error={Boolean(errors.snapshotId)}
        helperText={errors.snapshotId?.message}
        {...register('snapshotId')}
      />
      <TextField
        label="Version (optional)"
        fullWidth
        placeholder="Latest if blank"
        error={Boolean(errors.version)}
        helperText={errors.version?.message}
        {...register('version')}
      />
      <Controller
        name="repos"
        control={control}
        render={({ field }) => (
          <Autocomplete
            multiple
            freeSolo
            options={repos.map((repo) => repo.slug)}
            value={field.value}
            onChange={(_, values) => field.onChange(values.map((value) => value.trim()).filter(Boolean))}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Target Repositories"
                placeholder="Select one or more repos"
                error={Boolean(errors.repos)}
                helperText={errors.repos?.message}
              />
            )}
          />
        )}
      />
      <Typography variant="caption" color="text.secondary">
        Preview does not commit code. It validates generated artifacts before pushing to repos.
      </Typography>
      <Button
        type="submit"
        variant="contained"
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <PreviewIcon />}
        disabled={loading}
        aria-label="Generate preview"
      >
        {loading ? 'Generating Preview...' : 'Generate Preview'}
      </Button>
    </Stack>
  );
}
