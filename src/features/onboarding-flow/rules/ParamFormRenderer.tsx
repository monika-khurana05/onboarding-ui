import { FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from '@mui/material';
import type { ParamDefDto } from './types';

type ParamFormRendererProps = {
  paramDefs: ParamDefDto[];
  values: Record<string, unknown>;
  errors?: Record<string, string>;
  onChange: (name: string, value: unknown) => void;
};

export function ParamFormRenderer({ paramDefs, values, errors, onChange }: ParamFormRendererProps) {
  return (
    <Stack spacing={2}>
      {paramDefs.map((param) => {
        const error = errors?.[param.name];
        const value = values[param.name];
        const label = param.ui?.label ?? param.name;

        if (param.type === 'BOOLEAN') {
          return (
            <Stack key={param.name} spacing={0.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={Boolean(value)}
                    onChange={(_, checked) => onChange(param.name, checked)}
                    inputProps={{ 'aria-label': `${label} toggle` }}
                  />
                }
                label={label}
              />
              {error ? (
                <Typography variant="caption" color="error">
                  {error}
                </Typography>
              ) : null}
            </Stack>
          );
        }

        if (param.type === 'ENUM') {
          return (
            <TextField
              key={param.name}
              select
              fullWidth
              size="small"
              label={label}
              value={value ?? ''}
              onChange={(event) => onChange(param.name, event.target.value)}
              error={Boolean(error)}
              helperText={error ?? param.ui?.helperText ?? ' '}
              inputProps={{ 'aria-label': `${label} select` }}
            >
              <MenuItem value="">Select</MenuItem>
              {(param.constraints?.enumValues ?? []).map((option) => (
                <MenuItem key={option} value={option}>
                  {option}
                </MenuItem>
              ))}
            </TextField>
          );
        }

        const isNumber = param.type === 'INT' || param.type === 'LONG' || param.type === 'DECIMAL';
        const isJson = param.type === 'JSON';
        const isList = param.type === 'LIST';

        return (
          <TextField
            key={param.name}
            fullWidth
            size="small"
            label={label}
            value={value ?? ''}
            onChange={(event) => onChange(param.name, event.target.value)}
            error={Boolean(error)}
            helperText={error ?? param.ui?.helperText ?? (isList ? 'Comma-separated values.' : ' ')}
            inputProps={{
              min: isNumber ? param.constraints?.min : undefined,
              max: isNumber ? param.constraints?.max : undefined,
              'aria-label': `${label} input`
            }}
            type={isNumber ? 'number' : 'text'}
            multiline={isJson}
            minRows={isJson ? 4 : undefined}
          />
        );
      })}
    </Stack>
  );
}
