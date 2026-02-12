import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  TextField,
  Typography
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import type { WorkflowLintIssue, WorkflowSpec, WorkflowTransitionRow } from '../models/snapshot';
import { deleteTransition, listAllTransitions, renameState, upsertTransition } from '../models/snapshot';
import { applyPreset, workflowPresets } from '../features/onboarding-flow/presets';
import { ActionMultiSelect } from './ActionMultiSelect';

export type WorkflowTabKey = 'transitions' | 'state' | 'yaml';

type WorkflowDefinitionFieldsProps = {
  value: WorkflowSpec;
  onChange: (next: WorkflowSpec) => void;
  helperText?: string;
  showErrors?: boolean;
};

type WorkflowTabPanelsProps = {
  value: WorkflowSpec;
  onChange: (next: WorkflowSpec) => void;
  activeTab: WorkflowTabKey;
  downloadFileName?: string;
  showErrors?: boolean;
  focusIssue?: WorkflowLintIssue | null;
  focusNonce?: number;
};

type TransitionRow = WorkflowTransitionRow & { rowIndex: number };

const retryEventName = 'OnRetry';
const buildStateKey = (name: string) => encodeURIComponent(name || '');
const buildTransitionRowKey = (from: string, eventName: string) =>
  encodeURIComponent(`${from}::${eventName || '__EMPTY__'}`);

type WorkflowPresetsControlProps = {
  value: WorkflowSpec;
  onChange: (next: WorkflowSpec) => void;
  size?: 'small' | 'medium';
};

