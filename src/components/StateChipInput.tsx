import { Autocomplete, Button, Chip, Stack, TextField } from '@mui/material';
import { useMemo, useState } from 'react';
import { fsmCatalog } from '../lib/fsmCatalog';

type StateChipInputProps = {
  states: string[];
  onAddState: (stateName: string) => void;
  onRemoveState: (stateName: string) => void;
  catalogStates?: string[];
};

const normalizeStateKey = (value: string) => value.trim().toUpperCase();
const buildStateChipKey = (value: string) => encodeURIComponent(value || '');

export function StateChipInput({
  states,
  onAddState,
  onRemoveState,
  catalogStates: catalogStatesProp
}: StateChipInputProps) {
  const [inputValue, setInputValue] = useState('');
  const catalogStates = catalogStatesProp ?? fsmCatalog.states;
  const catalogStateKeys = useMemo(
    () => new Set(catalogStates.map((state) => normalizeStateKey(state))),
    [catalogStates]
  );
  const stateKeys = useMemo(() => new Set(states.map((state) => normalizeStateKey(state))), [states]);

  const handleAdd = (candidate?: string) => {
    const next = (candidate ?? inputValue).trim();
    if (!next) {
      return;
    }
    const key = normalizeStateKey(next);
    if (stateKeys.has(key)) {
      setInputValue('');
      return;
    }
    onAddState(next);
    setInputValue('');
  };

  return (
    <Stack spacing={1}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Autocomplete
          freeSolo
          options={catalogStates}
          inputValue={inputValue}
          onInputChange={(_, nextValue) => setInputValue(nextValue)}
          onChange={(_, nextValue) => {
            if (typeof nextValue === 'string' && nextValue.trim()) {
              handleAdd(nextValue);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Add State"
              size="small"
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.defaultPrevented) {
                  event.preventDefault();
                  handleAdd();
                }
              }}
              fullWidth
            />
          )}
          fullWidth
        />
        <Button variant="outlined" onClick={() => handleAdd()} sx={{ whiteSpace: 'nowrap' }}>
          Add State
        </Button>
      </Stack>
      <Stack direction="row" gap={1} flexWrap="wrap">
        {states.map((state) => {
          const isCatalogState = catalogStateKeys.has(normalizeStateKey(state));
          return (
            <Chip
              key={state}
              label={state}
              data-state-chip={buildStateChipKey(state)}
              tabIndex={0}
              onDelete={() => onRemoveState(state)}
              color={isCatalogState ? 'success' : 'default'}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}
