import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SchemaOutlinedIcon from '@mui/icons-material/SchemaOutlined';
import SearchIcon from '@mui/icons-material/Search';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Autocomplete,
  Badge,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  InputAdornment,
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
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import type { StateSpec, WorkflowLintIssue, WorkflowSpec, WorkflowTransitionRow } from '../models/snapshot';
import { deleteTransition, listAllTransitions, renameState, upsertTransition } from '../models/snapshot';
import { FSM_PRESETS } from '../features/workflow/presets/presetsRegistry';
import { loadPresetYaml } from '../features/workflow/presets/loadPresetYaml';
import { parseFsmYamlToSpec } from '../features/workflow/presets/parseFsmYamlToSpec';
import { DiagramView } from '../features/workflow/diagram/DiagramView';
import { exportDiagramSvg } from '../features/workflow/diagram/export';
import { filterEdges } from '../features/workflow/diagram/filters';
import { layoutGraph, type LayoutDirection } from '../features/workflow/diagram/layout';
import { toGraphFromSpec } from '../features/workflow/diagram/toGraph';
import type { FsmCatalog } from '../lib/fsmCatalog';
import { fsmCatalog, fsmSuggestions, type FsmTransitionSuggestion } from '../lib/fsmCatalog';
import {
  getSuggestedActionsForEvent,
  getSuggestedEventsForState
} from '../lib/fsmContextSuggestions';
import { ActionsMultiSelect } from './ActionsMultiSelect';
import { StateChipInput } from './StateChipInput';

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
type DiagramEdge = {
  id: string;
  source: string;
  target: string;
  eventName: string;
  label: string;
  kind: 'happy' | 'failure' | 'retry';
  hasActions: boolean;
};

type SearchResult = {
  id: string;
  label: string;
  detail?: string;
  rowKey?: string;
  field?: 'from' | 'event' | 'target' | 'actions';
  stateName?: string;
  kind: 'state' | 'event' | 'action' | 'unused-state';
};

const retryEventName = 'OnRetry';
const buildStateKey = (name: string) => encodeURIComponent(name || '');
const buildTransitionRowKey = (from: string, eventName: string) =>
  encodeURIComponent(`${from}::${eventName || '__EMPTY__'}`);
const buildTransitionSuggestionKey = (from: string, eventName: string, target: string, actions: string[]) => {
  const normalizedActions = [...actions]
    .map((action) => action.trim())
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));
  return `${from}::${eventName}::${target}::${normalizedActions.join('|')}`;
};
const normalizeStateKey = (value: string) => value.trim().toUpperCase();
const normalizeEventKey = (value: string) => value.trim().toUpperCase();
const normalizeActionKey = (value: string) => value.trim().toLowerCase();
const buildStateChipKey = (value: string) => encodeURIComponent(value || '');
const isRetryEventName = (eventName: string) => {
  const normalized = normalizeEventKey(eventName);
  return normalized === 'ONRETRY' || normalized.includes('RETRY');
};
const isFailureEventName = (eventName: string) =>
  /(FAIL|ERROR|REJECT|INVALID|NOTRECOVERABLE|NOT_RECOVERABLE|RECOVERABLE|NACK)/.test(
    normalizeEventKey(eventName)
  );
const groupEventSuggestion = (eventName: string) => {
  const normalized = normalizeEventKey(eventName);
  if (normalized.includes('RETRY') || normalized === 'ONRETRY') {
    return 'Retry events';
  }
  if (/(FAIL|ERROR|REJECT|INVALID|NOTRECOVERABLE|NOT_RECOVERABLE|RECOVERABLE|NACK)/.test(normalized)) {
    return 'Failure events';
  }
  if (/(SUCCESS|PASSED|COMPLETED|ENABLED|APPROVED|APPROVE)/.test(normalized)) {
    return 'Success events';
  }
  return 'Other events';
};