function WorkflowPresetsControl({ value, onChange, size = 'small' }: WorkflowPresetsControlProps) {
  const [selectedId, setSelectedId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedPreset = useMemo(
    () => workflowPresets.find((preset) => preset.id === selectedId) ?? null,
    [selectedId]
  );

  const handleApply = () => {
    if (!selectedPreset) {
      return;
    }
    onChange(applyPreset(value, selectedPreset));
    setConfirmOpen(false);
    setSelectedId('');
  };

  return (
    <>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        <TextField
          select
          size={size}
          label="Presets"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          sx={{ minWidth: 260 }}
        >
          {workflowPresets.map((preset) => (
            <MenuItem key={preset.id} value={preset.id}>
              {preset.label}
            </MenuItem>
          ))}
        </TextField>
        <Button
          size={size}
          variant="outlined"
          disabled={!selectedPreset}
          onClick={() => setConfirmOpen(true)}
        >
          Apply preset
        </Button>
      </Stack>
      <Dialog open={confirmOpen} onClose={() => setConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Apply preset</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            <Typography variant="body2">
              Apply the preset &quot;{selectedPreset?.label}&quot;? This will merge states and transitions into the
              current workflow. Existing states and events will be preserved.
            </Typography>
            {selectedPreset?.description ? (
              <Typography variant="body2" color="text.secondary">
                {selectedPreset.description}
              </Typography>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleApply} disabled={!selectedPreset}>
            Apply preset
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function removeStateFromSpec(spec: WorkflowSpec, stateName: string): WorkflowSpec {
  const nextStates = spec.states
    .filter((state) => state.name !== stateName)
    .map((state) => {
      const nextOnEvent = Object.fromEntries(
        Object.entries(state.onEvent ?? {}).filter(([, transition]) => transition.target !== stateName)
      );
      return { ...state, onEvent: nextOnEvent };
    });
  const nextStartState =
    spec.startState === stateName ? nextStates[0]?.name ?? '' : spec.startState;
  return { ...spec, startState: nextStartState, states: nextStates };
}

function formatYamlScalar(value: string): string {
  return value.trim();
}

export function generateFsmYaml(spec: WorkflowSpec): string {
  const lines: string[] = [];
  const sortedStates = [...spec.states].sort((left, right) => left.name.localeCompare(right.name));
  if (spec.statesClass?.trim()) {
    lines.push(`statesClass: ${formatYamlScalar(spec.statesClass)}`);
  }
  if (spec.eventsClass?.trim()) {
    lines.push(`eventsClass: ${formatYamlScalar(spec.eventsClass)}`);
  }
  if (!sortedStates.length) {
    lines.push('states: {}');
    return lines.join('\n');
  }

  lines.push('states:');
  sortedStates.forEach((state) => {
    lines.push(`  ${formatYamlScalar(state.name)}:`);
    const events = Object.entries(state.onEvent ?? {}).sort(([left], [right]) => left.localeCompare(right));
    if (!events.length) {
      lines.push('    on_event: {}');
      return;
    }
    lines.push('    on_event:');
    events.forEach(([eventName, transition]) => {
      lines.push(`      ${formatYamlScalar(eventName)}:`);
      lines.push(`        target: ${formatYamlScalar(transition?.target ?? '')}`);
      const actions = transition?.actions ?? [];
      if (!actions.length) {
        lines.push('        actions: []');
        return;
      }
      lines.push(`        actions: [ ${actions.map(formatYamlScalar).join(', ')} ]`);
    });
  });

  return lines.join('\n');
}

export function WorkflowDefinitionFields({
  value,
  onChange,
  helperText,
  showErrors = true
}: WorkflowDefinitionFieldsProps) {
  const [stateInput, setStateInput] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const defaultStatesClass = 'com.citi.cpx.statemanager.fsm.State';
  const defaultEventsClass = 'com.citi.cpx.statemanager.fsm.Event';
  const resolvedStatesClass = value.statesClass?.trim() ? value.statesClass : defaultStatesClass;
  const resolvedEventsClass = value.eventsClass?.trim() ? value.eventsClass : defaultEventsClass;

  const stateNames = useMemo(() => value.states.map((state) => state.name), [value.states]);
  const resolvedStartState = value.startState?.trim() ? value.startState : stateNames[0] ?? '';
  const workflowKeyError = showErrors && !value.workflowKey.trim();

  useEffect(() => {
    if (!stateNames.length && value.startState) {
      onChange({ ...value, startState: '' });
      return;
    }
    if (stateNames.length && value.startState && !stateNames.includes(value.startState)) {
      onChange({ ...value, startState: stateNames[0] ?? '' });
      return;
    }
    if (stateNames.length && !value.startState) {
      onChange({ ...value, startState: stateNames[0] ?? '' });
    }
  }, [stateNames, value.startState, onChange]);

  const handleAddState = () => {
    const next = stateInput.trim().toUpperCase();
    if (!next) {
      return;
    }
    if (stateNames.includes(next)) {
      setStateInput('');
      return;
    }
    onChange({
      ...value,
      states: [...value.states, { name: next, onEvent: {} }]
    });
    setStateInput('');
  };

  const handleRemoveState = (stateName: string) => {
    onChange(removeStateFromSpec(value, stateName));
  };

  return (
    <Stack spacing={2}>
      {helperText ? (
        <Typography variant="body2" color="text.secondary">
          {helperText}
        </Typography>
      ) : null}

      <TextField
        label="Workflow Key"
        value={value.workflowKey}
        onChange={(event) => onChange({ ...value, workflowKey: event.target.value })}
        error={workflowKeyError}
        helperText={workflowKeyError ? 'Workflow key is required.' : 'Unique key for the CPX state manager.'}
      />

      <Accordion expanded={showAdvanced} onChange={(_, expanded) => setShowAdvanced(expanded)} variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="subtitle2">Advanced</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              label="statesClass"
              value={resolvedStatesClass}
              onChange={(event) => {
                const next = event.target.value;
                onChange({ ...value, statesClass: next.trim() ? next : defaultStatesClass });
              }}
              helperText={`Defaults to ${defaultStatesClass}`}
              placeholder={defaultStatesClass}
            />
            <TextField
              label="eventsClass"
              value={resolvedEventsClass}
              onChange={(event) => {
                const next = event.target.value;
                onChange({ ...value, eventsClass: next.trim() ? next : defaultEventsClass });
              }}
              helperText={`Defaults to ${defaultEventsClass}`}
              placeholder={defaultEventsClass}
            />
            <TextField
              select
              label="Start State"
              value={resolvedStartState}
              onChange={(event) => onChange({ ...value, startState: event.target.value })}
              helperText={
                stateNames.length
                  ? 'Used for reachability linting.'
                  : 'Add states to select a start state.'
              }
              disabled={stateNames.length === 0}
            >
              {stateNames.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Stack spacing={1}>
        <Typography variant="subtitle2">States</Typography>
        <WorkflowPresetsControl value={value} onChange={onChange} size="small" />
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <TextField
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
          {stateNames.map((state) => (
            <Chip key={state} label={state} onDelete={() => handleRemoveState(state)} />
          ))}
        </Stack>
        {showErrors && stateNames.length === 0 ? (
          <Typography variant="caption" color="error">
            Add at least one state.
          </Typography>
        ) : null}
      </Stack>
    </Stack>
  );
}

export function WorkflowTabPanels({
  value,
  onChange,
  activeTab,
  downloadFileName = 'workflow-fsm.yaml',
  showErrors = true,
  focusIssue = null,
  focusNonce = 0
}: WorkflowTabPanelsProps) {
  const [activeState, setActiveState] = useState('');
  const [showOnlyCurrentState, setShowOnlyCurrentState] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState<string | null>(null);
  const [patternSelection, setPatternSelection] = useState('');

  const stateNames = useMemo(() => value.states.map((state) => state.name), [value.states]);
  const canAddTransition = stateNames.length > 0;
  const transitionRows = useMemo(
    () => listAllTransitions(value).map((row, index) => ({ ...row, rowIndex: index })),
    [value]
  );

  useEffect(() => {
    if (!activeState || !stateNames.includes(activeState)) {
      setActiveState(stateNames[0] ?? '');
    }
  }, [activeState, stateNames]);

  useEffect(() => {
    if (!focusIssue) {
      return;
    }
    if (focusIssue.tab === 'transitions') {
      if (focusIssue.stateName) {
        setActiveState(focusIssue.stateName);
      }
      setShowOnlyCurrentState(false);
      if (focusIssue.stateName) {
        const rowKey = buildTransitionRowKey(focusIssue.stateName, focusIssue.eventName ?? '');
        const row = document.querySelector<HTMLElement>(`[data-transition-row="${rowKey}"]`);
        if (row) {
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          const field = focusIssue.field ?? 'event';
          const fieldContainer = row.querySelector<HTMLElement>(`[data-transition-field="${field}"]`);
          if (fieldContainer) {
            const focusTarget =
              fieldContainer.querySelector<HTMLElement>('input, textarea, [role="button"]') ?? fieldContainer;
            focusTarget.focus();
          }
        }
      }
      return;
    }

    if (focusIssue.tab === 'state') {
      const nextState = focusIssue.stateName ?? stateNames[0] ?? '';
      if (nextState) {
        setActiveState(nextState);
        const stateKey = buildStateKey(nextState);
        const stateItem = document.querySelector<HTMLElement>(`[data-state-item="${stateKey}"]`);
        if (stateItem) {
          stateItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
          stateItem.focus();
        }
      }
    }
  }, [focusIssue, focusNonce, stateNames]);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(activeState);
      setRenameError(null);
    }
  }, [activeState, isRenaming]);

  const transitionErrors = useMemo(
    () =>
      transitionRows.map((transition) => ({
        from: transition.from && stateNames.includes(transition.from),
        target: transition.target && stateNames.includes(transition.target),
        eventName: transition.eventName.trim().length > 0
      })),
    [stateNames, transitionRows]
  );

  const eventKeyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    transitionRows.forEach((transition) => {
      const normalizedEvent = transition.eventName.trim().toUpperCase();
      if (!normalizedEvent) {
        return;
      }
      const key = `${transition.from}::${normalizedEvent}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return counts;
  }, [transitionRows]);

  const buildUniqueEventName = (from: string, baseEventName: string) => {
    const normalizedExisting = new Set(
      transitionRows
        .filter((transition) => transition.from === from)
        .map((transition) => transition.eventName.trim().toUpperCase())
        .filter(Boolean)
    );
    const base = baseEventName.trim() || 'NEW_EVENT';
    let counter = 0;
    let candidate = `${base}_COPY`;
    while (normalizedExisting.has(candidate.toUpperCase())) {
      counter += 1;
      candidate = `${base}_COPY_${counter}`;
    }
    return candidate;
  };

  const resolveEventName = (from: string, suggested: string) => {
    const normalizedSuggested = suggested.trim().toUpperCase();
    if (!normalizedSuggested) {
      return suggested;
    }
    const key = `${from}::${normalizedSuggested}`;
    if ((eventKeyCounts.get(key) ?? 0) === 0) {
      return suggested;
    }
    return buildUniqueEventName(from, suggested);
  };

  const handleUpdateTransitionRow = (rowIndex: number, patch: Partial<WorkflowTransitionRow>) => {
    const current = transitionRows[rowIndex];
    if (!current) {
      return;
    }
    const next = { ...current, ...patch };
    let nextSpec = value;
    if (current.from !== next.from || current.eventName !== next.eventName) {
      nextSpec = deleteTransition(nextSpec, current.from, current.eventName);
    }
    nextSpec = upsertTransition(nextSpec, next.from, next.eventName, {
      target: next.target,
      actions: next.actions
    });
    onChange(nextSpec);
  };

  const handleRemoveTransitionRow = (rowIndex: number) => {
    const current = transitionRows[rowIndex];
    if (!current) {
      return;
    }
    onChange(deleteTransition(value, current.from, current.eventName));
  };

  const handleDuplicateTransitionRow = (rowIndex: number) => {
    const current = transitionRows[rowIndex];
    if (!current) {
      return;
    }
    const nextEventName = buildUniqueEventName(current.from, current.eventName);
    const nextSpec = upsertTransition(value, current.from, nextEventName, {
      target: current.target,
      actions: current.actions
    });
    onChange(nextSpec);
  };

  const handleQuickAdd = (kind: 'success' | 'failureRecoverable' | 'failureNotRecoverable' | 'retry') => {
    const from = activeState || stateNames[0];
    if (!from) {
      return;
    }
    const suggestedEventName =
      kind === 'success'
        ? `${from}Successful`
        : kind === 'failureRecoverable'
          ? 'EnrichmentFailureRecoverable'
          : kind === 'failureNotRecoverable'
            ? 'EnrichmentFailureNotRecoverable'
            : 'OnRetry';
    const eventName = resolveEventName(from, suggestedEventName);
    const target = from;
    const actions = kind === 'retry' ? ['reset-mtp'] : [];
    const nextSpec = upsertTransition(value, from, eventName, { target, actions });
    onChange(nextSpec);
  };

  const handleAddEvent = () => {
    const from = activeState || stateNames[0];
    if (!from) {
      return;
    }
    const eventName = resolveEventName(from, 'NEW_EVENT');
    const nextSpec = upsertTransition(value, from, eventName, { target: from, actions: [] });
    onChange(nextSpec);
  };

  const handlePatternSelection = (pattern: string) => {
    if (!pattern) {
      return;
    }
    if (pattern === 'success') {
      handleQuickAdd('success');
      return;
    }
    if (pattern === 'failureRecoverable') {
      handleQuickAdd('failureRecoverable');
      return;
    }
    if (pattern === 'failureNotRecoverable') {
      handleQuickAdd('failureNotRecoverable');
      return;
    }
    if (pattern === 'retry') {
      handleQuickAdd('retry');
    }
    setPatternSelection('');
  };

  const handleRenameState = () => {
    if (!activeState) {
      return;
    }
    const nextName = renameValue.trim().toUpperCase();
    if (!nextName) {
      setRenameError('State name is required.');
      return;
    }
    if (stateNames.includes(nextName)) {
      setRenameError('State name already exists.');
      return;
    }
    const nextSpec = renameState(value, activeState, nextName);
    onChange(nextSpec);
    setActiveState(nextName);
    setIsRenaming(false);
    setRenameError(null);
  };

  const handleDeleteState = () => {
    if (!activeState) {
      return;
    }
    onChange(removeStateFromSpec(value, activeState));
  };

  const handleAddTransition = (fromOverride?: string) => {
    if (!canAddTransition) {
      return;
    }
    const from = fromOverride ?? stateNames[0] ?? '';
    const target = stateNames[0] ?? '';
    const nextSpec = upsertTransition(value, from, '', { target, actions: [] });
    onChange(nextSpec);
  };

  const stateRows = transitionRows.filter((row) => row.from === activeState);
  const yamlPreview = useMemo(() => generateFsmYaml(value), [value]);

  const renderTransitionTable = (rows: TransitionRow[], showFrom: boolean, emptyLabel: string) => (
    <Stack spacing={1}>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {showFrom ? <TableCell>From</TableCell> : null}
              <TableCell>On Event</TableCell>
              <TableCell>Target</TableCell>
              <TableCell>Actions</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((transition) => {
              const errors = transitionErrors[transition.rowIndex];
              const fromError = showErrors && !errors?.from;
              const targetError = showErrors && !errors?.target;
              const normalizedEvent = transition.eventName.trim().toUpperCase();
              const eventKey = `${transition.from}::${normalizedEvent}`;
              const hasDuplicate = normalizedEvent ? (eventKeyCounts.get(eventKey) ?? 0) > 1 : false;
              const eventError = showErrors && (!errors?.eventName || hasDuplicate);
              const eventHelper = !errors?.eventName
                ? 'Event required'
                : hasDuplicate
                  ? 'Event must be unique for this state'
                  : ' ';
              const rowKey = buildTransitionRowKey(transition.from, transition.eventName);
              return (
                <TableRow
                  key={`${transition.from}-${transition.eventName}-${transition.rowIndex}`}
                  data-transition-row={rowKey}
                >
                  {showFrom ? (
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={transition.from}
                        onChange={(event) =>
                          handleUpdateTransitionRow(transition.rowIndex, { from: event.target.value })
                        }
                        error={fromError}
                        helperText={fromError ? 'Select a state' : ' '}
                        fullWidth
                      >
                        {stateNames.map((state) => (
                          <MenuItem key={state} value={state}>
                            {state}
                          </MenuItem>
                        ))}
                      </TextField>
                    </TableCell>
                  ) : null}
                  <TableCell data-transition-field="event">
                    <TextField
                      size="small"
                      value={transition.eventName}
                      onChange={(event) =>
                        handleUpdateTransitionRow(transition.rowIndex, { eventName: event.target.value })
                      }
                      placeholder={`VALIDATE or ${retryEventName}`}
                      error={eventError}
                      helperText={eventError ? eventHelper : ' '}
                      fullWidth
                    />
                  </TableCell>
                  <TableCell data-transition-field="target">
                    <TextField
                      select
                      size="small"
                      value={transition.target}
                      onChange={(event) =>
                        handleUpdateTransitionRow(transition.rowIndex, { target: event.target.value })
                      }
                      error={targetError}
                      helperText={targetError ? 'Select a state' : ' '}
                      fullWidth
                    >
                      {stateNames.map((state) => (
                        <MenuItem key={state} value={state}>
                          {state}
                        </MenuItem>
                      ))}
                      </TextField>
                    </TableCell>
                  <TableCell data-transition-field="actions">
                    <ActionMultiSelect
                      value={transition.actions}
                      onChange={(next) => handleUpdateTransitionRow(transition.rowIndex, { actions: next })}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                      <IconButton
                        aria-label="Duplicate transition"
                        onClick={() => handleDuplicateTransitionRow(transition.rowIndex)}
                      >
                        <ContentCopyIcon />
                      </IconButton>
                      <IconButton
                        aria-label="Remove transition"
                        onClick={() => handleRemoveTransitionRow(transition.rowIndex)}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showFrom ? 5 : 4}>
                  <Typography variant="body2" color="text.secondary">
                    {emptyLabel}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </TableContainer>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1}
        alignItems={{ xs: 'stretch', sm: 'center' }}
        justifyContent="space-between"
      >
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => handleAddTransition(showFrom ? undefined : activeState)}
          disabled={!canAddTransition || (!showFrom && !activeState)}
        >
          {showFrom ? 'Add Transition' : 'Add Event'}
        </Button>
        {showFrom ? <WorkflowPresetsControl value={value} onChange={onChange} size="small" /> : null}
      </Stack>
    </Stack>
  );

  if (activeTab === 'transitions') {
    const filteredRows = showOnlyCurrentState
      ? transitionRows.filter((row) => row.from === activeState)
      : transitionRows;
    return (
      <Stack spacing={1.5}>
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1}
          alignItems={{ xs: 'stretch', lg: 'center' }}
          justifyContent="space-between"
        >
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button size="small" variant="outlined" onClick={() => handleQuickAdd('success')}>
              Add Success Event
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleQuickAdd('failureRecoverable')}>
              Add Failure (Recoverable)
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleQuickAdd('failureNotRecoverable')}>
              Add Failure (NotRecoverable)
            </Button>
            <Button size="small" variant="outlined" onClick={() => handleQuickAdd('retry')}>
              Add OnRetry
            </Button>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Switch
                  size="small"
                  checked={showOnlyCurrentState}
                  onChange={(_, checked) => setShowOnlyCurrentState(checked)}
                />
              }
              label="Show only current state"
            />
            <TextField
              select
              size="small"
              label="Current state"
              value={activeState}
              onChange={(event) => setActiveState(event.target.value)}
              sx={{ minWidth: 200 }}
              disabled={!stateNames.length}
            >
              {stateNames.map((state) => (
                <MenuItem key={state} value={state}>
                  {state}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </Stack>
        {renderTransitionTable(
          filteredRows,
          true,
          showOnlyCurrentState ? 'No transitions configured for this state yet.' : 'No transitions configured yet.'
        )}
      </Stack>
    );
  }

  if (activeTab === 'state') {
    const filteredStates = stateNames.filter((state) =>
      state.toLowerCase().includes(stateSearch.trim().toLowerCase())
    );
    const selectedState = value.states.find((state) => state.name === activeState);
    const inboundCount = transitionRows.filter((transition) => transition.target === activeState).length;
    const canDeleteState = Boolean(activeState) && inboundCount === 0;
    const eventEntries = selectedState
      ? Object.entries(selectedState.onEvent ?? {}).sort(([a], [b]) => a.localeCompare(b))
      : [];

    return (
      <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
        <Paper variant="outlined" sx={{ p: 2, minWidth: 240, maxHeight: 520, overflowY: 'auto' }}>
          <Stack spacing={1}>
            <TextField
              size="small"
              label="Search states"
              value={stateSearch}
              onChange={(event) => setStateSearch(event.target.value)}
            />
            <List dense>
              {filteredStates.map((state) => (
                <ListItemButton
                  key={state}
                  selected={state === activeState}
                  onClick={() => setActiveState(state)}
                  data-state-item={buildStateKey(state)}
                >
                  <ListItemText primary={state} />
                </ListItemButton>
              ))}
            </List>
            {filteredStates.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No matching states.
              </Typography>
            ) : null}
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, flex: 1 }}>
          {selectedState ? (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                {isRenaming ? (
                  <TextField
                    size="small"
                    label="State name"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    error={Boolean(renameError)}
                    helperText={renameError ?? ' '}
                    sx={{ minWidth: 240 }}
                  />
                ) : (
                  <Typography variant="h6">{selectedState.name}</Typography>
                )}
                <Stack direction="row" spacing={1} alignItems="center">
                  {isRenaming ? (
                    <>
                      <IconButton aria-label="Save state name" onClick={handleRenameState}>
                        <CheckIcon />
                      </IconButton>
                      <IconButton aria-label="Cancel rename" onClick={() => setIsRenaming(false)}>
                        <CloseIcon />
                      </IconButton>
                    </>
                  ) : (
                    <IconButton aria-label="Rename state" onClick={() => setIsRenaming(true)}>
                      <EditOutlinedIcon />
                    </IconButton>
                  )}
                  <IconButton
                    aria-label="Delete state"
                    onClick={handleDeleteState}
                    disabled={!canDeleteState}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              </Stack>
              {!canDeleteState ? (
                <Typography variant="caption" color="text.secondary">
                  State has inbound references and cannot be deleted.
                </Typography>
              ) : null}

              <Stack spacing={1}>
                <Typography variant="subtitle2">on_event</Typography>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ xs: 'stretch', md: 'center' }}>
                  <Button size="small" variant="outlined" onClick={handleAddEvent}>
                    Add event
                  </Button>
                  <TextField
                    select
                    size="small"
                    label="Add common patterns"
                    value={patternSelection}
                    onChange={(event) => {
                      setPatternSelection(event.target.value);
                      handlePatternSelection(event.target.value);
                    }}
                    sx={{ minWidth: 220 }}
                  >
                    <MenuItem value="success">Success</MenuItem>
                    <MenuItem value="failureRecoverable">Failure recoverable</MenuItem>
                    <MenuItem value="failureNotRecoverable">Failure not recoverable</MenuItem>
                    <MenuItem value="retry">OnRetry</MenuItem>
                  </TextField>
                </Stack>

                {eventEntries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No events configured for this state yet.
                  </Typography>
                ) : (
                  <Stack spacing={1}>
                    {eventEntries.map(([eventName, transition]) => (
                      <Accordion key={eventName} variant="outlined" disableGutters>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="subtitle2">{eventName || 'Unnamed event'}</Typography>
                            <Chip size="small" label={`Target: ${transition.target || 'Unset'}`} />
                            {transition.actions?.length ? (
                              <Chip size="small" label={`${transition.actions.length} action(s)`} />
                            ) : null}
                          </Stack>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Stack spacing={1.5}>
                            <TextField
                              select
                              size="small"
                              label="Target"
                              value={transition.target}
                              onChange={(event) =>
                                onChange(
                                  upsertTransition(value, selectedState.name, eventName, {
                                    target: event.target.value,
                                    actions: transition.actions ?? []
                                  })
                                )
                              }
                            >
                              {stateNames.map((state) => (
                                <MenuItem key={state} value={state}>
                                  {state}
                                </MenuItem>
                              ))}
                            </TextField>
                            <ActionMultiSelect
                              value={transition.actions ?? []}
                              onChange={(next) =>
                                onChange(
                                  upsertTransition(value, selectedState.name, eventName, {
                                    target: transition.target,
                                    actions: next
                                  })
                                )
                              }
                            />
                            <Button
                              variant="text"
                              color="error"
                              startIcon={<DeleteOutlineIcon />}
                              onClick={() => onChange(deleteTransition(value, selectedState.name, eventName))}
                            >
                              Delete event
                            </Button>
                          </Stack>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </Stack>
                )}
              </Stack>
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              Select a state to drill down into its events.
            </Typography>
          )}
        </Paper>
      </Stack>
    );
  }

  const handleCopyYaml = async () => {
    try {
      await navigator.clipboard.writeText(yamlPreview);
    } catch {
      // Ignore clipboard errors.
    }
  };

  const handleDownloadYaml = () => {
    try {
      const blob = new Blob([yamlPreview], { type: 'text/yaml;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = downloadFileName;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      // Ignore download errors.
    }
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
          <Typography variant="subtitle2">Generated FSM YAML</Typography>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Copy YAML">
              <IconButton size="small" onClick={handleCopyYaml} aria-label="Copy YAML">
                <ContentCopyIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              size="small"
              variant="outlined"
              startIcon={<FileDownloadOutlinedIcon />}
              onClick={handleDownloadYaml}
            >
              Download YAML
            </Button>
          </Stack>
        </Stack>
        <Divider />
        <TextField
          value={yamlPreview}
          multiline
          minRows={12}
          InputProps={{
            readOnly: true,
            sx: { fontFamily: '"IBM Plex Mono", "Cascadia Mono", "Courier New", monospace', fontSize: 13 }
          }}
        />
      </Stack>
    </Paper>
  );
}
