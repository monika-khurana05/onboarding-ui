import { zodResolver } from '@hookform/resolvers/zod';
import AddIcon from '@mui/icons-material/Add';
import { Alert, CircularProgress, Stack } from '@mui/material';
import { useForm } from 'react-hook-form';
import { snapshotVersionDefaults } from './defaultValues';
import { snapshotVersionSchema, type SnapshotVersionValues } from './schema';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
type SnapshotVersionFormProps = {
  disabled: boolean;
  loading: boolean;
  error?: string | null;
  onSubmit: (values: SnapshotVersionValues) => Promise<void> | void;
};

export function SnapshotVersionForm({
  disabled,
  loading,
  error,
  onSubmit
}: SnapshotVersionFormProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<SnapshotVersionValues>({
    resolver: zodResolver(snapshotVersionSchema),
    defaultValues: snapshotVersionDefaults,
    mode: 'onChange',
    reValidateMode: 'onChange'
  });

  return (
    <Stack
      component="form"
      spacing={1.5}
      onSubmit={handleSubmit(async (values) => {
        await onSubmit(values);
        reset(snapshotVersionDefaults);
      })}
      aria-label="Snapshot version form"
    >
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Input
        fullWidth
        label="Version Reason"
        placeholder="Example: Added sanctions fallback path for local regulator controls."
        disabled={disabled || loading}
        error={Boolean(errors.reason)}
        helperText={errors.reason?.message ?? 'Explains why this version exists for audit and rollback decisions.'}
        {...register('reason')}
      />
      <Button
        type="submit"
        variant="outlined"
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <AddIcon />}
        disabled={disabled || loading}
        aria-label="Create snapshot version"
      >
        {loading ? 'Creating Version...' : 'Create New Version'}
      </Button>
    </Stack>
  );
}