const mergeCatalogs = (base: FsmCatalog, extra?: FsmCatalog | null): FsmCatalog => {
  if (!extra) {
    return base;
  }
  const mergeList = (left: string[], right: string[]) => {
    const seen = new Set<string>();
    const result: string[] = [];
    [...left, ...right].forEach((value) => {
      const next = value.trim();
      if (!next) {
        return;
      }
      const key = next.toLowerCase();
      if (seen.has(key)) {
        return;
      }
      seen.add(key);
      result.push(next);
    });
    return result;
  };
  return {
    states: mergeList(base.states, extra.states),
    events: mergeList(base.events, extra.events),
    actions: mergeList(base.actions, extra.actions)
  };
};

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
  const [showAdvanced, setShowAdvanced] = useState(false);
  const defaultStatesClass = 'com.citi.cpx.statemanager.fsm.State';
  const defaultEventsClass = 'com.citi.cpx.statemanager.fsm.Event';
  const resolvedStatesClass = value.statesClass?.trim() ? value.statesClass : defaultStatesClass;
  const resolvedEventsClass = value.eventsClass?.trim() ? value.eventsClass : defaultEventsClass;

  const stateNames = useMemo(() => value.states.map((state) => state.name), [value.states]);
  const stateKeySet = useMemo(() => new Set(stateNames.map((state) => normalizeStateKey(state))), [stateNames]);
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

  const handleAddState = (candidate: string) => {
    const next = candidate.trim();
    if (!next) {
      return;
    }
    if (stateKeySet.has(normalizeStateKey(next))) {
      return;
    }
    onChange({
      ...value,
      states: [...value.states, { name: next, onEvent: {} }]
    });
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
        <StateChipInput
          states={stateNames}
          onAddState={handleAddState}
          onRemoveState={handleRemoveState}
          catalogStates={fsmCatalog.states}
        />
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
  const [eventSuggestionInput, setEventSuggestionInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFailuresOnly, setFilterFailuresOnly] = useState(false);
  const [filterRetryOnly, setFilterRetryOnly] = useState(false);
  const [showUnusedStates, setShowUnusedStates] = useState(false);
  const [searchPanelOpen, setSearchPanelOpen] = useState(false);
  const [presetSelection, setPresetSelection] = useState('');
  const [presetDialogOpen, setPresetDialogOpen] = useState(false);
  const [presetLoading, setPresetLoading] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<{ label: string; spec: WorkflowSpec } | null>(null);
  const [loadedPresetInfo, setLoadedPresetInfo] = useState<{
    label: string;
    states: number;
    transitions: number;
  } | null>(null);
  const [tempCatalog, setTempCatalog] = useState<FsmCatalog | null>(null);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [diagramHappyPathOnly, setDiagramHappyPathOnly] = useState(false);
  const [diagramShowFailures, setDiagramShowFailures] = useState(true);
  const [diagramShowRetries, setDiagramShowRetries] = useState(true);
  const [diagramDirection, setDiagramDirection] = useState<LayoutDirection>('LR');
  const [diagramExporting, setDiagramExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const diagramContainerRef = useRef<HTMLDivElement | null>(null);
  const theme = useTheme();

  const stateNames = useMemo(() => value.states.map((state) => state.name), [value.states]);
  const mergedCatalog = useMemo(() => mergeCatalogs(fsmCatalog, tempCatalog), [tempCatalog]);
  const canAddTransition = stateNames.length > 0;
  const eventSuggestions = useMemo(
    () => [...mergedCatalog.events].sort((left, right) => left.localeCompare(right)),
    [mergedCatalog.events]
  );
  const catalogStateKeys = useMemo(
    () => new Set(mergedCatalog.states.map((state) => normalizeStateKey(state))),
    [mergedCatalog.states]
  );
  const catalogEventKeys = useMemo(
    () => new Set(mergedCatalog.events.map((event) => normalizeEventKey(event))),
    [mergedCatalog.events]
  );
  const catalogActionKeys = useMemo(
    () => new Set(mergedCatalog.actions.map((action) => normalizeActionKey(action))),
    [mergedCatalog.actions]
  );
  const suggestedEventChips = useMemo(() => eventSuggestions.slice(0, 10), [eventSuggestions]);
  const transitionRows = useMemo(
    () => listAllTransitions(value).map((row, index) => ({ ...row, rowIndex: index })),
    [value]
  );
  const unusedStates = useMemo(() => {
    const inboundCounts = new Map<string, number>();
    const outboundCounts = new Map<string, number>();
    transitionRows.forEach((transition) => {
      inboundCounts.set(transition.target, (inboundCounts.get(transition.target) ?? 0) + 1);
      outboundCounts.set(transition.from, (outboundCounts.get(transition.from) ?? 0) + 1);
    });
    return stateNames.filter(
      (state) => (inboundCounts.get(state) ?? 0) === 0 && (outboundCounts.get(state) ?? 0) === 0
    );
  }, [stateNames, transitionRows]);

  const baseDiagramGraph = useMemo(() => toGraphFromSpec(value), [value]);
  const layoutedDiagramNodes = useMemo(
    () => layoutGraph(baseDiagramGraph.nodes, baseDiagramGraph.edges, diagramDirection),
    [baseDiagramGraph.edges, baseDiagramGraph.nodes, diagramDirection]
  );
  const diagramEdgeLabelById = useMemo(
    () => new Map(baseDiagramGraph.edges.map((edge) => [edge.id, edge.label])),
    [baseDiagramGraph.edges]
  );

  const diagramEdges = useMemo<DiagramEdge[]>(
    () =>
      transitionRows.map((row) => {
        const isFailure = isFailureEventName(row.eventName);
        const isRetry = isRetryEventName(row.eventName);
        const kind: DiagramEdge['kind'] = isFailure ? 'failure' : isRetry ? 'retry' : 'happy';
        const id = `${row.from}__${row.eventName}__${row.target}`;
        return {
          id,
          source: row.from,
          target: row.target,
          eventName: row.eventName,
          label: diagramEdgeLabelById.get(id) ?? row.eventName,
          kind,
          hasActions: (row.actions?.length ?? 0) > 0
        };
      }),
    [diagramEdgeLabelById, transitionRows]
  );

  const visibleDiagramEdges = useMemo(
    () =>
      filterEdges(diagramEdges, {
        happyOnly: diagramHappyPathOnly,
        showFailures: diagramHappyPathOnly ? false : diagramShowFailures,
        showRetries: diagramHappyPathOnly ? false : diagramShowRetries
      }),
    [diagramEdges, diagramHappyPathOnly, diagramShowFailures, diagramShowRetries]
  );

  const diagramFlowEdges = useMemo(
    () => {
      const offsetStep = 28;
      const loopOffsetX = diagramDirection === 'TB' ? 28 : 0;
      const loopOffsetY = diagramDirection === 'LR' ? -28 : 0;
      const groups = new Map<string, DiagramEdge[]>();
      visibleDiagramEdges.forEach((edge) => {
        const key = `${edge.source}__${edge.target}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)?.push(edge);
      });
      const result: Array<{
        id: string;
        source: string;
        target: string;
        label: string;
        type: 'labelled';
        data: { labelOffsetX: number; labelOffsetY: number; hasActions: boolean };
      }> = [];
      groups.forEach((edges) => {
        const middleIndex = (edges.length - 1) / 2;
        edges.forEach((edge, index) => {
          const offsetValue = (index - middleIndex) * offsetStep;
          const isSelfLoop = edge.source === edge.target;
          const baseOffset = edge.hasActions ? 32 : 22;
          const sign = offsetValue === 0 ? 1 : Math.sign(offsetValue);
          const offsetWithBase = offsetValue + sign * baseOffset;
          const labelOffsetX = diagramDirection === 'TB' ? offsetWithBase : 0;
          const labelOffsetY = diagramDirection === 'LR' ? offsetWithBase : 0;
          result.push({
            id: edge.id,
            source: edge.source,
            target: edge.target,
            label: edge.label,
            type: 'labelled',
            data: {
              labelOffsetX: labelOffsetX + (isSelfLoop ? loopOffsetX : 0),
              labelOffsetY: labelOffsetY + (isSelfLoop ? loopOffsetY : 0),
              hasActions: edge.hasActions
            }
          });
        });
      });
      return result;
    },
    [diagramDirection, visibleDiagramEdges]
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
    if (activeTab !== 'transitions' && searchPanelOpen) {
      setSearchPanelOpen(false);
    }
  }, [activeTab, searchPanelOpen]);

  useEffect(() => {
    if (!isRenaming) {
      setRenameValue(activeState);
      setRenameError(null);
    }
  }, [activeState, isRenaming]);

  useEffect(() => {
    setEventSuggestionInput('');
  }, [activeState]);

  const transitionErrors = useMemo(
    () =>
      transitionRows.map((transition) => ({
        from: transition.from && stateNames.includes(transition.from),
        target: transition.target && stateNames.includes(transition.target),
        eventName: transition.eventName.trim().length > 0
      })),
    [stateNames, transitionRows]
  );

  const filteredTransitionRows = useMemo(() => {
    let rows = transitionRows;
    if (showOnlyCurrentState && activeState) {
      rows = rows.filter((row) => row.from === activeState);
    }
    if (filterFailuresOnly) {
      rows = rows.filter((row) => isFailureEventName(row.eventName));
    }
    if (filterRetryOnly) {
      rows = rows.filter((row) => isRetryEventName(row.eventName) && row.from === row.target);
    }
    return rows;
  }, [transitionRows, activeState, showOnlyCurrentState, filterFailuresOnly, filterRetryOnly]);

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

  const transitionSuggestionOptions = useMemo(() => {
    const existingKeys = new Set(
      transitionRows.map((transition) =>
        buildTransitionSuggestionKey(transition.from, transition.eventName, transition.target, transition.actions)
      )
    );
    const filtered = fsmSuggestions.transitions.filter((suggestion) => {
      const key = buildTransitionSuggestionKey(suggestion.from, suggestion.event, suggestion.to, suggestion.actions);
      return !existingKeys.has(key);
    });
    if (showOnlyCurrentState && activeState) {
      return filtered.filter((suggestion) => suggestion.from === activeState);
    }
    return filtered;
  }, [activeState, showOnlyCurrentState, transitionRows]);

  const visibleTransitionSuggestions = useMemo(
    () => transitionSuggestionOptions.slice(0, 6),
    [transitionSuggestionOptions]
  );
  const hiddenTransitionSuggestionCount =
    transitionSuggestionOptions.length - visibleTransitionSuggestions.length;

  const searchResults = useMemo(() => {
    const results: SearchResult[] = [];
    const seen = new Set<string>();
    const query = searchQuery.trim().toLowerCase();
    const rowsForSearch = filteredTransitionRows.length ? filteredTransitionRows : transitionRows;

    const addResult = (result: SearchResult) => {
      if (seen.has(result.id)) {
        return;
      }
      seen.add(result.id);
      results.push(result);
    };

    if (query) {
      stateNames.forEach((state) => {
        if (!state.toLowerCase().includes(query)) {
          return;
        }
        const matchRow =
          rowsForSearch.find((row) => row.from === state) ??
          rowsForSearch.find((row) => row.target === state) ??
          transitionRows.find((row) => row.from === state || row.target === state);
        if (matchRow) {
          const field: 'from' | 'target' = matchRow.from === state ? 'from' : 'target';
          addResult({
            id: `state-${state}-${field}`,
            label: `State: ${state}`,
            detail: field === 'from' ? 'From state' : 'Target state',
            rowKey: buildTransitionRowKey(matchRow.from, matchRow.eventName),
            field,
            kind: 'state'
          });
          return;
        }
        addResult({
          id: `state-${state}-unused`,
          label: `State: ${state}`,
          detail: 'No transitions yet',
          stateName: state,
          kind: 'state'
        });
      });

      rowsForSearch.forEach((row) => {
        if (row.eventName.toLowerCase().includes(query)) {
          addResult({
            id: `event-${row.from}-${row.eventName}`,
            label: `Event: ${row.eventName || 'Unnamed event'}`,
            detail: `${row.from} → ${row.target}`,
            rowKey: buildTransitionRowKey(row.from, row.eventName),
            field: 'event',
            kind: 'event'
          });
        }
        row.actions.forEach((action) => {
          if (!action.toLowerCase().includes(query)) {
            return;
          }
          addResult({
            id: `action-${row.from}-${row.eventName}-${action}`,
            label: `Action: ${action}`,
            detail: `${row.from} • ${row.eventName || 'Unnamed event'}`,
            rowKey: buildTransitionRowKey(row.from, row.eventName),
            field: 'actions',
            kind: 'action'
          });
        });
      });
    }

    if (showUnusedStates) {
      unusedStates.forEach((state) => {
        addResult({
          id: `unused-${state}`,
          label: `State: ${state}`,
          detail: 'Unused state',
          stateName: state,
          kind: 'unused-state'
        });
      });
    }

    return results;
  }, [searchQuery, stateNames, filteredTransitionRows, transitionRows, showUnusedStates, unusedStates]);

  const groupedSearchResults = useMemo(() => {
    const grouped = {
      state: [] as SearchResult[],
      event: [] as SearchResult[],
      action: [] as SearchResult[],
      unused: [] as SearchResult[]
    };
    searchResults.forEach((result) => {
      if (result.kind === 'unused-state') {
        grouped.unused.push(result);
        return;
      }
      if (result.kind === 'state') {
        grouped.state.push(result);
        return;
      }
      if (result.kind === 'event') {
        grouped.event.push(result);
        return;
      }
      grouped.action.push(result);
    });
    return grouped;
  }, [searchResults]);

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
    const next: WorkflowTransitionRow = { ...current, ...patch };
    if (patch.eventName !== undefined && patch.actions === undefined && current.actions.length === 0) {
      const suggestedActions = getSuggestedActionsForEvent(next.eventName, mergedCatalog);
      if (suggestedActions.length) {
        next.actions = suggestedActions;
      }
    }
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

  const handleAddEvent = (candidate?: string) => {
    const from = activeState || stateNames[0];
    if (!from) {
      return;
    }
    const baseName = candidate?.trim() ? candidate.trim() : 'NEW_EVENT';
    const eventName = resolveEventName(from, baseName);
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

  const focusTransitionRow = (rowKey: string, field?: 'from' | 'event' | 'target' | 'actions') => {
    const row = document.querySelector<HTMLElement>(`[data-transition-row="${rowKey}"]`);
    if (!row) {
      return;
    }
    row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (!field) {
      return;
    }
    const fieldContainer = row.querySelector<HTMLElement>(`[data-transition-field="${field}"]`);
    if (!fieldContainer) {
      return;
    }
    const focusTarget =
      fieldContainer.querySelector<HTMLElement>('input, textarea, [role="button"]') ?? fieldContainer;
    focusTarget.focus();
  };

  const focusStateChip = (stateName: string) => {
    const key = buildStateChipKey(stateName);
    const chip = document.querySelector<HTMLElement>(`[data-state-chip="${key}"]`);
    if (!chip) {
      return;
    }
    chip.scrollIntoView({ block: 'center', behavior: 'smooth' });
    chip.focus();
  };

  const buildReplaceSpec = (incoming: WorkflowSpec): WorkflowSpec => {
    const startState =
      incoming.startState && incoming.states.some((state) => state.name === incoming.startState)
        ? incoming.startState
        : incoming.states[0]?.name ?? '';
    return {
      ...value,
      ...incoming,
      workflowKey: value.workflowKey,
      statesClass: incoming.statesClass ?? value.statesClass,
      eventsClass: incoming.eventsClass ?? value.eventsClass,
      startState
    };
  };

  const mergeWorkflowSpec = (base: WorkflowSpec, incoming: WorkflowSpec): WorkflowSpec => {
    const mergedStates: StateSpec[] = base.states.map((state) => ({
      name: state.name,
      onEvent: { ...state.onEvent }
    }));
    const stateIndex = new Map(mergedStates.map((state, index) => [state.name, index]));

    incoming.states.forEach((state) => {
      const index = stateIndex.get(state.name);
      if (index === undefined) {
        stateIndex.set(state.name, mergedStates.length);
        mergedStates.push({
          name: state.name,
          onEvent: { ...state.onEvent }
        });
        return;
      }
      const existing = mergedStates[index];
      Object.entries(state.onEvent ?? {}).forEach(([eventName, transition]) => {
        if (existing.onEvent[eventName]) {
          return;
        }
        existing.onEvent[eventName] = transition;
      });
    });

    return {
      ...base,
      statesClass: base.statesClass ?? incoming.statesClass,
      eventsClass: base.eventsClass ?? incoming.eventsClass,
      startState: base.startState ?? incoming.startState,
      states: mergedStates
    };
  };

  const buildCatalogFromSpec = (spec: WorkflowSpec): FsmCatalog => {
    const states = spec.states.map((state) => state.name);
    const events: string[] = [];
    const actions: string[] = [];
    spec.states.forEach((state) => {
      Object.entries(state.onEvent ?? {}).forEach(([eventName, transition]) => {
        events.push(eventName);
        transition.actions?.forEach((action) => actions.push(action));
      });
    });
    return {
      states,
      events,
      actions
    };
  };

  const handleImportYaml = async (file: File) => {
    setPresetError(null);
    try {
      const yamlText = await file.text();
      const spec = parseFsmYamlToSpec(yamlText);
      const importedCatalog = buildCatalogFromSpec(spec);
      setTempCatalog((prev) => mergeCatalogs(prev ?? { states: [], events: [], actions: [] }, importedCatalog));
      setPendingPreset({ label: `Imported: ${file.name}`, spec });
      setPresetDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import YAML.';
      setPresetError(message);
    }
  };

  const handleImportInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    void handleImportYaml(file);
    event.target.value = '';
  };

  const handlePresetSelect = async (presetId: string) => {
    setPresetSelection(presetId);
    setPresetError(null);
    if (!presetId) {
      return;
    }
    const preset = FSM_PRESETS.find((item) => item.id === presetId);
    if (!preset) {
      setPresetSelection('');
      return;
    }
    setPresetLoading(true);
    try {
      const yamlText = await loadPresetYaml(preset.url);
      const spec = parseFsmYamlToSpec(yamlText);
      setPendingPreset({ label: preset.label, spec });
      setPresetDialogOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load preset.';
      setPresetError(message);
    } finally {
      setPresetLoading(false);
      setPresetSelection('');
    }
  };

  const applyPreset = (mode: 'replace' | 'merge') => {
    if (!pendingPreset) {
      return;
    }
    const incoming = pendingPreset.spec;
    const nextSpec = mode === 'replace' ? buildReplaceSpec(incoming) : mergeWorkflowSpec(value, incoming);
    onChange(nextSpec);
    setLoadedPresetInfo({
      label: pendingPreset.label,
      states: nextSpec.states.length,
      transitions: listAllTransitions(nextSpec).length
    });
    setPendingPreset(null);
    setPresetDialogOpen(false);
  };

  const closePresetDialog = () => {
    setPresetDialogOpen(false);
    setPendingPreset(null);
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

  const handleApplySuggestedTransition = (suggestion: FsmTransitionSuggestion) => {
    const from = suggestion.from.trim();
    const target = suggestion.to.trim();
    const eventName = suggestion.event.trim();
    if (!from || !target || !eventName) {
      return;
    }
    let nextSpec = value;
    const existingStateSet = new Set(nextSpec.states.map((state) => state.name));
    const ensureState = (stateName: string) => {
      if (existingStateSet.has(stateName)) {
        return;
      }
      existingStateSet.add(stateName);
      nextSpec = {
        ...nextSpec,
        states: [...nextSpec.states, { name: stateName, onEvent: {} }]
      };
    };
    ensureState(from);
    ensureState(target);
    const resolvedEventName = resolveEventName(from, eventName);
    nextSpec = upsertTransition(nextSpec, from, resolvedEventName, {
      target,
      actions: suggestion.actions
    });
    onChange(nextSpec);
    setActiveState(from);
  };

  const stateRows = transitionRows.filter((row) => row.from === activeState);
  const yamlPreview = useMemo(() => generateFsmYaml(value), [value]);
  const yamlLines = useMemo(() => yamlPreview.split('\n'), [yamlPreview]);
  const knownTokenSx = { color: 'success.dark', fontWeight: 600 } as const;
  const customTokenSx = { color: 'warning.dark', fontWeight: 600 } as const;

  const renderYamlLine = (line: string, index: number) => {
    const stateMatch = line.match(/^ {2}([^:]+):\s*$/);
    if (stateMatch) {
      const stateName = stateMatch[1];
      const isKnown = catalogStateKeys.has(normalizeStateKey(stateName));
      return (
        <Box key={`yaml-line-${index}`} component="span" sx={{ display: 'block' }}>
          {'  '}
          <Box component="span" sx={isKnown ? knownTokenSx : customTokenSx}>
            {stateName}
          </Box>
          {':'}
        </Box>
      );
    }

    const eventMatch = line.match(/^ {6}([^:]+):\s*$/);
    if (eventMatch) {
      const eventName = eventMatch[1];
      const isKnown = catalogEventKeys.has(normalizeEventKey(eventName));
      return (
        <Box key={`yaml-line-${index}`} component="span" sx={{ display: 'block' }}>
          {'      '}
          <Box component="span" sx={isKnown ? knownTokenSx : customTokenSx}>
            {eventName}
          </Box>
          {':'}
        </Box>
      );
    }

    const actionsMatch = line.match(/^ {8}actions:\s*\[(.*)\]\s*$/);
    if (actionsMatch) {
      const actionsValue = actionsMatch[1].trim();
      if (!actionsValue) {
        return (
          <Box key={`yaml-line-${index}`} component="span" sx={{ display: 'block' }}>
            {line}
          </Box>
        );
      }
      const actions = actionsValue
        .split(',')
        .map((action) => action.trim())
        .filter(Boolean);
      return (
        <Box key={`yaml-line-${index}`} component="span" sx={{ display: 'block' }}>
          {'        actions: [ '}
          {actions.map((action, actionIndex) => {
            const isKnown = catalogActionKeys.has(normalizeActionKey(action));
            return (
              <Box component="span" key={`${action}-${actionIndex}`}>
                <Box component="span" sx={isKnown ? knownTokenSx : customTokenSx}>
                  {action}
                </Box>
                {actionIndex < actions.length - 1 ? ', ' : ''}
              </Box>
            );
          })}
          {' ]'}
        </Box>
      );
    }

    return (
      <Box key={`yaml-line-${index}`} component="span" sx={{ display: 'block' }}>
        {line}
      </Box>
    );
  };

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
                    <TableCell data-transition-field="from">
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
                    {(() => {
                      const normalizedEvent = normalizeEventKey(transition.eventName);
                      const isCustomEvent = Boolean(normalizedEvent) && !catalogEventKeys.has(normalizedEvent);
                      const showRetryHint = normalizedEvent === 'ONRETRY';
                      const helperText = eventError ? eventHelper : isCustomEvent ? 'Custom event (not in catalog)' : ' ';
                      const contextualEvents = getSuggestedEventsForState(transition.from, mergedCatalog);
                      const contextualEventSet = new Set(contextualEvents.map((event) => normalizeEventKey(event)));
                      const eventOptions = [
                        ...contextualEvents,
                        ...eventSuggestions.filter((event) => !contextualEventSet.has(normalizeEventKey(event)))
                      ];
                      return (
                    <Autocomplete
                      freeSolo
                      options={eventOptions}
                      groupBy={groupEventSuggestion}
                      value={transition.eventName}
                      inputValue={transition.eventName}
                      onInputChange={(_, nextValue, reason) => {
                        if (reason === 'input' || reason === 'clear') {
                          handleUpdateTransitionRow(transition.rowIndex, { eventName: nextValue });
                        }
                      }}
                      onChange={(_, nextValue) => {
                        if (typeof nextValue === 'string') {
                          handleUpdateTransitionRow(transition.rowIndex, { eventName: nextValue });
                        }
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          size="small"
                          placeholder={`VALIDATE or ${retryEventName}`}
                          error={eventError}
                          helperText={helperText}
                          InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                              <>
                                {showRetryHint ? (
                                  <InputAdornment position="end">
                                    <Tooltip title="Used for retry loops — typically target same state.">
                                      <InfoOutlinedIcon fontSize="small" color="action" />
                                    </Tooltip>
                                  </InputAdornment>
                                ) : null}
                                {params.InputProps.endAdornment}
                              </>
                            )
                          }}
                          fullWidth
                        />
                      )}
                    />
                      );
                    })()}
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
                    <ActionsMultiSelect
                      value={transition.actions}
                      options={mergedCatalog.actions}
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".yaml,.yml"
          onChange={handleImportInputChange}
          style={{ display: 'none' }}
        />
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => handleAddTransition(showFrom ? undefined : activeState)}
          disabled={!canAddTransition || (!showFrom && !activeState)}
        >
          {showFrom ? 'Add Transition' : 'Add Event'}
        </Button>
        {showFrom ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
            <Button
              variant="outlined"
              onClick={() => fileInputRef.current?.click()}
              sx={{ whiteSpace: 'nowrap' }}
            >
              Import FSM YAML
            </Button>
            <Button
              variant="outlined"
              startIcon={<SchemaOutlinedIcon />}
              onClick={() => setDiagramOpen(true)}
              sx={{ whiteSpace: 'nowrap' }}
            >
              View Diagram
            </Button>
            <TextField
              select
              size="small"
              label="Load Example FSM"
              value={presetSelection}
              onChange={(event) => handlePresetSelect(event.target.value)}
              sx={{ minWidth: 260 }}
              disabled={presetLoading || FSM_PRESETS.length === 0}
            >
              <MenuItem value="" disabled>
                Select preset
              </MenuItem>
              {FSM_PRESETS.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        ) : null}
      </Stack>
    </Stack>
  );

  if (activeTab === 'transitions') {
    const filteredRows = filteredTransitionRows;
    const emptyLabel =
      filterFailuresOnly || filterRetryOnly
        ? 'No transitions match the current filters.'
        : showOnlyCurrentState
          ? 'No transitions configured for this state yet.'
          : 'No transitions configured yet.';
    const showSearchResults = searchQuery.trim().length > 0 || showUnusedStates;
    const showFailuresChecked = diagramHappyPathOnly ? false : diagramShowFailures;
    const showRetriesChecked = diagramHappyPathOnly ? false : diagramShowRetries;
    const handleResultClick = (result: SearchResult) => {
      if (result.rowKey && result.field) {
        focusTransitionRow(result.rowKey, result.field);
        return;
      }
      if (result.stateName) {
        focusStateChip(result.stateName);
      }
    };
    const handleDiagramExport = async () => {
      const container = diagramContainerRef.current;
      if (!container) {
        return;
      }
      const exportTarget =
        container.querySelector<HTMLElement>('.react-flow__renderer') ?? container;
      setDiagramExporting(true);
      try {
        await exportDiagramSvg(exportTarget, {
          backgroundColor: theme.palette.background.default
        });
      } catch {
        // Ignore export errors.
      } finally {
        setDiagramExporting(false);
      }
    };
    return (
      <>
        <Stack spacing={2}>
          <Stack spacing={1.5} sx={{ minWidth: 0 }}>
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
                <Badge badgeContent={searchResults.length} color="primary" invisible={searchResults.length === 0}>
                  <Button
                    size="small"
                    variant={searchPanelOpen ? 'contained' : 'outlined'}
                    onClick={() => setSearchPanelOpen((prev) => !prev)}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    Search & Filters
                  </Button>
                </Badge>
              </Stack>
            </Stack>
            {loadedPresetInfo ? (
              <Alert severity="success">
                Loaded preset: {loadedPresetInfo.label} | States: {loadedPresetInfo.states} | Transitions:{' '}
                {loadedPresetInfo.transitions}
              </Alert>
            ) : null}
            {presetError ? <Alert severity="error">{presetError}</Alert> : null}
            {visibleTransitionSuggestions.length ? (
              <Paper variant="outlined" sx={{ p: 1.5 }}>
                <Stack spacing={1}>
                  <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" flexWrap="wrap">
                    <Typography variant="subtitle2">Suggested transitions</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {hiddenTransitionSuggestionCount > 0
                        ? `Showing top ${visibleTransitionSuggestions.length} of ${transitionSuggestionOptions.length}`
                        : `${transitionSuggestionOptions.length} suggestion(s) from the FSM catalog`}
                    </Typography>
                  </Stack>
                  {visibleTransitionSuggestions.map((suggestion) => (
                    <Stack
                      key={buildTransitionSuggestionKey(
                        suggestion.from,
                        suggestion.event,
                        suggestion.to,
                        suggestion.actions
                      )}
                      direction={{ xs: 'column', md: 'row' }}
                      spacing={1}
                      alignItems={{ xs: 'flex-start', md: 'center' }}
                      justifyContent="space-between"
                    >
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        <Chip size="small" label={`From: ${suggestion.from}`} />
                        <Chip size="small" label={`On: ${suggestion.event}`} />
                        <Chip size="small" label={`To: ${suggestion.to}`} />
                        {suggestion.actions.length ? (
                          suggestion.actions.map((action) => (
                            <Chip key={`${suggestion.from}-${suggestion.event}-${action}`} size="small" label={action} />
                          ))
                        ) : (
                          <Chip size="small" variant="outlined" label="Actions: none" />
                        )}
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="caption" color="text.secondary">
                          {suggestion.count} FSM{suggestion.count === 1 ? '' : 's'}
                        </Typography>
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleApplySuggestedTransition(suggestion)}
                        >
                          Add transition
                        </Button>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Paper>
            ) : null}
            {renderTransitionTable(filteredRows, true, emptyLabel)}
          </Stack>
        </Stack>
        <Drawer
          anchor="right"
          open={searchPanelOpen}
          onClose={() => setSearchPanelOpen(false)}
          ModalProps={{ keepMounted: true }}
          PaperProps={{ sx: { width: { xs: '100%', sm: 360 } } }}
        >
          <Stack spacing={1.5} sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Search & Filters</Typography>
              <IconButton aria-label="Close search panel" onClick={() => setSearchPanelOpen(false)}>
                <CloseIcon />
              </IconButton>
            </Stack>
            <TextField
              size="small"
              placeholder="Search states, events, actions"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                )
              }}
            />
            <Divider />
            <Typography variant="subtitle2">Quick filters</Typography>
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Switch
                  size="small"
                  checked={filterFailuresOnly}
                  onChange={(_, checked) => setFilterFailuresOnly(checked)}
                />
              }
              label="Show only failure transitions"
            />
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Switch size="small" checked={filterRetryOnly} onChange={(_, checked) => setFilterRetryOnly(checked)} />
              }
              label="Show retry loops"
            />
            <FormControlLabel
              sx={{ m: 0 }}
              control={
                <Switch size="small" checked={showUnusedStates} onChange={(_, checked) => setShowUnusedStates(checked)} />
              }
              label="Show unused states"
            />
            <Divider />
            <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
              <Typography variant="subtitle2">Results</Typography>
              <Typography variant="caption" color="text.secondary">
                {searchResults.length} result{searchResults.length === 1 ? '' : 's'}
              </Typography>
            </Stack>
            {showSearchResults ? (
              <Stack spacing={1}>
                {groupedSearchResults.unused.length ? (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Unused states
                    </Typography>
                    <List dense>
                      {groupedSearchResults.unused.map((result) => (
                        <ListItemButton key={result.id} onClick={() => handleResultClick(result)}>
                          <ListItemText primary={result.label} secondary={result.detail} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Stack>
                ) : null}
                {groupedSearchResults.state.length ? (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      States
                    </Typography>
                    <List dense>
                      {groupedSearchResults.state.map((result) => (
                        <ListItemButton key={result.id} onClick={() => handleResultClick(result)}>
                          <ListItemText primary={result.label} secondary={result.detail} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Stack>
                ) : null}
                {groupedSearchResults.event.length ? (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Events
                    </Typography>
                    <List dense>
                      {groupedSearchResults.event.map((result) => (
                        <ListItemButton key={result.id} onClick={() => handleResultClick(result)}>
                          <ListItemText primary={result.label} secondary={result.detail} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Stack>
                ) : null}
                {groupedSearchResults.action.length ? (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Actions
                    </Typography>
                    <List dense>
                      {groupedSearchResults.action.map((result) => (
                        <ListItemButton key={result.id} onClick={() => handleResultClick(result)}>
                          <ListItemText primary={result.label} secondary={result.detail} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Stack>
                ) : null}
                {searchResults.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No matching results.
                  </Typography>
                ) : null}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Enter a search term to scan states, events, and actions.
              </Typography>
            )}
          </Stack>
        </Drawer>
        <Dialog
          open={diagramOpen}
          onClose={() => setDiagramOpen(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>FSM Diagram</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={1}
                alignItems={{ xs: 'stretch', md: 'center' }}
                justifyContent="space-between"
              >
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FileDownloadOutlinedIcon />}
                    onClick={handleDiagramExport}
                    disabled={diagramExporting || stateNames.length === 0}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {diagramExporting ? 'Exporting...' : 'Export SVG'}
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                  <ToggleButtonGroup
                    size="small"
                    value={diagramDirection}
                    exclusive
                    onChange={(_, value) => {
                      if (value) {
                        setDiagramDirection(value);
                      }
                    }}
                    aria-label="Diagram layout direction"
                  >
                    <ToggleButton value="LR" aria-label="Left to right layout">
                      LR
                    </ToggleButton>
                    <ToggleButton value="TB" aria-label="Top to bottom layout">
                      TB
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        size="small"
                        checked={diagramHappyPathOnly}
                        onChange={(_, checked) => setDiagramHappyPathOnly(checked)}
                      />
                    }
                    label="Happy path only"
                  />
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        size="small"
                        checked={showFailuresChecked}
                        onChange={(_, checked) => setDiagramShowFailures(checked)}
                        disabled={diagramHappyPathOnly}
                      />
                    }
                    label="Show failures"
                  />
                  <FormControlLabel
                    sx={{ m: 0 }}
                    control={
                      <Switch
                        size="small"
                        checked={showRetriesChecked}
                        onChange={(_, checked) => setDiagramShowRetries(checked)}
                        disabled={diagramHappyPathOnly}
                      />
                    }
                    label="Show retries"
                  />
                </Stack>
              </Stack>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.default' }}>
                <Box
                  ref={diagramContainerRef}
                  sx={{
                    width: '100%',
                    height: { xs: 360, md: 520 },
                    overflow: 'hidden',
                    borderRadius: 1
                  }}
                >
                  {stateNames.length === 0 ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
                      <Typography variant="body2" color="text.secondary">
                        Define at least one state to render the diagram.
                      </Typography>
                    </Stack>
                  ) : (
                    <DiagramView nodes={layoutedDiagramNodes} edges={diagramFlowEdges} />
                  )}
                </Box>
              </Paper>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDiagramOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
        <Dialog open={presetDialogOpen} onClose={closePresetDialog} maxWidth="sm" fullWidth>
          <DialogTitle>Apply FSM</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5}>
              <Typography variant="body2">Apply &quot;{pendingPreset?.label}&quot; to the workflow editor.</Typography>
              <Typography variant="body2" color="text.secondary">
                Replace will overwrite the current states and transitions. Merge will add new states and transitions
                without overwriting existing events.
              </Typography>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closePresetDialog}>Cancel</Button>
            <Button variant="outlined" onClick={() => applyPreset('merge')} disabled={!pendingPreset}>
              Merge
            </Button>
            <Button variant="contained" onClick={() => applyPreset('replace')} disabled={!pendingPreset}>
              Replace
            </Button>
          </DialogActions>
        </Dialog>
      </>
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
                  <Autocomplete
                    freeSolo
                    options={eventSuggestions}
                    inputValue={eventSuggestionInput}
                    onInputChange={(_, nextValue) => setEventSuggestionInput(nextValue)}
                    onChange={(_, nextValue) => {
                      if (typeof nextValue === 'string' && nextValue.trim()) {
                        handleAddEvent(nextValue);
                        setEventSuggestionInput('');
                      }
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        size="small"
                        label="Suggested event"
                        placeholder="Select or type event"
                      />
                    )}
                    sx={{ minWidth: 220 }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      handleAddEvent(eventSuggestionInput);
                      setEventSuggestionInput('');
                    }}
                  >
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
                {suggestedEventChips.length ? (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      Suggested events from the FSM catalog
                    </Typography>
                    <Stack direction="row" gap={1} flexWrap="wrap">
                      {suggestedEventChips.map((eventName) => (
                        <Chip
                          key={eventName}
                          label={eventName}
                          size="small"
                          variant="outlined"
                          icon={<AddIcon fontSize="small" />}
                          onClick={() => handleAddEvent(eventName)}
                        />
                      ))}
                    </Stack>
                  </Stack>
                ) : null}

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
                            <ActionsMultiSelect
                              value={transition.actions ?? []}
                              options={mergedCatalog.actions}
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
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="flex-start">
          <Box
            sx={{
              flex: 1,
              border: 1,
              borderColor: 'divider',
              borderRadius: 1,
              px: 1.5,
              py: 1,
              minHeight: 240,
              backgroundColor: 'background.paper'
            }}
          >
            <Box
              component="pre"
              sx={{
                m: 0,
                fontFamily: '"IBM Plex Mono", "Cascadia Mono", "Courier New", monospace',
                fontSize: 13,
                whiteSpace: 'pre'
              }}
            >
              {yamlLines.map((line, index) => renderYamlLine(line, index))}
            </Box>
          </Box>
          <Stack spacing={1} sx={{ minWidth: 200 }}>
            <Typography variant="subtitle2">Legend</Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} />
              <Typography variant="body2">Known FSM element</Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'warning.main' }} />
              <Typography variant="body2">Custom element</Typography>
            </Stack>
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
