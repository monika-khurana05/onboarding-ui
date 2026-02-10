import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { IconButton, MenuItem, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { useMemo, useState } from 'react';
import type { SnapshotWorkflow, SnapshotWorkflowTransition } from '../models/snapshot';

import { Button } from '@ui/Button';
import { Input } from '@ui/Input';
import { Card } from '@ui/Card';
import { Badge } from '@ui/Badge';
type WorkflowEditorProps = {
  value: SnapshotWorkflow;
  onChange: (next: SnapshotWorkflow) => void;
  helperText?: string;
  showErrors?: boolean;
};

export function WorkflowEditor({ value, onChange, helperText, showErrors = true }: WorkflowEditorProps) {
  const [stateInput, setStateInput] = useState('');

  const states = value.states;
  const workflowKeyError = showErrors && !value.workflowKey.trim();
  const canAddTransition = states.length > 0;

  const transitionErrors = useMemo(
    () =>
      value.transitions.map((transition) => ({
        from: transition.from && states.includes(transition.from),
        to: transition.to && states.includes(transition.to),
        onEvent: transition.onEvent.trim().length > 0
      })),
    [states, value.transitions]
  );

  const handleAddState = () => {
    const next = stateInput.trim().toUpperCase();
    if (!next) {
      return;
    }
    if (states.includes(next)) {
      setStateInput('');
      return;
    }
    onChange({
      ...value,
      states: [...states, next]
    });
    setStateInput('');
  };

  const handleRemoveState = (state: string) => {
    const nextStates = states.filter((value) => value !== state);
    const nextTransitions = value.transitions.filter(
      (transition) => transition.from !== state && transition.to !== state
    );
    onChange({
      ...value,
      states: nextStates,
      transitions: nextTransitions
    });
  };

  const handleUpdateTransition = (index: number, patch: Partial<SnapshotWorkflowTransition>) => {
    onChange({
      ...value,
      transitions: value.transitions.map((transition, rowIndex) =>
        rowIndex === index ? { ...transition, ...patch } : transition
      )
    });
  };

  const handleAddTransition = () => {
    const template: SnapshotWorkflowTransition = {
      from: states[0] ?? '',
      to: states[0] ?? '',
      onEvent: ''
    };
    onChange({
      ...value,
      transitions: [...value.transitions, template]
    });
  };

  return (
    <Stack spacing={2}>
      {helperText ? (
        <Typography variant="body2" color="text.secondary">
          {helperText}
        </Typography>
      ) : null}

      <Input
        label="Workflow Key"
        value={value.workflowKey}
        onChange={(event) => onChange({ ...value, workflowKey: event.target.value })}
        error={workflowKeyError}
        helperText={workflowKeyError ? 'Workflow key is required.' : 'Unique key for the CPX state manager.'}
      />

      <Stack spacing={1}>
        <Typography variant="subtitle2">States</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <Input
            label="Add State"
            size="small"
            value={stateInput}
            onChange={(event) => setStateInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleAddState();
              }
            }}
            fullWidth
          />
          <Button variant="outlined" onClick={handleAddState} sx={{ whiteSpace: 'nowrap' }}>
            Add State
          </Button>
        </Stack>
        <Stack direction="row" gap={1} flexWrap="wrap">
          {states.map((state) => (
            <Badge key={state} label={state} onDelete={() => handleRemoveState(state)} />
          ))}
        </Stack>
        {showErrors && states.length === 0 ? (
          <Typography variant="caption" color="error">
            Add at least one state.
          </Typography>
        ) : null}
      </Stack>

      <Stack spacing={1}>
        <Typography variant="subtitle2">Transitions</Typography>
        <TableContainer component={Card} variant="outlined">
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>From</TableCell>
                <TableCell>To</TableCell>
                <TableCell>On Event</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {value.transitions.map((transition, index) => {
                const errors = transitionErrors[index];
                const fromError = showErrors && !errors?.from;
                const toError = showErrors && !errors?.to;
                const eventError = showErrors && !errors?.onEvent;
                return (
                  <TableRow key={`${transition.from}-${transition.to}-${index}`}>
                    <TableCell>
                      <Input
                        select
                        size="small"
                        value={transition.from}
                        onChange={(event) => handleUpdateTransition(index, { from: event.target.value })}
                        error={fromError}
                        helperText={fromError ? 'Select a state' : ' '}
                        fullWidth
                      >
                        {states.map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))}
                      </Input>
                    </TableCell>
                    <TableCell>
                      <Input
                        select
                        size="small"
                        value={transition.to}
                        onChange={(event) => handleUpdateTransition(index, { to: event.target.value })}
                        error={toError}
                        helperText={toError ? 'Select a state' : ' '}
                        fullWidth
                      >
                        {states.map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))}
                      </Input>
                    </TableCell>
                    <TableCell>
                      <Input
                        size="small"
                        value={transition.onEvent}
                        onChange={(event) => handleUpdateTransition(index, { onEvent: event.target.value })}
                        error={eventError}
                        helperText={eventError ? 'Event required' : ' '}
                        fullWidth
                      />
                    </TableCell>
                    <TableCell>
                      <IconButton
                        aria-label="Remove transition"
                        onClick={() =>
                          onChange({
                            ...value,
                            transitions: value.transitions.filter((_, rowIndex) => rowIndex !== index)
                          })
                        }
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {value.transitions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Typography variant="body2" color="text.secondary">
                      No transitions configured yet.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </TableContainer>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={handleAddTransition}
          disabled={!canAddTransition}
        >
          Add Transition
        </Button>
      </Stack>
    </Stack>
  );
}


